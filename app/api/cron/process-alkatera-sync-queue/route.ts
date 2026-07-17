import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: drain the alkatera_sync_queue.
 *
 * POST /api/cron/process-alkatera-sync-queue
 *
 * The queue is filled by the triggers installed in migration
 * `20262607300000_alkatera_realtime_sync.sql`. Every change to one of
 * the alka**tera** sustainability tables (ghg_emissions,
 * product_carbon_footprints, organization_certifications,
 * packaging_circularity_profiles, transition_plans, flag_targets,
 * facility_water_data) inserts a `pending` row keyed by
 * `alkatera_org_id`.
 *
 * This worker:
 *   1. Pulls a batch of pending rows oldest-first.
 *   2. Marks them `running` to prevent double-processing if two crons
 *      overlap.
 *   3. Resolves each row's alkatera_org_id to a brand_directory_id.
 *   4. Calls syncAlkateraDataForBrand once per unique directory id in
 *      the batch (so 10 ghg_emissions changes for the same org cost
 *      one sync, not ten).
 *   5. Stamps the queue rows `done` (or `failed` with last_error after
 *      3 attempts).
 *
 * Auth: CRON_SECRET Bearer.
 * Schedule: every 1 minute (declared in netlify.toml).
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  return processQueue(request);
}

// GET allowed too so an operator can hit it manually from the browser
// while logged in to Netlify; the auth check is identical.
export async function GET(request: NextRequest) {
  return processQueue(request);
}

async function processQueue(request: NextRequest) {
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

  // 1. Claim a batch by transitioning pending → running. We do this in
  //    one round-trip via update-returning so two workers can't claim
  //    the same row.
  const { data: claimed, error: claimError } = await supabase
    .from('alkatera_sync_queue')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
    .select('id, alkatera_org_id, trigger_source, attempts');

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  type QueueRow = {
    id: string;
    alkatera_org_id: string;
    trigger_source: string;
    attempts: number;
  };
  const rows = (claimed ?? []) as QueueRow[];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, deduped_to: 0 });
  }

  // 2. Resolve alkatera_org_id → brand_directory_id.
  const uniqueOrgIds = Array.from(new Set(rows.map((r) => r.alkatera_org_id)));
  const { data: directoryRows } = await supabase
    .from('brand_directory')
    .select('id, alkatera_org_id')
    .in('alkatera_org_id', uniqueOrgIds);
  const directoryByOrg = new Map<string, string>(
    ((directoryRows ?? []) as Array<{ id: string; alkatera_org_id: string }>).map((r) => [
      r.alkatera_org_id,
      r.id,
    ]),
  );

  // 3. Group queue rows by directory id so we sync each brand once
  //    regardless of how many trigger fires arrived for it.
  const queueRowsByDirectory = new Map<string, QueueRow[]>();
  const unresolvedRows: QueueRow[] = [];
  for (const row of rows) {
    const directoryId = directoryByOrg.get(row.alkatera_org_id);
    if (!directoryId) {
      unresolvedRows.push(row);
      continue;
    }
    const bucket = queueRowsByDirectory.get(directoryId) ?? [];
    bucket.push(row);
    queueRowsByDirectory.set(directoryId, bucket);
  }

  // 4. Sync each unique brand_directory id. On success mark all queue
  //    rows in its bucket `done`; on failure increment attempts and,
  //    if MAX_ATTEMPTS reached, mark `failed`.
  let processed = 0;
  let failed = 0;
  const now = () => new Date().toISOString();

  for (const [directoryId, bucketRows] of Array.from(queueRowsByDirectory.entries())) {
    try {
      const result = await syncAlkateraDataForBrand(supabase, directoryId);
      if (result.ok) {
        await supabase
          .from('alkatera_sync_queue')
          .update({ status: 'done', completed_at: now(), last_error: null })
          .in('id', bucketRows.map((r) => r.id));
        processed += bucketRows.length;
      } else {
        const message = result.error ?? 'sync_returned_not_ok';
        await markRetryOrFail(supabase, bucketRows, message);
        failed += bucketRows.length;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sync_threw';
      await markRetryOrFail(supabase, bucketRows, message);
      failed += bucketRows.length;
    }
  }

  // Unresolved rows: no directory entry exists for that org yet
  // (probably an alka**tera** org that hasn't been listed by any
  // distributor). Mark as done with a benign note — there's nothing
  // to sync, and they'd otherwise pile up indefinitely.
  if (unresolvedRows.length > 0) {
    await supabase
      .from('alkatera_sync_queue')
      .update({
        status: 'done',
        completed_at: now(),
        last_error: 'no_directory_entry_for_org',
      })
      .in('id', unresolvedRows.map((r) => r.id));
  }

  return NextResponse.json({
    processed,
    failed,
    unresolved: unresolvedRows.length,
    deduped_to: queueRowsByDirectory.size,
  });
}

async function markRetryOrFail(
  supabase: SupabaseClient,
  bucketRows: Array<{ id: string; attempts: number }>,
  message: string,
) {
  // Atomically increment the attempts column. We don't have a single
  // SQL increment available via supabase-js so we issue one update
  // per row with the new attempts count and either retry or fail.
  for (const row of bucketRows) {
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await supabase
        .from('alkatera_sync_queue')
        .update({
          status: 'failed',
          attempts: nextAttempts,
          last_error: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } else {
      await supabase
        .from('alkatera_sync_queue')
        .update({
          status: 'pending',
          attempts: nextAttempts,
          last_error: message.slice(0, 1000),
          started_at: null,
        })
        .eq('id', row.id);
    }
  }
}
