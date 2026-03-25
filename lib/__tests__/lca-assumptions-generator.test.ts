/**
 * LCA Assumptions Generator Test Suite
 *
 * Tests generateAssumptions() for context-aware ISO 14044/14067
 * compliant assumption generation across different product configurations.
 */

import { vi, beforeEach } from 'vitest';
import { generateAssumptions, type AssumptionContext } from '@/lib/lca-assumptions-generator';

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// FACTORY
// ============================================================================

function makeContext(overrides: Partial<AssumptionContext> = {}): AssumptionContext {
  return {
    productType: 'Spirits',
    systemBoundary: 'cradle-to-gate',
    materialCount: 3,
    hasFacilities: false,
    facilityCount: 0,
    referenceYear: 2025,
    hasPackaging: true,
    hasIngredients: true,
    ...overrides,
  };
}

// ============================================================================
// BASIC STRUCTURE
// ============================================================================

describe('generateAssumptions', () => {
  describe('return structure', () => {
    it('returns an array of strings', () => {
      const result = generateAssumptions(makeContext());
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (const item of result) {
        expect(typeof item).toBe('string');
      }
    });

    it('every assumption is a non-empty string', () => {
      const result = generateAssumptions(makeContext());
      for (const item of result) {
        expect(item.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // CRADLE-TO-GATE
  // ============================================================================

  describe('cradle-to-gate context', () => {
    const ctx = makeContext({ systemBoundary: 'cradle-to-gate' });
    let assumptions: string[];

    beforeEach(() => {
      assumptions = generateAssumptions(ctx);
    });

    it('includes methodology assumptions', () => {
      const hasMethodology = assumptions.some((a) => a.includes('System boundary'));
      expect(hasMethodology).toBe(true);
    });

    it('includes Cradle-to-Gate in the boundary label', () => {
      const boundaryLine = assumptions.find((a) => a.includes('System boundary'));
      expect(boundaryLine).toContain('Cradle-to-Gate');
    });

    it('includes GWP methodology assumption', () => {
      const hasGwp = assumptions.some((a) => a.includes('GWP-100') || a.includes('Global warming potential'));
      expect(hasGwp).toBe(true);
    });

    it('includes functional unit assumption', () => {
      const hasFU = assumptions.some((a) => a.includes('Functional unit'));
      expect(hasFU).toBe(true);
    });

    it('excludes use-phase assumptions', () => {
      const hasUsePhase = assumptions.some(
        (a) => a.includes('refrigeration') && a.includes('days'),
      );
      expect(hasUsePhase).toBe(false);
    });

    it('excludes end-of-life assumptions', () => {
      const hasEol = assumptions.some((a) => a.includes('End-of-life modelled'));
      expect(hasEol).toBe(false);
    });

    it('includes limitation about excluded downstream stages', () => {
      const hasLimitation = assumptions.some(
        (a) => a.includes('excluded') && a.includes('cradle-to-gate'),
      );
      expect(hasLimitation).toBe(true);
    });
  });

  // ============================================================================
  // CRADLE-TO-GRAVE
  // ============================================================================

  describe('cradle-to-grave context', () => {
    const ctx = makeContext({
      systemBoundary: 'cradle-to-grave',
      usePhaseConfig: {
        needsRefrigeration: true,
        refrigerationDays: 7,
        retailRefrigerationSplit: 0.5,
        isCarbonated: false,
      },
      eolConfig: {
        region: 'uk',
        pathways: {},
      },
    });
    let assumptions: string[];

    beforeEach(() => {
      assumptions = generateAssumptions(ctx);
    });

    it('includes Cradle-to-Grave boundary label', () => {
      const boundaryLine = assumptions.find((a) => a.includes('System boundary'));
      expect(boundaryLine).toContain('Cradle-to-Grave');
    });

    it('includes use-phase refrigeration assumption', () => {
      const hasRefrig = assumptions.some((a) => a.includes('refrigeration') || a.includes('Refrigeration'));
      expect(hasRefrig).toBe(true);
    });

    it('includes end-of-life assumption', () => {
      const hasEol = assumptions.some((a) => a.includes('End-of-life modelled'));
      expect(hasEol).toBe(true);
    });

    it('includes distribution transport assumption', () => {
      const hasTransport = assumptions.some((a) => a.includes('Distribution transport'));
      expect(hasTransport).toBe(true);
    });

    it('does not include the cradle-to-gate exclusion limitation', () => {
      const hasGateLimitation = assumptions.some(
        (a) => a.includes('excluded') && a.includes('cradle-to-gate'),
      );
      expect(hasGateLimitation).toBe(false);
    });
  });

  // ============================================================================
  // FACILITY HANDLING
  // ============================================================================

  describe('facility assumptions', () => {
    it('includes facility allocation when hasFacilities=true', () => {
      const ctx = makeContext({ hasFacilities: true, facilityCount: 2 });
      const assumptions = generateAssumptions(ctx);
      const hasFacility = assumptions.some(
        (a) => a.includes('Facility overhead') || a.includes('facility'),
      );
      expect(hasFacility).toBe(true);
    });

    it('mentions correct facility count (singular)', () => {
      const ctx = makeContext({ hasFacilities: true, facilityCount: 1 });
      const assumptions = generateAssumptions(ctx);
      const facilityLine = assumptions.find((a) => a.includes('1 production facility'));
      expect(facilityLine).toBeTruthy();
    });

    it('mentions correct facility count (plural)', () => {
      const ctx = makeContext({ hasFacilities: true, facilityCount: 3 });
      const assumptions = generateAssumptions(ctx);
      const facilityLine = assumptions.find((a) => a.includes('3 production facilities'));
      expect(facilityLine).toBeTruthy();
    });

    it('includes grid emission factor assumption when facilities present', () => {
      const ctx = makeContext({ hasFacilities: true, facilityCount: 1 });
      const assumptions = generateAssumptions(ctx);
      const hasGrid = assumptions.some((a) => a.includes('grid emission factor'));
      expect(hasGrid).toBe(true);
    });

    it('notes exclusion of facility emissions when hasFacilities=false', () => {
      const ctx = makeContext({ hasFacilities: false, facilityCount: 0 });
      const assumptions = generateAssumptions(ctx);
      const hasExclusion = assumptions.some(
        (a) => a.includes('No production facilities') || a.includes('excluded'),
      );
      expect(hasExclusion).toBe(true);
    });
  });

  // ============================================================================
  // REFERENCE YEAR
  // ============================================================================

  describe('reference year in output', () => {
    it('does not crash with different reference years', () => {
      const ctx2024 = makeContext({ referenceYear: 2024 });
      const ctx2026 = makeContext({ referenceYear: 2026 });
      expect(() => generateAssumptions(ctx2024)).not.toThrow();
      expect(() => generateAssumptions(ctx2026)).not.toThrow();
    });
  });

  // ============================================================================
  // PRODUCT TYPE AFFECTS CONTENT
  // ============================================================================

  describe('product type variations', () => {
    it('spirits product type includes barrel maturation assumption', () => {
      const ctx = makeContext({ productType: 'Spirits' });
      const assumptions = generateAssumptions(ctx);
      const hasBarrel = assumptions.some((a) => a.includes('Barrel maturation'));
      expect(hasBarrel).toBe(true);
    });

    it('wine product type includes barrel maturation assumption', () => {
      const ctx = makeContext({ productType: 'Wine' });
      const assumptions = generateAssumptions(ctx);
      const hasBarrel = assumptions.some((a) => a.includes('Barrel maturation'));
      expect(hasBarrel).toBe(true);
    });

    it('beer product type does not include barrel maturation assumption', () => {
      const ctx = makeContext({ productType: 'Beer & Cider' });
      const assumptions = generateAssumptions(ctx);
      const hasBarrel = assumptions.some((a) => a.includes('Barrel maturation'));
      expect(hasBarrel).toBe(false);
    });

    it('non-alcoholic product type does not include barrel maturation', () => {
      const ctx = makeContext({ productType: 'Non-Alcoholic' });
      const assumptions = generateAssumptions(ctx);
      const hasBarrel = assumptions.some((a) => a.includes('Barrel maturation'));
      expect(hasBarrel).toBe(false);
    });

    it('undefined product type does not include barrel maturation', () => {
      const ctx = makeContext({ productType: undefined });
      const assumptions = generateAssumptions(ctx);
      const hasBarrel = assumptions.some((a) => a.includes('Barrel maturation'));
      expect(hasBarrel).toBe(false);
    });
  });

  // ============================================================================
  // USE PHASE VARIATIONS
  // ============================================================================

  describe('use phase configuration', () => {
    it('includes carbonation assumption when isCarbonated=true with type', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-consumer',
        usePhaseConfig: {
          needsRefrigeration: false,
          refrigerationDays: 0,
          retailRefrigerationSplit: 0,
          isCarbonated: true,
          carbonationType: 'beer',
        },
      });
      const assumptions = generateAssumptions(ctx);
      const hasCarbonation = assumptions.some((a) => a.includes('biogenic') || a.includes('CO₂'));
      expect(hasCarbonation).toBe(true);
    });

    it('includes ambient storage note when needsRefrigeration=false', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-consumer',
        usePhaseConfig: {
          needsRefrigeration: false,
          refrigerationDays: 0,
          retailRefrigerationSplit: 0,
          isCarbonated: false,
        },
      });
      const assumptions = generateAssumptions(ctx);
      const hasAmbient = assumptions.some((a) => a.includes('ambient temperature'));
      expect(hasAmbient).toBe(true);
    });

    it('includes consumer country code when provided', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-grave',
        usePhaseConfig: {
          needsRefrigeration: true,
          refrigerationDays: 14,
          retailRefrigerationSplit: 0.3,
          isCarbonated: false,
          consumerCountryCode: 'GB',
        },
        eolConfig: { region: 'uk', pathways: {} },
      });
      const assumptions = generateAssumptions(ctx);
      const hasCountry = assumptions.some((a) => a.includes('GB'));
      expect(hasCountry).toBe(true);
    });
  });

  // ============================================================================
  // END OF LIFE VARIATIONS
  // ============================================================================

  describe('end of life configuration', () => {
    it('includes packaging-specific EoL when hasPackaging=true', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-grave',
        hasPackaging: true,
        eolConfig: { region: 'uk', pathways: {} },
      });
      const assumptions = generateAssumptions(ctx);
      const hasPackagingEol = assumptions.some(
        (a) => a.includes('Packaging materials') && a.includes('recycling'),
      );
      expect(hasPackagingEol).toBe(true);
    });

    it('includes ingredient waste EoL when hasIngredients=true', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-grave',
        hasIngredients: true,
        eolConfig: { region: 'uk', pathways: {} },
      });
      const assumptions = generateAssumptions(ctx);
      const hasIngredientEol = assumptions.some(
        (a) => a.includes('Ingredient waste') || a.includes('organic waste'),
      );
      expect(hasIngredientEol).toBe(true);
    });

    it('does not include EoL detail without eolConfig even for grave boundary', () => {
      const ctx = makeContext({
        systemBoundary: 'cradle-to-grave',
        eolConfig: undefined,
      });
      const assumptions = generateAssumptions(ctx);
      const hasEolDetail = assumptions.some((a) => a.includes('End-of-life modelled'));
      expect(hasEolDetail).toBe(false);
    });
  });

  // ============================================================================
  // CRADLE-TO-SHELF
  // ============================================================================

  describe('cradle-to-shelf boundary', () => {
    it('includes limitation about excluded consumer and EoL stages', () => {
      const ctx = makeContext({ systemBoundary: 'cradle-to-shelf' });
      const assumptions = generateAssumptions(ctx);
      const hasShelfLimitation = assumptions.some(
        (a) => a.includes('excluded') && a.includes('cradle-to-shelf'),
      );
      expect(hasShelfLimitation).toBe(true);
    });

    it('includes distribution transport assumption', () => {
      const ctx = makeContext({ systemBoundary: 'cradle-to-shelf' });
      const assumptions = generateAssumptions(ctx);
      const hasTransport = assumptions.some((a) => a.includes('Distribution transport'));
      expect(hasTransport).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles zero materials, no facilities, all optional fields undefined', () => {
      const ctx: AssumptionContext = {
        productType: undefined,
        systemBoundary: 'cradle-to-gate',
        materialCount: 0,
        hasFacilities: false,
        facilityCount: 0,
        referenceYear: 2025,
        hasPackaging: false,
        hasIngredients: false,
        usePhaseConfig: undefined,
        eolConfig: undefined,
      };
      const assumptions = generateAssumptions(ctx);
      expect(Array.isArray(assumptions)).toBe(true);
      expect(assumptions.length).toBeGreaterThan(0);
      // Should still have methodology and limitation assumptions
      const hasMethodology = assumptions.some((a) => a.includes('System boundary'));
      expect(hasMethodology).toBe(true);
    });

    it('always includes capital goods exclusion limitation', () => {
      const gateResult = generateAssumptions(makeContext({ systemBoundary: 'cradle-to-gate' }));
      const graveResult = generateAssumptions(
        makeContext({
          systemBoundary: 'cradle-to-grave',
          eolConfig: { region: 'eu', pathways: {} },
        }),
      );
      expect(gateResult.some((a) => a.includes('Capital goods'))).toBe(true);
      expect(graveResult.some((a) => a.includes('Capital goods'))).toBe(true);
    });

    it('always includes data quality assumption', () => {
      const result = generateAssumptions(makeContext());
      const hasDataQuality = result.some((a) => a.includes('Data quality'));
      expect(hasDataQuality).toBe(true);
    });

    it('always includes emission factor sourcing assumption', () => {
      const result = generateAssumptions(makeContext());
      const hasEF = result.some((a) => a.includes('Emission factors sourced'));
      expect(hasEF).toBe(true);
    });

    it('always includes generic proxy limitation', () => {
      const result = generateAssumptions(makeContext());
      const hasProxy = result.some((a) => a.includes('generic emission factors'));
      expect(hasProxy).toBe(true);
    });
  });
});
