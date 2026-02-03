
import { WindZone } from '../types';

// Simplified mapping of French department prefixes to wind zones.
// This is a simplified representation and may not be 100% accurate for all municipalities.
// A more accurate system would require a detailed database.
const departmentToWindZone: { [prefix: string]: WindZone } = {
  // Zone 5 (Outre-mer) - Not exhaustive
  '971': WindZone.ZONE_5, // Guadeloupe
  '972': WindZone.ZONE_5, // Martinique
  '973': WindZone.ZONE_5, // Guyane
  '974': WindZone.ZONE_5, // La Réunion
  '976': WindZone.ZONE_5, // Mayotte

  // Zone 4 (Côte méditerranéenne et Corse)
  '06': WindZone.ZONE_4, // Alpes-Maritimes
  '11': WindZone.ZONE_4, // Aude
  '13': WindZone.ZONE_4, // Bouches-du-Rhône
  '2A': WindZone.ZONE_4, // Corse-du-Sud
  '2B': WindZone.ZONE_4, // Haute-Corse
  '30': WindZone.ZONE_4, // Gard
  '34': WindZone.ZONE_4, // Hérault
  '66': WindZone.ZONE_4, // Pyrénées-Orientales
  '83': WindZone.ZONE_4, // Var

  // Zone 3 (Côtes Atlantique, Manche, Mer du Nord)
  '14': WindZone.ZONE_3, // Calvados
  '17': WindZone.ZONE_3, // Charente-Maritime
  '22': WindZone.ZONE_3, // Côtes-d'Armor
  '29': WindZone.ZONE_3, // Finistère
  '33': WindZone.ZONE_3, // Gironde (partially, simplifying to Zone 3)
  '40': WindZone.ZONE_3, // Landes
  '44': WindZone.ZONE_3, // Loire-Atlantique
  '50': WindZone.ZONE_3, // Manche
  '56': WindZone.ZONE_3, // Morbihan
  '59': WindZone.ZONE_3, // Nord
  '62': WindZone.ZONE_3, // Pas-de-Calais
  '64': WindZone.ZONE_3, // Pyrénées-Atlantiques (partially, simplifying)
  '76': WindZone.ZONE_3, // Seine-Maritime
  '80': WindZone.ZONE_3, // Somme
  '85': WindZone.ZONE_3, // Vendée

  // Zone 2 (Bande intérieure) - Many departments could be here, this is a sample
  '02': WindZone.ZONE_2, // Aisne
  '08': WindZone.ZONE_2, // Ardennes
  '27': WindZone.ZONE_2, // Eure
  '28': WindZone.ZONE_2, // Eure-et-Loir
  '35': WindZone.ZONE_2, // Ille-et-Vilaine
  '37': WindZone.ZONE_2, // Indre-et-Loire
  '41': WindZone.ZONE_2, // Loir-et-Cher
  '45': WindZone.ZONE_2, // Loiret
  '49': WindZone.ZONE_2, // Maine-et-Loire
  '51': WindZone.ZONE_2, // Marne
  '54': WindZone.ZONE_2, // Meurthe-et-Moselle
  '55': WindZone.ZONE_2, // Meuse
  '57': WindZone.ZONE_2, // Moselle
  '60': WindZone.ZONE_2, // Oise
  '61': WindZone.ZONE_2, // Orne
  '72': WindZone.ZONE_2, // Sarthe
  '77': WindZone.ZONE_2, // Seine-et-Marne
  '78': WindZone.ZONE_2, // Yvelines
  '79': WindZone.ZONE_2, // Deux-Sèvres
  '86': WindZone.ZONE_2, // Vienne
  '87': WindZone.ZONE_2, // Haute-Vienne
  '89': WindZone.ZONE_2, // Yonne
  '91': WindZone.ZONE_2, // Essonne
  '95': WindZone.ZONE_2, // Val-d'Oise
};


export function getWindZone(postalCode: string): WindZone {
  if (!postalCode || postalCode.length < 2) {
    return WindZone.ZONE_1; // Default
  }

  // Handle Corsica '2A' and '2B'
  if (postalCode.toUpperCase().startsWith('2A') || postalCode.toUpperCase().startsWith('2B')) {
      return WindZone.ZONE_4;
  }
  
  const prefix3 = postalCode.substring(0, 3);
  if (departmentToWindZone[prefix3]) {
    return departmentToWindZone[prefix3];
  }

  const prefix2 = postalCode.substring(0, 2);
  if (departmentToWindZone[prefix2]) {
    return departmentToWindZone[prefix2];
  }

  // Default to Zone 1 for all other inland departments
  return WindZone.ZONE_1;
}
