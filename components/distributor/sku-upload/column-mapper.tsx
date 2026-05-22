'use client';

import { ColumnMapper as SharedColumnMapper } from '@/components/shared/column-mapper';
import type { ColumnFieldSpec } from '@/components/shared/column-mapper';
import type { ColumnMapping, ColumnMappingField, SkuListParseResult } from '@/types/distributor';

interface Props {
  parse: SkuListParseResult;
  onConfirm: (mapping: ColumnMapping) => Promise<void> | void;
  disabled?: boolean;
}

const FIELDS: Array<ColumnFieldSpec<ColumnMappingField>> = [
  { key: 'brand_name', label: 'Brand name', required: true },
  { key: 'product_name', label: 'Product name', required: true },
  { key: 'sku_code', label: 'SKU code', required: false },
  {
    key: 'gtin',
    label: 'GTIN / barcode',
    required: false,
    hint: 'Recommended — lets us match products to canonical sustainability records.',
  },
  { key: 'category', label: 'Category', required: false },
  { key: 'country_of_origin', label: 'Country of origin', required: false },
  {
    key: 'website',
    label: 'Brand website',
    required: false,
    hint: "Recommended — lets us find this brand's sustainability data.",
  },
  { key: 'listing_status', label: 'Listing status', required: false },
];

export function ColumnMapper({ parse, onConfirm, disabled }: Props) {
  return (
    <SharedColumnMapper<ColumnMappingField>
      parse={parse}
      fields={FIELDS}
      disabled={disabled}
      onConfirm={async (mapping) => {
        if (!mapping.brand_name || !mapping.product_name) return;
        await onConfirm({
          brand_name: mapping.brand_name,
          product_name: mapping.product_name,
          sku_code: mapping.sku_code,
          gtin: mapping.gtin,
          category: mapping.category,
          country_of_origin: mapping.country_of_origin,
          listing_status: mapping.listing_status,
          website: mapping.website,
        });
      }}
    />
  );
}
