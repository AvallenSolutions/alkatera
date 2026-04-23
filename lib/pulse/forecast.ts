/**
 * Pulse — simple forecasting utilities.
 *
 * Two estimators, intentionally lightweight (no ML deps, runs in browser):
 *   - linearRegression: ordinary least squares over (timestamp, value) points
 *   - forecastTrajectory: extrapolates to a target date with a simple
 *     residual-variance confidence band
 *
 * Good enough for "are we trending towards the target" status pills. Not a
 * replacement for proper time-series forecasting (Prophet, ARIMA) — those
 * come later when we have richer data per metric.
 */

export interface RegressionResult {
  /** y = slope * x + intercept (where x is days since first point). */
  slope: number;
  intercept: number;
  /** Standard deviation of residuals (used for confidence bands). */
  residualStdDev: number;
  rSquared: number;
}

export interface TrajectoryPoint {
  date: string;     // YYYY-MM-DD
  value: number;
  /** Lower bound of 1-σ confidence band. Only present for forecast points. */
  lower?: number;
  /** Upper bound of 1-σ confidence band. */
  upper?: number;
  /** Lower bound of 50% probability band. */
  lower50?: number;
  /** Upper bound of 50% probability band. */
  upper50?: number;
  /** Lower bound of 80% probability band. */
  lower80?: number;
  /** Upper bound of 80% probability band. */
  upper80?: number;
  /** Lower bound of 95% probability band. */
  lower95?: number;
  /** Upper bound of 95% probability band. */
  upper95?: number;
  /** True for points that are extrapolations (vs historical). */
  forecast: boolean;
}

export interface TargetStatus {
  status: 'on_track' | 'at_risk' | 'off_track' | 'unknown';
  /** Projected value at the target date. */
  projected: number | null;
  /** target_value − projected (in metric's natural unit). Negative = beating target. */
  gap: number | null;
  /** Modelled probability of meeting or beating the target. 0..1, null if unknown. */
  probability: number | null;
}

export interface ForecastInput {
  history: { date: string; value: number }[];
  targetDate: string;
  targetValue: number;
  /** True if a higher value is good (e.g. coverage %). False for emissions. */
  higherIsBetter: boolean;
}

export interface ForecastResult {
  points: TrajectoryPoint[];
  targetStatus: TargetStatus;
  regression: RegressionResult | null;
}

export function linearRegression(
  points: { x: number; y: number }[],
): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Residuals + r²
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const residualStdDev = Math.sqrt(ssRes / Math.max(1, n - 2));
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, residualStdDev, rSquared };
}

export function forecastTrajectory(input: ForecastInput): ForecastResult {
  const { history, targetDate, targetValue, higherIsBetter } = input;
  if (history.length < 2) {
    return {
      points: history.map(h => ({ date: h.date, value: h.value, forecast: false })),
      targetStatus: { status: 'unknown', projected: null, gap: null, probability: null },
      regression: null,
    };
  }

  const startMs = new Date(history[0].date).getTime();
  const points = history.map(h => ({
    x: (new Date(h.date).getTime() - startMs) / 86400_000,
    y: h.value,
  }));
  const reg = linearRegression(points);
  if (!reg) {
    return {
      points: history.map(h => ({ date: h.date, value: h.value, forecast: false })),
      targetStatus: { status: 'unknown', projected: null, gap: null, probability: null },
      regression: null,
    };
  }

  const targetMs = new Date(targetDate).getTime();
  const lastMs = new Date(history[history.length - 1].date).getTime();
  const totalDays = Math.ceil((targetMs - startMs) / 86400_000);
  const lastHistDays = (lastMs - startMs) / 86400_000;
  const horizonAtTargetDays = Math.max(1, totalDays - lastHistDays);

  // Build the full series: historical + monthly forecast points to the target date.
  const allPoints: TrajectoryPoint[] = history.map(h => ({
    date: h.date,
    value: h.value,
    forecast: false,
  }));

  // Variance of a forecast grows with the horizon. We model standard error as
  //   se(h) = residualStdDev * sqrt(1 + h / lastHistDays)
  // -- a pragmatic approximation that widens the cone proportionally to how
  // far we extrapolate beyond the training data. Avoids needing the full
  // covariance matrix while still giving a visually honest fan.
  const sigmaAt = (xDays: number) => {
    const horizon = Math.max(0, xDays - lastHistDays);
    const scale = Math.sqrt(1 + horizon / Math.max(1, lastHistDays));
    return reg.residualStdDev * scale;
  };

  const Z50 = 0.6745;
  const Z80 = 1.2816;
  const Z95 = 1.96;

  // Append a forecast point every ~30 days from the last historical date to the target.
  const stepDays = 30;
  let cursor = lastMs + stepDays * 86400_000;
  const pushForecast = (cursorMs: number, dateOverride?: string) => {
    const xDays = (cursorMs - startMs) / 86400_000;
    const predicted = reg.slope * xDays + reg.intercept;
    const sigma = sigmaAt(xDays);
    allPoints.push({
      date: dateOverride ?? new Date(cursorMs).toISOString().slice(0, 10),
      value: predicted,
      lower: predicted - sigma,
      upper: predicted + sigma,
      lower50: predicted - Z50 * sigma,
      upper50: predicted + Z50 * sigma,
      lower80: predicted - Z80 * sigma,
      upper80: predicted + Z80 * sigma,
      lower95: predicted - Z95 * sigma,
      upper95: predicted + Z95 * sigma,
      forecast: true,
    });
  };
  while (cursor <= targetMs) {
    pushForecast(cursor);
    cursor += stepDays * 86400_000;
  }

  // Always anchor the final point at the target date.
  const lastForecast = allPoints[allPoints.length - 1];
  if (!lastForecast || lastForecast.date !== targetDate) {
    pushForecast(targetMs, targetDate);
  }

  const projected = reg.slope * totalDays + reg.intercept;
  const sigmaAtTarget = sigmaAt(totalDays);
  const gap = targetValue - projected;
  const status = classifyStatus({
    projected,
    target: targetValue,
    sigma: sigmaAtTarget,
    higherIsBetter,
  });

  // Probability of meeting target = P(value <= target) for "lower is better"
  //                             or = P(value >= target) for "higher is better"
  // Both reduce to a normal-CDF lookup.
  const z = (targetValue - projected) / Math.max(sigmaAtTarget, 1e-9);
  const probLowerOrEqual = standardNormalCdf(z);
  const probability = higherIsBetter ? 1 - probLowerOrEqual : probLowerOrEqual;

  return {
    points: allPoints,
    targetStatus: { status, projected, gap, probability },
    regression: reg,
  };
}

/**
 * Standard normal CDF using the Abramowitz & Stegun 7.1.26 approximation.
 * Accurate to ~1.5e-7 across the real line. No external dep, no Math.erf
 * (which isn't standard in older Node targets).
 */
export function standardNormalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  // erf approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  const erf = sign * y;
  return 0.5 * (1 + erf);
}

function classifyStatus({
  projected,
  target,
  sigma,
  higherIsBetter,
}: {
  projected: number;
  target: number;
  sigma: number;
  higherIsBetter: boolean;
}): TargetStatus['status'] {
  // Treat "meeting target" generously by 0.5σ on either side.
  const tolerance = sigma * 0.5;
  if (higherIsBetter) {
    if (projected >= target - tolerance) return 'on_track';
    if (projected >= target * 0.85) return 'at_risk';
    return 'off_track';
  }
  if (projected <= target + tolerance) return 'on_track';
  if (projected <= target * 1.15) return 'at_risk';
  return 'off_track';
}
