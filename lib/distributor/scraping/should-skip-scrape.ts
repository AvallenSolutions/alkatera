import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SCRAPE_GATE_COMPLETENESS_THRESHOLD,
  SCRAPE_GATE_FRESHNESS_DAYS,
} from './config';

export type SkipReason =
  | 'ok'                  // gate would skip — data is comprehensive + fresh
  | 'completeness_low'    // data isn't comprehensive enough, run the scrape
  | 'data_stale'          // some data exists but the freshest finding is too old
  | 'no_data'             // nothing at all in scraped_brand_data for this directory
  | 'no_directory';       // brand_profile not linked to a directory entry (defensive)

export interface SkipScrapeDecision {
  skip: boolean;
  reason: SkipReason;
  completenessScore: number | null;
  lastFindingAt: string | null;
}

/**
 * Decide whether the canonical directory already holds enough recent
 * data on this brand to skip an open-web scrape. Both signals are
 * required:
 *
 *   - brand_directory.completeness_score >= SCRAPE_GATE_COMPLETENESS_THRESHOLD
 *   - at least one non-superseded scraped_brand_data row whose
 *     scraped_at is within SCRAPE_GATE_FRESHNESS_DAYS
 *
 * Manual "Refresh data" requests bypass this check by not invoking the
 * gate (see queueBrandsForScraping's forceScrape option).
 */
export async function shouldSkipScrape(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<SkipScrapeDecision> {
  // Resolve the brand_profile -> brand_directory_id to read directory-
  // scoped signals (completeness + findings live on the directory
  // since Phase 3 re-key).
  const { data: profile } = await supabase
    .from('brand_profiles')
    .select('brand_directory_id')
    .eq('id', brandProfileId)
    .maybeSingle();
  const directoryId = (profile as { brand_directory_id: string | null } | null)
    ?.brand_directory_id;
  if (!directoryId) {
    return {
      skip: false,
      reason: 'no_directory',
      completenessScore: null,
      lastFindingAt: null,
    };
  }

  const { data: directoryRow } = await supabase
    .from('brand_directory')
    .select('completeness_score')
    .eq('id', directoryId)
    .maybeSingle();
  const completenessScore =
    (directoryRow as { completeness_score: number | null } | null)
      ?.completeness_score ?? null;

  const { data: freshestRows } = await supabase
    .from('scraped_brand_data')
    .select('scraped_at')
    .eq('brand_directory_id', directoryId)
    .is('superseded_by', null)
    .order('scraped_at', { ascending: false })
    .limit(1);
  const lastFindingAt =
    (freshestRows as Array<{ scraped_at: string | null }> | null)?.[0]
      ?.scraped_at ?? null;

  if (lastFindingAt == null) {
    return {
      skip: false,
      reason: 'no_data',
      completenessScore,
      lastFindingAt: null,
    };
  }

  if (
    completenessScore == null ||
    completenessScore < SCRAPE_GATE_COMPLETENESS_THRESHOLD
  ) {
    return {
      skip: false,
      reason: 'completeness_low',
      completenessScore,
      lastFindingAt,
    };
  }

  const cutoff = Date.now() - SCRAPE_GATE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
  if (new Date(lastFindingAt).getTime() < cutoff) {
    return {
      skip: false,
      reason: 'data_stale',
      completenessScore,
      lastFindingAt,
    };
  }

  return {
    skip: true,
    reason: 'ok',
    completenessScore,
    lastFindingAt,
  };
}
