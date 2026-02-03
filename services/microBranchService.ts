import { InverterBrand, MicroBranch, MicroBranchPhase, Project } from '../types';
import { getMicroBranchRule } from '../data/microBranchRules';

const COPPER_RESISTIVITY_OHM_MM2_PER_M = 0.023; // cohérent avec le calcul affiché dans l'audit existant

export type MicroBranchCalc = {
  branchId: string;
  name: string;
  phase: MicroBranchPhase;
  microCount: number;
  maxAllowed: number;
  cableLengthM: number;
  cableSectionMm2: number;
  currentA: number;
  dropV: number;
  dropPercent: number;
  isWithinMaxMicros: boolean;
  isDropOk: boolean;
};

export type MicroBranchesReport = {
  requiredMicros: number;
  microPowerVA: number;
  totalMicrosConfigured: number;
  ruleNote?: string;
  branches: MicroBranchCalc[];
  errors: string[];
  warnings: string[];
};

function safeNumber(n: any, fallback = 0): number {
  const v = typeof n === 'number' ? n : parseFloat(String(n));
  return Number.isFinite(v) ? v : fallback;
}

export function computeRequiredMicros(project: Project): number {
  const totalPanels = project.fields.reduce((sum, f) => {
    const rows = f.panels.rows || 0;
    const cols = f.panels.columns || 0;
    const base = rows * cols;
    const conf = f.panels.rowConfiguration;
    return sum + (conf && conf.length ? conf.reduce((a, b) => a + (b || 0), 0) : base);
  }, 0);

  // Diviseur: nombre de panneaux gérés par un micro
  let divisor = 1;
  if (project.inverterConfig.brand === InverterBrand.APSYSTEMS) divisor = 2;
  if (project.inverterConfig.brand === InverterBrand.FOXESS && project.inverterConfig.model?.includes('2000')) divisor = 4;
  else if (project.inverterConfig.brand === InverterBrand.FOXESS && project.inverterConfig.model?.includes('MICRO')) divisor = 2;

  return Math.max(0, Math.ceil(totalPanels / divisor));
}

export function ensureDefaultMicroBranches(project: Project): MicroBranch[] {
  const requiredMicros = computeRequiredMicros(project);
  const rule = getMicroBranchRule(project.inverterConfig.brand, project.inverterConfig.model);
  const defaultSection = rule?.defaultCableSectionMm2 ?? 2.5;
  const phase: MicroBranchPhase = project.inverterConfig.phase === 'Tri' ? 'L1' : 'Mono';

  const existing = project.inverterConfig.microBranches;
  if (existing && existing.length) {
    return existing.map(b => ({
      ...b,
      microCount: safeNumber(b.microCount, 0),
      cableLengthM: safeNumber(b.cableLengthM, 0),
      cableSectionMm2: safeNumber(b.cableSectionMm2, defaultSection),
      phase: (b.phase || phase) as MicroBranchPhase,
    }));
  }

  return [
    {
      id: 'branch-1',
      name: 'Branche 1',
      phase,
      microCount: requiredMicros,
      cableLengthM: 0,
      cableSectionMm2: defaultSection,
    }
  ];
}

export function calculateVoltageDropPercentSinglePhase(lengthM: number, currentA: number, sectionMm2: number, voltageV = 230): { dropV: number; dropPercent: number } {
  const L = Math.max(0, lengthM);
  const I = Math.max(0, currentA);
  const S = Math.max(0.1, sectionMm2);
  // Monophasé: aller-retour -> coeff 2
  const dropV = (2 * COPPER_RESISTIVITY_OHM_MM2_PER_M * L * I) / S;
  const dropPercent = voltageV > 0 ? (dropV / voltageV) * 100 : 0;
  return { dropV, dropPercent };
}

