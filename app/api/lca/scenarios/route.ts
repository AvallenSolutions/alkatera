/**
 * Routes to market for one product's footprint.
 *
 * POST   — add a channel, seeded from its preset and computed immediately
 * PATCH  — set a channel's share of volume, or rename it
 * DELETE — remove a channel (never the primary: something must lead)
 *
 * Scenarios deliberately do not consume LCA quota. That is structural rather
 * than enforced here: check_lca_limit counts product_carbon_footprints rows,
 * and these live in their own table. See tasks/lca-end-use-scenarios-plan.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import {
  CHANNEL_PRESETS,
  presetConfigsFor,
  recomputeScenariosForPcf,
  type ScenarioChannel,
} from '@/lib/lca/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Service client: recompute reads materials and writes results across rows. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Establishes that the caller may act on this PCF, and returns its org. */
async function authorise(request: NextRequest, pcfId: string) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const organizationId = await resolveAccessibleOrg(client as any, user, null);
  if (!organizationId) return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) };

  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId);
  if (denied) return { error: denied };

  const { data: pcf } = await client
    .from('product_carbon_footprints')
    .select('id, product_id, organization_id, system_boundary, use_phase_config, eol_config, distribution_config')
    .eq('id', pcfId)
    .maybeSingle();

  if (!pcf || (pcf as any).organization_id !== organizationId) {
    return { error: NextResponse.json({ error: 'Footprint not found' }, { status: 404 }) };
  }

  return { client, organizationId, pcf: pcf as any };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { pcf_id: pcfId, channel, name } = body as {
    pcf_id?: string;
    channel?: ScenarioChannel;
    name?: string;
  };

  if (!pcfId || !channel) {
    return NextResponse.json({ error: 'pcf_id and channel are required' }, { status: 400 });
  }
  if (channel === 'custom' || !(channel in CHANNEL_PRESETS)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  const auth = await authorise(request, pcfId);
  if ('error' in auth) return auth.error;
  const { client, organizationId, pcf } = auth;

  // A gate-only footprint has no downstream to vary, so a scenario would be a
  // row that can never mean anything.
  const boundary = String(pcf.system_boundary ?? 'cradle-to-gate');
  if (boundary === 'cradle-to-gate' || boundary === 'cradle_to_gate') {
    return NextResponse.json(
      { error: 'This footprint stops at your factory gate, so there is no journey to vary yet.' },
      { status: 400 },
    );
  }

  // Total shipped weight carries over from whatever the study already assumed,
  // so a new channel starts from the product's real weight rather than zero.
  const productWeightKg = Number(pcf.distribution_config?.productWeightKg ?? 0);

  const configs = presetConfigsFor(channel as Exclude<ScenarioChannel, 'custom'>, {
    usePhaseConfig: pcf.use_phase_config,
    eolConfig: pcf.eol_config,
    productWeightKg,
  });

  // First scenario on a PCF becomes primary: something has to lead the number.
  const { count: existing } = await client
    .from('pcf_end_use_scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('pcf_id', pcfId);

  const { data: created, error } = await client
    .from('pcf_end_use_scenarios')
    .insert({
      pcf_id: pcfId,
      organization_id: organizationId,
      name: name?.trim() || CHANNEL_PRESETS[channel as Exclude<ScenarioChannel, 'custom'>].label,
      channel,
      is_primary: (existing ?? 0) === 0,
      ...configs,
      provenance: { source: 'channel_preset' },
    })
    .select('id, name, channel')
    .single();

  if (error) {
    // The unique (pcf_id, name) index is the likely cause, and "you already
    // have one of those" is more useful than a constraint name.
    const duplicate = error.message.includes('pcf_end_use_scenarios_pcf_id_name_key');
    return NextResponse.json(
      { error: duplicate ? 'This product already has a route with that name.' : error.message },
      { status: duplicate ? 409 : 500 },
    );
  }

  // Compute straight away: a route with no number is an empty state, and the
  // whole point of the dossier is that there are none.
  const db = serviceClient();
  if (db) {
    try {
      await recomputeScenariosForPcf(db, pcfId);
    } catch {
      // Non-fatal: the scenario exists and the next recalculation will fill it
      // in. Better a route with a pending number than a failed request.
    }
  }

  return NextResponse.json({ scenario: created });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { id, pcf_id: pcfId, share_pct: sharePct, name } = body as {
    id?: string;
    pcf_id?: string;
    share_pct?: number | null;
    name?: string;
  };

  if (!id || !pcfId) {
    return NextResponse.json({ error: 'id and pcf_id are required' }, { status: 400 });
  }
  if (sharePct !== undefined && sharePct !== null && (sharePct < 0 || sharePct > 100)) {
    return NextResponse.json({ error: 'A share must be between 0 and 100' }, { status: 400 });
  }

  const auth = await authorise(request, pcfId);
  if ('error' in auth) return auth.error;
  const { client } = auth;

  const patch: Record<string, unknown> = {};
  if (sharePct !== undefined) {
    patch.share_pct = sharePct;
    // A share the user typed is a fact about their business, not a guess.
    patch.provenance = { source: 'user_confirmed_share' };
  }
  if (name !== undefined) patch.name = name.trim();

  const { error } = await client
    .from('pcf_end_use_scenarios')
    .update(patch)
    .eq('id', id)
    .eq('pcf_id', pcfId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const pcfId = request.nextUrl.searchParams.get('pcf_id');
  if (!id || !pcfId) {
    return NextResponse.json({ error: 'id and pcf_id are required' }, { status: 400 });
  }

  const auth = await authorise(request, pcfId);
  if ('error' in auth) return auth.error;
  const { client } = auth;

  const { data: scenario } = await client
    .from('pcf_end_use_scenarios')
    .select('is_primary')
    .eq('id', id)
    .eq('pcf_id', pcfId)
    .maybeSingle();

  if (!scenario) return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  // Removing the primary would leave the product with no declared number and
  // no rule for picking one. Make another route primary first.
  if ((scenario as any).is_primary) {
    return NextResponse.json(
      { error: 'This is the main route, so it cannot be removed. Make another one the main route first.' },
      { status: 400 },
    );
  }

  const { error } = await client
    .from('pcf_end_use_scenarios')
    .delete()
    .eq('id', id)
    .eq('pcf_id', pcfId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
