/**
 * Pulse -- Shadow prices management.
 *
 * GET    /api/pulse/shadow-prices          list resolved + org-specific rows
 * POST   /api/pulse/shadow-prices          upsert an org-specific price
 * DELETE /api/pulse/shadow-prices?id=...   delete an org row (fall back to global)
 *
 * All writes require role owner or admin. We enforce that server-side even
 * though the table's RLS says the same; belt-and-braces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import { ALL_METRIC_KEYS } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

export async function GET(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const svc = serviceClient();

  // Resolved map (what the Pulse tiles actually use).
  const resolved = await loadShadowPrices(svc, ctx.organizationId);

  // Raw org-specific rows (so the UI can show "you've overridden these").
  const { data: orgRows, error } = await svc
    .from('org_shadow_prices')
    .select('id, metric_key, currency, price_per_unit, unit, native_unit_multiplier, source, effective_from')
    .eq('organization_id', ctx.organizationId)
    .order('effective_from', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    resolved,
    org_overrides: orgRows ?? [],
    supported_metrics: ALL_METRIC_KEYS,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner or admin only' }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const metric_key = String(body?.metric_key ?? '');
  const currency = String(body?.currency ?? 'GBP');
  const price_per_unit = Number(body?.price_per_unit);
  const unit = String(body?.unit ?? '');
  const native_unit_multiplier = Number(body?.native_unit_multiplier ?? 1);
  const source = body?.source ? String(body.source) : null;
  const effective_from =
    typeof body?.effective_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.effective_from)
      ? body.effective_from
      : new Date().toISOString().slice(0, 10);

  if (!ALL_METRIC_KEYS.includes(metric_key as any)) {
    return NextResponse.json({ error: `Unknown metric_key: ${metric_key}` }, { status: 400 });
  }
  if (!Number.isFinite(price_per_unit) || price_per_unit < 0) {
    return NextResponse.json({ error: 'price_per_unit must be a non-negative number' }, { status: 400 });
  }
  if (!unit) {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 });
  }
  if (!Number.isFinite(native_unit_multiplier) || native_unit_multiplier <= 0) {
    return NextResponse.json({ error: 'native_unit_multiplier must be > 0' }, { status: 400 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from('org_shadow_prices')
    .upsert(
      {
        organization_id: ctx.organizationId,
        metric_key,
        currency,
        price_per_unit,
        unit,
        native_unit_multiplier,
        source,
        effective_from,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,metric_key,currency,effective_from' },
    )
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(request: NextRequest) {
  const ctx = await resolveOrg(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner or admin only' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc
    .from('org_shadow_prices')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
