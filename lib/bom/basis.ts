// Quantity-basis handling for bills of materials.
//
// A recipe workbook usually expresses ingredient dosages PER LITRE of finished
// liquid (columns like "g/L", "ml/L", "mg/L") or per hectolitre ("kg/hL",
// "g/hL"), NOT per finished unit. But product_materials.quantity is stored and
// costed PER UNIT of product (per bottle / per can). So a 2 g/L dosage on a
// 250 ml can must be saved as 0.5 g, not 2 g. Packaging (the can, the lid) is
// always per-unit and must never be scaled.
//
// This module is the single source of truth for (a) detecting the basis from a
// raw unit string the regex parser reads, and (b) converting a per-basis
// quantity to a per-unit quantity given the product's finished volume.

export type QuantityBasis = 'per_litre' | 'per_hectolitre' | 'per_unit';

export interface DetectedBasis {
  /** The volumetric basis implied by the unit string. */
  basis: QuantityBasis;
  /** The mass/volume unit with any "/litre" suffix stripped (e.g. "g/L" -> "g"). */
  baseUnit: string | null;
}

/**
 * Infer the quantity basis from a raw unit string. Recipe sheets encode the
 * basis in the unit column: "g/L", "ml/l", "mg / litre" -> per litre;
 * "kg/hl", "g/hL" -> per hectolitre. A plain mass/volume/count unit ("g",
 * "kg", "ml", "unit") -> per unit (absolute).
 *
 * Returns the base unit with the volumetric suffix removed so downstream code
 * stores a clean unit ("g") rather than the composite ("g/L").
 */
export function detectBasisFromUnit(unit: string | null | undefined): DetectedBasis {
  const raw = (unit || '').trim();
  if (!raw) return { basis: 'per_unit', baseUnit: null };

  const lower = raw.toLowerCase();

  // Match a "<massUnit> per <volume>" shape. Accept "/", " per ", or "p" forms
  // and both litre and hectolitre denominators. The numerator is captured so
  // we can strip the denominator and keep a clean base unit.
  const perVolume = lower.match(
    /^([a-zµμ]+)\s*(?:\/|\s+per\s+)\s*(hl|hectolitre|hectoliter|l|litre|liter)\b/,
  );
  if (perVolume) {
    const denom = perVolume[2];
    const basis: QuantityBasis =
      denom === 'hl' || denom.startsWith('hecto') ? 'per_hectolitre' : 'per_litre';
    // Preserve the original casing of the numerator where possible.
    const baseUnit = raw.slice(0, perVolume[1].length);
    return { basis, baseUnit };
  }

  return { basis: 'per_unit', baseUnit: raw };
}

/** Round a scaled amount the way the recipe-starter feature does: more decimal
 * places for small dosages, whole numbers for large ones. Keeps imported
 * recipes tidy without losing precision on trace ingredients. */
export function roundScaledAmount(scaled: number): number {
  if (!Number.isFinite(scaled)) return 0;
  const abs = Math.abs(scaled);
  if (abs >= 100) return Math.round(scaled);
  if (abs >= 10) return Math.round(scaled * 10) / 10;
  if (abs >= 1) return Math.round(scaled * 100) / 100;
  // Trace dosages (mg/L territory) need more places.
  return Math.round(scaled * 100000) / 100000;
}

export interface ScaleResult {
  /** The per-unit amount, or the original amount when no scaling applied. */
  amount: number;
  /** True when a volumetric basis was actually converted using the volume. */
  scaled: boolean;
}

/**
 * Convert a quantity expressed on `basis` to a per-unit amount, given the
 * product's finished volume in millilitres. Per-unit bases pass through
 * unchanged. Volumetric bases require a positive `unitSizeMl`; without it the
 * amount is returned untouched and `scaled` is false so callers can warn.
 *
 *   2 g/L,  unitSizeMl 250  -> 0.5 g   (2 * 0.25)
 *   3 kg/hL, unitSizeMl 250 -> 0.0075  (3 * 0.25 / 100)
 */
export function scaleQuantityToUnit(
  quantity: number | null | undefined,
  basis: QuantityBasis | null | undefined,
  unitSizeMl: number | null | undefined,
): ScaleResult {
  const qty = typeof quantity === 'number' ? quantity : Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { amount: qty || 0, scaled: false };

  if (!basis || basis === 'per_unit') return { amount: qty, scaled: false };

  const litres = unitSizeMl && unitSizeMl > 0 ? unitSizeMl / 1000 : null;
  if (litres == null) return { amount: qty, scaled: false };

  const perLitreQty = basis === 'per_hectolitre' ? qty / 100 : qty;
  return { amount: roundScaledAmount(perLitreQty * litres), scaled: true };
}
