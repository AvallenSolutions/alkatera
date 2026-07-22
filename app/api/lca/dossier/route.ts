/**
 * One product's footprint, as a dossier.
 *
 * GET /api/lca/dossier?product_id=… — everything the dossier page reads, in
 * one round trip: the active footprint, its materials with provenance, and
 * whether it is currently exportable.
 *
 * Assembled server-side because the page's job is to be read, not to run five
 * queries and stitch them together while the user watches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { buildDossier } from '@/lib/lca/dossier';
import { checkLcaExportGate } from '@/lib/lca/export-gate';
import { TIER_NAMES, type TierName } from '@/lib/subscription/feature-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Anything unrecognised (trial, cancelled, null) reads as the lowest tier. */
function normaliseTier(raw: unknown): TierName {
  const value = String(raw ?? '').toLowerCase();
  return (TIER_NAMES as string[]).includes(value) ? (value as TierName) : 'seed';
}

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = request.nextUrl.searchParams.get('product_id');
  if (!productId) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }

  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    request.nextUrl.searchParams.get('organization_id'),
  );
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  const { data: product } = await client
    .from('products')
    .select('id, name, organization_id')
    .eq('id', productId)
    .maybeSingle();

  if (!product || product.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // The active footprint. One completed PCF per product and reference year is
  // enforced by a partial unique index, so ordering by status then recency
  // gives the live one with superseded history behind it.
  const { data: pcfs } = await client
    .from('product_carbon_footprints')
    .select(
      'id, status, functional_unit, reference_year, system_boundary, aggregated_impacts, distribution_config, updated_at',
    )
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(10);

  const pcf =
    (pcfs ?? []).find((p: any) => p.status === 'completed') ??
    (pcfs ?? [])[0] ??
    null;

  const { data: materials } = pcf
    ? await client
        .from('product_carbon_footprint_materials')
        .select(
          'id, material_name, material_type, impact_climate, gwp_data_source, matched_source_name, data_source',
        )
        .eq('product_carbon_footprint_id', pcf.id)
    : { data: [] as any[] };

  const { count: facilityCount } = await client
    .from('facility_product_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  // Routes to market. A product sold one way has none, and the dossier shows
  // no scenario machinery at all in that case.
  const { data: scenarios } = pcf
    ? await client
        .from('pcf_end_use_scenarios')
        .select('id, name, channel, is_primary, share_pct, distribution_config, stage_results')
        .eq('pcf_id', pcf.id)
        .order('is_primary', { ascending: false })
        .order('name')
    : { data: [] as any[] };

  const dossier = buildDossier({
    product: { id: product.id, name: product.name },
    pcf: pcf as any,
    materials: (materials ?? []) as any,
    facilityCount: facilityCount ?? 0,
    scenarios: (scenarios ?? []) as any,
  });

  // Whether this could be shared today, and if not which of the two reasons
  // it is. Shown up front rather than letting someone reach the download and
  // be refused there.
  const { data: org } = await client
    .from('organizations')
    .select('subscription_tier')
    .eq('id', organizationId)
    .maybeSingle();
  const currentTier = normaliseTier((org as any)?.subscription_tier);

  const gate = await checkLcaExportGate(
    client as any,
    productId,
    (pcf as any)?.system_boundary ?? null,
    currentTier,
  );

  // Any calculation currently in flight, so the page can say "working on it"
  // instead of showing a stale number with no explanation.
  //
  // lca_calculation_runs carries no RLS policies (service-role only), so this
  // reads through the service client. Safe here: the caller's access to this
  // product's organisation was established above, and only the run's progress
  // fields are returned.
  let activeRun: unknown = null;
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (serviceUrl && serviceKey) {
    const db = createClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await db
      .from('lca_calculation_runs')
      .select('id, status, percent, phase_message')
      .eq('product_id', productId)
      .eq('organization_id', organizationId)
      .in('status', ['queued', 'running'])
      .maybeSingle();
    activeRun = data ?? null;
  }

  return NextResponse.json({ dossier, gate, activeRun: activeRun ?? null });
}
