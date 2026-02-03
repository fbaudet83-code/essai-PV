
import { RoofField, Material, RoofType, Component, Project, InverterBrand, InverterElectricalSpecs, PanelConfig } from '../types';
import { getMinSectionForIn } from './standardsService';

const INTER_CLAMP_GAP = 20; // mm

// Helper pour obtenir le nombre total de panneaux
export function getPanelCount(panels: PanelConfig): number {
    if (panels.rowConfiguration && panels.rowConfiguration.length > 0) {
        return panels.rowConfiguration.reduce((a, b) => a + b, 0);
    }
    return panels.rows * panels.columns;
}

function calculateOptimalRails(
  lineLength: number,
  availableRails: Component[]
): { railComponent: Component; railsPerLine: number; splicesPerLine: number } | null {
  if (availableRails.length === 0 || lineLength <= 0) {
    return null;
  }

  let bestOption: { railComponent: Component; railsPerLine: number; splicesPerLine: number; waste: number } | null = null;
  
  const rail = availableRails[0];
  if (!rail.length || rail.length <= 0) return null;

  const railsPerLine = Math.ceil(lineLength / rail.length);
  const totalLength = railsPerLine * rail.length;
  const waste = totalLength - lineLength;

  bestOption = {
    waste,
    railComponent: rail,
    railsPerLine: railsPerLine,
    splicesPerLine: railsPerLine > 1 ? railsPerLine - 1 : 0,
  };
  
  if (bestOption) {
    const { waste, ...result } = bestOption;
    return result;
  }

  return null;
}

function getMaterialFromDB(db: { [key: string]: Component }, searchId: string, fallbackDesc: string): Component {
    if (db[searchId]) return db[searchId];
    const found = Object.values(db).find(c => c.id === searchId);
    if (found) return found;
    return {
        id: searchId,
        description: fallbackDesc,
        unit: 'piece',
        price: ''
    };
}

export function calculateVoltageDropPercent(
    totalPowerWp: number,
    distanceMeters: number,
    sectionMm2: number,
    isThreePhase: boolean
): number {
    if (totalPowerWp <= 0 || distanceMeters <= 0 || sectionMm2 <= 0) return 0;
    const voltage = isThreePhase ? 400 : 230;
    const current = isThreePhase ? totalPowerWp / (voltage * 1.732) : totalPowerWp / voltage;
    const rho = 0.023;
    const dropV = isThreePhase ? (Math.sqrt(3) * distanceMeters * current * rho) / sectionMm2 : (2 * distanceMeters * current * rho) / sectionMm2;
    return (dropV / voltage) * 100;
}

