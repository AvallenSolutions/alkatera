/**
 * Pulse -- Carbon budgets (F5).
 *
 * GET    /api/pulse/carbon-budgets  -> list budgets + current-period variance
 * POST   /api/pulse/carbon-budgets  -> upsert a budget
 * DELETE /api/pulse/carbon-budgets?id=<uuid> -> remove a budget
 *
 * Variance maths:
 *   For each budget, find the most recent full period that has started and
 *   sum metric_snapshots.total_co2e (kg -> tonnes) within that window.
 *   variance_pct = (actual - budget) / budget * 100
 *   status       = 'on_track' (<= 0%), 'at_risk' (0-10%), 'over' (>10%)
 *
 * Writes (POST/DELETE) require owner/admin role (enforced by RLS + server check).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';

export const runtime = 'nodejs';

interface Budget {
  id: string;
  organization_id: string;
  scope: 'all' | 'scope_1' | 'scope_2' | 'scope_3';
  facility_id: string | null;
  period: 'monthly' | 'quarterly' | 'annual';
  budget_tco2e: number;
  effective_from: string;
  owner_user_id: string | null;
  notes: string | null;
}

async function resolveOrg(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthenticated', status: 401 as const };

  const orgIdParam = request.nextUrl.searchParams.get('organization_id');
  let organizationId = orgIdParam ?? null;
  if (!organizationId) {
    const { data: m } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    organizationId = m?.organization_id ?? null;
  }
  if (!organizationId) return { error: 'No organisation', status: 403 as const };

  const role = await getMemberRole(supabase, organizationId, user.id);
  return { userId: user.id, organizationId, role, supabase };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Start of the most recent full period aligned to the cadence. */
function currentPeriodStart(period: Budget['period']): Date {
  const now = new Date();
  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  // annual
  return new Date(now.getFullYear(), 0, 1);
}

export async function GET(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const svc = serviceClient();

  const { data: budgets, error } = await svc
    .from('carbon_budgets')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull all snapshots in one hit for the widest period (annual from Jan 1).
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: snapshots } = await svc
    .from('metric_snapshots')
    .select('snapshot_date, value')
    .eq('organization_id', ctx.organizationId)
    .eq('metric_key', 'total_co2e')
    .gte('snapshot_date', yearStart)
    .lte('snapshot_date', today);

  // Compute variance per budget.
  const rows = (budgets ?? []).map(b => {
    const periodStart = currentPeriodStart(b.period).toISOString().slice(0, 10);
    const actualKg = (snapshots ?? [])
      .filter(s => (s.snapshot_date as string) >= periodStart)
      .reduce((sum, s) => sum + Number(s.value ?? 0), 0);
    const actualT = actualKg / 1000;
    const variancePct =
      b.budget_tco2e > 0 ? ((actualT - b.budget_tco2e) / b.budget_tco2e) * 100 : 0;
    const status =
      variancePct <= 0 ? 'on_track' : variancePct <= 10 ? 'at_risk' : 'over';

    return {
      ...b,
      current_period_start: periodStart,
      actual_tco2e: actualT,
      variance_tco2e: actualT - b.budget_tco2e,
      variance_pct: variancePct,
      status,
    };
  });

  return NextResponse.json({
    ok: true,
    organization_id: ctx.organizationId,
    generated_at: new Date().toISOString(),
    budgets: rows,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner or admin only' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const scope = String(body?.scope ?? 'all');
  const period = String(body?.period ?? 'monthly');
  const budgetTco2e = Number(body?.budget_tco2e);
  const effectiveFrom = String(
    body?.effective_from ?? new Date().toISOString().slice(0, 10),
  );
  const facilityId = body?.facility_id ?? null;
  const notes = body?.notes ?? null;

  if (!['all', 'scope_1', 'scope_2', 'scope_3'].includes(scope)) {
    return NextResponse.json({ error: 'Bad scope' }, { status: 400 });
  }
  if (!['monthly', 'quarterly', 'annual'].includes(period)) {
    return NextResponse.json({ error: 'Bad period' }, { status: 400 });
  }
  if (!Number.isFinite(budgetTco2e) || budgetTco2e < 0) {
    return NextResponse.json({ error: 'budget_tco2e must be a non-negative number' }, { status: 400 });
  }

  const svc = serviceClient();
  const payload = {
    organization_id: ctx.organizationId,
    scope,
    period,
    budget_tco2e: budgetTco2e,
    effective_from: effectiveFrom,
    facility_id: facilityId,
    owner_user_id: ctx.userId,
    notes,
  };

  // If an id was provided, update. Otherwise insert a new row.
  const existingId = body?.id;
  let result;
  if (existingId) {
    result = await svc
      .from('carbon_budgets')
      .update(payload)
      .eq('id', existingId)
      .eq('organization_id', ctx.organizationId)
      .select('*')
      .maybeSingle();
  } else {
    result = await svc
      .from('carbon_budgets')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, budget: result.data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner or admin only' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc
    .from('carbon_budgets')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
