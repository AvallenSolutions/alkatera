// Live impact preview for material rows: "this adds ~0.18 kg CO2e per unit,
// about 12% of a typical gin's footprint".
//
// This is the strongest accuracy safeguard available to non-LCA users: a
// wrong factor or a wrong amount becomes a visibly weird number instead of
// an invisible mistake. Previews are indicative (selection-time factor,
// production amortisation not included) — the authoritative figure comes
// from the calculator.

import { findUnit, quantityToKg } from '@/lib/constants/material-units';
import { getBenchmarkForCategory } from '@/lib/industry-benchmarks';

export interface ImpactPreview {
  /** Estimated kg CO2e contributed by this row, per product unit */
  perUnitKgCo2e: number;
  /** Typical whole-product footprint for this category/size, when known */
  benchmarkPerUnitKgCo2e: number | null;
  /** perUnit / benchmark (0..n), null when no benchmark applies */
  shareOfBenchmark: number | null;
  /** Human label for the benchmark category (e.g. "Spirits") */
  benchmarkLabel: string | null;
}

function withBenchmark(
  perUnitKgCo2e: number,
  unitSizeMl?: number | null,
  category?: string | null
): ImpactPreview {
  let benchmarkPerUnitKgCo2e: number | null = null;
  let benchmarkLabel: string | null = null;
  if (unitSizeMl && unitSizeMl > 0) {
    const benchmark = getBenchmarkForCategory(category);
    benchmarkPerUnitKgCo2e = benchmark.kgCO2ePerLitre * (unitSizeMl / 1000);
    benchmarkLabel = benchmark.label ?? category ?? null;
  }
  return {
    perUnitKgCo2e,
    benchmarkPerUnitKgCo2e,
    shareOfBenchmark:
      benchmarkPerUnitKgCo2e && benchmarkPerUnitKgCo2e > 0
        ? perUnitKgCo2e / benchmarkPerUnitKgCo2e
        : null,
    benchmarkLabel,
  };
}

/** Preview for an ingredient row. Returns null when not yet computable. */
export function computeIngredientImpactPreview(input: {
  amount: number | string;
  unit: string;
  /** kg CO2e per reference unit (≈ per kg, or per item for count units) */
  carbonIntensity?: number | null;
  /** Batch-mode divisor; 1 (or undefined) in per-unit mode */
  bottlesPerBatch?: number;
  unitSizeMl?: number | null;
  category?: string | null;
}): ImpactPreview | null {
  const amount = typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;
  const ci = input.carbonIntensity;
  if (!amount || amount <= 0 || ci == null || isNaN(ci)) return null;

  const unitDef = findUnit(input.unit);
  if (!unitDef) return null;

  // Count units: the factor is per item, the quantity is a count.
  const referenceQty = unitDef.kind === 'count' ? amount : quantityToKg(amount, unitDef);
  if (referenceQty == null) return null;

  const divisor = input.bottlesPerBatch && input.bottlesPerBatch > 0 ? input.bottlesPerBatch : 1;
  const perUnit = (referenceQty * ci) / divisor;
  if (!isFinite(perUnit) || perUnit < 0) return null;

  return withBenchmark(perUnit, input.unitSizeMl, input.category);
}

/** Preview for a packaging row (weight-based, with sharing and reuse). */
export function computePackagingImpactPreview(input: {
  netWeightG: number | string;
  carbonIntensity?: number | null;
  /** Products sharing this packaging (case/pallet); 1 for primary */
  unitsPerGroup?: number | string | null;
  /** Reuse trips amortisation (kegs/casks); 1 for single-use */
  reuseTrips?: number | string | null;
  unitSizeMl?: number | null;
  category?: string | null;
}): ImpactPreview | null {
  const weightG = typeof input.netWeightG === 'string' ? parseFloat(input.netWeightG) : input.netWeightG;
  const ci = input.carbonIntensity;
  if (!weightG || weightG <= 0 || ci == null || isNaN(ci)) return null;

  const upg = Math.max(1, Number(input.unitsPerGroup) || 1);
  const trips = Math.max(1, Number(input.reuseTrips) || 1);
  const perUnit = ((weightG / 1000) * ci) / upg / trips;
  if (!isFinite(perUnit) || perUnit < 0) return null;

  return withBenchmark(perUnit, input.unitSizeMl, input.category);
}

/** "0.18" or "0.0042" — sensible precision for small numbers. */
export function formatPreviewKg(kg: number): string {
  if (kg >= 0.1) return kg.toFixed(2);
  if (kg >= 0.01) return kg.toFixed(3);
  return kg.toFixed(4);
}
