import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import { inngest } from '@/lib/inngest/client';
import { seedPulseJobs } from '@/lib/pulse/refresh-jobs';
import { runPulseRefreshInline } from '@/lib/pulse/run-refresh';

/**
 * POST /api/pulse/admin/refresh
 *
 * On-demand trigger for the Pulse data jobs. Owners/admins kick a refresh from
 * the UI without waiting for the Netlify schedule.
 *
 * These jobs are heavy (snapshots iterate every org; insights make a Gemini
 * call per org), so running them synchronously inside this request blew past
 * the platform's sync-function timeout — the gateway returned an HTML 502/504
 * page and the browser's `res.json()` failed with "Unexpected token '<'". They
 * now run in the background:
 *   1. We record a `pulse_refresh_runs` row (the unit of progress).
 *   2. We dispatch `pulse/refresh.requested`; the Inngest function runs each
 *      job in its own step (fresh invocation budget + retries, no timeout).
 *   3. The UI polls GET /api/pulse/admin/refresh/status for live per-job state.
 *
 * Local dev / no Inngest: when INNGEST_EVENT_KEY is unset, `inngest.send` no-ops,
 * so we fall back to running the jobs in-process (fire-and-forget). No gateway
 * sits in front of a local node server, so the long runtime is harmless there.
 *
 * Auth: caller must be an authenticated owner/admin of some org. The downstream
 * cron routes are Bearer-protected with CRON_SECRET, attached server-side so the
 * secret never reaches the browser.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Membership is purely an authz gate here — Pulse refresh is org-agnostic
    // (the crons iterate every org), so we just need an org where the caller is
    // an admin/owner.
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
      return NextResponse.json(
        { error: 'Only owners or admins can refresh Pulse data' },
        { status: 403 },
      );
    }

    const baseUrl = request.nextUrl.origin;
    const service = serviceClient();

    // Record the run up front (seeded with every job pending) so the UI has a
    // row to poll the moment it gets the id back.
    const { data: run, error: insertErr } = await service
      .from('pulse_refresh_runs')
      .insert({
        requested_by: user.id,
        status: 'queued',
        jobs: seedPulseJobs(),
      })
      .select('id')
      .single();

    if (insertErr || !run) {
      return NextResponse.json(
        { error: insertErr?.message ?? 'Failed to create refresh run' },
        { status: 500 },
      );
    }

    if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: 'pulse/refresh.requested',
        data: { run_id: run.id, base_url: baseUrl },
      });
    } else {
      // No Inngest configured (local dev): run in-process, fire-and-forget.
      void runPulseRefreshInline(service, run.id, baseUrl, process.env.CRON_SECRET).catch(
        (err) => console.error('[pulse admin refresh] inline run failed', err),
      );
    }

    return NextResponse.json({ ok: true, runId: run.id }, { status: 202 });
  } catch (err: any) {
    console.error('[pulse admin refresh]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
