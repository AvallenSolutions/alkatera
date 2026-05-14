import type { SupabaseClient } from '@supabase/supabase-js';

export interface QueueBrandsArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  brandProfileIds?: string[];
  triggeredBy: 'auto' | 'manual' | 'sku_import';
}

export interface QueueBrandsResult {
  queued: number;
  skipped_already_queued: number;
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
 */
export async function queueBrandsForScraping(args: QueueBrandsArgs): Promise<QueueBrandsResult> {
  const { supabase, distributorOrgId, brandProfileIds, triggeredBy } = args;

  let targetIds = brandProfileIds;
  if (!targetIds || targetIds.length === 0) {
    const { data } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('distributor_org_id', distributorOrgId);
    targetIds = (data ?? []).map((row: { id: string }) => row.id);
  }
  if (targetIds.length === 0) return { queued: 0, skipped_already_queued: 0 };

  // Find brands that are already mid-flight so we don't double-queue.
  const { data: alreadyRunning } = await supabase
    .from('scraping_jobs')
    .select('brand_profile_id')
    .in('brand_profile_id', targetIds)
    .in('status', ['queued', 'running']);
  const lockedSet = new Set((alreadyRunning ?? []).map((r: { brand_profile_id: string }) => r.brand_profile_id));

  const toInsert = targetIds
    .filter((id) => !lockedSet.has(id))
    .map((id) => ({
      brand_profile_id: id,
      distributor_org_id: distributorOrgId,
      triggered_by: triggeredBy,
      status: 'queued' as const,
    }));

  if (toInsert.length === 0) {
    return { queued: 0, skipped_already_queued: lockedSet.size };
  }

  const { error } = await supabase.from('scraping_jobs').insert(toInsert);
  if (error) {
    throw new Error(`queue_brands_failed: ${error.message}`);
  }
  return { queued: toInsert.length, skipped_already_queued: lockedSet.size };
}
