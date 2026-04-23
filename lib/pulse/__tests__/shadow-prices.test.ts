import { describe, expect, it } from 'vitest';
import { monetise, type ShadowPrice } from '../shadow-prices';

const ukEts: ShadowPrice = {
  metric_key: 'total_co2e',
  currency: 'GBP',
  price_per_unit: 85,
  unit: 'tCO2e',
  native_unit_multiplier: 0.001,
  source: 'UK ETS April 2026',
  effective_from: '2026-01-01',
  is_org_override: false,
};

const ofwat: ShadowPrice = {
  metric_key: 'water_consumption',
  currency: 'GBP',
  price_per_unit: 2.5,
  unit: 'm3',
  native_unit_multiplier: 1,
  source: 'Ofwat 2024',
  effective_from: '2026-01-01',
  is_org_override: false,
};

describe('monetise', () => {
  it('converts kg CO2e to £ via tCO2e display unit', () => {
    // 1,200,000 kg CO2e × 0.001 × £85/tCO2e = £102,000
    const r = monetise(1_200_000, ukEts);
    expect(r?.amount).toBeCloseTo(102_000, 0);
    expect(r?.currency).toBe('GBP');
    expect(r?.rate_label).toContain('UK ETS April 2026');
  });

  it('prices water at the native m3 unit unchanged', () => {
    // 8,000 m³ × 1 × £2.50/m³ = £20,000
    const r = monetise(8_000, ofwat);
    expect(r?.amount).toBeCloseTo(20_000, 0);
  });

  it('returns null when no price is provided', () => {
    expect(monetise(100, undefined)).toBeNull();
  });

  it('returns null for non-finite values', () => {
    expect(monetise(Number.NaN, ukEts)).toBeNull();
  });
});
