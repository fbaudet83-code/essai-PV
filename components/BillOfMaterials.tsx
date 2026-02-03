
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Material, Project, CompatibilityReport } from '../types';
import { PdfIcon, SpinnerIcon, XIcon } from './icons';
import PdfReport from './PdfReport';
import { groupMaterialsByCategory } from '../services/calculatorService';
import type { MicroBranchesReport } from '../services/microBranchService';
import { isProtectionTooHighForSection, isSectionOversizedForIn, getMaxIdcForSection, isDcCableTooSmallForI, getMinSectionForIn } from '../services/standardsService';
import { normalizeBreakerA, agcpToCommercialBreakerA } from '../services/electricalSizing';

declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

const scriptLoadPromises: { [src: string]: Promise<void> } = {};

const loadScript = (src: string): Promise<void> => {
  if (scriptLoadPromises[src]) return scriptLoadPromises[src];
  scriptLoadPromises[src] = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      delete scriptLoadPromises[src];
      reject(new Error(`Le script ${src} n'a pas pu être chargé.`));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromises[src];
};

const ensurePdfLibraries = async () => {
  if (typeof window.html2canvas === 'function' && typeof window.jspdf !== 'undefined') return;
  try {
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
    ]);
    let attempts = 0;
    while ((typeof window.html2canvas !== 'function' || typeof window.jspdf === 'undefined') && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  } catch (error) {
    throw new Error("Les librairies PDF n'ont pas pu être chargées.");
  }
};

interface BillOfMaterialsProps {
  materials: Material[];
  project: Project;
  onUpdate: (materials: Material[]) => void;
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

const BillOfMaterials: React.FC<BillOfMaterialsProps> = ({ materials, project, onUpdate, report, voltageDrop, acSection, showAc1, ac1VoltageDrop, ac1Section, ac1BreakerA, microBranchesReport }) => {
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('Exporter en PDF');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
      includeDatasheets: true,
      includeGuides: true,
      includeRegulations: true
  });

  useEffect(() => { setLocalMaterials(materials); }, [materials]);

  const handlePriceChange = (id: string, price: string) => {
    const updated = localMaterials.map(m => m.id === id ? { ...m, price } : m);
    setLocalMaterials(updated);
    onUpdate(updated);
  };

  const groupedMaterials = useMemo(() => groupMaterialsByCategory(localMaterials), [localMaterials]);

  const handleExportPDF = useCallback(async () => {
    if (isExporting) return;
    const reportElementSource = document.getElementById('pdf-report-source');
    if (!reportElementSource) return;

    setIsExporting(true);
    setExportStatus('Préparation...');

    const currentScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const reportElement = reportElementSource.cloneNode(true) as HTMLElement;
    reportElement.id = 'pdf-report-clone';
    reportElement.classList.remove('hidden');
    reportElement.style.display = 'block';
    reportElement.style.position = 'absolute';
    reportElement.style.left = '-10000px';
    reportElement.style.top = '0';
    reportElement.style.width = '210mm'; 
    document.body.appendChild(reportElement);

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await ensurePdfLibraries();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const pageElements = reportElement.querySelectorAll('.pdf-page');

      for (let i = 0; i < pageElements.length; i++) {
        setExportStatus(`Génération Page ${i + 1}/${pageElements.length}...`);
        const pageElement = pageElements[i] as HTMLElement;
        
        const canvas = await window.html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
        });

        if (i > 0) pdf.addPage();
        const imgData = canvas.toDataURL('image/jpeg', 0.90);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        const pageRect = pageElement.getBoundingClientRect();
        const pxToMmWidth = pdfWidth / pageRect.width;
        const pxToMmHeight = pdfHeight / pageRect.height;

        const links = pageElement.querySelectorAll('a');
        links.forEach((link) => {
            const url = link.getAttribute('href');
            if (url && url !== '#' && url.startsWith('http')) {
                const linkRect = link.getBoundingClientRect();
                const x = (linkRect.left - pageRect.left) * pxToMmWidth;
                const y = (linkRect.top - pageRect.top) * pxToMmHeight;
                const w = linkRect.width * pxToMmWidth;
                const h = linkRect.height * pxToMmHeight;
                pdf.link(x, y, w, h, { url: url });
            }
        });
      }

      pdf.save(`Dossier_Technique_${project.name.replace(/\s/g, '_') || 'Solaire'}.pdf`);
    } catch (error) {
      console.error("Erreur d'export PDF:", error);
      alert("Une erreur est survenue lors de la génération du PDF interactif.");
    } finally {
      document.getElementById('pdf-report-clone')?.remove();
      window.scrollTo(0, currentScrollY);
      setIsExporting(false);
      setExportStatus('Exporter en PDF');
    }
  }, [project, isExporting]);

  const isCompatible = report?.isCompatible ?? false;
  const microBlockingErrors = (microBranchesReport?.errors || []).filter(Boolean);
  const isMicroConfigOk = microBlockingErrors.length === 0;
  const isVoltageDropOk = (() => {
    const okAc2 = (typeof voltageDrop === "number") ? voltageDrop <= 3 : true;
    const okAc1 = showAc1 ? ((typeof ac1VoltageDrop === "number") ? ac1VoltageDrop <= 3 : true) : true;
    return okAc2 && okAc1;
  })();

