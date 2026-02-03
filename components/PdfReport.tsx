
// @ts-nocheck
import { useMemo } from 'react';
import React from 'react';
import { getPanelCount } from '../services/calculatorService';
import { Project, Material, InverterBrand, CompatibilityReport, Component } from '../types';
import { groupMaterialsByCategory } from '../services/calculatorService';
import { getLocationClimate } from '../services/climateService';
import type { MicroBranchesReport } from '../services/microBranchService';
import { getSubscriptionStatus } from '../services/subscriptionService';
import { isProtectionTooHighForSection, isSectionOversizedForIn, getMaxIdcForSection, isDcCableTooSmallForI, getMinSectionForIn } from '../services/standardsService';
import { computeDcDrop, getDcSizingStatus, pickAutoDcSectionOptionB, normalizeBreakerA, agcpToCommercialBreakerA } from '../services/electricalSizing';
import RoofVisualizer from './RoofVisualizer';
import InstallationDiagram from './InstallationDiagram';
import ElectricalSchematic from './ElectricalSchematic';
import { ENPHASE_COMPONENTS, APSYSTEMS_COMPONENTS, FOXESS_COMPONENTS } from '../data/inverters';

interface PdfReportProps {
  project: Project;
  materials: Material[];
  exportOptions: {
    includeDatasheets: boolean;
    includeGuides: boolean;
    includeRegulations: boolean;
  };
  report: CompatibilityReport | null;
  voltageDrop: number; 
  acSection: number;   
  // (Onduleur centralisé) Tronçon AC1 : onduleur → coffret AC
  showAc1?: boolean;
  ac1VoltageDrop?: number;
  ac1Section?: number;
  ac1BreakerA?: number;
  microBranchesReport?: MicroBranchesReport | null;
}

const ITEMS_PER_PAGE = 14;

type PrintableRow = 
  | { type: 'header'; title: string }
  | { type: 'subheader'; title: string }
  | { type: 'item'; material: Material }
  | { type: 'warning'; text: string };

const DocLink = ({ title, url, icon = "📄" }: { title: string, url: string, icon?: string }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group text-decoration-none">
        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-lg group-hover:scale-110 transition-transform shadow-sm">
            {icon}
        </div>
        <div className="flex-1 overflow-hidden">
            <div className="font-bold text-slate-700 text-[10px] uppercase tracking-wide leading-tight">{title}</div>
            <div className="text-[8px] text-blue-600 underline truncate w-full">{url}</div>
        </div>
        <div className="text-slate-300 group-hover:text-blue-500 text-xs font-bold">➜</div>
    </a>
);

