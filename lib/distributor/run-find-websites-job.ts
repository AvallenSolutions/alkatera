import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findBrandWebsites, type BrandWebsiteInput } from '@/lib/distributor/website-finder';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';

/**
 * Core worker for the distributor "find brand websites" backfill — ported
 * from `netlify/functions/find-websites-background.ts` onto Inngest
 * (`lib/inngest/functions/distributor-jobs.ts`, event
 * `distributor/find-websites.run`). A single Gemini grounded-search call
 * reliably takes 40-60s, past a synchronous route's ceiling.
 *
 * Finds official websites for the org's website-less brands, saves them,
 * and queues a forced scrape for each one located. Progress/outcome is
 * written onto the `distributor_backfill_runs` row the route created; the
 * portal polls `GET /api/distributor/brands/find-websites?run_id=...`.
 */
export async function runFindWebsitesJob(params: {
  supabase: SupabaseClient;
  distributorOrgId: string;
  brandProfileId: string | null;
  runId: string | null;
}): Promise<void> {
  const { supabase, distributorOrgId, brandProfileId, runId } = params;

  const finishRun = async (fields: Record<string, unknown>) => {
    if (!runId) return;
    await supabase
      .from('distributor_backfill_runs')
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq('id', runId);
  };
  const geminiConfigured = !!process.env.GEMINI_API_KEY;

  // Load the brands still missing a website (or the one requested).
  let query = supabase
    .from('brand_profiles')
    .select('id, name, country_of_origin')
    .eq('distributor_org_id', distributorOrgId)
    .eq('listing_status', 'active')
    .is('website', null)
    .order('id', { ascending: true });
  if (brandProfileId) query = query.eq('id', brandProfileId);

  const { data: rows, error: loadErr } = await query;
  if (loadErr) {
    console.error('[distributor/find-websites] load failed:', loadErr.message);
    await finishRun({ status: 'error', message: `load_failed: ${loadErr.message}`, gemini_configured: geminiConfigured });
    return;
  }
  const candidates = (rows ?? []) as Array<BrandWebsiteInput & { id: string }>;
  if (candidates.length === 0) {
    console.log('[distributor/find-websites] nothing to do', { org: distributorOrgId });
    await finishRun({ status: 'done', message: 'nothing-to-do', gemini_configured: geminiConfigured });
    return;
  }

  console.log('[distributor/find-websites] start', { org: distributorOrgId, total: candidates.length });

  const result = await findBrandWebsites(candidates, {
    onProgress: async (done, total, found) => {
      console.log(`[distributor/find-websites] looked up ${done}/${total}, ${found} found`);
      // Write live progress onto the run row so the portal shows movement
      // instead of sitting at 0 for the whole run.
      if (runId) {
        await supabase
          .from('distributor_backfill_runs')
          .update({ found })
          .eq('id', runId);
      }
    },
  });
  const updates = Array.from(result.found.entries());

  // Persist discovered websites, scoped to this org and only where still null.
  let saved = 0;
  for (const [id, website] of updates) {
    const { error: updErr } = await supabase
      .from('brand_profiles')
      .update({ website })
      .eq('id', id)
      .eq('distributor_org_id', distributorOrgId)
      .is('website', null);
    if (!updErr) saved += 1;
  }

  // Queue a fresh, forced scrape for every brand we just gave a website.
  let queued = 0;
  if (updates.length > 0) {
    try {
      const queueResult = await queueBrandsForScraping({
        supabase,
        distributorOrgId,
        brandProfileIds: updates.map(([id]) => id),
        triggeredBy: 'manual',
        forceScrape: true,
      });
      queued = queueResult.queued;
    } catch (err) {
      console.error('[distributor/find-websites] queue failed:', err instanceof Error ? err.message : err);
    }
  }

  console.log('[distributor/find-websites] done', {
    org: distributorOrgId,
    attempted: result.attempted,
    found: saved,
    queued,
    errors: result.errors,
  });
  await finishRun({
    status: 'done',
    total: result.attempted,
    found: saved,
    queued,
    gemini_configured: geminiConfigured,
    errors: result.errors,
    samples: result.samples,
  });
}
