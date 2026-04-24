import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';

/**
 * POST /api/pulse/admin/refresh
 *
 * On-demand trigger for the four Pulse cron jobs. Exists so owners/admins can
 * kick a refresh from the UI without waiting for the Netlify schedule, and so
 * we have a UI-first path during development (the scheduled functions require
 * a deploy).
 *
 * Auth: caller must be an authenticated member of the organisation with role
 * 'owner' or 'admin'. The downstream cron routes are Bearer-protected with
 * CRON_SECRET; we attach that server-side so the secret never reaches the
 * browser.
 *
 * Runs sequentially (snapshots → anomalies → grid-carbon → insights) because
 * insights read from the tables the earlier jobs populate; a fresh snapshot
 * means a meaningful narrative. Each job's status is returned individually so
 * partial success is visible in the UI.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

const JOBS = [
  { key: 'snapshots', path: '/api/cron/generate-snapshots' },
  { key: 'anomalies', path: '/api/cron/detect-anomalies' },
  { key: 'grid_carbon', path: '/api/cron/refresh-grid-carbon' },
  { key: 'insights', path: '/api/cron/generate-insights' },
  { key: 'shadow_prices', path: '/api/cron/refresh-shadow-prices' },
] as const;

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

    // Caller's active organisation via organization_members. We just need any
    // org where they have an admin/owner role; Pulse refresh is org-agnostic
    // (the crons iterate every org), so we use membership purely as an authz
    // gate rather than to parameterise the job.
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

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    // Resolve base URL. In prod this is the request's own origin; in dev it's
    // http://localhost:3000. We call ourselves so the cron routes execute in
    // the same runtime with the same env.
    const baseUrl = request.nextUrl.origin;

    const results: Record<string, { ok: boolean; status: number; body: unknown }> = {};
    for (const job of JOBS) {
      try {
        const res = await fetch(`${baseUrl}${job.path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
        });
        const body = await res.json().catch(() => ({}));
        results[job.key] = { ok: res.ok, status: res.status, body };
      } catch (err: any) {
        results[job.key] = {
          ok: false,
          status: 0,
          body: { error: err?.message ?? 'fetch failed' },
        };
      }
    }

    const allOk = Object.values(results).every(r => r.ok);
    return NextResponse.json(
      { ok: allOk, results },
      { status: allOk ? 200 : 207 },
    );
  } catch (err: any) {
    console.error('[pulse admin refresh]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
