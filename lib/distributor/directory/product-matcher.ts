import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGtin, normalizeProductName } from '../brand-normalizer';

export interface ProductMatchInput {
  /** Required: the canonical brand the product belongs under. */
  brandDirectoryId: string;
  /** User-facing display name as it appeared in the upload. */
  displayName: string;
  /** Optional GTIN/EAN/UPC from the upload — takes precedence over name match. */
  gtin?: string | null;
  /** Optional attributes used only when we create a fresh directory entry. */
  category?: string | null;
  countryOfOrigin?: string | null;
}

export type ProductMatchVia = 'gtin' | 'exact_name' | 'fuzzy' | 'created';

export interface ProductMatchResult {
  /** product_directory.id we resolved to. */
  productDirectoryId: string;
  /** Whether we created a new directory entry or linked to an existing one. */
  created: boolean;
  /** Match confidence (0..1). 1.0 for GTIN / exact name; >=0.85 for fuzzy auto-links; 1.0 for new entries. */
  similarity: number;
  /** How we matched. */
  matchVia: ProductMatchVia;
  /** The directory entry's canonical name. */
  canonicalName: string;
}

/**
 * Anything at or above this similarity is auto-linked to the existing
 * product_directory entry without manual confirmation. Same threshold
 * as the brand matcher so the two layers behave consistently.
 */
export const PRODUCT_AUTO_LINK_THRESHOLD = 0.85;

/**
 * Find the best `product_directory` match within a given brand for a
 * candidate product. GTIN match (when present) takes precedence over
 * any name match. Returns null if nothing crosses the auto-link
 * threshold.
 *
 * Calls the `match_product_directory` SECURITY DEFINER RPC.
 */
export async function findProductMatch(
  supabase: SupabaseClient,
  input: ProductMatchInput,
  threshold: number = PRODUCT_AUTO_LINK_THRESHOLD,
): Promise<{
  productDirectoryId: string;
  canonicalName: string;
  similarity: number;
  matchVia: 'gtin' | 'exact_name' | 'fuzzy';
} | null> {
  const normalized = normalizeProductName(input.displayName);
  const gtin = normalizeGtin(input.gtin ?? null);
  if (!normalized && !gtin) return null;

  const { data, error } = await supabase.rpc('match_product_directory', {
    p_brand_directory_id: input.brandDirectoryId,
    p_query_name: input.displayName,
    p_gtin: gtin,
    p_similarity_threshold: threshold,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;

  type Row = {
    id: string;
    name: string;
    normalized_name: string;
    gtin: string | null;
    similarity: number;
    match_via: 'gtin' | 'exact_name' | 'fuzzy';
  };
  const top = (data as Row[])[0];
  if (!top || top.similarity < threshold) return null;

  return {
    productDirectoryId: top.id,
    canonicalName: top.name,
    similarity: top.similarity,
    matchVia: top.match_via,
  };
}

/**
 * Resolve a product to a `product_directory` entry within a brand,
 * creating one if no auto-link match exists. Requires a service-role
 * (or otherwise insert-capable) client to write to product_directory.
 */
export async function resolveOrCreateProductEntry(
  supabase: SupabaseClient,
  input: ProductMatchInput & {
    discoveredByDistributorOrgId?: string | null;
    /** Override the discovered_via stamp on fresh entries. Defaults
     *  to 'sku_upload' for the SKU import flow; admin bulk-upload
     *  passes 'manual'. */
    discoveredVia?: 'sku_upload' | 'alkatera_signup' | 'manual' | 'phase1_backfill';
  },
): Promise<ProductMatchResult> {
  const normalized = normalizeProductName(input.displayName);
  const gtin = normalizeGtin(input.gtin ?? null);
  if (!normalized && !gtin) {
    throw new Error(`Product "${input.displayName}" normalises to empty and has no GTIN`);
  }

  const match = await findProductMatch(supabase, input);
  if (match) {
    return {
      productDirectoryId: match.productDirectoryId,
      created: false,
      similarity: match.similarity,
      matchVia: match.matchVia,
      canonicalName: match.canonicalName,
    };
  }

  const { data, error } = await supabase
    .from('product_directory')
    .insert({
      brand_directory_id: input.brandDirectoryId,
      name: input.displayName,
      normalized_name: normalized,
      gtin: gtin,
      category: input.category ?? null,
      discovered_via: input.discoveredVia ?? 'sku_upload',
      discovered_by_distributor_org_id: input.discoveredByDistributorOrgId ?? null,
    })
    .select('id, name')
    .single();
  if (error || !data) {
    throw new Error(
      `Could not create product directory entry for "${input.displayName}": ${error?.message ?? 'no row returned'}`,
    );
  }

  return {
    productDirectoryId: (data as { id: string }).id,
    created: true,
    similarity: 1.0,
    matchVia: 'created',
    canonicalName: (data as { name: string }).name,
  };
}

/**
 * Bulk-resolve a list of products under a single brand to directory
 * entries. Used by the SKU upload processor so we do one resolution
 * per unique (gtin, normalized_name) pair per brand.
 *
 * Returns a map keyed by `${gtin ?? ''}|${normalizedName}` so that two
 * upload rows with the same product collapse onto the same directory
 * entry.
 */
export async function resolveProductsToDirectory(
  supabase: SupabaseClient,
  products: Array<ProductMatchInput>,
  discoveredByDistributorOrgId: string,
  onProgress?: (current: number, total: number) => Promise<void> | void,
): Promise<Map<string, ProductMatchResult>> {
  const resolved = new Map<string, ProductMatchResult>();
  const total = products.length;
  let done = 0;
  for (const product of products) {
    done += 1;
    const normalized = normalizeProductName(product.displayName);
    const gtin = normalizeGtin(product.gtin ?? null);
    if (!normalized && !gtin) {
      await onProgress?.(done, total);
      continue;
    }
    const key = `${gtin ?? ''}|${normalized}|${product.brandDirectoryId}`;
    if (resolved.has(key)) {
      await onProgress?.(done, total);
      continue;
    }
    const result = await resolveOrCreateProductEntry(supabase, {
      ...product,
      gtin,
      discoveredByDistributorOrgId,
    });
    resolved.set(key, result);
    await onProgress?.(done, total);
  }
  return resolved;
}

/** Lookup key shared by upload-processor and matcher — keeps both in sync. */
export function productMatchKey(
  brandDirectoryId: string,
  displayName: string,
  gtin: string | null | undefined,
): string {
  const normalized = normalizeProductName(displayName);
  const cleaned = normalizeGtin(gtin ?? null);
  return `${cleaned ?? ''}|${normalized}|${brandDirectoryId}`;
}
