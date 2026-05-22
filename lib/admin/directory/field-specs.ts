import type { ColumnFieldSpec } from '@/components/shared/column-mapper';

/**
 * CSV column specs + header aliases for the two admin bulk-upload
 * kinds. Used by both the column-mapper UI (renders the field list)
 * and the parse route (suggests an initial mapping from CSV headers).
 */

export type BrandFieldKey =
  | 'name'
  | 'website'
  | 'category'
  | 'country_of_origin'
  | 'founding_year'
  | 'parent_company'
  | 'description'
  | 'aliases';

export const BRAND_FIELDS: Array<ColumnFieldSpec<BrandFieldKey>> = [
  { key: 'name', label: 'Brand name', required: true },
  {
    key: 'website',
    label: 'Website',
    required: false,
    hint: 'Optional — seeds the open-web scraper for this brand.',
  },
  {
    key: 'category',
    label: 'Category',
    required: false,
    hint: 'spirits / wine / beer / non_alc / other',
  },
  { key: 'country_of_origin', label: 'Country of origin', required: false, hint: 'ISO-2 or name.' },
  { key: 'founding_year', label: 'Founding year', required: false },
  { key: 'parent_company', label: 'Parent company', required: false },
  { key: 'description', label: 'Description', required: false },
  {
    key: 'aliases',
    label: 'Aliases',
    required: false,
    hint: 'Semicolon-separated; appended to existing aliases on match.',
  },
];

export const BRAND_HEADER_ALIASES: Record<BrandFieldKey, string[]> = {
  name: ['name', 'brand', 'brand name', 'brand_name', 'producer'],
  website: ['website', 'url', 'site', 'web', 'homepage', 'brand website'],
  category: ['category', 'type', 'product type', 'segment'],
  country_of_origin: ['country', 'origin', 'country of origin', 'country_of_origin'],
  founding_year: ['founding year', 'founded', 'year founded', 'founding_year', 'established'],
  parent_company: ['parent', 'parent company', 'parent_company', 'group', 'owner'],
  description: ['description', 'about', 'bio', 'story'],
  aliases: ['aliases', 'alias', 'alternate names', 'akas', 'also known as'],
};

export type ProductFieldKey =
  | 'brand_name'
  | 'product_name'
  | 'gtin'
  | 'category'
  | 'abv'
  | 'container_size_ml'
  | 'container_format';

export const PRODUCT_FIELDS: Array<ColumnFieldSpec<ProductFieldKey>> = [
  {
    key: 'brand_name',
    label: 'Brand name',
    required: true,
    hint: 'Matched against existing brand_directory by exact name; missing brands are reported as unresolved rather than auto-created.',
  },
  { key: 'product_name', label: 'Product name', required: true },
  {
    key: 'gtin',
    label: 'GTIN / barcode',
    required: false,
    hint: 'Strongly recommended — primary dedup key.',
  },
  { key: 'category', label: 'Category', required: false },
  { key: 'abv', label: 'ABV %', required: false },
  { key: 'container_size_ml', label: 'Container size (ml)', required: false },
  {
    key: 'container_format',
    label: 'Container format',
    required: false,
    hint: 'bottle / can / keg / bag_in_box / other',
  },
];

export const PRODUCT_HEADER_ALIASES: Record<ProductFieldKey, string[]> = {
  brand_name: ['brand', 'brand name', 'brand_name', 'producer', 'maker'],
  product_name: ['product', 'product name', 'product_name', 'item', 'sku name', 'wine name'],
  gtin: ['gtin', 'ean', 'upc', 'barcode', 'gtin13', 'ean13', 'upc-a'],
  category: ['category', 'type', 'product type'],
  abv: ['abv', 'alcohol', 'alcohol by volume', 'alcohol %', 'abv %'],
  container_size_ml: ['size', 'size (ml)', 'size_ml', 'volume', 'volume (ml)', 'container size'],
  container_format: ['format', 'container', 'container format', 'pack format', 'packaging'],
};
