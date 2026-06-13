import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * GET  /api/products/ingredient-matches?organization_id=...   pending suggestions
 * POST /api/products/ingredient-matches                        { action, id }
 *
 * Accept links the ingredient to the supplier product (data_source='supplier',
 * supplier_product_id set), which moves it to Priority 1 in the LCA waterfall
 * on the product's next recalculation. RLS scopes everything to the caller.
 */
export const runtime = 'nodejs';

function getClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const orgId = new URL(request.url).searchParams.get('organization_id');
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('ingredient_match_suggestions')
    .select('id, product_id, product_material_id, supplier_product_id, ingredient_name, supplier_product_name, supplier_name, match_confidence, match_reason, status')
    .eq('organization_id', orgId)
    .eq('status', 'suggested')
    .order('match_confidence', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suggestions: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { id, action } = body as { id?: string; action?: 'accept' | 'dismiss' };
  if (!id || (action !== 'accept' && action !== 'dismiss')) {
    return NextResponse.json({ error: 'id and a valid action required' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: suggestion } = await supabase
    .from('ingredient_match_suggestions')
    .select('id, product_material_id, supplier_product_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (suggestion.status !== 'suggested') {
    return NextResponse.json({ error: 'This suggestion has already been actioned' }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === 'accept') {
    // Link the ingredient to the supplier product. The waterfall reads
    // data_source='supplier' + supplier_product_id as Priority 1.
    const { error: matErr } = await supabase
      .from('product_materials')
      .update({
        supplier_product_id: suggestion.supplier_product_id,
        data_source: 'supplier',
        match_status: 'auto_matched',
        updated_at: now,
      })
      .eq('id', suggestion.product_material_id);
    if (matErr) return NextResponse.json({ error: matErr.message }, { status: 500 });

    const { error: sugErr } = await supabase
      .from('ingredient_match_suggestions')
      .update({ status: 'accepted', accepted_by: userData.user.id, accepted_at: now, updated_at: now })
      .eq('id', id);
    if (sugErr) return NextResponse.json({ error: sugErr.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('ingredient_match_suggestions')
      .update({ status: 'dismissed', updated_at: now })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
