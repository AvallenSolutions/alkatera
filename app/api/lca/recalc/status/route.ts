/**
 * How is that calculation getting on?
 *
 * GET /api/lca/recalc/status?runId=… — the run row, for a UI that is polling.
 * The table has no RLS policies (service-role only), so this route is where
 * the caller is authorised against the run's organisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = request.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const db = service();
  const { data: run } = await db
    .from('lca_calculation_runs')
    .select(
      'id, product_id, organization_id, status, percent, phase_message, pcf_id, fallback_events, error, created_at, updated_at',
    )
    .eq('id', runId)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const organizationId = await resolveAccessibleOrg(client as any, user, run.organization_id);
  if (organizationId !== run.organization_id) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json({ run });
}
