import type { ColumnMapping, ColumnMappingField } from '@/types/distributor';

const LEGAL_SUFFIX_PATTERN =
  /\b(sas|s\.a\.s\.|sa|s\.a\.|sarl|s\.a\.r\.l\.|srl|s\.r\.l\.|spa|s\.p\.a\.|ltd|limited|llc|l\.l\.c\.|gmbh|bv|b\.v\.|inc|incorporated|plc|pty|co|company|kg|ag)\b/gi;

const DIACRITIC_PATTERN = /[̀-ͯ]/g;

const APOSTROPHE_PATTERN = /[‘’']/g;

/**
 * Normalise a brand name so different cosmetic variants collapse to the same
 * key. Used to dedupe brand profiles inside a single distributor org.
 *
 * "Château Margaux SAS", "Château Margaux", and "chateau margaux  " all
 * collapse to "chateau margaux".
 */
export function normalizeBrandName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .replace(APOSTROPHE_PATTERN, '')
    .replace(/[.,&]/g, ' ')
    .replace(LEGAL_SUFFIX_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise a product name to the same shape used by
 * `product_directory_normalize` in SQL: lowercased, alphanumeric +
 * spaces only. Different from `normalizeBrandName` because legal-entity
 * suffixes don't apply to products.
 *
 * "Avallen Calvados 70cl", "avallen calvados, 70cl" and
 * "Avallen-Calvados 70cl" all collapse to "avallen calvados 70cl".
 */
export function normalizeProductName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .replace(APOSTROPHE_PATTERN, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip a GTIN/EAN/UPC barcode to digits only. Returns null if no
 * digits remain (so callers can treat "n/a"/"none"/empty alike).
 *
 * GTIN-13 (5060538740019), GTIN-12 (UPC-A), GTIN-8 (EAN-8) and GTIN-14
 * are all kept as-is once cleaned — exact equality is what we use for
 * matching. We do NOT pad shorter codes to GTIN-14 here; that would
 * collide e.g. UPC-A 012345678905 with the matching GTIN-13
 * 0012345678905, and we want to revisit that conversion deliberately.
 */
export function normalizeGtin(gtin: string | null | undefined): string | null {
  if (!gtin) return null;
  const digits = String(gtin).replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}

const HEADER_ALIASES: Record<ColumnMappingField, string[]> = {
  brand_name: [
    'brand',
    'brand name',
    'brandname',
    'producer',
    'supplier',
    'winery',
    'distillery',
    'brewery',
    'manufacturer',
    'vendor',
    'maker',
  ],
  product_name: [
    'product',
    'product name',
    'productname',
    'description',
    'item',
    'item description',
    'name',
    'sku name',
    'wine name',
    'product description',
  ],
  sku_code: [
    'sku',
    'sku code',
    'sku id',
    'sku_code',
    'item code',
    'product code',
    'code',
    'article',
    'article number',
    'item number',
    'reference',
    'ref',
  ],
  gtin: [
    'gtin',
    'gtin13',
    'gtin-13',
    'gtin 13',
    'ean',
    'ean13',
    'ean-13',
    'ean 13',
    'upc',
    'upc-a',
    'barcode',
    'bar code',
    'global trade item number',
  ],
  category: ['category', 'type', 'product type', 'product category', 'segment', 'class'],
  country_of_origin: [
    'country',
    'origin',
    'country of origin',
    'country_of_origin',
    'producing country',
    'origin country',
  ],
  listing_status: ['status', 'listing status', 'listing_status', 'active', 'state'],
  website: [
    'website',
    'url',
    'web',
    'web address',
    'site',
    'homepage',
    'brand website',
    'brand url',
    'producer website',
  ],
};

function normaliseHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Given the headers detected in a parsed SKU list file, suggest which header
 * corresponds to which mapping field. Returns undefined for fields that have
 * no confident match so the UI can prompt the user.
 */
export function suggestColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const suggestions: Partial<ColumnMapping> = {};
  const normalised = headers.map((h) => ({ original: h, normal: normaliseHeader(h) }));

  for (const field of Object.keys(HEADER_ALIASES) as ColumnMappingField[]) {
    const aliases = HEADER_ALIASES[field];
    const match = normalised.find((h) => aliases.includes(h.normal));
    if (match) {
      suggestions[field] = match.original;
    }
  }

  return suggestions;
}

/**
 * Build a slug from a distributor name suitable for the slug column on
 * distributor_organizations. Lowercase, hyphenated, alphanumeric only.
 */
export function buildOrgSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'distributor';
}
