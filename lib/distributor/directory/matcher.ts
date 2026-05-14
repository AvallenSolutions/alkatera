import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBrandName } from '../brand-normalizer';

export interface DirectoryMatchInput {
  /** User-facing display name as it appeared in the upload. */
  displayName: string;
  /** Optional attributes — used only when we create a fresh directory entry. */
  category?: string | null;
  countryOfOrigin?: string | null;
  website?: string | null;
}

export type DirectoryMatchVia = 'exact_name' | 'alias' | 'fuzzy' | 'created';

export interface DirectoryMatchResult {
  /** brand_directory.id we resolved to. */
  directoryId: string;
  /** Whether we created a new directory entry or linked to an existing one. */
  created: boolean;
  /** Match confidence (0..1). 1.0 for exact / alias matches; >=0.85 for fuzzy auto-links; 1.0 for fresh entries. */
  similarity: number;
  /** How we matched. */
  matchVia: DirectoryMatchVia;
  /** The directory entry's canonical name. */
  canonicalName: string;
}

/**
 * Anything at or above this similarity is auto-linked to the existing
 * directory entry without manual confirmation. pg_trgm similarity 0.85
 * catches obvious variants like "Avallen Spirits" vs "Avallen Spirits
 * Ltd" while keeping false-positive risk low.
 */
export const AUTO_LINK_THRESHOLD = 0.85;

/**
 * Find the best `brand_directory` match for a brand name. Returns null
 * if nothing crosses the auto-link threshold.
 *
 * Calls the `match_brand_directory` SECURITY DEFINER RPC (added in
 * migration 20262606800000) so the pg_trgm similarity work happens
 * server-side.
 */
export async function findDirectoryMatch(
  supabase: SupabaseClient,
  displayName: string,
  threshold: number = AUTO_LINK_THRESHOLD,
): Promise<{
  directoryId: string;
  canonicalName: string;
  similarity: number;
  matchVia: 'exact_name' | 'alias' | 'fuzzy';
} | null> {
  const normalized = normalizeBrandName(displayName);
  if (!normalized) return null;

  const { data, error } = await supabase.rpc('match_brand_directory', {
    query_name: displayName,
    similarity_threshold: threshold,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;

  type Row = {
    id: string;
    name: string;
    normalized_name: string;
    similarity: number;
    match_via: 'exact_name' | 'alias' | 'fuzzy';
  };
  const top = (data as Row[])[0];
  if (!top || top.similarity < threshold) return null;

  return {
    directoryId: top.id,
    canonicalName: top.name,
    similarity: top.similarity,
    matchVia: top.match_via,
  };
}

/**
 * Resolve a brand to a `brand_directory` entry, creating one if no
 * auto-link match exists.
 *
 * Requires a service-role client to insert into brand_directory.
 */
export async function resolveOrCreateDirectoryEntry(
  supabase: SupabaseClient,
  input: DirectoryMatchInput & { discoveredByDistributorOrgId?: string | null },
): Promise<DirectoryMatchResult> {
  const normalized = normalizeBrandName(input.displayName);
  if (!normalized) {
    throw new Error(`Brand name "${input.displayName}" normalises to an empty string`);
  }

  const match = await findDirectoryMatch(supabase, input.displayName);
  if (match) {
    return {
      directoryId: match.directoryId,
      created: false,
      similarity: match.similarity,
      matchVia: match.matchVia,
      canonicalName: match.canonicalName,
    };
  }

  const { data, error } = await supabase
    .from('brand_directory')
    .insert({
      name: input.displayName,
      normalized_name: normalized,
      website: input.website ?? null,
      category: input.category ?? null,
      country_of_origin: input.countryOfOrigin ?? null,
      discovered_via: 'sku_upload',
      discovered_by_distributor_org_id: input.discoveredByDistributorOrgId ?? null,
    })
    .select('id, name')
    .single();
  if (error || !data) {
    throw new Error(
      `Could not create directory entry for "${input.displayName}": ${error?.message ?? 'no row returned'}`,
    );
  }

  return {
    directoryId: (data as { id: string }).id,
    created: true,
    similarity: 1.0,
    matchVia: 'created',
    canonicalName: (data as { name: string }).name,
  };
}

/**
 * Bulk-resolve a list of brands to directory entries. Used by the SKU
 * upload processor so we do one resolution per unique brand, not per row.
 *
 * Returns a map keyed by normalised brand name. Two rows with the same
 * normalised name resolve to the same directory entry — that's exactly
 * the point of the directory.
 */
export async function resolveBrandsToDirectory(
  supabase: SupabaseClient,
  brands: Array<DirectoryMatchInput & { normalizedName: string }>,
  discoveredByDistributorOrgId: string,
): Promise<Map<string, DirectoryMatchResult>> {
  const resolved = new Map<string, DirectoryMatchResult>();
  const seen = new Set<string>();
  for (const brand of brands) {
    if (seen.has(brand.normalizedName)) continue;
    seen.add(brand.normalizedName);
    const result = await resolveOrCreateDirectoryEntry(supabase, {
      ...brand,
      discoveredByDistributorOrgId,
    });
    resolved.set(brand.normalizedName, result);
  }
  return resolved;
}
