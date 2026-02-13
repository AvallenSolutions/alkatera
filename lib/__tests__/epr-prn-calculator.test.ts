import { describe, it, expect } from 'vitest';
import {
  calculateObligationTonnage,
  determinePRNStatus,
  remainingObligation,
  calculatePRNCost,
  totalPRNSpend,
  overallFulfilmentPct,
  buildPRNObligations,
} from '@/lib/epr/prn-calculator';
import type { EPRPRNObligation, EPRPRNTarget } from '@/lib/epr/types';

// =============================================================================
// Helpers — obligation fixture
// =============================================================================

function makeObligation(overrides: Partial<EPRPRNObligation> = {}): EPRPRNObligation {
  return {
    id: 'obl-1',
    organization_id: 'org-1',
    obligation_year: 2025,
    material_code: 'GL',
    material_name: 'Glass',
    total_tonnage_placed: 100,
    recycling_target_pct: 80,
    obligation_tonnage: 80,
    prns_purchased_tonnage: 0,
    prn_cost_per_tonne_gbp: 15,
    total_prn_cost_gbp: 0,
    status: 'not_started',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// =============================================================================
// calculateObligationTonnage
// =============================================================================

describe('calculateObligationTonnage', () => {
  it('calculates obligation as tonnage * target / 100', () => {
    // 100 tonnes * 80% = 80 tonnes
    expect(calculateObligationTonnage(100, 80)).toBe(80);
  });

  it('handles fractional results with 3 decimal places', () => {
    // 33 tonnes * 73% = 24.09
    expect(calculateObligationTonnage(33, 73)).toBe(24.09);
  });

  it('returns 0 for zero tonnage placed', () => {
    expect(calculateObligationTonnage(0, 80)).toBe(0);
  });

  it('returns 0 for zero target', () => {
    expect(calculateObligationTonnage(100, 0)).toBe(0);
  });

  it('handles 100% target', () => {
    expect(calculateObligationTonnage(50, 100)).toBe(50);
  });

  it('rounds to 3 decimal places', () => {
    // 7 * 33 / 100 = 2.31 (exactly)
    expect(calculateObligationTonnage(7, 33)).toBe(2.31);
  });

  it('handles very small tonnage', () => {
    // 0.001 * 50 / 100 = 0.0005 → rounds to 0.001
    expect(calculateObligationTonnage(0.001, 50)).toBe(0.001);
  });
});

// =============================================================================
// determinePRNStatus
// =============================================================================

describe('determinePRNStatus', () => {
  it('returns "not_started" when no PRNs purchased', () => {
    expect(determinePRNStatus(80, 0)).toBe('not_started');
  });

  it('returns "partial" when some but not enough PRNs purchased', () => {
    expect(determinePRNStatus(80, 40)).toBe('partial');
  });

  it('returns "fulfilled" when purchased equals obligation exactly', () => {
    expect(determinePRNStatus(80, 80)).toBe('fulfilled');
  });

  it('returns "fulfilled" within 0.1% tolerance (just under)', () => {
    // 80 * 0.999 = 79.92; 79.95 >= 79.92 → fulfilled
    expect(determinePRNStatus(80, 79.95)).toBe('fulfilled');
  });

  it('returns "exceeded" when purchased is significantly over obligation', () => {
    // 80 * 1.001 = 80.08; 85 >= 80.08 → exceeded
    expect(determinePRNStatus(80, 85)).toBe('exceeded');
  });

  it('returns "exceeded" when purchased is just over 0.1% tolerance', () => {
    // 80 * 1.001 = 80.08; 80.1 >= 80.08 → exceeded
    expect(determinePRNStatus(80, 80.1)).toBe('exceeded');
  });

  it('returns "fulfilled" when obligation is zero', () => {
    expect(determinePRNStatus(0, 0)).toBe('fulfilled');
  });

  it('returns "fulfilled" when obligation is negative', () => {
    expect(determinePRNStatus(-1, 0)).toBe('fulfilled');
  });

  it('returns "not_started" when purchased is negative', () => {
    expect(determinePRNStatus(80, -5)).toBe('not_started');
  });

  it('returns "partial" when purchased is just 1 unit', () => {
    expect(determinePRNStatus(80, 1)).toBe('partial');
  });
});

// =============================================================================
// remainingObligation
// =============================================================================

describe('remainingObligation', () => {
  it('returns remaining tonnage when partially fulfilled', () => {
    expect(remainingObligation(80, 30)).toBe(50);
  });

  it('returns full obligation when nothing purchased', () => {
    expect(remainingObligation(80, 0)).toBe(80);
  });

  it('returns 0 when fully fulfilled (never negative)', () => {
    expect(remainingObligation(80, 80)).toBe(0);
  });

  it('returns 0 when over-fulfilled (never negative)', () => {
    expect(remainingObligation(80, 100)).toBe(0);
  });

  it('rounds to 3 decimal places', () => {
    expect(remainingObligation(10.567, 3.123)).toBe(7.444);
  });
});

// =============================================================================
// calculatePRNCost
// =============================================================================

describe('calculatePRNCost', () => {
  it('calculates cost as tonnage * cost per tonne', () => {
    // 80 * 15 = 1200
    expect(calculatePRNCost(80, 15)).toBe(1200);
  });

  it('returns 0 for zero tonnage', () => {
    expect(calculatePRNCost(0, 15)).toBe(0);
  });

  it('returns 0 for zero cost per tonne', () => {
    expect(calculatePRNCost(80, 0)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    // 7.333 * 12.55 = 92.02915 → rounds to 92.03
    expect(calculatePRNCost(7.333, 12.55)).toBe(92.03);
  });

  it('handles large values', () => {
    expect(calculatePRNCost(1000, 100)).toBe(100000);
  });
});

// =============================================================================
// totalPRNSpend
// =============================================================================

describe('totalPRNSpend', () => {
  it('sums total_prn_cost_gbp across all obligations', () => {
    const obligations = [
      makeObligation({ total_prn_cost_gbp: 1200 }),
      makeObligation({ total_prn_cost_gbp: 800 }),
      makeObligation({ total_prn_cost_gbp: 500 }),
    ];
    expect(totalPRNSpend(obligations)).toBe(2500);
  });

  it('returns 0 for empty array', () => {
    expect(totalPRNSpend([])).toBe(0);
  });

  it('returns 0 when all costs are 0', () => {
    const obligations = [
      makeObligation({ total_prn_cost_gbp: 0 }),
      makeObligation({ total_prn_cost_gbp: 0 }),
    ];
    expect(totalPRNSpend(obligations)).toBe(0);
  });

  it('rounds total to 2 decimal places', () => {
    const obligations = [
      makeObligation({ total_prn_cost_gbp: 10.005 }),
      makeObligation({ total_prn_cost_gbp: 20.005 }),
    ];
    expect(totalPRNSpend(obligations)).toBe(30.01);
  });
});

// =============================================================================
// overallFulfilmentPct
// =============================================================================

describe('overallFulfilmentPct', () => {
  it('returns 100% when all obligations are fully purchased', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 80, prns_purchased_tonnage: 80 }),
      makeObligation({ obligation_tonnage: 50, prns_purchased_tonnage: 50 }),
    ];
    expect(overallFulfilmentPct(obligations)).toBe(100);
  });

  it('returns 0% when nothing is purchased', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 80, prns_purchased_tonnage: 0 }),
      makeObligation({ obligation_tonnage: 50, prns_purchased_tonnage: 0 }),
    ];
    expect(overallFulfilmentPct(obligations)).toBe(0);
  });

  it('returns correct partial percentage', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 100, prns_purchased_tonnage: 50 }),
    ];
    expect(overallFulfilmentPct(obligations)).toBe(50);
  });

  it('caps at 100% even if over-purchased', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 80, prns_purchased_tonnage: 200 }),
    ];
    expect(overallFulfilmentPct(obligations)).toBe(100);
  });

  it('returns 100% when total obligation is 0', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 0, prns_purchased_tonnage: 0 }),
    ];
    expect(overallFulfilmentPct(obligations)).toBe(100);
  });

  it('returns 100% for empty array', () => {
    expect(overallFulfilmentPct([])).toBe(100);
  });

  it('rounds to nearest integer', () => {
    const obligations = [
      makeObligation({ obligation_tonnage: 3, prns_purchased_tonnage: 1 }),
    ];
    // 1/3 = 33.33... → rounds to 33
    expect(overallFulfilmentPct(obligations)).toBe(33);
  });
});

