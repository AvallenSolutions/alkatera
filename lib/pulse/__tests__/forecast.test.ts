/**
 * Tests for forecast helpers, with extra focus on the probability cone:
 * widening cone over horizon and probability of meeting target.
 */

import { describe, expect, it } from 'vitest';
import { forecastTrajectory, standardNormalCdf } from '../forecast';

describe('standardNormalCdf', () => {
  it('returns 0.5 at z=0', () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 3);
  });
  it('returns ~0.8413 at z=1', () => {
    expect(standardNormalCdf(1)).toBeCloseTo(0.8413, 3);
  });
  it('returns ~0.0228 at z=-2', () => {
    expect(standardNormalCdf(-2)).toBeCloseTo(0.0228, 3);
  });
  it('is symmetric around zero', () => {
    expect(standardNormalCdf(1.5) + standardNormalCdf(-1.5)).toBeCloseTo(1, 3);
  });
});

describe('forecastTrajectory probability cone', () => {
  // Build 12 monthly history points trending downwards, target = 0 by 2030-01-01.
  const history = Array.from({ length: 12 }, (_, i) => ({
    date: `2025-${String(i + 1).padStart(2, '0')}-01`,
    value: 100 - i * 2, // straight line down: 100, 98, 96, ...
  }));

  it('produces multi-band points on forecast horizon', () => {
    const r = forecastTrajectory({
      history,
      targetDate: '2030-01-01',
      targetValue: 50,
      higherIsBetter: false,
    });
    const fc = r.points.find(p => p.forecast);
    expect(fc).toBeDefined();
    expect(fc?.lower50).toBeDefined();
    expect(fc?.upper50).toBeDefined();
    expect(fc?.lower80).toBeDefined();
    expect(fc?.upper95).toBeDefined();
    // 50% band is narrower than 95% band.
    const w50 = fc!.upper50! - fc!.lower50!;
    const w95 = fc!.upper95! - fc!.lower95!;
    expect(w95).toBeGreaterThan(w50);
  });

  it('cone widens with horizon', () => {
    const r = forecastTrajectory({
      history,
      targetDate: '2030-01-01',
      targetValue: 50,
      higherIsBetter: false,
    });
    const forecasts = r.points.filter(p => p.forecast);
    const firstWidth = forecasts[0].upper95! - forecasts[0].lower95!;
    const lastWidth =
      forecasts[forecasts.length - 1].upper95! - forecasts[forecasts.length - 1].lower95!;
    expect(lastWidth).toBeGreaterThan(firstWidth);
  });

  it('returns a probability between 0 and 1', () => {
    const r = forecastTrajectory({
      history,
      targetDate: '2030-01-01',
      targetValue: 50,
      higherIsBetter: false,
    });
    expect(r.targetStatus.probability).not.toBeNull();
    expect(r.targetStatus.probability!).toBeGreaterThanOrEqual(0);
    expect(r.targetStatus.probability!).toBeLessThanOrEqual(1);
  });

  it('flips probability for higherIsBetter', () => {
    // Same trajectory: projected value sits well above the target if target=10 and lower-is-better.
    const lower = forecastTrajectory({
      history,
      targetDate: '2030-01-01',
      targetValue: 10,
      higherIsBetter: false,
    });
    const higher = forecastTrajectory({
      history,
      targetDate: '2030-01-01',
      targetValue: 10,
      higherIsBetter: true,
    });
    // The two probabilities should sum to ~1 (modulo rounding).
    expect(lower.targetStatus.probability! + higher.targetStatus.probability!).toBeCloseTo(1, 2);
  });

  it('returns unknown status with insufficient history', () => {
    const r = forecastTrajectory({
      history: [{ date: '2025-01-01', value: 10 }],
      targetDate: '2030-01-01',
      targetValue: 0,
      higherIsBetter: false,
    });
    expect(r.targetStatus.status).toBe('unknown');
    expect(r.targetStatus.probability).toBeNull();
  });
});
