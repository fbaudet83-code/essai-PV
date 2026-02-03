
import { Component } from '../types';

export const GENERIC_INVERTER: Component = {
    id: 'OND-PERSO',
    description: 'Onduleur Personnalisé',
    unit: 'piece',
    price: '',
    power: 5000,
    electrical: { 
        maxInputVoltage: 600, 
        minMpptVoltage: 80, 
        maxMpptVoltage: 550, 
        maxInputCurrent: 15, 
        maxAcPower: 5000, 
        maxStrings: 2, 
        mpptCount: 2 
    }
};

export const ENPHASE_COMPONENTS: { [key: string]: Component } = {
    IQ8MC: { 
        id: 'ENP-IQ8MC-72-M-INT', 
        description: 'Micro-onduleur Enphase IQ8MC (330VA)', 
        unit: 'piece', 
        price: 'A04BM2', 
        power: 330, 
        datasheetUrl: 'https://enphase.com/fr-fr/download/iq8-series-microinverters-fiche-technique',
        manualUrl: 'https://enphase.com/fr-fr/download/iq8mc-iq8ac-iq8hc-et-iq8x-microinverters-manuel-dinstallation-et-dutilisation',
        electrical: { maxInputVoltage: 60, minMpptVoltage: 25, maxMpptVoltage: 45, maxInputCurrent: 25, maxAcPower: 330, maxStrings: 1, mpptCount: 1 }
    }, 
    IQ8HC: { 
        id: 'ENP-IQ8HC-72-M-INT', 
        description: 'Micro-onduleur Enphase IQ8HC (380VA)', 
        unit: 'piece', 
        price: 'A04BR4', 
        power: 380,
        datasheetUrl: 'https://enphase.com/fr-fr/download/iq8-series-microinverters-fiche-technique',
        manualUrl: 'https://enphase.com/fr-fr/download/iq8mc-iq8ac-iq8hc-et-iq8x-microinverters-manuel-dinstallation-et-dutilisation',
        electrical: { maxInputVoltage: 60, minMpptVoltage: 29.5, maxMpptVoltage: 45, maxInputCurrent: 25, maxAcPower: 380, maxStrings: 1, mpptCount: 1 }
    },
    IQ8P: { 
        id: 'ENP-IQ8P-72-2-INT', 
        description: 'Micro-onduleur Enphase IQ8P (475VA)', 
        unit: 'piece', 
        price: 'A0BWU6', 
        power: 480,
        datasheetUrl: 'https://enphase.com/fr-fr/download/iq8p-microinverter-fiche-technique',
        manualUrl: 'https://enphase.com/fr-fr/download/iq8p-microinverter-manuel-dinstallation-et-dutilisation',
        electrical: { maxInputVoltage: 65, minMpptVoltage: 36, maxMpptVoltage: 55, maxInputCurrent: 25, maxAcPower: 480, maxStrings: 1, mpptCount: 1 }
    },
    // MONO
    Q_CABLE_PORTRAIT: { id: 'ENP-Q-25-10-240', description: 'CABLE MONO PORTRAIT 1.3M ENPHASE', unit: 'piece', price: 'A04BX8' },
    Q_CABLE_LANDSCAPE: { id: 'ENP-Q-25-17-240', description: 'CABLE MONO.PAYSAGE 2M ENPHASE', unit: 'piece', price: 'A04C51' },
    Q_RELAY: { id: 'ENP-Q-RELAY-1P-INT', description: 'Enphase Q-Relay (Relais de découplage)', unit: 'piece', price: 'A04C41' },
    // Q-Relay terrain FR (à utiliser dans les coffrets AC Enphase)
    Q_RELAY_MONO_FR: { id: 'Q-RELAY-1P-FR', description: 'RELAIS QRELAY mono (IQ7/IQ8) 1P-FR', unit: 'piece', price: 'A0GRV' },
    Q_TERMINATOR: { id: 'ENP-Q-TERM-R', description: 'EMBOUT TERMINAIS.MONO ENPHASE', unit: 'piece', price: 'A08TZ7' },
    
    // TRI
    Q_CABLE_TRI_PORTRAIT: { id: 'Q-25-10-3P-200', description: 'CABLE TRI PORTRAIT 1.3M ENPHASE', unit: 'piece', price: 'A04BY9' },
    Q_CABLE_TRI_LANDSCAPE: { id: 'Q-25-17-3P-160', description: 'CABLE TRI PAYSAGE 2M ENPHASE', unit: 'piece', price: 'A04BZ8' },
    Q_TERMINATOR_TRI: { id: 'Q-TERMINATOR-3P', description: 'EMBOUT DE TERMIN.TRI.ENPHASE', unit: 'piece', price: 'A08TX0' },
    Q_RELAY_TRI_INT: { id: 'Q-RELAY-3P-INT', description: 'RELAIS QRELAY TRI (Q) RELAY-3P-INT', unit: 'piece', price: 'A0J3J' },

    // Nouveaux composants de communication
    ENVOY_S: { 
        id: 'ENVOY-S-EM-230', 
        description: 'PASSERELLE ENVOY/S ENPHASE (2CT inclus)', 
        unit: 'piece', 
        price: 'A04BS2',
        manualUrl: 'https://enphase.com/fr-fr/download/iq-gateway-metered-triphase-manuel-dinstallation-et-dutilisation'
    },
    CT_100: { id: 'CT-100-SPLIT', description: 'TRANSFORMATEUR COURANT ENPHASE', unit: 'piece', price: 'A04BT0' },
};

