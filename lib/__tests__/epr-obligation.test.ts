import { describe, it, expect } from 'vitest';
import { checkObligation } from '@/lib/epr/obligation-checker';

// =============================================================================
// checkObligation
// =============================================================================

describe('checkObligation', () => {
  describe('Large producer classification', () => {
    it('classifies as Large when turnover >= £2M AND tonnage >= 50t', () => {
      const result = checkObligation(3_000_000, 100);
      expect(result.size).toBe('large');
    });

    it('classifies as Large at exactly £2M and exactly 50t (boundary)', () => {
      const result = checkObligation(2_000_000, 50);
      expect(result.size).toBe('large');
    });

    it('sets reporting_frequency to "biannual" for Large', () => {
      const result = checkObligation(5_000_000, 200);
      expect(result.reporting_frequency).toBe('biannual');
    });

    it('sets pays_fees to true for Large', () => {
      const result = checkObligation(5_000_000, 200);
      expect(result.pays_fees).toBe(true);
    });

    it('sets pays_prns to true for Large', () => {
      const result = checkObligation(5_000_000, 200);
      expect(result.pays_prns).toBe(true);
    });

    it('includes explanation mentioning Large Producer', () => {
      const result = checkObligation(5_000_000, 200);
      expect(result.explanation).toContain('Large Producer');
    });

    it('stores turnover and tonnage in result', () => {
      const result = checkObligation(3_000_000, 75);
      expect(result.turnover_gbp).toBe(3_000_000);
      expect(result.total_packaging_tonnes).toBe(75);
    });
  });

  describe('Small producer classification', () => {
    it('classifies as Small when turnover >= £1M AND tonnage >= 25t but below Large', () => {
      const result = checkObligation(1_500_000, 30);
      expect(result.size).toBe('small');
    });

    it('classifies as Small at exactly £1M and exactly 25t (boundary)', () => {
      const result = checkObligation(1_000_000, 25);
      expect(result.size).toBe('small');
    });

    it('classifies as Small when turnover is £2M but tonnage is 49t (below Large tonnage threshold)', () => {
      const result = checkObligation(2_000_000, 49);
      expect(result.size).toBe('small');
    });

    it('classifies as Small when tonnage is 50t but turnover is £1.5M (below Large turnover threshold)', () => {
      const result = checkObligation(1_500_000, 50);
      expect(result.size).toBe('small');
    });

    it('sets reporting_frequency to "annual" for Small', () => {
      const result = checkObligation(1_500_000, 30);
      expect(result.reporting_frequency).toBe('annual');
    });

    it('sets pays_fees to false for Small', () => {
      const result = checkObligation(1_500_000, 30);
      expect(result.pays_fees).toBe(false);
    });

    it('sets pays_prns to false for Small', () => {
      const result = checkObligation(1_500_000, 30);
      expect(result.pays_prns).toBe(false);
    });

    it('includes explanation mentioning Small Producer', () => {
      const result = checkObligation(1_500_000, 30);
      expect(result.explanation).toContain('Small Producer');
    });
  });

  describe('Below threshold classification', () => {
    it('classifies as below_threshold when both turnover and tonnage are below Small thresholds', () => {
      const result = checkObligation(500_000, 10);
      expect(result.size).toBe('below_threshold');
    });

    it('classifies as below_threshold when turnover is £1M but tonnage is 24t (just under Small)', () => {
      const result = checkObligation(1_000_000, 24);
      expect(result.size).toBe('below_threshold');
    });

    it('classifies as below_threshold when tonnage is 25t but turnover is £999,999 (just under Small)', () => {
      const result = checkObligation(999_999, 25);
      expect(result.size).toBe('below_threshold');
    });

    it('classifies as below_threshold for zero turnover and tonnage', () => {
      const result = checkObligation(0, 0);
      expect(result.size).toBe('below_threshold');
    });

    it('sets reporting_frequency to "none" for Below Threshold', () => {
      const result = checkObligation(500_000, 10);
      expect(result.reporting_frequency).toBe('none');
    });

    it('sets pays_fees to false for Below Threshold', () => {
      const result = checkObligation(500_000, 10);
      expect(result.pays_fees).toBe(false);
    });

    it('sets pays_prns to false for Below Threshold', () => {
      const result = checkObligation(500_000, 10);
      expect(result.pays_prns).toBe(false);
    });

    it('includes explanation mentioning below threshold', () => {
      const result = checkObligation(500_000, 10);
      expect(result.explanation).toContain('below the EPR obligation thresholds');
    });
  });

  describe('null/undefined inputs', () => {
    it('treats null turnover as 0', () => {
      const result = checkObligation(null, 100);
      expect(result.size).toBe('below_threshold');
      expect(result.turnover_gbp).toBe(0);
    });

    it('treats undefined turnover as 0', () => {
      const result = checkObligation(undefined, 100);
      expect(result.size).toBe('below_threshold');
      expect(result.turnover_gbp).toBe(0);
    });

    it('treats null tonnage as 0', () => {
      const result = checkObligation(3_000_000, null);
      expect(result.size).toBe('below_threshold');
      expect(result.total_packaging_tonnes).toBe(0);
    });

    it('treats undefined tonnage as 0', () => {
      const result = checkObligation(3_000_000, undefined);
      expect(result.size).toBe('below_threshold');
      expect(result.total_packaging_tonnes).toBe(0);
    });

    it('treats both null as below_threshold', () => {
      const result = checkObligation(null, null);
      expect(result.size).toBe('below_threshold');
    });
  });

  describe('boundary edge cases', () => {
    it('Large threshold: turnover exactly £1,999,999 with 50t → Small (not Large)', () => {
      const result = checkObligation(1_999_999, 50);
      expect(result.size).toBe('small');
    });

    it('Large threshold: turnover £2M with 49.9t → Small (not Large)', () => {
      const result = checkObligation(2_000_000, 49.9);
      expect(result.size).toBe('small');
    });

    it('Small threshold: turnover exactly £999,999 with 25t → below_threshold', () => {
      const result = checkObligation(999_999, 25);
      expect(result.size).toBe('below_threshold');
    });

    it('Small threshold: turnover £1M with 24.9t → below_threshold', () => {
      const result = checkObligation(1_000_000, 24.9);
      expect(result.size).toBe('below_threshold');
    });

    it('very large values are classified as Large', () => {
      const result = checkObligation(100_000_000, 10_000);
      expect(result.size).toBe('large');
    });
  });
});