export function calculateAcCableSection(
    totalPowerWp: number, 
    distanceMeters: number,
    cableDb?: { [key: string]: Component },
    isThreePhase: boolean = false,
    forcedSectionMm2?: number | null
): Material | null {
    if (totalPowerWp <= 0 || distanceMeters <= 0) return null;
    const voltage = isThreePhase ? 400 : 230; 
    const current = isThreePhase ? totalPowerWp / (voltage * 1.732) : totalPowerWp / voltage;
    
    // Choix thermique simplifié (ordre de grandeur) – pas de 1.5 / 4mm²
    // On démarre à 2.5mm² puis on saute directement à 6mm².
    let minSectionThermal = 2.5;
    if (isThreePhase) {
        if (current > 25) minSectionThermal = 6;
        if (current > 32) minSectionThermal = 10;
        if (current > 45) minSectionThermal = 16;
        if (current > 63) minSectionThermal = 25;
    } else {
        if (current > 25) minSectionThermal = 6;
        if (current > 32) minSectionThermal = 10;
        if (current > 45) minSectionThermal = 16;
        if (current > 63) minSectionThermal = 25;
    }

    // Règle sécurité : éviter un disjoncteur trop élevé par rapport au câble.
    // On estime un calibre mini de protection à ~1.25 × Ib (arrondi supérieur).
    // Si la section est surdimensionnée (chute de tension), c'est OK.
    const estimatedBreakerA = Math.ceil(current * 1.25);
    const minSectionProtection = getMinSectionForIn(estimatedBreakerA);

    const maxVoltageDropPercent = 0.01;
    const targetDropV = voltage * maxVoltageDropPercent; 
    const rho = 0.023;
    const theoreticalSectionDrop = isThreePhase ? (Math.sqrt(3) * rho * distanceMeters * current) / targetDropV : (rho * 2 * distanceMeters * current) / targetDropV;
    
    const requiredSection = Math.max(minSectionThermal, theoreticalSectionDrop, minSectionProtection);
    const availableSections = [2.5, 6, 10, 16, 25]; 
    let selectedSection = availableSections.find(s => s >= requiredSection);
    if (!selectedSection) selectedSection = 25;

	    // Option utilisateur : forcer une section (pour tester/choisir en connaissance de cause).
	    // On accepte une section supérieure (surdimensionnement OK) ; une section trop faible sera
	    // gérée ailleurs (message + blocage export) via la vérification In <= Iz.
	    if (forcedSectionMm2 != null) {
	        const forced = availableSections.find(s => s >= forcedSectionMm2);
	        selectedSection = forced ?? selectedSection;
	    }

    // Mapping "référence câble" + logique bobine/couronne (C50/C100/T500)
    // Objectif : choisir automatiquement une couronne 50m si besoin < 50m, sinon 100m (si disponible).
    const pickCoil = (opts: { id: string; coilM: number }[]) => {
        // Priorité : la plus petite couronne qui couvre la longueur.
        const sorted = [...opts].sort((a, b) => a.coilM - b.coilM);
        const chosen = sorted.find(o => distanceMeters <= o.coilM) || sorted[sorted.length - 1];
        return chosen;
    };

    // Listes disponibles selon notre base Richardson/Miguelez
    // (si une section n'existe pas en base, on renvoie une ligne "à chiffrer" via l'ID générique)
    let coilOptions: { id: string; coilM: number }[] = [];
    if (isThreePhase) {
        if (selectedSection <= 2.5) {
            coilOptions = [
                { id: '81010512509205', coilM: 50 },
                { id: '81010512509200', coilM: 100 },
            ];
        } else if (selectedSection <= 6) {
            coilOptions = [{ id: '810105100609205', coilM: 50 }];
        } else {
            // 5G10/5G16/5G25 non référencés dans la base : on laissera "à chiffrer".
            coilOptions = [];
        }
    } else {
        if (selectedSection <= 1.5) {
            coilOptions = [
                { id: '81010311509205', coilM: 50 },
                { id: '81010311509200', coilM: 100 },
            ];
        } else if (selectedSection <= 2.5) {
            coilOptions = [
                { id: '81010312509205', coilM: 50 },
                { id: '81010312509200', coilM: 100 },
            ];
        } else if (selectedSection <= 6) {
            coilOptions = [{ id: '810103100609205', coilM: 50 }];
        } else if (selectedSection <= 10) {
            coilOptions = [
                { id: '810103101009205', coilM: 50 },
                { id: '810103101009200', coilM: 100 },
            ];
        } else if (selectedSection <= 16) {
            // Spécifique : couronne T500
            coilOptions = [{ id: '810103101609207', coilM: 500 }];
        } else {
            coilOptions = [];
        }
    }

    const fallbackId = `CABLE-R2V-${isThreePhase ? '5G' : '3G'}${selectedSection}-MANUEL`;
    const chosen = coilOptions.length ? pickCoil(coilOptions) : { id: fallbackId, coilM: 50 };

    const comp = cableDb ? cableDb[chosen.id] : null;
    const qty = Math.max(1, Math.ceil(distanceMeters / (chosen.coilM || 50)));
    if (!comp) {
        return {
            id: chosen.id,
            description: coilOptions.length
                ? `CABLE R2V ${isThreePhase ? '5G' : '3G'}${selectedSection} C${chosen.coilM}`
                : `Câble R2V ${isThreePhase ? '5G' : '3G'}${selectedSection} (longueur estimée ${Math.ceil(distanceMeters)} m) – À chiffrer`,
            quantity: qty,
            price: ''
        };
    }

    return {
        id: comp.id,
        description: comp.description,
        quantity: qty,
        price: comp.price,
        datasheetUrl: comp.datasheetUrl
    };
}

export function calculateDcCableSection(
    totalPanels: number, 
    distanceMeters: number,
    cableDb?: { [key: string]: Component }
): Material | null {
    if (totalPanels <= 0 || distanceMeters <= 0) return null;
    let section = 6; 
    const Vmp_panel = 42; 
    const Imp = 13.5;
    const minStringVoltage = Math.max(totalPanels, 6) * Vmp_panel; 
    const rho = 0.023;
    // DC : limite générale assouplie à 3% (recommandation souvent 1%)
    const targetDrop = 0.03 * minStringVoltage; 
    const theoreticalSection = (rho * 2 * distanceMeters * Imp) / targetDrop;
    if (theoreticalSection > 6) section = 10;
    
    const cableId = section === 6 ? '821101000609200' : 'CABLE-DC-10MM';
    let comp = cableDb ? cableDb[cableId] : null;
    if (!comp) {
         comp = { id: cableId, description: `Câble Solaire DC H1Z2Z2-K ${section}mm²`, unit: 'piece', price: '' };
    }

    let quantity = Math.ceil(distanceMeters * 2 / 100);
    if (comp.id === '821101000609200') {
        quantity = Math.ceil((distanceMeters * 2) / 100);
    }

    return { id: comp.id, description: comp.description, quantity: Math.max(1, quantity), price: comp.price, datasheetUrl: comp.datasheetUrl };
}

