// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Project, RoofType, WindZone, InverterBrand, Material, 
  Component as SolarComponent, InverterElectricalSpecs, Panel 
} from './types';
import { 
  calculateBillOfMaterials, 
  calculateAcCableSection, 
  calculateDcCableSection, 
  calculateVoltageDropPercent 
} from './services/calculatorService';
import { getLocationClimate } from './services/climateService';
import { getWindZone } from './services/windZoneService';
import { getRecommendedMargins } from './services/standardsService';
import { checkElectricalCompatibility } from './services/compatibilityService';
import { subscribeToData, loginAdmin, logoutAdmin } from './services/firebase';

// Defaults
import { K2_COMPONENTS_DEFAULT, ESDEC_COMPONENTS_DEFAULT } from './data/k2components';
import { ENPHASE_COMPONENTS, APSYSTEMS_COMPONENTS, FOXESS_COMPONENTS, MADENR_COMPONENTS } from './data/inverters';
import { DMEGC_PANELS, GENERIC_PANEL } from './data/panels';
import { DEFAULT_CABLES } from './data/cables';

// UI
import RoofVisualizer from './components/RoofVisualizer';
import BillOfMaterials from './components/BillOfMaterials';
import AdminPage from './components/AdminPage';
import Tooltip from './components/Tooltip';
import WindGuideModal from './components/WindGuideModal';
import { SettingsIcon, NewIcon } from './components/icons';
import CalculationAudit from './components/CalculationAudit';

// --- INITIAL STATE ---
const INITIAL_PANEL_DB: Record<string, SolarComponent> = {};
DMEGC_PANELS.forEach(p => {
    INITIAL_PANEL_DB[p.name] = {
        id: p.name, description: p.name, unit: 'piece', price: p.price || '',
        width: p.width, height: p.height, power: p.power, electrical: p.electrical,
        imageUrl: p.imageUrl, datasheetUrl: p.datasheetUrl, manualUrl: p.manualUrl
    };
});
INITIAL_PANEL_DB[GENERIC_PANEL.name] = { id: GENERIC_PANEL.name, description: GENERIC_PANEL.name, unit: 'piece', price: '', width: GENERIC_PANEL.width, height: GENERIC_PANEL.height, power: GENERIC_PANEL.power, electrical: GENERIC_PANEL.electrical };

const DEFAULT_PROJECT: Project = {
  id: 'proj-001', name: 'Nouveau Projet', clientAddress: '', city: '', postalCode: '', windZone: WindZone.ZONE_1, distanceToPanel: 10,
  system: { brand: 'K2', railOrientation: 'Horizontal' },
  inverterConfig: { brand: InverterBrand.NONE, model: 'Auto', stringsCount: 1, phase: 'Mono', hasBattery: false, hasBackup: false },
  fields: [{ id: 'f1', name: 'Toiture 1', roof: { width: 10, height: 5, pitch: 30, pitchUnit: 'deg', type: RoofType.TUILE_MECANIQUE, margins: { top: 300, bottom: 300, left: 300, right: 300 } }, panels: { model: DMEGC_PANELS[1], orientation: 'Portrait', rows: 2, columns: 5 } }]
};