// =============================================================================
// buildPRNObligations
// =============================================================================

describe('buildPRNObligations', () => {
  const targets: EPRPRNTarget[] = [
    { obligation_year: 2025, material_code: 'GL', material_name: 'Glass', recycling_target_pct: 80 },
    { obligation_year: 2025, material_code: 'AL', material_name: 'Aluminium', recycling_target_pct: 70 },
    { obligation_year: 2025, material_code: 'PL', material_name: 'Plastic', recycling_target_pct: 55 },
    { obligation_year: 2026, material_code: 'GL', material_name: 'Glass', recycling_target_pct: 82 },
  ];

  it('builds obligations for matching year only', () => {
    const tonnage = { GL: 100, AL: 50, PL: 30 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);
    expect(obligations).toHaveLength(3);
    expect(obligations.every(o => o.obligation_year === 2025)).toBe(true);
  });

  it('calculates correct obligation tonnage for each material', () => {
    const tonnage = { GL: 100, AL: 50, PL: 30 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);

    const glass = obligations.find(o => o.material_code === 'GL');
    expect(glass!.obligation_tonnage).toBe(80); // 100 * 80%

    const aluminium = obligations.find(o => o.material_code === 'AL');
    expect(aluminium!.obligation_tonnage).toBe(35); // 50 * 70%

    const plastic = obligations.find(o => o.material_code === 'PL');
    expect(plastic!.obligation_tonnage).toBe(16.5); // 30 * 55%
  });

  it('uses 0 tonnage when material is not in tonnageByMaterial', () => {
    const tonnage = { GL: 100 }; // No AL or PL
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);

    const aluminium = obligations.find(o => o.material_code === 'AL');
    expect(aluminium!.total_tonnage_placed).toBe(0);
    expect(aluminium!.obligation_tonnage).toBe(0);
  });

  it('sets status to "not_started" when tonnage > 0', () => {
    const tonnage = { GL: 100 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);
    const glass = obligations.find(o => o.material_code === 'GL');
    expect(glass!.status).toBe('not_started');
  });

  it('sets status to "fulfilled" when tonnage is 0', () => {
    const tonnage = { GL: 0 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);
    const glass = obligations.find(o => o.material_code === 'GL');
    expect(glass!.status).toBe('fulfilled');
  });

  it('initializes prns_purchased_tonnage to 0', () => {
    const tonnage = { GL: 100 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);
    obligations.forEach(o => {
      expect(o.prns_purchased_tonnage).toBe(0);
    });
  });

  it('initializes prn_cost_per_tonne_gbp and total_prn_cost_gbp to 0', () => {
    const tonnage = { GL: 100 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2025);
    obligations.forEach(o => {
      expect(o.prn_cost_per_tonne_gbp).toBe(0);
      expect(o.total_prn_cost_gbp).toBe(0);
    });
  });

  it('sets organization_id and obligation_year correctly', () => {
    const tonnage = { GL: 100 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-abc', 2025);
    obligations.forEach(o => {
      expect(o.organization_id).toBe('org-abc');
      expect(o.obligation_year).toBe(2025);
    });
  });

  it('returns empty array when no targets match the year', () => {
    const tonnage = { GL: 100 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2030);
    expect(obligations).toHaveLength(0);
  });

  it('builds obligations for a different year', () => {
    const tonnage = { GL: 200 };
    const obligations = buildPRNObligations(tonnage, targets, 'org-1', 2026);
    expect(obligations).toHaveLength(1);
    expect(obligations[0].material_code).toBe('GL');
    expect(obligations[0].recycling_target_pct).toBe(82);
    expect(obligations[0].obligation_tonnage).toBe(164); // 200 * 82%
  });
});
