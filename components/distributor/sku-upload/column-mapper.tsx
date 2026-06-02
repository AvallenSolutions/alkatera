'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { ColumnMapper as SharedColumnMapper } from '@/components/shared/column-mapper';
import type { ColumnFieldSpec } from '@/components/shared/column-mapper';
import { Button } from '@/components/ui/button';
import type { ColumnMapping, ColumnMappingField, SkuListParseResult } from '@/types/distributor';

interface Props {
  parse: SkuListParseResult;
  skuListId: string;
  onConfirm: (mapping: ColumnMapping) => Promise<void> | void;
  disabled?: boolean;
}

const FIELDS: Array<ColumnFieldSpec<ColumnMappingField>> = [
  {
    key: 'brand_name',
    label: 'Brand name',
    required: false,
    hint: 'Leave unmapped if the brand is part of the product name — we’ll detect it automatically.',
  },
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

interface SampleExample {
  input: string;
  brand: string | null;
  product: string | null;
  is_product: boolean;
}

export function ColumnMapper({ parse, skuListId, onConfirm, disabled }: Props) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(parse.suggestions);
  const [examples, setExamples] = useState<SampleExample[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const productColumn = mapping.product_name;
  const aiMode = !mapping.brand_name; // no brand column → detect with AI

  async function runPreview() {
    if (!productColumn) return;
    setPreviewing(true);
    setPreviewError(null);
    setExamples(null);
    try {
      const res = await fetch(`/api/distributor/sku-lists/${skuListId}/detect-brands-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_column: productColumn }),
      });
      if (!res.ok) {
        setPreviewError('Could not preview brand detection. You can still run the import.');
        return;
      }
      const json = (await res.json()) as { examples: SampleExample[] };
      setExamples(json.examples);
    } catch {
      setPreviewError('Could not preview brand detection. You can still run the import.');
    } finally {
      setPreviewing(false);
    }
  }

  const aiPanel =
    aiMode && productColumn ? (
      <div className="rounded-xl border border-sky-400/30 bg-sky-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-sky-300 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-sky-100">Brands will be detected automatically</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              No brand column is mapped, so we&apos;ll read the brand from each value in{' '}
              <span className="font-medium text-foreground">&ldquo;{productColumn}&rdquo;</span>{' '}
              and skip any category/section rows. Preview a few rows to check it looks right.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={runPreview}
          disabled={previewing || disabled}
          className="border-sky-400/40 text-sky-200 hover:bg-sky-500/10"
        >
          {previewing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Detecting…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Preview brand detection
            </>
          )}
        </Button>

        {previewError && <p className="text-xs text-amber-300">{previewError}</p>}

        {examples && examples.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {examples.map((ex, i) => (
              <div key={i} className="text-xs flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground truncate max-w-[55%]">{ex.input}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                {ex.is_product ? (
                  <span>
                    <span className="font-semibold text-sky-200">{ex.brand}</span>
                    {ex.product ? <span className="text-muted-foreground"> · {ex.product}</span> : null}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/70">skipped (category row)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

  return (
    <SharedColumnMapper<ColumnMappingField>
      parse={parse}
      fields={FIELDS}
      disabled={disabled}
      onMappingChange={setMapping}
      footer={aiPanel}
      onConfirm={async (m) => {
        if (!m.product_name) return;
        await onConfirm({
          product_name: m.product_name,
          brand_source: m.brand_name ? 'column' : 'ai',
          ...(m.brand_name ? { brand_name: m.brand_name } : {}),
          sku_code: m.sku_code,
          gtin: m.gtin,
          category: m.category,
          country_of_origin: m.country_of_origin,
          listing_status: m.listing_status,
          website: m.website,
        });
      }}
    />
  );
}
