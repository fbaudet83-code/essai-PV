import React, { useMemo } from 'react';
import { InverterBrand, MicroBranch, MicroBranchPhase, Project } from '../types';
import { computeMicroBranchesReport, ensureDefaultMicroBranches } from '../services/microBranchService';

type Props = {
  project: Project;
  microPowerVA: number;
  onUpdate: (branches: MicroBranch[]) => void;
};

// Options de section (AC) – choix volontairement "métier" (pas de 1.5 / 4mm²)
// 2.5mm² minimum, puis sections usuelles.
const SECTION_OPTIONS: number[] = [2.5, 6, 10, 16, 25];

function newBranch(idx: number, phase: MicroBranchPhase, defaultSection: number): MicroBranch {
  return {
    id: `branch-${Date.now()}-${idx}`,
    name: `Branche ${idx}`,
    phase,
    microCount: 0,
    cableLengthM: 0,
    cableSectionMm2: defaultSection,
  };
}

export default function MicroBranchesConfig({ project, microPowerVA, onUpdate }: Props) {
  const isMicro = useMemo(() => {
    const brand = project.inverterConfig.brand;
    const model = project.inverterConfig.model || '';
    return brand === InverterBrand.ENPHASE || brand === InverterBrand.APSYSTEMS || (brand === InverterBrand.FOXESS && model.includes('MICRO'));
  }, [project.inverterConfig.brand, project.inverterConfig.model]);

  const branches = useMemo(() => ensureDefaultMicroBranches(project), [project]);
  const report = useMemo(() => computeMicroBranchesReport({ ...project, inverterConfig: { ...project.inverterConfig, microBranches: branches } }, microPowerVA), [project, branches, microPowerVA]);

  if (!isMicro || !project.inverterConfig.model) return null;
  if (!report) return null;

  const isTri = project.inverterConfig.phase === 'Tri';
  const defaultPhase: MicroBranchPhase = isTri ? 'L1' : 'Mono';
  const defaultSection = branches[0]?.cableSectionMm2 || 2.5;

  const setBranch = (id: string, patch: Partial<MicroBranch>) => {
    const next = branches.map(b => (b.id === id ? { ...b, ...patch } : b));
    onUpdate(next);
  };

  const addBranch = () => {
    onUpdate([...branches, newBranch(branches.length + 1, defaultPhase, defaultSection)]);
  };

  const removeBranch = (id: string) => {
    const next = branches.filter(b => b.id !== id);
    onUpdate(next.length ? next : [newBranch(1, defaultPhase, defaultSection)]);
  };

  const autoDistribute = () => {
    const req = report.requiredMicros;
    if (!req) return;

    // En triphasé, on force une répartition sur 3 phases (L1/L2/L3) – plus pro et plus "terrain".
    if (isTri) {
      const phases: MicroBranchPhase[] = ['L1', 'L2', 'L3'];
      const baseCount = Math.floor(req / 3);
      const remainder = req % 3;
      const targetCounts = [baseCount, baseCount, baseCount].map((v, i) => v + (i < remainder ? 1 : 0));

      // On tente de réutiliser les longueurs/sections déjà saisies (si présentes), par phase.
      const existingByPhase: Record<string, MicroBranch | undefined> = {
        L1: branches.find(b => b.phase === 'L1') || branches[0],
        L2: branches.find(b => b.phase === 'L2') || branches[1],
        L3: branches.find(b => b.phase === 'L3') || branches[2],
      };

      const next: MicroBranch[] = phases.map((ph, idx) => {
        const ex = existingByPhase[ph];
        return {
          id: `branch-auto-${ph}`,
          name: `Branche ${idx + 1}`,
          phase: ph,
          microCount: targetCounts[idx],
          cableLengthM: ex?.cableLengthM ?? 0,
          cableSectionMm2: ex?.cableSectionMm2 ?? defaultSection,
        };
      });

      onUpdate(next);
      return;
    }

    // Mono: répartition selon la règle constructeur (max micros par branche)
    const max = report.branches[0]?.maxAllowed || 0;
    const perBranch = max > 0 ? max : req;
    const needed = Math.max(1, Math.ceil(req / perBranch));
    const base: MicroBranch[] = [];
    let remaining = req;
    for (let i = 0; i < needed; i++) {
      const take = Math.min(perBranch, remaining);
      remaining -= take;
      base.push({
        id: `branch-auto-${i + 1}`,
        name: `Branche ${i + 1}`,
        phase: 'Mono',
        microCount: take,
        cableLengthM: 0,
        cableSectionMm2: defaultSection,
      });
    }
    onUpdate(base);
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm animate-scale-in">
      <div className="flex items-start justify-between gap-3 mb-2 pb-2 border-b border-slate-100">
        <div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Branches micro-onduleurs (AC)</div>
          <div className="text-[11px] font-bold text-slate-700 mt-1">
            Micros requis: <span className="text-purple-700">{report.requiredMicros}</span> • Puissance micro: <span className="text-purple-700">{report.microPowerVA} VA</span>
          </div>
          {report.ruleNote && <div className="text-[10px] text-slate-500 italic mt-1">{report.ruleNote}</div>}
        </div>

        <div className="flex flex-col items-end gap-1">
          <button onClick={autoDistribute} className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded border border-purple-200 hover:bg-purple-200 transition">
            {isTri ? 'Auto-répartition 3 phases' : 'Auto-répartir'}
          </button>
          <button onClick={addBranch} className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 transition">
            + Ajouter
          </button>
        </div>
      </div>

      {(report.errors.length > 0 || report.warnings.length > 0) && (
        <div className="mb-3 space-y-1">
          {report.errors.map((e, i) => (
            <div key={`e-${i}`} className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 rounded p-2">⚠️ {e}</div>
          ))}
          {report.warnings.map((w, i) => (
            <div key={`w-${i}`} className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 rounded p-2">ℹ️ {w}</div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] text-slate-600 uppercase bg-slate-50 border border-slate-200">
            <tr>
              <th className="p-2 text-left">Branche</th>
              {isTri && <th className="p-2 text-left">Phase</th>}
              <th className="p-2 text-center"># Micros</th>
              <th className="p-2 text-center">Longueur (m)</th>
              <th className="p-2 text-center">Section (mm²)</th>
              <th className="p-2 text-center">I estimé (A)</th>
              <th className="p-2 text-center">ΔU (V)</th>
              <th className="p-2 text-center">ΔU (%)</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {report.branches.map((b) => (
              <tr key={b.branchId} className="border-b border-slate-100">
                <td className="p-2 font-bold text-slate-700">{b.name}</td>
                {isTri && (
                  <td className="p-2">
                    <select
                      value={b.phase}
                      onChange={(e) => setBranch(b.branchId, { phase: e.target.value as MicroBranchPhase })}
                      className="w-full p-1 border border-slate-200 rounded bg-white"
                    >
                      <option value="L1">L1</option>
                      <option value="L2">L2</option>
                      <option value="L3">L3</option>
                    </select>
                  </td>
                )}
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    value={b.microCount}
                    onChange={(e) => setBranch(b.branchId, { microCount: parseInt(e.target.value) || 0 })}
                    className={`w-20 p-1 text-center border rounded ${b.isWithinMaxMicros ? 'border-slate-200' : 'border-red-300 bg-red-50'}`}
                    title={b.maxAllowed ? `Max conseillé: ${b.maxAllowed}` : ''}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={b.cableLengthM}
                    onChange={(e) => setBranch(b.branchId, { cableLengthM: parseFloat(e.target.value) || 0 })}
                    className="w-24 p-1 text-center border border-slate-200 rounded"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={b.cableSectionMm2}
                    onChange={(e) => setBranch(b.branchId, { cableSectionMm2: parseFloat(e.target.value) || defaultSection })}
                    className="w-24 p-1 border border-slate-200 rounded bg-white"
                  >
                    {SECTION_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-center font-mono">{b.currentA.toFixed(1)}</td>
                <td className="p-2 text-center font-mono">{b.dropV.toFixed(1)}</td>
                <td className={`p-2 text-center font-black ${b.dropPercent > 1 ? 'text-orange-600' : 'text-green-700'}`}>{b.dropPercent.toFixed(2)}</td>
                <td className="p-2 text-right">
                  <button onClick={() => removeBranch(b.branchId)} className="text-red-500 hover:text-red-700 font-black" title="Supprimer">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        Note: calcul de chute de tension simplifié (monophasé 230V) à titre d'aide. Toujours valider avec la notice constructeur et la NFC 15-100.
      </div>
    </div>
  );
}
