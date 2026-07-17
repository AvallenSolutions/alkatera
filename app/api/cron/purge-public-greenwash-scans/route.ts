import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { purgeStaleGreenwashScans } from '@/lib/retention/purge';

/**
 * Cron: purge stale public Greenwash Guardian scans.
 *
 * POST /api/cron/purge-public-greenwash-scans
 *
 * Manual/admin trigger. In production this runs on the
 * `retentionPurgeSweep` Inngest native cron (lib/inngest/functions/retention.ts,
 * daily 04:00 UTC) — this route calls the same `purgeStaleGreenwashScans` for
 * on-demand use. Deletes public_greenwash_scans rows older than 24 hours
 * (security review 2026-05-29, HIGH-3).
 *
 * Auth: CRON_SECRET Bearer.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

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

  try {
    const result = await purgeStaleGreenwashScans(supabase);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[purge-public-greenwash-scans] delete failed:', err?.message);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }
}
