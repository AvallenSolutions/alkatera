import { describe, it, expect, vi } from 'vitest';
import {
  calculateRiskLevel,
  calculateScarcityWeighted,
  calculateOverallRiskLevel,
  getAwareFactors,
  WATER_RISK_THRESHOLDS,
  DEFAULT_AWARE_FACTOR,
} from '../water-risk';

// ============================================================================
// RISK LEVEL CALCULATION TESTS
// ============================================================================

describe('calculateRiskLevel', () => {
  it('should return "high" for AWARE factor >= 10', () => {
    expect(calculateRiskLevel(10)).toBe('high');
    expect(calculateRiskLevel(15)).toBe('high');
    expect(calculateRiskLevel(52.3)).toBe('high'); // Saudi Arabia
    expect(calculateRiskLevel(100)).toBe('high');
  });

  it('should return "medium" for AWARE factor >= 1 and < 10', () => {
    expect(calculateRiskLevel(1)).toBe('medium');
    expect(calculateRiskLevel(5)).toBe('medium');
    expect(calculateRiskLevel(9.99)).toBe('medium');
    expect(calculateRiskLevel(1.24)).toBe('medium'); // France
    expect(calculateRiskLevel(8.34)).toBe('medium'); // Portugal
  });

  it('should return "low" for AWARE factor < 1', () => {
    expect(calculateRiskLevel(0.99)).toBe('low');
    expect(calculateRiskLevel(0.5)).toBe('low');
    expect(calculateRiskLevel(0.42)).toBe('low'); // UK
    expect(calculateRiskLevel(0.18)).toBe('low'); // Ireland
    expect(calculateRiskLevel(0.08)).toBe('low'); // Norway
  });

  it('should use correct thresholds matching database', () => {
    // These thresholds MUST match the SQL definitions:
    // CASE WHEN aware_factor >= 10 THEN 'high'
    //      WHEN aware_factor >= 1 THEN 'medium'
    //      ELSE 'low' END
    expect(WATER_RISK_THRESHOLDS.HIGH).toBe(10);
    expect(WATER_RISK_THRESHOLDS.MEDIUM).toBe(1);
  });
});

// ============================================================================
// SCARCITY WEIGHTED CALCULATION TESTS
// ============================================================================

describe('calculateScarcityWeighted', () => {
  it('should multiply water consumption by AWARE factor', () => {
    // 1000 m³ × AWARE 1.0 = 1000 m³ world-equivalent
    expect(calculateScarcityWeighted(1000, 1.0)).toBe(1000);

    // 1000 m³ × AWARE 10 = 10000 m³ world-equivalent
    expect(calculateScarcityWeighted(1000, 10)).toBe(10000);

    // 500 m³ × AWARE 0.5 = 250 m³ world-equivalent
    expect(calculateScarcityWeighted(500, 0.5)).toBe(250);
  });

  it('should handle zero water consumption', () => {
    expect(calculateScarcityWeighted(0, 10)).toBe(0);
    expect(calculateScarcityWeighted(0, 0.5)).toBe(0);
  });

  it('should correctly weight water in high-stress regions', () => {
    // Saudi Arabia example: AWARE factor 52.3
    // 100 m³ × 52.3 = 5230 m³ world-equivalent
    expect(calculateScarcityWeighted(100, 52.3)).toBe(5230);
  });

  it('should correctly weight water in low-stress regions', () => {
    // Norway example: AWARE factor 0.08
    // 1000 m³ × 0.08 = 80 m³ world-equivalent
    expect(calculateScarcityWeighted(1000, 0.08)).toBe(80);
  });
});

// ============================================================================
// OVERALL RISK LEVEL TESTS
// ============================================================================

describe('calculateOverallRiskLevel', () => {
  it('should return "high" if any facilities are high risk', () => {
    expect(calculateOverallRiskLevel(1, 0, 0)).toBe('high');
    expect(calculateOverallRiskLevel(1, 5, 10)).toBe('high');
    expect(calculateOverallRiskLevel(3, 0, 0)).toBe('high');
  });

  it('should return "medium" if no high risk but some medium risk', () => {
    expect(calculateOverallRiskLevel(0, 1, 0)).toBe('medium');
    expect(calculateOverallRiskLevel(0, 5, 10)).toBe('medium');
    expect(calculateOverallRiskLevel(0, 3, 0)).toBe('medium');
  });

  it('should return "low" only if all facilities are low risk', () => {
    expect(calculateOverallRiskLevel(0, 0, 1)).toBe('low');
    expect(calculateOverallRiskLevel(0, 0, 10)).toBe('low');
    expect(calculateOverallRiskLevel(0, 0, 0)).toBe('low'); // No facilities
  });
});

// ============================================================================
// AWARE FACTOR LOOKUP TESTS
// ============================================================================

describe('getAwareFactors', () => {
  it('should return empty map for empty country codes', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    };

    const result = await getAwareFactors(mockSupabase as any, []);
    expect(result.size).toBe(0);
    // Should not even query the database
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should fetch AWARE factors for given countries', async () => {
    const mockData = [
      { country_code: 'GB', country_name: 'United Kingdom', aware_factor: 0.42 },
      { country_code: 'FR', country_name: 'France', aware_factor: 1.24 },
    ];

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: mockData, error: null })),
        })),
      })),
    };

    const result = await getAwareFactors(mockSupabase as any, ['gb', 'fr']);

    expect(result.size).toBe(2);
    expect(result.get('GB')?.aware_factor).toBe(0.42);
    expect(result.get('FR')?.aware_factor).toBe(1.24);
  });

  it('should deduplicate country codes and convert to uppercase', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn((field: string, codes: string[]) => {
            // Verify codes are deduplicated and uppercase
            expect(codes).toEqual(['GB', 'FR']);
            return Promise.resolve({ data: [], error: null });
          }),
        })),
      })),
    };

    await getAwareFactors(mockSupabase as any, ['gb', 'GB', 'fr', 'FR', 'gb']);
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB error') })),
        })),
      })),
    };

    const result = await getAwareFactors(mockSupabase as any, ['GB']);
    expect(result.size).toBe(0);
  });
});

