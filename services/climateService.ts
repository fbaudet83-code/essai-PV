
export interface LocationClimate {
    tempMin: number; 
    tempMaxAmb: number; 
    label: string;
    altitudePenalty?: number;
    baseTempSeaLevel?: number;
    labelOrigin?: string;
    coastalOverrideApplied?: boolean;
}

// Température de base au niveau de la mer par département (selon norme NF P 52-612-1 / Annexe Nationale)
const BASE_TEMP_BY_DEPT: { [dept: string]: number } = {
    '01': -10, '02': -7, '03': -8, '04': -8, '05': -10, 
    '06': -6, '07': -6, '08': -10, '09': -5, '10': -10,
    '11': -5, '12': -8, '13': -5, '14': -7, '15': -8,
    '16': -5, '17': -5, '18': -7, '19': -8, 
    '2A': -2, '2B': -2, '20': -2, // Corse
    '21': -10, '22': -4, '23': -8, '24': -5, '25': -12,
    '26': -6, '27': -7, '28': -7, '29': -4, '30': -5,
    '31': -5, '32': -5, '33': -5, '34': -5, '35': -4,
    '36': -7, '37': -7, '38': -10, '39': -10, '40': -5,
    '41': -7, '42': -10, '43': -8, '44': -5, '45': -7,
    '46': -6, '47': -5, '48': -8, '49': -7, '50': -4,
    '51': -10, '52': -12, '53': -7, '54': -15, '55': -12,
    '56': -4, '57': -15, '58': -10, '59': -9, '60': -7,
    '61': -7, '62': -9, '63': -8, '64': -5, '65': -5,
    '66': -5, '67': -15, '68': -15, '69': -10, '70': -10,
    '71': -10, '72': -7, '73': -10, '74': -10, '75': -5,
    '76': -7, '77': -7, '78': -7, '79': -7, '80': -9,
    '81': -5, '82': -5, '83': -5, '84': -6, '85': -5,
    '86': -7, '87': -8, '88': -15, '89': -10, '90': -15,
    '91': -7, '92': -7, '93': -7, '94': -7, '95': -7,
    // DOM-TOM (Simplifié)
    '971': 15, '972': 15, '973': 15, '974': 10, '976': 15
};

// Exceptions pour certaines villes côtières ou iles (Base température plus douce)
// Ces valeurs remplacent la température départementale AVANT correction d'altitude
const COASTAL_EXCEPTIONS_MAP: { [postalCode: string]: number } = {
    // Var (Iles & Cote proche < 25km)
    '83400': -2, '83000': -2, '83100': -2, '83200': -2, '83500': -2, 
    '83110': -2, '83140': -2, '83130': -2, '83220': -2, '83320': -2, 
    '83230': -2, '83980': -2, '83120': -2, '83990': -2, '83240': -2, 
    '83600': -2, '83700': -2, '83150': -2, '83270': -2,

    // Alpes Maritimes Cote
    '06000': -2, '06100': -2, '06200': -2, '06300': -2, '06400': -2, 
    '06150': -2, '06160': -2, '06600': -2, '06800': -2, '06700': -2, 
    '06270': -2, '06500': -2, '06310': -2, '06230': -2,

    // Bouches du Rhone Cote
    '13001': -2, '13002': -2, '13003': -2, '13004': -2, '13005': -2,
    '13006': -2, '13007': -2, '13008': -2, '13009': -2, '13010': -2,
    '13011': -2, '13012': -2, '13013': -2, '13014': -2, '13015': -2, '13016': -2, 
    '13600': -2, '13260': -2, '13500': -2,

    // Corse (si différent du département général)
    '20000': -2, '20090': -2, '20200': -2, '20137': -2, '20260': -2, 
    '20110': -2, '20169': -2,
};

/**
 * Calcule la température de base en fonction du code postal et de l'altitude.
 * Applique la pondération d'altitude : -1°C tous les 200m au-delà de 200m.
 */
export function getLocationClimate(postalCode: string, altitude: number = 0): LocationClimate {
    if (!postalCode || postalCode.length < 2) {
        return { tempMin: -10, tempMaxAmb: 35, label: 'Standard (Défaut)' };
    }

    const prefix2 = postalCode.substring(0, 2);
    const prefix3 = postalCode.substring(0, 3); // Pour DOM-TOM ou Corse 2A/2B si codé en 20XXX

    // 1. Déterminer la température de base (Niveau de la mer)
    let baseTemp = -10; // Valeur par défaut de sécurité
    let labelOrigin = `Dept ${prefix2}`;
    let coastalOverrideApplied = false;

    // Gestion DOM-TOM
    if (postalCode.startsWith('97')) {
        baseTemp = BASE_TEMP_BY_DEPT[prefix3] || 15;
        labelOrigin = `Outre-mer ${prefix3}`;
    } 
    // Gestion Exceptions Côtières / Iles
    else if (COASTAL_EXCEPTIONS_MAP[postalCode] !== undefined) {
        baseTemp = COASTAL_EXCEPTIONS_MAP[postalCode];
        labelOrigin = "Zone Côtière/Ile";
        coastalOverrideApplied = true;
    }
    // Gestion Corse (20XXX -> 2A ou 2B approx)
    else if (postalCode.startsWith('20')) {
        baseTemp = -2; // Corse standard mer
        labelOrigin = "Corse";
    }
    // Gestion Départementale Standard
    else if (BASE_TEMP_BY_DEPT[prefix2] !== undefined) {
        baseTemp = BASE_TEMP_BY_DEPT[prefix2];
    }

    // 2. Appliquer la pondération d'altitude
    // Règle : Pas de correction de 0 à 200m.
    // Au-dessus de 200m : -1°C par tranche de 200m entamée (ou calcul linéaire selon les tableaux standards, ici step de 1°C/200m)
    // Exemple : 1901m -> (1901-200)/200 = 8.5 -> Ceil(8.5) = 9 degrés de pénalité.
    // -5 (Var base) - 9 = -14. Correspond à l'exemple utilisateur.
    
    let altitudePenalty = 0;
    if (altitude > 200) {
        altitudePenalty = Math.ceil((altitude - 200) / 200);
    }

    const finalTempMin = baseTemp - altitudePenalty;

    // 3. Déterminer Temp Max (Simplifié)
    // Les zones froides ont souvent des étés moins chauds, mais le panneau chauffe au soleil.
    // On garde une valeur standard élevée pour le dimensionnement Vmin MPPT (Worst case chaud).
    // Si Outre-mer, temp ambiante max souvent 35 aussi mais soleil fort.
    let tMaxAmb = 35;
    if (baseTemp >= -5) tMaxAmb = 38; // Zones chaudes (Sud)
    if (baseTemp <= -15) tMaxAmb = 30; // Zones très froides (Montagne)

    return {
        tempMin: finalTempMin,
        tempMaxAmb: tMaxAmb,
        label: `${labelOrigin} (Base ${baseTemp}°C) @ ${altitude}m`,
        altitudePenalty,
        baseTempSeaLevel: baseTemp,
        labelOrigin,
        coastalOverrideApplied
    };
}
