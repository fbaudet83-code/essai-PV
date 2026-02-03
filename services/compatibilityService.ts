
import { Panel, Component, InverterElectricalSpecs, CompatibilityReport, ConfiguredString, Project, DcCablingRun } from '../types';

const DEFAULT_TEMP_COEFF_VOC = -0.26; 

export function checkElectricalCompatibility(
  mainPanel: Panel, 
  inverter: Component | null | undefined,
  climate?: { tempMin: number; tempMaxAmb: number },
  panelsPerStringLegacy: number = 1,
  totalPanelsLegacy?: number,
  stringsCountLegacy: number = 1,
  maxPanelsInAStringLegacy: number = 0,
  configuredStrings: ConfiguredString[] = [],
  fields: Project['fields'] = [],
  /**
   * Force le mode réseau (Mono/Tri) venant de l'UI.
   * Sans ça, une heuristique basée sur la puissance de l'onduleur pouvait
   * basculer en TRI (ex: 6.6 kVA) même si l'utilisateur est en MONO.
   */
  phase: 'Mono' | 'Tri' | undefined = undefined,
  /**
   * Option avancée : nombre de strings identiques en parallèle par MPPT.
   * Stocké côté UI dans inverterConfig.dcCablingRuns[].parallelStrings (par défaut 1).
   */
  dcCablingRuns: DcCablingRun[] = []
): CompatibilityReport {
  const report: CompatibilityReport = {
    isCompatible: true,
    warnings: [],
    errors: [],
    details: null
  };

  // Avertissement si Voc(Tmin) est proche de la limite max entrée (ex: 95% de Vmax).
  const VOC_WARN_RATIO = 0.95;
  // Avertissement si Vmp(chaud) est proche de la limite basse MPPT (ex: <= 105% de Vmin).
  // Objectif : éviter les configurations "à la limite" pouvant décrocher en été.
  const VMP_WARN_RATIO = 1.05;

  const tempMin = climate ? climate.tempMin : -10; 
  const tempAmbHot = climate ? climate.tempMaxAmb : 35; 
  const tempCellHot = tempAmbHot + 35; 

  if (!inverter || !inverter.electrical) {
    return report;
  }

  const iSpecs = inverter.electrical as InverterElectricalSpecs;
  const isMicro = iSpecs.maxInputVoltage < 100;
  
  // DDR Type Logic
  let rcdType: 'A' | 'F' | 'B' = 'F'; // Default for PV
  if (isMicro) rcdType = 'F';
  else if (inverter.id.includes('H1') || inverter.id.includes('H3') || inverter.id.includes('KH') || inverter.id.includes('P3')) {
      rcdType = 'B'; // Hybride/Batterie
  }

  // --- LOGIQUE MICRO-ONDULEUR ---
  if (isMicro) {
      if (!mainPanel || !mainPanel.electrical) return report;
      const pSpecs = mainPanel.electrical;
      const coeffVoc = pSpecs.tempCoeffVoc || DEFAULT_TEMP_COEFF_VOC;
      const deltaTCold = tempMin - 25;
      const vocColdPanel = pSpecs.voc * (1 + (coeffVoc / 100) * deltaTCold);
      
      const inputsPerMicro = iSpecs.mpptCount || 1;
      let totalSystemAcPower = iSpecs.maxAcPower;
      let totalSystemDcPower = mainPanel.power * inputsPerMicro;

      if (totalPanelsLegacy && totalPanelsLegacy > 0) {
          const numMicros = Math.ceil(totalPanelsLegacy / inputsPerMicro);
          totalSystemAcPower = numMicros * iSpecs.maxAcPower;
          totalSystemDcPower = mainPanel.power * totalPanelsLegacy;
      }

      const dcAcRatio = totalSystemAcPower > 0 ? totalSystemDcPower / totalSystemAcPower : 0;
      const isTri = phase ? phase === 'Tri' : false;
      const nominalAcCurrent = isTri ? totalSystemAcPower / (400 * 1.732) : totalSystemAcPower / 230;
      const recommendedBreaker = nominalAcCurrent * 1.25;

      if (vocColdPanel > iSpecs.maxInputVoltage) {
          report.isCompatible = false;
          report.errors.push(`Tension panneau (${vocColdPanel.toFixed(1)}V) > Max Micro (${iSpecs.maxInputVoltage}V)`);
      }
      
      report.details = {
          vocCold: parseFloat(vocColdPanel.toFixed(1)),
          vmaxInverter: iSpecs.maxInputVoltage,
          vmpHot: 0, 
          vminMppt: iSpecs.minMpptVoltage,
          iscPanel: pSpecs.isc,
          iscCalculation: parseFloat((pSpecs.isc * 1.25).toFixed(2)),
          imaxInverter: iSpecs.maxInputCurrent,
          dcAcRatio: dcAcRatio,
          maxAcPower: totalSystemAcPower,
          nominalAcCurrent: parseFloat(nominalAcCurrent.toFixed(1)),
          acCurrentBasis: 'FALLBACK_S_OVER_U',
          acCurrentBasisDetail: `S=${totalSystemAcPower}VA, U=${isTri ? '400V tri' : '230V mono'}`,
          recommendedBreakerTheo: parseFloat((recommendedBreaker).toFixed(1)),
          recommendedBreaker: Math.ceil(recommendedBreaker),
          rcdType: rcdType,
          tempsUsed: { min: tempMin, maxCell: tempCellHot },
          stringsAnalysis: [],
          maxPanelsInAString: 1
      };
      return report;
  }

  // --- LOGIQUE ONDULEUR CENTRAL ---
  const mpptGroups: Record<number, ConfiguredString[]> = {};
  if (!configuredStrings || configuredStrings.length === 0) {
      const stringsCount = stringsCountLegacy || 1;
      for(let i=0; i<stringsCount; i++) {
          mpptGroups[i+1] = [{ id: `legacy-${i}`, fieldId: 'legacy', panelCount: panelsPerStringLegacy, mpptIndex: i+1 }];
      }
  } else {
      configuredStrings.forEach(str => {
          const idx = str.mpptIndex || 1;
          if (!mpptGroups[idx]) mpptGroups[idx] = [];
          mpptGroups[idx].push(str);
      });
  }

  const mpptAnalyses = [];
  let globalMaxVoc = 0;
  let globalMinVmp = 10000;
  let totalPvPower = 0;
  let maxPanelsCount = 0;

  // Option avancée : strings en parallèle par MPPT (courant s'additionne, tension inchangée).
  const parallelByMppt: Record<number, number> = {};
  (dcCablingRuns || []).forEach(r => {
      const idx = Number(r.mpptIndex) || 0;
      if (!idx) return;
      const n = Math.max(1, Math.round(Number((r as any).parallelStrings ?? 1) || 1));
      parallelByMppt[idx] = n;
  });

  for (const [mpptIndexStr, segments] of Object.entries(mpptGroups)) {
      const mpptIndex = parseInt(mpptIndexStr);
      const parallelStrings = parallelByMppt[mpptIndex] || 1;
      let mpptVocCold = 0;
      let mpptVmpHot = 0;
      let mpptIscMax = 0;
      let mpptPanelCount = 0;
      const compositionNames: string[] = [];

      segments.forEach(seg => {
          const field = fields.find(f => f.id === seg.fieldId);
          const panel = field?.panels.model || mainPanel;
          if (panel.electrical) {
              const pSpecs = panel.electrical;
              const coeffVoc = pSpecs.tempCoeffVoc || DEFAULT_TEMP_COEFF_VOC;
              const deltaTCold = tempMin - 25;
              const vocColdPanel = pSpecs.voc * (1 + (coeffVoc / 100) * deltaTCold);
              mpptVocCold += vocColdPanel * seg.panelCount;
              const deltaTHot = tempCellHot - 25;
              const vmpHotPanel = pSpecs.vmp * (1 + (coeffVoc / 100) * deltaTHot);
              mpptVmpHot += vmpHotPanel * seg.panelCount;
              if (pSpecs.isc > mpptIscMax) mpptIscMax = pSpecs.isc;
              totalPvPower += panel.power * seg.panelCount;
          }
          mpptPanelCount += seg.panelCount;
          compositionNames.push(`${field?.name || 'Toiture'} (${seg.panelCount})`);
      });

      if (mpptPanelCount > maxPanelsCount) maxPanelsCount = mpptPanelCount;
      if (mpptVocCold > globalMaxVoc) globalMaxVoc = mpptVocCold;
      if (mpptVmpHot < globalMinVmp) globalMinVmp = mpptVmpHot;

      // Courant MPPT : en parallèle les courants s'additionnent (strings identiques).
      const mpptIscTotal = mpptIscMax * parallelStrings;

      mpptAnalyses.push({
          mpptIndex: mpptIndex,
          composition: compositionNames.join(' + '),
          totalPanelCount: mpptPanelCount,
          vocCold: parseFloat(mpptVocCold.toFixed(1)),
          vmpHot: parseFloat(mpptVmpHot.toFixed(1)),
          parallelStrings: parallelStrings,
          iscMax: mpptIscTotal,
          iscCalculation: parseFloat((mpptIscTotal * 1.25).toFixed(2)),
          isVoltageWarning: (mpptVocCold >= (iSpecs.maxInputVoltage * VOC_WARN_RATIO)) && (mpptVocCold <= iSpecs.maxInputVoltage),
          isVoltageError: mpptVocCold > iSpecs.maxInputVoltage,
          // Vmp(chaud) trop bas : hors plage MPPT -> non compatible
          isMpptError: mpptVmpHot < iSpecs.minMpptVoltage,
          // Proche de la limite basse MPPT (sans être hors plage)
          isMpptWarning: (mpptVmpHot >= iSpecs.minMpptVoltage) && (mpptVmpHot <= (iSpecs.minMpptVoltage * VMP_WARN_RATIO)),
          isCurrentError: mpptIscTotal > iSpecs.maxInputCurrent
      });

      if (mpptVocCold > iSpecs.maxInputVoltage) {
          report.isCompatible = false;
          report.errors.push(`MPPT ${mpptIndex}: Surtension (${mpptVocCold.toFixed(1)}V > ${iSpecs.maxInputVoltage}V)`);
      } else {
          const ratio = iSpecs.maxInputVoltage > 0 ? (mpptVocCold / iSpecs.maxInputVoltage) : 0;
          if (ratio >= VOC_WARN_RATIO) {
              report.warnings.push(`MPPT ${mpptIndex}: Voc froid proche limite (${mpptVocCold.toFixed(1)}V ≈ ${(ratio * 100).toFixed(0)}% de ${iSpecs.maxInputVoltage}V)`);
          }
      }

      // Vmp chaud : avertissement / erreur sur limite basse MPPT
      if (mpptVmpHot < iSpecs.minMpptVoltage) {
          report.isCompatible = false;
          report.errors.push(`MPPT ${mpptIndex}: Vmp chaud trop bas (${mpptVmpHot.toFixed(1)}V < ${iSpecs.minMpptVoltage}V) → risque de décrochage en été`);
      } else {
          const ratioLow = iSpecs.minMpptVoltage > 0 ? (mpptVmpHot / iSpecs.minMpptVoltage) : 0;
          if (ratioLow <= VMP_WARN_RATIO) {
              report.warnings.push(`MPPT ${mpptIndex}: Vmp chaud proche limite basse (${mpptVmpHot.toFixed(1)}V ≈ ${(ratioLow * 100).toFixed(0)}% de ${iSpecs.minMpptVoltage}V)`);
          }
      }

      // Courant MPPT (strings en //) : avertissement/erreur si dépassement courant max entrée.
      if (mpptIscTotal > iSpecs.maxInputCurrent) {
          report.isCompatible = false;
          report.errors.push(`MPPT ${mpptIndex}: Courant trop élevé (${mpptIscTotal.toFixed(2)}A > ${iSpecs.maxInputCurrent}A)${parallelStrings > 1 ? ` (x${parallelStrings} strings en //)` : ''}`);
      }
  }

  const maxAcPower = iSpecs.maxAcPower || inverter.power || 0;
  const dcAcRatio = maxAcPower > 0 ? totalPvPower / maxAcPower : 0;
  
  // IMPORTANT : le mode réseau doit venir de l'UI (Mono/Tri).
  // L'heuristique basée sur la puissance (ex: >6kVA) est trop trompeuse (6.6kVA mono existe).
  const isTri = phase ? phase === 'Tri' : (iSpecs.maxAcPower > 6000 || inverter.id.includes('TRI') || inverter.id.includes('T15'));

  // Courant AC de référence pour les protections (priorité : Iac_max fiche technique)
  let acCurrentBasis: 'IAC_MAX' | 'IAC_NOMINAL' | 'FALLBACK_S_OVER_U' = 'FALLBACK_S_OVER_U';
  let acCurrentBasisDetail = '';
  let acRefCurrentA = 0;

  if (typeof iSpecs.maxAcCurrent === 'number' && iSpecs.maxAcCurrent > 0) {
      acRefCurrentA = iSpecs.maxAcCurrent;
      acCurrentBasis = 'IAC_MAX';
      acCurrentBasisDetail = `Iac_max=${iSpecs.maxAcCurrent}A (fiche technique)`;
  } else if (typeof iSpecs.nominalAcCurrent === 'number' && iSpecs.nominalAcCurrent > 0) {
      acRefCurrentA = iSpecs.nominalAcCurrent;
      acCurrentBasis = 'IAC_NOMINAL';
      acCurrentBasisDetail = `Iac_nom=${iSpecs.nominalAcCurrent}A (fiche technique)`;
  } else {
      // Fallback : estimation à partir de la puissance AC max (S) et de la tension réseau
      acRefCurrentA = isTri ? maxAcPower / (400 * 1.732) : maxAcPower / 230;
      acCurrentBasis = 'FALLBACK_S_OVER_U';
      acCurrentBasisDetail = `S=${maxAcPower}VA, U=${isTri ? '400V tri' : '230V mono'}`;
  }

  const nominalAcCurrent = acRefCurrentA;

  report.details = {
      vocCold: parseFloat(globalMaxVoc.toFixed(1)),
      vmaxInverter: iSpecs.maxInputVoltage,
      vmpHot: parseFloat(globalMinVmp.toFixed(1)),
      vminMppt: iSpecs.minMpptVoltage,
      iscPanel: mainPanel.electrical?.isc || 0,
      iscCalculation: parseFloat(((mainPanel.electrical?.isc || 0) * 1.25).toFixed(2)),
      imaxInverter: iSpecs.maxInputCurrent,
      dcAcRatio: dcAcRatio,
      maxAcPower: maxAcPower,
      nominalAcCurrent: parseFloat(nominalAcCurrent.toFixed(1)),
      acCurrentBasis: acCurrentBasis,
      acCurrentBasisDetail: acCurrentBasisDetail,
      recommendedBreakerTheo: parseFloat((nominalAcCurrent * 1.25).toFixed(1)),
      recommendedBreaker: Math.ceil(nominalAcCurrent * 1.25),
      rcdType: rcdType,
      tempsUsed: { min: tempMin, maxCell: tempCellHot },
      stringsAnalysis: mpptAnalyses,
      maxPanelsInAString: maxPanelsCount
  };

  return report;
}
