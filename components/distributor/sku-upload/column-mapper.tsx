'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnMapping, ColumnMappingField, SkuListParseResult } from '@/types/distributor';

interface Props {
  parse: SkuListParseResult;
  onConfirm: (mapping: ColumnMapping) => Promise<void> | void;
  disabled?: boolean;
}

const FIELDS: Array<{
  key: ColumnMappingField;
  label: string;
  required: boolean;
  hint?: string;
}> = [
  { key: 'brand_name', label: 'Brand name', required: true },
  { key: 'product_name', label: 'Product name', required: true },
  { key: 'sku_code', label: 'SKU code', required: false },
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

const NONE = '__none__';

export function ColumnMapper({ parse, onConfirm, disabled }: Props) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(parse.suggestions);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(mapping.brand_name && mapping.product_name);

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({
        brand_name: mapping.brand_name!,
        product_name: mapping.product_name!,
        sku_code: mapping.sku_code,
        category: mapping.category,
        country_of_origin: mapping.country_of_origin,
        listing_status: mapping.listing_status,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Preview</h3>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {parse.detected_columns.map((col) => (
                  <th key={col} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parse.preview.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {parse.detected_columns.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Showing {parse.preview.length} of the first rows.
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Map columns</h3>
        <div className="space-y-3">
          {FIELDS.map((field) => {
            const value = mapping[field.key] ?? NONE;
            return (
              <div key={field.key} className="flex items-start gap-3 py-1">
                <div className="w-44 text-sm">
                  <div>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </div>
                  {field.hint && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {field.hint}
                    </div>
                  )}
                </div>
                <div className="flex-1 max-w-sm">
                  <Select
                    value={value}
                    onValueChange={(v) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: v === NONE ? undefined : v,
                      }))
                    }
                    disabled={disabled || submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {!field.required && (
                        <SelectItem value={NONE}>— Not in file —</SelectItem>
                      )}
                      {parse.detected_columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleConfirm}
          disabled={!canSubmit || submitting || disabled}
          className="bg-sky-400 hover:bg-sky-300 text-black"
        >
          {submitting ? 'Processing…' : 'Confirm mapping & import'}
        </Button>
      </div>
    </div>
  );
}