const PdfReport: React.FC<PdfReportProps> = ({ project, materials, exportOptions, report, voltageDrop, acSection, showAc1, ac1VoltageDrop, ac1Section, ac1BreakerA, microBranchesReport }) => {
  // IMPORTANT: ne pas utiliser rows*columns directement.
  // En "forme libre", la quantité réelle est portée par panels.rowConfiguration.
  const totalPowerW = project.fields.reduce((sum, f) => sum + (f.panels.model.power * getPanelCount(f.panels)), 0);
  const totalPowerkWc = (totalPowerW / 1000).toFixed(2);

  // Calibre "coffret AC" réellement sélectionné (si détectable dans la liste matériel)
  const selectedAcCoffretA = useMemo(() => {
    const coffret = materials.find(m => /coffret\s*ac/i.test(m.description || ''));
    if (!coffret) return null;
    const match = (coffret.description || '').match(/\b(\d{2,3})\s*A\b/i);
    return match ? Number(match[1]) : null;
  }, [materials]);
  
  const isThreePhase = project.inverterConfig.phase === 'Tri';
  const firstField = project.fields[0];
  const activePanel = firstField.panels.model;
  
  const climate = getLocationClimate(project.postalCode, project.altitude);
  
  const vocColdString = report?.details?.vocCold || 0;
  const vmpHotString = report?.details?.vmpHot || 0;
  const dcAcRatio = report?.details?.dcAcRatio ? report.details.dcAcRatio * 100 : 0;
  const invVmaxLimit = report?.details?.vmaxInverter || (isThreePhase ? 1000 : 600);
  const invVmpMin = report?.details?.vminMppt || 80;

  // Aligner l'export PDF avec la logique UI :
  // - Enphase + APSystems = micro
  // - FoxESS peut etre micro OU centralise selon modele
  // - Custom : on se base sur les specs detectees dans le report si dispo
  const isMicroSystem = useMemo(() => {
    const isCustomMicro = project.inverterConfig.brand === InverterBrand.CUSTOM && !!report?.inverterSpecs?.isMicro;
    const isKnownMicroBrand = project.inverterConfig.brand === InverterBrand.ENPHASE || project.inverterConfig.brand === InverterBrand.APSYSTEMS;
    const isFoxMicro = project.inverterConfig.brand === InverterBrand.FOXESS && (
      (project.inverterConfig.model || '').toUpperCase().includes('MICRO') || project.inverterConfig.model === 'FOX-S3000-G2'
    );
    return isKnownMicroBrand || isFoxMicro || isCustomMicro;
  }, [project.inverterConfig.brand, project.inverterConfig.model, report?.inverterSpecs?.isMicro]);

  const stringsAnalysis = report?.details?.stringsAnalysis || [];
  const mpptCount = stringsAnalysis.length;

  // Estimation DC : chute de tension par MPPT (si onduleur centralisé / chaînes PV)
  const dcDropRows = useMemo(() => {
    if (isMicroSystem || stringsAnalysis.length === 0) return [];
    

    return stringsAnalysis.map((s: any) => {
      const run = (project.inverterConfig.dcCablingRuns || []).find((r: any) => r.mpptIndex === s.mpptIndex) || { mpptIndex: s.mpptIndex, lengthM: 0, sectionMm2: null };
      const L = Number(run.lengthM || 0);
      const forcedS = (run.sectionMm2 == null ? null : Number(run.sectionMm2));
      const I = Number(s.iscCalculation || 0);
      const V = Number(s.vmpHot || 0) || 1;

      const autoS = pickAutoDcSectionOptionB(L, I, V);
      const effectiveS = forcedS ?? autoS;

      const { duV: du, duPct: dup } = computeDcDrop(L, I, effectiveS || 0, V);
      const { duV: duAuto, duPct: dupAuto } = computeDcDrop(L, I, autoS || 0, V);

      return { mpptIndex: s.mpptIndex, V, I, L, S: effectiveS, forcedS, autoS, du, dup, duAuto, dupAuto };
    });
  }, [isMicroSystem, stringsAnalysis, project.inverterConfig.dcCablingRuns]);

  const worstDcDropPercent = useMemo(() => {
    if (!dcDropRows.length) return 0;
    return Math.max(...dcDropRows.map((r: any) => Number(r.dup || 0)));
  }, [dcDropRows]);

  const configuredStrings = project.inverterConfig.configuredStrings || [];
  const mpptParallelCounts: Record<number, number> = configuredStrings.reduce((acc: any, s: any) => {
    const idx = Number(s.mpptIndex || 1);
    acc[idx] = (acc[idx] || 0) + 1;
    return acc;
  }, {});
  const maxParallelStringsOnAnyMppt = Object.values(mpptParallelCounts).reduce((m: number, v: any) => Math.max(m, Number(v) || 0), 0);
  // Règle simplifiée (pédagogique) : fusibles gPV requis uniquement si >2 strings en parallèle sur un même MPPT
  const gpvRequired = maxParallelStringsOnAnyMppt > 2;

  // Heuristique : bascule sur 2 pages DC si beaucoup de MPPT / contenu (pour éviter le contenu tronqué)
  // (On conserve 1 page si possible.)
  const needsDcPage2 = useMemo(() => {
    if (!exportOptions.includeDatasheets) return false;
    if (isMicroSystem) return false;
    return stringsAnalysis.length >= 4 || (stringsAnalysis.length >= 3 && gpvRequired);
  }, [exportOptions.includeDatasheets, isMicroSystem, stringsAnalysis.length, gpvRequired]);

  const hasMicroBranches = !!(microBranchesReport && microBranchesReport.branches && microBranchesReport.branches.length > 0);
  const worstBranchDrop = hasMicroBranches ? Math.max(...microBranchesReport!.branches.map((b: any) => b.dropPercent || 0)) : 0;
  const totalProductionDrop = hasMicroBranches ? (worstBranchDrop + (voltageDrop || 0)) : (voltageDrop || 0);

  const today = new Date().toLocaleDateString('fr-FR');

  const subscriptionStatus = getSubscriptionStatus({
    phase: isThreePhase ? 'Tri' : 'Mono',
    projectPowerKwc: totalPowerW / 1000,
    agcpA: project.inverterConfig.agcpValue,
  });

  const allInverters = useMemo((): Record<string, Component> => ({ ...ENPHASE_COMPONENTS, ...APSYSTEMS_COMPONENTS, ...FOXESS_COMPONENTS }), []);

  const projectDocs = useMemo(() => {
    const invModelId = project.inverterConfig.model;
    const selectedInv = (Object.values(allInverters) as Component[]).find((c) => c.id === invModelId);

    let genericInvUrl = "https://www.google.com/search?q=" + project.inverterConfig.brand;
    if (project.inverterConfig.brand === InverterBrand.FOXESS) genericInvUrl = "https://fr.fox-ess.com/download/";
    else if (project.inverterConfig.brand === InverterBrand.ENPHASE) genericInvUrl = "https://support.enphase.com/s/article/video-iq-microinverter-installationsguide";
    else if (project.inverterConfig.brand === InverterBrand.APSYSTEMS) genericInvUrl = "https://emea.apsystems.com/document-library/";

    return {
        structure: {
            brand: project.system.brand,
            videos: project.system.brand === 'K2' 
                ? [
                    { title: "Installation K2 SingleRail", url: "https://youtu.be/drCs25sMDgE?si=dMfyGLM-dh1V2cby" },
                    { title: "Fixations sur tuiles K2", url: "https://www.youtube.com/watch?v=drCs25sMDgE" }
                  ] 
                : [
                    { title: "Installation ClickFit EVO Tuiles", url: "https://www.youtube.com/watch?v=wlc8v_cif1A" }
                  ],
            manuals: project.system.brand === 'K2'
                ? ["https://catalogue.k2-systems.com/media/7b/4e/d3/Product-Brochure-fr.pdf"]
                : ["https://www.esdec.com/wp-content/uploads/2023/03/Manual_ClickFitEvo_TiledRoof_306_FR.pdf"]
        },
        panel: {
            name: activePanel.name,
            datasheet: activePanel.datasheetUrl || `https://www.google.com/search?q=${encodeURIComponent(activePanel.name)}+datasheet`,
            manual: activePanel.manualUrl || `https://www.google.com/search?q=${encodeURIComponent(activePanel.name)}+manual`,
            video: activePanel.videoUrl
        },
        inverter: {
            brand: project.inverterConfig.brand,
            model: selectedInv ? selectedInv.description : project.inverterConfig.model,
            datasheet: selectedInv?.datasheetUrl || genericInvUrl,
            manual: selectedInv?.manualUrl || genericInvUrl,
            video: selectedInv?.videoUrl,
            genericUrl: genericInvUrl,
            // Pro link: do not expose commissioning/cloud setup URLs in the customer-facing PDF.
            // (The UI can keep it if needed, but the exported report should stay neutral.)
            foxCommissioningUrl: null
        }
    };
  }, [project, activePanel, allInverters]);

  const printableRows = useMemo(() => {
    const grouped = groupMaterialsByCategory(materials);
    const rows: PrintableRow[] = [];
    
    const addItemWithWarning = (item: Material) => {
        rows.push({ type: 'item', material: item });
        const d = (item.description || '').toLowerCase();
        const isAcBox = (d.includes('coffret') || d.includes('cofac')) && !d.includes('coffret dc') && (d.includes('type f') || d.includes('type b'));
        if (isAcBox && (!project.inverterConfig.agcpValue || project.inverterConfig.agcpValue <= 0)) {
            rows.push({ type: 'warning', text: "Disjoncteur non livré dans les coffrets AC à calibrer et a ajouter en fonction de l'AGCP client" });
        }
    };

    grouped.forEach(g => {
        rows.push({ type: 'header', title: g.category });
        g.items.forEach(item => addItemWithWarning(item));
        if (g.subSections) {
            g.subSections.forEach(sub => {
                rows.push({ type: 'subheader', title: sub.title });
                if (sub.title && /borne ve/i.test(sub.title) && project.evCharger?.selected) {
                    rows.push({
                        type: 'warning',
                        text: project.evCharger.phase === 'Tri'
                            ? '⚠️ Borne VE TRI : prévoir câble 5G10 mm².'
                            : '⚠️ Borne VE MONO : prévoir câble 3G10 mm².'
                    });
                }
                sub.items.forEach(item => addItemWithWarning(item));
            });
        }
    });
    return rows;
  }, [
    materials,
    project.inverterConfig.agcpValue,
    project.evCharger?.selected,
    project.evCharger?.phase
  ]);

  const materialChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < printableRows.length; i += ITEMS_PER_PAGE) {
      chunks.push(printableRows.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [printableRows]);

  const materialPages = materialChunks.length;
  const showDoc = exportOptions.includeGuides;
  const showRegul = exportOptions.includeRegulations;
  
  // Pages "fixes" avant la liste matériel :
  //  - 1 page projet
  //  - 2 pages par toit (diagramme + schéma)
  //  - 1 page électrique DC
  //  - 1 page électrique AC
  //  - 1 page dédiée "Consuel-ready" (ajoutée pour éviter les contenus tronqués)
  //  - (option) pages datasheets
  // Pagination dynamique (DC peut passer à 2 pages si nécessaire)
  const basePages = 1 + (project.fields.length * 2); // page projet + 2 pages par champ
  const dcPages = exportOptions.includeDatasheets ? (needsDcPage2 ? 2 : 1) : 0;
  const pageDc1 = exportOptions.includeDatasheets ? (basePages + 1) : null;
  const pageDc2 = (exportOptions.includeDatasheets && needsDcPage2) ? (basePages + 2) : null;
  const pageAc = basePages + dcPages + 1;
  const pageConsuel = pageAc + 1;
  const pageSchematic = pageAc + 2;
  const fixedBeforeMaterials = basePages + dcPages + 3;
  const totalPages = fixedBeforeMaterials + materialPages + (showDoc ? 2 : 0) + (showRegul ? 1 : 0);

  const StatusPill = ({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) => {
    const cls = ok
      ? 'bg-green-50 text-green-800 border-green-200'
      : warn
        ? 'bg-orange-50 text-orange-800 border-orange-200'
        : 'bg-red-50 text-red-800 border-red-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wide ${cls}`}>
        {ok ? '✔' : warn ? '⚠' : '✖'} {label}
      </span>
    );
  };

  const SectionTitle = ({ children }: { children: any }) => (
    <h3 className="text-[10px] font-black text-slate-800 uppercase mb-2 tracking-tight border-b border-slate-200 pb-1">
      {children}
    </h3>
  );

  const LegendBox = ({ items }: { items: { k: string; v: string }[] }) => (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
      <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-2">Légende</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[8px] text-slate-600 leading-tight"><span className="font-black">{it.k}</span> : {it.v}</li>
        ))}
      </ul>
    </div>
  );

  const CommonHeader = ({ title }: { title: string }) => (
    <header className="flex justify-between items-end mb-6 border-b border-slate-200 pb-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8">
            <svg viewBox="0 0 100 100"><path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" fill="#eab308" /><path d="M50 5 L90 25 L50 45 L10 25 Z" fill="#84cc16" /><path d="M50 45 L90 25 L90 75 L50 95 Z" fill="#db2777" /></svg>
        </div>
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h2>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Richardson Solaire v3.0</span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold text-slate-700">{project.name}</span>
      </div>
    </header>
  );

  const CommonFooter = ({ page }: { page: number }) => (
    <footer className="mt-auto pt-4 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
      <span>Richardson Solaire - Dossier d'aide au chiffrage - Document non contractuel</span>
      <span>Page {page}/{totalPages}</span>
    </footer>
  );

  return (
    <div id="pdf-report-source" className="hidden bg-white text-slate-800 font-sans text-left">
      
      {/* PAGE 1 : COUVERTURE */}
      <div className="pdf-page w-[210mm] h-[297mm] bg-white relative flex flex-col overflow-hidden">
        <div className="h-[60%] relative">
            <img src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=1200&auto=format&fit=crop" className="w-full h-full object-cover" alt="Solar Field" />
            <div className="absolute top-12 left-12"><span className="text-white font-black tracking-widest text-sm uppercase">RICHARDSON</span></div>
            <div className="absolute inset-0 flex flex-col justify-center p-16">
                <h1 className="text-[64px] font-black text-white leading-none drop-shadow-2xl">Dossier Technique</h1>
                <h2 className="text-[64px] font-black text-yellow-400 leading-none drop-shadow-2xl mt-2">Photovoltaïque</h2>
                <div className="flex items-center gap-4 mt-6">
                    <div className="w-1.5 h-10 bg-orange-500"></div>
                    <p className="text-white/90 text-xl font-medium tracking-tight">Etude d'aide au dimensionnement et au chiffrage</p>
                </div>
            </div>
        </div>
        <div className="flex-1 p-20 flex justify-between items-start relative">
            <div className="flex gap-8 items-stretch">
                <div className="w-1.5 bg-slate-900"></div>
                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">PROJET</label>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight">{project.name || 'Nouveau Projet'}</h3>
                        <p className="text-slate-500 font-bold text-lg mt-1">{project.postalCode} {project.city}</p>
                    </div>
                    <div className="flex gap-12">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">PUISSANCE INSTALLÉE</label>
                            <span className="text-2xl font-black text-slate-800">{totalPowerkWc} kWc</span>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">DATE</label>
                            <span className="text-2xl font-black text-slate-800">{today}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Note abonnement / puissance souscrite (bas de page 1) */}
            <div className="absolute bottom-10 left-20 right-20">
              <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-600 leading-snug">
                <div className="font-black text-slate-700 uppercase tracking-widest text-[9px] mb-1">Condition de validité de l'étude</div>
                <div>
                  Cette étude est réalisée pour une puissance installée de <span className="font-black">{totalPowerkWc} kWc</span>. La faisabilité est conditionnée à une puissance souscrite au point de livraison compatible.
                  {subscriptionStatus.recommendedKva ? (
                    <> Abonnement minimal conseillé : <span className="font-black">{subscriptionStatus.recommendedKva} kVA</span> ({subscriptionStatus.phase === 'Mono' ? 'mono' : 'tri'}).
                    </>
                  ) : null}
                </div>
                <div className="mt-1">
                  {subscriptionStatus.subscribedKva == null ? (
                    <span className="font-bold">Puissance souscrite non renseignée (AGCP). À vérifier auprès du fournisseur/gestionnaire de réseau.</span>
                  ) : subscriptionStatus.isOk ? (
                    <span className="font-bold text-green-700">Abonnement renseigné : {subscriptionStatus.subscribedKva} kVA — compatible.</span>
                  ) : (
                    <span className="font-bold text-red-700">Abonnement renseigné : {subscriptionStatus.subscribedKva} kVA — à faire évoluer.</span>
                  )}
                  <span className="text-slate-500"> Limites usuelles : 12 kVA max en monophasé, 36 kVA max en triphasé, sous réserve de compatibilité du site/réseau.</span>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* PAGES TOITURES */}
      {project.fields.map((field, index) => (
        <React.Fragment key={field.id}>
          <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white">
            <CommonHeader title={`Vue d'ensemble - ${field.name}`} />
            <div className="mt-4 mb-10 text-left"><h3 className="text-2xl font-black text-slate-800">Configuration - {field.name}</h3></div>
            <div className="grid grid-cols-12 gap-12">
                <div className="col-span-6"><div className="bg-orange-50/50 rounded-3xl p-10 border border-orange-100 shadow-sm"><RoofVisualizer roof={field.roof} panels={field.panels} bare maxDimension={320} /></div></div>
                <div className="col-span-6 space-y-10">
                    <section><h4 className="text-[11px] font-black text-orange-500 uppercase tracking-widest border-b-2 border-orange-500 w-fit mb-5">Spécifications</h4>
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                                <tr><td className="py-2.5 text-slate-400">Module</td><td className="py-2.5 font-bold text-right">{field.panels.model.name}</td></tr>
                                <tr>
                                  <td className="py-2.5 text-slate-400">Quantité (ce champ)</td>
                                  <td className="py-2.5 font-bold text-right">{getPanelCount(field.panels)} panneaux</td>
                                </tr>
                                <tr>
                                  <td className="py-2.5 text-slate-400">Puissance Champ</td>
                                  <td className="py-2.5 font-bold text-right">{((getPanelCount(field.panels) * field.panels.model.power) / 1000).toFixed(2)} kWc</td>
                                </tr>
                                <tr><td className="py-2.5 text-slate-400">Orientation</td><td className="py-2.5 font-bold text-right">{field.panels.orientation}</td></tr>
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
            <CommonFooter page={1 + (index * 2) + 1} />
          </div>

          <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white">
            <CommonHeader title={`Plan de Calpinage - ${field.name}`} />
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-12 flex items-center justify-center overflow-hidden shadow-inner my-6">
                <InstallationDiagram roof={field.roof} panels={field.panels} system={project.system} railOrientation={field.railOrientation} />
            </div>
            <CommonFooter page={1 + (index * 2) + 2} />
          </div>
        </React.Fragment>
      ))}

      {/* --- PAGE(S) ÉLECTRIQUE(S) : AUDIT DC --- */}
      {exportOptions.includeDatasheets && (
      <>
        {/* DC page 1 : compact / pédagogique */}
        <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white overflow-hidden text-left">
          <CommonHeader title="Analyse Électrique - Coté DC" />
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h1 className="text-[20px] font-black text-slate-900 leading-tight">Audit électrique DC (générateur PV)</h1>
              <p className="text-slate-500 text-[9px] font-bold uppercase mt-3">Guide UTE C15-712-1 • Voc corrigée au froid • Isc × 1,25 • chute de tension DC par MPPT</p>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-slate-500 font-black uppercase">MPPT utilisés</div>
              <div className="text-[18px] font-black text-slate-900">{mpptCount}</div>
            </div>
          </div>

          {/* TABLEAU DC – Synthèse MPPT */}
<section className="mb-4">
  <SectionTitle>Tableau DC – Synthèse MPPT</SectionTitle>
  {isMicroSystem ? (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[9px] text-slate-700">
      Système micro-onduleurs : pas de liaisons DC longues par MPPT à dimensionner (câblage DC interne aux micro-onduleurs). Cette page DC est donc non applicable.
    </div>
  ) : (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-[9px]">
        <thead className="bg-slate-50 text-slate-600 font-black uppercase">
          <tr>
            <th className="p-3 text-left">MPPT</th>
            <th className="p-3 text-left">Fonction</th>
            <th className="p-3 text-right">L (m)</th>
            <th className="p-3 text-right">Section</th>
            <th className="p-3 text-right">I (A)</th>
            <th className="p-3 text-right">ΔU (%)</th>
            <th className="p-3 text-center">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {dcDropRows.map((r: any, i: number) => {
            const mpptInfo = stringsAnalysis.find((m: any) => Number(m.mpptIndex) === Number(r.mpptIndex));
            const par = Math.max(1, Math.round(Number(mpptInfo?.parallelStrings ?? 1) || 1));
            const dup = Number(r.dup || 0);
            const status = dup > 3 ? <StatusPill label=">3%" /> : (dup > 1 ? <StatusPill warn label=">1%" /> : <StatusPill ok label="OK" />);
            const c = dup > 3 ? 'text-red-700' : (dup > 1 ? 'text-orange-700' : 'text-green-700');
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="p-3 font-black">
                  {r.mpptIndex}
                  {par > 1 && <span className="ml-2 inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[8px] font-black">x{par} //</span>}
                </td>
                <td className="p-3 text-slate-700 font-bold">Chaîne PV → onduleur</td>
                <td className="p-3 text-right font-mono">{Number(r.L || 0).toFixed(0)}</td>
                <td className="p-3 text-right">
                  <span className="font-mono font-black">{Number(r.S || 0).toFixed(0)}</span><span className="ml-1">mm²</span>
                  {r.forcedS != null && <span className="ml-1 text-[7px] font-black text-indigo-700">forcé</span>}
                </td>
                <td className="p-3 text-right font-mono">{Number(r.I || 0).toFixed(2)}</td>
                <td className={`p-3 text-right font-black ${c}`}>{dup.toFixed(2)}</td>
                <td className="p-3 text-center">{status}</td>
              </tr>
            );
          })}
          {!dcDropRows.length && (
            <tr className="bg-white">
              <td className="p-3 text-slate-500" colSpan={7}>Aucun MPPT/liaison DC configuré.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}
</section>

{/* BLOCS PÉDAGOGIQUES DC */}
<section className="grid grid-cols-2 gap-4 mb-4">
  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
    <SectionTitle>Chute de tension DC</SectionTitle>
    <div className="text-[9px] text-slate-700 leading-relaxed">
      <div><b>Seuils :</b> ≤ 1% recommandé • 1–3% toléré • &gt; 3% non conforme (blocage export).</div>
      <div className="mt-2 font-mono text-[8px] text-slate-700">
        ΔU(V) = (2 × L × I × ρ) / S<br />
        ΔU(%) = (ΔU / Vmp_chaud) × 100
      </div>
    </div>
  </div>
  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
    <SectionTitle>UTE C 15-712-1 – Vérifs générateur</SectionTitle>
    <div className="text-[9px] text-slate-700 leading-relaxed space-y-2">
      <div>
        <div className="font-black text-[8px] uppercase text-slate-600">Voc corrigée au froid</div>
        <div>Voc(Tmin) = <b>{vocColdString.toFixed(1)} V</b> • limite onduleur : <b>{invVmaxLimit} V</b>.</div>
        {(() => {
          const ratio = invVmaxLimit > 0 ? (vocColdString / invVmaxLimit) : 0;
          if (vocColdString > invVmaxLimit) {
            return <div className="mt-1 text-red-700 font-black">❌ Surtension : réduire le nombre de modules en série (export bloqué).</div>;
          }
          if (ratio >= 0.95) {
            return <div className="mt-1 text-orange-700 font-black">⚠️ Proche limite ({(ratio*100).toFixed(0)}% de Vmax) : prévoir marge, vérifier le Tmin retenu.</div>;
          }
          return null;
        })()}
      </div>
      <div>
        <div className="font-black text-[8px] uppercase text-slate-600">Vmp "chaud" et plage MPPT</div>
        <div>Vmp_chaud = <b>{vmpHotString.toFixed(1)} V</b> • limite basse MPPT : <b>{invVmpMin} V</b>.</div>
        {(() => {
          const VMP_WARN_RATIO = 1.05;
          if (vmpHotString < invVmpMin) {
            return <div className="mt-1 text-red-700 font-black">❌ Hors plage MPPT : risque de décrochage en été (export bloqué).</div>;
          }
          const ratioLow = invVmpMin > 0 ? (vmpHotString / invVmpMin) : 0;
          if (ratioLow <= VMP_WARN_RATIO) {
            return <div className="mt-1 text-orange-700 font-black">⚠️ Proche limite ({(ratioLow*100).toFixed(0)}% de Vmin) : prévoir marge, vérifier la température "chaude" retenue.</div>;
          }
          return null;
        })()}
      </div>
      <div>
        <div className="font-black text-[8px] uppercase text-slate-600">Isc de calcul</div>
        <div>Isc_calc = Isc_STC × 1,25 → <b>{(report?.details?.iscCalculation || 0).toFixed(2)} A</b>.</div>
      </div>
    </div>
  </div>
</section>

<section className="border border-slate-200 rounded-xl p-4 bg-slate-50">
  <SectionTitle>Légende & symboles</SectionTitle>
  <div className="text-[9px] text-slate-700 leading-relaxed">
    <ul className="list-disc list-inside space-y-1">
      <li><b>L (m)</b> : longueur aller du câble (aller-retour intégré via ×2).</li>
      <li><b>S (mm²)</b> : section du câble cuivre.</li>
      <li><b>I (A)</b> : courant de calcul (Isc × 1,25).</li>
      <li><b>ρ</b> : résistivité cuivre (hypothèse 0,023 Ω·mm²/m).</li>
    </ul>
  </div>
</section>


          {/* Bas de page : protections + méthode (si pas de page 2) */}
          {!needsDcPage2 && (
            <section className="mt-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionTitle>Protections DC</SectionTitle>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-[8px]">
                      <thead className="bg-slate-50 text-slate-600 font-black uppercase">
                        <tr>
                          <th className="p-2 text-left">Élément</th>
                          <th className="p-2 text-left">Critère</th>
                          <th className="p-2 text-center">Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr className="bg-white">
                          <td className="p-2 font-bold">Sectionneur DC</td>
                          <td className="p-2">In ≥ Isc_calc ({(report?.details?.iscCalculation || 0).toFixed(2)}A) • Un ≥ Uoc_max ({vocColdString.toFixed(1)}V)</td>
                          <td className="p-2 text-center text-green-700 font-black">VALIDE</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="p-2 font-bold">Parafoudre DC (T2)</td>
                          <td className="p-2">Protection surtensions (15-712-1)</td>
                          <td className="p-2 text-center text-green-700 font-black">INCLUS</td>
                        </tr>
                        {gpvRequired && (
                          <tr className="bg-white">
                            <td className="p-2 font-bold">Fusibles gPV</td>
                            <td className="p-2">Requis si &gt; 2 strings // sur un même MPPT (pédagogique)</td>
                            <td className="p-2 text-center text-orange-700 font-black">À PRÉVOIR</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <SectionTitle>Méthodologie & symboles</SectionTitle>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="font-mono text-[6.5px] text-slate-600 leading-[1.35]">
                      <div className="font-black text-[7px] uppercase text-slate-700 mb-1">Tension au froid</div>
                      Uoc(Tmin) = Uoc_stc × [1 + (k_voc/100) × (Tmin - 25)] × N
                      <div className="mt-2 font-black text-[7px] uppercase text-slate-700 mb-1">Courant de calcul</div>
                      Isc_calc = Isc_stc × 1.25
                      <div className="mt-2 font-black text-[7px] uppercase text-slate-700 mb-1">Chute de tension DC</div>
                      ΔU(V) = (2 × L × I × ρ) / S • ΔU(%) = ΔU / Vmp_chaud × 100
                    </div>
                    <div className="mt-2 text-[7px] text-slate-600">
                      Symboles : L(m)=longueur aller • S(mm²)=section • I(A)=courant • ρ≈0.023 (cuivre, hypothèse chaude) • Vmp_chaud=tension de chaîne en conditions chaudes.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <CommonFooter page={pageDc1 as number} />
        </div>

        {/* DC page 2 si nécessaire */}
        {needsDcPage2 && (
          <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white overflow-hidden text-left">
            <CommonHeader title="Analyse Électrique - Coté DC (suite)" />

            <div className="flex items-center justify-between mb-3">
              <h1 className="text-[18px] font-black text-slate-900">Suite DC : protections & méthodologie</h1>
              <div className="text-[8px] text-slate-500 font-bold uppercase">Page dédiée pour lisibilité</div>
            </div>

            <section className="mb-4">
              <SectionTitle>Protections DC</SectionTitle>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[9px]">
                  <thead className="bg-slate-50 text-slate-600 font-black uppercase">
                    <tr>
                      <th className="p-3 text-left">Élément</th>
                      <th className="p-3 text-left">Critère</th>
                      <th className="p-3 text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3 font-bold">Sectionneur DC</td>
                      <td className="p-3">In ≥ Isc_calc ({(report?.details?.iscCalculation || 0).toFixed(2)}A) • Un ≥ Uoc_max ({vocColdString.toFixed(1)}V)</td>
                      <td className="p-3 text-center text-green-700 font-black">VALIDE</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-3 font-bold">Parafoudre DC (T2)</td>
                      <td className="p-3">Protection surtensions (15-712-1)</td>
                      <td className="p-3 text-center text-green-700 font-black">INCLUS</td>
                    </tr>
                    {gpvRequired && (
                      <tr>
                        <td className="p-3 font-bold">Fusibles gPV</td>
                        <td className="p-3">Requis si &gt; 2 strings // sur un même MPPT (pédagogique)</td>
                        <td className="p-3 text-center text-orange-700 font-black">À PRÉVOIR</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <SectionTitle>Formules utilisées</SectionTitle>
                <div className="font-mono text-[7px] text-slate-700 leading-[1.4]">
                  <div className="font-black text-[7px] uppercase text-slate-600 mb-1">Voc corrigée au froid</div>
                  Uoc(Tmin) = Uoc_stc × [1 + (k_voc/100) × (Tmin - 25)] × N
                  <div className="mt-2 font-black text-[7px] uppercase text-slate-600 mb-1">Isc de calcul</div>
                  Isc_calc = Isc_stc × 1.25
                  <div className="mt-2 font-black text-[7px] uppercase text-slate-600 mb-1">Chute DC (par MPPT)</div>
                  ΔU(V) = (2 × L × I × ρ) / S
                  <br />ΔU(%) = (ΔU / Vmp_chaud) × 100
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <SectionTitle>Symboles & repères</SectionTitle>
                <div className="text-[9px] text-slate-700 leading-relaxed">
                  <ul className="list-disc list-inside space-y-1">
                    <li><b>L (m)</b> : longueur aller du câble (la formule intègre l'aller-retour via ×2).</li>
                    <li><b>S (mm²)</b> : section du câble cuivre.</li>
                    <li><b>I (A)</b> : courant de calcul (Isc × 1,25).</li>
                    <li><b>ΔU (V)</b> : chute de tension en volts.</li>
                    <li><b>ΔU (%)</b> : chute rapportée à Vmp « chaud » de la chaîne.</li>
                    <li><b>ρ</b> : résistivité cuivre (hypothèse 0,023 Ω·mm²/m).</li>
                  </ul>
                  <div className="mt-3 text-[8px] text-slate-600">
                    Repère : en pratique, viser ≤ 1% est courant ; si &gt; 3% il est recommandé d'augmenter la section ou réduire la longueur.
                  </div>
                </div>
              </div>
            </section>

            <CommonFooter page={pageDc2 as number} />
          </div>
        )}
      </>
      )}

      {/* --- PAGE ÉLECTRIQUE 2/2 : AUDIT AC & SYNTHÈSE CONSUEL --- */}
      <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white overflow-hidden text-left">
        <CommonHeader title="Analyse Électrique 2/2 - Coté AC" />
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h1 className="text-[20px] font-black text-slate-900 leading-tight">Audit électrique AC (liaison tableau)</h1>
            <p className="text-slate-500 text-[9px] font-bold uppercase mt-3">{`NFC 15-100 • chutes de tension AC • protections de tête${hasMicroBranches ? ' • cumul “production” (micro-onduleurs)' : ''}`}</p>
          </div>
        </div>
        
        {/* Synthèse AC (tableau clair) */}
        {(() => {
          const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

          // Courant AC de référence (A) utilisé pour les protections
          const acIref = Number(report?.details?.nominalAcCurrent || 0);
          const acInMinTheo = Number(report?.details?.recommendedBreakerTheo ?? (acIref ? (acIref * 1.25) : 0));

          const fmtA = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1));

          // --- AC2 (coffret -> tableau) : disjoncteur retenu (priorité AGCP normalisé)
          const ac2InMin = acInMinTheo;
          const ac2UpperStd = STANDARD_BREAKERS.find(v => v >= ac2InMin) ?? ac2InMin;
          const agcpA = Number(project?.inverterConfig?.agcpValue || 0);
          const agcpCommercialA = (agcpA > 0) ? agcpToCommercialBreakerA(agcpA, !!isThreePhase) : null;
          const ac2RetainedA = agcpCommercialA ?? (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0 ? selectedAcCoffretA : ac2UpperStd);
          const ac2SourceLabel = agcpCommercialA
            ? `AGCP saisi ${agcpA} A → normalisé ${agcpCommercialA} A`
            : (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0 ? `coffret AC ${selectedAcCoffretA} A` : null);

          // --- AC1 (onduleur -> coffret) : seulement en onduleur central
          const ac1Imax = acIref;
          const ac1InMin = acInMinTheo;
          const ac1UpperStd = STANDARD_BREAKERS.find(v => v >= ac1InMin) ?? ac1InMin;
          const ac1RetainedA = (typeof ac1BreakerA === 'number' && ac1BreakerA > 0) ? ac1BreakerA : ac1UpperStd;

          const ac2Forced = project?.acCableSectionMm2 != null;
          const ac1Forced = project?.ac1CableSectionMm2 != null;

          const ac2TooHigh = isProtectionTooHighForSection(acSection, ac2RetainedA);
          const ac1TooHigh = (showAc1 && typeof ac1Section === 'number') ? isProtectionTooHighForSection(ac1Section, ac1RetainedA) : false;

          return (
            <>
              <section className="mb-3">
                <SectionTitle>Tronçons AC – synthèse</SectionTitle>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-[9px]">
                    <thead className="bg-slate-50 text-slate-600 font-black uppercase">
                      <tr>
                        <th className="p-3 text-left">Tronçon</th>
                        <th className="p-3 text-right">L (m)</th>
                        <th className="p-3 text-right">Section</th>
                        <th className="p-3 text-right">Disj mini (théo)</th>
                        <th className="p-3 text-right">Disj retenu</th>
                        <th className="p-3 text-right">ΔU (%)</th>
                        <th className="p-3 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {showAc1 && typeof ac1Section === 'number' && typeof ac1VoltageDrop === 'number' && (
                        <tr className="bg-white">
                          <td className="p-3">
                            <div className="font-black text-slate-900">AC1 • Onduleur → Coffret AC</div>
                            <div className="text-[7px] text-slate-500">Liaison interne “production” (côté PV). Dimensionnée sur Imax AC de l’onduleur.</div>
                          </td>
                          <td className="p-3 text-right font-mono">{project.distanceInverterToAcCoffret || 0}</td>
                          <td className="p-3 text-right">
                            <span className="font-mono font-black">{ac1Section}</span>
                            <span className="ml-1">mm²</span>
                            {ac1Forced && <span className="ml-1 text-[7px] font-black text-indigo-700">forcé</span>}
                          </td>
                          <td className="p-3 text-right font-mono">{ac1InMin ? fmtA(ac1InMin) : '-' }</td>
                          <td className="p-3 text-right font-mono">{ac1RetainedA || '-'}</td>
                          <td className={`p-3 text-right font-black ${ac1VoltageDrop > 3 ? 'text-red-700' : (ac1VoltageDrop > 1 ? 'text-orange-700' : 'text-green-700')}`}>{ac1VoltageDrop.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            {ac1TooHigh ? <StatusPill label="NON conforme" /> : (ac1VoltageDrop > 3 ? <StatusPill label=">3%" /> : (ac1VoltageDrop > 1 ? <StatusPill warn label=">1%" /> : <StatusPill ok label="OK" />))}
                          </td>
                        </tr>
                      )}

                      <tr className={showAc1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-3">
                          <div className="font-black text-slate-900">AC2 • Coffret AC → Tableau</div>
                          <div className="text-[7px] text-slate-500">Liaison vers point de raccordement. Réf. : UTE C 15-712-1 (viser ~1%) • NF C 15-100 (limites générales).</div>
                        </td>
                        <td className="p-3 text-right font-mono">{project.distanceToPanel}</td>
                        <td className="p-3 text-right">
                          <span className="font-mono font-black">{acSection}</span>
                          <span className="ml-1">mm²</span>
                          {ac2Forced && <span className="ml-1 text-[7px] font-black text-indigo-700">forcé</span>}
                        </td>
                        <td className="p-3 text-right font-mono">{ac2InMin ? fmtA(ac2InMin) : '-' }</td>
                        <td className="p-3 text-right font-mono">{ac2RetainedA || '-'}</td>
                        <td className={`p-3 text-right font-black ${voltageDrop > 3 ? 'text-red-700' : (voltageDrop > 1 ? 'text-orange-700' : 'text-green-700')}`}>{voltageDrop.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          {ac2TooHigh ? <StatusPill label="NON conforme" /> : (voltageDrop > 3 ? <StatusPill label=">3%" /> : (voltageDrop > 1 ? <StatusPill warn label=">1%" /> : <StatusPill ok label="OK" />))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  
<div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
  <div className="text-[7px] font-black uppercase text-slate-500">Protection AC – rappel</div>
  <div className="text-[8px] text-slate-700 leading-snug space-y-1">
    {showAc1 && (
      <div>
        <div>
          <span className="font-black">AC1</span> — Base de calcul : <b>Imax AC onduleur</b>
          {ac1Imax ? <> = <b>{ac1Imax.toFixed(1)} A</b></> : <> (donnée onduleur)</>}. Mini théorique : <b>{fmtA(ac1InMin)} A</b>
          <span className="text-slate-500"> (In_min = 1,25 × Imax)</span> • calibre commercial supérieur : <b>{ac1UpperStd} A</b> • retenu : <b>{ac1RetainedA} A</b>.
        </div>
        <div className="text-[7px] text-slate-500">
          Repère : si Imax AC n’est pas fourni par la notice, on peut l’estimer via la puissance AC max : I ≈ S<sub>AC</sub>/230V (mono) ou I ≈ S<sub>AC</sub>/(√3×400V) (tri).
        </div>
      </div>
    )}
    <div>
      <div>
        <span className="font-black">AC2</span> — Base de calcul : <b>Imax AC “production”</b>
        {ac2Imax ? <> = <b>{ac2Imax.toFixed(1)} A</b></> : <> (courant nominal max)</>}. Mini théorique : <b>{fmtA(ac2InMin)} A</b>
        <span className="text-slate-500"> (In_min = 1,25 × Imax)</span> • calibre commercial supérieur : <b>{ac2UpperStd} A</b> • retenu : <b>{ac2RetainedA} A</b>{ac2SourceLabel ? <> ({ac2SourceLabel})</> : null}.
      </div>
      <div className="text-[7px] text-slate-500">
        Note : en onduleur centralisé, le courant “production” traversant AC2 est celui de l’onduleur (même base que AC1). Le calibre retenu peut être imposé par l’AGCP / coffret.
      </div>
    </div>
    <div className="text-[7px] text-slate-500">
      Règle : <b>In_min = 1,25 × Imax AC</b> (NF C 15-100 / UTE C 15-712-1). Le calibre retenu peut être <b>imposé</b> par l’AGCP ou le coffret AC (prioritaire sur le calibre “commercial supérieur”).
    </div>
  </div>
</div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="text-[7px] font-black uppercase text-slate-500">Chute de tension – repère</div>
                    <div className="text-[8px] text-slate-700 leading-snug">
                      Bonnes pratiques : viser <b>≤ 1%</b>. Toléré : <b>1–3%</b>. Au-delà de <b>3%</b> : augmenter la section / réduire la longueur.
                      {hasMicroBranches ? <> Cumul “production” = pire branche + AC2.</> : null}
                    </div>
                  </div>
                </div>
              </section>

              {/* Tableau des branches micro-onduleurs (si applicable) */}
              {hasMicroBranches && microBranchesReport?.branches && microBranchesReport.branches.length > 0 && (
                <section className="mb-3">
                  <SectionTitle>Branches micro-onduleurs (chutes AC)</SectionTitle>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-[9px]">
                      <thead className="bg-slate-50 text-slate-600 font-black uppercase">
                        <tr>
                          <th className="p-3 text-left">Branche</th>
                          <th className="p-3 text-right"># micros</th>
                          <th className="p-3 text-right">L (m)</th>
                          <th className="p-3 text-right">S (mm²)</th>
                          <th className="p-3 text-right">I (A)</th>
                          <th className="p-3 text-right">ΔU (V)</th>
                          <th className="p-3 text-right">ΔU (%)</th>
                          <th className="p-3 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {microBranchesReport.branches.map((b: any, idx: number) => {
                          const du = Number(b.dropPercent ?? b.duPercent ?? 0);
                          const c = du > 3 ? 'text-red-700' : (du > 1 ? 'text-orange-700' : 'text-green-700');
                          return (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-3 font-black">Branche {b.branchIndex ?? (idx + 1)}</td>
                              <td className="p-3 text-right font-mono">{b.micros ?? b.microCount ?? '-'}</td>
                              <td className="p-3 text-right font-mono">{b.lengthM ?? b.length ?? '-'}</td>
                              <td className="p-3 text-right font-mono">{b.sectionMm2 ?? b.section ?? '-'}</td>
                              <td className="p-3 text-right font-mono">{Number(b.currentA ?? b.current ?? 0).toFixed(1)}</td>
                              <td className="p-3 text-right font-mono">{Number(b.dropV ?? b.duV ?? 0).toFixed(1)}</td>
                              <td className={`p-3 text-right font-black ${c}`}>{du.toFixed(2)}</td>
                              <td className="p-3 text-center">{du > 3 ? <StatusPill label=">3%" /> : (du > 1 ? <StatusPill warn label=">1%" /> : <StatusPill ok label="OK" />)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-1 text-[7px] text-slate-500">Chute “production” cumulée : <b>{totalProductionDrop.toFixed(2)}%</b> (pire branche + AC2).</div>
                </section>
              )}

              <section className="mt-auto grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <SectionTitle>Formules utilisées</SectionTitle>
                  <div className="font-mono text-[7px] text-slate-700 leading-[1.4]">
                    Imax AC = P_ac / U_réseau
                    <br />In_min = 1,25 × Imax AC
                    <br />ΔU(%) = (L × I × ρ) / (S × U) × 100
                    <div className="mt-2 text-[7px] text-slate-600">ρ cuivre ≈ 0,023 Ω·mm²/m (hypothèse chaude).</div>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <SectionTitle>Symboles</SectionTitle>
                  <div className="text-[9px] text-slate-700 leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li><b>L (m)</b> : distance coffret AC → point de raccordement (AC2) ou onduleur → coffret (AC1).</li>
                      <li><b>S (mm²)</b> : section câble cuivre.</li>
                      <li><b>I (A)</b> : courant nominal max en AC.</li>
                      <li><b>ΔU (%)</b> : chute de tension.</li>
                      <li><b>In</b> : calibre disjoncteur.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </>
          );
        })()}

        <CommonFooter page={pageAc} />
      </div>

      {/* --- PAGE DÉDIÉE : SYNTHÈSE CONSUEL-READY --- */}
      <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white overflow-hidden text-left">
        <CommonHeader title="Synthèse Consuel-ready" />

        <section className="flex-1">
          <div className="bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute top-6 right-8 text-xs font-black uppercase tracking-[0.3em] opacity-20">Synthèse Administrative</div>
              <h3 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-orange-500"></span> Données "Consuel-ready"
              </h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                  <div className="space-y-4">
                      <div className="border-b border-slate-800 pb-2"><label className="block text-[8px] text-slate-500 font-black uppercase">Puissance PV totale installée</label><span className="text-lg font-bold">{totalPowerkWc} kWc</span></div>
                      <div className="border-b border-slate-800 pb-2"><label className="block text-[8px] text-slate-500 font-black uppercase">Puissance maximale de l'onduleur</label><span className="text-lg font-bold">{(report?.details?.maxAcPower / 1000).toFixed(2)} kVA</span></div>
                      <div className="border-b border-slate-800 pb-2"><label className="block text-[8px] text-slate-500 font-black uppercase">Tension de service DC max (Uoc_max)</label><span className="text-lg font-bold">{vocColdString} V</span></div>
                  </div>
                  <div className="space-y-4">
                      <div className="border-b border-slate-800 pb-2"><label className="block text-[8px] text-slate-500 font-black uppercase">Courant de court-circuit max corrigé (Isc x 1.25)</label><span className="text-lg font-bold">{report?.details?.iscCalculation} A</span></div>
                      <div className="border-b border-slate-800 pb-2"><label className="block text-[8px] text-slate-500 font-black uppercase">Intensité maximale AC par phase</label><span className="text-lg font-bold">{report?.details?.nominalAcCurrent} A</span></div>
                      {(() => {
                        const inMin = Number(report?.details?.recommendedBreaker || 0);
                        const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

          const ac2Imax = Number(report?.details?.nominalAcCurrent || report?.details?.maxAcCurrent || 0);
          const ac2InMinTheo = ac2Imax ? Math.round(ac2Imax * 1.25) : Number(report?.details?.recommendedBreaker || 0);

                        const upperStd = STANDARD_BREAKERS.find(v => v >= inMin) ?? null;
                        const agcpA = Number(project?.inverterConfig?.agcpValue || 0);
                        const agcpCommercialA = (agcpA > 0) ? agcpToCommercialBreakerA(agcpA, !!isThreePhase) : null;
                        // Protection réellement retenue : priorité à l'AGCP saisi (calibre commercial), sinon coffret AC détecté, sinon calibre commercial supérieur au mini théorique.
                        const retainedA = agcpCommercialA ?? (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0 ? selectedAcCoffretA : (upperStd ?? inMin));
                        return (
                          <div className="border-b border-slate-800 pb-2">
                            <label className="block text-[8px] text-slate-500 font-black uppercase">Protection de tête (Calibre disjoncteur retenu)</label>
                            <div className="flex items-end justify-between gap-4">
                              <span className="text-lg font-bold">{retainedA} A</span>
                              {inMin > 0 ? <span className="text-[10px] text-slate-400 italic">Mini théorique : {inMin} A (1,25 × Imax AC)</span> : null}
                            </div>
                          </div>
                        );
                      })()}
                  </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-800">
                  <p className="text-[10px] text-slate-400 leading-relaxed italic">
                      * Note technique : Cette synthèse facilite le remplissage des attestations de conformité (Dossiers Techniques SC 144A/B).
                      Elle ne dispense pas l'installateur d'une vérification sur site des calibres et longueurs réelles.
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400 leading-relaxed italic">
                      {(() => {
                        const inMin = Number(report?.details?.recommendedBreaker || 0);
                        if (!inMin) return null;

                        const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

          const ac2Imax = Number(report?.details?.nominalAcCurrent || report?.details?.maxAcCurrent || 0);
          const ac2InMinTheo = ac2Imax ? Math.round(ac2Imax * 1.25) : Number(report?.details?.recommendedBreaker || 0);

                        const upperStd = STANDARD_BREAKERS.find(v => v >= inMin) ?? null;
                        const agcpA = Number(project?.inverterConfig?.agcpValue || 0);
                        const agcpCommercialA = (agcpA > 0) ? agcpToCommercialBreakerA(agcpA, !!isThreePhase) : null;
                        const retainedA = agcpCommercialA ?? (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0 ? selectedAcCoffretA : (upperStd ?? inMin));

                        // Si le mini théorique n'est pas un calibre commercial, on explique le calibre commercial supérieur
                        // ET on rappelle explicitement le calibre réellement retenu (AGCP/coffret) pour éviter toute ambiguïté.
                        const isCommercial = STANDARD_BREAKERS.includes(inMin);
                        const sourceLabel = agcpCommercialA
                          ? `AGCP saisi ${agcpA} A → normalisé ${agcpCommercialA} A`
                          : (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0 ? `coffret AC ${selectedAcCoffretA} A` : null);

                        if (isCommercial) {
                          return (
                            <>* Note technique – calibre : mini théorique {inMin} A (1,25 × Imax AC). Calibre retenu : {retainedA} A{sourceLabel ? ` (${sourceLabel})` : ""}.</>
                          );
                        }

                        return (
                          <>
                            * Note technique – calibre normalisé : calibre minimal théorique {inMin} A (1,25 × Imax AC). Calibre commercial supérieur : {upperStd ?? inMin} A. Calibre retenu : {retainedA} A{sourceLabel ? ` (${sourceLabel})` : ""}.
                          </>
                        );
                      })()}
                  </p>
              </div>
          </div>
        </section>

        <CommonFooter page={pageConsuel} />
      </div>

      <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white">
        <CommonHeader title="Schéma électrique de principe" />
        <div className="flex-1 border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm p-4 my-6">
            <ElectricalSchematic project={project} materials={materials} />
        </div>
        <CommonFooter page={pageSchematic} />
      </div>

      {/* PAGES LISTE MATÉRIEL */}
      {materialChunks.map((chunk, pageIndex) => (
        <div key={pageIndex} className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white text-left">
          <CommonHeader title={`Liste matériel globale ${materialPages > 1 ? `(${pageIndex + 1}/${materialPages})` : ''}`} />
          <div className="flex-1">
              <table className="w-full text-[11px] border-collapse">
                  <thead>
                      <tr className="bg-slate-800 text-white font-black text-[9px] tracking-widest uppercase">
                        <th className="p-4 text-left rounded-tl-xl">REF.</th>
                        <th className="p-4 text-left">DESCRIPTION</th>
                        <th className="p-4 text-center">QTE</th>
                        <th className="p-4 text-right rounded-tr-xl">CODE RICH.</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-x border-slate-100">
                      {chunk.map((row, idx) => {
                          if (row.type === 'header') {
                              return (
                                <tr key={`header-${row.title}`} className="bg-slate-200 border-y border-slate-300">
                                    <td colSpan={4} className="px-4 py-2 font-black text-slate-700 uppercase tracking-widest text-[10px]">
                                        {row.title}
                                    </td>
                                </tr>
                              );
                          }
                          if (row.type === 'subheader') {
                              return (
                                <tr key={`subheader-${row.title}`} className="bg-green-50 border-y border-green-100">
                                    <td colSpan={4} className="px-4 py-1.5 font-bold text-green-800 uppercase tracking-wide text-[9px]">
                                        {row.title}
                                    </td>
                                </tr>
                              );
                          }
                          if (row.type === 'warning') {
                              return (
                                <tr key={`warn-${idx}`} className="bg-red-50 border-b border-red-200">
                                    <td colSpan={4} className="p-2 text-[8px] font-bold text-red-600 text-center leading-tight">
                                        {row.text}
                                    </td>
                                </tr>
                              )
                          }
                          const m = row.material;
                          return (
                            <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}>
                                <td className="p-4 font-black text-slate-800">{m.id}</td>
                                <td className="p-4">
                                    <div className="text-slate-500 font-medium">{m.description}</div>
                                </td>
                                <td className="p-4 text-center font-black text-slate-800 text-base">{m.quantity}</td>
                                <td className="p-4 text-right font-mono font-bold text-slate-400 text-[10px]">{m.price || '-'}</td>
                            </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
          <CommonFooter page={totalPages - materialPages + pageIndex - (showDoc ? 2 : 0) - (showRegul ? 1 : 0)} />
        </div>
      ))}

      {/* Pages Documentation */}
      {showDoc && (
      <>
        <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white text-left">
            <CommonHeader title="Documentation Technique - Structure & Modules" />
            <div className="grid grid-cols-2 gap-8 mt-4 flex-1 content-start">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                   <h3 className="text-sm font-black text-slate-800 uppercase border-b-2 border-slate-800 pb-2 mb-4">
                      1. Structure {projectDocs.structure.brand}
                   </h3>
                   <div className="space-y-3">
                      {projectDocs.structure.manuals.map((url, i) => (
                          <DocLink key={i} title="Notice de Montage (PDF)" url={url} icon="🔧" />
                      ))}
                      {projectDocs.structure.videos.map((v, i) => (
                          <DocLink key={i} title={`Vidéo : ${v.title}`} url={v.url} icon="▶️" />
                      ))}
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                   <h3 className="text-sm font-black text-slate-800 uppercase border-b-2 border-slate-800 pb-2 mb-4">
                      2. Panneaux {projectDocs.panel.name}
                   </h3>
                   <div className="space-y-3">
                      <DocLink title="Fiche Technique (PDF)" url={projectDocs.panel.datasheet} />
                      <DocLink title="Manuel d'Installation (PDF)" url={projectDocs.panel.manual} icon="📖" />
                   </div>
                </div>
            </div>
            <CommonFooter page={totalPages - (showDoc ? 1 : 0) - (showRegul ? 1 : 0)} />
        </div>
        
        <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white text-left">
            <CommonHeader title="Documentation Technique - Énergie & Administratif" />
            <div className="grid grid-cols-2 gap-8 mt-4 flex-1 content-start">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                   <h3 className="text-sm font-black text-slate-800 uppercase border-b-2 border-slate-800 pb-2 mb-4">
                      3. Onduleur {projectDocs.inverter.brand}
                   </h3>
                   <div className="space-y-3">
                      <DocLink title="Fiche Technique" url={projectDocs.inverter.datasheet} />
                      <DocLink title="Manuel Utilisateur" url={projectDocs.inverter.manual} icon="📖" />
                      {projectDocs.inverter.foxCommissioningUrl && (
                          <DocLink title="Mise en service (Cloud)" url={projectDocs.inverter.foxCommissioningUrl} icon="☁️" />
                      )}
                   </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                   <h3 className="text-sm font-black text-blue-900 uppercase border-b-2 border-blue-900 pb-2 mb-4">
                      4. Démarches & Consuel
                   </h3>
                   <div className="space-y-3">
                      <DocLink title="Portail CONSUEL (Demande en ligne)" url="https://www.consuel.com/" icon="🌐" />
                      <DocLink title="Dossier Technique SC 144A (Vente Surplus)" url="https://www.consuel.com/dossiers-techniques/" icon="📄" />
                      <DocLink title="Dossier Technique SC 144B (Autoconso Totale/Batterie)" url="https://www.consuel.com/dossiers-techniques/" icon="📄" />
                   </div>
                </div>
            </div>
            <CommonFooter page={totalPages - (showRegul ? 1 : 0)} />
        </div>
      </>
      )}

      {showRegul && (
        <div className="pdf-page w-[210mm] h-[297mm] p-[15mm] flex flex-col bg-white text-left">
            <CommonHeader title="Rappel et Règlementation" />
            <div className="mt-8 flex-1">
                <h2 className="text-3xl font-black text-slate-800 mb-2">Cadre Normatif</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-3xl p-10 relative overflow-hidden shadow-sm">
                     <h3 className="text-xl font-black text-blue-900 mb-6 uppercase tracking-tight">Attestation de Conformité CONSUEL</h3>
                     <p className="text-sm text-blue-800 font-medium leading-relaxed mb-8 max-w-xl">
                        Pour toute installation de production d'énergie électrique (photovoltaïque) avec ou sans dispositif de 
                        stockage, la conformité aux normes en vigueur est obligatoire.
                     </p>
                     <a href="https://actualites.consuel.com/wp-content/uploads/2025/07/NL12-ART-AUTOCONSO-JUILLET25-v12.pdf" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-black text-sm uppercase tracking-widest shadow-md transition-transform active:scale-95">
                         Consulter la note officielle
                     </a>
                </div>
            </div>
            <CommonFooter page={totalPages} />
        </div>
      )}
    </div>
  );
};

export default PdfReport;
