import { FIELD_DEFINITIONS, type FieldKey } from '../scraping/field-definitions';

export interface PortfolioSkuRow {
  sku_code: string | null;
  product_name: string;
  brand_name: string;
  category: string | null;
  country_of_origin: string | null;
  /** Map of FieldKey → display value (string), already coerced. */
  brand_fields: Partial<Record<FieldKey, string>>;
  data_completeness_pct: number | null;
  alkatera_tier: number;
  outreach_status: string;
}

export interface PortfolioCsvInput {
  distributorName: string;
  generated_at: Date;
  rows: PortfolioSkuRow[];
}

/**
 * Build a flat CSV: one row per SKU. Brand-level fields are repeated
 * across every SKU of the same brand — this is the format retailer
 * data exchanges expect.
 *
 * Metadata header lines start with "# " so a downstream parser can
 * easily skip them.
 */
export function buildPortfolioCsv(input: PortfolioCsvInput): string {
  const lines: string[] = [];
  lines.push(`# alkatera distributor export`);
  lines.push(`# Distributor: ${input.distributorName}`);
  lines.push(`# Generated: ${input.generated_at.toISOString()}`);
  lines.push(
    `# Source legend: cells show the most recent value across scraped + brand-uploaded data. Cells marked "—" had no data on file at export time.`,
  );

  const header = [
    'sku_code',
    'product_name',
    'brand_name',
    'category',
    'country_of_origin',
    ...FIELD_DEFINITIONS.map((f) => f.key),
    'data_completeness_pct',
    'alkatera_tier',
    'outreach_status',
  ];
  lines.push(header.map(escapeCsv).join(','));

  for (const row of input.rows) {
    const cells: string[] = [
      row.sku_code ?? '',
      row.product_name,
      row.brand_name,
      row.category ?? '',
      row.country_of_origin ?? '',
      ...FIELD_DEFINITIONS.map((f) => row.brand_fields[f.key] ?? ''),
      row.data_completeness_pct != null ? row.data_completeness_pct.toFixed(1) : '',
      String(row.alkatera_tier),
      row.outreach_status,
    ];
    lines.push(cells.map(escapeCsv).join(','));
  }

  return lines.join('\n');
}

function escapeCsv(value: string): string {
  if (value === '' || value == null) return '';
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
