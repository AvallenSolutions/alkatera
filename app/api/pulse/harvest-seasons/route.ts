/**
 * Pulse -- Harvest seasons.
 *
 * GET /api/pulse/harvest-seasons?organization_id=...
 *
 * Walks the org's products + BOM + supplier-product names and matches them
 * against the curated crop-season library. Returns the upcoming windows so
 * the dashboard can show "wine grape vintage in 5 weeks -- expect inbound
 * transport spike" style overlays.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { HARVEST_SEASONS, relevantCrops } from '@/lib/pulse/harvest-seasons';

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

    // Pull a corpus of free-text names for fuzzy matching:
    //   1. product names + product_type
    //   2. supplier_products.product_name
    //   3. organisations.industry_segment (so a "wine" segment org always
    //      surfaces grape even before any products exist)
    const [products, supplierProducts, org] = await Promise.all([
      svc
        .from('products')
        .select('name, product_type')
        .eq('organization_id', organizationId)
        .limit(500),
      svc
        .from('supplier_products')
        .select('product_name')
        .limit(500),
      svc
        .from('organizations')
        .select('industry_segment')
        .eq('id', organizationId)
        .maybeSingle(),
    ]);

    const corpus: string[] = [];
    for (const p of products.data ?? []) {
      if (p.name) corpus.push(p.name as string);
      if (p.product_type) corpus.push(p.product_type as string);
    }
    for (const sp of supplierProducts.data ?? []) {
      if ((sp as any).product_name) corpus.push((sp as any).product_name as string);
    }
    if (org.data?.industry_segment) corpus.push(org.data.industry_segment as string);

    let crops = relevantCrops(corpus, 8);

    // Fallback: if nothing matched but the org clearly is in drinks, surface
    // the most-common five crops so the widget isn't empty on day one.
    if (crops.length === 0) {
      crops = HARVEST_SEASONS.slice(0, 5);
    }

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      detected_from_corpus: crops.length < HARVEST_SEASONS.length,
      crops,
    });
  } catch (err: any) {
    console.error('[pulse harvest-seasons]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
