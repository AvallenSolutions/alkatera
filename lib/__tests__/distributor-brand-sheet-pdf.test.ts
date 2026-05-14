import { describe, it, expect } from 'vitest';
import { buildBrandSheetPdf } from '@/lib/distributor/exports/brand-sheet-pdf';

describe('buildBrandSheetPdf', () => {
  it('produces a non-empty buffer with a PDF header', () => {
    const buffer = buildBrandSheetPdf({
      brandName: 'Château Margaux',
      distributorName: 'Liberty Wines',
      category: 'wine',
      country_of_origin: 'France',
      alkatera_tier: 2,
      completeness_score: 73,
      fields: [
        {
          field_key: 'bcorp_certified',
          value: 'true',
          numeric: 1,
          source: 'B Corp Directory',
          confidence: 0.95,
          updated_at: new Date().toISOString(),
        },
        {
          field_key: 'carbon_intensity_kgco2e_per_litre',
          value: '0.42',
          numeric: 0.42,
          source: 'brand_upload',
          confidence: 0.85,
          updated_at: new Date().toISOString(),
        },
      ],
      generated_at: new Date(),
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDFs start with "%PDF" magic.
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders even when no fields are populated', () => {
    const buffer = buildBrandSheetPdf({
      brandName: 'New Brand',
      distributorName: 'Liberty Wines',
      category: null,
      country_of_origin: null,
      alkatera_tier: 1,
      completeness_score: 0,
      fields: [],
      generated_at: new Date(),
    });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
