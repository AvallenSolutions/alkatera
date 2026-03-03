import { describe, it, expect } from 'vitest';
import {
  getLivingWageRate,
  annualToHourlyRate,
  analyzeLivingWageCompliance,
  CompensationRecord,
} from '../people-culture-score';

/**
 * Helper factory — builds a CompensationRecord with sensible defaults.
 * Override any field via the partial parameter.
 */
function makeRecord(overrides: Partial<CompensationRecord> = {}): CompensationRecord {
  return {
    hourly_rate: 15.00,
    annual_salary: null,
    work_country: 'United Kingdom',
    work_region: null,
    gender: null,
    employment_type: 'full_time',
    role_level: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getLivingWageRate
// ---------------------------------------------------------------------------
describe('getLivingWageRate', () => {
  it('returns London rate (13.15) for UK/London', () => {
    expect(getLivingWageRate('United Kingdom', 'London')).toBe(13.15);
  });

  it('returns default UK rate (12.00) for UK with no region', () => {
    expect(getLivingWageRate('United Kingdom', null)).toBe(12.00);
  });

  it('returns default UK rate for UK with non-London region', () => {
    expect(getLivingWageRate('United Kingdom', 'Manchester')).toBe(12.00);
  });

  it('returns Ireland rate (13.85)', () => {
    expect(getLivingWageRate('Ireland', null)).toBe(13.85);
  });

  it('returns US rate (15.00)', () => {
    expect(getLivingWageRate('United States', null)).toBe(15.00);
  });

  it('returns fallback 12.00 for unknown country', () => {
    expect(getLivingWageRate('Japan', null)).toBe(12.00);
  });
});

// ---------------------------------------------------------------------------
// annualToHourlyRate
// ---------------------------------------------------------------------------
describe('annualToHourlyRate', () => {
  it('converts full-time annual salary (÷1950)', () => {
    // 39000 / (52 * 37.5) = 39000 / 1950 = 20.0
    expect(annualToHourlyRate(39000, 'full_time')).toBe(20.0);
  });

  it('converts part-time annual salary (÷1040)', () => {
    // 20800 / (52 * 20) = 20800 / 1040 = 20.0
    expect(annualToHourlyRate(20800, 'part_time')).toBe(20.0);
  });

  it('defaults to full-time when employment_type is unknown', () => {
    // Unknown type falls through to the else branch → 37.5 weekly hours
    // 39000 / (52 * 37.5) = 20.0
    expect(annualToHourlyRate(39000, 'contractor')).toBe(20.0);
  });
});

// ---------------------------------------------------------------------------
// analyzeLivingWageCompliance
// ---------------------------------------------------------------------------
describe('analyzeLivingWageCompliance', () => {
  it('returns zero totals for empty records array', () => {
    const result = analyzeLivingWageCompliance([]);
    expect(result).toEqual({
      total_employees: 0,
      employees_above_living_wage: 0,
      employees_below_living_wage: 0,
      compliance_rate: 0,
      average_hourly_rate: 0,
      living_wage_gap: 0,
    });
  });

  it('marks all employees above when hourly_rate exceeds living wage', () => {
    // UK default living wage = 12.00; both employees earn above that
    const records = [
      makeRecord({ hourly_rate: 14.00 }),
      makeRecord({ hourly_rate: 16.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.employees_above_living_wage).toBe(2);
    expect(result.employees_below_living_wage).toBe(0);
  });

  it('marks employee below when hourly_rate is under living wage', () => {
    // UK default living wage = 12.00; employee earns 10.00
    const records = [makeRecord({ hourly_rate: 10.00 })];
    const result = analyzeLivingWageCompliance(records);
    expect(result.employees_above_living_wage).toBe(0);
    expect(result.employees_below_living_wage).toBe(1);
  });

  it('converts annual_salary to hourly when hourly_rate is null', () => {
    // 39000 / 1950 = 20.00 hourly → above UK default 12.00
    const records = [
      makeRecord({ hourly_rate: null, annual_salary: 39000, employment_type: 'full_time' }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.employees_above_living_wage).toBe(1);
    expect(result.average_hourly_rate).toBe(20.0);
  });

  it('skips records with both null hourly_rate and null annual_salary', () => {
    const records = [
      makeRecord({ hourly_rate: null, annual_salary: null }),
      makeRecord({ hourly_rate: 15.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    // total_employees counts all records including skipped ones
    expect(result.total_employees).toBe(2);
    // but only 1 employee has a rate and contributes to above/below counts
    expect(result.employees_above_living_wage).toBe(1);
    expect(result.employees_below_living_wage).toBe(0);
  });

  it('computes living_wage_gap as sum of hourly shortfalls', () => {
    // UK default living wage = 12.00
    // Employee 1: 10.00 → gap 2.00
    // Employee 2:  9.00 → gap 3.00
    // Total gap = 5.00
    const records = [
      makeRecord({ hourly_rate: 10.00 }),
      makeRecord({ hourly_rate: 9.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.living_wage_gap).toBe(5.00);
  });

  it('uses work_country and work_region for correct living wage lookup', () => {
    // London living wage = 13.15; employee earns 13.00 → below
    const records = [
      makeRecord({ hourly_rate: 13.00, work_country: 'United Kingdom', work_region: 'London' }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.employees_below_living_wage).toBe(1);
    expect(result.living_wage_gap).toBeCloseTo(0.15, 10);
  });

  it('handles mixed above/below workforce correctly', () => {
    // UK default living wage = 12.00
    // Employee 1: 14.00 → above
    // Employee 2: 10.00 → below (gap 2.00)
    // Employee 3: 12.00 → above (equal counts as above via >=)
    const records = [
      makeRecord({ hourly_rate: 14.00 }),
      makeRecord({ hourly_rate: 10.00 }),
      makeRecord({ hourly_rate: 12.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.employees_above_living_wage).toBe(2);
    expect(result.employees_below_living_wage).toBe(1);
    expect(result.living_wage_gap).toBe(2.00);
  });

  it('computes compliance_rate as percentage', () => {
    // 2 above, 1 below → compliance = (2/3) * 100 ≈ 66.6667%
    const records = [
      makeRecord({ hourly_rate: 14.00 }),
      makeRecord({ hourly_rate: 14.00 }),
      makeRecord({ hourly_rate: 10.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.compliance_rate).toBeCloseTo((2 / 3) * 100, 10);
  });

  it('computes average_hourly_rate across employees with rates', () => {
    // Employee 1: 14.00, Employee 2: 10.00 → average = 12.00
    const records = [
      makeRecord({ hourly_rate: 14.00 }),
      makeRecord({ hourly_rate: 10.00 }),
    ];
    const result = analyzeLivingWageCompliance(records);
    expect(result.average_hourly_rate).toBe(12.00);
  });
});
