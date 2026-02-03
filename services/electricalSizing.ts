// Centralised electrical sizing helpers.
// Goal: ensure UI, Audit, BOM and PDF use the exact same rules.

import { getProtectionStatusForSection } from './standardsService';
export const RHO_CU = 0.023; // Ω·mm²/m

// DC sections offered in the UI (2.5 kept for manual forcing; Auto starts at 6).
export const DC_SECTIONS_MM2 = [2.5, 6, 10, 16] as const;

export type DcSizingStatus = 'ok' | 'warn' | 'danger' | 'missing';

export function computeDcDrop(
  lengthM: number,
  currentA: number,
  sectionMm2: number,
  baseV: number
): { duV: number; duPct: number } {
  if (lengthM <= 0 || currentA <= 0 || sectionMm2 <= 0 || baseV <= 0) return { duV: 0, duPct: 0 };
  const duV = (2 * lengthM * currentA * RHO_CU) / sectionMm2;
  const duPct = (duV / baseV) * 100;
  return { duV, duPct };
}

// Option B validated:
// - Recommendation: aim ≤ 1%
// - Tolerated: 1% < ΔU ≤ 3%
// - Dangerous: ΔU > 3%
// Auto starts at 6 mm².
export function pickAutoDcSectionOptionB(
  lengthM: number,
  currentA: number,
  baseV: number
): number {
  let autoS = 6;
  if (lengthM <= 0 || currentA <= 0 || baseV <= 0) return autoS;
  for (const S of DC_SECTIONS_MM2.filter(s => s >= 6)) {
    const { duPct } = computeDcDrop(lengthM, currentA, Number(S), baseV);
    autoS = Number(S);
    if (duPct <= 3) break;
  }
  return autoS;
}

export function getDcSizingStatus(lengthM: number, duPct: number): DcSizingStatus {
  if (lengthM <= 0) return 'missing';
  if (duPct > 3) return 'danger';
  if (duPct > 1) return 'warn';
  return 'ok';
}

// --- AC helpers (shared by UI + Audit + BOM + PDF) ---

export const AC_SECTIONS_MM2 = [2.5, 6, 10, 16, 25] as const;

// AGCP (disjoncteur de branchement) values in France are commonly 15/30/45/60A (mono)
// or other contractual values. Those are not always the same as the *commercial* breaker
// ratings used in AC PV boxes (calibres normalisés). In the app we map AGCP to the
// commercial rating typically retained for the AC head protection.
// IMPORTANT: this mapping is different from normalizeBreakerA(minA, ...) which rounds UP.
export function agcpToCommercialBreakerA(agcpA: number, isThreePhase: boolean): number | null {
  if (!agcpA || agcpA <= 0) return null;
  if (isThreePhase) {
    // Tri: typical ladder used in our coffrets AC PV
    if (agcpA <= 25) return 16;
    if (agcpA <= 30) return 20;
    if (agcpA <= 40) return 25;
    if (agcpA <= 50) return 32;
    return 40;
  }
  // Mono: contractual 30/45/60A -> commercial 32/40/63A
  if (agcpA <= 30) return 32;
  if (agcpA <= 45) return 40;
  return 63;
}

export function normalizeBreakerA(minA: number, isThreePhase: boolean): number {
  const available = isThreePhase ? [16, 20, 25, 32, 40] : [16, 20, 32, 40, 63];
  return available.find(v => v >= Math.max(0, minA)) ?? available[available.length - 1];
}

export function computeAcDropPercent(
  powerVA: number,
  distanceMeters: number,
  sectionMm2: number,
  isThreePhase: boolean
): number {
  if (powerVA <= 0 || distanceMeters <= 0 || sectionMm2 <= 0) return 0;
  const voltage = isThreePhase ? 400 : 230;
  const current = isThreePhase ? powerVA / (voltage * 1.732) : powerVA / voltage;
  const dropV = isThreePhase ? (Math.sqrt(3) * distanceMeters * current * RHO_CU) / sectionMm2 : (2 * distanceMeters * current * RHO_CU) / sectionMm2;
  return (dropV / voltage) * 100;
}

export function pickAutoAcSectionMm2(params: {
  powerVA: number;
  lengthM: number;
  isThreePhase: boolean;
  breakerA: number; // normalized
  minAutoSectionMm2?: number; // optional floor (business rules)
}): number {
  const { powerVA, lengthM, isThreePhase, breakerA } = params;
  const minAuto = params.minAutoSectionMm2 ?? 2.5;

  // 1) conservative: try to achieve ΔU ≤ 1% AND protection status "ok"
  for (const s of AC_SECTIONS_MM2) {
    const S = Number(s);
    if (S < minAuto) continue;
    const dup = computeAcDropPercent(powerVA, lengthM, S, isThreePhase);
    const status = getProtectionStatusForSection(S, breakerA);
    if (dup <= 1 && status === 'ok') return S;
  }

  // 2) fallback: accept "info" if needed, refuse "danger"
  let chosen = Number(AC_SECTIONS_MM2[0]);
  for (const s of AC_SECTIONS_MM2) {
    const S = Number(s);
    if (S < minAuto) continue;
    chosen = S;
    const dup = computeAcDropPercent(powerVA, lengthM, S, isThreePhase);
    const status = getProtectionStatusForSection(S, breakerA);
    if (dup <= 1 && status !== 'danger') break;
  }
  return chosen;
}
