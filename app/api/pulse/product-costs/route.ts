/**
 * Pulse -- Per-product environmental cost.
 *
 * GET /api/pulse/product-costs?organization_id=...
 *
 * For every completed product LCA (product_carbon_footprints.status = 'completed'),
 * multiply total_ghg_emissions (kg CO2e per functional unit) by the resolved
 * carbon shadow price to get embedded £ per unit.
 *
 * Response shape:
 *   {
 *     currency: 'GBP',
 *     carbon_price_gbp_per_tonne,
 *     products: [
 *       {
 *         product_id, product_name, product_type,
 *         kg_co2e_per_unit, gbp_per_unit, functional_unit,
 *         breakdown: { raw_materials, packaging, transport }
 *       }, ...
 *     ]
 *   }
 *
 * Sorted by £/unit descending so the most carbon-intensive SKUs surface first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import { computeProductEnvCost } from '@/lib/pulse/cost-math';

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

    const prices = await loadShadowPrices(svc, organizationId);
    // Carbon / water shadow multipliers come from the pure cost-math module.
    // Kept here only for the response payload -- the per-unit maths below
    // now delegates to `computeProductEnvCost`.
    const carbon = prices.total_co2e;
    const carbonPriceGbpPerTonne =
      carbon?.currency === 'GBP' ? carbon.price_per_unit : 85;
    const water = prices.water_consumption;
    const waterPriceGbpPerM3 =
      water?.currency === 'GBP' ? water.price_per_unit : 0;
    // Sub-category monetisation (raw materials / packaging / transport) still
    // uses a kg->£ factor so we derive it from the same shadow price.
    const gbpPerKgCo2e = carbonPriceGbpPerTonne / 1000;

    // Note: the scalar `total_ghg_emissions` column was removed in migration
    // 20260203180000_remove_total_ghg_emissions_column.sql. The canonical
    // source is now aggregated_impacts.climate_change_gwp100 (kg CO2e per
    // functional unit). The sub-category totals (raw_materials / packaging /
    // transport) still exist as scalar columns.
    // product_carbon_footprints stores the product name DIRECTLY on the row as
    // `product_name` (denormalised) -- see /reports/lcas/page.tsx line 81 for
    // the canonical read pattern. No join to the `products` table required.
    //
    // We select both 'completed' and 'draft' since drafts hold real carbon
    // data mid-review. The table is versioned (parent_lca_id + lca_version),
    // so a single product can have multiple rows -- we dedupe to the most
    // meaningful version per product_id below.
    const { data: pcfs, error: pcfsErr } = await svc
      .from('product_carbon_footprints')
      .select(
        'id, product_id, product_name, status, lca_version, updated_at, aggregated_impacts, total_ghg_raw_materials, total_ghg_packaging, total_ghg_transport, functional_unit',
      )
      .eq('organization_id', organizationId)
      .in('status', ['completed', 'draft']);

    if (pcfsErr) {
      console.error('[pulse product-costs] PCF fetch failed:', pcfsErr);
      return NextResponse.json(
        { error: `LCA fetch failed: ${pcfsErr.message}` },
        { status: 500 },
      );
    }

    // Dedupe by product_id: each product should appear once. When a product
    // has multiple PCF rows (version history, draft-of-completed, etc.) we
    // prefer 'completed' over 'draft', then the most recently updated row.
    // This matches the dashboard snapshot pattern that counts DISTINCT
    // product_ids with at least one completed PCF.
    const byProduct = new Map<string, any>();
    for (const row of (pcfs ?? []) as Array<any>) {
      const pid = row.product_id as string | null;
      if (!pid) continue;
      const existing = byProduct.get(pid);
      if (!existing) {
        byProduct.set(pid, row);
        continue;
      }
      const existingCompleted = existing.status === 'completed';
      const rowCompleted = row.status === 'completed';
      // Prefer completed; break ties by most recent updated_at.
      if (rowCompleted && !existingCompleted) {
        byProduct.set(pid, row);
      } else if (rowCompleted === existingCompleted) {
        const a = new Date(row.updated_at ?? 0).getTime();
        const b = new Date(existing.updated_at ?? 0).getTime();
        if (a > b) byProduct.set(pid, row);
      }
    }

    const allRows = Array.from(byProduct.values()).map(row => {
      const agg = (row.aggregated_impacts ?? {}) as Record<string, unknown>;

      // Delegate the per-unit £ maths to the pure cost-math helper.
      const env = computeProductEnvCost(
        {
          product_id: row.product_id as string,
          kg_co2e_per_unit: Number(agg.climate_change_gwp100 ?? 0),
          litres_water_per_unit: Number(agg.water_consumption ?? 0),
        },
        prices,
      );
      const { kg_co2e_per_unit: kgCo2e, litres_water_per_unit: litresWater } = env;
      const carbonGbp = env.gbp_carbon;
      const waterGbp = env.gbp_water;
      const gbpPerUnit = env.gbp_per_unit;

      return {
        pcf_id: row.id,
        product_id: row.product_id,
        product_name: row.product_name ?? 'Unknown product',
        product_type: null as string | null, // not denormalised on PCF; omitted
        functional_unit: row.functional_unit ?? 'unit',
        status: row.status as 'completed' | 'draft',
        // Physical impacts per functional unit
        kg_co2e_per_unit: kgCo2e,
        litres_water_per_unit: Number.isFinite(litresWater) ? litresWater : 0,
        // Monetised impacts
        gbp_per_unit: gbpPerUnit,
        gbp_carbon: carbonGbp,
        gbp_water: waterGbp,
        // Carbon sub-breakdown (existing scalar columns -- carbon only).
        breakdown_gbp: {
          raw_materials: Number(row.total_ghg_raw_materials ?? 0) * gbpPerKgCo2e,
          packaging: Number(row.total_ghg_packaging ?? 0) * gbpPerKgCo2e,
          transport: Number(row.total_ghg_transport ?? 0) * gbpPerKgCo2e,
        },
      };
    });

    // Surface "LCA exists but no climate figure yet" as a separate count so
    // the widget can hint at it rather than silently showing nothing.
    const products = allRows.filter(
      p => p.kg_co2e_per_unit > 0 || p.litres_water_per_unit > 0,
    );
    const lcas_without_climate_figure = allRows.length - products.length;

    products.sort((a, b) => b.gbp_per_unit - a.gbp_per_unit);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      currency: 'GBP',
      carbon_price_gbp_per_tonne: carbonPriceGbpPerTonne,
      carbon_price_source: carbon?.source ?? null,
      water_price_gbp_per_m3: waterPriceGbpPerM3,
      water_price_source: water?.source ?? null,
      product_count: products.length,
      lcas_without_climate_figure,
      products,
    });
  } catch (err: any) {
    console.error('[pulse product-costs]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
