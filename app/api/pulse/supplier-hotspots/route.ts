/**
 * Pulse -- Supplier & Scope 3 hotspots.
 *
 * GET /api/pulse/supplier-hotspots?organization_id=...
 *
 * Walks every completed product_carbon_footprints row for the org, joins to
 * product_carbon_footprint_materials, and rolls the impact_climate (kg CO2e)
 * up to two views:
 *
 *   1. By supplier  -- top contributors with cumulative percentage so the UI
 *                      can highlight "your top N suppliers = X% of Scope 3".
 *   2. By category  -- ingredients / packaging / transport buckets.
 *
 * Lives in kg CO2e end-to-end; the widget converts to tonnes for display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

interface MaterialRow {
  product_carbon_footprint_id: string | null;
  impact_climate: number | null;
  packaging_category: string | null;
  data_source: string | null;
  supplier_product_id: string | null;
}

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

    // Step 1: org's completed PCFs.
    const { data: pcfs } = await svc
      .from('product_carbon_footprints')
      .select('id, product_id')
      .eq('organization_id', organizationId)
      .eq('status', 'completed');

    const pcfIds = (pcfs ?? []).map(p => p.id);
    if (pcfIds.length === 0) {
      return NextResponse.json({
        ok: true,
        organization_id: organizationId,
        generated_at: new Date().toISOString(),
        totals: { total_kg_co2e: 0, supplier_attributed_kg_co2e: 0, supplier_coverage_pct: 0 },
        by_supplier: [],
        by_category: [],
        empty_reason: 'No completed product LCAs yet -- supplier hotspots appear once you have at least one finalised PCF.',
      });
    }

    // Step 2: every BOM line item for those PCFs.
    const { data: materials } = await svc
      .from('product_carbon_footprint_materials')
      .select('product_carbon_footprint_id, impact_climate, packaging_category, data_source, supplier_product_id')
      .in('product_carbon_footprint_id', pcfIds);

    const rows = (materials ?? []) as MaterialRow[];

    // Step 3: resolve supplier_product_id -> { supplier_id, name } in one trip.
    const spIds = Array.from(
      new Set(rows.map(r => r.supplier_product_id).filter((x): x is string => Boolean(x))),
    );
    const supplierBySp = new Map<string, { supplier_id: string; supplier_name: string; product_name: string | null }>();
    if (spIds.length > 0) {
      const { data: sps } = await svc
        .from('supplier_products')
        .select('id, supplier_id, product_name, suppliers(id, name)')
        .in('id', spIds);
      for (const sp of (sps ?? []) as Array<any>) {
        if (sp.suppliers) {
          supplierBySp.set(sp.id, {
            supplier_id: sp.suppliers.id,
            supplier_name: sp.suppliers.name ?? 'Unknown supplier',
            product_name: sp.product_name ?? null,
          });
        }
      }
    }

    // Step 4: roll up totals.
    let totalKg = 0;
    let supplierAttributedKg = 0;
    const bySupplier = new Map<
      string,
      { supplier_id: string; supplier_name: string; total_kg: number; line_count: number; products: Set<string> }
    >();
    const byCategory = new Map<string, number>();

    for (const r of rows) {
      const v = Number(r.impact_climate ?? 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      totalKg += v;

      // Category bucket.
      const cat = r.packaging_category
        ? 'packaging'
        : 'ingredients';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + v);

      // Supplier attribution -- only when we can resolve it.
      if (r.supplier_product_id) {
        const sp = supplierBySp.get(r.supplier_product_id);
        if (sp) {
          supplierAttributedKg += v;
          const existing = bySupplier.get(sp.supplier_id);
          if (existing) {
            existing.total_kg += v;
            existing.line_count += 1;
            if (sp.product_name) existing.products.add(sp.product_name);
          } else {
            bySupplier.set(sp.supplier_id, {
              supplier_id: sp.supplier_id,
              supplier_name: sp.supplier_name,
              total_kg: v,
              line_count: 1,
              products: new Set(sp.product_name ? [sp.product_name] : []),
            });
          }
        }
      }
    }

    // Sort + take top 10. Compute cumulative % so the UI can show
    // "top N = X% of supplier-attributed Scope 3".
    const supplierRows = Array.from(bySupplier.values())
      .sort((a, b) => b.total_kg - a.total_kg)
      .slice(0, 10)
      .map((r, i, arr) => {
        const cumulative = arr.slice(0, i + 1).reduce((s, x) => s + x.total_kg, 0);
        return {
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          total_kg_co2e: r.total_kg,
          total_t_co2e: r.total_kg / 1000,
          line_count: r.line_count,
          example_products: Array.from(r.products).slice(0, 3),
          pct_of_attributed:
            supplierAttributedKg > 0 ? (r.total_kg / supplierAttributedKg) * 100 : 0,
          cumulative_pct_of_attributed:
            supplierAttributedKg > 0 ? (cumulative / supplierAttributedKg) * 100 : 0,
        };
      });

    const categoryRows = Array.from(byCategory.entries())
      .map(([category, kg]) => ({
        category,
        total_kg_co2e: kg,
        total_t_co2e: kg / 1000,
        pct_of_total: totalKg > 0 ? (kg / totalKg) * 100 : 0,
      }))
      .sort((a, b) => b.total_kg_co2e - a.total_kg_co2e);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      totals: {
        total_kg_co2e: totalKg,
        total_t_co2e: totalKg / 1000,
        supplier_attributed_kg_co2e: supplierAttributedKg,
        supplier_attributed_t_co2e: supplierAttributedKg / 1000,
        supplier_coverage_pct: totalKg > 0 ? (supplierAttributedKg / totalKg) * 100 : 0,
        product_count: pcfIds.length,
      },
      by_supplier: supplierRows,
      by_category: categoryRows,
    });
  } catch (err: any) {
    console.error('[pulse supplier-hotspots]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