export function calculateMicroInverters(
    field: RoofField, 
    inverterConfig: Project['inverterConfig'],
    inverterDb: { [key: string]: Component }
): Material[] {
    const bom: Material[] = [];
    const totalPanels = getPanelCount(field.panels);
    const isPortrait = field.panels.orientation === 'Portrait';
    const brand = inverterConfig.brand;
    const isThreePhase = inverterConfig.phase === 'Tri';

    if (totalPanels === 0) return [];

    const activeInvComp = (Object.values(inverterDb) as Component[]).find(c => c.id === inverterConfig.model);
    const isCustomMicro = brand === InverterBrand.CUSTOM && (activeInvComp?.electrical as InverterElectricalSpecs)?.isMicro;

    const isMicroSystem = brand === InverterBrand.ENPHASE || 
                          brand === InverterBrand.APSYSTEMS || 
                          isCustomMicro ||
                          (brand === InverterBrand.FOXESS && inverterConfig.model?.includes('MICRO'));

    if (isMicroSystem) {
        if (isThreePhase) {
            const maleTri = getMaterialFromDB(inverterDb, '2300711032', 'CONNECTEUR ETANCHE MALE TRI. APS');
            const femaleTri = getMaterialFromDB(inverterDb, '2300812032', 'CONNECTEUR ETANCHE FEM. TRI. APS');
            bom.push({ id: maleTri.id, description: maleTri.description, quantity: 1, price: maleTri.price || 'A04CJ7', datasheetUrl: maleTri.datasheetUrl });
            bom.push({ id: femaleTri.id, description: femaleTri.description, quantity: 1, price: femaleTri.price || 'A04CK5', datasheetUrl: femaleTri.datasheetUrl });
        } else {
            const maleMono = getMaterialFromDB(inverterDb, '2300531032', 'CONNECTEUR ETANCHE MALE MONO APS');
            const femaleMono = getMaterialFromDB(inverterDb, '2300532032', 'CONNECTEUR ETANCHE FEM. MONO APS');
            bom.push({ id: maleMono.id, description: maleMono.description, quantity: 1, price: maleMono.price || 'A04CG2', datasheetUrl: maleMono.datasheetUrl });
            bom.push({ id: femaleMono.id, description: femaleMono.description, quantity: 1, price: femaleMono.price || 'A04CH0', datasheetUrl: femaleMono.datasheetUrl });
        }
    }

    if (brand === InverterBrand.ENPHASE) {
        const inverterId = inverterConfig.model || 'ENP-IQ8MC-72-M-INT';
        const inverter = getMaterialFromDB(inverterDb, inverterId, `Micro-onduleur Enphase`);
        bom.push({ id: inverter.id, description: inverter.description, quantity: totalPanels, price: inverter.price, datasheetUrl: inverter.datasheetUrl });

        let cableId = '';
        if (isThreePhase) {
            cableId = isPortrait ? 'Q-25-10-3P-200' : 'Q-25-17-3P-160';
        } else {
            cableId = isPortrait ? 'ENP-Q-25-10-240' : 'ENP-Q-25-17-240';
        }
        const cable = getMaterialFromDB(inverterDb, cableId, 'Câble Enphase Q-Cable');
        bom.push({ id: cable.id, description: cable.description, quantity: totalPanels, price: cable.price, datasheetUrl: cable.datasheetUrl });

        const termId = isThreePhase ? 'Q-TERM-3P' : 'ENP-Q-TERM-R';
        const termDesc = isThreePhase ? 'EMBOUT DE TERMIN.TRI.ENPHASE' : 'EMBOUT TERMINAIS.MONO ENPHASE';
        const term = getMaterialFromDB(inverterDb, termId, termDesc);
        bom.push({ id: term.id, description: term.description, quantity: 1, price: term.price, datasheetUrl: term.datasheetUrl });

    } else if (brand === InverterBrand.APSYSTEMS) {
        const numInverters = Math.ceil(totalPanels / 2);
        const inverterId = inverterConfig.model || 'APS-DS3';
        const inverterComp = getMaterialFromDB(inverterDb, inverterId, `Micro-onduleur AP Systems`);
        
        bom.push({ id: inverterComp.id, description: `${inverterComp.description} (1 pour 2 panneaux)`, quantity: numInverters, price: inverterComp.price, datasheetUrl: inverterComp.datasheetUrl });

        if (isPortrait) {
            const cablePortrait = getMaterialFromDB(inverterDb, '2322304903', 'CABLE MONO. PORTRAIT 2M APS');
            bom.push({ id: cablePortrait.id, description: cablePortrait.description, quantity: numInverters, price: cablePortrait.price || 'A04C98', datasheetUrl: cablePortrait.datasheetUrl });
        } else {
            const cablePaysage = getMaterialFromDB(inverterDb, '2322404903', 'CABLE MONO. PAYSAGE 4M DS3 APS');
            bom.push({ id: cablePaysage.id, description: cablePaysage.description, quantity: numInverters, price: cablePaysage.price || 'A04CS1', datasheetUrl: cablePaysage.datasheetUrl });
        }

        const cap = getMaterialFromDB(inverterDb, '2060700017', 'EMBOUT TERMINAIS.MONO APS');
        bom.push({ id: cap.id, description: cap.description, quantity: 1, price: cap.price || 'A08TY8', datasheetUrl: cap.datasheetUrl });

    } else if (brand === InverterBrand.FOXESS) {
        const modelId = inverterConfig.model;
        if (modelId && modelId.includes('MICRO')) {
             const isQuad = modelId.includes('2000');
             const inputsPerInv = isQuad ? 4 : 2;
             const numInverters = Math.ceil(totalPanels / inputsPerInv);
             const inverterComp = getMaterialFromDB(inverterDb, modelId, `Micro-onduleur FoxESS`);
             bom.push({ id: inverterComp.id, description: `${inverterComp.description} (1 pour ${inputsPerInv} panneaux)`, quantity: numInverters, price: inverterComp.price, datasheetUrl: inverterComp.datasheetUrl });
             
             const cable = getMaterialFromDB(inverterDb, '10-100-01176-0', 'CABLE AC MONO FoxESS');
             bom.push({ id: cable.id, description: cable.description, quantity: numInverters, price: cable.price, datasheetUrl: cable.datasheetUrl });

             const tee = getMaterialFromDB(inverterDb, '10-208-00083-00', 'TE DE CONNEXION AC MONO FoxESS');
             bom.push({ id: tee.id, description: tee.description, quantity: numInverters, price: tee.price, datasheetUrl: tee.datasheetUrl });
             
             // --- LOGIQUE MULTI-BRANCHES FOXESS ---
             // 1 branche = max 7 micros.
             // Pour chaque groupe de 7 micros au-delà des 7 premiers, on ajoute :
             // 1 Bouchon, 1 Connecteur Femelle, 1 Connecteur Mâle.
             const extraBranches = Math.floor((numInverters - 1) / 7);
             const totalCaps = 1 + extraBranches;

             const cap = getMaterialFromDB(inverterDb, '10-109-00175-00', 'BOUCHON AC FoxESS');
             bom.push({ id: cap.id, description: cap.description, quantity: totalCaps, price: cap.price, datasheetUrl: cap.datasheetUrl });

             if (extraBranches > 0) {
                 const connFem = getMaterialFromDB(inverterDb, '2300532032', 'CONNECTEUR ETANCHE FEM. MONO APS');
                 bom.push({ id: connFem.id, description: connFem.description, quantity: extraBranches, price: connFem.price, datasheetUrl: connFem.datasheetUrl });

                 const connMale = getMaterialFromDB(inverterDb, '2300531032', 'CONNECTEUR ETANCHE MALE MONO APS');
                 bom.push({ id: connMale.id, description: connMale.description, quantity: extraBranches, price: connMale.price, datasheetUrl: connMale.datasheetUrl });
             }
        }
    } else if (brand === InverterBrand.CUSTOM && isCustomMicro) {
        const inverterComp = getMaterialFromDB(inverterDb, inverterConfig.model || 'OND-PERSO', `Micro-onduleur Perso`);
        bom.push({ id: inverterComp.id, description: inverterComp.description, quantity: totalPanels, price: inverterComp.price, datasheetUrl: inverterComp.datasheetUrl });
    }
    return bom;
}

