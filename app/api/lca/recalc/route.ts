/**
 * Ask for a product's footprint to be recalculated.
 *
 * POST /api/lca/recalc — records a run row and dispatches it to Inngest, then
 * returns 202 immediately. The calculation happens server-side; the caller
 * polls the sibling status route.
 *
 * This is what lets a footprint refresh because a recipe changed rather than
 * because somebody sat and watched a progress overlay. The browser path (the
 * wizard's Calculate step) still exists and is untouched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRIGGERS = [
  'manual',
  'recipe_changed',
  'packaging_library',
  'factor_set',
  'ask_answered',
  'first_recipe',
] as const;
type Trigger = (typeof TRIGGERS)[number];

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = body?.product_id;
  const trigger: Trigger = TRIGGERS.includes(body?.trigger) ? body.trigger : 'manual';

  if (productId === undefined || productId === null) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }

  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    body?.organization_id ?? null,
  );
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  const db = service();

  // Confirm the product belongs to the caller's organisation before the
  // service-role client touches anything on its behalf.
  const { data: product } = await db
    .from('products')
    .select('id, organization_id')
    .eq('id', productId)
    .maybeSingle();
  if (!product || product.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // A run already in flight is the answer to this request. Joining it beats
  // starting a competitor that races to write the same PCF, which is what the
  // partial unique index on the table prevents anyway.
  const { data: active } = await db
    .from('lca_calculation_runs')
    .select('id, status')
    .eq('product_id', productId)
    .in('status', ['queued', 'running'])
    .maybeSingle();
  if (active) {
    return NextResponse.json({ ok: true, runId: active.id, joined: true }, { status: 202 });
  }

  const { data: run, error: insertError } = await db
    .from('lca_calculation_runs')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      requested_by: user.id,
      trigger,
      status: 'queued',
    })
    .select('id')
    .single();

  if (insertError || !run) {
    // The partial unique index can still reject us if a run started between
    // the check above and this insert. That is the correct outcome, not an
    // error worth showing anyone.
    const { data: raced } = await db
      .from('lca_calculation_runs')
      .select('id')
      .eq('product_id', productId)
      .in('status', ['queued', 'running'])
      .maybeSingle();
    if (raced) {
      return NextResponse.json({ ok: true, runId: raced.id, joined: true }, { status: 202 });
    }
    return NextResponse.json(
      { error: insertError?.message || 'Could not start the calculation' },
      { status: 500 },
    );
  }

  const baseUrl = request.nextUrl.origin;

  if (process.env.INNGEST_EVENT_KEY) {
    await inngest.send({
      name: 'lca/recalc.requested',
      data: { run_id: run.id, base_url: baseUrl },
    });
  } else {
    // Local development has no Inngest key, and a queued row nobody will ever
    // pick up looks exactly like a hang. Say so plainly instead.
    await db
      .from('lca_calculation_runs')
      .update({
        status: 'failed',
        error:
          'INNGEST_EVENT_KEY is not set, so this run has nowhere to go. Calculate from the LCA instead.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    return NextResponse.json(
      { ok: false, runId: run.id, error: 'Background calculation is not configured here' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, runId: run.id }, { status: 202 });
}
