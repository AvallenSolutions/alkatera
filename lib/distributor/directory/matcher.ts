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

export type DirectoryMatchVia =
  | 'exact_name'
  | 'alias'
  | 'fuzzy'
  | 'created'
  | 'alkatera_org';

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
  /** True when we resolved by matching against the alka**tera** organizations table (and not via the directory's own rows). Useful so the admin UI can call out the rescue. */
  alkateraLinked?: boolean;
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
 * Find an alka**tera** organization whose name fuzzy-matches the
 * candidate brand. Used as a fallback when findDirectoryMatch returns
 * null — it catches brands the LLM names slightly differently than the
 * legal entity stored in the organizations table (e.g. brand "Warner's
 * Distillery" vs org "Warner Edwards Distillery Ltd").
 */
export async function findAlkateraOrgMatch(
  supabase: SupabaseClient,
  displayName: string,
  threshold: number = AUTO_LINK_THRESHOLD,
): Promise<{ orgId: string; orgName: string; similarity: number } | null> {
  const normalized = normalizeBrandName(displayName);
  if (!normalized) return null;
  const { data, error } = await supabase.rpc('match_alkatera_org', {
    query_name: displayName,
    similarity_threshold: threshold,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  type Row = { id: string; name: string; similarity: number };
  const top = (data as Row[])[0];
  if (!top || top.similarity < threshold) return null;
  return { orgId: top.id, orgName: top.name, similarity: top.similarity };
}

/**
 * Resolve a brand to a `brand_directory` entry, creating one if no
 * auto-link match exists.
 *
 * Match precedence:
 *   1. brand_directory exact / alias / fuzzy match (match_brand_directory)
 *   2. alka**tera** organizations fuzzy match (match_alkatera_org). If we
 *      hit an org and a directory row already points at it, reuse that
 *      row; otherwise insert a new directory row with alkatera_org_id
 *      set — the verification gate auto-marks it 'verified'.
 *   3. No match → create a fresh entry.
 *
 * Requires a service-role client to insert into brand_directory.
 */
export async function resolveOrCreateDirectoryEntry(
  supabase: SupabaseClient,
  input: DirectoryMatchInput & {
    discoveredByDistributorOrgId?: string | null;
    /** Override the discovered_via stamp on fresh entries. Defaults
     *  to 'sku_upload' for the SKU import flow; admin bulk-upload
     *  passes 'manual'. */
    discoveredVia?: 'sku_upload' | 'alkatera_signup' | 'manual' | 'phase1_backfill';
  },
): Promise<DirectoryMatchResult> {
  const normalized = normalizeBrandName(input.displayName);
  if (!normalized) {
    throw new Error(`Brand name "${input.displayName}" normalises to an empty string`);
  }

  // Pass 1: directory match.
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

  // Pass 2: alka**tera** organizations match. Either reuse a directory
  // row already linked to this org, or mint a new directory row pointing
  // at the org (verification trigger will auto-verify it).
  const orgMatch = await findAlkateraOrgMatch(supabase, input.displayName);
  if (orgMatch) {
    const { data: existing } = await supabase
      .from('brand_directory')
      .select('id, name')
      .eq('alkatera_org_id', orgMatch.orgId)
      .maybeSingle();
    if (existing) {
      return {
        directoryId: (existing as { id: string }).id,
        created: false,
        similarity: orgMatch.similarity,
        matchVia: 'alkatera_org',
        canonicalName: (existing as { name: string }).name,
        alkateraLinked: true,
      };
    }
    // No existing directory row for this org (the trigger / backfill
    // missed it). Mint one — it auto-verifies via the directory-
    // verification migration trigger logic on insert.
    const { data: minted, error: mintErr } = await supabase
      .from('brand_directory')
      .insert({
        name: orgMatch.orgName,
        normalized_name: normalizeBrandName(orgMatch.orgName),
        website: input.website ?? null,
        category: input.category ?? null,
        country_of_origin: input.countryOfOrigin ?? null,
        alkatera_org_id: orgMatch.orgId,
        discovered_via: 'alkatera_signup',
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .select('id, name')
      .single();
    if (!mintErr && minted) {
      return {
        directoryId: (minted as { id: string }).id,
        created: true,
        similarity: orgMatch.similarity,
        matchVia: 'alkatera_org',
        canonicalName: (minted as { name: string }).name,
        alkateraLinked: true,
      };
    }
    // Fall through to a fresh create if the alkatera-linked insert
    // failed (e.g. uniqueness collision on alkatera_org_id — race with
    // the org-sync trigger). The matcher will catch it on the next pass.
  }

  // Pass 3: no match anywhere — create a fresh pending entry.
  const { data, error } = await supabase
    .from('brand_directory')
    .insert({
      name: input.displayName,
      normalized_name: normalized,
      website: input.website ?? null,
      category: input.category ?? null,
      country_of_origin: input.countryOfOrigin ?? null,
      discovered_via: input.discoveredVia ?? 'sku_upload',
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
