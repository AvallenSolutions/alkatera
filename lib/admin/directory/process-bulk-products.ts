import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveOrCreateProductEntrySmart,
  clearProductDedupCache,
} from '@/lib/distributor/directory/product-dedup';
import { normalizeBrandName } from '@/lib/distributor/brand-normalizer';
import type { ProductFieldKey } from './field-specs';

export interface BulkProductsResult {
  rows_processed: number;
  products_created: number;
  products_linked: number;
  errors: Array<{ row: number; brand?: string; error: string }>;
}

interface Args {
  service: SupabaseClient;
  rows: Record<string, string>[];
  mapping: Partial<Record<ProductFieldKey, string>>;
}

/**
 * Walk an admin-uploaded products CSV and seed the canonical
 * `product_directory`. Each row needs an exact-name brand match in
 * `brand_directory` — admin uploads shouldn't auto-create brands as a
 * side effect of a product list. Rows whose brand isn't resolvable
 * are reported as errors and skipped.
 *
 * Resolution within a brand:
 *   - exact GTIN → linked
 *   - exact normalised name → linked
 *   - trigram fuzzy >= 0.85 within brand → linked
 *   - else → created with `discovered_via='manual'`
 *
 * After resolve, optional columns (abv, container_size_ml,
 * container_format) are filled if currently null.
 */
export async function processBulkProducts(args: Args): Promise<BulkProductsResult> {
  const { service, rows, mapping } = args;
  const result: BulkProductsResult = {
    rows_processed: 0,
    products_created: 0,
    products_linked: 0,
    errors: [],
  };

  if (!mapping.brand_name) {
    result.errors.push({ row: 0, error: 'brand_name column not mapped' });
    return result;
  }
  if (!mapping.product_name) {
    result.errors.push({ row: 0, error: 'product_name column not mapped' });
    return result;
  }

  // Cache brand lookups so a CSV with hundreds of rows for the same brand
  // doesn't hammer brand_directory.
  const brandCache = new Map<string, string | null>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const brandName = (row[mapping.brand_name] ?? '').trim();
    const productName = (row[mapping.product_name] ?? '').trim();
    if (!brandName) {
      result.errors.push({ row: i + 2, error: 'missing brand_name' });
      continue;
    }
    if (!productName) {
      result.errors.push({ row: i + 2, brand: brandName, error: 'missing product_name' });
      continue;
    }
    result.rows_processed += 1;

    const normalisedBrand = normalizeBrandName(brandName);
    let brandDirectoryId = brandCache.get(normalisedBrand);
    if (brandDirectoryId === undefined) {
      const { data } = await service
        .from('brand_directory')
        .select('id')
        .eq('normalized_name', normalisedBrand)
        .maybeSingle();
      brandDirectoryId = (data as { id: string } | null)?.id ?? null;
      brandCache.set(normalisedBrand, brandDirectoryId);
    }
    if (!brandDirectoryId) {
      result.errors.push({
        row: i + 2,
        brand: brandName,
        error: 'brand not found in directory — upload brand first',
      });
      continue;
    }

    const gtin = pick(row, mapping.gtin);
    const category = pick(row, mapping.category);
    const abvRaw = pick(row, mapping.abv);
    const sizeMlRaw = pick(row, mapping.container_size_ml);
    const format = pick(row, mapping.container_format);

    try {
      const resolved = await resolveOrCreateProductEntrySmart(
        service,
        {
          brandDirectoryId,
          brandName,
          displayName: productName,
          gtin,
          category,
          abv: parseNumberOrNull(abvRaw),
          containerSizeMl: parseNumberOrNull(sizeMlRaw),
          containerFormat: format,
        },
        {
          discoveredByDistributorOrgId: null,
          discoveredVia: 'manual',
          // Big admin CSVs can run dozens of LLM calls — keep them on,
          // it's the whole point of the smart matcher. processBulkBrands
          // already clears the cache once per row though.
        },
      );
      if (resolved.created) result.products_created += 1;
      else result.products_linked += 1;

      // Fill optional fields only if currently null.
      const { data: current } = await service
        .from('product_directory')
        .select('abv, container_size_ml, container_format, gtin, category')
        .eq('id', resolved.productDirectoryId)
        .maybeSingle();
      const cur = current as {
        abv: number | null;
        container_size_ml: number | null;
        container_format: string | null;
        gtin: string | null;
        category: string | null;
      } | null;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (cur?.abv == null && abvRaw) {
        const n = parseFloat(abvRaw);
        if (Number.isFinite(n) && n > 0 && n < 100) patch.abv = n;
      }
      if (cur?.container_size_ml == null && sizeMlRaw) {
        const n = parseInt(sizeMlRaw, 10);
        if (Number.isFinite(n) && n > 0) patch.container_size_ml = n;
      }
      if (cur?.container_format == null && format) {
        patch.container_format = format;
      }
      if (cur?.gtin == null && gtin) patch.gtin = gtin;
      if (cur?.category == null && category) patch.category = category;
      if (Object.keys(patch).length > 1) {
        await service
          .from('product_directory')
          .update(patch)
          .eq('id', resolved.productDirectoryId);
      }
    } catch (err) {
      result.errors.push({
        row: i + 2,
        brand: brandName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

function parseNumberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pick(row: Record<string, string>, column: string | undefined): string | null {
  if (!column) return null;
  const v = (row[column] ?? '').trim();
  return v ? v : null;
}
