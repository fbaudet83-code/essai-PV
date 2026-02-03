
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Project, RoofType, WindZone, InverterBrand, Material, 
  Component as SolarComponent, InverterElectricalSpecs, Panel, ConfiguredString
} from './types';
import { 
  calculateBillOfMaterials, 
  calculateAcCableSection, 
  calculateDcCableSection, 
  calculateVoltageDropPercent,
  calculateCentralInverter,
  getPanelCount
} from './services/calculatorService';
import { getLocationClimate } from './services/climateService';
import { getWindZone } from './services/windZoneService';
import { getRecommendedMargins, getProtectionStatusForSection } from './services/standardsService';
import { pickAutoDcSectionOptionB, normalizeBreakerA, agcpToCommercialBreakerA, pickAutoAcSectionMm2, computeAcDropPercent } from './services/electricalSizing';
import { checkElectricalCompatibility } from './services/compatibilityService';
import { computeMicroBranchesReport, ensureDefaultMicroBranches } from './services/microBranchService';
import { getSubscriptionStatus } from './services/subscriptionService';
import { subscribeToData, loginAdmin, logoutAdmin } from './services/firebase';

// Defaults
import { K2_COMPONENTS_DEFAULT, ESDEC_COMPONENTS_DEFAULT } from './data/k2components';
import { ENPHASE_COMPONENTS, APSYSTEMS_COMPONENTS, FOXESS_COMPONENTS, DIGITAL_ELECTRIC_COMPONENTS, GENERIC_INVERTER } from './data/inverters';
import { DMEGC_PANELS, GENERIC_PANEL } from './data/panels';
import { DEFAULT_CABLES } from './data/cables';

// UI
import RoofVisualizer from './components/RoofVisualizer';
import BillOfMaterials from './components/BillOfMaterials';
import AdminPage from './components/AdminPage';
import Tooltip from './components/Tooltip';
import WindGuideModal from './components/WindGuideModal';
import CustomPanelModal from './components/CustomPanelModal';
import CustomInverterModal from './components/CustomInverterModal';
import { SettingsIcon, NewIcon, DeleteIcon, PencilIcon, XIcon } from './components/icons'; 
import CalculationAudit from './components/CalculationAudit';
import MicroBranchesConfig from './components/MicroBranchesConfig';

// --- VERSION CONTROL ---
const VERSION_STORAGE_KEY = "richardson_build_id";
const VERSION_URL = "/version.json";
async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data: any = await res.json();
    return typeof data?.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

// --- INITIAL STATE ---
const INITIAL_PANEL_DB: Record<string, SolarComponent> = {};
DMEGC_PANELS.forEach(p => {
    INITIAL_PANEL_DB[p.name] = {
        id: p.name, description: p.name, unit: 'piece', price: p.price || '',
        width: p.width, height: p.height, power: p.power, electrical: p.electrical,
        imageUrl: p.imageUrl, datasheetUrl: p.datasheetUrl, manualUrl: p.manualUrl, videoUrl: p.videoUrl
    };
});
INITIAL_PANEL_DB[GENERIC_PANEL.name] = { id: GENERIC_PANEL.name, description: GENERIC_PANEL.name, unit: 'piece', price: '', width: GENERIC_PANEL.width, height: GENERIC_PANEL.height, power: GENERIC_PANEL.power, electrical: GENERIC_PANEL.electrical };

const ALL_INVERTERS_DEFAULT = { ...ENPHASE_COMPONENTS, ...APSYSTEMS_COMPONENTS, ...FOXESS_COMPONENTS };
ALL_INVERTERS_DEFAULT[GENERIC_INVERTER.id] = GENERIC_INVERTER;

const DEFAULT_PROJECT: Project = {
  id: 'proj-001', name: '', clientAddress: '', city: '', postalCode: '', altitude: 0, windZone: WindZone.ZONE_1,
  distanceToPanel: 10,
  // (centralisé) Onduleur → coffret AC
  distanceInverterToAcCoffret: 2,
  acCableSectionMm2: null,
  ac1CableSectionMm2: null,
  system: { brand: 'K2', railOrientation: 'Horizontal' },
  inverterConfig: { 
      brand: InverterBrand.NONE, 
      model: 'Auto', 
      phase: 'Mono', 
      hasBattery: false, 
      hasBackup: false,
      configuredStrings: [],
      dcCablingRuns: [],
      agcpValue: undefined
  },
  evCharger: { selected: false, phase: 'Mono', cableRef: undefined }, 
  fields: [{ id: 'f1', name: 'Toiture 1', roof: { width: 10, height: 5, pitch: 30, pitchUnit: 'deg', type: RoofType.TUILE_MECANIQUE, margins: { top: 300, bottom: 300, left: 300, right: 300 } }, panels: { model: DMEGC_PANELS[2], orientation: 'Portrait', rows: 2, columns: 5 }, railOrientation: 'Horizontal' }],
  userPrices: {}
};


// --- Regroupement câbles (évite doublons AC1/AC2/branches, etc.) ---
function mergeCableCoilsInBOM(items: Material[], cableDb: Record<string, any> | null): Material[] {
  const byId = new Map<string, Material & { _reasons?: Set<string> }>();

  const isCable = (it: Material) => {
    const db = cableDb && (cableDb as any)[it.id];
    if (db && typeof db.description === "string") return db.description.toUpperCase().includes("CABLE");
    // Heuristique : IDs numériques (Miguelez) ou IDs manuels CABLE-...
    return /^\d{8,}$/.test(it.id) || it.id.startsWith("CABLE-");
  };

  for (const it of items) {
    if (!isCable(it)) {
      // non-câble : pas de merge
      const key = `__${Math.random()}`; // force unique
      byId.set(key, { ...it });
      continue;
    }

    const existing = byId.get(it.id);
    if (!existing) {
      byId.set(it.id, { ...it, _reasons: new Set([it.description || ""]) } as any);
      continue;
    }

    // Quantité : on évite de sommer des couronnes (sinon on double-compte).
    // On garde le max (cas rare >1 couronne déjà calculée), et on fusionne les raisons.
    (existing as any).quantity = Math.max(existing.quantity || 1, it.quantity || 1);
    (existing as any)._reasons?.add(it.description || "");
    existing.description = Array.from((existing as any)._reasons || [])
      .filter(Boolean)
      .join(" / ");
  }

  // on retire les clés artificielles __*
  const merged: Material[] = [];
  for (const [k, v] of byId.entries()) {
    if (k.startsWith("__")) merged.push(v);
    else {
      const vv: any = { ...v };
      delete vv._reasons;
      merged.push(vv);
    }
  }
  return merged;
}

function App() {
  const [k2DB, setK2DB] = useState<Record<string, SolarComponent>>(K2_COMPONENTS_DEFAULT);
  const [esdecDB, setEsdecDB] = useState<Record<string, SolarComponent>>(ESDEC_COMPONENTS_DEFAULT);
  const [inverterDB, setInverterDB] = useState<Record<string, SolarComponent>>(ALL_INVERTERS_DEFAULT);
  const [panelDB, setPanelDB] = useState<Record<string, SolarComponent>>(INITIAL_PANEL_DB);
  const [boxDB, setBoxDB] = useState<Record<string, SolarComponent>>(DIGITAL_ELECTRIC_COMPONENTS);
  const [cableDB, setCableDB] = useState<Record<string, SolarComponent>>(DEFAULT_CABLES);

  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);

// --- Address AUTO (SAFE MODE) ---
const ENABLE_ADDRESS_AUTO = true; // feature-flag: set false to revert to manual-only behavior
type AddressAutoStatus = 'idle' | 'loading' | 'success' | 'manual' | 'partial' | 'error';
const [addressAutoEnabled, setAddressAutoEnabled] = useState<boolean>(true);
const [addressAutoStatus, setAddressAutoStatus] = useState<AddressAutoStatus>('idle');
const [addressAutoMessage, setAddressAutoMessage] = useState<string>('');
const [addressAutoLastLabel, setAddressAutoLastLabel] = useState<string>('');
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [view, setView] = useState<'calculator' | 'admin'>('calculator');
  const [showWindGuide, setShowWindGuide] = useState(false);
  const [showMargins, setShowMargins] = useState(false);
  const [showCustomPanelModal, setShowCustomPanelModal] = useState(false);
  const [showCustomInverterModal, setShowCustomInverterModal] = useState(false);
  const [isProjectStep, setIsProjectStep] = useState(true);

  // --- CACHE / UPDATE LOGIC ---
  useEffect(() => {
    let cancelled = false;

    async function clearBrowserCaches() {
      try {
        if ("caches" in window) {
          const keys = await (caches as any).keys();
          await Promise.all(keys.map((k: string) => (caches as any).delete(k)));
        }
      } catch {
        // ignore
      }
    }

    async function checkAndRefresh() {
      const buildId = await fetchBuildId();
      if (cancelled || !buildId) return;

      const savedBuildId = localStorage.getItem(VERSION_STORAGE_KEY);

      // First run: persist build id
      if (!savedBuildId) {
        localStorage.setItem(VERSION_STORAGE_KEY, buildId);
        return;
      }

      // New deploy detected: clear caches then hard reload
      if (savedBuildId !== buildId) {
        console.log(`Nouvelle version détectée (). Rafraîchissement...`);
        localStorage.setItem(VERSION_STORAGE_KEY, buildId);
        await clearBrowserCaches();
        window.location.reload();
      }
    }

    // 1) Check immediately at startup
    checkAndRefresh();

    // 2) Check periodically (helps when the tab stays open during a deploy)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") checkAndRefresh();
    }, 5 * 60 * 1000); // every 5 min

    // 3) Also check when the user comes back to the tab
    const onVis = () => {
      if (document.visibilityState === "visible") checkAndRefresh();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
      const isAdmin = sessionStorage.getItem('isAdmin');
      if (isAdmin === 'true') {
          setUser({ uid: 'local-admin', email: 'admin@richardson.fr' });
      }
      const unsubs = [
          subscribeToData('k2', setK2DB),
          subscribeToData('esdec', setEsdecDB),
          subscribeToData('inverters', setInverterDB),
          subscribeToData('panels', setPanelDB),
          subscribeToData('boxes', setBoxDB),
          subscribeToData('cables', setCableDB)
      ];
      return () => unsubs.forEach(unsub => unsub());
  }, []);

  const isProjectReady = project.name.trim() !== '' && project.postalCode.trim().length >= 2;

  const fieldsSignature = useMemo(() => {
      return project.fields.map(f => `${f.id}:${getPanelCount(f.panels)}`).join('|');
  }, [project.fields]);

  useEffect(() => {
      const activeInverterComp = (Object.values(inverterDB) as SolarComponent[]).find((c: SolarComponent) => c.id === project.inverterConfig.model) || (project.inverterConfig.brand === InverterBrand.CUSTOM ? inverterDB[project.inverterConfig.model || 'OND-PERSO'] : null);
      const isMicro = activeInverterComp?.electrical?.isMicro;
      const isFoxCentral = project.inverterConfig.brand === InverterBrand.FOXESS && !isMicro;
      const isCustomCentral = project.inverterConfig.brand === InverterBrand.CUSTOM && !isMicro;

      if ((isFoxCentral || isCustomCentral) && project.inverterConfig.model && project.inverterConfig.model !== 'Auto') {
          let currentStrings = [...(project.inverterConfig.configuredStrings || [])];
          let hasChanged = false;

          if (currentStrings.length === 0) {
              const maxMppts = activeInverterComp?.electrical?.mpptCount || 2;
              project.fields.forEach((field, idx) => {
                  const targetMppt = (idx % maxMppts) + 1;
                  currentStrings.push({
                      id: `str-${Date.now()}-${idx}`,
                      fieldId: field.id,
                      panelCount: getPanelCount(field.panels),
                      mpptIndex: targetMppt
                  });
              });
              hasChanged = true;
          }

          const validFieldIds = project.fields.map(f => f.id);
          const filteredStrings = currentStrings.filter(s => validFieldIds.includes(s.fieldId));
          if (filteredStrings.length !== currentStrings.length) {
              currentStrings = filteredStrings;
              hasChanged = true;
          }

          project.fields.forEach(field => {
              const totalAvailable = getPanelCount(field.panels);
              const stringsForField = currentStrings.filter(s => s.fieldId === field.id);
              const totalAssigned = stringsForField.reduce((sum, s) => sum + s.panelCount, 0);

              if (totalAssigned > totalAvailable) {
                  let diff = totalAssigned - totalAvailable;
                  for (let i = stringsForField.length - 1; i >= 0; i--) {
                      if (diff <= 0) break;
                      const str = stringsForField[i];
                      const idx = currentStrings.findIndex(s => s.id === str.id);
                      if (idx > -1) {
                          const toRemove = Math.min(currentStrings[idx].panelCount, diff);
                          currentStrings[idx].panelCount -= toRemove;
                          diff -= toRemove;
                          hasChanged = true;
                      }
                  }
              } else if (stringsForField.length === 1 && totalAssigned < totalAvailable) {
                  const idx = currentStrings.findIndex(s => s.id === stringsForField[0].id);
                  if (idx > -1) {
                      currentStrings[idx].panelCount = totalAvailable;
                      hasChanged = true;
                  }
              }
          });

          const finalStrings = currentStrings.filter(s => s.panelCount > 0);
          if (finalStrings.length !== currentStrings.length) hasChanged = true;

          if (hasChanged) {
              setProject(prev => ({
                  ...prev,
                  inverterConfig: { ...prev.inverterConfig, configuredStrings: finalStrings }
              }));
          }
      }
  }, [fieldsSignature, project.inverterConfig.model, project.inverterConfig.brand, inverterDB]); 

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const loggedUser = await loginAdmin(loginEmail, loginPass);
          setUser(loggedUser);
          setShowLogin(false);
          setLoginError('');
      } catch (err: any) {
          setLoginError(err.message);
      }
  };

  const handleLogout = async () => {
      await logoutAdmin();
      setUser(null);
      setView('calculator');
  };

  const projectClimate = useMemo(() => getLocationClimate(project.postalCode, project.altitude), [project.postalCode, project.altitude]);


