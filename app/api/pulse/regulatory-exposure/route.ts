/**
 * Pulse -- Regulatory exposure.
 *
 * GET /api/pulse/regulatory-exposure?organization_id=...
 *
 * Estimates the org's annual £ exposure to UK ETS, EU CBAM, Plastic Packaging
 * Tax and Packaging EPR. Pulls available data from the database and falls
 * back to zero / assumed values where the user hasn't filled it in yet.
 *
 * Dimensions the API tries to source (in priority order):
 *   - annual_tonnes_co2e -> metric_snapshots total_co2e (trailing 12m)
 *   - plastic_packaging_tonnes + recycled share
 *       -> product_carbon_footprint_materials where packaging_category != null
 *          with packaging_material = 'plastic' (heuristic; may be absent)
 *   - packaging_by_material_t
 *       -> same source, grouped by packaging_material
 *   - cbam_embedded_tonnes, uk_ets_free_allocation_t
 *       -> epr_organization_settings (future field; default 0 today)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import {
  calculateRegulatoryExposure,
  type RegulatoryInput,
} from '@/lib/pulse/regulatory-exposure';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    let organizationId = orgIdParam;
    if (!organizationId) {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      organizationId = m?.organization_id ?? null;
    } else {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Annual emissions in tonnes (from kg snapshots).
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('metric_key', 'total_co2e')
      .gte('snapshot_date', fmt(start))
      .lte('snapshot_date', fmt(today));
    const annualKg = (snapshots ?? []).reduce(
      (sum, row: any) => sum + Number(row.value ?? 0),
      0,
    );
    const annualTonnes = annualKg / 1000;

    // Packaging tonnage + material breakdown. Try to pull from BOM data if
    // available. We heuristically infer material from packaging_category +
    // product type; if the schema isn't populated, the calculator surfaces
    // "assumed" flags so the UI can nudge the user to fill it in.
    const { data: pcfs } = await svc
      .from('product_carbon_footprints')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'completed');
    const pcfIds = (pcfs ?? []).map(p => p.id);

    let plasticPackagingT = 0;
    let recycledShare = 0;
    const byMaterial: Record<string, number> = {};

    if (pcfIds.length > 0) {
      // `mass_kg` + an optional `material` column. Different schemas exist --
      // we select widely and reduce defensively.
      const { data: materials } = await svc
        .from('product_carbon_footprint_materials')
        .select(
          'packaging_category, quantity, unit, data_source, packaging_material',
        )
        .in('product_carbon_footprint_id', pcfIds)
        .not('packaging_category', 'is', null);

      let plasticMass = 0;
      let plasticRecycledMass = 0;
      for (const row of (materials ?? []) as Array<any>) {
        const mat = ((row.packaging_material ?? '') as string).toLowerCase();
        // Convert quantity -> tonnes. Only accept rows with explicit mass-like units.
        const unit = ((row.unit ?? '') as string).toLowerCase();
        let tonnes = 0;
        const q = Number(row.quantity ?? 0);
        if (!Number.isFinite(q) || q <= 0) continue;
        if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') tonnes = q / 1000;
        else if (unit === 't' || unit === 'tonne' || unit === 'tonnes') tonnes = q;
        else if (unit === 'g' || unit === 'gram' || unit === 'grams') tonnes = q / 1_000_000;
        else continue;

        const bucket = resolveMaterialBucket(mat, row.packaging_category as string);
        if (bucket) byMaterial[bucket] = (byMaterial[bucket] ?? 0) + tonnes;

        if (bucket === 'plastic') {
          plasticMass += tonnes;
          // Heuristic: if the data_source is 'supplier' we trust the material
          // label; if 'recycled' is in the name, count as recycled.
          if (/recyc/.test(mat)) plasticRecycledMass += tonnes;
        }
      }
      plasticPackagingT = plasticMass;
      recycledShare = plasticMass > 0 ? plasticRecycledMass / plasticMass : 0;
    }

    const input: RegulatoryInput = {
      annual_tonnes_co2e: annualTonnes,
      uk_ets_free_allocation_t: 0, // no free allocation field in DB yet
      cbam_embedded_tonnes: 0,     // no CBAM scope field in DB yet
      plastic_packaging_tonnes: plasticPackagingT,
      plastic_recycled_share: recycledShare,
      packaging_by_material_t: byMaterial,
    };

    const result = calculateRegulatoryExposure(input);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      inputs: input,
      ...result,
    });
  } catch (err: any) {
    console.error('[pulse regulatory-exposure]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}

/** Map a raw material string to one of the canonical EPR buckets. */
function resolveMaterialBucket(
  material: string,
  category: string | null,
): 'paper_card' | 'plastic' | 'glass' | 'aluminium' | 'steel' | 'wood' | null {
  const m = material.toLowerCase();
  if (/plastic|pet|hdpe|ldpe|pp\b|ps\b|pvc/.test(m)) return 'plastic';
  if (/glass/.test(m)) return 'glass';
  if (/aluminium|aluminum/.test(m)) return 'aluminium';
  if (/steel|tin|ferrous/.test(m)) return 'steel';
  if (/paper|card|cardboard|fibre/.test(m)) return 'paper_card';
  if (/wood|timber|pallet/.test(m)) return 'wood';
  // Fall back to packaging_category heuristic.
  if (category === 'container') return 'glass'; // most drinks containers
  if (category === 'label') return 'paper_card';
  if (category === 'closure') return 'aluminium';
  return null;
}
