import { describe, it, expect } from 'vitest';
import {
  socStockFromConcentration,
  resolveSampleStock,
  assessSampleConfidence,
  computeAnnualStockChange,
  buildSoilCarbonTrajectory,
  type SoilCarbonSample,
} from '../soil-carbon';
import { C_TO_CO2E } from '../ghg-constants';

// ============================================================================
// socStockFromConcentration
// ============================================================================

describe('socStockFromConcentration', () => {
  it('computes SOC stock as concentration × bulk density × depth', () => {
    // 2% OC, BD 1.3 g/cm³, 30 cm → 78 tC/ha
    expect(
      socStockFromConcentration({
        concentration_pct: 2,
        bulk_density_g_cm3: 1.3,
        depth_cm: 30,
      }),
    ).toBeCloseTo(78, 6);
  });
});

// ============================================================================
// resolveSampleStock
// ============================================================================

describe('resolveSampleStock', () => {
  it('returns the stock directly for the stock method', () => {
    const s: SoilCarbonSample = {
      sample_date: '2024-01-01',
      depth_cm: 30,
      soc_input_method: 'stock',
      soc_stock_tc_ha: 60,
    };
    expect(resolveSampleStock(s)).toBe(60);
  });

  it('derives the stock from raw lab values for the concentration method', () => {
    const s: SoilCarbonSample = {
      sample_date: '2024-01-01',
      depth_cm: 30,
      soc_input_method: 'concentration',
      soc_concentration_pct: 2,
      bulk_density_g_cm3: 1.3,
    };
    expect(resolveSampleStock(s)).toBeCloseTo(78, 6);
  });

  it('returns null when concentration inputs are incomplete', () => {
    const s: SoilCarbonSample = {
      sample_date: '2024-01-01',
      depth_cm: 30,
      soc_input_method: 'concentration',
      soc_concentration_pct: 2,
      bulk_density_g_cm3: null,
    };
    expect(resolveSampleStock(s)).toBeNull();
  });
});

// ============================================================================
// assessSampleConfidence
// ============================================================================

describe('assessSampleConfidence', () => {
  const base: SoilCarbonSample = {
    sample_date: '2024-01-01',
    depth_cm: 30,
    soc_input_method: 'stock',
    soc_stock_tc_ha: 60,
  };

  it('grades HIGH only when dense sampling, adequate depth AND verified', () => {
    expect(
      assessSampleConfidence({
        ...base,
        sampling_points: 12,
        verification_status: 'verified',
      }),
    ).toBe('HIGH');
  });

  it('caps unverified dense sampling at MEDIUM', () => {
    expect(
      assessSampleConfidence({ ...base, sampling_points: 20, verification_status: 'unverified' }),
    ).toBe('MEDIUM');
  });

  it('grades LOW for sparse sampling', () => {
    expect(assessSampleConfidence({ ...base, sampling_points: 2 })).toBe('LOW');
  });
});

// ============================================================================
// computeAnnualStockChange
// ============================================================================

describe('computeAnnualStockChange', () => {
  it('returns insufficient_data for no samples', () => {
    const r = computeAnnualStockChange([]);
    expect(r.methodology).toBe('insufficient_data');
    expect(r.annual_kg_co2e_per_ha).toBe(0);
  });

  it('returns baseline_only for a single sample', () => {
    const r = computeAnnualStockChange([
      { sample_date: '2024-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 60 },
    ]);
    expect(r.methodology).toBe('baseline_only');
    expect(r.annual_kg_co2e_per_ha).toBe(0);
    expect(r.warning).toMatch(/re-measure/i);
  });

  it('computes a measured annual removal from two verified samples', () => {
    // +3 tC/ha over 3 years = +1 tC/ha/yr → 1000 × 44/12 kg CO2e/ha/yr
    const samples: SoilCarbonSample[] = [
      {
        sample_date: '2021-01-01',
        depth_cm: 30,
        soc_input_method: 'stock',
        soc_stock_tc_ha: 60,
        sampling_points: 12,
        verification_status: 'verified',
      },
      {
        sample_date: '2024-01-01',
        depth_cm: 30,
        soc_input_method: 'stock',
        soc_stock_tc_ha: 63,
        sampling_points: 12,
        verification_status: 'verified',
      },
    ];
    const r = computeAnnualStockChange(samples);
    expect(r.methodology).toBe('measured_stock_change');
    expect(r.confidence).toBe('HIGH');
    expect(r.is_loss).toBe(false);
    expect(r.discount_applied).toBe(0);
    // ~1 tC/ha/yr; tiny variance from calendar-day counting across leap years.
    expect(r.gross_annual_kg_co2e_per_ha).toBeCloseTo(1000 * C_TO_CO2E, -1);
    expect(r.annual_kg_co2e_per_ha).toBeCloseTo(1000 * C_TO_CO2E, -1);
  });

  it('applies a conservative discount for low-confidence removals', () => {
    const samples: SoilCarbonSample[] = [
      { sample_date: '2021-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 60, sampling_points: 2 },
      { sample_date: '2024-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 63, sampling_points: 2 },
    ];
    const r = computeAnnualStockChange(samples);
    expect(r.confidence).toBe('LOW');
    expect(r.discount_applied).toBe(0.4);
    expect(r.annual_kg_co2e_per_ha).toBeCloseTo(r.gross_annual_kg_co2e_per_ha * 0.6, 6);
  });

  it('reports a measured decline as a removal of zero with a warning', () => {
    const samples: SoilCarbonSample[] = [
      { sample_date: '2021-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 63, sampling_points: 12, verification_status: 'verified' },
      { sample_date: '2024-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 60, sampling_points: 12, verification_status: 'verified' },
    ];
    const r = computeAnnualStockChange(samples);
    expect(r.is_loss).toBe(true);
    expect(r.annual_kg_co2e_per_ha).toBe(0);
    expect(r.gross_annual_kg_co2e_per_ha).toBeLessThan(0);
    expect(r.warning).toMatch(/declined/i);
  });

  it('refuses to compare samples taken to inconsistent depths', () => {
    const samples: SoilCarbonSample[] = [
      { sample_date: '2021-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 60 },
      { sample_date: '2024-01-01', depth_cm: 60, soc_input_method: 'stock', soc_stock_tc_ha: 90 },
    ];
    const r = computeAnnualStockChange(samples);
    expect(r.methodology).toBe('baseline_only');
    expect(r.depth_consistent).toBe(false);
    expect(r.warning).toMatch(/depth/i);
  });
});

// ============================================================================
// buildSoilCarbonTrajectory
// ============================================================================

describe('buildSoilCarbonTrajectory', () => {
  it('returns resolved stocks oldest → newest', () => {
    const samples: SoilCarbonSample[] = [
      { sample_date: '2024-01-01', depth_cm: 30, soc_input_method: 'stock', soc_stock_tc_ha: 63 },
      { sample_date: '2021-01-01', depth_cm: 30, soc_input_method: 'concentration', soc_concentration_pct: 2, bulk_density_g_cm3: 1.0 },
    ];
    const series = buildSoilCarbonTrajectory(samples);
    expect(series.map((p) => p.date)).toEqual(['2021-01-01', '2024-01-01']);
    expect(series[0].stock_tc_ha).toBeCloseTo(60, 6); // 2 × 1.0 × 30
    expect(series[1].stock_tc_ha).toBe(63);
  });
});
