
export interface RoofField {
  id: string;
  name: string;
  roof: Roof;
  panels: PanelConfig;
  railOrientation?: 'Horizontal' | 'Vertical';
}

export interface Project {
  id: string;
  name: string;
  clientAddress: string;
  city: string; 
  postalCode: string;
  altitude: number;
  windZone: WindZone;
  fields: RoofField[];
  system: MountingSystem;
  inverterConfig: InverterConfig;
  evCharger: {
    selected: boolean;
    phase: 'Mono' | 'Tri';
    cableRef?: string;
  };
  distanceToPanel: number; 
  /**
   * (Onduleur centralisé uniquement) distance entre la sortie AC de l'onduleur et le coffret AC photovoltaïque.
   * Permet de dimensionner un 1er tronçon de câble (AC1).
   */
  distanceInverterToAcCoffret?: number;
  /**
   * Optional override for the AC cable section (liaison tableau). If null/undefined,
   * the app uses the recommended section.
   */
  acCableSectionMm2?: number | null;
  /**
   * (Onduleur centralisé uniquement) override section câble AC1 (Onduleur → Coffret AC).
   */
  ac1CableSectionMm2?: number | null;
  userPrices?: { [id: string]: string };
}

export interface ConfiguredString {
  id: string;
  fieldId: string;
  panelCount: number;
  mpptIndex: number;
}

export interface InverterConfig {
  brand: InverterBrand;
  model?: string; 
  configuredStrings?: ConfiguredString[];
  phase?: 'Mono' | 'Tri'; 
  hasBattery?: boolean;
  batteryModel?: string;
  hasBackup?: boolean;
  agcpValue?: number;
  /**
   * Configuration des branches AC (micro-onduleurs).
   * Sert à vérifier le nombre max de micros par branche, calculer les chutes
   * de tension par branche et aider au choix du coffret AC.
   */
  microBranches?: MicroBranch[];
  /** Paramètres de liaison DC par MPPT (onduleur centralisé) */
  dcCablingRuns?: DcCablingRun[];
}

export type MicroBranchPhase = 'Mono' | 'L1' | 'L2' | 'L3';

export interface MicroBranch {
  id: string;
  name?: string;
  phase?: MicroBranchPhase;
  microCount: number;
  cableLengthM: number;
  cableSectionMm2: number;
}

export enum InverterBrand {
  NONE = 'None',
  ENPHASE = 'Enphase',
  APSYSTEMS = 'APSystems',
  FOXESS = 'FoxESS',
  CUSTOM = 'Custom',
}

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Roof {
  width: number;
  height: number;
  pitch: number;
  pitchUnit?: 'deg' | 'percent';
  type: RoofType;
  margins: Margins;
}

export interface PanelConfig {
  model: Panel;
  orientation: 'Portrait' | 'Paysage';
  rows: number;
  columns: number;
  rowConfiguration?: number[];
}

export interface PanelElectricalSpecs {
  voc: number; 
  isc: number; 
  vmp: number; 
  imp: number; 
  tempCoeffVoc?: number; 
  tempCoeffPmax?: number; 
}

export interface Panel {
  name: string; 
  description?: string; 
  width: number; 
  height: number; 
  power: number; 
  price?: string; 
  imageUrl?: string;
  datasheetUrl?: string;
  manualUrl?: string;
  videoUrl?: string;
  electrical?: PanelElectricalSpecs;
}

export interface MountingSystem {
  brand: 'K2' | 'ESDEC';
  railOrientation?: 'Horizontal' | 'Vertical';
}

export enum RoofType {
  TUILE_MECANIQUE = "Tuile mécanique",
  TUILE_PLATE = "Tuile plate",
  TUILE_CANAL = "Tuile Canal",
  FIBROCIMENT = "Fibrociment / PST",
}

export enum WindZone {
  ZONE_1 = "Zone 1",
  ZONE_2 = "Zone 2",
  ZONE_3 = "Zone 3",
  ZONE_4 = "Zone 4",
  ZONE_5 = "Zone 5",
}

export interface Material {
  id: string;
  description: string;
  quantity: number;
  price?: string;
  datasheetUrl?: string;
}

export interface InverterElectricalSpecs {
  maxInputVoltage: number; 
  minMpptVoltage: number; 
  maxMpptVoltage: number; 
  maxInputCurrent: number; 
  maxAcPower: number; 
  /** Courant AC max (A) côté sortie réseau. Prioritaire pour le dimensionnement protections AC. */
  maxAcCurrent?: number;
  /** Courant AC nominal (A) côté sortie réseau (utilisé si maxAcCurrent non renseigné). */
  nominalAcCurrent?: number;
  maxStrings?: number; 
  mpptCount?: number; 
  maxDcPower?: number; 
  isMicro?: boolean;
}

export interface Component {
  id: string;
  description: string;
  unit: 'piece' | 'm' | 'unite';
  length?: number; 
  price?: string;
  power?: number; 
  width?: number; 
  height?: number; 
  imageUrl?: string;
  electrical?: InverterElectricalSpecs | PanelElectricalSpecs;
  datasheetUrl?: string;
  manualUrl?: string;
  videoUrl?: string;
}

export interface MpptAnalysis {
  mpptIndex: number;
  composition: string;
  totalPanelCount: number;
  vocCold: number;
  vmpHot: number;
  /** Nombre de strings identiques en parallèle sur ce MPPT (si applicable). */
  parallelStrings?: number;
  iscMax: number; 
  iscCalculation: number; // Isc x 1.25
  /** Avertissement : Voc(Tmin) proche de la limite max entrée onduleur/MPPT (ex: >95%). */
  isVoltageWarning?: boolean;
  isVoltageError: boolean;
  /** Erreur : Vmp(chaud) < Vmin MPPT (hors plage) -> risque de décrochage. */
  isMpptError?: boolean;
  /** Avertissement : Vmp(chaud) proche de la limite basse MPPT (ex: <= 105% de Vmin). */
  isMpptWarning: boolean;
  isCurrentError: boolean;
}

export interface CompatibilityReport {
  isCompatible: boolean;
  warnings: string[];
  errors: string[];
  details: {
    vocCold: number;
    vmaxInverter: number;
    vmpHot: number;
    vminMppt: number;
    iscPanel: number;
    iscCalculation: number; // Isc x 1.25 global
    imaxInverter: number;
    dcAcRatio: number;
    maxAcPower: number;
    nominalAcCurrent: number;
    /** Disjoncteur mini théorique (A) avant normalisation (1,25 × Iref). */
    recommendedBreakerTheo?: number;
    /** Info sur la base de calcul (Iac_max / Iac_nominal / fallback). */
    acCurrentBasis?: 'IAC_MAX' | 'IAC_NOMINAL' | 'FALLBACK_S_OVER_U';
    /** Détails calcul (ex: 'S=6600VA, U=230V'). */
    acCurrentBasisDetail?: string;
    recommendedBreaker: number;
    rcdType: 'A' | 'B' | 'F';
    tempsUsed: { min: number, maxCell: number };
    stringsAnalysis: MpptAnalysis[];
    maxPanelsInAString: number;
  } | null;
}

export interface DcCablingRun {
  mpptIndex: number;
  /** Longueur aller (m) entre chaîne PV (MPPT) et coffret DC / onduleur. */
  lengthM: number;
  /** Section conducteur (mm²). Si null/undefined : mode Auto (section recommandée). */
  sectionMm2?: number | null;
  /** Nombre de strings identiques en parallèle sur ce MPPT (par défaut 1). */
  parallelStrings?: number;
}
