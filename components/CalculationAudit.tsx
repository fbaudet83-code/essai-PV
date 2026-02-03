
import React, { useState } from 'react';
import { Project, CompatibilityReport, InverterBrand } from '../types';
import { getLocationClimate } from '../services/climateService';
import { getMaxIdcForSection, isDcCableTooSmallForI, isProtectionTooHighForSection, getProtectionStatusForSection } from '../services/standardsService';
import { computeDcDrop, getDcSizingStatus, pickAutoDcSectionOptionB, normalizeBreakerA, agcpToCommercialBreakerA } from '../services/electricalSizing';
import { XIcon } from './icons';
import type { MicroBranchesReport } from '../services/microBranchService';

interface CalculationAuditProps {
  project: Project;
  report: CompatibilityReport | null;
  totalPowerW: number;
  voltageDrop: number;
  acSection: number;
  microBranchesReport?: MicroBranchesReport | null;
}

const CalculationAudit: React.FC<CalculationAuditProps> = ({ project, report, totalPowerW, voltageDrop, acSection, microBranchesReport }) => {
  const [showDimensionGuide, setShowDimensionGuide] = useState(false);
  const [showCalcDetails, setShowCalcDetails] = useState(false);
  
  const isThreePhase = project.inverterConfig.phase === 'Tri';
  const climate = getLocationClimate(project.postalCode, project.altitude);
  const firstPanel = project.fields[0]?.panels.model;

  // Détection simple "système micro" (utilisé pour afficher/masquer certains blocs DC)
  // On n'a pas accès ici à la DB composants, donc on se base sur la marque / libellé.
  const isMicroSystem =
    project.inverterConfig.brand === InverterBrand.ENPHASE ||
    project.inverterConfig.brand === InverterBrand.APSYSTEMS ||
    (project.inverterConfig.brand === InverterBrand.FOXESS && !!project.inverterConfig.model?.toUpperCase().includes('MICRO')) ||
    (project.inverterConfig.brand === InverterBrand.CUSTOM && !!project.inverterConfig.model?.toUpperCase().includes('MICRO'));

  // Cohérence protection/câble (sécurité) : éviter In trop élevé pour la section.
// Pour AC2, si l'AGCP est renseigné, il devient la référence (coffret/DB).
const recommendedBreaker = report?.details?.recommendedBreaker;
const agcpConfiguredA = project?.inverterConfig?.agcpValue;
const agcpCommercialA = (agcpConfiguredA && agcpConfiguredA > 0)
  ? agcpToCommercialBreakerA(agcpConfiguredA, isThreePhase)
  : null;
const breakerRefA = agcpCommercialA ?? (recommendedBreaker ? Number(recommendedBreaker) : normalizeBreakerA((report?.details?.nominalAcCurrent || 0) * 1.25, isThreePhase));

const acProtectionStatus = breakerRefA ? getProtectionStatusForSection(acSection, breakerRefA) : 'ok';
const acProtectionTooHigh = acProtectionStatus === 'danger';

  const totalPanels = project.fields.reduce((sum, f) => sum + (f.panels.rows * f.panels.columns), 0);
  const noInverter = project.inverterConfig.brand === InverterBrand.NONE;

  // --- BLOCAGE SI ERREUR DE CONFIGURATION CRITIQUE ---
  if (report && !report.isCompatible && report.errors.length > 0 && !report.details) {
      return (
        <div className="bg-red-50 rounded-xl shadow-lg border-2 border-red-200 overflow-hidden relative p-8 text-center animate-scale-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4 shadow-sm border border-red-200">
                <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-black text-red-800 uppercase tracking-tight mb-2">Calculs Bloqués</h3>
            <div className="max-w-md mx-auto">
                <p className="font-bold text-red-700 text-sm mb-4">
                    La configuration actuelle est invalide et empêche tout calcul de sécurité.
                </p>
                <div className="bg-white p-4 rounded-lg border border-red-200 text-left shadow-sm">
                    <ul className="list-disc list-inside space-y-2">
                        {report.errors.map((err, i) => (
                            <li key={i} className="text-xs font-bold text-red-600">
                                {err}
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="mt-4 text-xs text-red-500 font-medium italic">
                    Veuillez corriger la répartition des chaînes dans le panneau "Électrique" pour débloquer l'audit et l'export PDF.
                </p>
            </div>
        </div>
      );
  }

  if (!report || !report.details || !firstPanel || totalPanels === 0 || noInverter) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden opacity-60 grayscale-[0.5]">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <span className="text-orange-400">∑</span> Méthodologie & Audit Électrique
          </h3>
          <span className="text-[10px] bg-slate-700 px-2 py-1 rounded border border-slate-600 uppercase tracking-widest">En attente de configuration</span>
        </div>
        <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
                <p className="text-slate-600 font-bold">Audit en pause</p>
                <p className="text-xs text-slate-400">Saisissez des dimensions de toiture et un onduleur pour lancer les calculs.</p>
            </div>
        </div>
      </div>
    );
  }

  const { details } = report;
  const stringsAnalysis = details.stringsAnalysis || [];
  const mpptCount = stringsAnalysis.length;

  // Heuristique : un micro-onduleur a typiquement une tension DC max <= ~80V.
  // Dans ce cas, la "plage MPPT" est avant tout une recommandation constructeur (performance / démarrage)
  // et ne doit pas être affichée comme une non-conformité "normative" dans la fenêtre de détail.
  const isMicroInverter = (details.vmaxInverter ?? 9999) <= 80;

  const coeffVoc = firstPanel.electrical?.tempCoeffVoc || -0.26;
  const vocSTC = firstPanel.electrical?.voc || 0;
  const vmpSTC = firstPanel.electrical?.vmp || 0;
  
  // Recalcul détaillé pour affichage
  const tempMin = climate.tempMin;
  const tempCellHot = climate.tempMaxAmb + 35;
  const deltaTCold = tempMin - 25;
  const deltaTHot = tempCellHot - 25;
  
  const vocColdPanel = vocSTC * (1 + (coeffVoc / 100) * deltaTCold);
  const vmpHotPanel = vmpSTC * (1 + (coeffVoc / 100) * deltaTHot);
  
  const voltageError = details.vocCold > details.vmaxInverter;
  const currentError = details.iscPanel > details.imaxInverter;
  const ratioPercent = details.dcAcRatio * 100;
  const ratioCritical = ratioPercent > 130;

  // Calcul visuel de la barre de progression
  const barWidth = Math.min(100, (ratioPercent / 160) * 100);
  
  let barColor = 'bg-blue-500';
  let barStatusText = 'Sous-dimensionné';
  if (ratioPercent >= 100 && ratioPercent <= 130) {
      barColor = 'bg-green-500';
      barStatusText = 'Optimal';
  } else if (ratioPercent > 130) {
      barColor = 'bg-orange-500';
      barStatusText = 'Sur-dimensionné (Clipping)';
  } else if (ratioPercent > 150) {
      barColor = 'bg-red-600';
      barStatusText = 'Critique';
  }

  // Pour les micro-onduleurs, on conserve l'alerte mais on l'interprète comme un avertissement de performance.
  const lowVoltageErrors = stringsAnalysis.filter(str => str.vmpHot < details.vminMppt);
  const VMP_WARN_RATIO = 1.05;
  const lowVoltageWarnings = stringsAnalysis.filter(str => str.vmpHot >= details.vminMppt && str.vmpHot <= details.vminMppt * VMP_WARN_RATIO);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-scale-in relative">
      <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2">
          <span className="text-orange-400">∑</span> Méthodologie & Audit Électrique
        </h3>
        <span className="text-[10px] bg-slate-700 px-2 py-1 rounded border border-slate-600 uppercase tracking-widest">Norme NF C15-712-1</span>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: Tension & Courant de sécurité */}
        <section>
          <div className="flex justify-between items-start mb-3">
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">1. Vérification Sécurité (DC Side)</h4>
                <div className="flex flex-wrap gap-2 items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${voltageError ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        Chaine Max (Worst-case) : {details.maxPanelsInAString} pan.
                    </span>
                    <button 
                        onClick={() => setShowCalcDetails(true)} 
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-300 transition-colors flex items-center gap-1"
                    >
                        <span>?</span> Voir les détails des calculs
                    </button>
                </div>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-bold ${report.isCompatible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
              {report.isCompatible ? 'CONFORME' : 'NON CONFORME'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${voltageError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Tension Max Globale (Voc @ {climate.tempMin}°C)</span>
                    {voltageError && <span className="text-[10px] font-black text-red-600 animate-pulse">⚠️ SURTENSION</span>}
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className={`text-xl font-black ${voltageError ? 'text-red-700' : 'text-slate-800'}`}>{details.vocCold} V</div>
                        <div className="text-[9px] text-slate-500 font-bold italic">Calcul basé sur la chaîne la plus longue</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">Limite Onduleur</div>
                        <div className="text-sm font-black text-slate-700">{details.vmaxInverter} V</div>
                    </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${currentError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Courant Court-Circuit (Isc)</span>
                    {currentError && <span className="text-[10px] font-black text-red-600 animate-pulse">⚠️ INTENSITÉ TROP HAUTE</span>}
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className={`text-xl font-black ${currentError ? 'text-red-700' : 'text-slate-800'}`}>{details.iscPanel} A</div>
                        <div className="text-[9px] text-slate-500 font-bold italic">Panel: {firstPanel.name}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">Limite Entrée</div>
                        <div className="text-sm font-black text-slate-700">{details.imaxInverter} A</div>
                    </div>
                </div>
              </div>
          </div>



          {/* 1B. Liaison DC (câbles PV -> coffret DC / onduleur) */}
          {!isMicroSystem && stringsAnalysis.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">1B. Liaison DC (Panneaux → coffret DC / onduleur)</h4>
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">ΔU DC (info)</span>
              </div>
              <div className="p-4 text-[12px] text-slate-700">
                <p className="text-[11px] text-slate-600 mb-3">
                  Renseigne la longueur et la section de la liaison DC pour chaque MPPT utilisé (liaison aller+retour = 2×L).

                  

Calcul simplifié : <span className="font-mono">ΔU = (2 × L × I × ρ) / S</span> avec <span className="font-mono">ρ = 0,023 Ω·mm²/m</span>.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-2 text-left">MPPT</th>
                        <th className="py-2 px-2 text-right">L (m)</th>
                        <th className="py-2 px-2 text-right">S (mm²)</th>
                        <th className="py-2 px-2 text-right">I (A)</th>
                        <th className="py-2 px-2 text-right">ΔU (V)</th>
                        <th className="py-2 px-2 text-right">ΔU (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stringsAnalysis.map((mppt) => {
                        const run = project.inverterConfig.dcCablingRuns?.find(r => r.mpptIndex === mppt.mpptIndex);
                        const L = run?.lengthM ?? 0;
                        const I = mppt.iscCalculation; // Isc corrigé (sécurité)
                        const baseV = mppt.vmpHot || 0;

                        const forcedS = (run?.sectionMm2 == null ? null : Number(run?.sectionMm2));
                        const autoS = pickAutoDcSectionOptionB(L, I, baseV || 1);
                        const S = forcedS ?? autoS;

                        const { duV: dropV, duPct: dropPct } = computeDcDrop(L, I, S || 0, baseV || 0);

                        const missing = L <= 0;
                        const maxI = S > 0 ? getMaxIdcForSection(S) : 0;
                        const cableTooSmall = !missing && isDcCableTooSmallForI(S, I);
                        const status = getDcSizingStatus(L, dropPct);
                        const isDanger = !missing && !cableTooSmall && status === 'danger';
                        const isWarn = !missing && !cableTooSmall && status === 'warn';
                        return (
                          <tr key={mppt.mpptIndex} className="border-b border-slate-100">
                            <td className="py-2 px-2 font-bold">
                              MPPT {mppt.mpptIndex}
                              {mppt.parallelStrings && mppt.parallelStrings > 1 && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-700">x{mppt.parallelStrings} //</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">{L || '—'}</td>
                            <td className="py-2 px-2 text-right">
                              {S ? (
                                <div className="inline-flex flex-col items-end leading-tight">
                                  <span>{S}</span>
                                  {forcedS != null && (
                                    <span className="text-[9px] font-black text-indigo-600">(forcé)</span>
                                  )}
                                  {forcedS != null && autoS && Number(autoS) !== Number(forcedS) && (
                                    <span className="text-[9px] font-black text-slate-400">Auto: {autoS}</span>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right">{I.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right">{missing ? '—' : dropV.toFixed(1)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${missing ? 'text-orange-600' : (cableTooSmall ? 'text-red-600' : (isDanger ? 'text-red-600' : (isWarn ? 'text-amber-600' : 'text-green-600')))}`}>
                              {missing ? 'À renseigner' : (cableTooSmall ? `Câble trop faible (max ${maxI}A)` : `${dropPct.toFixed(2)} %`)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-slate-500 mt-2">
                  Recommandation de conception en PV : viser ≤ 1% (pertes). Limite générale souvent utilisée en AC : 3% (réseau privé).

                  

À valider selon contexte (longueur, sections, exigences du client et prescriptions fabricant).
                </p>
              </div>
            </div>
          )}
          {/* Affichage DÉTAILLÉ des MPPT */}
          {stringsAnalysis.length > 0 && (
            <div className="mt-4 p-4 bg-slate-800 rounded-xl text-white shadow-inner">
                <h5 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2">
                   <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span> 
                   Détail de la configuration ({mpptCount} MPPT utilisés)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                   {stringsAnalysis.map((mppt, idx) => {
                       const isLowVmp = mppt.vmpHot < details.vminMppt;
                       const isNearVmp = !isLowVmp && mppt.vmpHot <= (details.vminMppt * 1.05);
                       const isHighVoc = mppt.vocCold > details.vmaxInverter;
                       const ratioVoc = details.vmaxInverter > 0 ? (mppt.vocCold / details.vmaxInverter) : 0;
                       const isNearVoc = !isHighVoc && (mppt.isVoltageWarning || ratioVoc >= 0.95);
                       return (
                           <div key={idx} className={`p-3 rounded-lg border relative overflow-hidden transition-colors ${isLowVmp ? (isMicroInverter ? 'bg-orange-900/30 border-orange-500/50' : 'bg-red-900/30 border-red-500/50') : 'bg-slate-700/50 border-slate-600/50'}`}>
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <span className="block text-[11px] font-black text-white">MPPT #{mppt.mpptIndex}</span>
                                    <span className="block text-[9px] font-bold text-orange-300 truncate w-32" title={mppt.composition}>{mppt.composition}</span>
                                 </div>
                                 <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${isLowVmp ? (isMicroInverter ? 'bg-orange-500 text-white' : 'bg-red-500 text-white') : 'bg-blue-400/10 text-blue-400'}`}>
                                    {mppt.totalPanelCount} Pan.
                                 </span>
                              </div>
                              
                              <div className="space-y-1">
                                  <div className="flex justify-between items-baseline">
                                     <span className="text-[9px] text-slate-400 uppercase font-bold">Voc (Froid)</span>
                                     <span className={`text-[10px] font-mono font-bold ${isHighVoc ? 'text-red-400' : (isNearVoc ? 'text-amber-300 font-black' : 'text-slate-200')}`}>
                                        {(mppt.vocCold).toFixed(1)} V
                                     </span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-600 rounded-full overflow-hidden mb-2">
                                     <div 
                                        className={`h-full transition-all ${isHighVoc ? 'bg-red-500' : (isNearVoc ? 'bg-amber-400' : 'bg-blue-500')}`} 
                                        style={{ width: `${Math.min(100, (mppt.vocCold / details.vmaxInverter) * 100)}%` }}
                                     />
                                  </div>

                                  {isNearVoc && (
                                    <div className="text-[9px] font-black text-amber-300 -mt-1 mb-2">⚠️ Proche limite Voc (≥95%)</div>
                                  )}

                                  <div className="flex justify-between items-baseline border-t border-slate-600/50 pt-1">
                                     <span className="text-[9px] text-slate-400 uppercase font-bold">Vmp (Chaud)</span>
                                     <span className={`text-[10px] font-mono font-bold ${isLowVmp ? (isMicroInverter ? 'text-orange-300 font-black' : 'text-red-500 animate-pulse font-black') : (isNearVmp ? 'text-amber-300 font-black' : 'text-green-300')}`}>
                                        {(mppt.vmpHot).toFixed(1)} V
                                     </span>
                                  </div>

                                  {isNearVmp && (
                                    <div className="text-[9px] font-black text-amber-300 mt-1">⚠️ Proche limite Vmp (≤105% de Vmin MPPT)</div>
                                  )}
                              </div>
                           </div>
                       );
                   })}
                </div>
                
                {/* POP-UP ERREUR VMP */}
                {lowVoltageErrors.length > 0 && (
                    <div className={`mt-4 p-4 border-2 rounded-lg ${isMicroInverter ? 'bg-orange-600/15 border-orange-500' : 'bg-red-600/20 border-red-500'} `}>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h4 className={`${isMicroInverter ? 'text-orange-300' : 'text-red-400'} font-black uppercase text-xs mb-1`}>
                                  {isMicroInverter ? 'Avertissement : tension basse (micro-onduleur)' : 'Attention : Configuration Incompatible'}
                                </h4>
                                {lowVoltageErrors.map((err, i) => (
                                    <p key={i} className="text-[11px] font-bold text-white leading-tight mb-1">
                                        MPPT #{err.mpptIndex} : valeur VMP à chaud ({err.vmpHot.toFixed(1)}V) 
                                        {isMicroInverter ? 'en dessous de la plage MPPT recommandée.' : 'Non conforme.'}
                                        <br/>
                                        <span className={`${isMicroInverter ? 'text-orange-200' : 'text-red-200'} font-normal italic`}>
                                          Se reporter à la notice constructeur (Min MPPT: {details.vminMppt}V).
                                        </span>
                                    </p>
                                ))}
                                {!isMicroInverter && (
                                  <p className="text-[9px] text-red-300 mt-2 border-t border-red-500/50 pt-2 font-bold uppercase">
                                      Veuillez ajouter des panneaux sur ce MPPT pour augmenter la tension.
                                  </p>
                                )}
                                {isMicroInverter && (
                                  <p className="text-[9px] text-orange-200 mt-2 border-t border-orange-500/40 pt-2 font-bold">
                                    Sur micro-onduleurs, c'est un indicateur de fonctionnement/performance (production réduite ou arrêts possibles par forte chaleur).
                                  </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}
          
          {voltageError && (
              <div className="mt-3 bg-red-100 border border-red-200 p-3 rounded-lg flex items-start gap-3">
                  <span className="text-xl">⚡</span>
                  <div className="text-xs text-red-900 leading-tight">
                      <b>ERREUR DE TENSION :</b> La tension dépasse la limite de sécurité de l'onduleur sur au moins une chaîne.
                      <br/><span className="font-bold">Solution :</span> Réduisez le nombre de panneaux sur la chaîne concernée.
                  </div>
              </div>
          )}
        </section>

        {/* Section 2: Chute de tension AC (inchangé) */}
        <section>
          <div className="flex justify-between items-start mb-3">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">2. Liaison AC (Liaison Tableau)</h4>
            {(() => {
              const du = voltageDrop;
              const status = du <= 1 ? 'ok' : du <= 3 ? 'warn' : 'bad';
              const cls = status === 'ok'
                ? 'bg-green-100 text-green-700'
                : status === 'warn'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-red-100 text-red-700';
              const label = status === 'ok'
                ? 'ΔU ≤ 1% (recommandé)'
                : status === 'warn'
                ? '1% < ΔU ≤ 3% (toléré)'
                : 'ΔU > 3% (non conforme)';
              return (
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${cls}`}>{label}</span>
              );
            })()}
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-2">Calcul de la chute de tension ($\Delta U$) :</p>
              <p className="text-[11px] text-slate-500 mb-2">
                <b>L</b> correspond à la distance entre le <b>coffret AC photovoltaïque</b> et le <b>point de raccordement</b>
                <br/>
                <span className="italic">Référence : en photovoltaïque, le guide UTE C 15-712-1 recommande de viser ~1% sur la liaison AC (et de rester ≤ 3% pour éviter des pertes et un refus de conformité selon les pratiques Consuel). En parallèle, la NF C 15-100 fixe des limites générales de chute de tension (3% éclairage / 5% autres circuits) côté installation intérieure.</span>
                (tableau principal / disjoncteur de branchement).
              </p>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                Formula: $\Delta U = (L \times I \times \rho \times coeff) / S$ <br/>
                $\rho$ (cuivre) = 0.023 $\Omega \cdot mm^2/m$ <br/>
                $I$ estimé = {(totalPowerW / (isThreePhase ? 400 * 1.732 : 230)).toFixed(1)} A
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600">Section retenue :</span>
                <span className="font-bold text-blue-600">{acSection} mm²</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Perte calculée :</span>
                <span className={`font-bold ${voltageDrop > 1 ? 'text-orange-600' : 'text-slate-900'}`}>{voltageDrop.toFixed(2)} %</span>
              </div>
            </div>
          </div>

          {acProtectionStatus === 'info' && (
            <div className="mt-3 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
              🟠 Information — conditions de pose : section {acSection}mm² OK en conditions usuelles avec In={breakerRefA}A.
              <div className="font-normal text-[10px] text-amber-800/80 mt-1">
                Vérifier en cas de pose défavorable (encastrée, température élevée, regroupement de câbles). En cas de doute, surdimensionner la section.
              </div>
            </div>
          )}

          {acProtectionStatus === 'danger' && (
            <div className="mt-3 text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 rounded p-2">
              ⚠️ Non conforme : In={breakerRefA}A trop élevé pour {acSection}mm².
              <div className="font-normal text-[10px] text-red-700/80 mt-1">
                Augmenter la section (souvent pour respecter la protection) ou revoir le calibre si le courant d’utilisation le permet.
              </div>
            </div>
          )}
        </section>

        {microBranchesReport && microBranchesReport.branches?.length > 0 && (
          <section>
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">2b. Branches Micro-onduleurs (AC)</h4>
              <span className={`px-2 py-1 rounded text-[10px] font-bold ${microBranchesReport.errors.length ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {microBranchesReport.errors.length ? 'CONFIG À CORRIGER' : 'OK'}
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="text-xs text-slate-600 mb-2">
                Micros requis: <b>{microBranchesReport.requiredMicros}</b> • Micros configurés: <b>{microBranchesReport.totalMicrosConfigured}</b> • Puissance micro: <b>{microBranchesReport.microPowerVA} VA</b>
              </div>
              {(microBranchesReport.errors.length > 0 || microBranchesReport.warnings.length > 0) && (
                <div className="mb-3 space-y-1">
                  {microBranchesReport.errors.map((e, i) => (
                    <div key={`mb-e-${i}`} className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 rounded p-2">⚠️ {e}</div>
                  ))}
                  {microBranchesReport.warnings.map((w, i) => (
                    <div key={`mb-w-${i}`} className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-100 rounded p-2">ℹ️ {w}</div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-[10px] text-slate-600 uppercase bg-white border border-slate-200">
                    <tr>
                      <th className="p-2 text-left">Branche</th>
                      {project.inverterConfig.phase === 'Tri' && <th className="p-2 text-left">Phase</th>}
                      <th className="p-2 text-center"># Micros</th>
                      <th className="p-2 text-center">Longueur (m)</th>
                      <th className="p-2 text-center">Section (mm²)</th>
                      <th className="p-2 text-center">I (A)</th>
                      <th className="p-2 text-center">ΔU (V)</th>
                      <th className="p-2 text-center">ΔU (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {microBranchesReport.branches.map((b) => (
                      <tr key={b.branchId} className="border-b border-slate-100">
                        <td className="p-2 font-bold text-slate-700">{b.name}</td>
                        {project.inverterConfig.phase === 'Tri' && <td className="p-2">{b.phase}</td>}
                        <td className="p-2 text-center font-mono">{b.microCount}</td>
                        <td className="p-2 text-center font-mono">{b.cableLengthM}</td>
                        <td className="p-2 text-center font-mono">{b.cableSectionMm2}</td>
                        <td className="p-2 text-center font-mono">{b.currentA.toFixed(1)}</td>
                        <td className="p-2 text-center font-mono">{b.dropV.toFixed(1)}</td>
                        <td className={`p-2 text-center font-black ${b.dropPercent > 1 ? 'text-orange-600' : 'text-green-700'}`}>{b.dropPercent.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Ratio DC/AC (inchangé) */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">3. Ratio de dimensionnement Puissance</h4>
            <span className={`text-[10px] font-black px-2 py-1 rounded border ${ratioPercent >= 100 && ratioPercent <= 130 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
               {barStatusText}
            </span>
          </div>
          
          <div className={`p-4 rounded-lg border transition-all duration-500 ${ratioCritical ? 'bg-red-50 border-red-300 ring-2 ring-red-200 shadow-lg' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-slate-500">Puissance DC: <b className="text-slate-700">{totalPowerW} Wp</b></span>
                  <span className="text-slate-500">Puissance AC: <b className="text-slate-700">{details.maxAcPower || 'Auto'} VA</b></span>
                </div>
                <div className="relative h-4 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <div className="absolute top-0 bottom-0 bg-green-500/10 border-l border-r border-green-500/30" style={{ left: `${(100/160)*100}%`, width: `${(30/160)*100}%` }}></div>
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${barColor} shadow-sm`} 
                    style={{ width: `${barWidth}%` }} 
                  />
                  <div className="absolute top-0 bottom-0 left-[62.5%] border-l border-white/50 w-px h-full"></div>
                  <div className="absolute top-0 bottom-0 left-[81.25%] border-l border-slate-400/30 w-px h-full"></div>
                </div>
                <div className="flex justify-between text-[8px] text-slate-400 mt-1 font-mono">
                    <span>0%</span>
                    <span className="pl-4">100% (Eq)</span>
                    <span className="pl-2">130% (Max)</span>
                    <span>160%+</span>
                </div>
              </div>
              <div className={`text-center bg-white border px-4 py-2 rounded-lg ${ratioCritical ? 'border-red-400' : ''}`}>
                <div className={`text-lg font-black ${ratioCritical ? 'text-red-600' : 'text-slate-800'}`}>{ratioPercent.toFixed(0)}%</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">Ratio DC/AC</div>
              </div>
            </div>
            
            {ratioCritical && (
                <div className="mt-4 p-3 bg-white/80 rounded border border-red-200 flex gap-3 items-start animate-scale-in">
                    <span className="text-xl">🚨</span>
                    <div className="text-xs text-red-900 leading-snug">
                        <b className="uppercase">Alerte Ratio Critique (&gt; 130%) :</b> 
                        L'onduleur est trop petit par rapport à la puissance des panneaux.
                        <br/>
                        <span className="font-bold">Risque de CLIPPING :</span> L'onduleur va plafonner et "couper" la production excédentaire.
                        <br/>
                        <span className="mt-1 block font-black text-red-700 italic">👉 Veuillez choisir un onduleur plus puissant ou réduire le nombre de panneaux.</span>
                    </div>
                </div>
            )}
          </div>

          <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <button 
                onClick={() => setShowDimensionGuide(!showDimensionGuide)}
                className="w-full bg-slate-200/50 px-4 py-3 flex items-center justify-between hover:bg-slate-200 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs shadow-inner">i</div>
                    <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Guide : Comprendre le dimensionnement</h5>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showDimensionGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {showDimensionGuide && (
                <div className="p-5 space-y-6 text-slate-600 leading-snug animate-scale-in text-xs">
                    {ratioPercent < 100 && (
                        <div>
                            <h5 className="font-bold text-blue-700 mb-1 flex items-center gap-2">
                                <span className="bg-blue-100 px-2 rounded text-[10px] border border-blue-200">Situation : Sous-dimensionné ({ratioPercent.toFixed(0)}%)</span>
                            </h5>
                            <p className="pl-2 border-l-2 border-blue-200 text-slate-600">
                                Votre champ PV est moins puissant que l'onduleur. <strong>L'installation est fonctionnelle et sécurisée</strong>, mais l'onduleur est techniquement sur-calibré par rapport aux panneaux.
                                <br/>
                                <em>Impact :</em> Surcoût inutile à l'achat de l'onduleur. Vous pourriez ajouter des panneaux sans changer d'appareil.
                            </p>
                        </div>
                    )}
                    
                    {ratioPercent >= 100 && ratioPercent <= 130 && (
                        <div>
                            <h5 className="font-bold text-green-700 mb-1 flex items-center gap-2">
                                <span className="bg-green-100 px-2 rounded text-[10px] border border-green-200">Situation : Optimale ({ratioPercent.toFixed(0)}%)</span>
                            </h5>
                            <p className="pl-2 border-l-2 border-green-200 text-slate-600">
                                C'est la norme recommandée (110% - 130%). On installe plus de puissance panneaux (Wc) que la puissance de sortie de l'onduleur (VA).
                                <br/><strong>Pourquoi ?</strong> Les panneaux produisent rarement à 100% (nuages, chaleur, matin/soir). 
                                Ce ratio permet à l'onduleur de démarrer plus tôt le matin et de produire plus tard le soir, maximisant la production globale.
                            </p>
                        </div>
                    )}

                    {ratioPercent > 130 && (
                        <div>
                            <h5 className="font-bold text-red-700 mb-1 flex items-center gap-2">
                                <span className="bg-red-100 px-2 rounded text-[10px] border border-red-200">Situation : Critique ({ratioPercent.toFixed(0)}%)</span>
                            </h5>
                            <p className="pl-2 border-l-2 border-red-200 text-slate-600">
                                Le champ PV est beaucoup trop puissant pour l'onduleur.
                                <br/><strong>Risque :</strong> Ecrêtage important (perte de production en été) et fatigue prématurée de l'onduleur due à la chaleur constante à pleine charge.
                            </p>
                        </div>
                    )}
                </div>
            )}
          </div>
        </section>
      </div>

      {/* --- MODALE DÉTAILS CALCULS (inchangé sauf données d'entrée) --- */}
      {showCalcDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4 animate-scale-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden relative border border-slate-200">
                <div className="bg-slate-800 text-white p-3 flex justify-between items-center shrink-0 border-b border-slate-700 shadow-md z-10">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <span className="text-orange-400">🧮</span> Détails des Calculs de Sécurité
                    </h3>
                    <button onClick={() => setShowCalcDetails(false)} className="hover:bg-slate-700 p-1.5 rounded-full bg-slate-700/50 transition-colors border border-slate-600"><XIcon className="w-5 h-5"/></button>
                </div>
                
                <div className="p-4 space-y-4 text-sm text-slate-700 overflow-y-auto flex-1 bg-slate-50/30">
                    
                    {/* 1. DONNÉES D'ENTRÉE */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="font-black text-slate-800 uppercase text-[10px] mb-2 border-b border-slate-100 pb-1 text-center bg-slate-50 -mx-3 -mt-3 p-2 rounded-t-lg">1. Données d'Entrée (Conditions Extrêmes)</h4>
                        <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[11px]">
                            <div className="flex justify-between"><span>Temp. Min Locale :</span> <span className="font-bold">{tempMin}°C</span></div>
                            <div className="flex justify-between"><span>Temp. Max Ambiante :</span> <span className="font-bold">{climate.tempMaxAmb}°C</span></div>
                            <div className="flex justify-between"><span>Voc Panneau :</span> <span className="font-bold">{vocSTC} V</span></div>
                            <div className="flex justify-between"><span>Vmp Panneau :</span> <span className="font-bold">{vmpSTC} V</span></div>
                            <div className="flex justify-between"><span>Coeff. Temp (Voc) :</span> <span className="font-bold text-blue-600">{coeffVoc} %/°C</span></div>
                            <div className="flex justify-between"><span>Chaîne max retenue :</span> <span className="font-bold">{details.maxPanelsInAString} pan.</span></div>
                        </div>
                    </div>

                    {/* 2. CALCUL TENSION MAX (FROID) */}
                    <div>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px]">2</span>
                            Calcul Tension Max (Voc @ Froid)
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-2 italic border-l-2 border-blue-200 pl-2">Tension circuit ouvert la plus élevée possible en hiver.</p>
                        
                        <div className="font-mono text-[10px] bg-slate-800 text-green-400 p-2 rounded-lg overflow-x-auto shadow-inner mb-1">
                            Voc_max = Somme(Voc_panneau_i) sur le MPPT
                        </div>
                        <div className="pl-2 space-y-0.5 font-mono text-[10px] text-slate-600">
                            <p>= {vocSTC} × [1 + ({coeffVoc}/100) × ({tempMin} - 25)] × {details.maxPanelsInAString} (approx)</p>
                            <p className="font-bold text-slate-900 bg-yellow-100 inline-block px-1 rounded border border-yellow-200 mt-1">= {details.vocCold} V (Total MPPT Max)</p>
                        </div>
                        <div className="mt-1 text-[10px] flex items-center gap-2 justify-end">
                            <span className="font-bold text-slate-500">Limite Onduleur :</span> 
                            <span className={details.vocCold > details.vmaxInverter ? "text-red-600 font-black bg-red-50 px-1 rounded" : "text-green-600 font-black bg-green-50 px-1 rounded"}>{details.vmaxInverter} V</span>
                            {details.vocCold > details.vmaxInverter ? "❌ DANGER" : "✅ OK"}
                        </div>
                    </div>

                    {/* 3. CALCUL TENSION MIN (CHAUD) */}
                    <div className="pb-1">
                        <h4 className="font-black text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-2">
                            <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-[10px]">3</span>
                            Calcul Tension Min (Vmp @ Chaud)
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-2 italic border-l-2 border-orange-200 pl-2">Tension de production la plus basse en été (Tcell estimated).</p>
                        
                        <div className="font-mono text-[10px] bg-slate-800 text-blue-300 p-2 rounded-lg overflow-x-auto shadow-inner mb-1">
                            Vmp_min = Somme(Vmp_panneau_i) sur le MPPT
                        </div>
                        <div className="pl-2 space-y-0.5 font-mono text-[10px] text-slate-600">
                            <p>= {vmpSTC} × [1 + ({coeffVoc}/100) × ({tempCellHot} - 25)] × {details.maxPanelsInAString} (approx)</p>
                            <p className="font-bold text-slate-900 bg-blue-50 inline-block px-1 rounded border border-blue-200 mt-1">= {details.vmpHot} V (Total MPPT Min)</p>
                        </div>
                        <div className="mt-1 text-[10px] flex items-center gap-2 justify-end">
                            <span className="font-bold text-slate-500">
                              {isMicroInverter ? 'Plage MPPT (reco fabricant) :' : 'Plage MPPT Min :'}
                            </span>
                            <span className={details.vmpHot < details.vminMppt ? "text-orange-600 font-black bg-orange-50 px-1 rounded" : "text-green-600 font-black bg-green-50 px-1 rounded"}>{details.vminMppt} V</span>
                            {details.vmpHot < details.vminMppt
                              ? (isMicroInverter ? "⚠️ A optimiser" : "❌ NON CONFORME")
                              : "✅ OK"}
                        </div>
                    </div>

                </div>
                <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0 z-10">
                    <button onClick={() => setShowCalcDetails(false)} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold hover:bg-slate-700 transition-colors shadow-lg active:scale-95 text-sm">Fermer la fenêtre</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CalculationAudit;