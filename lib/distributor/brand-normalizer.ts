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
