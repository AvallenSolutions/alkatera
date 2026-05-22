import type { SupabaseClient } from '@supabase/supabase-js';
import { shouldSkipScrape, type SkipScrapeDecision } from './should-skip-scrape';

export interface QueueBrandsArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  brandProfileIds?: string[];
  triggeredBy: 'auto' | 'manual' | 'sku_import';
  /**
   * Bypass the directory-first scrape gate. Set true for the manual
   * "Refresh data" button so distributors can demand a re-scrape even
   * when the canonical directory looks comprehensive.
   */
  forceScrape?: boolean;
}

export interface QueueBrandsResult {
  queued: number;
  skipped_already_queued: number;
  /** Brands skipped because the canonical directory already has comprehensive, fresh data. */
  skipped_directory_hit: number;
  /** Per-brand skip detail (sampled, max 50) for logs + the upload wizard summary. */
  skip_details: Array<{
    brand_profile_id: string;
    reason: SkipScrapeDecision['reason'];
    completeness_score: number | null;
  }>;
}

/**
 * Insert scraping_jobs rows for a set of brand profiles. Used by:
 *   - the Phase 1 SKU import confirm route (triggered_by='sku_import')
 *   - the /api/distributor/scraping/trigger route (triggered_by='manual')
 *   - the monthly refresh cron (triggered_by='auto')
 *
 * Brands that already have a 'queued' or 'running' job are skipped — we
 * don't want to fan out 5 jobs for the same brand if the user spams the
 * manual trigger.
 *
 * Phase 3 of the proactive-data programme adds a second skip path: if
 * the canonical brand_directory entry already has comprehensive
 * (completeness ≥ threshold) and fresh (≤ N days old) data, the scrape
 * is skipped. `forceScrape: true` bypasses this gate for manual
 * "Refresh data" requests.
 */
export async function queueBrandsForScraping(args: QueueBrandsArgs): Promise<QueueBrandsResult> {
  const { supabase, distributorOrgId, brandProfileIds, triggeredBy, forceScrape } = args;

  let targetIds = brandProfileIds;
  if (!targetIds || targetIds.length === 0) {
    const { data } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('distributor_org_id', distributorOrgId);
    targetIds = (data ?? []).map((row: { id: string }) => row.id);
  }
  if (targetIds.length === 0) {
    return {
      queued: 0,
      skipped_already_queued: 0,
      skipped_directory_hit: 0,
      skip_details: [],
    };
  }

  // Find brands that are already mid-flight so we don't double-queue.
  const { data: alreadyRunning } = await supabase
    .from('scraping_jobs')
    .select('brand_profile_id')
    .in('brand_profile_id', targetIds)
    .in('status', ['queued', 'running']);
  const lockedSet = new Set((alreadyRunning ?? []).map((r: { brand_profile_id: string }) => r.brand_profile_id));

  // Apply the directory-first gate (unless forceScrape).
  const gatePassed: string[] = [];
  const skipDetails: QueueBrandsResult['skip_details'] = [];
  for (const id of targetIds) {
    if (lockedSet.has(id)) continue;
    if (forceScrape) {
      gatePassed.push(id);
      continue;
    }
    const decision = await shouldSkipScrape(supabase, id);
    if (decision.skip) {
      if (skipDetails.length < 50) {
        skipDetails.push({
          brand_profile_id: id,
          reason: decision.reason,
          completeness_score: decision.completenessScore,
        });
      }
    } else {
      gatePassed.push(id);
    }
  }

  const skippedDirectoryHit =
    targetIds.length - lockedSet.size - gatePassed.length;

  const toInsert = gatePassed.map((id) => ({
    brand_profile_id: id,
    distributor_org_id: distributorOrgId,
    triggered_by: triggeredBy,
    status: 'queued' as const,
  }));

  if (toInsert.length === 0) {
    return {
      queued: 0,
      skipped_already_queued: lockedSet.size,
      skipped_directory_hit: skippedDirectoryHit,
      skip_details: skipDetails,
    };
  }

  const { error } = await supabase.from('scraping_jobs').insert(toInsert);
  if (error) {
    throw new Error(`queue_brands_failed: ${error.message}`);
  }
  return {
    queued: toInsert.length,
    skipped_already_queued: lockedSet.size,
    skipped_directory_hit: skippedDirectoryHit,
    skip_details: skipDetails,
  };
}