export function computeMicroBranchesReport(project: Project, microPowerVA: number): MicroBranchesReport | null {
  const brand = project.inverterConfig.brand;
  const modelId = project.inverterConfig.model;

  const isMicroBrand = brand === InverterBrand.ENPHASE || brand === InverterBrand.APSYSTEMS || (brand === InverterBrand.FOXESS && (modelId || '').includes('MICRO'));
  if (!isMicroBrand) return null;

  const requiredMicros = computeRequiredMicros(project);
  const branches = ensureDefaultMicroBranches(project);
  const rule = getMicroBranchRule(brand, modelId);
  const maxAllowed = rule?.maxMicrosPerBranch ?? 0;

  const errors: string[] = [];
  const warnings: string[] = [];

  const branchCalcs: MicroBranchCalc[] = branches.map((b, idx) => {
    const microCount = safeNumber(b.microCount, 0);
    const cableLengthM = safeNumber(b.cableLengthM, 0);
    const cableSectionMm2 = safeNumber(b.cableSectionMm2, rule?.defaultCableSectionMm2 ?? 2.5);
    const phase: MicroBranchPhase = (b.phase || (project.inverterConfig.phase === 'Tri' ? 'L1' : 'Mono')) as MicroBranchPhase;
    const currentA = (microCount * microPowerVA) / 230;
    const { dropV, dropPercent } = calculateVoltageDropPercentSinglePhase(cableLengthM, currentA, cableSectionMm2, 230);
    const isWithinMaxMicros = maxAllowed > 0 ? microCount <= maxAllowed : true;
    const isDropOk = dropPercent <= 1; // seuil cohérent avec l'audit existant (liaison AC)
    return {
      branchId: b.id,
      name: b.name || `Branche ${idx + 1}`,
      phase,
      microCount,
      maxAllowed: maxAllowed || 0,
      cableLengthM,
      cableSectionMm2,
      currentA,
      dropV,
      dropPercent,
      isWithinMaxMicros,
      isDropOk,
    };
  });

  const totalMicrosConfigured = branchCalcs.reduce((s, b) => s + b.microCount, 0);
  // Répartition incomplète => bloquant (export PDF et audit)
  if (requiredMicros > 0 && totalMicrosConfigured !== requiredMicros) {
    errors.push(`Répartition branches: ${totalMicrosConfigured} micros configurés sur ${requiredMicros} requis.`);
  }

  // Longueur non renseignée sur une branche active => bloquant
  const missingLengths = branchCalcs.filter(b => b.microCount > 0 && b.cableLengthM <= 0);
  if (missingLengths.length) {
    errors.push(
      ...missingLengths.map(b => `${b.name}: longueur câble non renseignée (0 m). Renseigner la distance micro → coffret AC.`)
    );
  }

  const over = branchCalcs.filter(b => !b.isWithinMaxMicros);
  if (over.length) {
    errors.push(
      ...over.map(b => `${b.name}: ${b.microCount} micros > max ${b.maxAllowed} (selon règle ${brand}${modelId ? ` / ${modelId}` : ''}).`)
    );
  }

  const drops = branchCalcs.filter(b => b.cableLengthM > 0 && b.dropPercent > 1);
  if (drops.length) {
    warnings.push(
      ...drops.map(b => `${b.name}: chute de tension estimée ${b.dropPercent.toFixed(2)}% (> 1%). Augmenter section ou réduire longueur.`)
    );
  }

  // --- Triphasé: recommandation d'équilibrage sur 3 phases ---
  const isTri = project.inverterConfig.phase === 'Tri';
  if (isTri) {
    if (branchCalcs.length < 3) {
      warnings.push(`Triphasé: répartition recommandée sur 3 branches (L1/L2/L3) pour équilibrer les phases.`);
    }

    const byPhase: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
    for (const b of branchCalcs) {
      if (b.phase === 'L1' || b.phase === 'L2' || b.phase === 'L3') byPhase[b.phase] += b.microCount;
    }
    const counts = [byPhase.L1, byPhase.L2, byPhase.L3];
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max > 0 && min === 0) {
      warnings.push(`Triphasé: une phase n'est pas alimentée (répartition micros L1/L2/L3 = ${byPhase.L1}/${byPhase.L2}/${byPhase.L3}). Rééquilibrer recommandé.`);
    } else if (max - min >= 2) {
      warnings.push(`Triphasé: répartition peu équilibrée (L1/L2/L3 = ${byPhase.L1}/${byPhase.L2}/${byPhase.L3}). Viser un écart ≤ 1 micro.`);
    }
  }

  return {
    requiredMicros,
    microPowerVA: microPowerVA || 0,
    totalMicrosConfigured,
    ruleNote: rule?.note,
    branches: branchCalcs,
    errors,
    warnings,
  };
}
