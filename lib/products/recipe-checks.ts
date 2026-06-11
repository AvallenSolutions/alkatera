// Recipe-level sanity checks (complementing the per-row checks in
// lib/constants/packaging-weight-ranges.ts). Advisory only, never blocking.

import { findUnit, quantityToKg } from '@/lib/constants/material-units';

interface NamedRow {
  name?: string;
  amount?: number | string;
  unit?: string;
}

/**
 * Find ingredient names that appear more than once (normalised), e.g. the
 * user added "Hops" twice without realising. Returns the duplicated names.
 */
export function findDuplicateIngredientNames(rows: NamedRow[]): string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const name = (row.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) duplicates.add(seen.get(key)!);
    else seen.set(key, name);
  }
  return Array.from(duplicates);
}

/**
 * Recipe-level mass check: the sum of all ingredient masses per product unit
 * shouldn't wildly exceed the product's own size. Water-heavy processes
 * (brewing) legitimately use ~3-5x, so the threshold is generous; tripping it
 * usually means batch amounts were entered in per-unit mode.
 *
 * Returns null when fine or not computable, else a plain-language message.
 */
export function checkRecipeTotalMass(input: {
  rows: NamedRow[];
  unitSizeMl?: number | null;
  /** Batch-mode divisor; 1 in per-unit mode */
  bottlesPerBatch?: number;
}): string | null {
  const sizeMl = Number(input.unitSizeMl);
  if (!sizeMl || sizeMl <= 0) return null;
  const divisor = input.bottlesPerBatch && input.bottlesPerBatch > 0 ? input.bottlesPerBatch : 1;

  let totalKg = 0;
  let counted = 0;
  for (const row of input.rows) {
    const amount = Number(row.amount);
    if (!amount || amount <= 0) continue;
    const unitDef = findUnit(row.unit || '');
    if (!unitDef || unitDef.kind === 'count') continue;
    const kg = quantityToKg(amount, unitDef);
    if (kg == null) continue;
    totalKg += kg / divisor;
    counted++;
  }
  if (counted === 0) return null;

  const productMassKg = sizeMl / 1000; // density ~1 kg/L
  const ceiling = productMassKg * 8; // generous: brewing water etc.
  if (totalKg > ceiling) {
    return (
      `Your ingredients add up to about ${totalKg.toFixed(1)} kg per ${sizeMl} ml product, ` +
      `which is over ${Math.round(totalKg / productMassKg)}x the product's own size. ` +
      `If these are batch quantities, switch the recipe to batch mode so they're divided correctly.`
    );
  }
  return null;
}

/**
 * Ingredients whose volume-to-weight conversion assumes water density but
 * whose name suggests a denser/lighter liquid. The 1 kg/L assumption is off
 * by 10-40% for these; entering weight removes the error.
 */
const DENSITY_SENSITIVE = /\b(oil|spirit|alcohol|ethanol|syrup|honey|molasses|glycerine|glycerol|cream)\b/i;

export function densityHintFor(name: string | null | undefined, unit: string | null | undefined): string | null {
  if (!name || !unit) return null;
  const unitDef = findUnit(unit);
  if (!unitDef || unitDef.kind !== 'volume') return null;
  if (!DENSITY_SENSITIVE.test(name)) return null;
  return (
    `Volumes are converted at 1 kg per litre, but ${name.toLowerCase()} is noticeably ` +
    `denser or lighter than water. Entering the weight instead removes that error.`
  );
}