// ============================================================================
// DEFAULT VALUES TESTS
// ============================================================================

describe('Default Values', () => {
  it('should use correct default AWARE factor', () => {
    // Default should be 1.0 (world average baseline)
    expect(DEFAULT_AWARE_FACTOR).toBe(1.0);
  });
});

// ============================================================================
// REGRESSION TESTS - Hardcoded Values Bug
// ============================================================================

describe('Regression: Hardcoded AWARE Values Bug', () => {
  // This test documents the bug that was fixed
  // The old code used hardcoded values that were drastically wrong:
  // GB: 8.2 (should be 0.42) - 20x higher!
  // IE: 5.3 (should be 0.18) - 30x higher!
  // NO: 3.1 (should be 0.08) - 40x higher!
  // FR: 20.5 (should be 1.24) - 16x higher!

  it('should classify UK facilities as LOW risk (not medium)', () => {
    // UK AWARE factor is 0.42 (below world average)
    const riskLevel = calculateRiskLevel(0.42);
    expect(riskLevel).toBe('low');
    // OLD BUG: Would return 'medium' because 8.2 > 1
  });

  it('should classify France facilities as MEDIUM risk (not high)', () => {
    // France AWARE factor is 1.24 (slightly above world average)
    const riskLevel = calculateRiskLevel(1.24);
    expect(riskLevel).toBe('medium');
    // OLD BUG: Would return 'high' because 20.5 > 10 (with wrong thresholds)
    // OR 'medium' because 20.5 > 20 (with old thresholds)
  });

  it('should classify Spain facilities as HIGH risk', () => {
    // Spain AWARE factor is 12.5 (water stressed)
    const riskLevel = calculateRiskLevel(12.5);
    expect(riskLevel).toBe('high');
    // This one was actually correct, but for wrong reasons
    // OLD: 54.8 > 40 (wrong value, wrong threshold)
    // NEW: 12.5 >= 10 (correct value, correct threshold)
  });

  it('should classify Norway facilities as LOW risk', () => {
    // Norway AWARE factor is 0.08 (very water abundant)
    const riskLevel = calculateRiskLevel(0.08);
    expect(riskLevel).toBe('low');
    // OLD BUG: Would return 'medium' because 3.1 > 1
  });
});

// ============================================================================
// REGRESSION TESTS - Risk Threshold Bug
// ============================================================================

describe('Regression: Risk Threshold Bug', () => {
  // The old code used thresholds of 40/20 instead of 10/1
  // This test ensures we use the correct AWARE methodology thresholds

  it('should use threshold of 10 for high risk (not 40)', () => {
    // AWARE factor of 15 should be high risk
    expect(calculateRiskLevel(15)).toBe('high');
    // OLD BUG: Would return 'medium' because 15 < 40
  });

  it('should use threshold of 1 for medium risk (not 20)', () => {
    // AWARE factor of 5 should be medium risk
    expect(calculateRiskLevel(5)).toBe('medium');
    // OLD BUG: Would return 'low' because 5 < 20
  });

  it('should match database threshold logic exactly', () => {
    // Database uses: CASE WHEN aware_factor >= 10 THEN 'high'
    //                     WHEN aware_factor >= 1 THEN 'medium'
    //                     ELSE 'low' END

    // Boundary tests
    expect(calculateRiskLevel(10)).toBe('high');   // >= 10 is high
    expect(calculateRiskLevel(9.999)).toBe('medium'); // < 10 is medium (if >= 1)
    expect(calculateRiskLevel(1)).toBe('medium');  // >= 1 is medium
    expect(calculateRiskLevel(0.999)).toBe('low'); // < 1 is low
  });
});

// ============================================================================
// REALISTIC SCENARIO TESTS
// ============================================================================

describe('Realistic Scenarios', () => {
  it('should correctly assess a beverage company with global facilities', () => {
    // Example: Distillery company with facilities in UK, France, Spain

    const ukRisk = calculateRiskLevel(0.42); // UK
    const frRisk = calculateRiskLevel(1.24); // France
    const esRisk = calculateRiskLevel(12.5); // Spain

    expect(ukRisk).toBe('low');
    expect(frRisk).toBe('medium');
    expect(esRisk).toBe('high');

    // Overall company risk
    const overall = calculateOverallRiskLevel(
      esRisk === 'high' ? 1 : 0,
      frRisk === 'medium' ? 1 : 0,
      ukRisk === 'low' ? 1 : 0
    );
    expect(overall).toBe('high'); // One high-risk facility means high overall
  });

  it('should calculate correct scarcity-weighted impact', () => {
    // Scenario: 1000 m³ water use at each facility
    const waterUse = 1000;

    const ukWeighted = calculateScarcityWeighted(waterUse, 0.42);
    const frWeighted = calculateScarcityWeighted(waterUse, 1.24);
    const esWeighted = calculateScarcityWeighted(waterUse, 12.5);

    // UK has low stress, so weighted impact is less than actual
    expect(ukWeighted).toBe(420);
    // France is slightly above average
    expect(frWeighted).toBe(1240);
    // Spain has high stress, so weighted impact is much more
    expect(esWeighted).toBe(12500);

    // Total weighted impact
    const totalWeighted = ukWeighted + frWeighted + esWeighted;
    expect(totalWeighted).toBe(14160);
  });
});
