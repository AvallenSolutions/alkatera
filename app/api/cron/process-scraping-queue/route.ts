import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { runBrandAgent } from '@/lib/distributor/scraping/brand-agent';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';

/**
 * Cron: distributor scraping queue processor
 *
 * POST /api/cron/process-scraping-queue
 *
 * Triggered every 5 minutes by netlify/functions/process-scraping-queue.ts.
 * Picks up to MAX_JOBS_PER_RUN queued jobs (oldest first), marks them
 * 'running', runs the brand-agent against each, then marks them
 * 'complete' or 'error'.
 *
 * Also runs the monthly-refresh sweep on the first invocation each day
 * (cheap idempotent query — re-queues brands that haven't been scraped
 * for 30+ days).
 *
 * Auth: CRON_SECRET Bearer (same pattern as the pulse-* cron routes).
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

// Sources for each brand now run concurrently (see brand-agent), so a single
// brand finishes in ~15-20s instead of ~40s. That lets us clear more jobs per
// 5-min tick within the 300s budget. With the cron also firing every 2 min,
// a ~460-brand catalogue scrapes in ~2h instead of ~13h.
const MAX_JOBS_PER_RUN = 8;

interface JobRow {
  id: string;
  brand_profile_id: string | null;
  distributor_org_id: string | null;
  brand_directory_id: string | null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  // 1. Monthly refresh sweep — re-queue brands not scraped in 30 days.
  //    Cheap to run on every tick because dispatcher dedupes against
  //    queued/running jobs already in flight.
  await sweepStaleBrands(supabase);

  // 2. Claim up to N queued jobs.
  const { data: claimed } = await supabase
    .from('scraping_jobs')
    .select('id, brand_profile_id, distributor_org_id, brand_directory_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ processed: 0, message: 'no_jobs_queued' });
  }

  const startedAt = new Date().toISOString();
  await supabase
    .from('scraping_jobs')
    .update({ status: 'running', started_at: startedAt })
    .in('id', (claimed as JobRow[]).map((j) => j.id));

  // 3. Run brand-agent against each job sequentially. Sequential is safe
  //    here because each job already sleeps 2s between sources; running
  //    them in parallel doesn't save much wall-clock and would blow our
  //    Anthropic rate budget.
  const summaries = [];
  for (const job of claimed as JobRow[]) {
    let result;
    let errorMessage: string | null = null;
    try {
      result = await runBrandAgent({
        supabase,
        brandProfileId: job.brand_profile_id ?? undefined,
        brandDirectoryId: job.brand_directory_id ?? undefined,
        jobId: job.id,
      });
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
      result = {
        sources_attempted: 0,
        sources_succeeded: 0,
        sources_skipped: 0,
        findings_written: 0,
        products_created: 0,
        products_linked: 0,
        documents_ingested: 0,
        documents_skipped: 0,
        errors: [errorMessage],
        skip_reasons: [] as string[],
      };
    }

    // Status rules:
    //   - Brand-agent threw outright → 'error'
    //   - Otherwise the job ran to completion. We only mark 'error' if
    //     real source errors were collected. "All sources skipped"
    //     (e.g. no website on file, Wikipedia 404) is 'complete' with
    //     0 findings — the skip reasons go into error_message so the
    //     user can see why.
    let finalStatus: 'complete' | 'error';
    if (errorMessage) finalStatus = 'error';
    else if (result.errors.length > 0 && result.sources_succeeded === 0) finalStatus = 'error';
    else finalStatus = 'complete';

    const messageLines: string[] = [];
    if (result.errors.length > 0) messageLines.push(...result.errors.slice(0, 5));
    if (result.skip_reasons.length > 0) messageLines.push(...result.skip_reasons.slice(0, 5));
    const trimmedMessage = messageLines.join('\n');

    await supabase
      .from('scraping_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        sources_attempted: result.sources_attempted,
        sources_succeeded: result.sources_succeeded,
        error_message: trimmedMessage || null,
      })
      .eq('id', job.id);

    // Bump the brand profile (listing-driven jobs) or directory entry
    // (admin-intake jobs) so the "last activity" column in the UI
    // reflects this scrape even if nothing was found.
    if (job.brand_profile_id) {
      await supabase
        .from('brand_profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', job.brand_profile_id);
    } else if (job.brand_directory_id) {
      await supabase
        .from('brand_directory')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', job.brand_directory_id);
    }

    summaries.push({
      job_id: job.id,
      brand_profile_id: job.brand_profile_id,
      brand_directory_id: job.brand_directory_id,
      status: finalStatus,
      sources_attempted: result.sources_attempted,
      sources_succeeded: result.sources_succeeded,
      sources_skipped: result.sources_skipped,
      findings_written: result.findings_written,
      products_created: result.products_created,
      products_linked: result.products_linked,
      documents_ingested: result.documents_ingested,
      documents_skipped: result.documents_skipped,
      errors: result.errors,
      skip_reasons: result.skip_reasons,
    });
  }

  return NextResponse.json({
    processed: summaries.length,
    jobs: summaries,
  });
}

async function sweepStaleBrands(supabase: SupabaseClient) {
  // We only want to fire the sweep occasionally — running it on every
  // tick would still be correct (the dispatcher dedupes) but adds a
  // query per tick for no benefit. Roll a coarse dice: ~10% chance per
  // 5-min tick ≈ a few times per hour.
  if (Math.random() > 0.1) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find brand profiles whose newest scraping_job (if any) is older than
  // 30 days, grouped by distributor org so the dispatcher can dedupe.
  const { data: stale } = await supabase
    .from('brand_profiles')
    .select('id, distributor_org_id, scraping_jobs!inner(created_at, status)')
    .order('created_at', { ascending: true })
    .limit(500);

  if (!stale) return;

  type StaleRow = {
    id: string;
    distributor_org_id: string;
    scraping_jobs: Array<{ created_at: string; status: string }>;
  };
  const grouped = new Map<string, string[]>();
  for (const row of stale as StaleRow[]) {
    const recent = row.scraping_jobs?.find(
      (j) => j.created_at > thirtyDaysAgo && ['queued', 'running', 'complete'].includes(j.status),
    );
    if (recent) continue;
    const ids = grouped.get(row.distributor_org_id) ?? [];
    ids.push(row.id);
    grouped.set(row.distributor_org_id, ids);
  }

  for (const [distributorOrgId, brandProfileIds] of Array.from(grouped.entries())) {
    try {
      await queueBrandsForScraping({
        supabase,
        distributorOrgId,
        brandProfileIds,
        triggeredBy: 'auto',
      });
    } catch {
      // sweep is best-effort — failures are logged via job rows when the
      // dispatcher returns. Don't break the cron tick over a stale sweep.
    }
  }
}
