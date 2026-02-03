export type Phase = 'Mono' | 'Tri';

// Paliers usuels de puissance souscrite (habitation)
export const MONO_KVA_STEPS = [3, 6, 9, 12] as const;
export const TRI_KVA_STEPS = [9, 12, 15, 18, 24, 30, 36] as const;

// Correspondances courantes calibre disjoncteur (AGCP) -> kVA.
// (approximation pratique utilisée pour les projets résidentiels)
const AGCP_TO_KVA_MONO: Record<number, number> = {
  15: 3,
  30: 6,
  45: 9,
  60: 12,
};

const AGCP_TO_KVA_TRI: Record<number, number> = {
  10: 6,
  15: 9,
  20: 12,
  25: 15,
  30: 18,
  40: 24,
  50: 30,
  60: 36,
};

export function kvaFromAgcp(phase: Phase, agcpA?: number): number | null {
  if (!agcpA || agcpA <= 0) return null;
  if (phase === 'Tri') return AGCP_TO_KVA_TRI[agcpA] ?? null;
  return AGCP_TO_KVA_MONO[agcpA] ?? null;
}

export function nextSubscriptionStep(phase: Phase, requiredKva: number): number | null {
  if (!requiredKva || requiredKva <= 0) return null;
  const steps = phase === 'Tri' ? TRI_KVA_STEPS : MONO_KVA_STEPS;
  const found = steps.find((s) => s >= requiredKva);
  return found ?? null;
}

export function maxAllowedKva(phase: Phase): number {
  return phase === 'Tri' ? 36 : 12;
}

export interface SubscriptionStatus {
  phase: Phase;
  projectPowerKwc: number;
  requiredMinKva: number | null;
  recommendedKva: number | null;
  subscribedKva: number | null;
  isOk: boolean | null;
  isOverMaxForPhase: boolean;
}

/**
 * Calcule une recommandation simple :
 * - par défaut, on utilise la puissance crête DC (kWc) comme ordre de grandeur de kVA.
 * - on propose ensuite le palier de puissance souscrite immédiatement supérieur.
 */
export function getSubscriptionStatus(args: {
  phase: Phase;
  projectPowerKwc: number;
  agcpA?: number;
}): SubscriptionStatus {
  const phase = args.phase;
  const projectPowerKwc = Number.isFinite(args.projectPowerKwc) ? args.projectPowerKwc : 0;

  const subscribedKva = kvaFromAgcp(phase, args.agcpA);
  const requiredMinKva = projectPowerKwc > 0 ? projectPowerKwc : null;
  const recommendedKva = requiredMinKva ? nextSubscriptionStep(phase, requiredMinKva) : null;

  const isOverMaxForPhase = !!requiredMinKva && requiredMinKva > maxAllowedKva(phase);

  // On ne peut conclure que si on connait l'abonnement
  const isOk = subscribedKva != null && recommendedKva != null ? subscribedKva >= recommendedKva : null;

  return {
    phase,
    projectPowerKwc,
    requiredMinKva,
    recommendedKva,
    subscribedKva,
    isOk,
    isOverMaxForPhase,
  };
}