// IMPORTANT : la conformité protection/section doit être évaluée avec le **calibre de protection réellement retenu**.
// Pour AC2 (coffret AC -> tableau), si l'AGCP est renseigné, il devient le calibre de référence.
// Pour AC1 (onduleur -> coffret), on utilise le disjoncteur du coffret AC.
const isThreePhase = project?.inverterConfig?.phase === 'Tri';

// AC2 : calibre théorique mini (1.25 × Ib) fourni par le rapport
const acBreakerMinA = (report as any)?.acBreakerMin ?? (report?.details?.recommendedBreaker ?? null);

// Calibre commercial de référence pour AC2
const ac2BreakerRefA = (() => {
  const agcp = Number(project?.inverterConfig?.agcpValue || 0);
  if (agcp > 0) return agcpToCommercialBreakerA(agcp, !!isThreePhase) ?? normalizeBreakerA(agcp, !!isThreePhase);
  if (typeof selectedAcCoffretA === 'number' && selectedAcCoffretA > 0) return selectedAcCoffretA;
  if (typeof acBreakerMinA === 'number' && acBreakerMinA > 0) return normalizeBreakerA(acBreakerMinA, !!isThreePhase);
  return null;
})();

const ac1BreakerRefA = (showAc1 && typeof ac1BreakerA === 'number' && ac1BreakerA > 0) ? ac1BreakerA : null;

const isCableProtectionOk = (() => {
  const okAc2 = (ac2BreakerRefA && typeof acSection === 'number') ? !isProtectionTooHighForSection(acSection, ac2BreakerRefA) : true;
  const okAc1 = (showAc1 && ac1BreakerRefA && typeof ac1Section === 'number') ? !isProtectionTooHighForSection(ac1Section, ac1BreakerRefA) : true;
  return okAc2 && okAc1;
})();

