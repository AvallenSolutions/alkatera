import { NextRequest, NextResponse } from 'next/server';
import { runCertChecks } from '@/lib/inngest/functions/monitoring';

export const dynamic = 'force-dynamic';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * GET /api/admin/openlca/cert-check
 *
 * On-demand TLS certificate expiry check for the self-hosted OpenLCA servers
 * (ecoinvent + Agribalyse). Mirrors what the daily `openlcaCertMonitor` Inngest
 * function runs, but returns the result immediately so an admin can see cert
 * status without waiting for the scheduled run. Read-only; sends no email.
 *
 * Auth: any authenticated user (same bearer-token pattern as
 * /api/openlca/test-connection).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
    });
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const checks = await runCertChecks();
    const degraded = checks.some((c) => !c.ok || c.expired);
    const soonestDays = checks.reduce<number | null>((min, c) => {
      if (c.daysRemaining === null) return min;
      return min === null ? c.daysRemaining : Math.min(min, c.daysRemaining);
    }, null);

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      degraded,
      soonest_days_remaining: soonestDays,
      checks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[openlca-cert-check] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