export const APSYSTEMS_COMPONENTS: { [key: string]: Component } = {
    DS3: { 
        id: 'APS-DS3', description: 'Micro-onduleur AP Systems DS3 (880VA)', unit: 'piece', price: 'A04C64', 
        power: 880,
        datasheetUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211d53NLzlMjcL3SsFZZsK9usxhBSe3KiHTdSwtTdF2GEkTD5O2X4veNTEdkT/uMAS9kXM3IOyxMpI#/',
        manualUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211v5vNzzNMrcj3ssbZDsC9WsJhHS23GiNT1SGtpdb2cE8TX5o2P4HelT8d8l/E1lmarvDbTmCxi7z#/',
        videoUrl: 'https://www.youtube.com/watch?v=36nRxgq3B_Y',
        electrical: { maxInputVoltage: 60, minMpptVoltage: 28, maxMpptVoltage: 45, maxInputCurrent: 20, maxAcPower: 880, maxStrings: 2, mpptCount: 2 }
    },
    DS3_H: { 
        id: 'APS-DS3-H', description: 'Micro-onduleur AP Systems DS3-H (960VA)', unit: 'piece', price: 'A0F3G7', 
        power: 960,
        datasheetUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211d53NLzlMjcL3SsFZZsK9usxhBSe3KiHTdSwtTdF2GEkTD5O2X4veNTEdkT/uMAS9kXM3IOyxMpI#/',
        manualUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211v5vNzzNMrcj3ssbZDsC9WsJhHS23GiNT1SGtpdb2cE8TX5o2P4HelT8d8l/E1lmarvDbTmCxi7z#/',
        videoUrl: 'https://www.youtube.com/watch?v=36nRxgq3B_Y',
        electrical: { maxInputVoltage: 60, minMpptVoltage: 30, maxMpptVoltage: 45, maxInputCurrent: 20, maxAcPower: 960, maxStrings: 2, mpptCount: 2 }
    },
    AC_BUS_PORTRAIT_2M: { id: '2322304903', description: 'CABLE MONO. PORTRAIT 2M APS', unit: 'piece', price: 'A04C98' },
    AC_BUS_PAYSAGE_4M: { id: '2322404903', description: 'CABLE MONO. PAYSAGE 4M DS3 APS', unit: 'piece', price: 'A04CS1' },
    AC_BUS_CAP: { id: '2060700017', description: 'EMBOUT TERMINAIS.MONO APS', unit: 'piece', price: 'A08TY8' },
    // CONNECTEURS MONO
    AC_MALE_CONN: { id: '2300531032', description: 'CONNECTEUR ETANCHE MALE MONO APS', unit: 'piece', price: 'A04CG2' },
    AC_FEMALE_CONN: { id: '2300532032', description: 'CONNECTEUR ETANCHE FEM. MONO APS', unit: 'piece', price: 'A04CH0' },
    // CONNECTEURS TRI
    AC_MALE_CONN_TRI: { id: '2300711032', description: 'CONNECTEUR ETANCHE MALE TRI. APS', unit: 'piece', price: 'A04CJ7' },
    AC_FEMALE_CONN_TRI: { id: '2300812032', description: 'CONNECTEUR ETANCHE FEM. TRI. APS', unit: 'piece', price: 'A04CK5' },

    ECU_C: { 
        id: '350029', 
        description: 'PASSERELLE COM AVANCEE ECU-C APS', 
        unit: 'piece', 
        price: 'A046Q2',
        datasheetUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211D5hNhz5MDcv3WsBZvsu9QsPhlSG3uiTTrSUtvdh2GE6TN5a2747epTydS8/lX1fFpYKvSCkpjzx#/',
        manualUrl: 'https://apsystems.filecloudonline.com/ui/core/index.html?mode=single&path=/SHARED/%211h5eNgz4MAcw3XsCZusv9RsIhkSH3viQTqSVtudg2hE7TM5b2646emTpdJ7/s4TNs6qWgnUcuTwP#/'
    },
    TOre_80A: { id: '350040', description: 'TORE MESURE COURANT 80A ECU C APS', unit: 'piece', price: 'A046R0' },
};

