
import { RoofType, WindZone, Margins } from '../types';

/**
 * Calculates recommended safety margins based on French standards (DTU/Eurocodes).
 * Increases margins for high wind zones to protect against edge uplift (Zone S).
 */
export function getRecommendedMargins(roofType: RoofType, windZone: WindZone): Margins {
    let baseMargin = 300; // Minimum 30cm by default

    // Adjust based on Wind Zone (Zone de Rive - Edge Zone S)
    switch (windZone) {
        case WindZone.ZONE_1:
        case WindZone.ZONE_2:
            baseMargin = 300;
            break;
        case WindZone.ZONE_3:
            baseMargin = 400;
            break;
        case WindZone.ZONE_4:
            baseMargin = 500; // High wind requires larger edge distance
            break;
        case WindZone.ZONE_5:
            baseMargin = 600; // Extreme wind
            break;
    }

    // Adjust based on Roof Type (Physical constraints)
    let sideMargin = baseMargin;
    let topBottomMargin = baseMargin;

    switch (roofType) {
        case RoofType.TUILE_MECANIQUE:
        case RoofType.TUILE_PLATE:
            // Tiles often require aligning hooks with rafters which might not be exactly at the edge.
            // Keep standard calculated margin.
            break;
        case RoofType.TUILE_CANAL:
             // Canal tiles are often looser, require more care at edges.
             sideMargin += 50;
             break;
        case RoofType.FIBROCIMENT:
            // Corrugated sheets: Fixing must be on purlins.
            // Side overlap needs space.
            sideMargin += 100; 
            break;
    }

    return {
        top: topBottomMargin,
        bottom: topBottomMargin,
        left: sideMargin,
        right: sideMargin
    };
}


// --- Electrical protective device sanity rules (simplified / conservative) ---

export type CableSection = 2.5 | 6 | 10 | 16 | 25;

// "Max protective device" per section (AC).
// IMPORTANT: we intentionally expose TWO tables:
// - STANDARD: usual residential installation conditions (used for PDF + conformity verdict)
// - PESSIMISTIC: unfavourable assumptions (encastré / température / regroupement)
// This allows the UI to be pedagogical without contradicting the PDF.

export function getMaxInForSectionStandard(section: number): number | null {
  // Typical "standard" sizing used in many residential PV board connections.
  // (Still simplified: real Iz depends on installation method.)
  const map: Record<number, number> = { 2.5: 25, 6: 40, 10: 50, 16: 63, 25: 80 };
  return map[section] ?? null;
}

export function getMaxInForSectionPessimistic(section: number): number | null {
  // Conservative guardrail values.
  const map: Record<number, number> = { 2.5: 20, 6: 32, 10: 40, 16: 63, 25: 80 };
  return map[section] ?? null;
}

// Conservative "minimum section" that makes sense for a given protective device (AC).
export function getMinSectionForIn(inA: number): number {
  if (inA <= 20) return 2.5;
  if (inA <= 32) return 6;
  if (inA <= 40) return 10;
  if (inA <= 63) return 16;
  return 25;
}

export type ProtectionStatus = 'ok' | 'info' | 'danger';

// "Danger" = exceeds STANDARD table (should be treated as non-conforming in app + PDF).
export function isProtectionTooHighForSection(section: number, inA: number): boolean {
  const maxStd = getMaxInForSectionStandard(section);
  if (maxStd == null) return false;
  return inA > maxStd;
}

// Pedagogical status used in the UI.
// ok     : In <= pessimistic
// info   : pessimistic < In <= standard (usually OK, but check installation conditions)
// danger : In > standard
export function getProtectionStatusForSection(section: number, inA: number): ProtectionStatus {
  const maxPes = getMaxInForSectionPessimistic(section);
  const maxStd = getMaxInForSectionStandard(section);
  if (maxStd == null) return 'ok';
  if (inA > maxStd) return 'danger';
  if (maxPes != null && inA > maxPes) return 'info';
  return 'ok';
}

export function isSectionOversizedForIn(section: number, inA: number): boolean {
  const min = getMinSectionForIn(inA);
  return section > min;
}


// --- PV DC (MPPT strings) cable sanity rules (simplified / conservative) ---
// Same philosophy as AC: we only prevent obviously dangerous combinations.
// In PV, installers often oversize section to reduce voltage drop; that's OK.

export function getMaxIdcForSection(section: number): number | null {
  // Conservative terrain values for typical PV DC cable.
  // Note: real Iz depends on installation; this is a simplified safety guard.
  const map: Record<number, number> = { 2.5: 20, 6: 32, 10: 40, 16: 63 };
  return map[section] ?? null;
}

export function isDcCableTooSmallForI(section: number, idcA: number): boolean {
  const max = getMaxIdcForSection(section);
  if (max == null) return false;
  return idcA > max;
}

export function isDcSectionOversizedForI(section: number, idcA: number): boolean {
  // reuse AC helper to keep consistent steps
  const min = getMinSectionForIn(idcA);
  return section > min;
}
