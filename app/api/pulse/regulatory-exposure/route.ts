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
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  calculateRegulatoryExposure,
  type RegulatoryInput,
} from '@/lib/pulse/regulatory-exposure';
import { latestValue } from '@/lib/pulse/snapshot-latest';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Member OR active advisor for the requested/selected org.
    const organizationId = await resolveAccessibleOrg(svc, user, orgIdParam);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 403 });
    }

    // Annual emissions in tonnes (from kg snapshots).
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('snapshot_date, value')
      .eq('organization_id', organizationId)
      .eq('metric_key', 'total_co2e')
      .gte('snapshot_date', fmt(start))
      .lte('snapshot_date', fmt(today));
    // total_co2e is a level (calendar-year emissions): take the latest value,
    // not a sum of daily snapshots.
    const annualKg = latestValue((snapshots ?? []) as any[]);
    const annualTonnes = annualKg / 1000;

    // Packaging tonnage + material breakdown. Try to pull from BOM data if
    // available. We heuristically infer material from packaging_category +
    // product type; if the schema isn't populated, the calculator surfaces
    // "assumed" flags so the UI can nudge the user to fill it in.
    const { data: pcfs } = await svc
      .from('product_carbon_footprints')
      .select('id, product_id')
      .eq('organization_id', organizationId)
      .eq('status', 'completed');
    const pcfIds = (pcfs ?? []).map(p => p.id);
    const productByPcf = new Map<string, number>();
    for (const p of pcfs ?? []) if (p.product_id != null) productByPcf.set(p.id as string, Number(p.product_id));

    // Annual production units per product, so per-unit packaging mass scales to
    // an annual tonnage. Prefer logged production; fall back to the product's
    // declared annual volume; 0 means we can't annualise (stays conservative).
    const annualUnitsByProduct = new Map<number, number>();
    const { data: prodLogs } = await svc
      .from('production_logs')
      .select('product_id, units_produced, date')
      .eq('organization_id', organizationId)
      .gte('date', fmt(start));
    for (const r of prodLogs ?? []) {
      const pid = Number(r.product_id);
      const u = Number(r.units_produced ?? 0);
      if (pid && Number.isFinite(u) && u > 0) annualUnitsByProduct.set(pid, (annualUnitsByProduct.get(pid) ?? 0) + u);
    }
    const { data: prods } = await svc
      .from('products')
      .select('id, annual_production_volume')
      .eq('organization_id', organizationId);
    for (const p of prods ?? []) {
      const pid = Number(p.id);
      if (!annualUnitsByProduct.has(pid) && Number(p.annual_production_volume) > 0) {
        annualUnitsByProduct.set(pid, Number(p.annual_production_volume));
      }
    }

    let plasticPackagingT = 0;
    let recycledShare = 0;
    const byMaterial: Record<string, number> = {};

    if (pcfIds.length > 0) {
      const { data: materials } = await svc
        .from('product_carbon_footprint_materials')
        .select(
          'product_carbon_footprint_id, packaging_category, quantity, unit, data_source, packaging_material',
        )
        .in('product_carbon_footprint_id', pcfIds)
        .not('packaging_category', 'is', null);

      let plasticMass = 0;
      let plasticRecycledMass = 0;
      for (const row of (materials ?? []) as Array<any>) {
        const mat = ((row.packaging_material ?? '') as string).toLowerCase();
        // Per-unit mass -> tonnes (only explicit mass-like units).
        const unit = ((row.unit ?? '') as string).toLowerCase();
        let perUnitT = 0;
        const q = Number(row.quantity ?? 0);
        if (!Number.isFinite(q) || q <= 0) continue;
        if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') perUnitT = q / 1000;
        else if (unit === 't' || unit === 'tonne' || unit === 'tonnes') perUnitT = q;
        else if (unit === 'g' || unit === 'gram' || unit === 'grams') perUnitT = q / 1_000_000;
        else continue;

        // Scale per-unit packaging mass by the product's annual production.
        const pid = productByPcf.get(row.product_carbon_footprint_id as string);
        const annualUnits = pid != null ? (annualUnitsByProduct.get(pid) ?? 0) : 0;
        const tonnes = perUnitT * annualUnits;
        if (tonnes <= 0) continue;

        const bucket = resolveMaterialBucket(mat, row.packaging_category as string);
        if (bucket) byMaterial[bucket] = (byMaterial[bucket] ?? 0) + tonnes;

        if (bucket === 'plastic') {
          plasticMass += tonnes;
          if (/recyc/.test(mat)) plasticRecycledMass += tonnes;
        }
      }
      plasticPackagingT = plasticMass;
      recycledShare = plasticMass > 0 ? plasticRecycledMass / plasticMass : 0;
    }

    const input: RegulatoryInput = {
      annual_tonnes_co2e: annualTonnes,
      uk_ets_covered: false,       // drinks producers are below the ETS threshold
      uk_ets_free_allocation_t: 0,
      cbam_embedded_tonnes: 0,     // no CBAM scope field in DB yet
      plastic_packaging_tonnes: plasticPackagingT,
      plastic_recycled_share: recycledShare,
      packaging_by_material_t: byMaterial,
      // annual_turnover_gbp omitted — EPR size test falls back to tonnage
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
