import { InverterBrand } from '../types';

export type MicroBranchRule = {
  /** Max de micro-onduleurs autorisés par branche (recommandation constructeur). */
  maxMicrosPerBranch: number;
  /** Calibre de protection typique de la branche (A) – utilisé pour pré-sélection coffret. */
  recommendedBranchBreakerA: number;
  /** Section par défaut (mm²) pour le calcul de chute de tension. */
  defaultCableSectionMm2: number;
  /** Remarques affichables (optionnel). */
  note?: string;
};

/**
 * Règles "terrain" basées sur les recommandations visibles dans l'application.
 * Objectif: donner un garde-fou + calculs cohérents, sans prétendre remplacer
 * la notice officielle.
 */
export const MICRO_BRANCH_RULES_BY_MODEL: Record<string, MicroBranchRule> = {
  // Enphase – hypothèse: disjoncteur 20A, câble 2.5mm²
  'ENP-IQ8MC-72-M-INT': {
    maxMicrosPerBranch: 11,
    recommendedBranchBreakerA: 20,
    defaultCableSectionMm2: 2.5,
    note: 'Exemple terrain: Disjoncteur 20A monophasé, câble 2.5mm².'
  },
  'ENP-IQ8HC-72-M-INT': {
    maxMicrosPerBranch: 9,
    recommendedBranchBreakerA: 20,
    defaultCableSectionMm2: 2.5,
    note: 'Exemple terrain: Disjoncteur 20A monophasé, câble 2.5mm².'
  },
  'ENP-IQ8P-72-2-INT': {
    maxMicrosPerBranch: 8,
    recommendedBranchBreakerA: 20,
    defaultCableSectionMm2: 2.5,
    note: 'Exemple terrain: Disjoncteur 20A monophasé, câble 2.5mm².'
  },

  // APSystems – hypothèse: bus 2.5mm² ~ 20A
  'APS-DS3': {
    maxMicrosPerBranch: 5,
    recommendedBranchBreakerA: 20,
    defaultCableSectionMm2: 2.5,
    note: 'Bus AC 2.5mm² (≈20A) : 5 unités max / branche.'
  },
  'APS-DS3-H': {
    maxMicrosPerBranch: 5,
    recommendedBranchBreakerA: 20,
    defaultCableSectionMm2: 2.5,
    note: 'Bus AC 2.5mm² (≈20A) : 4 à 5 unités max / branche.'
  },

  // FoxESS micro – hypothèse: câble équivalent 6mm² + disj 32A
  'FOX-MICRO-1000': {
    maxMicrosPerBranch: 7,
    recommendedBranchBreakerA: 32,
    defaultCableSectionMm2: 6,
    note: 'Exemple terrain: 7 micros max sur câble équiv. 6mm² avec disj jusqu’à 32A.'
  }
};

export function getMicroBranchRule(brand: InverterBrand, modelId?: string): MicroBranchRule | null {
  if (!modelId) return null;
  const rule = MICRO_BRANCH_RULES_BY_MODEL[modelId];
  if (rule) return rule;

  // Fallback: marques micro connues, valeurs prudentes
  if (brand === InverterBrand.ENPHASE) {
    return { maxMicrosPerBranch: 8, recommendedBranchBreakerA: 20, defaultCableSectionMm2: 2.5 };
  }
  if (brand === InverterBrand.APSYSTEMS) {
    return { maxMicrosPerBranch: 5, recommendedBranchBreakerA: 20, defaultCableSectionMm2: 2.5 };
  }
  if (brand === InverterBrand.FOXESS && modelId.includes('MICRO')) {
    return { maxMicrosPerBranch: 7, recommendedBranchBreakerA: 32, defaultCableSectionMm2: 6 };
  }
  return null;
}