export function calculateCentralInverter(
    totalPowerW: number,
    inverterConfig: Project['inverterConfig'],
    inverterDb: { [key: string]: Component }
): Material | null {
    if (totalPowerW === 0) return null;

    if (inverterConfig.brand === InverterBrand.CUSTOM) {
        const comp = getMaterialFromDB(inverterDb, inverterConfig.model || 'OND-PERSO', 'Onduleur Personnalisé');
        const isMicro = (comp.electrical as InverterElectricalSpecs)?.isMicro;
        if (isMicro) return null;
        return { id: comp.id, description: comp.description, quantity: 1, price: comp.price, datasheetUrl: comp.datasheetUrl };
    }

    if (inverterConfig.brand !== InverterBrand.FOXESS || inverterConfig.model?.includes('MICRO')) return null;

    let selectedModelId = inverterConfig.model;

    if (!selectedModelId || selectedModelId === 'Auto') {
        const candidates = (Object.values(inverterDb) as Component[]).filter(c => c.id.startsWith('FOX-S') || c.id.startsWith('FOX-F'));
        candidates.sort((a,b) => (a.power || 0) - (b.power || 0));
        const target = totalPowerW * 0.8;
        const found = candidates.find(c => (c.power || 0) >= target) || candidates[candidates.length-1];
        selectedModelId = found?.id || 'FOX-S3000';
    }

    const comp = getMaterialFromDB(inverterDb, selectedModelId!, `Onduleur FoxESS`);
    return {
        id: comp.id,
        description: comp.description,
        quantity: 1,
        price: comp.price,
        datasheetUrl: comp.datasheetUrl
    };
}


