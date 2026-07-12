import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/support-stats
 *
 * Support-deflection measurement (Phase 4, see
 * tasks/onboarding-support-plan.md): counts the last 30 days of
 * `rosa_telemetry` events Rosa's support tools write (see lib/rosa/tools.ts
 * and lib/rosa/actions.ts) — knowledge-bank searches, "what's next" asks,
 * and tickets actually filed — so the admin platform dashboard can show
 * how much support genuinely resolves in-app versus escalating to a human.
 *
 * Auth pattern cribbed from app/api/admin/beta-access/route.ts: bearer
 * token, is_alkatera_admin() RPC check, then a service-role read (rosa_
 * telemetry's RLS is org-scoped, which an admin isn't a member of every
 * org for).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const countEvent = async (event: string): Promise<number> => {
      const { count, error } = await adminClient
        .from('rosa_telemetry')
        .select('id', { count: 'exact', head: true })
        .eq('event', event)
        .gte('created_at', since.toISOString());
      // rosa_telemetry may not exist yet in a fresh environment — fail
      // quiet to zero rather than 500ing the whole dashboard.
      return error ? 0 : (count ?? 0);
    };

    const [knowledgeSearches, nextStepAsks, ticketsFiled] = await Promise.all([
      countEvent('support.knowledge_search'),
      countEvent('support.next_steps'),
      countEvent('support.ticket_filed'),
    ]);

    const resolvedInPlace = knowledgeSearches + nextStepAsks;

    return NextResponse.json({
      window_days: 30,
      knowledge_searches: knowledgeSearches,
      next_step_asks: nextStepAsks,
      tickets_filed: ticketsFiled,
      resolved_in_place: resolvedInPlace,
    });
  } catch (error: unknown) {
    console.error('Error fetching support stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch support stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
