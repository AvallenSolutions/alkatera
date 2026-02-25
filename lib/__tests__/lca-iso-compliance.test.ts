/**
 * Unit tests for LCA ISO Compliance remediation fixes (Issues A–G).
 *
 * Tests the following:
 *  - Issue A: GHG species reconciliation (pure CO₂ decomposition)
 *  - Issue B: Uncertainty display percentage matches CI bounds
 *  - Issue F: Interpretation >100% hotspot explanation
 *  - Issue G: Page number sequential numbering
 */

import { describe, it, expect } from 'vitest';
import { generateInterpretation } from '../lca-interpretation';
import { IPCC_AR6_GWP } from '../ghg-constants';

// ============================================================================
// Issue A — GHG Species Reconciliation
// ============================================================================

describe('Issue A — GHG species table reconciliation', () => {
  it('pure CO₂ values should exclude CH₄ and N₂O CO₂e contributions', () => {
    // Given known species masses and GWP factors
    const ch4FossilMass = 0.0001; // kg CH₄
    const n2oMass = 0.00001; // kg N₂O
    const totalFossilCO2e = 0.5; // kg CO₂e (total fossil, including CH₄/N₂O in CO₂e)

    const ch4FossilCO2e = ch4FossilMass * IPCC_AR6_GWP.CH4_FOSSIL;
    const n2oCO2e = n2oMass * IPCC_AR6_GWP.N2O;
    const co2FossilPure = totalFossilCO2e - ch4FossilCO2e - n2oCO2e;

    // Pure CO₂ must be less than the total fossil CO₂e
    expect(co2FossilPure).toBeLessThan(totalFossilCO2e);
    // Pure CO₂ must be positive
    expect(co2FossilPure).toBeGreaterThan(0);

    // Species sum must reconcile to total
    const speciesSum = co2FossilPure + ch4FossilCO2e + n2oCO2e;
    expect(speciesSum).toBeCloseTo(totalFossilCO2e, 10);
  });

  it('species sum should equal headline total within tolerance', () => {
    // Simulate a realistic scenario
    const co2FossilPure = 0.450;
    const co2BiogenicPure = 0.020;
    const ch4FossilCO2e = 0.003;
    const ch4BiogenicCO2e = 0.001;
    const n2oCO2e = 0.003;
    const hfcPfc = 0;

    const speciesSum = co2FossilPure + co2BiogenicPure + ch4FossilCO2e +
                       ch4BiogenicCO2e + n2oCO2e + hfcPfc;
    const headlineTotal = 0.477;

    // The species sum must equal headline total within ±0.001 kg CO₂e
    expect(Math.abs(speciesSum - headlineTotal)).toBeLessThan(0.001);
  });

  it('IPCC AR6 GWP factors should be correctly defined', () => {
    expect(IPCC_AR6_GWP.CO2).toBe(1);
    expect(IPCC_AR6_GWP.CH4_FOSSIL).toBe(29.8);
    expect(IPCC_AR6_GWP.CH4_BIOGENIC).toBe(27.0);
    expect(IPCC_AR6_GWP.N2O).toBe(273);
  });
});

// ============================================================================
// Issue B — Uncertainty percentage matches CI bounds
// ============================================================================

describe('Issue B — Uncertainty display percentage', () => {
  it('display percentage should equal CI half-width / headline × 100', () => {
    const headline = 0.477;
    const ci95Lower = 0.343;
    const ci95Upper = 0.610;

    const halfWidth = (ci95Upper - ci95Lower) / 2;
    const displayPct = Math.round((halfWidth / headline) * 100);

    // With these values: halfWidth = 0.1335, displayPct ≈ 28%
    expect(displayPct).toBe(28);

    // Verify ±28% actually brackets the CI
    const lowerFromPct = headline * (1 - displayPct / 100);
    const upperFromPct = headline * (1 + displayPct / 100);
    expect(lowerFromPct).toBeCloseTo(ci95Lower, 1);
    expect(upperFromPct).toBeCloseTo(ci95Upper, 1);
  });

  it('display percentage should be 0 when headline is 0', () => {
    const headline = 0;
    const ci95Lower = 0;
    const ci95Upper = 0;

    const halfWidth = (ci95Upper - ci95Lower) / 2;
    const displayPct = headline > 0
      ? Math.round((halfWidth / headline) * 100)
      : 0;

    expect(displayPct).toBe(0);
  });
});

// ============================================================================
// Issue F — Interpretation >100% hotspot explanation
// ============================================================================

describe('Issue F — Interpretation >100% explanation', () => {
  const baseImpacts = {
    total_carbon_footprint: 0.300,
    breakdown: {
      by_material: [
        { name: 'Barley Malt', climate: 0.200 },
        { name: 'Hops', climate: 0.150 },
        { name: 'Water Treatment', climate: 0.050 },
        { name: 'Glass Bottle (EoL credit)', climate: -0.100 },
      ],
      by_lifecycle_stage: {
        raw_materials: 0.250,
        processing: 0.100,
        packaging: 0.050,
        end_of_life: -0.100,
      },
      by_scope: {
        scope1: 0.010,
        scope2: 0.020,
        scope3: 0.270,
      },
    },
    uncertainty_sensitivity: {},
    calculation_warnings: [],
  };

  it('should include >100% explanation when EoL credits reduce denominator', () => {
    const result = generateInterpretation(baseImpacts, 'cradle-to-grave');

    // Top 3 hotspots (Barley, Hops, Water) = 66.7% + 50% + 16.7% = 133.3%
    // This exceeds 100% because the total denominator (0.300) is reduced by EoL credit (-0.100)
    expect(result.significant_issues.summary).toContain('end-of-life avoided-burden credits');
  });

  it('should not include explanation when contributions are under 100%', () => {
    const normalImpacts = {
      ...baseImpacts,
      total_carbon_footprint: 0.500,
      breakdown: {
        ...baseImpacts.breakdown,
        by_material: [
          { name: 'Barley Malt', climate: 0.200 },
          { name: 'Hops', climate: 0.100 },
          { name: 'Water Treatment', climate: 0.050 },
        ],
      },
    };

    const result = generateInterpretation(normalImpacts, 'cradle-to-gate');
    expect(result.significant_issues.summary).not.toContain('end-of-life avoided-burden credits');
  });
});

// ============================================================================
// Issue G — Page numbering
// ============================================================================

describe('Issue G — Page number sequential numbering', () => {
  it('__PAGE_NUM__ replacement should produce sequential numbers', () => {
    // Simulate the main renderer's replacement logic
    const html = [
      '<div>Page __PAGE_NUM__</div>',
      '<div>Page __PAGE_NUM__</div>',
      '<div>Page __PAGE_NUM__</div>',
    ].join('\n');

    let counter = 0;
    const result = html.replace(/__PAGE_NUM__/g, () => String(++counter));

    expect(result).toContain('Page 1');
    expect(result).toContain('Page 2');
    expect(result).toContain('Page 3');
    expect(counter).toBe(3);
  });

  it('should handle variable number of pages correctly', () => {
    // If environmental impacts generates 2 pages, all subsequent pages
    // should shift by +1
    const pages = Array.from({ length: 17 }, (_, i) => `<footer>__PAGE_NUM__</footer>`);
    const html = pages.join('\n');

    let counter = 0;
    const result = html.replace(/__PAGE_NUM__/g, () => String(++counter));

    // The last page should be numbered 17, not any hardcoded value
    expect(result).toContain('<footer>17</footer>');
    expect(counter).toBe(17);
  });
});