export function calculateBillOfMaterials(
    field: RoofField, 
    components: { [key: string]: Component }, 
    system: Project['system'],
    inverterDb: { [key: string]: Component },
    cableDb: { [key: string]: Component } | undefined,
    inverterConfig?: Project['inverterConfig']
): Material[] {
  if (!field.panels.model || field.panels.rows === 0 || field.panels.columns === 0) {
    return [];
  }

  const bom: Material[] = [];
  const { panels, roof } = field;
  // Utilisation de la nouvelle fonction getPanelCount pour gérer les formes personnalisées
  const totalPanels = getPanelCount(panels);
  
  // Note: Pour les calculs de rails, on conserve les dimensions MAX (rows * columns) comme boîte englobante
  // pour s'assurer qu'il y a assez de matériel pour les longueurs de lignes les plus grandes.
  const { rows, columns } = panels;

  if (totalPanels > 0) {
      bom.push({ id: panels.model.name, description: panels.model.name, quantity: totalPanels, price: panels.model.price || '', datasheetUrl: panels.model.datasheetUrl });
  }

  // Utilisation de l'orientation spécifique à la toiture, ou fallback sur l'ancienne propriété système
  const fieldRailOrientation = field.railOrientation || system.railOrientation || 'Horizontal';
  const railsVertical = fieldRailOrientation === 'Vertical';

  const addMaterial = (component: Component | undefined, quantity: number, optional = false) => {
    if (component && quantity > 0) {
      bom.push({ 
          id: component.id, 
          description: optional ? `${component.description}*` : component.description, 
          quantity: Math.ceil(quantity), 
          price: component.price || '', 
          datasheetUrl: component.datasheetUrl 
      });
    }
  };

  const panelWidth = panels.model.width;
  const panelHeight = panels.model.height;
  const isPortrait = panels.orientation === 'Portrait';
  const fieldWidth = isPortrait ? columns * panelWidth + Math.max(0, columns - 1) * INTER_CLAMP_GAP : columns * panelHeight + Math.max(0, columns - 1) * INTER_CLAMP_GAP;
  const fieldHeight = isPortrait ? rows * panelHeight + Math.max(0, rows - 1) * INTER_CLAMP_GAP : rows * panelWidth + Math.max(0, rows - 1) * INTER_CLAMP_GAP;
  
  let numRailLines = railsVertical ? columns * 2 : rows * 2;
  let lineLength = railsVertical ? fieldHeight : fieldWidth;

  const availableRails = Object.values(components).filter(c => c.description.toLowerCase().includes('rail') && c.length && c.length > 0).sort((a, b) => (a.length || 0) - (b.length || 0));
  
  if (system.brand === 'ESDEC') {
      if (availableRails.length > 0) {
          const railComponent = availableRails[0];
          const totalRailLength = numRailLines * lineLength;
          addMaterial(railComponent, Math.ceil(totalRailLength / railComponent.length!));
          const railsPerLine = Math.ceil(lineLength / railComponent.length!);
          if (railsPerLine > 1) addMaterial(components.SPLICE, (railsPerLine - 1) * numRailLines);
      }
      addMaterial(components.END_CAP, numRailLines * 2);
      addMaterial(components.UNIVERSAL_CLAMP, railsVertical ? totalPanels * 2 + 4 : (columns + 1) * rows * 2);
      
      let fixingComponent = components.HOOK_UNIVERSAL;
      if (roof.type === RoofType.FIBROCIMENT) {
          fixingComponent = components.HANGER_BOLT_FIBRO;
      }
      
      if (fixingComponent) {
        const totalFixings = Math.max(2, Math.ceil(lineLength / 1000)) * numRailLines;
        addMaterial(fixingComponent, totalFixings);
        if (fixingComponent === components.HOOK_UNIVERSAL && components.HOOK_GASKET) addMaterial(components.HOOK_GASKET, totalFixings, true);
      }
      
      if (inverterConfig && inverterConfig.brand !== InverterBrand.NONE) {
          let microCount = 0;
          let clipsPerMicro = 0;

          const invComp = inverterDb[inverterConfig.model || ''];
          const isCustomMicro = inverterConfig.brand === InverterBrand.CUSTOM && (invComp?.electrical as InverterElectricalSpecs)?.isMicro;

          if (inverterConfig.brand === InverterBrand.ENPHASE || isCustomMicro) {
              microCount = totalPanels;
              clipsPerMicro = 1;
          } else if (inverterConfig.brand === InverterBrand.APSYSTEMS) {
              microCount = Math.ceil(totalPanels / 2);
              clipsPerMicro = 1;
          } else if (inverterConfig.brand === InverterBrand.FOXESS && inverterConfig.model?.includes('MICRO')) {
              const inputs = inverterConfig.model.includes('2000') ? 4 : 2;
              microCount = Math.ceil(totalPanels / inputs);
              clipsPerMicro = 2; 
          }

          if (microCount > 0 && clipsPerMicro > 0) {
              const clipRef = components.CLIP_HEAVY_DUTY || { id: '1008068', description: 'ClickFit EVO - Clip métal poids lourd 2-8kg (Micro-ond)', unit: 'piece', price: 'A0K6F7' };
              addMaterial(clipRef, microCount * clipsPerMicro);
          }
      }

  } else {
    const railPlan = calculateOptimalRails(lineLength, availableRails);
    if (railPlan) {
      addMaterial(railPlan.railComponent, railPlan.railsPerLine * numRailLines);
      addMaterial(components.SPLICE, railPlan.splicesPerLine * numRailLines);
    }
    addMaterial(components.END_CAP, numRailLines * 2);
    addMaterial(components.MID_CLAMP, railsVertical ? (rows - 1) * 2 * columns : (columns - 1) * 2 * rows);
    addMaterial(components.END_CLAMP, railsVertical ? 4 * columns : 4 * rows);
    
    if (roof.type === RoofType.FIBROCIMENT) {
        // Fixations Fibrociment K2 (Boulon de suspension / Tirefond)
        const totalFixings = Math.max(2 * numRailLines, Math.ceil(lineLength / 1000) * numRailLines); // Espacement approx 1m
        addMaterial(components.HANGER_BOLT_FIBRO, totalFixings);
    } else {
        // Fixations Tuiles (Crochets)
        const totalFixings = Math.max(2 * numRailLines, Math.ceil(lineLength / 800) * numRailLines);
        addMaterial(components.HOOK_CROSSHOOK, totalFixings);
        addMaterial(components.WOOD_SCREW_8X100, totalFixings * 2);
    }
    
    addMaterial(components.GROUND_LUG_K2SZ, totalPanels);
    
    let microInvCount = 0;
    let supportsPerMicro = 1;

    if (inverterConfig && inverterConfig.brand !== InverterBrand.NONE) {
        const invComp = inverterDb[inverterConfig.model || ''];
        const isCustomMicro = inverterConfig.brand === InverterBrand.CUSTOM && (invComp?.electrical as InverterElectricalSpecs)?.isMicro;

        if (inverterConfig.brand === InverterBrand.ENPHASE || isCustomMicro) {
            microInvCount = totalPanels;
            supportsPerMicro = 1;
        }
        else if (inverterConfig.brand === InverterBrand.APSYSTEMS) {
            microInvCount = Math.ceil(totalPanels / 2);
            supportsPerMicro = 1;
        }
        else if (inverterConfig.brand === InverterBrand.FOXESS && inverterConfig.model?.includes('MICRO')) {
            microInvCount = Math.ceil(totalPanels / (inverterConfig.model.includes('2000') ? 4 : 2));
            supportsPerMicro = 2;
        }
    }
    
    if (microInvCount > 0) {
        addMaterial(components.STAIRPLATE_KIT, microInvCount * supportsPerMicro);
        // addMaterial(components.MK2_NUT, microInvCount * supportsPerMicro);
        // addMaterial(components.M8_SCREW, microInvCount * supportsPerMicro);
    }
  }

  if (inverterConfig && inverterConfig.brand !== InverterBrand.NONE) {
      const microInverters = calculateMicroInverters(field, inverterConfig, inverterDb);
      bom.push(...microInverters);

      let microInvCount = 0;
      const invComp = inverterDb[inverterConfig.model || ''];
      const isCustomMicro = inverterConfig.brand === InverterBrand.CUSTOM && (invComp?.electrical as InverterElectricalSpecs)?.isMicro;

      if (inverterConfig.brand === InverterBrand.APSYSTEMS) {
          microInvCount = Math.ceil(totalPanels / 2);
      } else if (inverterConfig.brand === InverterBrand.FOXESS && inverterConfig.model?.includes('MICRO')) {
          const inputsPerInv = inverterConfig.model.includes('2000') ? 4 : 2;
          microInvCount = Math.ceil(totalPanels / inputsPerInv);
      } else if (isCustomMicro) {
          microInvCount = totalPanels;
      }

      if (microInvCount > 0) {
          const extComp = cableDb?.['MC4-EXT-2M'] || { id: '303037', description: 'Rallonge MC4 2M', unit: 'piece', price: 'A0BEX2' };
          bom.push({ id: extComp.id, description: extComp.description, quantity: microInvCount * 2, price: extComp.price, datasheetUrl: extComp.datasheetUrl });
      }
  }

  return bom;
}

