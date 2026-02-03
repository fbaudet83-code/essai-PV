
import { Component } from '../types';

export const K2_COMPONENTS_DEFAULT: { [key: string]: Component } = {
  // Rails and accessories from spreadsheet
  RAIL_2400: { id: 'K2S/2003458', description: 'K2 Single Rail 36 de 2,4 m', unit: 'piece', length: 2400, price: 'A0J792' },
  SPLICE: { id: 'K2S/2001976', description: 'K2S Connecteur de Rails Single Rail 36', unit: 'piece', price: 'A08TU6' },
  END_CAP: { id: 'K2S/1004767', description: 'K2 Bouchon NOIR P.Rail 36', unit: 'piece', price: 'A08TR3' },

  // Clamps from spreadsheet
  MID_CLAMP: { id: 'K2S/2004148', description: 'K2 Bride Int Universelle (31 à 42mm) NOIR', unit: 'piece', price: 'A09504' },
  END_CLAMP: { id: 'K2S/2004545', description: 'K2 Bride Ext Universelle (31 à 42mm) NOIR', unit: 'piece', price: 'A30ZQ3' },

  // Hooks & Screws from spreadsheet
  HOOK_CROSSHOOK: { id: 'K2S/2003144', description: 'K2S Crochets CrossHook 4S (Crochet pour tuiles galbés)', unit: 'piece', price: 'A08U06' },
  WOOD_SCREW_8X100: { id: 'K2S/2004112', description: 'K2 Vis bois Heco Topix 8x100', unit: 'piece', price: 'A04DJ6' },
  
  // Specific Fibro/PST
  HANGER_BOLT_FIBRO: { id: 'K2S/2003274', description: 'FIXATION TIREFD.M10X250 BOIS K2SYS', unit: 'piece', price: 'A4MXP0' },

  // Grounding from spreadsheet
  GROUND_LUG_K2SZ: { id: 'K2S/2001881', description: 'K2 Griffe de mise à la terre K2SZ', unit: 'piece', price: 'A08U89' },
  
  // Micro-inverter mounting from spreadsheet
  STAIRPLATE_KIT: { id: 'K2S/2004057', description: 'Kit StairPlate (Fixation micro onduleur)', unit: 'piece', price: 'A08TP7' },
  MK2_NUT: { id: 'K2S/1001643', description: 'Ecrou-prisonnierMK2 avec clip de montage(micro-onduleur)', unit: 'piece', price: '210110' },
  M8_SCREW: { id: 'K2S/2001735', description: 'Vis avec rondelle intégrée M8x16', unit: 'piece', price: '210111' },
};


export const ESDEC_COMPONENTS_DEFAULT: { [key: string]: Component } = {
  // From user provided BOM for Tiled Roof
  RAIL_2338: { id: '1008132', description: 'ClickFit EVO - Rail de montage 2338mm', unit: 'piece', length: 2338, price: 'A0B095' },
  SPLICE: { id: '1008061', description: 'ClickFit EVO - Coupleur de rail', unit: 'piece', price: 'A0B0A2' },
  END_CAP: { id: '1008060', description: 'ClickFit EVO - Terminaison de rail NOIR', unit: 'piece', price: 'A0B0D6' },
  UNIVERSAL_CLAMP: { id: '1008020', description: 'ClickFit EVO - Etrier universel NOIR', unit: 'piece', price: 'A0B0B0' },
  HOOK_UNIVERSAL: { id: '1008040', description: 'ClickFit EVO - Crochet de toit liteau-Fermette - UniversalHook', unit: 'piece', price: 'A0B087' },
  HOOK_GASKET: { id: '1008063', description: 'ClickFit EVO - Entretoise caoutchouc protection tuile', unit: 'piece', price: 'A0B0E3' },
  MOUNTING_GUIDE: { id: '1008064', description: 'ClickFit EVO - Guide d\'aide au montage', unit: 'piece', price: 'A2KHU5' },
  
  // Fallbacks for other roof types
  HANGER_BOLT: { id: '1008053', description: 'ClickFit EVO - Vis de fixation pour tôle ondulée/fibrociment', unit: 'piece', price: '310109' },
  HANGER_BOLT_FIBRO: { id: '1008012', description: 'BOULON SUSPENSION M10X250MM', unit: 'piece', price: 'A0EA3' },
  
  // Generic grounding lug, as it was not in the provided BOM
  GROUND_LUG: { id: 'ESD-GRD-01', description: 'ESDEC Griffe de mise à la terre', unit: 'piece', price: '310110' },

  // Micro-inverter fixation
  CLIP_HEAVY_DUTY: { id: '1008068', description: 'ClickFit EVO - Clip métal poids lourd 2-8kg (Micro-ond)', unit: 'piece', price: 'A0K6F7' },
};