const isCableOversized = (ac2BreakerRefA && typeof acSection === 'number')
  ? isSectionOversizedForIn(acSection, ac2BreakerRefA)
  : false;

  // --- DC (MPPT) cabling validation : chute de tension + intensité (Option B) ---
  // Règle B :
  //  - ΔU ≤ 1% : OK
  //  - 1% < ΔU ≤ 3% : WARNING (autorisé)
  //  - ΔU > 3% : DANGEREUX (blocage export)
  const dcCablingValidation = (() => {
    const reasons: string[] = [];

    const stringsAnalysis = (report as any)?.details?.stringsAnalysis || [];
    if (!Array.isArray(stringsAnalysis) || stringsAnalysis.length === 0) {
      return { ok: true, reasons };
    }

    const rho = 0.023;
    const DC_SECTIONS = [2.5, 6, 10, 16];
    const runs = (project?.inverterConfig?.dcCablingRuns || []) as Array<{ mpptIndex: number; lengthM: number; sectionMm2?: number | null }>;

    const pickAutoSection = (L: number, I: number, V: number) => {
      // DC : auto vise ΔU ≤ 3% (limite) en démarrant à 6 mm²,
      // tout en gardant 2,5 mm² disponible en forçage manuel.
      let autoS = 6;
      if (L > 0 && I > 0 && V > 0) {
        for (const S of DC_SECTIONS.filter(s => s >= 6)) {
          const du = (2 * L * I * rho) / (S || 1);
          const dup = V > 0 ? (du / V) * 100 : 0;
          if (dup <= 3) { autoS = S; break; }
          autoS = S;
        }
      }
      return autoS;
    };

    for (const s of stringsAnalysis) {
      const mpptIndex = Number((s as any)?.mpptIndex || 0);
      if (!mpptIndex) continue;

      const run = runs.find(r => Number(r.mpptIndex) === mpptIndex);
      const L = Number(run?.lengthM || 0);

      if (!L || L <= 0) {
        reasons.push(`Liaison DC MPPT ${mpptIndex} : longueur manquante (à renseigner).`);
        continue;
      }

      const I = Number((s as any)?.iscCalculation || 0);
      const V = Number((s as any)?.vmpHot || 0) || 1;
      const forcedS = (run?.sectionMm2 == null ? null : Number(run?.sectionMm2));
      const autoS = pickAutoSection(L, I, V);
      const effectiveS = forcedS ?? autoS;

      const du = (2 * L * I * rho) / (effectiveS || 1);
      const dup = (du / V) * 100;

      if (dup > 3) {
        reasons.push(`Liaison DC MPPT ${mpptIndex} : chute de tension trop élevée (ΔU=${dup.toFixed(2)}% > 3%). Augmenter la section ou réduire la longueur.`);
      }

      // Garde-fou intensité / section (terrain)
      if (I > 0 && effectiveS) {
        if (isDcCableTooSmallForI(effectiveS, I)) {
          const Imax = getMaxIdcForSection(effectiveS);
          const Smin = getMinSectionForIn(I, DC_SECTIONS);
          reasons.push(`Liaison DC MPPT ${mpptIndex} : section ${effectiveS} mm² trop faible pour I=${I.toFixed(1)} A (max conseillé ~${Imax} A). Recommandé ≥ ${Smin} mm².`);
        }
      }
    }

    return { ok: reasons.length === 0, reasons };
  })();
  // (Onduleur centralisé) Règle métier : AC2 ≥ AC1
  const isAcOrderOk = !showAc1 || (typeof ac1Section === 'number' && typeof acSection === 'number' && acSection >= ac1Section);

  const canExport = isCompatible && isMicroConfigOk && isVoltageDropOk && isCableProtectionOk && dcCablingValidation.ok && isAcOrderOk;

  const renderItemRow = (item: Material, idx: number) => (
      <React.Fragment key={item.id}>
          <tr className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
              <td className="px-6 py-2 font-medium text-slate-900">
                  {item.datasheetUrl ? (
                      <a href={item.datasheetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 transition-colors flex items-center gap-1 group" title="Voir la fiche technique">
                          {item.id}
                          <span className="opacity-0 group-hover:opacity-100 text-[10px]">↗</span>
                      </a>
                  ) : (
                      item.id
                  )}
              </td>
              <td className="px-6 py-2">
                  {item.datasheetUrl ? (
                      <a href={item.datasheetUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline block transition-colors" title="Voir la fiche technique">
                          {item.description}
                      </a>
                  ) : (
                      <div>{item.description}</div>
                  )}
                  {(() => {
                    const d = (item.description || '').toLowerCase();
                    const isAcBox = (d.includes('coffret') || d.includes('cofac')) && !d.includes('coffret dc') && (d.includes('type f') || d.includes('type b'));
                    const agcpMissing = !project.inverterConfig.agcpValue || project.inverterConfig.agcpValue <= 0;
                    if (!isAcBox || !agcpMissing) return null;
                    return (
                      <div className="text-[10px] text-red-600 font-bold mt-1 italic leading-tight">
                          Disjoncteur non livré dans les coffrets AC à calibrer et a ajouter en fonction de l'AGCP client
                      </div>
                    );
                  })()}
                  {(() => {
                      const d = (item.description || '').toLowerCase();
                      const isAcBox = (d.includes('coffret') || d.includes('cofac')) && !d.includes('coffret dc') && (d.includes('type f') || d.includes('type b'));
                      if (!isAcBox) return null;
                      const inMin = Number(report?.details?.recommendedBreaker || 0);
                      const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
                      const upperStd = STANDARD_BREAKERS.find(v => v >= inMin);
                      if (!inMin || STANDARD_BREAKERS.includes(inMin)) return null;
                      return (
                        <div className="text-[10px] text-slate-600 font-bold mt-1 italic leading-tight">
                          Note technique : calibre minimal théorique calculé = {inMin} A (1,25 × Imax AC). En l’absence de calibre commercial, le calibre normalisé retenu est {upperStd ?? inMin} A.
                        </div>
                      );
                  })()}
              </td>
              <td className="px-6 py-2 text-center font-bold text-slate-700">{item.quantity}</td>
              <td className="px-6 py-2 text-right">
                  <input type="text" value={item.price || ''} onChange={(e) => handlePriceChange(item.id, e.target.value)} className="w-24 text-right p-1 border border-slate-300 rounded bg-white/50 focus:bg-white" />
              </td>
          </tr>
          {item.id === 'FOX-MICRO-1000' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte<br/>
                      Jusqu’à 7 micro-onduleurs sur un câble équivalent 6 mm² avec un disjoncteur jusqu’à 32 A .👉 Ces limites tiennent compte de la capacité de transport de courant du câble et des jonctions.
                      Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
          {item.id === 'ENP-IQ8MC-72-M-INT' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte (IQ8MC)<br/>
                      Disjoncteur 20 A monophasé : nombre max ~11 par branche (Câble 2.5mm²).<br/>
                      👉 Ces limites recommandées par Enphase tiennent compte de la chute de tension et du courant admissible du câble AC.
                      <br/>Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
          {item.id === 'ENP-IQ8HC-72-M-INT' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte (IQ8HC)<br/>
                      Disjoncteur 20 A monophasé : nombre max ~9 par branche (Câble 2.5mm²).<br/>
                      👉 Ces limites recommandées par Enphase tiennent compte de la chute de tension et du courant admissible du câble AC.
                      <br/>Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
          {item.id === 'ENP-IQ8P-72-2-INT' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte (IQ8P)<br/>
                      Disjoncteur 20 A monophasé : nombre max ~7-8 par branche (Câble 2.5mm²).<br/>
                      👉 Ces limites recommandées par Enphase tiennent compte de la chute de tension et du courant admissible du câble AC.
                      <br/>Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
          {item.id === 'APS-DS3' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte (DS3)<br/>
                      Câble AC bus 2.5mm² (Max ~20A) : 5 unités max par branche.<br/>
                      👉 Ces limites tiennent compte de la capacité du câble bus et des chutes de tension.
                      <br/>Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
          {item.id === 'APS-DS3-H' && (
              <tr className="bg-red-50 border-b border-red-100">
                  <td colSpan={4} className="px-6 py-3 text-[11px] text-red-600 font-bold leading-tight">
                      ⚠️ Ce qu’il faut aussi prendre en compte (DS3-H)<br/>
                      Câble AC bus 2.5mm² (Max ~20A) : 4 à 5 unités max par branche.<br/>
                      👉 Ces limites tiennent compte de la capacité du câble bus et des chutes de tension.
                      <br/>Merci de vous reporter a la fiche technique constructeur
                  </td>
              </tr>
          )}
      </React.Fragment>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-md relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-700">Liste de Matériel Globale</h3>
        <div className="flex flex-col items-end gap-1">
            <button 
                onClick={() => setShowExportModal(true)} 
                disabled={isExporting || !canExport}
                className="flex items-center justify-center gap-2 w-[180px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
                {isExporting ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <PdfIcon className="h-5 w-5" />}
                <span>{isExporting ? exportStatus : 'Exporter en PDF'}</span>
            </button>
            {!isCompatible && (
              <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded">
                ⚠️ Export bloqué : Configuration non conforme
              </span>
            )}
            {isCompatible && !isMicroConfigOk && (
              <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded max-w-[260px] text-right">
                ⚠️ Export bloqué : micro-onduleurs à corriger
              </span>
            )}
            {isCompatible && isMicroConfigOk && !isAcOrderOk && (
              <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded max-w-[260px] text-right">
                ⚠️ Export bloqué : AC2 doit être ≥ AC1
              </span>
            )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-500">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Réf. Fabricant</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3 text-center">Qté</th>
              <th className="px-6 py-3 text-right">Code Rich.</th>
            </tr>
          </thead>
          <tbody>
            {groupedMaterials.map((group) => (
                <React.Fragment key={group.category}>
                    <tr className="bg-slate-200 border-y border-slate-300">
                        <td colSpan={4} className="px-6 py-2 font-black text-slate-700 uppercase tracking-widest text-xs">
                            {group.category}
                        </td>
                    </tr>
                    {group.items.map((item, idx) => renderItemRow(item, idx))}
                    {group.subSections?.map(sub => (
                        <React.Fragment key={sub.title}>
                            <tr className="bg-green-50 border-y border-green-100">
                                <td colSpan={4} className="px-6 py-1.5 font-bold text-green-800 uppercase tracking-wide text-[10px]">
                                    {sub.title}
                                </td>
                            </tr>
                            {sub.title && /borne ve/i.test(sub.title) && project.evCharger?.selected && (
                                <tr className="bg-white border-b border-red-100">
                                    <td colSpan={4} className="px-6 py-2 text-[11px] text-red-600 font-black">
                                        {project.evCharger.phase === 'Tri'
                                            ? '⚠️ Borne VE TRI : prévoir câble 5G10 mm².'
                                            : '⚠️ Borne VE MONO : prévoir câble 3G10 mm².'}
                                    </td>
                                </tr>
                            )}
                            {sub.items.map((item, idx) => renderItemRow(item, idx))}
                        </React.Fragment>
                    ))}
                </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      <PdfReport 
        project={project} 
        materials={localMaterials} 
        exportOptions={exportOptions} 
        report={report} 
        voltageDrop={voltageDrop} 
        acSection={acSection} 
        showAc1={showAc1}
        ac1VoltageDrop={ac1VoltageDrop}
        ac1Section={ac1Section}
        ac1BreakerA={ac1BreakerA}
        microBranchesReport={microBranchesReport}
      />

      {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">Génération du Dossier Technique</h3>
                  <div className="space-y-4 mb-6">
                      <p className="text-sm text-slate-600">Le document comportera les plans de pose, les calculs de conformité, le schéma électrique et les <b>liens interactifs</b> vers les notices.</p>
                      
                      <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={exportOptions.includeDatasheets} onChange={() => setExportOptions(o => ({...o, includeDatasheets: !o.includeDatasheets}))} />
                              <span className="text-sm font-medium text-slate-800">Inclure l'audit électrique détaillé</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={exportOptions.includeGuides} onChange={() => setExportOptions(o => ({...o, includeGuides: !o.includeGuides}))} />
                              <span className="text-sm font-medium text-slate-800">Inclure la documentation technique (liens & notices)</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={exportOptions.includeRegulations} onChange={() => setExportOptions(o => ({...o, includeRegulations: !o.includeRegulations}))} />
                              <span className="text-sm font-medium text-slate-800">Ajouter la page "Rappel et Règlementation"</span>
                          </label>
                      </div>
                  </div>
                  {!isVoltageDropOk && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs">
                      <div className="font-bold mb-1">Export PDF bloqué : chute de tension AC trop élevée</div>
                      <div>
                        {showAc1 && typeof ac1VoltageDrop === 'number' && ac1VoltageDrop > 3 && (
                          <div>Tronçon AC1 (onduleur → coffret AC) : <b>{ac1VoltageDrop.toFixed(2)}%</b></div>
                        )}
                        {typeof voltageDrop === 'number' && voltageDrop > 3 && (
                          <div>Tronçon AC2 (coffret AC → point de raccordement) : <b>{voltageDrop.toFixed(2)}%</b></div>
                        )}
                        <div className="mt-1">
                          Objectif : ≤ 1% (recommandé). Limite : ≤ 3% (toléré). Au-delà, revoir la section et/ou la longueur.
                        </div>
                      </div>
                    </div>
                  )}

                  {!isMicroConfigOk && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs">
                      <div className="font-bold mb-1">Export PDF bloqué : configuration micro-onduleurs à corriger</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {microBlockingErrors.slice(0, 5).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                      {microBlockingErrors.length > 5 && (
                        <div className="mt-2 italic">…et {microBlockingErrors.length - 5} autre(s) point(s).</div>
                      )}
                    </div>
                  )}


                  {!dcCablingValidation.ok && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs">
                      <div className="font-bold mb-1">Export PDF bloqué : liaison DC (MPPT) à corriger</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {dcCablingValidation.reasons.slice(0, 5).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                      {dcCablingValidation.reasons.length > 5 && (
                        <div className="mt-2 italic">…et {dcCablingValidation.reasons.length - 5} autre(s) point(s).</div>
                      )}
                    </div>
                  )}

                  {!isCableProtectionOk && (
                    <div className="mb-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
                      <div className="font-bold">Export PDF bloqué : protection/section AC non conforme</div>
                      <div className="mt-1 text-xs">
                        {ac1BreakerRefA && showAc1 && typeof ac1Section === 'number' && isProtectionTooHighForSection(ac1Section, ac1BreakerRefA) && (
                          <div>AC1 (onduleur → coffret) : In=<b>{ac1BreakerRefA}A</b> incompatible avec <b>{ac1Section}mm²</b>.</div>
                        )}
                        {ac2BreakerRefA && typeof acSection === 'number' && isProtectionTooHighForSection(acSection, ac2BreakerRefA) && (
                          <div>AC2 (coffret → tableau) : In=<b>{ac2BreakerRefA}A</b> incompatible avec <b>{acSection}mm²</b>.</div>
                        )}
                        <div className="mt-1">Augmente la section (ex : 16 mm² pour 63 A) ou ajuste la protection.</div>
                      </div>
                    </div>
                  )}

                  {!isAcOrderOk && (
                    <div className="mb-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
                      <div className="font-bold">Export PDF bloqué : incohérence sections AC</div>
                      <div className="mt-1 text-xs">
                        AC2 (coffret → tableau) doit être <b>≥</b> AC1 (onduleur → coffret) en onduleur centralisé.
                        <div className="mt-1">
                          Valeurs actuelles : AC1 = <b>{ac1Section} mm²</b> • AC2 = <b>{acSection} mm²</b>.
                        </div>
                      </div>
                    </div>
                  )}

<div className="flex gap-3">
                      <button onClick={() => setShowExportModal(false)} className="flex-1 py-2.5 bg-slate-100 rounded-lg font-bold text-slate-600">Annuler</button>
                      <button
                        disabled={!canExport}
                        onClick={() => { setShowExportModal(false); handleExportPDF(); }}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-200 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                      >
                        Générer le PDF
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default BillOfMaterials;