export type MaterialCategory = 'Panneaux' | 'Onduleurs' | 'Electricité' | 'Structure' | 'Accessoires';

export interface GroupedMaterials {
    category: MaterialCategory;
    items: Material[];
    subSections?: { title: string; items: Material[] }[];
}

export function groupMaterialsByCategory(materials: Material[]): GroupedMaterials[] {
    const groups: Record<MaterialCategory, Material[]> = {
        'Panneaux': [],
        'Onduleurs': [],
        'Electricité': [],
        'Structure': [],
        'Accessoires': []
    };

    // Câbles/consommables à afficher en fin de devis (ACCESSOIRES)
    // - R2V MIGUELEZ (3G2,5 / 3G6 / 3G10 / 3G16 / 5G1,5 / 5G2,5 / 5G6 / 5G10)
    // - Terre H07V-K 1x6 C100
    // - Solaire H1Z2Z2 1x6 (noir) C100
    // - LIYCY 2x0,75 C100
    const isAccessoryCable = (m: Material) => {
        const id = (m?.id || '').toString();
        const d = (m?.description || '').toLowerCase();

        // IDs issus de la base câbles (MIGUELEZ) + câbles terre/solaire/commande
        const ACCESS_IDS = new Set([
            // R2V MIGUELEZ
            '810103100609205', // 3G6 C50
            '81010100060920',  // 3G2.5 C100
            '810105100609205', // 3G10 C50
            '810106100609205', // 3G16 C25
            '8102051507512',   // 5G1.5 C50
            '8102025007512',   // 5G2.5 C50
            '8102066007512',   // 5G6 C25
            '81021060060820',  // 5G10 C20
            // Terre / solaire / commande
            '820001000608600', // H07V-K 1x6 C100
            '821101000609200', // H1Z2Z2 1x6 NOIR C100
            'CAB14124171',      // LIYCY 2x0.75 C100
        ]);
        if (ACCESS_IDS.has(id)) return true;

        // Détection par désignation (au cas où l'id change)
        if (d.includes('cable r2v')) return true;
        if (d.includes('cable terre') && d.includes('h07v')) return true;
        if (d.includes('h1z2z2') || d.includes('cable solaire')) return true;
        if (d.includes('liyc') || d.includes('liyc y') || d.includes('liyc y')) return true;

        return false;
    };

    materials.forEach(item => {
        const desc = item.description.toLowerCase();
        const id = item.id.toUpperCase();

        if (
            (desc.includes('panneau') || desc.includes('module') || desc.includes('dmegc') || desc.includes('tcl') || desc.includes('dualsun')) &&
            !desc.includes('onduleur') && 
            !desc.includes('micro')
        ) {
            groups['Panneaux'].push(item);
        }
        else if (
            (
                (desc.includes('onduleur') || desc.includes('micro-onduleur') || desc.includes('passerelle') || desc.includes('envoy') || desc.includes('ecu')) && 
                !desc.includes('fixation') && 
                !desc.includes('clip') && 
                !desc.includes('ecrou') && 
                !desc.includes('écrou') &&
                !desc.includes('montage') &&
                !desc.includes('coffret') && 
                !desc.includes('tore') && 
                !desc.includes('compteur') && 
                !desc.includes('meter') 
            ) ||
            id.startsWith('ENP-IQ') || 
            id.startsWith('APS-DS3') || 
            (id.startsWith('FOX-') && !id.includes('ECS') && !id.includes('EP') && !id.includes('MIRA')) ||
            id.startsWith('SMG666') ||
            id === 'OND-PERSO'
        ) {
            groups['Onduleurs'].push(item);
        }
        else if (isAccessoryCable(item)) {
            groups['Accessoires'].push(item);
        }
        else if (
            desc.includes('batterie') || id.includes('ECS') || id.includes('EP5') || id.includes('EP11') ||
            desc.includes('coffret') || desc.includes('disjoncteur') || desc.includes('inter diff') ||
            desc.includes('cable') || desc.includes('câble') || desc.includes('cordon') || desc.includes('rallonge') ||
            (desc.includes('connecteur') && !desc.includes('rail')) || 
            desc.includes('embout') || 
            desc.includes('te de connexion') || 
            desc.includes('mc4') || 
            (desc.includes('terminaison') && !desc.includes('rail')) || 
            desc.includes('bouchon ac') || 
            desc.includes('tore') || desc.includes('compteur') ||
            desc.includes('borne') || desc.includes('sticker') || desc.includes('q-relay') || desc.includes('qrelay') ||
            id.startsWith('Q-RELAY') ||
            id.startsWith('MAD-')
        ) {
            groups['Electricité'].push(item);
        }
        else {
            groups['Structure'].push(item);
        }
    });

    groups['Electricité'].sort((a, b) => {
        // Objectif d'affichage (devis) :
        // 1) STICKER
        // 2) COFFRET(S) AC
        // 3) DISJONCTEUR + INTER DIFF (AC)
        // 4) COFFRET(S) DC (si onduleur centralisé)
        // 5) puis accessoires/consommables (bouchons, câbles AC mono, TE, rallonges, etc.)
        // NB: certains coffrets AC n'ont pas "AC" dans la désignation, donc on utilise aussi un set d'IDs.

        const AC_COFFRET_IDS = new Set([
            // Type F 300mA
            '13412','13416','13418','13474','13476',
            // Type B 300mA
            '12522','12526','12528','12501',
            // COFAC (tri)
            '12334','12338','12340','12333','12337','12341',
            // Q-Relay / passerelle
            '13462','13464','13466','13488',
            // +PASS
            '13442','13444','13446','13498',
            // Backup
            '12554','12556','12558','12507'
        ]);
        const DC_COFFRET_IDS = new Set(['12232','12272','12282','12233','12273','12283']);

        const isAcCoffret = (item: Material) => {
            const desc = (item.description || '').toLowerCase();
            const id = (item.id || '').toString();
            if (!desc.includes('coffret')) return false;
            if (desc.includes('dc')) return false;
            if (desc.includes('ac')) return true;
            return AC_COFFRET_IDS.has(id);
        };
        const isDcCoffret = (item: Material) => {
            const desc = (item.description || '').toLowerCase();
            const id = (item.id || '').toString();
            if (!desc.includes('coffret')) return false;
            if (desc.includes('dc')) return true;
            return DC_COFFRET_IDS.has(id);
        };

        const getPriority = (item: Material) => {
            const desc = (item.description || '').toLowerCase();
            const id = (item.id || '').toUpperCase();

            // Batteries / stockage d'abord (si présent)
            if (desc.includes('batterie') || id.includes('ECS') || id.includes('EP5') || id.includes('EP11') || id.includes('MIRA')) return 1;

            // 1) Sticker
            if (id.startsWith('STICKER')) return 2;

            // 2) Coffret(s) AC
            if (isAcCoffret(item)) return 3;

            // 3) Disjoncteur + inter diff (AC)
            if (desc.includes('disjoncteur') || desc.includes('inter diff')) return 4;

            // 4) Coffret(s) DC (si applicable)
            if (isDcCoffret(item)) return 5;

            // 5) Le reste
            if (desc.includes('compteur') || desc.includes('meter') || id.includes('DDSU') || id.includes('DTSU') || desc.includes('tore')) return 6;
            if (desc.includes('borne') || desc.includes('cordon ve') || desc.includes('recharge')) return 7;
            if (desc.includes('foxess') || id.startsWith('FOX-') || id.startsWith('10-')) return 8;
            if (desc.includes('enphase') || id.startsWith('ENP-') || id.startsWith('Q-')) return 9;
            if (desc.includes('aps') || id.startsWith('APS-') || desc.includes('ecu')) return 10;
            return 11;
        };

        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return a.description.localeCompare(b.description);
    });

    // IMPORTANT:
    // We must NOT classify generic breakers/RCBO as "EV" by default.
    // However, when an EV charger is selected, it's clearer for the quote
    // to group the dedicated protections (ex: 02056 + 03446) under "BORNE VE".
    // We therefore:
    //  - Always classify the EV hardware itself (charger + cable) as EV.
    //  - Additionally classify the dedicated protections ONLY IF an EV charger is present.
    const evHardwareIds = ['A7300S1-E-2', 'A022KS1-E-A', '15254', '15264'];
    const hasEvHardware = materials.some(m => evHardwareIds.includes((m?.id || '').toString()));
    // Protections dédiées VE connues (à grouper sous "BORNE VE" quand une borne est sélectionnée)
    // - TRI 22kW : 02056 (4x40A) + 03446 (Inter diff tri)
    // - MONO 7kW : 03140 (Disj diff mono)
    const evProtectionIds = hasEvHardware ? ['02056', '03446', '03140'] : [];
    
    const generalElec: Material[] = [];
    const evElec: Material[] = [];

    groups['Electricité'].forEach(item => {
        const desc = item.description.toLowerCase();
        const id = item.id.toUpperCase();
        
        // Un disjoncteur est considéré comme "EV" uniquement s'il fait partie de evIds 
        // ou si sa description mentionne explicitement la recharge.
        const isEv = evHardwareIds.includes(item.id) ||
                     evProtectionIds.includes(item.id) ||
                     desc.includes('borne recharge') || 
                     desc.includes('cordon ve');

        if (isEv) {
            evElec.push(item);
        } else {
            generalElec.push(item);
        }
    });

    const result: GroupedMaterials[] = [
        { category: 'Panneaux', items: groups['Panneaux'] },
        { category: 'Onduleurs', items: groups['Onduleurs'] },
        { 
            category: 'Electricité', 
            items: generalElec,
            subSections: evElec.length > 0 ? [{ title: 'BORNE VE', items: evElec }] : undefined
        },
        { category: 'Structure', items: groups['Structure'] },
        { category: 'Accessoires', items: groups['Accessoires'] }
    ];

    return result.filter(g => g.items.length > 0 || (g.subSections && g.subSections.length > 0));
}
