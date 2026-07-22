// The number that forms while you compose.
//
// The composition surface (tasks/liquid-pack-entry-design.md §4) says the
// footprint appears as soon as two slots hold anything, so there is never a
// moment where the screen is a form with a Save button. This is the sum behind
// that number: the liquid's ingredient rows plus the pack format's component
// rows, each priced through the same per-row preview the recipe editor already
// shows beside every line.
//
// It is deliberately NOT the calculator. The calculator owns the authoritative
// figure and runs server-side over a PCF; this is the selection-time estimate
// that makes a wrong pick look wrong immediately. Rows the preview cannot price
// (no factor yet, no weight yet) are COUNTED and reported rather than treated
// as zero, because "0.31 from 4 of 6 lines" is honest and "0.31" is not.

import {
  computeIngredientImpactPreview,
  computePackagingImpactPreview,
} from './impact-preview';

/** The subset of product_materials the estimate reads. */
export interface EstimateRow {
  material_type?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  net_weight_g?: number | string | null;
  cached_co2_factor?: number | null;
  units_per_group?: number | string | null;
  reuse_trips?: number | string | null;
}

export interface CompositionEstimate {
  /** Sum of the priced rows, kg CO2e per unit. */
  perUnitKgCo2e: number;
  ingredientKgCo2e: number;
  packagingKgCo2e: number;
  /** Rows the preview could price. */
  pricedRows: number;
  /** Rows present but not yet priceable — the honest caveat on the number. */
  unpricedRows: number;
}

export interface EstimateContext {
  /** Batch-mode divisor for the liquid; 1 or undefined in per-unit mode. */
  bottlesPerBatch?: number;
  unitSizeMl?: number | null;
  category?: string | null;
}

/**
 * Price a composition's rows. Returns null when nothing at all could be
 * priced, so callers can show "not yet" rather than a confident zero.
 */
export function estimateComposition(
  rows: EstimateRow[],
  context: EstimateContext = {}
): CompositionEstimate | null {
  let ingredientKgCo2e = 0;
  let packagingKgCo2e = 0;
  let pricedRows = 0;
  let unpricedRows = 0;

  for (const row of rows) {
    if (row.material_type === 'packaging') {
      const preview = computePackagingImpactPreview({
        netWeightG: row.net_weight_g ?? 0,
        carbonIntensity: row.cached_co2_factor,
        unitsPerGroup: row.units_per_group,
        reuseTrips: row.reuse_trips,
        unitSizeMl: context.unitSizeMl,
        category: context.category,
      });
      if (preview) {
        packagingKgCo2e += preview.perUnitKgCo2e;
        pricedRows += 1;
      } else {
        unpricedRows += 1;
      }
      continue;
    }

    const preview = computeIngredientImpactPreview({
      amount: row.quantity ?? 0,
      unit: row.unit ?? '',
      carbonIntensity: row.cached_co2_factor,
      bottlesPerBatch: context.bottlesPerBatch,
      unitSizeMl: context.unitSizeMl,
      category: context.category,
    });
    if (preview) {
      ingredientKgCo2e += preview.perUnitKgCo2e;
      pricedRows += 1;
    } else {
      unpricedRows += 1;
    }
  }

  if (pricedRows === 0) return null;

  return {
    perUnitKgCo2e: ingredientKgCo2e + packagingKgCo2e,
    ingredientKgCo2e,
    packagingKgCo2e,
    pricedRows,
    unpricedRows,
  };
}

/**
 * How complete the estimate is, in the words the surface uses. Kept here so
 * the sentence and the sum cannot drift apart.
 */
export function describeEstimate(estimate: CompositionEstimate): string {
  if (estimate.unpricedRows === 0) {
    return `From all ${estimate.pricedRows} line${estimate.pricedRows === 1 ? '' : 's'}.`;
  }
  return `From ${estimate.pricedRows} of ${estimate.pricedRows + estimate.unpricedRows} lines. The rest need a weight or a factor before they count.`;
}
