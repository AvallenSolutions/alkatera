import { describe, it, expect } from 'vitest';
import { buildPortfolioCsv } from '@/lib/distributor/exports/portfolio-csv';

const baseRow = {
  sku_code: 'MAR-2018',
  product_name: 'Château Margaux 2018',
  brand_name: 'Château Margaux',
  category: 'wine',
  country_of_origin: 'France',
  brand_fields: {
    bcorp_certified: 'true',
    carbon_intensity_kgco2e_per_litre: '0.42',
  },
  data_completeness_pct: 73,
  alkatera_tier: 2,
  outreach_status: 'responded',
};

describe('buildPortfolioCsv', () => {
  it('starts with the distributor metadata header lines', () => {
    const csv = buildPortfolioCsv({
      distributorName: 'Liberty Wines',
      generated_at: new Date('2026-05-11T00:00:00Z'),
      rows: [],
    });
    const lines = csv.split('\n');
    expect(lines[0]).toContain('alkatera distributor export');
    expect(lines[1]).toContain('Liberty Wines');
    expect(lines[2]).toContain('2026-05-11');
  });

  it('includes a row per SKU plus a header column row', () => {
    const csv = buildPortfolioCsv({
      distributorName: 'Liberty Wines',
      generated_at: new Date(),
      rows: [baseRow, { ...baseRow, sku_code: 'MAR-2019', product_name: 'Château Margaux 2019' }],
    });
    const lines = csv.split('\n');
    // 4 metadata + 1 column header + 2 data rows = 7
    expect(lines.length).toBe(7);
  });

  it('escapes commas and quotes inside string cells', () => {
    const csv = buildPortfolioCsv({
      distributorName: 'Liberty Wines',
      generated_at: new Date(),
      rows: [
        {
          ...baseRow,
          product_name: 'Cuvée "Reserve", 2018',
          brand_name: 'Maison, Tradition',
        },
      ],
    });
    expect(csv).toContain('"Cuvée ""Reserve"", 2018"');
    expect(csv).toContain('"Maison, Tradition"');
  });

  it('includes a column per FieldKey and fills in known brand_fields values', () => {
    const csv = buildPortfolioCsv({
      distributorName: 'Liberty Wines',
      generated_at: new Date(),
      rows: [baseRow],
    });
    const lines = csv.split('\n');
    const header = lines.find((l) => l.startsWith('sku_code'));
    expect(header).toBeDefined();
    expect(header).toContain('bcorp_certified');
    expect(header).toContain('carbon_intensity_kgco2e_per_litre');

    const dataRow = lines[lines.length - 1];
    expect(dataRow).toContain('MAR-2018');
    expect(dataRow).toContain('0.42');
    // boolean stored as the textual representation:
    expect(dataRow).toContain('true');
  });

  it('emits an empty CSV (just metadata + header) when there are no SKUs', () => {
    const csv = buildPortfolioCsv({
      distributorName: 'Liberty Wines',
      generated_at: new Date(),
      rows: [],
    });
    expect(csv).toContain('sku_code,product_name,brand_name');
    // No data rows.
    expect(csv.trim().split('\n').length).toBe(5);
  });
});