export const FOXESS_COMPONENTS: { [key: string]: Component } = {
    // --- MICRO-ONDULEURS ---
    MICRO_1000: { 
        id: 'FOX-MICRO-1000', description: 'Micro-onduleur FoxESS M1-1000-E (2 Entrées)', unit: 'piece', price: 'A2R4J8', 
        power: 1000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-M-E-datasheet-V2.1-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-M1-series-Manual.pdf',
        // IMPORTANT: ce composant est un micro-onduleur. Le flag isMicro est utilisé
        // pour adapter l'UI (pas de tronçon AC1 « onduleur → coffret ») et l'audit.
        electrical: { maxInputVoltage: 60, minMpptVoltage: 24, maxMpptVoltage: 60, maxInputCurrent: 24, maxAcPower: 1000, maxStrings: 2, mpptCount: 2, isMicro: true }
    },
    MICRO_AC_CABLE: { id: '10-100-01176-0', description: 'CABLE AC MONO FoxESS', unit: 'piece', price: 'A2R4K6' },
    MICRO_TEE: { id: '10-208-00083-00', description: 'TE DE CONNEXION AC MONO FoxESS', unit: 'piece', price: 'A2R4Q6' },
    MICRO_END_CAP: { id: '10-109-00175-00', description: 'BOUCHON AC FoxESS', unit: 'piece', price: 'A2R4N0' },
    MICRO_GATEWAY: { id: 'SMG666.005', description: 'PASSERELLE P/MICRO-ONDULEUR', unit: 'piece', price: 'A2R4H1' },
    CHINT_MONO: { id: 'DDSU666', description: 'COMPTEUR MONO CHINT DDSU666', unit: 'piece', price: 'A2R4G3' },
    CHINT_TRI: { id: 'DTSU666', description: 'COMPTEUR TRI CHINT DTSU666', unit: 'piece', price: 'A4C248' },

    // --- ONDULEURS CENTRALISÉS SÉRIE S (G2) ---
    S3000_G2: { 
        id: 'FOX-S3000-G2', 
        description: 'Onduleur Fox S3000-G2 (Monophasé)', 
        unit: 'piece', 
        price: 'A2R3X2', 
        power: 3000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-S(G2)-Datasheet-V3.3-20250306.pdf',
        electrical: { maxInputVoltage: 500, minMpptVoltage: 50, maxMpptVoltage: 480, maxInputCurrent: 18, maxAcPower: 3300, maxStrings: 1, mpptCount: 1, maxDcPower: 4500 }
    },

    // --- ACCESSOIRES DC (Centralisés) ---
    MC4_EVO2_FEM: { id: '32.0316P0010-UR', description: 'CONNECTEUR FEM.MC4 EVO2-10 pièces', unit: 'piece', price: 'A0C085' },
    MC4_EVO2_MALE: { id: '32.0317P0010-UR', description: 'CONNECTEUR MALE MC4 EVO2-10 pièces', unit: 'piece', price: 'A0C077' },

    // --- SÉRIE H1 G2 (Hybride Monophasé) ---
    H1_30_G2: { 
        id: 'FOX-H1-3.0-E-G2', description: 'Onduleur Hybride Fox H1-3.0-E-G2', unit: 'piece', price: 'A2R3Y', 
        power: 3000, 
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-Datasheet-V1.5-20250226.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-WL-Manual-V1.0.0-20250513.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 3300, maxAcCurrent: 15.0, maxStrings: 2, mpptCount: 2, maxDcPower: 4500 } 
    },
    H1_37_G2: { 
        id: 'FOX-H1-3.7-E-G2', description: 'Onduleur Hybride Fox H1-3.7-E-G2', unit: 'piece', price: 'A2R3Z', 
        power: 3680, 
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-Datasheet-V1.5-20250226.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-WL-Manual-V1.0.0-20250513.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 4400, maxAcCurrent: 18.4, maxStrings: 2, mpptCount: 2, maxDcPower: 5500 } 
    },
    H1_46_G2: { 
        id: 'FOX-H1-4.6-E-G2', description: 'Onduleur Hybride Fox H1-4.6-E-G2', unit: 'piece', price: 'A2R40', 
        power: 4600, 
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-Datasheet-V1.5-20250226.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-WL-Manual-V1.0.0-20250513.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 5060, maxAcCurrent: 23.0, maxStrings: 2, mpptCount: 2, maxDcPower: 6900 } 
    },
    H1_50_G2: { 
        id: 'FOX-H1-5.0-E-G2', description: 'Onduleur Hybride Fox H1-5.0-E-G2', unit: 'piece', price: 'A2R41', 
        power: 5000, 
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-Datasheet-V1.5-20250226.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-WL-Manual-V1.0.0-20250513.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 5500, maxAcCurrent: 25.0, maxStrings: 2, mpptCount: 2, maxDcPower: 7500 } 
    },
    H1_60_G2: { 
        id: 'FOX-H1-6.0-E-G2', description: 'Onduleur Hybride Fox H1-6.0-E-G2', unit: 'piece', price: 'A2R42', 
        power: 6000, 
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-Datasheet-V1.5-20250226.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H1-G2-WL-Manual-V1.0.0-20250513.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 6600, maxAcCurrent: 30.0, maxStrings: 2, mpptCount: 2, maxDcPower: 9000 } 
    },

    // --- SÉRIE KH (Hybride Monophasé Haute Puissance) ---
    KH7: { id: 'FOX-KH7', description: 'Onduleur Hybride Fox KH7 (Monophasé)', unit: 'piece', price: 'A3FT1', power: 7000, electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 7000, maxStrings: 3, mpptCount: 3, maxDcPower: 10500 } },
    KH8: { 
        id: 'FOX-KH8', 
        description: 'Onduleur Hybride Fox KH8 (Monophasé)', 
        unit: 'piece', 
        price: 'A3FT3', 
        power: 8000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-KH-KA-Datasheet-V1.4-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-KHKA-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 480, maxInputCurrent: 20, maxAcPower: 8800, maxStrings: 3, mpptCount: 3, maxDcPower: 12000 } 
    },
    KH9: { id: 'FOX-KH9', description: 'Onduleur Hybride Fox KH9 (Monophasé)', unit: 'piece', price: 'A3FT5', power: 9000, electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 550, maxInputCurrent: 20, maxAcPower: 9000, maxStrings: 3, mpptCount: 3, maxDcPower: 13500 } },
    KH10: { 
        id: 'FOX-KH10', 
        description: 'Onduleur Hybride Fox KH10 (Monophasé)', 
        unit: 'piece', 
        price: 'A4BKW4', 
        power: 10000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-KH-KA-Datasheet-V1.4-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-KHKA-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 600, minMpptVoltage: 80, maxMpptVoltage: 480, maxInputCurrent: 20, maxAcPower: 10500, maxStrings: 4, mpptCount: 4, maxDcPower: 15000 } 
    },

    // --- SÉRIE T (G3) - TRIPHASÉ STANDARD ---
    T10_G3: { id: 'FOX-T10-G3-TRI', description: 'Onduleur Fox T10 G3 (Triphasé)', unit: 'piece', price: 'A2R4L1', power: 10000, electrical: { maxInputVoltage: 1100, minMpptVoltage: 140, maxMpptVoltage: 1000, maxInputCurrent: 14, maxAcPower: 10000, maxStrings: 2, mpptCount: 2 } },
    T15_G3: { id: 'FOX-T15-G3-TRI', description: 'Onduleur Fox T15 G3 (Triphasé)', unit: 'piece', price: 'A2R4L2', power: 15000, electrical: { maxInputVoltage: 1100, minMpptVoltage: 140, maxMpptVoltage: 1000, maxInputCurrent: 28, maxAcPower: 15000, maxStrings: 2, mpptCount: 2 } },
    T20_G3: { id: 'FOX-T20-G3-TRI', description: 'Onduleur Fox T20 G3 (Triphasé)', unit: 'piece', price: 'A2R4L3', power: 20000, electrical: { maxInputVoltage: 1100, minMpptVoltage: 140, maxMpptVoltage: 1000, maxInputCurrent: 28, maxAcPower: 20000, maxStrings: 4, mpptCount: 2 } },

    // --- SÉRIE H3 - TRIPHASÉ HYBRIDE ---
    H3_10: { id: 'FOX-H3-10.0-E', description: 'Onduleur Hybride Fox H3-10.0-E (Triphasé)', unit: 'piece', price: 'A2R48H', power: 10000, electrical: { maxInputVoltage: 1000, minMpptVoltage: 160, maxMpptVoltage: 950, maxInputCurrent: 26, maxAcPower: 10000, maxStrings: 2, mpptCount: 2, maxDcPower: 15000 } },
    H3_12: { id: 'FOX-H3-12.0-E', description: 'Onduleur Hybride Fox H3-12.0-E (Triphasé)', unit: 'piece', price: 'A2R49H', power: 12000, electrical: { maxInputVoltage: 1000, minMpptVoltage: 160, maxMpptVoltage: 950, maxInputCurrent: 26, maxAcPower: 12000, maxStrings: 2, mpptCount: 2, maxDcPower: 18000 } },

    // --- SÉRIE H3 PRO (Hybride Triphasé Haute Puissance) ---
    H3_PRO_15: {
        id: 'FOX-H3-PRO-15.0',
        description: 'Onduleur Hybride Fox H3-PRO-15.0 (Triphasé)',
        unit: 'piece',
        price: 'A2R48',
        power: 15000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-Datasheet-V1.5-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-WL-Manual-V1.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 150, maxMpptVoltage: 850, maxInputCurrent: 40, maxAcPower: 16500, maxStrings: 6, mpptCount: 3, maxDcPower: 30000 }
    },
    H3_PRO_20: {
        id: 'FOX-H3-PRO-20.0',
        description: 'Onduleur Hybride Fox H3-PRO-20.0 (Triphasé)',
        unit: 'piece',
        price: 'A2R49',
        power: 20000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-Datasheet-V1.5-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-WL-Manual-V1.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 150, maxMpptVoltage: 850, maxInputCurrent: 40, maxAcPower: 22000, maxStrings: 6, mpptCount: 3, maxDcPower: 40000 }
    },
    H3_PRO_25: {
        id: 'FOX-H3-PRO-25.0',
        description: 'Onduleur Hybride Fox H3-PRO-25.0 (Triphasé)',
        unit: 'piece',
        price: 'A2R4A',
        power: 25000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-Datasheet-V1.5-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-WL-Manual-V1.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 150, maxMpptVoltage: 850, maxInputCurrent: 40, maxAcPower: 27500, maxStrings: 6, mpptCount: 3, maxDcPower: 50000 }
    },
    H3_PRO_30: {
        id: 'FOX-H3-PRO-30.0',
        description: 'Onduleur Hybride Fox H3-PRO-30.0 (Triphasé)',
        unit: 'piece',
        price: 'A2R4B',
        power: 30000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-Datasheet-V1.5-20250314.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-H3-Pro-WL-Manual-V1.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 150, maxMpptVoltage: 850, maxInputCurrent: 40, maxAcPower: 33000, maxStrings: 6, mpptCount: 3, maxDcPower: 60000 }
    },

    // --- SÉRIE P3 (Hybride Triphasé) ---
    P3_60: {
        id: 'FOX-P3-6.0-SH',
        description: 'Onduleur Hybride Fox P3-6.0-SH (Triphasé)',
        unit: 'piece',
        price: 'A2R44',
        power: 6000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Datasheet-V1.0-20250610.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 120, maxMpptVoltage: 950, maxInputCurrent: 25, maxAcPower: 6600, maxStrings: 2, mpptCount: 2, maxDcPower: 9000 }
    },
    P3_80: {
        id: 'FOX-P3-8.0-SH',
        description: 'Onduleur Hybride Fox P3-8.0-SH (Triphasé)',
        unit: 'piece',
        price: 'A2R45',
        power: 8000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Datasheet-V1.0-20250610.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 120, maxMpptVoltage: 950, maxInputCurrent: 25, maxAcPower: 8800, maxStrings: 3, mpptCount: 3, maxDcPower: 12000 }
    },
    P3_10: {
        id: 'FOX-P3-10.0-SH',
        description: 'Onduleur Hybride Fox P3-10.0-SH (Triphasé)',
        unit: 'piece',
        price: 'A2R46',
        power: 10000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Datasheet-V1.0-20250610.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 120, maxMpptVoltage: 950, maxInputCurrent: 25, maxAcPower: 11000, maxStrings: 3, mpptCount: 3, maxDcPower: 18000 }
    },
    P3_12: {
        id: 'FOX-P3-12.0-SH',
        description: 'Onduleur Hybride Fox P3-12.0-SH (Triphasé)',
        unit: 'piece',
        price: 'A2R47',
        power: 12000,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Datasheet-V1.0-20250610.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-P3-S-Manual-V1.0.0.pdf',
        electrical: { maxInputVoltage: 1000, minMpptVoltage: 120, maxMpptVoltage: 950, maxInputCurrent: 25, maxAcPower: 13200, maxStrings: 3, mpptCount: 3, maxDcPower: 22500 }
    },

    // --- BATTERIES ECS (High Voltage) ---
    ECS2900_H2: { id: 'FOX-ECS2900-H2', description: 'Batterie Fox ECS2900-H2 (5.76 kWh)', unit: 'piece', price: 'A2R4K7' },
    ECS2900_H3: { id: 'FOX-ECS2900-H3', description: 'Batterie Fox ECS2900-H3 (8.64 kWh)', unit: 'piece', price: 'A2R4L5' },
    ECS2900_H4: { id: 'FOX-ECS2900-H4', description: 'Batterie Fox ECS2900-H4 (11.52 kWh)', unit: 'piece', price: 'A2R4M1' },
    ECS2900_H5: { id: 'FOX-ECS2900-H5', description: 'Batterie Fox ECS2900-H5 (14.40 kWh)', unit: 'piece', price: 'A2R4M8' },
    ECS2900_H6: { id: 'FOX-ECS2900-H6', description: 'Batterie Fox ECS2900-H6 (17.28 kWh)', unit: 'piece', price: 'A2R4P4' },
    ECS2900_H7: { id: 'FOX-ECS2900-H7', description: 'Batterie Fox ECS2900-H7 (20.16 kWh)', unit: 'piece', price: 'A2R4Q0' },
    
    ECS4800_H2: { id: 'FOX-ECS4800-H2', description: 'Batterie Fox ECS4800-H2 (9.48 kWh)', unit: 'piece', price: 'A2R4X1' },
    ECS4800_H3: { id: 'FOX-ECS4800-H3', description: 'Batterie Fox ECS4800-H3 (14.22 kWh)', unit: 'piece', price: 'A2R4X9' },

    // --- BATTERIES ALL-IN-ONE / COMPACT ---
    EP5: { 
        id: 'FOX-EP5', 
        description: 'Batterie Fox et BMS EP5 (5.18 kWh)', 
        unit: 'piece', 
        price: 'A2R4E', 
        power: 5180,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EP5-Datasheet-V1.3-20250711.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EP-Manual-V1.0.0-20250407.pdf'
    },
    EP6: { 
        id: 'FOX-EP6', 
        description: 'Batterie Fox et BMS EP6 (5.76 kWh)', 
        unit: 'piece', 
        price: 'A4BKQ-', 
        power: 5760,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EP6-Datasheet-V1.1-20250711.pdf',
        manualUrl: 'https://www.fox-ess.com/Public/Uploads/uploadfile/files/20260107/ENEP612ManualV1.0.3.pdf'
    },
    EP11: { 
        id: 'FOX-EP11', 
        description: 'Batterie Fox et BMS EP11 (10.36 kWh)', 
        unit: 'piece', 
        price: 'A2R4F5', 
        power: 10360,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EP11-Datasheet-V1.3-20250711.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EP-Manual-V1.0.0-20250407.pdf'
    },
    EP12: { 
        id: 'FOX-EP12', 
        description: 'Batterie Fox et BMS EP12 (11.52 kWh)', 
        unit: 'piece', 
        price: 'A4BKR-', 
        power: 11520,
        datasheetUrl: 'https://www.fox-ess.com/Public/Uploads/uploadfile/files/Download/EN-EP12-Datasheet-V1.1-20251023.pdf',
        manualUrl: 'https://www.fox-ess.com/Public/Uploads/uploadfile/files/20260107/ENEP612ManualV1.0.3.pdf'
    },

    // --- BATTERIES EQ ---
    EQ_CM6000: { 
        id: 'FOX-EQ-CM6000', 
        description: 'Batterie Fox et BMS EQ CM6000 (5.90 kWh)', 
        unit: 'piece', 
        price: 'A4BKU-', 
        power: 5900,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EQ6000-Plus-Datasheet-V1.0-20250430.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EQ-Manual-V1.0.0-20250423.pdf'
    },
    EQ_CS6000: { 
        id: 'FOX-EQ-CS6000', 
        description: 'Batterie Fox EQ CS6000 (5.90 kWh)', 
        unit: 'piece', 
        price: 'A4BKV-', 
        power: 5900,
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EQ6000-Plus-Datasheet-V1.0-20250430.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-EQ-Manual-V1.0.0-20250423.pdf'
    },

    // --- BORNES DE RECHARGE (EV) ---
    EV_7KW: { 
        id: 'A7300S1-E-2', 
        description: 'BORNE RECHARGE VE MONO 7KW', 
        unit: 'piece', 
        price: 'A2R4R4',
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-A-V2.0-EV-Charger-shutter-Datasheet-V1.3-20250612.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-7.3kW-EV-Charger-User-Manual-V1.0.pdf'
    },
    EV_22KW: { 
        id: 'A022KS1-E-A', 
        description: 'BORNE RECHARGE VE TRI 22KW', 
        unit: 'piece', 
        price: 'A2R4S2',
        datasheetUrl: 'https://fr.fox-ess.com/download/upfiles/FR-A-V2.0-EV-Charger-shutter-Datasheet-V1.3-20250612.pdf',
        manualUrl: 'https://fr.fox-ess.com/download/upfiles/FR-V2.0-22kW-EV-Charger-User-Manual-V1.0.pdf'
    },
    
    // --- CABLES VE ---
    EV_CABLE_7KW: { id: '15254', description: 'Cordon VE 3G6mm² mono 7,4kW Mâle/Femelle 5m type 2', unit: 'piece', price: 'A4YC51' },
    EV_CABLE_22KW: { id: '15264', description: 'Cordon VE 5G6mm² 22kW Mâle/Femelle 5m type 2', unit: 'piece', price: 'A4YC69' },
};

