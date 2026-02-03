import { Panel } from '../types';

export const DMEGC_PANELS: Panel[] = [
  { 
    name: 'TCL HSM-ND48-DR-450',
    description: 'TCL HSM-ND48-DR-450',
    width: 1134, height: 1762, power: 450, 
    price: 'A4HQY7',
    imageUrl: 'https://images.unsplash.com/photo-1545208942-e1c9c9918a44?q=80&w=400&auto=format&fit=crop',
    datasheetUrl: 'https://pub-493f128c789642909ff4ab27a5f41128.r2.dev/product-datasheets/fr/FR_TCL_Solar_Panels_TCL_Solar_T_Class__430_450_W_(HSM_ND48_DR)_Fiches_techniques.pdf',
    manualUrl: 'https://pub-493f128c789642909ff4ab27a5f41128.r2.dev/manuals-and-technical-sheets/fr/FR_TCL_Solar_Panels_Instructions_de_securite_et_d_installation_pour_les_Modules_TCL_Manuel.pdf',
    electrical: { voc: 35.56, isc: 16.06, vmp: 30.13, imp: 14.94, tempCoeffVoc: -0.25 }
  },
  { 
    name: 'TCL HSM-ND54- DR500',
    description: 'TCL HSM-ND54- DR500',
    width: 1134, height: 1961, power: 500, 
    price: 'A4HQZ6',
    imageUrl: 'https://images.unsplash.com/photo-1545208942-e1c9c9918a44?q=80&w=400&auto=format&fit=crop', 
    datasheetUrl: 'https://pub-493f128c789642909ff4ab27a5f41128.r2.dev/product-datasheets/fr/FR_TCL_Solar_Panels_TCL_Solar_T_Class__485_510_W_(HSM_ND54_DR)_Fiches_techniques.pdf',
    manualUrl: 'https://pub-493f128c789642909ff4ab27a5f41128.r2.dev/manuals-and-technical-sheets/fr/FR_TCL_Solar_Panels_Instructions_de_securite_et_d_installation_pour_les_Modules_TCL_Manuel.pdf',
    electrical: { voc: 39.92, isc: 15.81, vmp: 33.7, imp: 14.84, tempCoeffVoc: -0.25 }
  },
  { 
    name: 'DMEGC DM500M10RT-B60HBT',
    description: 'DMEGC DM500M10RT-B60HBT',
    width: 1134, height: 1950, power: 500,
    price: 'A09WQ0',
    imageUrl: 'https://images.unsplash.com/photo-1624397840029-22a893233550?q=80&w=400&auto=format&fit=crop',
    datasheetUrl: 'https://www.dmegcsolar.com/upload/img/2025-11/690ccd063e961.pdf',
    manualUrl: 'https://www.dmegcsolar.com/upload/img/2025-07/688b49495b469.pdf',
    videoUrl: 'https://www.youtube.com/watch?v=tN0fVsbY8lg',
    electrical: { voc: 44.22, isc: 14.04, vmp: 36.87, imp: 13.56, tempCoeffVoc: -0.25 }
  }
];

export const GENERIC_PANEL: Panel = {
  name: 'Panneau Personnalisé',
  description: 'Panneau Personnalisé',
  width: 1134, 
  height: 1722, 
  power: 425,   
  imageUrl: 'https://images.unsplash.com/photo-1592833159155-c62df1b65634?q=80&w=400&auto=format&fit=crop',
  electrical: { voc: 38, isc: 14, vmp: 32, imp: 13, tempCoeffVoc: -0.27 }
};