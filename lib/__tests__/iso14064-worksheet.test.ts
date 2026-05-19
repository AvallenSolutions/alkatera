import { describe, it, expect } from 'vitest';
import {
  UNCERTAINTY_TIERS,
  uncertaintyTierForProvenance,
} from '../data-quality-assessment';
import { renderIso14064WorksheetHtml } from '../pdf/render-iso14064-worksheet-html';

describe('uncertaintyTierForProvenance', () => {
  it('maps measured/supplier-verified to Low (±8%)', () => {
    expect(uncertaintyTierForProvenance('primary_measured_onsite').pct).toBe(8);
    expect(uncertaintyTierForProvenance('primary_supplier_verified').key).toBe('low');
  });

  it('maps calculated/allocated to Medium (±20%)', () => {
    const t = uncertaintyTierForProvenance('secondary_calculated_allocation');
    expect(t.key).toBe('medium');
    expect(t.pct).toBe(20);
  });

  it('maps modelled/industry-average to High (±50%)', () => {
    expect(uncertaintyTierForProvenance('secondary_modelled_industry_average').pct).toBe(50);
  });

  it('defaults unknown/blank provenance to the conservative High tier', () => {
    expect(uncertaintyTierForProvenance(null).key).toBe('high');
    expect(uncertaintyTierForProvenance(undefined).key).toBe('high');
    expect(uncertaintyTierForProvenance('something_else').pct).toBe(
      UNCERTAINTY_TIERS.high.pct,
    );
  });
});

describe('renderIso14064WorksheetHtml', () => {
  it('renders a worksheet with volume-weighted uncertainty and totals', () => {
    const html = renderIso14064WorksheetHtml({
      organisationName: 'Avallen Spirits',
      reportYear: 2025,
      reportingPeriodStart: '2025-01-01',
      reportingPeriodEnd: '2025-12-31',
      lineItems: [
        {
          scope: 'Scope 1',
          sourceCategory: 'Direct combustion',
          methodology: 'DEFRA factors',
          dataQuality: 'Measured',
          dataProvenance: 'primary_measured_onsite', // ±8%
          emissionFactorSource: 'DEFRA 2025',
          completeness: 'Complete',
          emissionsTco2e: 100,
        },
        {
          scope: 'Scope 3',
          sourceCategory: 'Value chain',
          methodology: 'Modelled',
          dataQuality: 'Modelled',
          dataProvenance: 'secondary_modelled_industry_average', // ±50%
          emissionFactorSource: 'Ecoinvent',
          completeness: 'Estimated',
          emissionsTco2e: 100,
        },
      ],
      branding: { logo: null, primaryColor: '#ccff00' },
    });

    expect(html).toContain('ISO 14064-1:2018 Verification Worksheet');
    expect(html).toContain('Avallen Spirits');
    // 50/50 weighting of ±8% and ±50% → 29.0%
    expect(html).toContain('29.0%');
    // total 200.000 tCO2e
    expect(html).toContain('200.000 tCO');
  });

  it('escapes HTML in organisation-supplied fields', () => {
    const html = renderIso14064WorksheetHtml({
      organisationName: '<script>x</script>',
      reportYear: 2025,
      reportingPeriodStart: '2025-01-01',
      reportingPeriodEnd: '2025-12-31',
      lineItems: [],
      branding: { logo: null, primaryColor: '#ccff00' },
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
