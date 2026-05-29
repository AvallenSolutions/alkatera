import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';

/**
 * Cron: purge stale public Greenwash Guardian scans.
 *
 * POST /api/cron/purge-public-greenwash-scans
 *
 * Deletes public_greenwash_scans rows older than 24 hours. These rows hold
 * marketing-lead emails captured by the free scan tool; the documented
 * retention is 24h. This enforces that retention so lead PII is not kept
 * indefinitely (security review 2026-05-29, HIGH-3).
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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('public_greenwash_scans')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('[purge-public-greenwash-scans] delete failed:', error.message);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }

  return NextResponse.json({ purged: data?.length ?? 0 });
}
