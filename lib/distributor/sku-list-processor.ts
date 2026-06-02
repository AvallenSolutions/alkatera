import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBrandName, normalizeGtin, normalizeProductName } from './brand-normalizer';
import { resolveBrandsToDirectory, type DirectoryMatchResult } from './directory/matcher';
import {
  resolveProductsToDirectory,
  productMatchKey,
  type ProductMatchResult,
} from './directory/product-matcher';
import type { ColumnMapping } from '@/types/distributor';

export interface DirectoryMatchSummary {
  brand_display_name: string;
  directory_id: string;
  matched_canonical_name: string;
  created: boolean;
  similarity: number;
  match_via: DirectoryMatchResult['matchVia'];
}

export interface ProductDirectoryStats {
  /** Total upload rows we resolved to a canonical product. */
  resolved: number;
  /** How many of those resolutions hit an existing product_directory row. */
  matched_existing: number;
  /** How many of those resolutions created a new product_directory row. */
  created_new: number;
}

export interface ProcessResult {
  brand_count: number;
  sku_count: number;
  brand_profile_ids: string[];
  errors: string[];
  /**
   * Per-brand summary of how each brand resolved against the canonical
   * directory. Used by the upload wizard's completion screen to show
   * "linked to existing directory entry" vs "created new" so the
   * distributor sees the directory's value at upload time.
   */
  directory_matches: DirectoryMatchSummary[];
  /**
   * Roll-up of how the upload's SKUs resolved against the canonical
   * product_directory. Surfaced on the confirm screen as "X of N
   * products matched existing canonical records".
   */
  product_directory_stats: ProductDirectoryStats;
}

export type ImportProgressPhase =
  | 'detecting_brands'
  | 'matching_brands'
  | 'saving_brands'
  | 'matching_products'
  | 'saving_skus';

interface ProcessArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  skuListId: string;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  /**
   * Progress reporter, called from inside the heavy serial loops so the
   * upload wizard can render a real progress bar instead of a spinner.
   * Best-effort: throttling/persistence is the caller's concern.
   */
  onProgress?: (phase: ImportProgressPhase, current: number, total: number) => Promise<void> | void;
}

/**
 * Group the parsed rows into brand_profiles + brand_skus and persist them.
 *
 * - For each row, normalise the brand name and upsert into brand_profiles
 *   on (distributor_org_id, normalized_name).
 * - Insert one brand_skus row per parsed row, linked to the resolved
 *   brand_profile and the originating sku_list.
 *
 * Rows with no brand name or product name are skipped and reported as errors.
 *
 * The caller is expected to use a service-role client so RLS does not block
 * cross-row reads while upserting.
 */
