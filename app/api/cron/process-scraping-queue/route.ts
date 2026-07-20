import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';
import { inngest } from '@/lib/inngest/client';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: distributor scraping queue processor
 *
 * POST /api/cron/process-scraping-queue
 *
 * Triggered every 5 minutes by netlify/functions/process-scraping-queue.ts.
 * Picks up to MAX_JOBS_PER_RUN queued jobs (oldest first), marks them
 * 'running', and dispatches a `scraping/brand.run` Inngest event once per
 * job — the same event `lib/inngest/functions/scraping.ts`'s own fan-out
 * tick uses, so both paths land on the identical per-brand worker. The
 * actual scrape runs there with no sync-ceiling risk. This route only
 * claims + dispatches, so it returns in well under any time limit.
 *
 * Also runs the monthly-refresh sweep occasionally (cheap idempotent
 * query — re-queues brands that haven't been scraped for 30+ days).
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
    global: { fetch: noStoreFetch },
  }) as SupabaseClient;

  // 1. Stale-running recovery. The scrape now runs in a background
  //    function with a 15-min budget, so a job legitimately stays
  //    'running' for up to ~that long. Only reset jobs 'running' beyond
  //    16 min — those are genuinely stranded (the background function
  //    crashed/was killed) and safe to re-queue without racing a live
  //    worker.
  const staleCutoff = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  const { data: recovered } = await supabase
    .from('scraping_jobs')
    .update({ status: 'queued', started_at: null })
    .eq('status', 'running')
    .lt('started_at', staleCutoff)
    .select('id');
  const recoveredCount = (recovered ?? []).length;

  // 2. Monthly refresh sweep — re-queue brands not scraped in 30 days.
  //    Cheap to run on every tick because dispatcher dedupes against
  //    queued/running jobs already in flight.
  await sweepStaleBrands(supabase);

  // 3. Claim up to N queued jobs.
  const { data: claimed } = await supabase
    .from('scraping_jobs')
    .select('id, brand_profile_id, distributor_org_id, brand_directory_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({
      processed: 0,
      recovered_stale: recoveredCount,
      message: 'no_jobs_queued',
    });
  }

  const startedAt = new Date().toISOString();
  const jobs = claimed as JobRow[];
  await supabase
    .from('scraping_jobs')
    .update({ status: 'running', started_at: startedAt })
    .in('id', jobs.map((j) => j.id));

  // 4. Fan out a `scraping/brand.run` event per claimed job. The Inngest
  //    function (lib/inngest/functions/scraping.ts) runs the agent with its
  //    own retry envelope and writes the terminal job status itself. Runs
  //    identically in local dev and production — no background-function URL
  //    to construct.
  try {
    await inngest.send(
      jobs.map((job) => ({
        name: 'scraping/brand.run' as const,
        data: {
          job_id: job.id,
          brand_profile_id: job.brand_profile_id,
          brand_directory_id: job.brand_directory_id,
        },
      })),
    );
  } catch (err) {
    console.error('[process-scraping-queue] inngest.send failed', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({
    dispatched: jobs.length,
    recovered_stale: recoveredCount,
    job_ids: jobs.map((j) => j.id),
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