export const DIGITAL_ELECTRIC_COMPONENTS: { [key: string]: Component } = {
    // Coffrets AC - Standard (Type F)
    '13412': { id: '13412', description: 'COFFRET 20A MONO 4.5KW 300MA TYPE F 13412', unit: 'piece', price: 'A4YAU' },
    '13416': { id: '13416', description: 'COFFRET 32A MONO 6KW 300MA TYPE F 13416', unit: 'piece', price: 'A4YAV' },
    '13418': { id: '13418', description: 'COFFRET 40A MONO 8KW 300MA TYPE F 13418', unit: 'piece', price: 'A4YAW' },
    '13474': { id: '13474', description: 'COFFRET 16A TRI 9KW 300MA TYPE F 13474', unit: 'piece', price: 'A4YAX' },
    '13476': { id: '13476', description: 'COFFRET 20A TRI 12KW 300MA TYPE F 13476', unit: 'piece', price: 'A4YAY' },

    // COFAC (coffrets AC tri) - Type F
    '12334': { id: '12334', description: 'COFAC 25A TRI 16KW 300MA TYPE F 12334', unit: 'piece', price: 'A4YB1' },
    '12338': { id: '12338', description: 'COFAC 40A TRI 24KW 300MA TYPE F 12338', unit: 'piece', price: 'A4YB2' },
    '12340': { id: '12340', description: 'COFAC 63A TRI 36KW 300MA TYPE F 12340', unit: 'piece', price: 'A4YB3' },
    
    // Coffrets DC - Standard
    '12232': { id: '12232', description: 'COFFRET DC 600V 1S/MPPT 2MPPT 12232', unit: 'piece', price: 'A4YBH' },
    '12272': { id: '12272', description: 'COFFRET 1000V 1S/MPPT 2MPPT IP65 12272', unit: 'piece', price: 'A3MBR' },
    '12282': { id: '12282', description: 'COFFRET 600V 1S/MPPT 3MPPT 12282', unit: 'piece', price: 'A4YBJ' },

    // Coffrets AC - Batterie (Type B)
    '12522': { id: '12522', description: 'COFFRET 20A M 300MA TYPE B 12522', unit: 'piece', price: 'A3MAW' },
    '12526': { id: '12526', description: 'COFFRET 32A MONO 300MA 6KW TYPE B 12526', unit: 'piece', price: 'A3MAX' },
    '12528': { id: '12528', description: 'COFFRET 40A MONO 8KW 300MA TYPE B 12528', unit: 'piece', price: 'A4YAZ' },
    '12501': { id: '12501', description: 'COFFRET 20A TRI 12KW 300MA TYPE B 12501', unit: 'piece', price: 'A4YB0' },

    // COFAC (coffrets AC tri) - Type B
    '12333': { id: '12333', description: 'COFAC 25A TRI 16KW 300MA TYPE B 12333', unit: 'piece', price: 'A4YB4' },
    '12337': { id: '12337', description: 'COFAC 40A TRI 24KW 300MA TYPE B 12337', unit: 'piece', price: 'A4YB5' },
    '12341': { id: '12341', description: 'COFAC 63A TRI 36KW 300MA TYPE B 12341', unit: 'piece', price: 'A4YB6' },

    // Coffrets DC - Batterie/Hybride
    '12233': { id: '12233', description: 'COFFRET 600V 1S/MPPT 2MPPT+FUSIBLE 20A 12233', unit: 'piece', price: 'A4YBK' },
    '12273': { id: '12273', description: 'COFFRET 1000V 1S/MPPT 2MPPT+F20A IP65 12273', unit: 'piece', price: 'A3MBW' },
    '12283': { id: '12283', description: 'COFFRET 600V 1S/MPPT 3MPPT+FUS20A 12283', unit: 'piece', price: 'A3MEF' },

    // Coffrets AC - Backup (Type B + Backup)
    '12554': { id: '12554', description: 'COFFRET 25A M 300MA TYP.B+BCK PART.IP30 12554', unit: 'piece', price: 'A3MBH' },
    '12556': { id: '12556', description: 'COFFRET 32A MONO 300MA TYP.B+BACKUP 12556', unit: 'piece', price: 'A3MBJ' },
    '12558': { id: '12558', description: 'COFFRET BKUP 40A MONO 8KW 300MA TYPE B 12558', unit: 'piece', price: 'A4YBF' },
    '12507': { id: '12507', description: 'COFFRET BKUP 20A TRI 12KW 300MA TYPE B 12507', unit: 'piece', price: 'A4YBG' },

    // Coffrets AC Micro-Onduleur ENPHASE
    '13462': { id: '13462', description: 'COFFRET 20A MONO 4.5KW 30MA SS QRELAY 13462', unit: 'piece', price: 'A4YB7' },
    '13464': { id: '13464', description: 'COFFRET 2X20A MONO 8KW 30MA SS QRELAY 13464', unit: 'piece', price: 'A4YB8' },
    '13466': { id: '13466', description: 'COFFRET 3X20A MONO 12KW 30MA SS QRELAY 13466', unit: 'piece', price: 'A4YB9' },
    '13488': { id: '13488', description: 'COFFRET 16A TRI 9KW 30MA 1 SS QRELAY 13488', unit: 'piece', price: 'A4YBA' },

    // Coffrets AC Micro-Onduleur AP Systems / Fox ESS
    '13442': { id: '13442', description: 'COFFRET 20A 30MA MONO 4.5KW +PASS 13442', unit: 'piece', price: 'A4YBB' },
    '13444': { id: '13444', description: 'COFFRET 40A MONO 8KW 30MA 2X20A +PASS 13444', unit: 'piece', price: 'A4YBC' },
    '13446': { id: '13446', description: 'COFFRET 63A MONO 12KW 30MA 3X20A +PASS 13446', unit: 'piece', price: 'A4YBD' },
    '13498': { id: '13498', description: 'COFFRET 16A TRI 9KW 30MA +PASS 13498', unit: 'piece', price: 'A4YBE' },

    // Disjoncteurs de protection PV individuels (ANCIENNES RÉF)
    'DISJ-20A': { id: 'DISJ-20A', description: 'Disjoncteur Ph+N 20A Courbe C 6kA', unit: 'piece', price: 'A08TR' },
    'DISJ-32A': { id: 'DISJ-32A', description: 'Disjoncteur Ph+N 32A Courbe C 6kA', unit: 'piece', price: 'A08TS' },
    'DISJ-40A': { id: 'DISJ-40A', description: 'Disjoncteur Ph+N 40A Courbe C 6kA', unit: 'piece', price: 'A08TT' },
    'DISJ-16A-TRI': { id: 'DISJ-16A-TRI', description: 'Disjoncteur Triphasé 16A Courbe C 6kA', unit: 'piece', price: 'A08TU' },
    'DISJ-20A-TRI': { id: 'DISJ-20A-TRI', description: 'Disjoncteur Triphasé 20A Courbe C 6kA', unit: 'piece', price: 'A08TV' },

    // Nouveaux disjoncteurs spécifiques AGCP (RICHARDSON)
    // MONO
    '01520': { id: '01520', description: 'Disjoncteur 2x20 A C6 kA', unit: 'piece', price: 'A4YBP3' },
    '02018': { id: '02018', description: 'Disjoncteur 2x32 A C6 kA', unit: 'piece', price: 'A4YBQ1' },
    '02020': { id: '02020', description: 'Disjoncteur 2x40 A C6 kA', unit: 'piece', price: 'A4YBR9' },
    '02024': { id: '02024', description: 'Disjoncteur 2x63 A C6 kA', unit: 'piece', price: 'A4YBS7' },

    // TRIPHASE
    '02048': { id: '02048', description: 'Disjoncteur 4x16 A C6 kA', unit: 'piece', price: 'A4YBT5' },
    '02050': { id: '02050', description: 'Disjoncteur 4x20 A C6 kA', unit: 'piece', price: 'A4YBU2' },
    '02052': { id: '02052', description: 'Disjoncteur 4x25 A C6 kA', unit: 'piece', price: 'A4YBV0' },
    '02054': { id: '02054', description: 'Disjoncteur 4x32 A C6 kA', unit: 'piece', price: 'A4YBW8' },
    '02056': { id: '02056', description: 'Disjoncteur 4x40 A C6 kA', unit: 'piece', price: 'A4YSY3' },

    // Composants Protection EV
    '03140': { id: '03140', description: 'Disjoncteur Diff mono 40A/30mA Type F 10kA', unit: 'piece', price: 'A4YC28' },
    '03446': { id: '03446', description: 'Inter Diff Tri 40A/30mA Type F', unit: 'piece', price: 'A4YC44' },
};