export async function processSkuList(args: ProcessArgs): Promise<ProcessResult> {
  const { supabase, distributorOrgId, skuListId, rows, mapping, onProgress } = args;
  const errors: string[] = [];

  // brand_name is optional on the type (AI mode supplies a synthetic column),
  // but by the time we run it is always resolved to a concrete column.
  const brandCol = mapping.brand_name;
  if (!brandCol) {
    return {
      brand_count: 0,
      sku_count: 0,
      brand_profile_ids: [],
      errors: ['No brand column resolved for this import'],
      directory_matches: [],
      product_directory_stats: { resolved: 0, matched_existing: 0, created_new: 0 },
    };
  }

  // Bucket parsed rows by normalised brand name so we issue one brand-profile
  // upsert per unique brand, not per row.
  const brandToRows = new Map<
    string,
    {
      displayName: string;
      category: string | null;
      country: string | null;
      website: string | null;
      rows: typeof rows;
    }
  >();

  rows.forEach((row, index) => {
    const brandName = (row[brandCol] ?? '').trim();
    const productName = (row[mapping.product_name] ?? '').trim();
    if (!brandName) {
      errors.push(`Row ${index + 2}: missing brand name`);
      return;
    }
    if (!productName) {
      errors.push(`Row ${index + 2}: missing product name`);
      return;
    }
    const normalized = normalizeBrandName(brandName);
    if (!normalized) {
      errors.push(`Row ${index + 2}: brand name "${brandName}" normalised to empty string`);
      return;
    }
    const bucket = brandToRows.get(normalized) ?? {
      displayName: brandName,
      category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
      country: mapping.country_of_origin ? (row[mapping.country_of_origin] ?? '').trim() || null : null,
      website: mapping.website ? (row[mapping.website] ?? '').trim() || null : null,
      rows: [] as typeof rows,
    };
    // Promote the first non-empty website we see for this brand.
    if (!bucket.website && mapping.website) {
      const v = (row[mapping.website] ?? '').trim();
      if (v) bucket.website = v;
    }
    bucket.rows.push(row);
    brandToRows.set(normalized, bucket);
  });

  // First, resolve every unique brand in the upload against the
  // canonical brand_directory. Auto-links to existing entries above the
  // similarity threshold (so a second distributor uploading the same
  // brand doesn't create a duplicate canonical record). New brands mint
  // fresh directory entries. This is the heart of "answer once, share
  // with every distributor" — every listing now anchors to a shared
  // brand record.
  const brandsToResolve = Array.from(brandToRows.entries()).map(([normalized, bucket]) => ({
    displayName: bucket.displayName,
    normalizedName: normalized,
    category: bucket.category,
    countryOfOrigin: bucket.country,
    website: bucket.website,
  }));

  let directoryMatches: Map<string, DirectoryMatchResult>;
  try {
    directoryMatches = await resolveBrandsToDirectory(
      supabase,
      brandsToResolve,
      distributorOrgId,
      (current, total) => onProgress?.('matching_brands', current, total),
    );
  } catch (err) {
    errors.push(`Directory matching failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      brand_count: 0,
      sku_count: 0,
      brand_profile_ids: [],
      errors,
      directory_matches: [],
      product_directory_stats: { resolved: 0, matched_existing: 0, created_new: 0 },
    };
  }

  const directoryMatchSummaries: DirectoryMatchSummary[] = [];
  const profileIdByNormalized = new Map<string, string>();

  await onProgress?.('saving_brands', 0, brandToRows.size);

  // Collapse buckets onto their resolved directory entry. Several spellings
  // can map to the same canonical brand, and brand_profiles is unique on
  // (distributor_org_id, brand_directory_id), so we persist ONE row per
  // directory id. Keep the first spelling's display fields for that row, but
  // remember every normalised name that points at it so SKUs key correctly.
  type BrandUpsert = {
    distributor_org_id: string;
    brand_directory_id: string;
    name: string;
    normalized_name: string;
    category: string | null;
    country_of_origin: string | null;
  };
  const upsertByDir = new Map<string, BrandUpsert>();
  const websiteByDir = new Map<string, string | null>();
  const normalizedByDir = new Map<string, string[]>();

  for (const [normalized, bucket] of Array.from(brandToRows.entries())) {
    const match = directoryMatches.get(normalized);
    if (!match) {
      errors.push(`Brand "${bucket.displayName}": no directory match resolved`);
      continue;
    }
    directoryMatchSummaries.push({
      brand_display_name: bucket.displayName,
      directory_id: match.directoryId,
      matched_canonical_name: match.canonicalName,
      created: match.created,
      similarity: match.similarity,
      match_via: match.matchVia,
    });
    const existingList = normalizedByDir.get(match.directoryId);
    if (existingList) existingList.push(normalized);
    else normalizedByDir.set(match.directoryId, [normalized]);
    if (!upsertByDir.has(match.directoryId)) {
      upsertByDir.set(match.directoryId, {
        distributor_org_id: distributorOrgId,
        brand_directory_id: match.directoryId,
        name: bucket.displayName,
        normalized_name: normalized,
        category: bucket.category,
        country_of_origin: bucket.country,
      });
      websiteByDir.set(match.directoryId, bucket.website ? normaliseWebsite(bucket.website) : null);
    }
  }

  const dirIds = Array.from(upsertByDir.keys());
  if (dirIds.length > 0) {
    // One round-trip to learn which listings already exist (and their
    // curated websites) instead of a SELECT per brand.
    const existingByDir = new Map<string, { id: string; website: string | null }>();
    const { data: existingRows } = await supabase
      .from('brand_profiles')
      .select('id, brand_directory_id, website')
      .eq('distributor_org_id', distributorOrgId)
      .in('brand_directory_id', dirIds);
    for (const r of (existingRows ?? []) as Array<{ id: string; brand_directory_id: string; website: string | null }>) {
      existingByDir.set(r.brand_directory_id, { id: r.id, website: r.website });
    }

    // Never overwrite a curated website with a CSV value: keep the existing
    // one when present, otherwise seed from the upload.
    const payload = dirIds.map((dirId) => ({
      ...upsertByDir.get(dirId)!,
      website: existingByDir.get(dirId)?.website ?? websiteByDir.get(dirId) ?? null,
    }));

    // One bulk upsert keyed on the Phase-4 unique constraint, replacing the
    // per-brand insert/update (~1-2k round-trips on a real catalogue).
    const { data: upserted, error: upsertError } = await supabase
      .from('brand_profiles')
      .upsert(payload, { onConflict: 'distributor_org_id,brand_directory_id' })
      .select('id, brand_directory_id');
    if (upsertError) {
      errors.push(`Saving brand profiles: ${upsertError.message}`);
    }
    for (const r of (upserted ?? []) as Array<{ id: string; brand_directory_id: string }>) {
      for (const normalized of normalizedByDir.get(r.brand_directory_id) ?? []) {
        profileIdByNormalized.set(normalized, r.id);
      }
    }
  }

  await onProgress?.('saving_brands', brandToRows.size, brandToRows.size);

  // Resolve every upload row against the canonical product_directory
  // before we insert SKUs. GTIN takes precedence over name. This is
  // the product-level mirror of the brand-directory dedup above —
  // multiple distributors uploading the same SKU collapse onto a
  // single canonical product, so embodied-carbon and other per-SKU
  // findings (Phase 7) accumulate against one record.
  type RowWithMeta = {
    normalized: string;
    profileId: string;
    bucketWebsite: string | null;
    raw: (typeof rows)[number];
    productInput: {
      brandDirectoryId: string;
      displayName: string;
      gtin: string | null;
      category: string | null;
      countryOfOrigin: string | null;
    };
  };
  const rowsWithMeta: RowWithMeta[] = [];
  for (const [normalized, bucket] of Array.from(brandToRows.entries())) {
    const profileId = profileIdByNormalized.get(normalized);
    const dirMatch = directoryMatches.get(normalized);
    if (!profileId || !dirMatch) continue;
    for (const row of bucket.rows) {
      const productName = (row[mapping.product_name] ?? '').trim();
      const gtin = normalizeGtin(
        mapping.gtin ? (row[mapping.gtin] ?? '').trim() : null,
      );
      if (!productName && !gtin) continue;
      rowsWithMeta.push({
        normalized,
        profileId,
        bucketWebsite: bucket.website,
        raw: row,
        productInput: {
          brandDirectoryId: dirMatch.directoryId,
          displayName: productName,
          gtin,
          category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
          countryOfOrigin: mapping.country_of_origin
            ? (row[mapping.country_of_origin] ?? '').trim() || null
            : null,
        },
      });
    }
  }

  let productMatches: Map<string, ProductMatchResult>;
  try {
    productMatches = await resolveProductsToDirectory(
      supabase,
      rowsWithMeta.map((r) => r.productInput),
      distributorOrgId,
      (current, total) => onProgress?.('matching_products', current, total),
    );
  } catch (err) {
    errors.push(
      `Product directory matching failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    productMatches = new Map();
  }

  let productMatchedExisting = 0;
  let productCreatedNew = 0;
  for (const result of Array.from(productMatches.values())) {
    if (result.created) productCreatedNew += 1;
    else productMatchedExisting += 1;
  }

  // Build the SKU insert payload from every successfully bucketed row.
  type SkuInsert = {
    brand_profile_id: string;
    product_directory_id: string | null;
    distributor_org_id: string;
    sku_list_id: string;
    sku_code: string | null;
    gtin: string | null;
    product_name: string;
    category: string | null;
    country_of_origin: string | null;
    listing_status: 'active' | 'delisted';
  };

  const skuInserts: SkuInsert[] = [];
  for (const meta of rowsWithMeta) {
    const { raw: row, productInput } = meta;
    const listingValue = mapping.listing_status
      ? (row[mapping.listing_status] ?? '').trim().toLowerCase()
      : '';
    const listing: 'active' | 'delisted' =
      listingValue === 'delisted' || listingValue === 'inactive' ? 'delisted' : 'active';
    const matchResult = productMatches.get(
      productMatchKey(
        productInput.brandDirectoryId,
        productInput.displayName,
        productInput.gtin,
      ),
    );
    skuInserts.push({
      brand_profile_id: meta.profileId,
      product_directory_id: matchResult?.productDirectoryId ?? null,
      distributor_org_id: distributorOrgId,
      sku_list_id: skuListId,
      sku_code: mapping.sku_code ? (row[mapping.sku_code] ?? '').trim() || null : null,
      gtin: productInput.gtin,
      product_name: productInput.displayName,
      category: productInput.category,
      country_of_origin: productInput.countryOfOrigin,
      listing_status: listing,
    });
  }

  if (skuInserts.length > 0) {
    await onProgress?.('saving_skus', 0, skuInserts.length);
    const { error: skuError } = await supabase.from('brand_skus').insert(skuInserts);
    if (skuError) {
      errors.push(`Inserting SKUs: ${skuError.message}`);
    }
    await onProgress?.('saving_skus', skuInserts.length, skuInserts.length);
  }

  return {
    brand_count: profileIdByNormalized.size,
    sku_count: skuInserts.length,
    brand_profile_ids: Array.from(profileIdByNormalized.values()),
    errors,
    directory_matches: directoryMatchSummaries,
    product_directory_stats: {
      resolved: productMatchedExisting + productCreatedNew,
      matched_existing: productMatchedExisting,
      created_new: productCreatedNew,
    },
  };
}

/**
 * Take a user-supplied website value from the SKU upload and turn it
 * into a canonical https:// URL. Returns null when the input doesn't
 * look like a real URL — we'd rather leave the field empty than poison
 * the scraper with garbage.
 */
function normaliseWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return null;
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}
