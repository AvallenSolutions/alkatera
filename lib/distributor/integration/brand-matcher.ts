import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBrandName } from '../brand-normalizer';

export type MatchMethod = 'auto_name' | 'auto_domain' | 'auto_fuzzy' | 'manual';

export interface MatchResult {
  org_id: string;
  org_name: string;
  method: MatchMethod;
  /** 0–1 confidence. >= 0.85 → auto-link; lower → suggest for manual review. */
  confidence: number;
}

export interface BrandForMatching {
  id: string;
  name: string;
  normalized_name: string;
  website: string | null;
}

const AUTO_LINK_THRESHOLD = 0.85;

export const MATCH_THRESHOLDS = {
  AUTO_LINK: AUTO_LINK_THRESHOLD,
};

/**
 * Find the best matching alkatera organization for a brand_profile.
 * Returns null if no match passes the minimum confidence floor.
 *
 * Strategy order (best to worst):
 *   1. Exact normalized-name match → confidence 0.95
 *   2. Website domain match (eTLD+1) → confidence 0.90
 *   3. pg_trgm fuzzy similarity ≥ 0.6 → confidence 0.5–0.8 (similarity * 0.8)
 *
 * Callers should treat confidence >= AUTO_LINK_THRESHOLD as auto-linkable
 * and everything below that as a *suggestion* requiring manual review.
 */
export async function findAlkateraOrgMatch(
  supabase: SupabaseClient,
  brand: BrandForMatching,
): Promise<MatchResult | null> {
  // Strategy 1: exact normalized-name match (case-insensitive). We
  // normalise the alkatera org's name on the fly using the same function
  // we use on the distributor side so legal suffixes ("Ltd", "SAS") and
  // accents don't trip us up.
  const { data: nameCandidates } = await supabase
    .from('organizations')
    .select('id, name, website')
    .ilike('name', `%${escapeIlike(brand.name.split(' ')[0] ?? brand.name)}%`)
    .limit(20);

  if (Array.isArray(nameCandidates)) {
    for (const candidate of nameCandidates as Array<{
      id: string;
      name: string;
      website: string | null;
    }>) {
      if (normalizeBrandName(candidate.name) === brand.normalized_name) {
        return {
          org_id: candidate.id,
          org_name: candidate.name,
          method: 'auto_name',
          confidence: 0.95,
        };
      }
    }
  }

  // Strategy 2: website domain.
  if (brand.website) {
    const domain = extractDomain(brand.website);
    if (domain) {
      const { data: domainMatch } = await supabase
        .from('organizations')
        .select('id, name, website')
        .ilike('website', `%${escapeIlike(domain)}%`)
        .limit(1)
        .maybeSingle();
      if (domainMatch) {
        return {
          org_id: (domainMatch as { id: string }).id,
          org_name: (domainMatch as { name: string }).name,
          method: 'auto_domain',
          confidence: 0.9,
        };
      }
    }
  }

  // Strategy 3: pg_trgm fuzzy. We feed in the normalized name so the
  // similarity isn't distorted by "Ltd"/"SAS"/etc.
  try {
    const { data: fuzzy } = await supabase.rpc('find_similar_organizations', {
      brand_name: brand.normalized_name,
      similarity_threshold: 0.6,
    });
    type FuzzyRow = { id: string; name: string; similarity: number };
    const rows = (fuzzy ?? []) as FuzzyRow[];
    if (rows.length > 0) {
      const top = rows[0];
      // Map [0.6, 1.0] similarity onto [0.48, 0.8] confidence so it
      // sits below the auto-link threshold by default.
      return {
        org_id: top.id,
        org_name: top.name,
        method: 'auto_fuzzy',
        confidence: round2(top.similarity * 0.8),
      };
    }
  } catch {
    // RPC not present (e.g. Phase 6 migration not applied) — degrade silently.
  }

  return null;
}

export function extractDomain(input: string): string | null {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