// --- SAFE network helpers (never block app) ---
async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } as any });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Progressive enhancement: try to prefill city / postal code / altitude from address.
useEffect(() => {
  if (!ENABLE_ADDRESS_AUTO) return;
  if (!addressAutoEnabled) return;

  const q = (project.clientAddress || '').trim();
  // Don't spam API on short inputs
  if (q.length < 6) {
    setAddressAutoStatus('idle');
    setAddressAutoMessage('');
    return;
  }

  setAddressAutoStatus('loading');
  setAddressAutoMessage('Recherche…');

  const handle = window.setTimeout(async () => {
    try {
      // 1) BAN (address -> CP + city + lat/lon)
      const banUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`;
      const ban = await fetchJsonWithTimeout(banUrl, 2000);
      const feat = ban?.features?.[0];
      const props = feat?.properties || {};
      const coords = feat?.geometry?.coordinates; // [lon, lat]
      const postcode = (props.postcode || '').toString();
      const city = (props.city || props.citycode || '').toString();
      const label = (props.label || '').toString();

      if (!postcode || postcode.length < 4) {
        // BAN returned nothing usable -> manual fallback
        setAddressAutoStatus('manual');
        setAddressAutoMessage('Auto indisponible → saisie manuelle');
        setAddressAutoEnabled(false);
        return;
      }

      // Prefill CP + city (never lock inputs)
      setProject((p) => ({
        ...p,
        postalCode: postcode || p.postalCode,
        city: city || p.city,
      }));
      if (label) setAddressAutoLastLabel(label);

      // 2) Altitude (optional)
      const lon = Array.isArray(coords) ? coords[0] : null;
      const lat = Array.isArray(coords) ? coords[1] : null;

      if (typeof lat === 'number' && typeof lon === 'number') {
        try {
          const altUrl = `https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lon}`;
          const alt = await fetchJsonWithTimeout(altUrl, 2000);
          const elev = alt?.results?.[0]?.elevation;
          if (typeof elev === 'number' && isFinite(elev)) {
            setProject((p) => ({ ...p, altitude: Math.max(0, Math.round(elev)) }));
            setAddressAutoStatus('success');
            setAddressAutoMessage('Adresse trouvée ✅');
            return;
          }
          // altitude missing
          setAddressAutoStatus('partial');
          setAddressAutoMessage('Adresse trouvée ✅ (Altitude non récupérée → à saisir)');
          return;
        } catch {
          setAddressAutoStatus('partial');
          setAddressAutoMessage('Adresse trouvée ✅ (Altitude non récupérée → à saisir)');
          return;
        }
      }

      // No coords -> partial
      setAddressAutoStatus('partial');
      setAddressAutoMessage('Adresse trouvée ✅ (Altitude non récupérée → à saisir)');
    } catch (e) {
      setAddressAutoStatus('manual');
      setAddressAutoMessage('Auto indisponible → saisie manuelle');
      setAddressAutoEnabled(false);
    }
  }, 500);

  return () => window.clearTimeout(handle);
}, [project.clientAddress, addressAutoEnabled, ENABLE_ADDRESS_AUTO]);
  
  useEffect(() => { 
    if (project.postalCode.length >= 2) {
      const newZone = getWindZone(project.postalCode);
      setProject(prev => ({ ...prev, windZone: newZone }));
    }
  }, [project.postalCode]);

  useEffect(() => {
      const recommended = getRecommendedMargins(project.fields[activeFieldIndex].roof.type, project.windZone);
      setProject(prev => {
          const newFields = [...prev.fields];
          if (newFields[activeFieldIndex].roof.margins.top === 300) {
              newFields[activeFieldIndex].roof.margins = recommended;
          }
          return { ...prev, fields: newFields };
      });
  }, [project.windZone, project.fields[activeFieldIndex].roof.type]);

  const isMicroSystem = useMemo(() => {
      const customInv = inverterDB[project.inverterConfig.model];
      const isCustomMicro = project.inverterConfig.brand === InverterBrand.CUSTOM && (customInv?.electrical as InverterElectricalSpecs)?.isMicro;
      
      return project.inverterConfig.brand === InverterBrand.ENPHASE ||
             project.inverterConfig.brand === InverterBrand.APSYSTEMS ||
             isCustomMicro ||
             (project.inverterConfig.brand === InverterBrand.FOXESS && 
               (project.inverterConfig.model?.includes('MICRO') || project.inverterConfig.model === 'FOX-S3000-G2')
             );
  }, [project.inverterConfig.brand, project.inverterConfig.model, inverterDB]);

  useEffect(() => {
      if (isMicroSystem && (project.inverterConfig.hasBattery || project.inverterConfig.hasBackup)) {
          setProject(prev => ({
              ...prev,
              inverterConfig: { 
                  ...prev.inverterConfig, 
                  hasBattery: false, 
                  hasBackup: false, 
                  batteryModel: undefined 
              }
          }));
      }
  }, [isMicroSystem]);

  useEffect(() => {
    const activeComponents = project.system.brand === 'ESDEC' ? esdecDB : k2DB;
    let globalBOM: Material[] = [];
    
    const totalPowerW = project.fields.reduce((sum, f) => sum + (f.panels.model.power * getPanelCount(f.panels)), 0);

    project.fields.forEach(field => {
        if (getPanelCount(field.panels) > 0) {
            const fieldBOM = calculateBillOfMaterials(field, activeComponents as any, project.system, inverterDB as any, cableDB as any, project.inverterConfig);
            fieldBOM.forEach(item => {
                const existing = globalBOM.find(i => i.id === item.id);
                if (existing) existing.quantity += item.quantity;
                else globalBOM.push({ ...item });
            });
        }
    });

    if (totalPowerW > 0) {
        const centralInverter = calculateCentralInverter(totalPowerW, project.inverterConfig, inverterDB as any);
        if (centralInverter) {
            globalBOM.push(centralInverter);
        }

        const isThreePhase = project.inverterConfig.phase === 'Tri';

        // --- Sections AC effectives pour le BOM (alignées sur l'UI Auto/Forcé) ---
        const AC_SECTIONS = [2.5, 6, 10, 16, 25];

        // AC2 (coffret AC → tableau)
        const ac2CurrentMaxA = isThreePhase ? totalPowerW / (400 * 1.732) : totalPowerW / 230;
        const ac2BreakerMinA = Math.ceil(ac2CurrentMaxA * 1.25);
        const ac2AgcpCommercialA = agcpToCommercialBreakerA(project.inverterConfig.agcpValue || 0, isThreePhase);
        const ac2BreakerNormalizedA = ac2AgcpCommercialA ?? normalizeBreakerA(ac2BreakerMinA, isThreePhase);
        const pickAutoAc2SectionMm2 = () => {
            // Auto vise ΔU ≤ 1% (recommandé), tout en respectant la protection (table pessimiste).
            // Patch métier : en monophasé, si protection normalisée 32A/40A, on évite 6mm² (on démarre à 10mm²).
            const minAutoSection = (!isThreePhase && (ac2BreakerNormalizedA === 32 || ac2BreakerNormalizedA === 40)) ? 10 : AC_SECTIONS[0];
            return pickAutoAcSectionMm2({
                powerVA: inverterAcPowerVA as number,
                lengthM: project.distanceToPanel,
                isThreePhase,
                breakerA: ac2BreakerNormalizedA,
                minAutoSectionMm2: minAutoSection,
            });
        };
        const autoAc2SectionMm2 = pickAutoAc2SectionMm2();
        const effectiveAc2SectionMm2 = project.acCableSectionMm2 ?? autoAc2SectionMm2;

        // AC1 (centralisé) : Onduleur → Coffret AC
        const invSpecs = (centralInverter as any)?.electrical as InverterElectricalSpecs | undefined;
        const isCentral = !!centralInverter && !invSpecs?.isMicro && (project.inverterConfig.brand !== InverterBrand.ENPHASE && project.inverterConfig.brand !== InverterBrand.APSYSTEMS);
        if (isCentral) {
            // AC1 doit se baser sur la puissance AC nominale onduleur (et pas la puissance PV). 
            // On réutilise la même variable que l’UI pour éviter les divergences.
            const inverterAcVA = inverterAcPowerVA as number;
                        // IMPORTANT: on passe la section effective (Auto ou Forcé) pour éviter un effet "figé" en revenant sur Auto
            const ac1LengthM = project.distanceInverterToAcCoffret || 0;
            const ac1CurrentMaxA = isThreePhase ? inverterAcVA / (400 * 1.732) : inverterAcVA / 230;
            const ac1BreakerMinA = Math.ceil(ac1CurrentMaxA * 1.25);
            const ac1BreakerNormalizedA = normalizeBreakerA(ac1BreakerMinA, isThreePhase);
            const pickAutoAc1SectionMm2 = () => {
                // Auto vise ΔU ≤ 1% (recommandé), tout en respectant la protection (table pessimiste).
                // Patch métier : en monophasé, si disjoncteur coffret AC1 = 40A, on évite 6mm² (min 10mm²).
                const minAutoSection = (!isThreePhase && ac1BreakerNormalizedA === 40) ? 10 : AC_SECTIONS[0];
                return pickAutoAcSectionMm2({
                    powerVA: inverterAcVA,
                    lengthM: ac1LengthM,
                    isThreePhase,
                    breakerA: ac1BreakerNormalizedA,
                    minAutoSectionMm2: minAutoSection,
                });
            };
            const autoAc1SectionMm2 = pickAutoAc1SectionMm2();
            const effectiveAc1SectionMm2 = project.ac1CableSectionMm2 ?? autoAc1SectionMm2;
            const ac1Cable = calculateAcCableSection(inverterAcVA, ac1LengthM, cableDB as any, isThreePhase, effectiveAc1SectionMm2);
            if (ac1Cable) {
                // Libellé plus explicite
                ac1Cable.description = `${ac1Cable.description} (AC1: onduleur → coffret AC)`;
                globalBOM.push(ac1Cable);
            }
        }

        // AC2 : Coffret AC → Tableau
								const acCable = calculateAcCableSection(inverterAcPowerVA as number, project.distanceToPanel, cableDB as any, isThreePhase, effectiveAc2SectionMm2);
        if (acCable) {
            acCable.description = `${acCable.description} (AC2: coffret AC → tableau)`;
            globalBOM.push(acCable);
        }

        // --- Câbles AC des branches micro-onduleurs (micro -> coffret AC) ---
        // Les longueurs sont saisies par branche (ex: 6m + 9m en 6mm²) et doivent apparaître dans les accessoires.
        // On agrège par section et on sélectionne automatiquement la couronne C50 / C100 (si disponible).
        const addOrIncBOM = (id: string, description: string, quantity: number, price?: string, datasheetUrl?: string) => {
            if (!id || quantity <= 0) return;
            const existing = globalBOM.find(i => i.id === id);
            if (existing) existing.quantity += quantity;
            else globalBOM.push({ id, description, quantity, price: price || '', datasheetUrl });
        };

        const microBranches = project.inverterConfig.microBranches || [];
        const microLengthsBySection: Record<number, number> = {};
        microBranches.forEach((b: any) => {
            const microCount = Number(b?.microCount || 0);
            const L = Number(b?.cableLengthM || 0);
            const S = Number(b?.cableSectionMm2 || 0);
            if (!Number.isFinite(L) || L <= 0) return;
            if (!Number.isFinite(S) || S <= 0) return;
            // On ne chiffre la branche que si elle est réellement utilisée
            if (Number.isFinite(microCount) && microCount <= 0) return;
            microLengthsBySection[S] = (microLengthsBySection[S] || 0) + L;
        });

        const MICRO_AC_CABLE_MAP: Record<number, { c50?: string; c100?: string; other?: string }> = {
            1.5: { c50: '81010311509205', c100: '81010311509200' },
            2.5: { c50: '81010312509205', c100: '81010312509200' },
            6: { c50: '810103100609205' },
            10: { c50: '810103101009205', c100: '810103101009200' },
            16: { other: '810103101609207' },
        };

        const selectCoil = (sectionMm2: number, lengthM: number): { id: string; qty: number; fallbackDesc: string } | null => {
            const meters = Math.ceil(lengthM);
            const map = MICRO_AC_CABLE_MAP[sectionMm2];
            if (!map) {
                return { id: `CABLE-AC-BRANCH-${sectionMm2}MM-MANUEL`, qty: 1, fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (à chiffrer)` };
            }
            if (map.other) {
                return { id: map.other, qty: 1, fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (à chiffrer)` };
            }
            if (meters <= 50 && map.c50) {
                return { id: map.c50, qty: 1, fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (C50)` };
            }
            if (map.c100) {
                return { id: map.c100, qty: Math.max(1, Math.ceil(meters / 100)), fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (C100)` };
            }
            if (map.c50) {
                return { id: map.c50, qty: Math.max(1, Math.ceil(meters / 50)), fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (C50)` };
            }
            return { id: `CABLE-AC-BRANCH-${sectionMm2}MM-MANUEL`, qty: 1, fallbackDesc: `Câble AC branches micro : R2V 3G${sectionMm2} – longueur estimée ${meters} m (à chiffrer)` };
        };

        Object.entries(microLengthsBySection).forEach(([sStr, Ltot]) => {
            const S = Number(sStr);
            const L = Number(Ltot);
            if (!Number.isFinite(S) || !Number.isFinite(L) || L <= 0) return;
            const sel = selectCoil(S, L);
            if (!sel) return;
            const comp = (cableDB as any)[sel.id];
            if (comp) {
                addOrIncBOM(comp.id, `${comp.description} (branches micro – total ≈ ${Math.ceil(L)} m)`, sel.qty, comp.price, comp.datasheetUrl);
            } else {
                // Référence absente en base : on laisse une ligne à chiffrer pour ne rien oublier
                addOrIncBOM(sel.id, sel.fallbackDesc, sel.qty, '');
            }
        });

        const groundCrown = cableDB['820001000608600'] || { id: '820001000608600', description: 'CABLE TERRE H07V-K 1X6 VJ C100', price: 'A0AV34' };
        globalBOM.push({ id: groundCrown.id, description: groundCrown.description, quantity: 1, price: groundCrown.price, datasheetUrl: groundCrown.datasheetUrl });
        
        if (project.inverterConfig.hasBattery) {
            globalBOM.push({ id: 'STICKER-BAT', description: 'STICKER BATTERIES PV', quantity: 1, price: 'A3D7G5' });
        } else {
            globalBOM.push({ id: 'STICKER-AUTO', description: 'STICKER AUTOCONSO PV', quantity: 1, price: 'A3D7D2' });
        }

        if (project.inverterConfig.brand === InverterBrand.FOXESS) {
            const liycyComp = cableDB['CAB14124171'] || { id: 'CAB14124171', description: 'CABLE LIYCY 2X0.75 C100', unit: 'piece', price: 'A01NF9' };
            globalBOM.push({ id: liycyComp.id, description: liycyComp.description, quantity: 1, price: liycyComp.price, datasheetUrl: liycyComp.datasheetUrl });
        }

        if (project.inverterConfig.brand === InverterBrand.APSYSTEMS) {
            const ecuComp = inverterDB['350029'] || { id: '350029', description: 'PASSERELLE COM AVANCEE ECU-C APS', unit: 'piece', price: 'A046Q2' };
            const toreComp = inverterDB['350040'] || { id: '350040', description: 'TORE MESURE COURANT 80A ECU C APS', unit: 'piece', price: 'A046R0' };
            globalBOM.push({ id: ecuComp.id, description: ecuComp.description, quantity: 1, price: ecuComp.price, datasheetUrl: ecuComp.datasheetUrl });
            globalBOM.push({ id: toreComp.id, description: toreComp.description, quantity: isThreePhase ? 6 : 2, price: toreComp.price, datasheetUrl: toreComp.datasheetUrl });
        }

        if (project.inverterConfig.brand === InverterBrand.ENPHASE) {
            const envoyComp = inverterDB['ENVOY-S-EM-230'] || { id: 'ENVOY-S-EM-230', description: 'PASSERELLE ENVOY/S ENPHASE (2CT inclus)', unit: 'piece', price: 'A04BS2' };
            globalBOM.push({ id: envoyComp.id, description: envoyComp.description, quantity: 1, price: envoyComp.price, datasheetUrl: envoyComp.datasheetUrl });
            if (isThreePhase) {
                const ctComp = inverterDB['CT-100-SPLIT'] || { id: 'CT-100-SPLIT', description: 'TRANSFORMATEUR COURANT ENPHASE', unit: 'piece', price: 'A04BT0' };
                globalBOM.push({ id: ctComp.id, description: ctComp.description, quantity: 4, price: ctComp.price, datasheetUrl: ctComp.datasheetUrl });
            }
        }

        if (project.inverterConfig.brand === InverterBrand.FOXESS && project.inverterConfig.model?.includes('MICRO')) {
            const gatewayComp = inverterDB['SMG666.005'] || { id: 'SMG666.005', description: 'PASSERELLE P/MICRO-ONDULEUR', unit: 'piece', price: 'A2R4H1' };
            globalBOM.push({ id: gatewayComp.id, description: gatewayComp.description, quantity: 1, price: gatewayComp.price, datasheetUrl: gatewayComp.datasheetUrl });
            if (isThreePhase) {
                const meterTri = inverterDB['DTSU666'] || { id: 'DTSU666', description: 'COMPTEUR TRI CHINT DTSU666', unit: 'piece', price: 'A4C248' };
                globalBOM.push({ id: meterTri.id, description: meterTri.description, quantity: 1, price: meterTri.price, datasheetUrl: meterTri.datasheetUrl });
            } else {
                const meterMono = inverterDB['DDSU666'] || { id: 'DDSU666', description: 'COMPTEUR MONO CHINT DDSU666', unit: 'piece', price: 'A2R4G3' };
                globalBOM.push({ id: meterMono.id, description: meterMono.description, quantity: 1, price: meterMono.price, datasheetUrl: meterMono.datasheetUrl });
            }
        }

        if (((project.inverterConfig.brand === InverterBrand.FOXESS && !project.inverterConfig.model?.includes('MICRO')) || project.inverterConfig.brand === InverterBrand.CUSTOM) && !isMicroSystem) {
             // --- CÂBLES DC : on se base sur les longueurs MPPT saisies (dcCablingRuns)
             // Objectif : alimenter automatiquement la ligne "Accessoires" avec les bonnes références,
             // en agrégeant les longueurs et en sélectionnant les couronnes (C50/C100) si elles existent.
             const panel = project.fields[0]?.panels?.model;
             const isc = panel?.electrical?.isc ?? 0;
             const vmp = panel?.electrical?.vmp ?? 0;
             const iscCorr = isc > 0 ? isc * 1.25 : 0;

             const configured = project.inverterConfig.configuredStrings || [];
             const runs = project.inverterConfig.dcCablingRuns || [];

             // Agrégation longueurs par section (1 conducteur). Rouge et noir séparés ensuite.
             const lengthBySection: Record<number, number> = {};
             const pickAutoDcSection = (mpptIndex: number, lengthM: number) => {
                 const mpptPanels = configured
                     .filter(s => s.mpptIndex === mpptIndex)
                     .reduce((sum, s) => sum + (s.panelCount || 0), 0);
                 // Vmp "chaud" simplifié (≈ -12%) pour rester cohérent avec le rapport
                 const vmpHot = Math.max(1, mpptPanels * vmp * 0.88);
                 // Auto DC (Option B) : auto démarre à 6mm² et vise ΔU ≤ 3% (warning > 1%).
                 // On utilise Isc corrigé (sécurité) et Vmp chaud (référence rapport).
                 return pickAutoDcSectionOptionB(lengthM, iscCorr, vmpHot);
             };

             runs.forEach(r => {
                 const L = Number(r.lengthM || 0);
                 if (!Number.isFinite(L) || L <= 0) return;
                 const effectiveS = r.sectionMm2 ?? pickAutoDcSection(r.mpptIndex, L);
                 lengthBySection[effectiveS] = (lengthBySection[effectiveS] || 0) + L;
             });

             const pushDcCableLine = (id: string, fallbackDesc: string, qty: number) => {
                 const comp = (cableDB as any)[id];
                 if (comp) {
                     globalBOM.push({ id: comp.id, description: comp.description, quantity: qty, price: comp.price, datasheetUrl: comp.datasheetUrl });
                 } else {
                     globalBOM.push({ id, description: fallbackDesc, quantity: qty, price: '' });
                 }
             };

             Object.entries(lengthBySection).forEach(([sStr, Ltot]) => {
                 const s = Number(sStr);
                 const L = Number(Ltot || 0);
                 if (!Number.isFinite(s) || !Number.isFinite(L) || L <= 0) return;

                 // 1 câble rouge + 1 câble noir (longueur = L) → couronnes C100
                 if (s === 6) {
                     const qty = Math.max(1, Math.ceil(L / 100));
                     pushDcCableLine('821101000609400', `Câble solaire DC H1Z2Z2-K 1x6 (rouge) – ${Math.ceil(L)} m`, qty);
                     pushDcCableLine('821101000609200', `Câble solaire DC H1Z2Z2-K 1x6 (noir) – ${Math.ceil(L)} m`, qty);
                 } else {
                     // Non référencé en base : on affiche quand même une ligne pour ne pas oublier de chiffrer.
                     const meters = Math.ceil(L);
                     globalBOM.push({
                         id: `CABLE-DC-${s}MM-MANUEL`,
                         description: `Câble solaire DC H1Z2Z2-K 1x${s} (rouge + noir) – longueur estimée ${meters} m par conducteur (à chiffrer)`,
                         quantity: 1,
                         price: ''
                     });
                 }
             });

             const connFem = inverterDB['32.0316P0010-UR'] || { id: '32.0316P0010-UR', description: 'CONNECTEUR FEM.MC4 EVO2-10 pièces', unit: 'piece', price: 'A0C085' };
             globalBOM.push({ id: connFem.id, description: connFem.description, quantity: 1, price: connFem.price, datasheetUrl: connFem.datasheetUrl });

             const connMale = inverterDB['32.0317P0010-UR'] || { id: '32.0317P0010-UR', description: 'CONNECTEUR MALE MC4 EVO2-10 pièces', unit: 'piece', price: 'A0C077' };
             globalBOM.push({ id: connMale.id, description: connMale.description, quantity: 1, price: connMale.price, datasheetUrl: connMale.datasheetUrl });
        }

        if (project.inverterConfig.hasBattery && project.inverterConfig.batteryModel) {
            const allInverters = Object.values(inverterDB) as SolarComponent[];
            const batComp = allInverters.find(c => c.id === project.inverterConfig.batteryModel);
            if (batComp) {
                globalBOM.push({ id: batComp.id, description: batComp.description, quantity: 1, price: batComp.price, datasheetUrl: batComp.datasheetUrl });
            }
        }

        if (project.evCharger && project.evCharger.selected) {
            const chargerId = project.evCharger.phase === 'Tri' ? 'A022KS1-E-A' : 'A7300S1-E-2';
            const chargerComp = (Object.values(inverterDB) as SolarComponent[]).find(c => c.id === chargerId);
            if (chargerComp) {
                globalBOM.push({ id: chargerComp.id, description: chargerComp.description, quantity: 1, price: chargerComp.price, datasheetUrl: chargerComp.datasheetUrl });
            }

            if (project.evCharger.cableRef) {
                const cableComp = (Object.values(inverterDB) as SolarComponent[]).find(c => c.id === project.evCharger.cableRef);
                if (cableComp) {
                    globalBOM.push({ id: cableComp.id, description: cableComp.description, quantity: 1, price: cableComp.price, datasheetUrl: cableComp.datasheetUrl });
                }
            }

            if (project.evCharger.phase === 'Mono') {
                const diffComp = boxDB['03140'] || { id: '03140', description: 'Disjoncteur Diff mono 40A/30mA Type F 10kA', unit: 'piece', price: 'A4YC28' };
                globalBOM.push({ id: diffComp.id, description: diffComp.description, quantity: 1, price: diffComp.price, datasheetUrl: diffComp.datasheetUrl });

                if (project.inverterConfig.brand !== InverterBrand.FOXESS) {
                     const meterComp = (Object.values(inverterDB) as SolarComponent[]).find(c => c.id === 'DDSU666') || { id: 'DDSU666', description: 'COMPTEUR MONO CHINT DDSU666', unit: 'piece', price: 'A2R4G3' };
                     globalBOM.push({ id: meterComp.id, description: meterComp.description, quantity: 1, price: meterComp.price, datasheetUrl: meterComp.datasheetUrl });
                }
            } else if (project.evCharger.phase === 'Tri') {
                const breakerComp = boxDB['02056'] || { id: '02056', description: 'Disjoncteur 4x40 A C6 kA', unit: 'piece', price: 'A4YSY3' };
                globalBOM.push({ id: breakerComp.id, description: breakerComp.description, quantity: 1, price: breakerComp.price, datasheetUrl: breakerComp.datasheetUrl });

                const diffComp = boxDB['03446'] || { id: '03446', description: 'Inter Diff Tri 40A/30mA Type F', unit: 'piece', price: 'A4YC44' };
                globalBOM.push({ id: diffComp.id, description: diffComp.description, quantity: 1, price: diffComp.price, datasheetUrl: diffComp.datasheetUrl });

                if (project.inverterConfig.brand !== InverterBrand.FOXESS) {
                     const meterComp = (Object.values(inverterDB) as SolarComponent[]).find(c => c.id === 'DTSU666') || { id: 'DTSU666', description: 'COMPTEUR TRI CHINT DTSU666', unit: 'piece', price: 'A4C248' };
                     globalBOM.push({ id: meterComp.id, description: meterComp.description, quantity: 1, price: meterComp.price, datasheetUrl: meterComp.datasheetUrl });
                }
            }
        }

        let acBoxId = '';
        let dcBoxId = '';

        const activeInverter = (Object.values(inverterDB) as SolarComponent[]).find(c => c.id === project.inverterConfig.model) || (project.inverterConfig.brand === InverterBrand.CUSTOM ? inverterDB[project.inverterConfig.model || 'OND-PERSO'] : null);
        
        // --- CALCUL CORRECT PUISSANCE AC ET COURANT (NORME NFC 15-100) ---
        let systemTotalAcPowerVA = 0;
        const totalPanelsCount = project.fields.reduce((sum, f) => sum + getPanelCount(f.panels), 0);

        if (activeInverter) {
            const specs = activeInverter.electrical as InverterElectricalSpecs;
            
            const isKnownMicroBrand = project.inverterConfig.brand === InverterBrand.ENPHASE || project.inverterConfig.brand === InverterBrand.APSYSTEMS;
            const isMicroSystem = specs?.isMicro || project.inverterConfig.model?.includes('MICRO') || isKnownMicroBrand;

            // Pour les micros, la puissance est celle de l'ensemble, pas de l'onduleur unitaire
            if (isMicroSystem) {
                 let divisor = 1; // Enphase default
                 if (project.inverterConfig.brand === InverterBrand.APSYSTEMS) divisor = 2;
                 if (project.inverterConfig.brand === InverterBrand.FOXESS && project.inverterConfig.model?.includes('2000')) divisor = 4;
                 else if (project.inverterConfig.brand === InverterBrand.FOXESS) divisor = 2;
                 
                 const numMicros = Math.ceil(totalPanelsCount / divisor);
                 // Correction: On prend la puissance totale de l'ensemble des micros
                 systemTotalAcPowerVA = numMicros * (specs?.maxAcPower || 0);
            } else {
                 // Pour central, c'est la puissance de l'onduleur
                 systemTotalAcPowerVA = specs?.maxAcPower || activeInverter.power || totalPowerW;
            }
        } else {
            systemTotalAcPowerVA = totalPowerW; // Fallback DC si pas d'onduleur sélectionné
        }

        // Calcul Courant Sortie (I)
        const uNetwork = isThreePhase ? 400 : 230;
        const iOutput = isThreePhase 
            ? systemTotalAcPowerVA / (uNetwork * 1.732) 
            : systemTotalAcPowerVA / uNetwork;
        
        // Calibre requis = I * 1.25 (Coefficient sécurité PV continu)
        const requiredBreakerRating = iOutput * 1.25;

        // --- MICRO-ONDULEURS : REPORT BRANCHES (pour coffret AC + chutes de tension) ---
        // IMPORTANT: Enphase/APSystems are treated as "micro" as soon as the brand is selected, even if the model is still empty.
        // Only compute the branches report once a model is selected, otherwise keep the UI stable (no white screen).
        const microMaxAcPower = ((activeInverter?.electrical as InverterElectricalSpecs | undefined)?.maxAcPower) ?? 0;
        const microBranchReport = (isMicroSystem && !!project.inverterConfig.model)
            ? computeMicroBranchesReport(
                { ...project, inverterConfig: { ...project.inverterConfig, microBranches: ensureDefaultMicroBranches(project) } },
                microMaxAcPower
              )
            : null;

        const microBranchesCount = microBranchReport?.branches?.length || 0;

        // --- SÉLECTION COFFRET AC ---
        if (project.inverterConfig.brand === InverterBrand.ENPHASE) {
            if (isThreePhase) acBoxId = '13488'; // 16A Tri (Supporte ~11kW)
            else {
                // Si l'utilisateur a configuré plusieurs branches, on privilégie les coffrets adaptés (1/2/3 Q-Relay)
                if (microBranchesCount >= 3) acBoxId = '13466';
                else if (microBranchesCount === 2) acBoxId = '13464';
                else if (microBranchesCount === 1) acBoxId = '13462';
                else {
                    if (requiredBreakerRating <= 20) acBoxId = '13462';
                    else if (requiredBreakerRating <= 40) acBoxId = '13464';
                    else acBoxId = '13466';
                }
            }
        } 
        else if (project.inverterConfig.brand === InverterBrand.APSYSTEMS) {
            if (isThreePhase) acBoxId = '13498'; // 16A Tri
            else {
                // Coffrets multi-strings: 1 / 2 / 3 départs (selon nb de branches)
                if (microBranchesCount >= 3) acBoxId = '13446';
                else if (microBranchesCount === 2) acBoxId = '13444';
                else if (microBranchesCount === 1) acBoxId = '13442';
                else {
                    // Fallback par puissance
                    if (systemTotalAcPowerVA <= 4500) acBoxId = '13442';
                    else if (systemTotalAcPowerVA <= 8800) acBoxId = '13444';
                    else acBoxId = '13446';
                }
            }
        }
        else if (project.inverterConfig.brand === InverterBrand.FOXESS || project.inverterConfig.brand === InverterBrand.CUSTOM) {
            const hasBattery = project.inverterConfig.hasBattery;
            const hasBackup = project.inverterConfig.hasBackup;
            if (hasBackup) {
                if (isThreePhase) acBoxId = '12507';
                else {
                    if (requiredBreakerRating <= 20) acBoxId = '12554';
                    else if (requiredBreakerRating <= 32) acBoxId = '12556';
                    else acBoxId = '12558';
                }
            } else if (hasBattery) {
                if (isThreePhase) acBoxId = '12501'; 
                else {
                    if (requiredBreakerRating <= 20) acBoxId = '12522';
                    else if (requiredBreakerRating <= 32) acBoxId = '12526';
                    else acBoxId = '12528';
                }
            } else {
                if (isThreePhase) acBoxId = requiredBreakerRating <= 16 ? '13474' : '13476';
                else {
                    if (requiredBreakerRating <= 20) acBoxId = '13412';
                    else if (requiredBreakerRating <= 32) acBoxId = '13416';
                    else if (requiredBreakerRating <= 40) acBoxId = '13418'; // 40A
                    else acBoxId = '13446'; // Fallback 63A si puissance > 9kW (utilise réf APS 63A standard)
                }
            }
            
            // --- SÉLECTION COFFRET DC ---
            if (project.inverterConfig.brand === InverterBrand.CUSTOM || !project.inverterConfig.model?.includes('MICRO')) {
                const invSpecs = activeInverter?.electrical as InverterElectricalSpecs;
                if (invSpecs && !invSpecs.isMicro) {
                    const mppt = invSpecs.mpptCount || 2;
                    let maxSeries = 0;
                    if (project.inverterConfig.configuredStrings && project.inverterConfig.configuredStrings.length > 0) {
                        project.inverterConfig.configuredStrings.forEach(s => maxSeries = Math.max(maxSeries, s.panelCount));
                    } else {
                        maxSeries = Math.ceil(totalPanelsCount / mppt);
                    }
                    const climateInfo = getLocationClimate(project.postalCode, project.altitude);
                    const tempMin = climateInfo.tempMin;
                    const pModel = project.fields[0].panels.model;
                    const pVoc = pModel.electrical?.voc || 40;
                    const pCoeff = pModel.electrical?.tempCoeffVoc || -0.26;
                    const vocColdField = pVoc * (1 + (pCoeff/100) * (tempMin - 25)) * maxSeries;
                    const use1000V = vocColdField > 600;

                    if (hasBattery || hasBackup) {
                        if (mppt === 2) dcBoxId = use1000V ? '12273' : '12233';
                        else if (mppt >= 3) dcBoxId = '12283';
                    } else {
                        if (mppt === 2) dcBoxId = use1000V ? '12272' : '12232';
                        else if (mppt >= 3) dcBoxId = '12282';
                    }
                }
            }
        }

        if (acBoxId && boxDB[acBoxId]) {
            const comp = boxDB[acBoxId];
            globalBOM.push({ id: comp.id, description: comp.description, quantity: 1, price: comp.price, datasheetUrl: comp.datasheetUrl });

            // ENPHASE : ajouter les Q-Relay dans la liste matériel, selon le coffret retenu
            // Règle métier demandée :
            // - Coffret 13462 => 1 qrelay mono
            // - Coffret 13464 => 2 qrelay mono
            // - Coffret 13466 => 3 qrelay mono
            // - Coffret tri 13488 => 1 qrelay tri
            // Enphase = micro-onduleurs dans cette appli.
            // On évite de dépendre d'une variable locale (inverterType) qui peut être absente
            // au moment où l'utilisateur change la marque avant d'avoir choisi un modèle.
            const isEnphaseMicro = project.inverterConfig.brand === InverterBrand.ENPHASE;
            if (isEnphaseMicro) {
                const qRelayQty = (acBoxId === '13462') ? 1
                    : (acBoxId === '13464') ? 2
                    : (acBoxId === '13466') ? 3
                    : (acBoxId === '13488') ? 1
                    : 0;

                if (qRelayQty > 0) {
                    const qRelayComp = (acBoxId === '13488')
                        ? ENPHASE_COMPONENTS.Q_RELAY_TRI_INT
                        : ENPHASE_COMPONENTS.Q_RELAY_MONO_FR;

                    globalBOM.push({
                        id: qRelayComp.id,
                        description: qRelayComp.description,
                        quantity: qRelayQty,
                        price: qRelayComp.price,
                    });
                }
            }
        }
        if (dcBoxId && boxDB[dcBoxId]) {
            const comp = boxDB[dcBoxId];
            globalBOM.push({ id: comp.id, description: comp.description, quantity: 1, price: comp.price, datasheetUrl: comp.datasheetUrl });
        }

        // --- CALCUL DISJONCTEUR SI AGCP RENSEIGNÉ ---
        if (project.inverterConfig.agcpValue && project.inverterConfig.agcpValue > 0) {
            const agcp = project.inverterConfig.agcpValue;
            let disjId = '';
            
            if (isThreePhase) {
                // LOGIQUE TRIPHASEE
                if (agcp <= 20) disjId = '02048';      // 12 kVA (20A) -> 16A
                else if (agcp <= 25) disjId = '02048'; // 15 kVA (25A) -> 16A
                else if (agcp <= 30) disjId = '02050'; // 18 kVA (30A) -> 20A
                else if (agcp <= 40) disjId = '02052'; // 24 kVA (40A) -> 25A
                else if (agcp <= 50) disjId = '02054'; // 30 kVA (50A) -> 32A
                else disjId = '02056';                 // 36 kVA (60A) -> 40A
            } else {
                // LOGIQUE MONOPHASEE
                if (agcp <= 30) disjId = '02018';      // 6 kVA (30A) -> 32A
                else if (agcp <= 45) disjId = '02020'; // 9 kVA (45A) -> 40A
                else disjId = '02024';                 // 12 kVA (60A) -> 63A
            }

            const disjComp = boxDB[disjId];
            if (disjComp) {
                globalBOM.push({ id: disjComp.id, description: disjComp.description, quantity: 1, price: disjComp.price, datasheetUrl: disjComp.datasheetUrl });
            }
        }
    }

    const finalizedBOM = globalBOM.map(item => ({
        ...item,
        price: project.userPrices?.[item.id] !== undefined ? project.userPrices[item.id] : item.price
    }));

    const finalizedBOMMerged = mergeCableCoilsInBOM(finalizedBOM, cableDB);

    setMaterials(finalizedBOMMerged);
  // Dépendance volontairement large : on veut que la liste matériel se recalcule à chaque clic utilisateur.
  // Sinon certaines zones "cliquables" (ex: changer le nombre de panneaux, repasser sur un autre coffret)
  // peuvent laisser des éléments figés dans la liste.
  }, [project, k2DB, esdecDB, inverterDB, boxDB, cableDB]);

  const totalPowerW = project.fields.reduce((sum, f) => sum + (f.panels.model.power * getPanelCount(f.panels)), 0);
  const isThreePhase = project.inverterConfig.phase === 'Tri';

  const subscriptionStatus = useMemo(() => {
    return getSubscriptionStatus({
      phase: isThreePhase ? 'Tri' : 'Mono',
      projectPowerKwc: totalPowerW / 1000,
      agcpA: project.inverterConfig.agcpValue,
    });
  }, [isThreePhase, totalPowerW, project.inverterConfig.agcpValue]);
  
  // --- Liaison AC (tableau principal) : Auto vs Section forcée ---
  // IMPORTANT (patch) : la section "Auto" doit respecter **à la fois**
  //  - l'objectif de chute de tension (ΔU ≤ 1%)
  //  - la cohérence protection/section (Ib ≤ In ≤ Iz) en se basant sur le **calibre normalisé retenu**
  // Sinon on peut se retrouver avec : Auto=10mm² (ΔU OK) mais In normalisé=63A => NON CONFORME.

  // 1) Protection AC : disjoncteur minimal théorique (1.25 × Imax), puis calibre normalisé.
  // --- Inverter context (needed for AC1 when onduleur centralisé) ---
  const activeInverterCompForCalc = (Object.values(inverterDB) as any[]).find((c: any) => c.id === project.inverterConfig.model)
    || (project.inverterConfig.brand === InverterBrand.CUSTOM ? (inverterDB as any)[project.inverterConfig.model || 'OND-PERSO'] : null);
  const invSpecsForCalc = (activeInverterCompForCalc?.electrical as InverterElectricalSpecs | undefined);
  const isCentralInverter = !!activeInverterCompForCalc && !invSpecsForCalc?.isMicro && (project.inverterConfig.brand !== InverterBrand.ENPHASE && project.inverterConfig.brand !== InverterBrand.APSYSTEMS);

  // Puissance AC de référence :
  // - micro : puissance totale des micros (déjà traitée ailleurs)
  // - centralisé : maxAcPower (ou fallback sur power / PV)
  const inverterAcPowerVA = (isCentralInverter
    ? (invSpecsForCalc?.maxAcPower || (activeInverterCompForCalc as any)?.power || totalPowerW)
    : totalPowerW);

  const acCurrentMaxA = isThreePhase ? totalPowerW / (400 * 1.732) : totalPowerW / 230;
  const recommendedBreakerA = Math.ceil(acCurrentMaxA * 1.25);
  const acBreakerMinA = recommendedBreakerA;

  // IMPORTANT: If the user provides an AGCP value, the app may choose to size the head protection
  // for the AC liaison to match that AGCP (devis/backup context). In that case, the cable sizing
  // must be re-evaluated against the *commercial* breaker rating implied by AGCP.
  // Otherwise, the UI could show a small section "OK" while the BOM lists a larger breaker (e.g., 63A).
  const getAgcpCommercialBreakerA = (agcpA?: number): number | null => {
    if (!agcpA || agcpA <= 0) return null;
    if (isThreePhase) {
      // Tri: typical ladder 16/20/25/32/40A
      if (agcpA <= 25) return 16;
      if (agcpA <= 30) return 20;
      if (agcpA <= 40) return 25;
      if (agcpA <= 50) return 32;
      return 40;
    }
    // Mono: typical ladder 32/40/63A
    if (agcpA <= 30) return 32;
    if (agcpA <= 45) return 40;
    return 63;
  };
  const normalizeBreaker = (minA: number) => {
    // Mono : 16/20/32/40/63 (calibres réellement utilisés dans nos coffrets AC PV)
    // Tri  : 16/20/25/32/40 (calibres usuels)
    const available = isThreePhase ? [16, 20, 25, 32, 40] : [16, 20, 32, 40, 63];
    return available.find(v => v >= minA) ?? available[available.length - 1];
  };
  const agcpBreakerA = getAgcpCommercialBreakerA(project.inverterConfig.agcpValue ?? undefined);
  const acBreakerNormalizedA = agcpBreakerA ?? normalizeBreaker(acBreakerMinA);

  // 2) Section "Auto" : plus petite section qui respecte ΔU ≤ 1% ET protection non "danger".
  // (on ne déduit PAS la section depuis la liste matériel, sinon on risque un effet "figé"
  // si un câble a été sélectionné une fois dans un autre contexte).
  const AC_SECTIONS = [2.5, 6, 10, 16, 25];
  const pickAutoAcSection = () => {
    // AC2 (coffret AC → tableau)
    // Auto vise ΔU ≤ 1% si possible.
    // Patch métier : sur AC2, on évite le 6mm² dès qu'on est sur des protections 32A/40A
    // (devis : "à 1 m près" ça...)
    const minAutoSection = (!isThreePhase && (acBreakerNormalizedA === 32 || acBreakerNormalizedA === 40)) ? 10 : AC_SECTIONS[0];

    // 1) on privilégie une sélection "Auto" conservatrice :
    //    ΔU ≤ 1% ET protection "ok" (≤ table pessimiste) si possible.
    for (const s of AC_SECTIONS) {
      if (s < minAutoSection) continue;
      const dup = calculateVoltageDropPercent(totalPowerW, project.distanceToPanel, s, isThreePhase);
      const status = getProtectionStatusForSection(s, acBreakerNormalizedA);
      if (dup <= 1 && status === 'ok') return s;
    }

    // 2) fallback : on accepte le statut "info" (conditions de pose) si nécessaire,
    //    mais on refuse "danger".
    let chosen = minAutoSection;
    for (const s of AC_SECTIONS) {
      if (s < minAutoSection) continue;
      chosen = s;
      const dup = calculateVoltageDropPercent(totalPowerW, project.distanceToPanel, s, isThreePhase);
      const status = getProtectionStatusForSection(s, acBreakerNormalizedA);
      if (dup <= 1 && status !== 'danger') break;
    }
    return chosen;
  };
  const autoAcCableSectionRaw = pickAutoAcSection();

  // 3) Section effectivement utilisée pour les calculs (si l'utilisateur force, on respecte)
  const effectiveAcCableSectionRaw = project.acCableSectionMm2 ?? autoAcCableSectionRaw;

  // (AC2 values computed after AC1 to enforce AC2 ≥ AC1 in centralized)


  // --- AC1 (centralisé) : Onduleur → Coffret AC ---
  const ac1LengthM = (project.distanceInverterToAcCoffret ?? 0) || 0;
  const ac1CurrentMaxA = isThreePhase ? inverterAcPowerVA / (400 * 1.732) : inverterAcPowerVA / 230;
  const ac1BreakerMinA = Math.ceil(ac1CurrentMaxA * 1.25);
  const ac1BreakerNormalizedA = normalizeBreakerA(ac1BreakerMinA, isThreePhase);
  const pickAutoAc1Section = () => {
    // Même philosophie que AC2 : Auto doit viser "ok" (pessimiste) si possible.
    for (const s of AC_SECTIONS) {
      const dup = calculateVoltageDropPercent(inverterAcPowerVA, ac1LengthM, s, isThreePhase);
      const status = getProtectionStatusForSection(s, ac1BreakerNormalizedA);
      if (dup <= 1 && status === 'ok') return s;
    }

    let chosen = AC_SECTIONS[0];
    for (const s of AC_SECTIONS) {
      chosen = s;
      const dup = calculateVoltageDropPercent(inverterAcPowerVA, ac1LengthM, s, isThreePhase);
      const status = getProtectionStatusForSection(s, ac1BreakerNormalizedA);
      if (dup <= 1 && status !== 'danger') break;
    }
    return chosen;
  };
  const autoAc1CableSection = pickAutoAc1Section();
  const effectiveAc1CableSection = project.ac1CableSectionMm2 ?? autoAc1CableSection;
  const ac1VoltageDropPercent = calculateVoltageDropPercent(inverterAcPowerVA, ac1LengthM, effectiveAc1CableSection, isThreePhase);
  const autoAc1VoltageDropPercent = calculateVoltageDropPercent(inverterAcPowerVA, ac1LengthM, autoAc1CableSection, isThreePhase);
  const ac1ProtectionStatus = getProtectionStatusForSection(effectiveAc1CableSection, ac1BreakerNormalizedA);

  // --- Règle métier (centralisé) : AC2 doit être ≥ AC1 ---
  // En automatique, on force AC2 à être au minimum la section effective AC1.
  // Si l'utilisateur force AC2 < AC1 : non conforme (blocage export PDF + message rouge).
  const autoAcCableSection = (isCentralInverter
    ? Math.max(autoAcCableSectionRaw, effectiveAc1CableSection)
    : autoAcCableSectionRaw);

  const effectiveAcCableSection = (isCentralInverter && project.acCableSectionMm2 == null)
    ? Math.max(autoAcCableSection, effectiveAc1CableSection)
    : effectiveAcCableSectionRaw;

  const acSectionOrderViolation = isCentralInverter && (effectiveAcCableSection < effectiveAc1CableSection);

  // 4) Chute de tension recalculée avec la section effective (AC2)
  const voltageDropPercent = calculateVoltageDropPercent(
    totalPowerW,
    project.distanceToPanel,
    effectiveAcCableSection,
    isThreePhase
  );

  // Valeurs dédiées à l'UI (comparaison Auto vs Forcé)
  const effectiveAcVoltageDropPercent = voltageDropPercent;
  const autoAcVoltageDropPercent = calculateVoltageDropPercent(
    totalPowerW,
    project.distanceToPanel,
    autoAcCableSection,
    isThreePhase
  );

  // Statut "ok / info / danger" basé sur In normalisé (et non sur la valeur théorique brute)
  const acProtectionStatus = getProtectionStatusForSection(effectiveAcCableSection, acBreakerNormalizedA);
  const acProtectionTooHigh = acProtectionStatus === 'danger';

  // Badge pédagogique si la section est surdimensionnée (chute de tension)
  const isAcSectionOversized = effectiveAcCableSection > autoAcCableSection;

  const activeField = project.fields[activeFieldIndex] || project.fields[0];
  const activeInverterComp = (Object.values(inverterDB) as SolarComponent[]).find((c: SolarComponent) => c.id === project.inverterConfig.model) || (project.inverterConfig.brand === InverterBrand.CUSTOM ? inverterDB[project.inverterConfig.model || 'OND-PERSO'] : null);
  const invSpecs = activeInverterComp?.electrical as InverterElectricalSpecs;

  const microBranchesReport = useMemo(() => {
      const microPowerVA = invSpecs?.maxAcPower || 0;
      return computeMicroBranchesReport(
        { ...project, inverterConfig: { ...project.inverterConfig, microBranches: ensureDefaultMicroBranches(project) } },
        microPowerVA
      );
  }, [project, invSpecs]);

  // --- DC (MPPT) : Auto vs Section forcée + ΔU dynamique (mêmes seuils que AC) ---
  // DC : en automatique on démarre volontairement à 6 mm² (bonne pratique PV),
  // tout en laissant 2,5 mm² disponible en forçage manuel.
  const DC_SECTIONS = [2.5, 6, 10, 16];


  const maxMpptAvailable = useMemo(() => {
    if (project.inverterConfig.brand === InverterBrand.NONE || project.inverterConfig.model === 'Auto') return 2;
    if (invSpecs?.isMicro) return 1;
    return invSpecs?.mpptCount || 2;
  }, [invSpecs, project.inverterConfig.brand, project.inverterConfig.model]);

  const compatibilityReport = useMemo(() => {
      const panelsPerField = project.fields.map(f => getPanelCount(f.panels));
      const totalPanelsCount = panelsPerField.reduce((a, b) => a + b, 0);
      if(totalPanelsCount === 0) return null;
      
      let activeInverter = activeInverterComp;
      if (!activeInverter && project.inverterConfig.model === 'Auto') {
         const brandPrefix = project.inverterConfig.brand === 'FoxESS' ? 'FOX' : (project.inverterConfig.brand === 'Enphase' ? 'ENP' : 'APS');
         const candidates = (Object.values(inverterDB) as SolarComponent[]).filter(c => c.id.startsWith(brandPrefix) && !c.id.includes('MICRO') && !c.id.includes('ECS') && !c.id.includes('EP') && !c.id.includes('EQ'));
         const target = totalPowerW * 0.8;
         candidates.sort((a,b) => (a.power || 0) - (b.power || 0));
         activeInverter = candidates.find(c => (c.power || 0) >= target) || candidates[candidates.length-1];
      }

      if (activeInverter) {
          const requiresStringConfig = ((project.inverterConfig.brand === 'FoxESS' && !project.inverterConfig.model?.includes('MICRO')) || project.inverterConfig.brand === 'Custom');
          
          if (requiresStringConfig) {
              const totalAssigned = (project.inverterConfig.configuredStrings || []).reduce((acc, s) => acc + s.panelCount, 0);
              if (totalAssigned !== totalPanelsCount) {
                  return {
                      isCompatible: false,
                      warnings: [],
                      errors: [`Répartition Incorrecte : ${totalAssigned} panneaux assignés sur ${totalPanelsCount} disponibles.`],
                      details: null
                  };
              }
          }

          const stringsLegacy = project.inverterConfig.stringsCount || 1;
          
          return checkElectricalCompatibility(
              activeField.panels.model,
              activeInverter as any,
              projectClimate,
              Math.ceil(totalPanelsCount / stringsLegacy), 
              totalPanelsCount,
              stringsLegacy,
              0,
              project.inverterConfig.configuredStrings,
              project.fields,
              project.inverterConfig.phase,
              project.inverterConfig.dcCablingRuns || []
          );
      }
      return null;
  }, [
      project.fields,
      project.inverterConfig.configuredStrings,
      project.inverterConfig.stringsCount,
      project.inverterConfig.model,
      project.inverterConfig.phase,
      activeFieldIndex,
      totalPowerW,
      projectClimate,
      activeInverterComp,
      inverterDB
  ]);

  const dcMpptDrops = useMemo(() => {
    // On s'aligne sur les calculs "audit" (vmpHot + Isc corrigé) pour éviter des écarts
    // entre l'écran de saisie et le tableau de méthodologie / PDF.
    const stringsAnalysis = compatibilityReport?.details?.stringsAnalysis || [];
    if (!stringsAnalysis.length) return { rows: [], worst: 0 };

    const rho = 0.023;
    const runs = project.inverterConfig.dcCablingRuns || [];

    const rows = stringsAnalysis.map((mppt: any) => {
      const mpptIndex = Number(mppt.mpptIndex || 1);
      const run = runs.find(r => Number(r.mpptIndex) === mpptIndex) || { mpptIndex, lengthM: 0, sectionMm2: null };
      const L = Number(run.lengthM || 0);
      const forcedS = (run.sectionMm2 == null ? null : Number(run.sectionMm2));

      const V = Number(mppt.vmpHot || 0);          // base tension (à chaud)
      const I = Number(mppt.iscCalculation || 0);  // Isc corrigé (sécurité)

      const dropFor = (S: number) => {
        const du = (2 * L * I * rho) / (S || 1);
        const dup = V > 0 ? (du / V) * 100 : 0;
        return { du, dup };
      };

      // Auto : vise ΔU ≤ 3% (limite), avec recommandation ≤ 1%.
      // On démarre à 6 mm² minimum (bonne pratique PV) pour éviter un dimensionnement
      // trop optimiste lorsque les longueurs sont encore estimatives.
      let autoS = 6;
      if (L > 0 && I > 0 && V > 0) {
        for (const S of DC_SECTIONS.filter(s => s >= 6)) {
          const { dup } = dropFor(S);
          if (dup <= 3) { autoS = S; break; }
          autoS = S;
        }
      }

      const { du: autoDu, dup: autoDup } = dropFor(autoS);
      const effectiveS = forcedS ?? autoS;
      const { du, dup } = dropFor(effectiveS);
      const status = dup > 3 ? 'danger' : (dup > 1 ? 'warn' : 'ok');

      return { mpptIndex, L, V, I, autoS, autoDu, autoDup, forcedS, effectiveS, du, dup, status };
    });

    const worst = rows.length ? Math.max(...rows.map(r => Number(r.dup || 0))) : 0;
    return { rows, worst };
  }, [compatibilityReport, project.inverterConfig.dcCablingRuns]);

  const updateInverterConfig = (updates: Partial<typeof project.inverterConfig>) => {
    setProject(prev => {
	        let newConfig = { ...prev.inverterConfig, ...updates };

	        // Quand on change de marque/modèle d'onduleur, on réinitialise les sous-configurations
	        // dépendantes (strings/MPPT, câblage DC, branches micro) pour éviter des états incohérents
	        // qui peuvent provoquer un "écran blanc" (erreurs runtime).
	        const brandChanged = typeof updates.brand !== 'undefined' && updates.brand !== prev.inverterConfig.brand;
	        const modelChanged = typeof updates.model !== 'undefined' && updates.model !== prev.inverterConfig.model;
	        if (brandChanged || modelChanged) {
	            // On conserve phase/batterie/backups, mais on remet à plat le câblage/logique onduleur.
	            newConfig.configuredStrings = [];
	            newConfig.stringsCount = 1;
	            newConfig.microBranches = [];
	            newConfig.dcCablingRuns = [];
	        }
        if (updates.brand === InverterBrand.CUSTOM && !newConfig.model) {
            newConfig.model = GENERIC_INVERTER.id;
        }
        if (updates.hasBackup && !prev.inverterConfig.hasBattery) {
            newConfig.hasBattery = true;
        }
        if (updates.hasBattery === false) {
            newConfig.batteryModel = undefined;
        }
        
        let newEvCharger = { ...prev.evCharger };
        if (updates.phase) {
            if (updates.phase === 'Mono' && prev.evCharger.phase === 'Tri') {
                newEvCharger.phase = 'Mono';
                if (newEvCharger.cableRef) newEvCharger.cableRef = '15254';
            }
        }

        return { ...prev, inverterConfig: newConfig, evCharger: newEvCharger };
    });
  };

  const addSegmentToMppt = (mpptIdx: number) => {
      const newId = `str-${Date.now()}`;
      const newString: ConfiguredString = {
          id: newId,
          fieldId: project.fields[0].id,
          panelCount: 1, 
          mpptIndex: mpptIdx
      };
      updateInverterConfig({ 
          configuredStrings: [...(project.inverterConfig.configuredStrings || []), newString] 
      });
  };

  const updateString = (id: string, updates: Partial<ConfiguredString>) => {
      const newStrings = (project.inverterConfig.configuredStrings || []).map(s => 
          s.id === id ? { ...s, ...updates } : s
      );
      updateInverterConfig({ configuredStrings: newStrings });
  };

  const removeString = (id: string) => {
      const newStrings = (project.inverterConfig.configuredStrings || []).filter(s => s.id !== id);
      updateInverterConfig({ configuredStrings: newStrings });
  };

  const foxBatteries = useMemo(() => {
    const all = Object.values(inverterDB) as SolarComponent[];
    const allowedIds = ['FOX-EP5', 'FOX-EP6', 'FOX-EP11', 'FOX-EP12', 'FOX-EQ-CM6000', 'FOX-EQ-CS6000'];
    return all.filter(c => allowedIds.includes(c.id)).sort((a,b) => a.description.localeCompare(b.description));
  }, [inverterDB]);

  const handleUpdateMaterials = (updatedBOM: Material[]) => {
      const newPrices = { ...project.userPrices };
      updatedBOM.forEach(m => {
          newPrices[m.id] = m.price || '';
      });
      setProject(p => ({ ...p, userPrices: newPrices }));
      setMaterials(updatedBOM);
  };

  const isCustomPanel = activeField.panels.model.name === GENERIC_PANEL.name;
  const isCustomInverter = project.inverterConfig.brand === InverterBrand.CUSTOM;
  const hasCable = !!project.evCharger.cableRef;

  const totalPanelsToInstall = project.fields.reduce((sum, f) => sum + getPanelCount(f.panels), 0);
  const totalPanelsAssigned = (project.inverterConfig.configuredStrings || []).reduce((sum, s) => sum + s.panelCount, 0);
  const assignmentComplete = totalPanelsToInstall === totalPanelsAssigned;

  const isCustomLayout = !!activeField.panels.rowConfiguration && activeField.panels.rowConfiguration.length > 0;
  const activeRailOrientation = activeField.railOrientation || project.system.railOrientation || 'Horizontal';

  if (view === 'admin') {
    return (
        <AdminPage 
          k2={k2DB as any} esdec={esdecDB as any} inverters={inverterDB as any} panels={panelDB as any} boxes={boxDB as any} cables={cableDB as any}
          onUpdateK2={setK2DB as any} onUpdateEsdec={setEsdecDB as any} onUpdateInverters={setInverterDB as any} onUpdatePanels={setPanelDB as any} onUpdateBoxes={setBoxDB as any} onUpdateCables={setCableDB as any}
          onExit={() => setView('calculator')}
        />
    );
  }

  const agcpOptions = project.inverterConfig.phase === 'Tri' 
    ? [20, 25, 30, 40, 50, 60] // Paliers Tri (12kVA -> 36kVA)
    : [30, 45, 60]; // Paliers Mono (6kVA -> 12kVA)

  const handleResetProject = () => {
    const ok = window.confirm(
      "Réinitialiser le projet ?\n\nToutes les valeurs seront remises à zéro (nouveau projet)."
    );
    if (!ok) return;

    const fresh =
      typeof structuredClone === "function"
        ? structuredClone(DEFAULT_PROJECT)
        : JSON.parse(JSON.stringify(DEFAULT_PROJECT));

    setProject(fresh);
    setActiveFieldIndex(0);
    setMaterials([]);
    setIsProjectStep(true);
    setView('calculator');

    // UI state
    setShowWindGuide(false);
    setShowMargins(false);
    setShowCustomPanelModal(false);
    setShowCustomInverterModal(false);
    setShowLogin(false);

    // SAFE address state
    setAddressAutoEnabled(true);
    setAddressAutoStatus('idle');
    setAddressAutoMessage('');
    setAddressAutoLastLabel('');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-indigo-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-orange-500 text-3xl">■</span> Richardson Solaire <span className="text-xs bg-green-500 px-2 py-1 rounded-full">v3.0</span>
            </h1>
            
            {/* Header Project Summary - Compact */}
            {!isProjectStep && (
                <div className="hidden md:flex items-center gap-6 bg-indigo-800/50 px-4 py-1.5 rounded-full border border-indigo-700 animate-scale-in">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-indigo-300 font-bold uppercase">Client</span>
                        <span className="text-xs font-black truncate max-w-[150px]">{project.name}</span>
                    </div>
                    <div className="flex flex-col border-l border-indigo-700 pl-4">
                        <span className="text-[8px] text-indigo-300 font-bold uppercase">Localisation</span>
                        <span className="text-xs font-black">{project.postalCode} • {project.city || 'CP saisi'}</span>
                    </div>
                    <button onClick={() => setIsProjectStep(true)} className="p-1.5 hover:bg-orange-500 rounded-full transition-colors ml-2" title="Modifier le projet">
                        <PencilIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex gap-4 items-center">
                 <button
                     onClick={handleResetProject}
                     className="flex items-center gap-2 bg-white/10 hover:bg-red-600/90 px-3 py-2 rounded-lg font-black text-xs shadow-md transition-all active:scale-95"
                     title="Réinitialiser le projet"
                 >
                     <NewIcon className="w-4 h-4" />
                     Reset
                 </button>
                 {user ? (
                     <div className="flex items-center gap-2">
                         <span className="text-xs text-green-300 font-bold uppercase tracking-wider">Admin Richardson</span>
                         <button onClick={() => setView('admin')} className="p-2 bg-indigo-800 rounded-lg hover:bg-orange-500 transition-colors shadow-inner" title="Gérer la base de données"><SettingsIcon className="w-5 h-5"/></button>
                         <button onClick={handleLogout} className="text-xs text-indigo-300 hover:text-white px-3 py-1 border border-indigo-700 rounded-md">Déconnexion</button>
                     </div>
                 ) : (
                     <button onClick={() => setShowLogin(true)} className="text-xs bg-indigo-800 px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-all active:scale-95">Admin Login</button>
                 )}
            </div>
        </div>
      </header>

      {showLogin && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
              <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-sm animate-scale-in">
                  <h2 className="text-2xl font-black mb-2 text-slate-800 text-center">Connexion</h2>
                  {loginError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-bold mb-4 border border-red-100 shake">{loginError}</div>}
                  <div className="space-y-4">
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email" required />
                    <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Mot de passe" required />
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button type="button" onClick={() => setShowLogin(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">Fermer</button>
                      <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-black shadow-lg shadow-blue-200 transition-all active:scale-95">Valider</button>
                  </div>
              </form>
          </div>
      )}

      <main className="container mx-auto p-4 relative">
        
        {/* BLOC PROJET INITIAL (CENTRAL) */}
        {isProjectStep && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-100/95 backdrop-blur-sm p-4 animate-scale-in">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-blue-600 max-w-2xl w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">Initialisation du Projet</h2>
                            <p className="text-sm text-slate-500 font-medium">Saisissez les informations clients pour débloquer les calculs normatifs.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nom du client / Projet</label>
                                <input
                                    type="text"
                                    value={project.name}
                                    onChange={(e) => setProject(p => ({...p, name: e.target.value}))}
                                    className="w-full p-3 border rounded-xl text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold border-slate-200"
                                    placeholder="Ex: M. Jean DUPONT"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Adresse</label>
                                <input type="text" value={project.clientAddress} onChange={(e) => setProject(p => ({...p, clientAddress: e.target.value}))} className="w-full p-3 border rounded-xl text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold border-slate-200" placeholder="Ex: 12 bis rue des Fleurs"/>
                                {ENABLE_ADDRESS_AUTO && (
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={addressAutoEnabled}
                                        onChange={(e) => {
                                          const v = e.target.checked;
                                          setAddressAutoEnabled(v);
                                          setAddressAutoStatus(v ? 'idle' : 'manual');
                                          setAddressAutoMessage(v ? '' : 'Saisie manuelle');
                                        }}
                                      />
                                      Auto (recommandé)
                                    </label>
                                    <div className={`text-xs font-black ${
                                      addressAutoStatus === 'success' ? 'text-emerald-600' :
                                      addressAutoStatus === 'loading' ? 'text-slate-500' :
                                      addressAutoStatus === 'partial' ? 'text-orange-600' :
                                      addressAutoStatus === 'manual' ? 'text-orange-600' :
                                      addressAutoStatus === 'error' ? 'text-red-600' :
                                      'text-slate-500'
                                    }`}>
                                      {addressAutoMessage || ''}
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ville</label>
                                    <input type="text" value={project.city} onChange={(e) => setProject(p => ({...p, city: e.target.value}))} className="w-full p-3 border rounded-xl text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold border-slate-200" placeholder="Ville"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">CP</label>
                                    <input type="text" value={project.postalCode} onChange={(e) => setProject(p => ({...p, postalCode: e.target.value}))} className="w-full p-3 border rounded-xl text-sm font-black text-center focus:ring-4 focus:ring-blue-100 outline-none border-slate-200" placeholder="83000"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Altitude (m)</label>
                                    <input type="number" value={project.altitude} onChange={(e) => setProject(p => ({...p, altitude: parseInt(e.target.value) || 0}))} className="w-full p-3 border rounded-xl text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold border-slate-200" placeholder="0"/>
                                    <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Température retenue</div>
                                      <div className="mt-1 text-2xl font-black text-slate-800">{projectClimate?.tempMin ?? '--'}°C</div>
                                      <div className="mt-1 text-xs font-bold text-slate-600">
                                        Base mer : {projectClimate?.baseTempSeaLevel ?? (projectClimate?.label?.match(/Base (-?\d+)°C/)?.[1] ?? '--')}°C
                                        {typeof projectClimate?.altitudePenalty === 'number' ? <> • Correction altitude : -{projectClimate.altitudePenalty}°C</> : null}
                                      </div>
                                    </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <button 
                            onClick={() => isProjectReady && setIsProjectStep(false)}
                            disabled={!isProjectReady}
                            className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 ${isProjectReady ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                        >
                            {isProjectReady ? 'Lancer la configuration technique' : 'Saisissez au moins le nom et le CP'}
                        </button>
                        <button onClick={() => setShowWindGuide(true)} className="text-blue-600 font-bold text-xs hover:underline uppercase tracking-widest">Consulter la carte des températures basses</button>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-4">
                
                {/* 1. BLOC STRUCTURE */}
                <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-indigo-500 animate-scale-in">
                    <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs mb-3">Structure</h3>
                    <div className="flex gap-1 mb-3">
                        <button onClick={() => setProject(p => ({...p, system: {...p.system, brand: 'K2'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.system.brand === 'K2' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>K2 Systems</button>
                        <button onClick={() => setProject(p => ({...p, system: {...p.system, brand: 'ESDEC'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.system.brand === 'ESDEC' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>ESDEC</button>
                    </div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Orientation des rails (Toiture Active)</label>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setProject(p => { 
                                const f = [...p.fields]; 
                                f[activeFieldIndex].railOrientation = 'Horizontal'; 
                                return {...p, fields: f}; 
                            })} 
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeRailOrientation === 'Horizontal' ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                        >
                            Horizontal
                        </button>
                        <button 
                            onClick={() => setProject(p => { 
                                const f = [...p.fields]; 
                                f[activeFieldIndex].railOrientation = 'Vertical'; 
                                return {...p, fields: f}; 
                            })} 
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeRailOrientation === 'Vertical' ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                        >
                            Vertical
                        </button>
                    </div>
                </div>

                {/* 2. GROUPE TOITURE + PANNEAUX (INDENTÉ) */}
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-orange-400">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs">Toiture</h3>
                            <button onClick={() => {
                                setProject(p => ({...p, fields: [...p.fields, { id: `f${Date.now()}`, name: `Toit ${p.fields.length+1}`, roof: {...p.fields[0].roof}, panels: {...p.fields[0].panels} }]}));
                                setActiveFieldIndex(project.fields.length);
                            }} className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded font-black shadow-sm">+ ADD</button>
                        </div>
                        <div className="flex gap-1 overflow-x-auto mb-3">
                            {project.fields.map((f, i) => (
                                <button key={f.id} onClick={() => setActiveFieldIndex(i)} className={`px-2 py-1 text-[10px] rounded-t font-black uppercase transition-all ${activeFieldIndex === i ? 'bg-orange-5 text-orange-600 border-b-2 border-orange-500' : 'text-slate-400'}`}>
                                    {f.name} {i > 0 && <span onClick={(e) => { e.stopPropagation(); setProject(p => ({...p, fields: p.fields.filter((_, idx) => idx !== i)})); setActiveFieldIndex(0); }} className="ml-1 text-red-400">×</span>}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-center">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Largeur (m)</label>
                                    <input type="number" value={activeField.roof.width} onChange={(e) => { const v = parseFloat(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.width = v; return {...p, fields: f}; }); }} className="w-full border p-2 rounded-lg text-sm text-center font-black focus:ring-2 focus:ring-orange-200 outline-none"/>
                                </div>
                                <div className="text-center">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Hauteur (m)</label>
                                    <input type="number" value={activeField.roof.height} onChange={(e) => { const v = parseFloat(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.height = v; return {...p, fields: f}; }); }} className="w-full border p-2 rounded-lg text-sm text-center font-black focus:ring-2 focus:ring-orange-200 outline-none"/>
                                </div>
                            </div>
                            <select value={activeField.roof.type} onChange={(e) => { const v = e.target.value as RoofType; setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.type = v; return {...p, fields: f}; }); }} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-bold">
                                {Object.values(RoofType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className="bg-orange-50/50 rounded-lg border border-orange-100 overflow-hidden">
                                <button onClick={() => setShowMargins(!showMargins)} className="w-full flex justify-between items-center p-3 hover:bg-orange-100/50 transition-all group">
                                    <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Marges de sécurité (mm)</span>
                                    <svg className={`w-3 h-3 text-orange-400 transition-transform duration-300 ${showMargins ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {showMargins && (
                                    <div className="p-3 pt-0 grid grid-cols-2 gap-x-4 gap-y-2 animate-scale-in">
                                        <div><label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Haut</label><input type="number" value={activeField.roof.margins.top} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.top = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm focus:ring-1 focus:ring-orange-200 outline-none" /></div>
                                        <div><label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Bas</label><input type="number" value={activeField.roof.margins.bottom} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.bottom = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm focus:ring-1 focus:ring-orange-200 outline-none" /></div>
                                        <div><label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Gauche</label><input type="number" value={activeField.roof.margins.left} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.left = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm focus:ring-1 focus:ring-orange-200 outline-none" /></div>
                                        <div><label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Droite</label><input type="number" value={activeField.roof.margins.right} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.right = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm focus:ring-1 focus:ring-orange-200 outline-none" /></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BLOC PANNEAUX (INDENTÉ) */}
                    <div className="ml-4 border-l-4 border-slate-300 pl-4 bg-white p-4 rounded-r-xl shadow-md border-t border-r border-b border-slate-200 -mt-2">
                        <h3 className="font-black text-slate-700 uppercase tracking-wider text-[10px] mb-2">Modules de {activeField.name}</h3>
                        <div className="flex items-center gap-2 mb-3">
                            <select value={activeField.panels.model.name} onChange={(e) => {
                                const comp = (panelDB as Record<string, SolarComponent>)[e.target.value];
                                if (comp) {
                                    const p: Panel = { 
                                    name: comp.id, width: comp.width!, height: comp.height!, power: comp.power!, 
                                    price: comp.price || '', electrical: comp.electrical as any, imageUrl: comp.imageUrl, 
                                    datasheetUrl: comp.datasheetUrl, manualUrl: comp.manualUrl, videoUrl: comp.videoUrl 
                                    };
                                    setProject(prev => { const f = [...prev.fields]; f[activeFieldIndex].panels.model = p; return {...prev, fields: f}; });
                                }
                            }} className="w-full p-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-200 outline-none">
                                {(Object.values(panelDB) as SolarComponent[]).sort((a: SolarComponent, b: SolarComponent) => {
                                    if (a.id === 'Panneau Personnalisé') return 1;
                                    if (b.id === 'Panneau Personnalisé') return -1;
                                    return (a.description || "").localeCompare(b.description || "");
                                }).map((p: SolarComponent) => <option key={p.id} value={p.id}>{p.description}</option>)}
                            </select>
                            {isCustomPanel && (
                                <button onClick={() => setShowCustomPanelModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all" title="Configurer le panneau">
                                    <SettingsIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Pose</label>
                        <div className="flex gap-1 mb-3">
                            <button onClick={() => setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.orientation = 'Portrait'; return {...p, fields: f}; })} className={`flex-1 py-1 text-[8px] font-black uppercase rounded border transition-all ${activeField.panels.orientation === 'Portrait' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>Portrait</button>
                            <button onClick={() => setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.orientation = 'Paysage'; return {...p, fields: f}; })} className={`flex-1 py-1 text-[8px] font-black uppercase rounded border transition-all ${activeField.panels.orientation === 'Paysage' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>Paysage</button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3 bg-slate-50 p-1.5 rounded border border-slate-200">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isCustomLayout} 
                                    onChange={(e) => setProject(p => {
                                        const f = [...p.fields];
                                        if (e.target.checked) {
                                            f[activeFieldIndex].panels.rowConfiguration = Array(f[activeFieldIndex].panels.rows).fill(f[activeFieldIndex].panels.columns);
                                        } else {
                                            f[activeFieldIndex].panels.rowConfiguration = undefined;
                                        }
                                        return {...p, fields: f};
                                    })} 
                                    className="sr-only peer" 
                                />
                                <div className="w-6 h-3 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-2 text-[8px] font-black text-slate-600 uppercase">Forme Libre</span>
                            </label>
                        </div>

                        {isCustomLayout ? (
                            <div className="space-y-1.5 animate-scale-in max-h-48 overflow-y-auto pr-1">
                                {activeField.panels.rowConfiguration?.map((cols, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-1 rounded">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">L{idx + 1}</span>
                                        <input 
                                            type="number" 
                                            value={cols} 
                                            min="0"
                                            onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                setProject(p => {
                                                    const f = [...p.fields];
                                                    const newConfig = [...(f[activeFieldIndex].panels.rowConfiguration || [])];
                                                    newConfig[idx] = val;
                                                    f[activeFieldIndex].panels.rowConfiguration = newConfig;
                                                    f[activeFieldIndex].panels.columns = Math.max(...newConfig);
                                                    return {...p, fields: f};
                                                });
                                            }}
                                            className="w-12 p-0.5 border rounded text-center text-xs font-bold focus:ring-1 focus:ring-blue-300 outline-none"
                                        />
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-slate-100 flex justify-center gap-1">
                                    <button onClick={() => setProject(p => { const f = [...p.fields]; const currentConfig = f[activeFieldIndex].panels.rowConfiguration || []; const lastVal = currentConfig.length > 0 ? currentConfig[currentConfig.length-1] : 1; f[activeFieldIndex].panels.rowConfiguration = [...currentConfig, lastVal]; f[activeFieldIndex].panels.rows = f[activeFieldIndex].panels.rowConfiguration.length; return {...p, fields: f}; })} className="text-[8px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 font-bold">+ Ligne</button>
                                    <button onClick={() => setProject(p => { const f = [...p.fields]; const currentConfig = f[activeFieldIndex].panels.rowConfiguration || []; if(currentConfig.length > 1) { f[activeFieldIndex].panels.rowConfiguration = currentConfig.slice(0, -1); f[activeFieldIndex].panels.rows = f[activeFieldIndex].panels.rowConfiguration.length; } return {...p, fields: f}; })} className="text-[8px] bg-red-50 hover:bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold">- Ligne</button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-center">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Lignes</label>
                                    <input type="number" value={activeField.panels.rows} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.rows = v; return {...p, fields: f}; }); }} className="w-full border p-1 rounded text-center font-black text-blue-600 text-xs focus:ring-1 focus:ring-blue-100 outline-none"/>
                                </div>
                                <div className="text-center">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Colonnes</label>
                                    <input type="number" value={activeField.panels.columns} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.columns = v; return {...p, fields: f}; }); }} className="w-full border p-1 rounded text-center font-black text-blue-600 text-xs focus:ring-1 focus:ring-blue-100 outline-none"/>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. BLOC ÉLECTRIQUE */}
                <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-purple-500">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs">Électrique</h3>
                        <div className="flex gap-1.5 items-center">
                            {invSpecs?.mpptCount && <div className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-black">{invSpecs.mpptCount} MPPT</div>}
                            <div className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{(totalPowerW / 1000).toFixed(2)} kWc</div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
                        <div>
                            <label className={`flex items-center gap-3 cursor-pointer group ${(isMicroSystem || project.inverterConfig.hasBackup) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={project.inverterConfig.hasBattery} 
                                    disabled={isMicroSystem || project.inverterConfig.hasBackup}
                                    onChange={(e) => updateInverterConfig({ hasBattery: e.target.checked })} 
                                    className="w-4 h-4 rounded border-slate-300 text-purple-600 disabled:cursor-not-allowed" 
                                />
                                <span className="text-xs font-bold text-slate-700">Batterie</span>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer mt-2 group ${isMicroSystem ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={project.inverterConfig.hasBackup} 
                                    disabled={isMicroSystem}
                                    onChange={(e) => updateInverterConfig({ hasBackup: e.target.checked })} 
                                    className="w-4 h-4 rounded border-slate-300 text-purple-600 disabled:cursor-not-allowed" 
                                />
                                <span className="text-xs font-bold text-slate-700">Backup</span>
                            </label>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                            <Tooltip content="Puissance du disjoncteur d'abonné (AGCP) pour déterminer la protection AC" position="left">
                                <label className="text-[9px] font-black text-slate-400 uppercase cursor-help flex items-center gap-1">
                                    Calibrage AGCP
                                    <span className="bg-slate-200 text-slate-500 rounded-full w-3 h-3 flex items-center justify-center text-[8px]">?</span>
                                </label>
                            </Tooltip>
                            <div className="flex items-center gap-2 bg-white p-1 rounded border border-slate-200 shadow-sm">
                                <select 
                                    value={project.inverterConfig.agcpValue || ''} 
                                    onChange={(e) => updateInverterConfig({ agcpValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                    className="h-7 text-sm font-black text-center text-purple-700 outline-none bg-transparent cursor-pointer"
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="">--</option>
                                    {agcpOptions.map(val => (
                                        <option key={val} value={val}>{val}</option>
                                    ))}
                                </select>
                                <span className="text-[10px] font-bold text-slate-400 pr-1">A</span>
                            </div>

                            <div className="mt-1 text-right text-[10px] leading-tight">
                                {subscriptionStatus.subscribedKva == null ? (
                                    <span className="text-slate-400 font-bold">Renseigner l'AGCP pour estimer l'abonnement client</span>
                                ) : (
                                    <div className="space-y-0.5">
                                        <div className="font-black text-slate-600">
                                            Abonnement estimé : <span className="text-purple-700">{subscriptionStatus.subscribedKva} kVA</span>
                                        </div>
                                        {subscriptionStatus.recommendedKva ? (
                                            <div className={`${subscriptionStatus.isOk ? 'text-green-700' : 'text-red-700'} font-bold`}>
                                                {subscriptionStatus.isOk ? '✔ Abonnement compatible' : `✖ À faire évoluer (mini conseillé : ${subscriptionStatus.recommendedKva} kVA)`}
                                            </div>
                                        ) : (
                                            <div className="text-orange-700 font-bold">Vérification indisponible (puissance projet non définie)</div>
                                        )}
                                        {subscriptionStatus.isOverMaxForPhase && (
                                            <div className="text-orange-700 font-bold">Dépasse la limite {subscriptionStatus.phase === 'Mono' ? '12 kVA en mono' : '36 kVA en tri'} (sous réserve compatibilité site)</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {project.inverterConfig.hasBattery && (
                        <div className="mb-4 animate-scale-in">
                            <select value={project.inverterConfig.batteryModel || ''} onChange={(e) => updateInverterConfig({ batteryModel: e.target.value })} className="w-full p-2 border rounded-lg text-xs font-black bg-blue-50 border-blue-200 text-blue-700">
                                <option value="">-- Choisir Batterie --</option>
                                {foxBatteries.map(b => <option key={b.id} value={b.id}>{b.description}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-1 mb-3">
                        <button onClick={() => updateInverterConfig({ phase: 'Mono', model: '' })} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Mono' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>Mono</button>
                        <button onClick={() => updateInverterConfig({ phase: 'Tri', model: '' })} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Tri' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>Tri</button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <select value={project.inverterConfig.brand} onChange={(e) => {
                            updateInverterConfig({ brand: e.target.value as any, model: '' });
                        }} className="w-full p-2 border rounded-lg text-xs font-black focus:ring-2 focus:ring-purple-200 outline-none">
                            <option value="None">Aucun Onduleur</option>
                            <option value="Enphase">Enphase (Micro)</option>
                            <option value="APSystems">APSystems (Micro)</option>
                            <option value="FoxESS">FoxESS (central/hyb/micro)</option>
                            <option value="Custom">Onduleur Personnalisé</option>
                        </select>
                        {isCustomInverter && (
                            <button onClick={() => setShowCustomInverterModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all shrink-0">
                                <SettingsIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {(project.inverterConfig.brand !== 'None' && project.inverterConfig.brand !== 'Custom') && (
                        <div className="space-y-3">
                            <select value={project.inverterConfig.model} onChange={(e) => {
                                updateInverterConfig({ model: e.target.value });
                            }} className="w-full p-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-200 outline-none">
                                <option value="">-- Sélectionner Modèle --</option>
                                {(Object.values(inverterDB) as SolarComponent[]).filter(c => {
                                    const brand = project.inverterConfig.brand;
                                    const brandPrefix = brand === 'FoxESS' ? 'FOX' : (brand === 'Enphase' ? 'ENP' : 'APS');
                                    const isBattery = c.id.includes('ECS') || c.id.includes('EP') || c.id.includes('EQ') || c.id.includes('MIRA');
                                    if (c.id === GENERIC_INVERTER.id) return false; 
                                    if (isBattery) return false;
                                    if (!c.id.startsWith(brandPrefix)) return false;
                                    const excludedModels = ['FOX-H1-3.7-E-G2', 'FOX-KH7', 'FOX-KH9', 'FOX-T10-G3-TRI', 'FOX-T15-G3-TRI', 'FOX-T20-G3-TRI', 'FOX-H3-10.0-E', 'FOX-H3-12.0-E'];
                                    if (excludedModels.includes(c.id)) return false;
                                    const isAccessory = /\b(cable|câble|cap|relay|term|conn|bouchon|terminaison|relais|rallonge|envoy|ct-100|SMG666|DDSU|DTSU|bus|q-cable|AC-7\.0|AC-22\.0)\b/i.test(c.id) || /\b(câble|cable|bouchon|terminaison|relais|connecteur|passerelle|transformateur|compteur|embout|bus|borne|recharge)\b/i.test(c.description.toLowerCase());
                                    if (isAccessory) return false;
                                    if (brand === 'FoxESS') {
                                        const isMicro = c.id.includes('MICRO');
                                        const isTriModel = c.id.includes('P3') || c.id.includes('H3') || c.id.includes('TRI') || c.id.includes('FOX-T');
                                        if (isMicro) return true;
                                        if (project.inverterConfig.phase === 'Tri') return isTriModel;
                                        else return !isTriModel;
                                    }
                                    return true;
                                }).sort((a,b) => a.description.localeCompare(b.description)).map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                            </select>
                        </div>
                    )}
                    
                    {project.inverterConfig.brand !== 'None' && (
                        <div className="mt-3 space-y-3">
                            {((project.inverterConfig.brand === 'FoxESS' && !project.inverterConfig.model?.includes('MICRO')) || isCustomInverter) && project.inverterConfig.model && !isMicroSystem && (
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm animate-scale-in">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Configuration des Chaînes DC</label>
                                        <div className="flex items-center gap-2">
                                            <div className={`px-2 py-0.5 rounded border text-[10px] font-black flex items-center gap-1 ${assignmentComplete ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                                <span>{totalPanelsAssigned} / {totalPanelsToInstall} Pan.</span>
                                                {assignmentComplete ? <span>__CHECK__</span> : <span>__WARN__</span>}
                                            </div>
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100">
                                                {maxMpptAvailable} MPPT
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {Array.from({ length: maxMpptAvailable }).map((_, mpptIdx) => {
                                            const currentMppt = mpptIdx + 1;
                                            const segments = (project.inverterConfig.configuredStrings || []).filter(s => (s.mpptIndex || 1) === currentMppt);
                                            const panelsOnMppt = segments.reduce((acc, s) => acc + s.panelCount, 0);
                                            const runForMppt = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === currentMppt);
                                            const parallelStrings = Math.max(1, Math.round(Number((runForMppt as any)?.parallelStrings ?? 1) || 1));
                                            return (
                                                <div key={currentMppt} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-black text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded">MPPT {currentMppt}</span>
                                                        <span className="text-[9px] font-bold text-slate-500">{panelsOnMppt} Panneaux Total{parallelStrings > 1 ? ` · x${parallelStrings} //` : ''}</span>
                                                    </div>

                                                    {/* Option avancée : strings en parallèle (courant s'additionne, tension inchangée) */}
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <label className="flex items-center gap-2 text-[9px] font-bold text-slate-600">
                                                            <input
                                                                type="checkbox"
                                                                checked={parallelStrings > 1}
                                                                onChange={(e) => {
                                                                    const enable = e.target.checked;
                                                                    const nextParallel = enable ? 2 : 1;
                                                                    setProject(prev => {
                                                                        const existing = (prev.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === currentMppt);
                                                                        const runs = [...(prev.inverterConfig.dcCablingRuns || [])].filter(r => r.mpptIndex !== currentMppt);
                                                                        runs.push({
                                                                            mpptIndex: currentMppt,
                                                                            lengthM: existing?.lengthM ?? 0,
                                                                            sectionMm2: existing?.sectionMm2 ?? null,
                                                                            parallelStrings: nextParallel
                                                                        });
                                                                        return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                                    });
                                                                }}
                                                                className="accent-purple-600"
                                                            />
                                                            Strings en //
                                                        </label>

                                                        {parallelStrings > 1 && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-slate-400">Nb :</span>
                                                                <select
                                                                    value={parallelStrings}
                                                                    onChange={(e) => {
                                                                        const nextParallel = Math.max(2, Math.min(4, parseInt(e.target.value) || 2));
                                                                        setProject(prev => {
                                                                            const existing = (prev.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === currentMppt);
                                                                            const runs = [...(prev.inverterConfig.dcCablingRuns || [])].filter(r => r.mpptIndex !== currentMppt);
                                                                            runs.push({
                                                                                mpptIndex: currentMppt,
                                                                                lengthM: existing?.lengthM ?? 0,
                                                                                sectionMm2: existing?.sectionMm2 ?? null,
                                                                                parallelStrings: nextParallel
                                                                            });
                                                                            return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                                        });
                                                                    }}
                                                                    className="text-[10px] font-black bg-white border border-slate-200 rounded px-2 py-1"
                                                                >
                                                                    <option value={2}>2</option>
                                                                    <option value={3}>3</option>
                                                                    <option value={4}>4</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 mb-2">
                                                        ℹ️ En parallèle : <b>le courant s’additionne</b>, la <b>tension reste identique</b>.
                                                    </div>
                                                    <div className="space-y-2 mb-2">
                                                        {segments.map((seg, idx) => (
                                                            <div key={seg.id} className="flex gap-2 items-center bg-white p-1.5 rounded border border-slate-100 shadow-sm">
                                                                <select 
                                                                    value={seg.fieldId} 
                                                                    onChange={(e) => updateString(seg.id, { fieldId: e.target.value })}
                                                                    className="flex-1 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded p-1"
                                                                >
                                                                    {project.fields.map(f => (
                                                                        <option key={f.id} value={f.id}>
                                                                            {f.name} ({getPanelCount(f.panels)} Pan.)
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[8px] font-bold text-slate-400">QTE:</span>
                                                                    <input 
                                                                        type="number" 
                                                                        value={seg.panelCount} 
                                                                        min="1"
                                                                        onChange={(e) => updateString(seg.id, { panelCount: parseInt(e.target.value) || 0 })}
                                                                        className="w-10 text-[10px] font-bold text-center bg-slate-50 border border-slate-200 rounded p-1"
                                                                    />
                                                                </div>
                                                                <button onClick={() => removeString(seg.id)} className="text-red-300 hover:text-red-500 p-1">
                                                                    <DeleteIcon className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button 
                                                        onClick={() => addSegmentToMppt(currentMppt)}
                                                        className="w-full py-1 text-[9px] font-bold text-purple-600 border border-dashed border-purple-200 hover:bg-purple-50 rounded transition-colors"
                                                    >
                                                        + Ajouter une source
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {isMicroSystem && project.inverterConfig.model && (
                                <MicroBranchesConfig
                                    project={project}
                                    microPowerVA={invSpecs?.maxAcPower || 0}
                                    onUpdate={(branches) => updateInverterConfig({ microBranches: branches })}
                                />
                            )}
                            

                            {!isMicroSystem && project.inverterConfig.configuredStrings && project.inverterConfig.configuredStrings.length > 0 && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-1 mb-2">
                                        <Tooltip
                                            content={
                                                <div className="text-left leading-snug">
                                                    <b>Câblage DC (m)</b>
                                                    <div className="mt-1">
                                                        Distance (aller) entre le <b>générateur PV</b> (chaîne / MPPT) et le <b>coffret DC / onduleur</b>.
                                                        Utilisée pour estimer la <b>chute de tension DC</b> par MPPT.
                                                    </div>
                                                </div>
                                            }
                                            position="top"
                                        >
                                            <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                Câblage DC (m)
                                                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 text-[10px] leading-none">?</span>
                                            </span>
                                        </Tooltip>
                                    </div>

                                    <div className="space-y-2">
                                        {Array.from(new Set(project.inverterConfig.configuredStrings.map(s => s.mpptIndex))).sort((a,b)=>a-b).map((mpptIndex) => {
                                            const row = (dcMpptDrops.rows || []).find((r: any) => Number(r.mpptIndex) === Number(mpptIndex)) || { mpptIndex, L: 0, V: 0, I: 0, autoS: 2.5, autoDup: 0, forcedS: null, effectiveS: 2.5, dup: 0, status: 'ok' };
                                            const dup = Number(row.dup || 0);
                                            const statusColor = dup > 3 ? 'text-red-700' : (dup > 1 ? 'text-amber-700' : 'text-slate-700');
                                            const forced = row.forcedS != null;
                                            return (
                                                <div key={mpptIndex} className="bg-white rounded-lg border border-slate-200 p-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[10px] font-black text-slate-600 whitespace-nowrap">MPPT {mpptIndex}</div>
                                                        <div className="text-[10px] font-black text-slate-500">
                                                            ΔU ≈{' '}
                                                            <span className={statusColor}>{dup.toFixed(2)}%</span>
                                                            {forced && (
                                                              <span className="ml-2 text-[9px] font-black text-indigo-600">(forcé)</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <label className="text-[9px] font-bold text-slate-400">
                                                            Longueur (m)
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={row.L}
                                                                onChange={(e) => {
                                                                    const lengthM = Math.max(0, parseFloat(e.target.value) || 0);
                                                                    setProject(prev => {
                                                                        const runs = [...(prev.inverterConfig.dcCablingRuns || [])].filter(r => r.mpptIndex !== mpptIndex);
                                                                        const existing = (prev.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mpptIndex);
                                                                        runs.push({ mpptIndex, lengthM, sectionMm2: existing?.sectionMm2 ?? null, parallelStrings: (existing as any)?.parallelStrings ?? 1 });
                                                                        return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                                    });
                                                                }}
                                                                className="mt-1 w-full p-1 rounded border border-slate-200 text-[11px] font-black text-purple-700"
                                                            />
                                                        </label>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400">
                                                                Section (mm²)
                                                                <select
                                                                    value={row.effectiveS}
                                                                    onChange={(e) => {
                                                                        const sectionMm2 = parseFloat(e.target.value);
                                                                        setProject(prev => {
                                                                            const runs = [...(prev.inverterConfig.dcCablingRuns || [])].filter(r => r.mpptIndex !== mpptIndex);
                                                                            const existing = (prev.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mpptIndex);
                                                                            runs.push({ mpptIndex, lengthM: existing?.lengthM || 0, sectionMm2: Number.isFinite(sectionMm2) ? sectionMm2 : null, parallelStrings: (existing as any)?.parallelStrings ?? 1 });
                                                                            return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                                        });
                                                                    }}
                                                                    className="mt-1 w-full p-1 rounded border border-slate-200 text-[11px] font-black text-slate-700"
                                                                >
                                                                    {DC_SECTIONS.map(s => (
                                                                        <option key={s} value={s}>{s}</option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                className="mt-2 w-full px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                                                                title="Revenir en mode automatique (section recommandée)"
                                                                onClick={() => {
                                                                    setProject(prev => {
                                                                        const runs = [...(prev.inverterConfig.dcCablingRuns || [])].filter(r => r.mpptIndex !== mpptIndex);
                                                                        const existing = (prev.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mpptIndex);
                                                                        runs.push({ mpptIndex, lengthM: existing?.lengthM || 0, sectionMm2: null, parallelStrings: (existing as any)?.parallelStrings ?? 1 });
                                                                        return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                                    });
                                                                }}
                                                            >
                                                                Auto
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {forced && Number(row.effectiveS) !== Number(row.autoS) && (
                                                      <div className="mt-1 text-[10px] font-black text-amber-700">
                                                        ⚠️ Section forcée (estimation devis). Auto recommandé : {row.autoS}mm² (ΔU {Number(row.autoDup || 0).toFixed(2)}%).
                                                      </div>
                                                    )}

                                                    {dup > 3 && (
                                                      <div className="mt-2 text-[10px] font-black text-red-700">
                                                        ⚠ ΔU &gt; 3% : dangereux → export bloqué
                                                      </div>
                                                    )}
                                                    {dup > 1 && dup <= 3 && (
                                                      <div className="mt-2 text-[10px] font-black text-amber-700">
                                                        ⚠ ΔU entre 1% et 3% : toléré mais à surveiller ({dup <= 1.5 ? 'léger' : dup <= 2.5 ? 'modéré' : 'élevé'}). Viser ≤ 1%.
                                                      </div>
                                                    )}

                                                    <div className="text-[8px] text-slate-400 font-bold italic mt-1">Panneaux → coffret DC / onduleur</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <details className="bg-slate-50 p-2 rounded-lg border border-slate-200" open>
                              <summary className="cursor-pointer select-none text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                Câblage AC
                                <span className="text-[10px] font-black text-slate-400">(déplier)</span>
                              </summary>

                              {/* AC1 : onduleur centralisé uniquement */}
                              {isCentralInverter && (
                                <div className="mt-3 p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <Tooltip
                                      content={
                                        <div className="text-left leading-snug">
                                          <b>Tronçon AC1 (m)</b>
                                          <div className="mt-1">
                                            Distance entre la <b>sortie AC de l'onduleur</b> et le <b>coffret AC photovoltaïque</b>.
                                            <div className="mt-1 text-[9px]">Le disjoncteur associé est celui <b>intégré au coffret AC</b> (calibrage par puissance max onduleur).</div>
                                          </div>
                                        </div>
                                      }
                                      position="top"
                                    >
                                      <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        Section AC – Tronçon 1 (Onduleur → Coffret)
                                        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 text-[10px] leading-none">?</span>
                                      </span>
                                    </Tooltip>
                                    <div className="text-[10px] font-black text-slate-600">Disj. coffret ≈ {ac1BreakerNormalizedA}A</div>
                                  </div>

                                  <input
                                    type="number"
                                    value={project.distanceInverterToAcCoffret}
                                    onChange={(e) => setProject(p => ({ ...p, distanceInverterToAcCoffret: parseFloat(e.target.value) || 0 }))}
                                    className="w-full p-1 border-none bg-transparent text-sm font-black text-purple-700 outline-none"
                                    min="1"
                                  />

                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="text-[10px] font-extrabold text-slate-500">Section</div>
                                    <select
                                      className="flex-1 p-1 rounded-lg border border-slate-200 bg-white text-[11px] font-black text-slate-700"
                                      value={(project.ac1CableSectionMm2 ?? autoAc1CableSection) as any}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setProject(p => ({ ...p, ac1CableSectionMm2: Number.isFinite(v) ? v : null }));
                                      }}
                                    >
                                      {[2.5, 6, 10, 16, 25].map(s => (
                                        <option key={s} value={s}>{s} mm²</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                                      title="Revenir en mode automatique (section recommandée)"
                                      onClick={() => setProject(p => ({ ...p, ac1CableSectionMm2: null }))}
                                    >
                                      Auto
                                    </button>
                                  </div>

                                  <div className="text-[10px] text-slate-500 font-bold mt-1">
                                    ΔU (tronçon AC1) ≈{' '}
                                    <span className={`${ac1VoltageDropPercent > 3 ? 'text-red-700' : (ac1VoltageDropPercent > 1 ? 'text-amber-700' : 'text-slate-700')}`}>
                                      {ac1VoltageDropPercent.toFixed(2)}%
                                    </span>
                                    {project.ac1CableSectionMm2 && (
                                      <span className="ml-2 text-[9px] font-black text-indigo-600">(forcé)</span>
                                    )}
                                  </div>

                                  {ac1ProtectionStatus === 'info' && (
                                    <div className="mt-1 text-[10px] font-black text-amber-700">
                                      🟠 Information — conditions de pose : la section {effectiveAc1CableSection}mm² est conforme en conditions usuelles avec {ac1BreakerNormalizedA}A.
                                      <span className="font-bold"> Vérifier</span> en cas de pose défavorable (encastrée, température élevée, regroupement).
                                    </div>
                                  )}
                                  {ac1ProtectionStatus === 'danger' && (
                                    <div className="mt-1 text-[10px] font-black text-red-700">
                                      ⚠ Non conforme : protection {ac1BreakerNormalizedA}A trop élevée pour {effectiveAc1CableSection}mm² (augmenter la section ou revoir la protection).
                                    </div>
                                  )}

                                  {project.ac1CableSectionMm2 && effectiveAc1CableSection !== autoAc1CableSection && (
                                    <div className="mt-1 text-[10px] font-black text-amber-700">
                                      ⚠️ Section forcée (estimation devis). Auto recommandé : {autoAc1CableSection}mm² (ΔU {autoAc1VoltageDropPercent.toFixed(2)}%).
                                    </div>
                                  )}

                                  {ac1VoltageDropPercent > 3 && (
                                    <div className="mt-2 text-[10px] font-black text-red-700">⚠ ΔU &gt; 3% : dangereux → export bloqué</div>
                                  )}
                                  {ac1VoltageDropPercent > 1 && ac1VoltageDropPercent <= 3 && (
                                    <div className="mt-2 text-[10px] font-black text-amber-700">
                                      ⚠ ΔU entre 1% et 3% : toléré mais à surveiller ({ac1VoltageDropPercent <= 1.5 ? 'léger' : ac1VoltageDropPercent <= 2.5 ? 'modéré' : 'élevé'}). Viser ≤ 1%.
                                    </div>
                                  )}

                                  <div className="text-[8px] text-slate-400 font-bold italic mt-1">Onduleur → coffret AC (disjoncteur du coffret)</div>
                                </div>
                              )}

                              {/* AC2 : toujours présent */}
                              <div className="mt-3 p-2 rounded-lg bg-white border border-slate-200">
                                <div className="flex items-center gap-1 mb-1">
                                  <Tooltip
                                    content={
                                      <div className="text-left leading-snug">
                                        <b>Tronçon AC2 (m)</b>
                                        <div className="mt-1">
                                          Distance entre le <b>coffret AC photovoltaïque</b> et le <b>point de raccordement</b>
                                          (tableau principal / disjoncteur de branchement). Utilisée pour la chute de tension AC.
                                        </div>
                                      </div>
                                    }
                                    position="top"
                                  >
                                    <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                      Section AC – Tronçon 2 (Coffret → Tableau)
                                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 text-[10px] leading-none">?</span>
                                    </span>
                                  </Tooltip>
                                </div>

                                <input
                                  type="number"
                                  value={project.distanceToPanel}
                                  onChange={(e) => setProject(p => ({ ...p, distanceToPanel: parseFloat(e.target.value) || 0 }))}
                                  className="w-full p-1 border-none bg-transparent text-sm font-black text-purple-700 outline-none"
                                  min="1"
                                />

                                <div className="mt-2 flex items-center gap-2">
                                  <div className="text-[10px] font-extrabold text-slate-500">Section</div>
                                  <select
                                    className="flex-1 p-1 rounded-lg border border-slate-200 bg-white text-[11px] font-black text-slate-700"
                                    value={(project.acCableSectionMm2 ?? autoAcCableSection) as any}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value);
                                      setProject(p => ({ ...p, acCableSectionMm2: Number.isFinite(v) ? v : null }));
                                    }}
                                  >
                                    {[2.5, 6, 10, 16, 25].map(s => (
                                      <option key={s} value={s}>{s} mm²</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                                    title="Revenir en mode automatique (section recommandée)"
                                    onClick={() => setProject(p => ({ ...p, acCableSectionMm2: null }))}
                                  >
                                    Auto
                                  </button>
                                </div>

                                <div className="text-[10px] text-slate-500 font-bold mt-1">
                                  ΔU (liaison tableau) ≈{' '}
                                  <span className={`${effectiveAcVoltageDropPercent > 3 ? 'text-red-700' : (effectiveAcVoltageDropPercent > 1 ? 'text-amber-700' : 'text-slate-700')}`}>
                                    {effectiveAcVoltageDropPercent.toFixed(2)}%
                                  </span>
                                  {project.acCableSectionMm2 && (
                                    <span className="ml-2 text-[9px] font-black text-indigo-600">(forcé)</span>
                                  )}
                                </div>

                                {acSectionOrderViolation && (
                                  <div className="mt-1 text-[10px] font-black text-red-700">
                                    ❌ Non conforme : la section AC2 ({effectiveAcCableSection} mm²) doit être ≥ AC1 ({effectiveAc1CableSection} mm²) en onduleur centralisé.
                                  </div>
                                )}

                                {acProtectionStatus === 'info' && (
                                  <div className="mt-1 text-[10px] font-black text-amber-700">
                                    🟠 Information — conditions de pose : la section {effectiveAcCableSection}mm² est conforme en conditions usuelles avec {acBreakerNormalizedA}A.
                                    <span className="font-bold"> Vérifier</span> en cas de pose défavorable (encastrée, température élevée, regroupement).
                                  </div>
                                )}
                                {acProtectionStatus === 'danger' && (
                                  <div className="mt-1 text-[10px] font-black text-red-700">
                                    ⚠ Non conforme : protection {acBreakerNormalizedA}A trop élevée pour {effectiveAcCableSection}mm² (augmenter la section ou revoir la protection).
                                  </div>
                                )}
                                {project.acCableSectionMm2 && effectiveAcCableSection !== autoAcCableSection && (
                                  <div className="mt-1 text-[10px] font-black text-amber-700">
                                    ⚠️ Section forcée (estimation devis). Auto recommandé : {autoAcCableSection}mm² (ΔU {autoAcVoltageDropPercent.toFixed(2)}%).
                                  </div>
                                )}

                                {effectiveAcVoltageDropPercent > 3 && (
                                  <div className="mt-2 text-[10px] font-black text-red-700">⚠ ΔU &gt; 3% : dangereux → export bloqué</div>
                                )}
                                {effectiveAcVoltageDropPercent > 1 && effectiveAcVoltageDropPercent <= 3 && (
                                  <div className="mt-2 text-[10px] font-black text-amber-700">
                                    ⚠ ΔU entre 1% et 3% : toléré mais à surveiller ({effectiveAcVoltageDropPercent <= 1.5 ? 'léger' : effectiveAcVoltageDropPercent <= 2.5 ? 'modéré' : 'élevé'}). Viser ≤ 1%.
                                  </div>
                                )}

                                <div className="text-[8px] text-slate-400 font-bold italic mt-1">Coffret AC → point de raccordement</div>
                              </div>

                            </details>

                        </div>
                    )}
                </div>

                {/* 4. BLOC BORNE DE RECHARGE */}
                <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-green-500 animate-scale-in">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs">Borne de Recharge</h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={project.evCharger.selected} onChange={(e) => setProject(p => ({...p, evCharger: {...p.evCharger, selected: e.target.checked}}))} className="sr-only peer"/>
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                    {project.evCharger.selected && (
                        <div className="space-y-3 animate-scale-in">
                            <div className="text-[11px] font-black text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                                ⚠️ Borne VE sélectionnée : prévoir un circuit dédié (NF C 15-100) et vérifier la puissance souscrite / protections (DDR adapté selon borne).
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setProject(p => ({...p, evCharger: {...p.evCharger, phase: 'Mono', cableRef: !!p.evCharger.cableRef ? '15254' : undefined}}))} 
                                    disabled={project.inverterConfig.phase === 'Tri'}
                                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Tri' ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-300' : (project.evCharger.phase === 'Mono' ? 'bg-green-100 border-green-500 text-green-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200')}`}
                                >
                                    7 kW (Mono)
                                </button>
                                <button 
                                    onClick={() => {
                                        if (project.inverterConfig.phase === 'Tri') {
                                            setProject(p => ({...p, evCharger: {...p.evCharger, phase: 'Tri', cableRef: !!p.evCharger.cableRef ? '15264' : undefined}}))
                                        }
                                    }} 
                                    disabled={project.inverterConfig.phase === 'Mono'}
                                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Mono' ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-300' : (project.evCharger.phase === 'Tri' ? 'bg-green-100 border-green-500 text-green-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200')}`}
                                >
                                    22 kW (Tri)
                                </button>
                            </div>
                            
                            {/* SÉLECTEUR DE CÂBLE RÉTABLI */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={!!project.evCharger.cableRef} 
                                        onChange={(e) => {
                                            const defaultCable = project.evCharger.phase === 'Tri' ? '15264' : '15254';
                                            const cable = e.target.checked ? defaultCable : undefined;
                                            setProject(p => ({...p, evCharger: {...p.evCharger, cableRef: cable}}));
                                        }} 
                                        className="w-4 h-4 rounded border-slate-300 text-green-600" 
                                    />
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-green-700 transition-colors">Ajouter le câble de charge</span>
                                </label>
                                
                                {!!project.evCharger.cableRef && (
                                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2 animate-scale-in">
                                        {project.evCharger.phase === 'Tri' ? (
                                            <div className="text-[10px] font-bold text-green-700 text-center uppercase tracking-tighter">
                                                Câble T2 22kW (Inclus par défaut en Tri)
                                            </div>
                                        ) : (
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setProject(p => ({...p, evCharger: {...p.evCharger, cableRef: '15254'}}))}
                                                    className={`flex-1 py-1 px-1 text-[8px] font-black uppercase rounded border transition-all ${project.evCharger.cableRef === '15254' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white text-slate-400 border-slate-200'}`}
                                                >
                                                    Câble Mono 7kW
                                                </button>
                                                <button 
                                                    onClick={() => setProject(p => ({...p, evCharger: {...p.evCharger, cableRef: '15264'}}))}
                                                    className={`flex-1 py-1 px-1 text-[8px] font-black uppercase rounded border transition-all ${project.evCharger.cableRef === '15264' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white text-slate-400 border-slate-200'}`}
                                                >
                                                    Câble polyvalent (Mono jusqu'à 7kW et Triphasé jusqu'à 22kW)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="lg:col-span-9 space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-md">
                    <RoofVisualizer 
                        roof={activeField.roof} 
                        panels={activeField.panels} 
                        roofName={activeField.name} 
                    />
                </div>
                
                <CalculationAudit 
                    project={project} 
                    report={compatibilityReport}
                    totalPowerW={totalPowerW}
                    voltageDrop={effectiveAcVoltageDropPercent}
                    acSection={effectiveAcCableSection}
                    microBranchesReport={microBranchesReport}
                    acProtectionTooHigh={acProtectionTooHigh}
                    recommendedBreaker={acBreakerMinA}
                />

                <BillOfMaterials 
                    materials={materials} 
                    project={project} 
                    onUpdate={handleUpdateMaterials} 
                    report={compatibilityReport} 
                    voltageDrop={effectiveAcVoltageDropPercent}
                    acSection={effectiveAcCableSection} 
                    microBranchesReport={microBranchesReport}
                    showAc1={isCentralInverter}
                    ac1VoltageDrop={ac1VoltageDropPercent}
                    ac1Section={effectiveAc1CableSection}
                    ac1BreakerA={ac1BreakerNormalizedA}
                    isCableProtectionOk={!acProtectionTooHigh}
                />
            </div>
        </div>
      </main>
      
      {showWindGuide && <WindGuideModal onClose={() => setShowWindGuide(false)} />}
      {showCustomPanelModal && <CustomPanelModal initialPanel={activeField.panels.model} onSave={(p) => { setProject(prev => { const f = [...prev.fields]; f[activeFieldIndex].panels.model = p; return {...prev, fields: f}; }); setShowCustomPanelModal(false); }} onClose={() => setShowCustomPanelModal(false)} />}
      {showCustomInverterModal && (
          <CustomInverterModal 
            initialInverter={activeInverterComp || { ...GENERIC_INVERTER, description: 'Nouvel Onduleur' }} 
            initialPhase={project.inverterConfig.phase || 'Mono'}
            onSave={(inv, phase) => {
                const newDB = { ...inverterDB };
                if (inv.id === 'OND-PERSO') {
                    newDB['OND-PERSO'] = inv;
                }
                setInverterDB(newDB);
                updateInverterConfig({ brand: 'Custom', model: inv.id, phase: phase });
                setShowCustomInverterModal(false);
            }} 
            onClose={() => setShowCustomInverterModal(false)} 
          />
      )}
    </div>
  );
}

export default App;
