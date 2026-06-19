/**
 * Measured soil carbon: stock-change engine.
 *
 * Implements the "measure the place, track the trajectory" approach to soil
 * organic carbon (SOC). Rather than asking a grower for a single annual removal
 * flux, we capture repeated field measurements of SOC STOCK and derive the
 * annual change between them. The unit of value is the measured direction and
 * scale of change over time, sampled consistently (same depth, same lab).
 *
 * FLAG alignment: removals are always expressed as positive kg CO2e and reported
 * separately from emissions, never netted. A measured DECLINE in soil carbon is
 * surfaced (trajectory matters) but yields a removal of zero and a warning.
 *
 * Confidence and conservatism: uncertainty lives in field heterogeneity, not the
 * lab analysis, so confidence scales with sampling density and depth consistency.
 * A conservative discount is applied to low-confidence removal claims so they are
 * never over-stated.
 */

import {
  C_TO_CO2E,
  SOIL_CARBON_DEPTH_TOLERANCE_CM,
  SOIL_CARBON_MIN_POINTS_HIGH,
  SOIL_CARBON_MIN_POINTS_MEDIUM,
  SOIL_CARBON_MIN_DEPTH_CM,
  SOIL_CARBON_CONFIDENCE_DISCOUNT,
} from './ghg-constants';

export type SoilCarbonConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type SoilCarbonInputMethod = 'stock' | 'concentration';

export type SoilCarbonChangeMethodology =
  | 'measured_stock_change'
  | 'baseline_only'
  | 'insufficient_data';

/**
 * One soil carbon measurement for a land unit at a point in time. Mirrors the
 * `soil_carbon_samples` table. Either a measured SOC stock is supplied directly,
 * or concentration + bulk density (the raw lab values) from which we derive it.
 */
export interface SoilCarbonSample {
  id?: string;
  sample_date: string; // ISO date
  depth_cm: number;
  soc_input_method: SoilCarbonInputMethod;
  /** Measured SOC stock to depth (tonnes C / ha). Required for 'stock'. */
  soc_stock_tc_ha?: number | null;
  /** SOC concentration (% by mass). Required for 'concentration'. */
  soc_concentration_pct?: number | null;
  /** Dry bulk density (g/cm³). Required for 'concentration'. */
  bulk_density_g_cm3?: number | null;
  sampling_points?: number | null;
  lab_name?: string | null;
  methodology?: string | null;
  verification_status?: string | null;
}

export interface StockChangeResult {
  /** Net annual removal flux used downstream (kg CO2e/ha/yr, >= 0 after discount). */
  annual_kg_co2e_per_ha: number;
  /** Signed annual change before the conservative discount (negative = soil carbon loss). */
  gross_annual_kg_co2e_per_ha: number;
  methodology: SoilCarbonChangeMethodology;
  confidence: SoilCarbonConfidence;
  /** True when the two compared samples were taken to a consistent depth. */
  depth_consistent: boolean;
  /** True when the trajectory is downward (soil carbon declining). */
  is_loss: boolean;
  baseline_date: string | null;
  latest_date: string | null;
  baseline_stock_tc_ha: number | null;
  latest_stock_tc_ha: number | null;
  years_elapsed: number | null;
  /** Fraction of the gross removal withheld for conservatism (0 = none). */
  discount_applied: number;
  warning: string | null;
}

const CONFIDENCE_RANK: Record<SoilCarbonConfidence, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const RANK_CONFIDENCE: SoilCarbonConfidence[] = ['LOW', 'MEDIUM', 'HIGH'];

function minConfidence(
  a: SoilCarbonConfidence,
  b: SoilCarbonConfidence,
): SoilCarbonConfidence {
  return RANK_CONFIDENCE[Math.min(CONFIDENCE_RANK[a], CONFIDENCE_RANK[b])];
}

/**
 * SOC stock (tonnes C / ha) from raw lab values.
 *   stock = concentration(%) × bulk density(g/cm³) × depth(cm)
 * Derivation: (%C/100) × BD(g/cm³) × depth(cm) gives g C/cm², and
 * 1 g/cm² = 100 t/ha, so the /100 and ×100 cancel.
 */
export function socStockFromConcentration(args: {
  concentration_pct: number;
  bulk_density_g_cm3: number;
  depth_cm: number;
}): number {
  const { concentration_pct, bulk_density_g_cm3, depth_cm } = args;
  return concentration_pct * bulk_density_g_cm3 * depth_cm;
}

/**
 * Resolve a sample to its SOC stock in tonnes C / ha, computing from raw lab
 * values when the concentration method was used. Returns null if insufficient.
 */
export function resolveSampleStock(sample: SoilCarbonSample): number | null {
  if (sample.soc_input_method === 'stock') {
    return sample.soc_stock_tc_ha != null ? sample.soc_stock_tc_ha : null;
  }
  if (
    sample.soc_concentration_pct != null &&
    sample.bulk_density_g_cm3 != null &&
    sample.depth_cm != null
  ) {
    return socStockFromConcentration({
      concentration_pct: sample.soc_concentration_pct,
      bulk_density_g_cm3: sample.bulk_density_g_cm3,
      depth_cm: sample.depth_cm,
    });
  }
  return null;
}

/**
 * Confidence for a single measurement, driven by spatial sampling density and
 * sampling depth, then capped at MEDIUM when the measurement is not third-party
 * verified (reliability ceiling).
 */
export function assessSampleConfidence(
  sample: SoilCarbonSample,
): SoilCarbonConfidence {
  const points = sample.sampling_points ?? 0;
  const depth = sample.depth_cm ?? 0;

  let confidence: SoilCarbonConfidence;
  if (points >= SOIL_CARBON_MIN_POINTS_HIGH && depth >= SOIL_CARBON_MIN_DEPTH_CM) {
    confidence = 'HIGH';
  } else if (points >= SOIL_CARBON_MIN_POINTS_MEDIUM) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  const verified = sample.verification_status === 'verified';
  if (!verified && confidence === 'HIGH') {
    confidence = 'MEDIUM';
  }
  return confidence;
}

