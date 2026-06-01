import type { ProcurementColumnField, ProcurementColumnMapping } from '@/types/procurement';

/**
 * Header aliases the procurement CSV parser auto-detects. Mirrors the
 * distributor brand-normalizer aliases for shared fields, then adds the
 * procurement-only fields (distributor_channel, vintage, volume,
 * list_price). Comparisons are lowercased + whitespace-collapsed.
 */
const PROCUREMENT_HEADER_ALIASES: Record<ProcurementColumnField, string[]> = {
  brand_name: [
    'brand',
    'brand name',
    'brand_name',
    'producer',
    'supplier',
    'supplier name',
    'winery',
    'distillery',
    'brewery',
    'manufacturer',
  ],
  product_name: [
    'product',
    'product name',
    'product_name',
    'wine',
    'sku',
    'sku name',
    'item',
    'item name',
    'description',
    'product description',
  ],
  distributor_channel: [
    'distributor',
    'distributor channel',
    'distributor_channel',
    'channel',
    'source',
    'supplier channel',
    'wholesaler',
    'merchant',
    'bought via',
    'bought from',
    'purchased via',
    'sourced from',
  ],
  sku_code: ['sku code', 'sku_code', 'sku id', 'product code', 'item code', 'code', 'reference'],
  gtin: ['gtin', 'ean', 'upc', 'barcode'],
  category: ['category', 'product category', 'type', 'product type', 'style', 'wine type'],
  country_of_origin: [
    'country',
    'country of origin',
    'country_of_origin',
    'producing country',
    'origin country',
    'origin',
  ],
  listing_status: ['status', 'listing status', 'listing_status', 'active', 'state'],
  website: ['website', 'url', 'web', 'web address', 'site', 'homepage'],
  vintage: ['vintage', 'year', 'vintage year', 'vintage_year', 'harvest year'],
  volume_per_year_liters: [
    'volume',
    'volume per year',
    'volume_per_year',
    'volume per year (litres)',
    'annual volume',
    'annual volume litres',
    'annual volume liters',
    'litres per year',
    'liters per year',
    'l/yr',
  ],
  list_price_gbp: [
    'list price',
    'list_price',
    'list price gbp',
    'list price (gbp)',
    'price',
    'unit price',
    'unit cost',
    'price gbp',
    'cost',
  ],
};

function normaliseHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Suggest a column mapping from a list of CSV/XLSX headers. The wizard
 * pre-populates its mapping form from these suggestions and asks the
 * user to confirm before processing.
 */
export function suggestProcurementColumnMapping(
  headers: string[],
): Partial<ProcurementColumnMapping> {
  const suggestions: Partial<ProcurementColumnMapping> = {};
  const normalised = headers.map((h) => ({ original: h, normal: normaliseHeader(h) }));
  for (const field of Object.keys(PROCUREMENT_HEADER_ALIASES) as ProcurementColumnField[]) {
    const aliases = PROCUREMENT_HEADER_ALIASES[field];
    const match = normalised.find((h) => aliases.includes(h.normal));
    if (match) {
      suggestions[field] = match.original;
    }
  }
  return suggestions;
}

/**
 * Validate an arbitrary mapping payload from the upload wizard. Returns
 * a typed mapping if the required fields are present, otherwise null.
 */
export function validateProcurementMapping(input: unknown): ProcurementColumnMapping | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.brand_name !== 'string' || !obj.brand_name) return null;
  if (typeof obj.product_name !== 'string' || !obj.product_name) return null;
  if (typeof obj.distributor_channel !== 'string' || !obj.distributor_channel) return null;
  const mapping: ProcurementColumnMapping = {
    brand_name: obj.brand_name,
    product_name: obj.product_name,
    distributor_channel: obj.distributor_channel,
  };
  const optional: ProcurementColumnField[] = [
    'sku_code',
    'gtin',
    'category',
    'country_of_origin',
    'listing_status',
    'website',
    'vintage',
    'volume_per_year_liters',
    'list_price_gbp',
  ];
  for (const field of optional) {
    if (typeof obj[field] === 'string' && obj[field]) {
      mapping[field] = obj[field] as string;
    }
  }
  return mapping;
}
