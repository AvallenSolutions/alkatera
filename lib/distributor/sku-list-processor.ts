import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBrandName } from './brand-normalizer';
import { resolveBrandsToDirectory, type DirectoryMatchResult } from './directory/matcher';
import type { ColumnMapping } from '@/types/distributor';

export interface DirectoryMatchSummary {
  brand_display_name: string;
  directory_id: string;
  matched_canonical_name: string;
  created: boolean;
  similarity: number;
  match_via: DirectoryMatchResult['matchVia'];
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
}

interface ProcessArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  skuListId: string;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
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
  const { supabase, distributorOrgId, skuListId, rows, mapping } = args;
  const errors: string[] = [];

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
    const brandName = (row[mapping.brand_name] ?? '').trim();
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
    );
  } catch (err) {
    errors.push(`Directory matching failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      brand_count: 0,
      sku_count: 0,
      brand_profile_ids: [],
      errors,
      directory_matches: [],
    };
  }

  const directoryMatchSummaries: DirectoryMatchSummary[] = [];
  const profileIdByNormalized = new Map<string, string>();

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

    // Phase 4: dedupe by (distributor_org_id, brand_directory_id) before
    // we touch brand_profiles. The directory matcher may have collapsed
    // a slightly-different spelling of this brand onto an existing
    // canonical entry — in which case we have to update the existing
    // listing rather than insert a fresh row, otherwise the unique
    // constraint added in migration 20262607000000 rejects us. Look
    // first, then branch.
    const { data: existing } = await supabase
      .from('brand_profiles')
      .select('id, website')
      .eq('distributor_org_id', distributorOrgId)
      .eq('brand_directory_id', match.directoryId)
      .maybeSingle();

    let row: { id: string; website: string | null } | null;
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('brand_profiles')
        .update({
          name: bucket.displayName,
          normalized_name: normalized,
          category: bucket.category,
          country_of_origin: bucket.country,
        })
        .eq('id', (existing as { id: string }).id)
        .select('id, website')
        .single();
      row = (updated as { id: string; website: string | null } | null) ?? null;
      if (updateError || !row) {
        errors.push(`Brand "${bucket.displayName}": ${updateError?.message ?? 'no row returned'}`);
        continue;
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('brand_profiles')
        .insert({
          distributor_org_id: distributorOrgId,
          brand_directory_id: match.directoryId,
          name: bucket.displayName,
          normalized_name: normalized,
          category: bucket.category,
          country_of_origin: bucket.country,
        })
        .select('id, website')
        .single();
      row = (inserted as { id: string; website: string | null } | null) ?? null;
      if (insertError || !row) {
        errors.push(`Brand "${bucket.displayName}": ${insertError?.message ?? 'no row returned'}`);
        continue;
      }
    }
    const data = row;
    profileIdByNormalized.set(normalized, data.id);

    // If the CSV/XLSX provided a website AND the existing brand_profile
    // row has none, seed it. Never overwrite a curated website with a
    // CSV value — the user may have edited it manually since the
    // previous import.
    if (bucket.website && !(data as { website: string | null }).website) {
      const normalisedWebsite = normaliseWebsite(bucket.website);
      if (normalisedWebsite) {
        await supabase
          .from('brand_profiles')
          .update({ website: normalisedWebsite })
          .eq('id', data.id)
          .is('website', null);
      }
    }
  }

  // Build the SKU insert payload from every successfully bucketed row.
  type SkuInsert = {
    brand_profile_id: string;
    distributor_org_id: string;
    sku_list_id: string;
    sku_code: string | null;
    product_name: string;
    category: string | null;
    country_of_origin: string | null;
    listing_status: 'active' | 'delisted';
  };

  const skuInserts: SkuInsert[] = [];
  for (const [normalized, bucket] of Array.from(brandToRows.entries())) {
    const profileId = profileIdByNormalized.get(normalized);
    if (!profileId) continue;
    for (const row of bucket.rows) {
      const listingValue = mapping.listing_status
        ? (row[mapping.listing_status] ?? '').trim().toLowerCase()
        : '';
      const listing: 'active' | 'delisted' =
        listingValue === 'delisted' || listingValue === 'inactive' ? 'delisted' : 'active';
      skuInserts.push({
        brand_profile_id: profileId,
        distributor_org_id: distributorOrgId,
        sku_list_id: skuListId,
        sku_code: mapping.sku_code ? (row[mapping.sku_code] ?? '').trim() || null : null,
        product_name: (row[mapping.product_name] ?? '').trim(),
        category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
        country_of_origin: mapping.country_of_origin
          ? (row[mapping.country_of_origin] ?? '').trim() || null
          : null,
        listing_status: listing,
      });
    }
  }

  if (skuInserts.length > 0) {
    const { error: skuError } = await supabase.from('brand_skus').insert(skuInserts);
    if (skuError) {
      errors.push(`Inserting SKUs: ${skuError.message}`);
    }
  }

  return {
    brand_count: profileIdByNormalized.size,
    sku_count: skuInserts.length,
    brand_profile_ids: Array.from(profileIdByNormalized.values()),
    errors,
    directory_matches: directoryMatchSummaries,
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
