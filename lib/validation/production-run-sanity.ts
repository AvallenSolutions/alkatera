/**
 * Production-run resource-data sanity checks.
 *
 * Direct production-run data is the highest-quality input to an LCA: in the
 * "Direct Run Data" path of the product carbon footprint calculator, a run's
 * electricity and water are divided straight by the run's own production volume,
 * with NO facility-level attribution. That makes per-unit intensities extremely
 * sensitive to two common data-entry mistakes:
 *
 *   1. A facility-period resource figure (e.g. a whole-period water-intake) being
 *      copy-pasted onto an individual product run, then divided by a small batch
 *      volume.
 *   2. A production volume entered far too low (a partial/test batch, or a unit
 *      mismatch) relative to the resources recorded for the run.
 *
 * Either mistake silently inflates the product's processing footprint. This module
 * computes the resulting per-unit intensities and flags ones that are physically
 * implausible for a drinks product, so they can be surfaced at data-entry time and
 * at calculation time before they reach a published report.
 *
 * Thresholds are deliberately GENEROUS heuristics: they exist to catch gross
 * errors (orders of magnitude off), not to enforce policy or judge a genuinely
 * resource-intensive process. A clean result never means the data is correct,
 * only that nothing is obviously wrong.
 */

export type ProductionVolumeUnit = 'Litres' | 'Hectolitres' | 'Units' | 'kg';

export interface RunIntensityInput {
  /** Production volume as entered on the run. */
  productionVolume: number;
  /** Volume unit. Unknown units fall back to the per-"Units" ceilings. */
  productionVolumeUnit: string;
  /** Total electricity for the run, in kWh (computed total). */
  electricityKwh?: number | null;
  /** Total fresh-water intake for the run, in cubic metres. */
  waterM3?: number | null;
}

export interface RunIntensityWarning {
  field: 'water' | 'electricity';
  /** Per-functional-unit intensity that triggered the warning. */
  perUnit: number;
  /** The ceiling that was exceeded, in the same per-unit terms. */
  threshold: number;
  /** Unit label for the denominator, e.g. "L of product", "unit", "kg". */
  denominatorLabel: string;
  /** Human-readable, plain-language explanation (British English, no jargon). */
  message: string;
}

/**
 * Per-unit ceilings above which an intensity is treated as implausible.
 *
 * Rationale (drinks industry, cradle-to-grave processing only):
 *  - Water: even very water-heavy beverage processing rarely exceeds ~20 L of
 *    water per 1 L of product. Per packaged unit (a bottle/can/multipack) ~50 L is
 *    already extreme. A facility-period total divided by a small batch (the bug we
 *    are guarding against) lands in the hundreds, so these ceilings catch it
 *    comfortably while leaving real processes untouched.
 *  - Electricity: ~5 kWh per litre / per unit, ~10 kWh per kg, is far above normal
 *    beverage processing and packaging.
 */
const CEILINGS: Record<
  ProductionVolumeUnit,
  { litresOfProductPerVolume: number; waterPerUnit: number; electricityPerUnit: number; denominatorLabel: string }
> = {
  // 1 volume-unit == 1 litre of product
  Litres: { litresOfProductPerVolume: 1, waterPerUnit: 20, electricityPerUnit: 5, denominatorLabel: 'L of product' },
  // 1 hectolitre == 100 litres of product
  Hectolitres: { litresOfProductPerVolume: 100, waterPerUnit: 2000, electricityPerUnit: 500, denominatorLabel: 'hL of product' },
  // discrete packaged units (bottles, cans, multipacks)
  Units: { litresOfProductPerVolume: 1, waterPerUnit: 50, electricityPerUnit: 5, denominatorLabel: 'unit' },
  // mass basis
  kg: { litresOfProductPerVolume: 1, waterPerUnit: 50, electricityPerUnit: 10, denominatorLabel: 'kg' },
};

function resolveCeilings(unit: string) {
  const key = (Object.keys(CEILINGS) as ProductionVolumeUnit[]).find(
    (k) => k.toLowerCase() === (unit || '').toLowerCase()
  );
  // Unknown units are treated as discrete "Units" — the most conservative basis.
  return CEILINGS[key ?? 'Units'];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Evaluate a single production run's per-unit intensities and return any
 * implausibility warnings. Returns an empty array when the run looks sensible or
 * when there is not enough data to judge (no volume, or no resources entered).
 */
export function checkRunIntensity(input: RunIntensityInput): RunIntensityWarning[] {
  const volume = Number(input.productionVolume);
  if (!Number.isFinite(volume) || volume <= 0) return [];

  const warnings: RunIntensityWarning[] = [];
  const ceilings = resolveCeilings(input.productionVolumeUnit);

  const waterM3 = Number(input.waterM3 ?? 0);
  if (Number.isFinite(waterM3) && waterM3 > 0) {
    const waterLitresPerUnit = (waterM3 * 1000) / volume;
    if (waterLitresPerUnit > ceilings.waterPerUnit) {
      warnings.push({
        field: 'water',
        perUnit: round(waterLitresPerUnit),
        threshold: ceilings.waterPerUnit,
        denominatorLabel: ceilings.denominatorLabel,
        message:
          `This run works out to ${round(waterLitresPerUnit).toLocaleString()} L of water per ` +
          `${ceilings.denominatorLabel} (${waterM3.toLocaleString()} m³ over ${volume.toLocaleString()} ` +
          `${input.productionVolumeUnit}). That is far higher than expected for a drinks product. ` +
          `Check the water intake is for this run only (not a whole month or the whole facility) ` +
          `and that the production volume is correct.`,
      });
    }
  }

  const electricityKwh = Number(input.electricityKwh ?? 0);
  if (Number.isFinite(electricityKwh) && electricityKwh > 0) {
    const kwhPerUnit = electricityKwh / volume;
    if (kwhPerUnit > ceilings.electricityPerUnit) {
      warnings.push({
        field: 'electricity',
        perUnit: round(kwhPerUnit),
        threshold: ceilings.electricityPerUnit,
        denominatorLabel: ceilings.denominatorLabel,
        message:
          `This run works out to ${round(kwhPerUnit).toLocaleString()} kWh of electricity per ` +
          `${ceilings.denominatorLabel} (${electricityKwh.toLocaleString()} kWh over ${volume.toLocaleString()} ` +
          `${input.productionVolumeUnit}). That is far higher than expected. Check the electricity is ` +
          `for this run only and that the production volume is correct.`,
      });
    }
  }

  return warnings;
}

/** Convenience: true when a run has any implausible per-unit intensity. */
export function hasImplausibleIntensity(input: RunIntensityInput): boolean {
  return checkRunIntensity(input).length > 0;
}
