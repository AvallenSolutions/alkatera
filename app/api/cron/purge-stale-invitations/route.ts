import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { purgeStaleInvitations } from '@/lib/retention/purge';

/**
 * Cron: purge stale invitations (retention, MED-8, security review 2026-05-29).
 *
 * POST /api/cron/purge-stale-invitations
 *
 * Manual/admin trigger. In production this runs on the
 * `retentionPurgeSweep` Inngest native cron (lib/inngest/functions/retention.ts,
 * daily 04:00 UTC) — this route calls the same `purgeStaleInvitations` for
 * on-demand use.
 *
 * Invitations hold invitee email addresses. Once an invitation is resolved
 * (accepted / expired / cancelled) or long past its expiry, the email no longer
 * needs to be retained. Deletes team_invitations and supplier_invitations that
 * are non-pending OR expired AND older than 90 days. Still-valid pending
 * invitations are left untouched.
 *
 * NOTE: epr_audit_log is intentionally excluded - it is an immutable 7-year
 * regulatory audit trail.
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

  const purged = await purgeStaleInvitations(supabase);
  return NextResponse.json({ purged });
}
