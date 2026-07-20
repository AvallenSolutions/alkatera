import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron / one-shot backfill: recompute completeness + vitality for
 * every brand_directory entry the recalc pipeline has never visited.
 *
 * The Phase 5 recalc was wired into brand_profiles writes, which means
 * directory entries that exist as pure alka**tera** signups (created
 * by the trg_sync_org_to_directory trigger, no distributor listing yet)
 * never get scored — the Discover page then renders them with null
 * SCORE / COMPLETE columns even when scraped_brand_data has findings.
 *
 * This route iterates the directory and runs the recalc for every row.
 * Safe to fire repeatedly: the recalc is idempotent and just produces
 * a fresh snapshot + mirror.
 *
 * Auth: CRON_SECRET Bearer.
 *
 * Query params:
 *   only_unscored=true  : limit to directory rows where
 *                         sustainability_score is null (the common
 *                         backfill case — faster than re-doing every
 *                         row).
 *   max=N               : cap the number of rows touched per call
 *                         (default 500). Use this if a single Netlify
 *                         function invocation can't process the whole
 *                         directory in 60 s — re-fire until done.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return runBackfill(request);
}
export async function GET(request: NextRequest) {
  return runBackfill(request);
}

async function runBackfill(request: NextRequest) {
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

  const url = new URL(request.url);
  const onlyUnscored = url.searchParams.get('only_unscored') !== 'false';
  const syncFirst = url.searchParams.get('sync_alkatera') === 'true';
  const max = Math.min(2000, Math.max(1, Number(url.searchParams.get('max') ?? '500') || 500));

  let query = supabase
    .from('brand_directory')
    .select('id, sustainability_score, alkatera_org_id')
    .order('updated_at', { ascending: true })
    .limit(max);
  if (onlyUnscored) {
    query = query.is('sustainability_score', null);
  }

  const { data: directoryRows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (directoryRows ?? []) as Array<{
    id: string;
    alkatera_org_id: string | null;
  }>;

  let recalculated = 0;
  let withFindings = 0;
  let withoutFindings = 0;
  let alkateraSynced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // Optional: if the directory entry is alkatera-linked, pull a
      // fresh sync first so the recalc sees the live data. The sync
      // itself now triggers a recalc internally (see alkatera-sync.ts
      // step 6), so we skip the separate recalc call when sync ran.
      if (syncFirst && row.alkatera_org_id) {
        const syncResult = await syncAlkateraDataForBrand(supabase, row.id);
        if (syncResult.ok) {
          alkateraSynced += 1;
          recalculated += 1;
          if (syncResult.fields_written > 0) withFindings += 1;
          else withoutFindings += 1;
          continue;
        }
        // Fall through to a plain recalc if sync failed.
      }

      const result = await recalculateCompleteness(supabase, row.id);
      if (result) {
        recalculated += 1;
        if (result.fields_populated > 0) withFindings += 1;
        else withoutFindings += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    recalculated,
    alkatera_synced: alkateraSynced,
    with_findings: withFindings,
    without_findings: withoutFindings,
    failed,
    note: rows.length === max ? 'reached max — re-fire to continue' : 'done',
  });
}