export function App() {
  const [k2DB, setK2DB] = useState<Record<string, SolarComponent>>(K2_COMPONENTS_DEFAULT);
  const [esdecDB, setEsdecDB] = useState<Record<string, SolarComponent>>(ESDEC_COMPONENTS_DEFAULT);
  const [inverterDB, setInverterDB] = useState<Record<string, SolarComponent>>({ ...ENPHASE_COMPONENTS, ...APSYSTEMS_COMPONENTS, ...FOXESS_COMPONENTS });
  const [panelDB, setPanelDB] = useState<Record<string, SolarComponent>>(INITIAL_PANEL_DB);
  const [boxDB, setBoxDB] = useState<Record<string, SolarComponent>>(MADENR_COMPONENTS);
  const [cableDB, setCableDB] = useState<Record<string, SolarComponent>>(DEFAULT_CABLES);

  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [view, setView] = useState<'calculator' | 'admin'>('calculator');
  const [showWindGuide, setShowWindGuide] = useState(false);
  const [showCpWarning, setShowCpWarning] = useState(false);
  const [showWindWarning, setShowWindWarning] = useState(false);

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

  const validateCP = () => {
    if (!project.postalCode || project.postalCode.trim().length < 2) {
      setShowCpWarning(true);
      return false;
    }
    return true;
  };

  const projectClimate = useMemo(() => getLocationClimate(project.postalCode), [project.postalCode]);
  
  useEffect(() => { 
    if (project.postalCode.length >= 2) {
      const newZone = getWindZone(project.postalCode);
      setProject(prev => ({ ...prev, windZone: newZone }));
    }
  }, [project.postalCode]);

  useEffect(() => {
    if (project.windZone === WindZone.ZONE_4 || project.windZone === WindZone.ZONE_5) {
      setShowWindWarning(true);
      const timer = setTimeout(() => {
        setShowWindWarning(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setShowWindWarning(false);
    }
  }, [project.windZone]);

  useEffect(() => {
      const recommended = getRecommendedMargins(project.fields[activeFieldIndex].roof.type, project.windZone);
      setProject(prev => {
          const newFields = [...prev.fields];
          // On ne met à jour que si les marges sont celles par défaut (300)
          if (newFields[activeFieldIndex].roof.margins.top === 300) {
              newFields[activeFieldIndex].roof.margins = recommended;
          }
          return { ...prev, fields: newFields };
      });
  }, [project.windZone, project.fields[activeFieldIndex].roof.type]);

  useEffect(() => {
    const activeComponents = project.system.brand === 'ESDEC' ? esdecDB : k2DB;
    let globalBOM: Material[] = [];
    project.fields.forEach(field => {
        const fieldBOM = calculateBillOfMaterials(field, activeComponents as any, project.system, inverterDB as any, cableDB as any, project.inverterConfig);
        fieldBOM.forEach(item => {
            const existing = globalBOM.find(i => i.id === item.id);
            if (existing) existing.quantity += item.quantity;
            else globalBOM.push({ ...item });
        });
    });

    const totalPowerW = project.fields.reduce((sum, f) => sum + (f.panels.model.power * f.panels.rows * f.panels.columns), 0);
    const isThreePhase = project.inverterConfig.phase === 'Tri';
    
    const acCable = calculateAcCableSection(totalPowerW, project.distanceToPanel, cableDB as any, isThreePhase);
    if (acCable) globalBOM.push(acCable);
    
    if (project.inverterConfig.brand === InverterBrand.FOXESS && !project.inverterConfig.model?.includes('MICRO')) {
         let totalDc = 0; let dcComp = null;
         project.fields.forEach(field => {
             const fDc = calculateDcCableSection(field.panels.rows * field.panels.columns, project.distanceToPanel, cableDB as any);
             if (fDc) { totalDc += fDc.quantity; if (!dcComp) dcComp = fDc; }
         });
         if (dcComp) globalBOM.push({ ...dcComp, quantity: totalDc });
    }

    if (project.inverterConfig.hasBattery && project.inverterConfig.batteryModel) {
        const batComp = inverterDB[project.inverterConfig.batteryModel];
        if (batComp) {
            globalBOM.push({ id: batComp.id, description: batComp.description, quantity: 1, price: batComp.price });
        }
    }

    let boxId = '';
    const isHybrid = project.inverterConfig.model?.includes('H1') || project.inverterConfig.model?.includes('H3') || project.inverterConfig.model?.includes('KH') || project.inverterConfig.model?.includes('P3') || project.inverterConfig.hasBackup;
    if (isThreePhase) boxId = isHybrid ? 'MAD-HYB-TRI' : 'MAD-TRI-10';
    else {
         if (project.inverterConfig.brand === InverterBrand.ENPHASE) boxId = totalPowerW <= 3000 ? 'MAD-ENP-1-3' : 'MAD-ENP-3-6';
         else if (isHybrid) boxId = 'MAD-HYB-6';
         else boxId = totalPowerW <= 3000 ? 'MAD-STD-3' : 'MAD-STD-6';
    }
    const boxComp = (Object.values(boxDB) as SolarComponent[]).find((b: SolarComponent) => b.id === boxId) || (boxId ? boxDB[boxId] : undefined);
    if (boxComp) globalBOM.push({ id: boxComp.id, description: boxComp.description, quantity: 1, price: boxComp.price });

    setMaterials(globalBOM);
  }, [project, k2DB, esdecDB, inverterDB, boxDB, cableDB]);

  const totalPowerW = project.fields.reduce((sum, f) => sum + (f.panels.model.power * f.panels.rows * f.panels.columns), 0);
  const isThreePhase = project.inverterConfig.phase === 'Tri';
  const acCableMaterial = materials.find(m => m.id.includes('CABLE-RO2V'));
  let acCableSection = 2.5;
  if (acCableMaterial) {
      const match = acCableMaterial.id.match(/(\d+\.?\d*)$/);
      if (match) acCableSection = parseFloat(match[1]);
  }
  const voltageDropPercent = calculateVoltageDropPercent(totalPowerW, project.distanceToPanel, acCableSection, isThreePhase);

  const activeField = project.fields[activeFieldIndex] || project.fields[0];
  const activeInverterComp = (Object.values(inverterDB) as SolarComponent[]).find((c: SolarComponent) => c.id === project.inverterConfig.model) || null;
  
  const maxStringsAllowed = useMemo(() => {
    if (project.inverterConfig.model === 'Auto') return 2;
    const specs = activeInverterComp?.electrical as InverterElectricalSpecs;
    return specs?.maxStrings || 2;
  }, [activeInverterComp, project.inverterConfig.model]);

  useEffect(() => {
    if (project.inverterConfig.stringsCount > maxStringsAllowed) {
        updateInverterConfig({ stringsCount: maxStringsAllowed });
    }
  }, [maxStringsAllowed]);

  const compatibilityReport = useMemo(() => {
      if (!activeField) return null;
      const panelsPerRoof = project.fields.map(f => f.panels.rows * f.panels.columns);
      const totalPanelsCount = panelsPerRoof.reduce((a, b) => a + b, 0);
      
      if(totalPanelsCount === 0) return null;
      
      let activeInverter = activeInverterComp;
      if (!activeInverter && project.inverterConfig.model === 'Auto') {
        const brandPrefix = project.inverterConfig.brand === 'FoxESS' ? 'FOX' : (project.inverterConfig.brand === 'Enphase' ? 'ENP' : 'APS');
        const candidates = (Object.values(inverterDB) as SolarComponent[]).filter(c => {
            const isBrandMatch = c.id.startsWith(brandPrefix);
            const isBattery = c.id.includes('ECS') || c.id.includes('EP5') || c.id.includes('EP11');
            const isAccessory = c.id.includes('METER') || c.id.includes('WIFI') || c.id.includes('CABLE') || c.id.includes('CAP');
            return isBrandMatch && !isBattery && !isAccessory;
        });
        activeInverter = candidates.find(c => (c.power || 0) >= totalPowerW * 0.8) || candidates[0];
      }
      
      if (activeInverter && activeField.panels.model) {
          const sCount = project.inverterConfig.stringsCount || 1;
          const pPerStr = Math.ceil(totalPanelsCount / sCount);
          
          return checkElectricalCompatibility(
            activeField.panels.model, 
            activeInverter as any, 
            projectClimate, 
            pPerStr, 
            totalPanelsCount, 
            sCount,
            pPerStr,
            project.inverterConfig.configuredStrings || [],
            project.fields || [],
            project.inverterConfig.phase,
            project.inverterConfig.dcCablingRuns || []
          );
      }
      return null;
  }, [project, inverterDB, projectClimate, activeInverterComp, totalPowerW, activeField]);

  const updateInverterConfig = (updates: Partial<typeof project.inverterConfig>) => {
    setProject(prev => {
        let newConfig = { ...prev.inverterConfig, ...updates };
        if (updates.hasBackup && !prev.inverterConfig.hasBattery) {
            newConfig.hasBattery = true;
        }
        if (updates.hasBattery === false) {
            newConfig.batteryModel = undefined;
        }
        return { ...prev, inverterConfig: newConfig };
    });
  };

  if (view === 'admin') {
      return (
          <AdminPage 
            k2={k2DB as any} esdec={esdecDB as any} inverters={inverterDB as any} panels={panelDB as any} boxes={boxDB as any} cables={cableDB as any}
            onUpdateK2={setK2DB as any} onUpdateEsdec={setEsdecDB as any} onUpdateInverters={setInverterDB as any} onUpdatePanels={setPanelDB as any} onUpdateBoxes={setBoxDB as any} onUpdateCables={setCableDB as any}
            onExit={() => setView('calculator')}
          />
      );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-indigo-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-orange-500 text-3xl">■</span> Richardson Solaire <span className="text-xs bg-green-500 px-2 py-1 rounded-full">v3.0</span>
            </h1>
            <div className="flex gap-4 items-center">
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

      <main className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
            {/* BLOC PROJET */}
            <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-blue-500 relative">
                <h3 className="font-black text-slate-700 mb-4 pb-2 border-b uppercase tracking-wider text-xs text-center">Projet</h3>
                
                {showWindWarning && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 w-[90%] text-center transition-opacity duration-1000">
                        <div className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg border-2 border-white uppercase tracking-tight leading-tight animate-pulse shake">
                            ⚠️ ZONE VENT CRITIQUE (Z4/Z5)<br/>Se rapprocher des préconisations
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nom du client / Projet</label>
                        <input type="text" value={project.name} onChange={(e) => setProject(p => ({...p, name: e.target.value}))} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none font-bold" placeholder="M. Dupont"/>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Code Postal</label>
                        <input type="text" value={project.postalCode} onChange={(e) => setProject(p => ({...p, postalCode: e.target.value}))} className={`w-full p-2.5 border rounded-lg text-sm font-black text-center focus:ring-2 focus:ring-blue-200 outline-none ${project.windZone === WindZone.ZONE_4 || project.windZone === WindZone.ZONE_5 ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white'}`} placeholder="83000"/>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Vent : {project.windZone}</span>
                        <button onClick={() => validateCP() && setShowWindGuide(true)} className="text-[10px] text-blue-600 font-bold hover:underline">Voir Carte & Normes</button>
                    </div>
                </div>
            </div>

            {/* BLOC TOITURE */}
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
                        <button key={f.id} onClick={() => setActiveFieldIndex(i)} className={`px-2 py-1 text-[10px] rounded-t font-black uppercase transition-all ${activeFieldIndex === i ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-slate-400'}`}>
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

                    <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                        <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest block mb-2">Marges de sécurité (mm)</label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Haut</label>
                                <input type="number" value={activeField.roof.margins.top} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.top = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm" />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Bas</label>
                                <input type="number" value={activeField.roof.margins.bottom} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.bottom = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm" />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Gauche</label>
                                <input type="number" value={activeField.roof.margins.left} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.left = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm" />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Droite</label>
                                <input type="number" value={activeField.roof.margins.right} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].roof.margins.right = v; return {...p, fields: f}; }); }} className="w-full border-none bg-white p-1 text-center text-xs font-bold rounded shadow-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BLOC STRUCTURE (K2/ESDEC) */}
            <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-indigo-500 animate-scale-in">
                <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs mb-3">Structure</h3>
                <div className="flex gap-1 mb-3">
                    <button onClick={() => setProject(p => ({...p, system: {...p.system, brand: 'K2'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.system.brand === 'K2' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>K2 Systems</button>
                    <button onClick={() => setProject(p => ({...p, system: {...p.system, brand: 'ESDEC'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.system.brand === 'ESDEC' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>ESDEC</button>
                </div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Orientation des rails</label>
                <div className="flex gap-1">
                    <button onClick={() => setProject(p => ({...p, system: {...p.system, railOrientation: 'Horizontal'}}))} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${project.system.railOrientation === 'Horizontal' ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>Horizontal</button>
                    <button onClick={() => setProject(p => ({...p, system: {...p.system, railOrientation: 'Vertical'}}))} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${project.system.railOrientation === 'Vertical' ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>Vertical</button>
                </div>
            </div>

            {/* BLOC PANNEAUX (AVEC PORTRAIT/PAYSAGE) */}
            <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-slate-600">
                <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs mb-3">Panneaux</h3>
                <select value={activeField.panels.model.name} onClick={() => validateCP()} onChange={(e) => {
                    if (!validateCP()) return;
                    const comp = (panelDB as Record<string, SolarComponent>)[e.target.value];
                    if (comp) {
                        const p: Panel = { name: comp.id, width: comp.width!, height: comp.height!, power: comp.power!, price: comp.price || '', electrical: comp.electrical as any, imageUrl: comp.imageUrl, datasheetUrl: comp.datasheetUrl, manualUrl: comp.manualUrl };
                        setProject(prev => { const f = [...prev.fields]; f[activeFieldIndex].panels.model = p; return {...prev, fields: f}; });
                    }
                }} className="w-full p-2 border rounded-lg text-xs font-bold mb-3 focus:ring-2 focus:ring-blue-200 outline-none">
                    {(Object.values(panelDB) as SolarComponent[]).sort((a: SolarComponent, b: SolarComponent) => (a.description || "").localeCompare(b.description || "")).map((p: SolarComponent) => <option key={p.id} value={p.id}>{p.description}</option>)}
                </select>

                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sens de pose</label>
                <div className="flex gap-1 mb-4">
                    <button onClick={() => setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.orientation = 'Portrait'; return {...p, fields: f}; })} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeField.panels.orientation === 'Portrait' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>Portrait</button>
                    <button onClick={() => setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.orientation = 'Paysage'; return {...p, fields: f}; })} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeField.panels.orientation === 'Paysage' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>Paysage</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="text-center">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Lignes</label>
                        <input type="number" value={activeField.panels.rows} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.rows = v; return {...p, fields: f}; }); }} className="w-full border p-2 rounded-lg text-center font-black text-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"/>
                    </div>
                    <div className="text-center">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Colonnes</label>
                        <input type="number" value={activeField.panels.columns} onChange={(e) => { const v = parseInt(e.target.value); setProject(p => { const f = [...p.fields]; f[activeFieldIndex].panels.columns = v; return {...p, fields: f}; }); }} className="w-full border p-2 rounded-lg text-center font-black text-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"/>
                    </div>
                </div>
            </div>

            {/* BLOC ÉLECTRIQUE */}
            <div className="bg-white p-5 rounded-xl shadow-md border-t-4 border-purple-500">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs">Électrique</h3>
                    <div className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{(totalPowerW / 1000).toFixed(2)} kWc</div>
                </div>
                
                <div className="flex gap-1 mb-3">
                    <button onClick={() => setProject(p => ({...p, inverterConfig: {...p.inverterConfig, phase: 'Mono'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Mono' ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white text-slate-400'}`}>Mono</button>
                    <button onClick={() => setProject(p => ({...p, inverterConfig: {...p.inverterConfig, phase: 'Tri'}}))} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${project.inverterConfig.phase === 'Tri' ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white text-slate-400'}`}>Tri</button>
                </div>

                <select value={project.inverterConfig.brand} onClick={() => validateCP()} onChange={(e) => {
                    if (!validateCP()) return;
                    setProject(p => ({...p, inverterConfig: {...p.inverterConfig, brand: e.target.value as any, model: 'Auto'}}));
                }} className="w-full p-2 border rounded-lg text-xs font-black mb-2 focus:ring-2 focus:ring-purple-200 outline-none">
                    <option value="None">Aucun Onduleur</option>
                    <option value="Enphase">Enphase (Micro)</option>
                    <option value="APSystems">APSystems (Micro)</option>
                    <option value="FoxESS">FoxESS (Central/Hyb)</option>
                </select>

                {project.inverterConfig.brand !== 'None' && (
                    <div className="space-y-3">
                        <select value={project.inverterConfig.model} onClick={() => validateCP()} onChange={(e) => {
                            if (!validateCP()) return;
                            setProject(p => ({...p, inverterConfig: {...p.inverterConfig, model: e.target.value}}));
                        }} className="w-full p-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-200 outline-none">
                            <option value="Auto">Auto (Optimal)</option>
                            {(Object.values(inverterDB) as SolarComponent[]).filter(c => {
                                const brandPrefix = project.inverterConfig.brand === 'FoxESS' ? 'FOX' : (project.inverterConfig.brand === 'Enphase' ? 'ENP' : 'APS');
                                return c.id.startsWith(brandPrefix);
                            }).map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                        </select>
                        
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Câblage (m)</label>
                            <input type="number" value={project.distanceToPanel} onChange={(e) => setProject(p => ({...p, distanceToPanel: parseFloat(e.target.value) || 0}))} className="w-full p-1 border-none bg-transparent text-sm font-black text-purple-700 outline-none" min="1"/>
                        </div>

                        {project.inverterConfig.brand === 'FoxESS' && !project.inverterConfig.model?.includes('MICRO') && (
                            <div className="bg-white p-3 rounded-lg border-2 border-slate-100 shadow-sm animate-scale-in">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nb. de chaînes (Strings)</label>
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100">
                                        {project.inverterConfig.stringsCount || 1}
                                    </span>
                                </div>
                                <input 
                                    type="range" min="1" max={maxStringsAllowed} step="1"
                                    value={project.inverterConfig.stringsCount || 1} 
                                    onChange={(e) => updateInverterConfig({ stringsCount: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* CONTENU CENTRAL */}
        <div className="lg:col-span-9 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-md"><RoofVisualizer roof={activeField.roof} panels={activeField.panels} /></div>
            {totalPowerW > 0 && <CalculationAudit project={project} report={compatibilityReport} totalPowerW={totalPowerW} voltageDrop={voltageDropPercent} acSection={acCableSection} />}
            <BillOfMaterials materials={materials} project={project} onUpdate={setMaterials} report={compatibilityReport} />
        </div>
      </main>
      {showWindGuide && <WindGuideModal onClose={() => setShowWindGuide(false)} />}
    </div>
  );
}