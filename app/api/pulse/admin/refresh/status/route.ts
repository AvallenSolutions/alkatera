import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import { denySection } from '@/lib/auth/section-access';
import type { PulseRefreshRun } from '@/lib/pulse/refresh-jobs';

/**
 * GET /api/pulse/admin/refresh/status?runId=<uuid>
 *
 * Polled by the "Refresh data" button to show live per-job progress while the
 * Pulse refresh runs in the background (see ./route.ts). Returns the run's
 * status plus the per-job map. Owner/admin only, same gate as the trigger.
 */

export const runtime = 'nodejs';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('runId');
    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'No organisation membership' }, { status: 403 });
    }

    const role = await getMemberRole(supabase, membership.organization_id, user.id);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Same gate as the trigger it polls.
    const denied = await denySection(serviceClient(), user, membership.organization_id, 'pulse');
    if (denied) return denied;

    const { data: run, error } = await serviceClient()
      .from('pulse_refresh_runs')
      .select('id, status, jobs, error')
      .eq('id', runId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run as PulseRefreshRun);
  } catch (err: any) {
    console.error('[pulse admin refresh status]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