/**
 * Compute the measured annual SOC stock change from a series of samples for one
 * land unit. Compares the earliest and latest active samples taken to a
 * consistent depth.
 *
 * Returns:
 *  - measured_stock_change when ≥2 depth-consistent samples exist
 *  - baseline_only when exactly one usable sample exists (no claim yet)
 *  - insufficient_data when nothing usable is present
 */
export function computeAnnualStockChange(
  samples: SoilCarbonSample[],
): StockChangeResult {
  const empty: StockChangeResult = {
    annual_kg_co2e_per_ha: 0,
    gross_annual_kg_co2e_per_ha: 0,
    methodology: 'insufficient_data',
    confidence: 'LOW',
    depth_consistent: false,
    is_loss: false,
    baseline_date: null,
    latest_date: null,
    baseline_stock_tc_ha: null,
    latest_stock_tc_ha: null,
    years_elapsed: null,
    discount_applied: 0,
    warning: null,
  };

  // Keep only samples we can resolve to a stock, sorted oldest → newest.
  const usable = samples
    .map((s) => ({ sample: s, stock: resolveSampleStock(s) }))
    .filter((x): x is { sample: SoilCarbonSample; stock: number } => x.stock != null)
    .sort(
      (a, b) =>
        new Date(a.sample.sample_date).getTime() -
        new Date(b.sample.sample_date).getTime(),
    );

  if (usable.length === 0) {
    return empty;
  }

  if (usable.length === 1) {
    return {
      ...empty,
      methodology: 'baseline_only',
      confidence: assessSampleConfidence(usable[0].sample),
      baseline_date: usable[0].sample.sample_date,
      baseline_stock_tc_ha: usable[0].stock,
      warning:
        'Baseline soil carbon recorded. Re-measure at the same depth and lab to claim a measured change.',
    };
  }

  const baseline = usable[0];
  const latest = usable[usable.length - 1];

  const depthConsistent =
    Math.abs(baseline.sample.depth_cm - latest.sample.depth_cm) <=
    SOIL_CARBON_DEPTH_TOLERANCE_CM;

  if (!depthConsistent) {
    return {
      ...empty,
      methodology: 'baseline_only',
      confidence: 'LOW',
      depth_consistent: false,
      baseline_date: baseline.sample.sample_date,
      latest_date: latest.sample.sample_date,
      baseline_stock_tc_ha: baseline.stock,
      latest_stock_tc_ha: latest.stock,
      warning:
        'Samples were taken to different depths and cannot be compared. Re-measure to a consistent depth to claim a change.',
    };
  }

  const yearsElapsed =
    (new Date(latest.sample.sample_date).getTime() -
      new Date(baseline.sample.sample_date).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);

  if (yearsElapsed <= 0) {
    return {
      ...empty,
      methodology: 'baseline_only',
      baseline_date: baseline.sample.sample_date,
      baseline_stock_tc_ha: baseline.stock,
      warning: 'Two samples share the same date; a trajectory needs measurements over time.',
    };
  }

  const deltaStockTcHa = latest.stock - baseline.stock;
  // tC/ha/yr → kg CO2e/ha/yr (positive = removal).
  const grossAnnual = (deltaStockTcHa / yearsElapsed) * C_TO_CO2E * 1000;
  const isLoss = grossAnnual < 0;

  const confidence = minConfidence(
    assessSampleConfidence(baseline.sample),
    assessSampleConfidence(latest.sample),
  );

  // Conservative discount applies only to positive removals; a measured loss is
  // never shrunk (we do not understate a decline).
  const discount = isLoss ? 0 : SOIL_CARBON_CONFIDENCE_DISCOUNT[confidence] ?? 0;
  const netAnnual = isLoss ? 0 : grossAnnual * (1 - discount);

  return {
    annual_kg_co2e_per_ha: netAnnual,
    gross_annual_kg_co2e_per_ha: grossAnnual,
    methodology: 'measured_stock_change',
    confidence,
    depth_consistent: true,
    is_loss: isLoss,
    baseline_date: baseline.sample.sample_date,
    latest_date: latest.sample.sample_date,
    baseline_stock_tc_ha: baseline.stock,
    latest_stock_tc_ha: latest.stock,
    years_elapsed: yearsElapsed,
    discount_applied: discount,
    warning: isLoss
      ? 'Measured soil carbon has declined over the period. This is reported as a removal of zero and surfaced in the trajectory.'
      : null,
  };
}

/**
 * Build the per-period trajectory series (one stock point per sample date) for
 * charting, oldest → newest. Stocks are resolved (computed from raw lab values
 * where needed) so the series is always in tonnes C / ha.
 */
export function buildSoilCarbonTrajectory(samples: SoilCarbonSample[]): Array<{
  date: string;
  stock_tc_ha: number;
  depth_cm: number;
  verified: boolean;
  confidence: SoilCarbonConfidence;
}> {
  return samples
    .map((s) => ({ sample: s, stock: resolveSampleStock(s) }))
    .filter((x): x is { sample: SoilCarbonSample; stock: number } => x.stock != null)
    .sort(
      (a, b) =>
        new Date(a.sample.sample_date).getTime() -
        new Date(b.sample.sample_date).getTime(),
    )
    .map((x) => ({
      date: x.sample.sample_date,
      stock_tc_ha: x.stock,
      depth_cm: x.sample.depth_cm,
      verified: x.sample.verification_status === 'verified',
      confidence: assessSampleConfidence(x.sample),
    }));
}
