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

export interface QueueDirectoryBrandsArgs {
  supabase: SupabaseClient;
  brandDirectoryIds: string[];
  triggeredBy: 'admin_intake' | 'auto' | 'manual';
}

export interface QueueDirectoryBrandsResult {
  queued: number;
  skipped_already_queued: number;
  skipped_no_website: number;
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

/**
 * Enqueue scrape jobs against brand_directory entries directly. Used by
 * the admin intake flow: when a new directory entry is created (no
 * distributor listing yet) we want the brand-website source to run so
 * the review queue has rich data before an admin verifies. Entries with
 * no website on file are skipped — there's nothing for the scraper to
 * fetch. Entries already queued or running are skipped so retries don't
 * fan out duplicate jobs.
 */
export async function queueDirectoryBrandsForScraping(
  args: QueueDirectoryBrandsArgs,
): Promise<QueueDirectoryBrandsResult> {
  const { supabase, brandDirectoryIds, triggeredBy } = args;

  if (brandDirectoryIds.length === 0) {
    return { queued: 0, skipped_already_queued: 0, skipped_no_website: 0 };
  }

  // Pull website to filter out entries the brand-website scraper can't
  // do anything with. Other sources (Wikipedia, B Corp Directory) work
  // off the name alone, but in practice they're noisy without a website
  // anchor and we don't want to burn cron cycles on dead-end fetches.
  const { data: rows } = await supabase
    .from('brand_directory')
    .select('id, website')
    .in('id', brandDirectoryIds);
  type Row = { id: string; website: string | null };
  const withWebsite = ((rows ?? []) as Row[]).filter((r) => !!r.website?.trim());
  const skippedNoWebsite = brandDirectoryIds.length - withWebsite.length;

  if (withWebsite.length === 0) {
    return {
      queued: 0,
      skipped_already_queued: 0,
      skipped_no_website: skippedNoWebsite,
    };
  }

  const candidateIds = withWebsite.map((r) => r.id);
  const { data: alreadyRunning } = await supabase
    .from('scraping_jobs')
    .select('brand_directory_id')
    .in('brand_directory_id', candidateIds)
    .in('status', ['queued', 'running']);
  const locked = new Set(
    (alreadyRunning ?? [])
      .map((r: { brand_directory_id: string | null }) => r.brand_directory_id)
      .filter((id): id is string => !!id),
  );

  const toInsert = candidateIds
    .filter((id) => !locked.has(id))
    .map((id) => ({
      brand_directory_id: id,
      brand_profile_id: null,
      distributor_org_id: null,
      triggered_by: triggeredBy,
      status: 'queued' as const,
    }));

  if (toInsert.length === 0) {
    return {
      queued: 0,
      skipped_already_queued: locked.size,
      skipped_no_website: skippedNoWebsite,
    };
  }

  const { error } = await supabase.from('scraping_jobs').insert(toInsert);
  if (error) {
    throw new Error(`queue_directory_brands_failed: ${error.message}`);
  }
  return {
    queued: toInsert.length,
    skipped_already_queued: locked.size,
    skipped_no_website: skippedNoWebsite,
  };
}
