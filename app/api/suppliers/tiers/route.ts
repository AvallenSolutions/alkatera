import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { suggestTiers, tier1Summary, type SupplierTier } from '@/lib/suppliers/tiering';

/**
 * GET  /api/suppliers/tiers?organization_id=...   suggested vs current tiers
 * POST /api/suppliers/tiers                         apply { organization_id, tiers: {id: tier|null} }
 *
 * Tiers suppliers by spend materiality (top ~80% of spend = Tier 1). Spend
 * comes from the Xero link total where available, else suppliers.annual_spend.
 * RLS scopes everything to the caller's org.
 */
export const runtime = 'nodejs';

const VALID_TIERS = ['tier_1', 'tier_2', 'tier_3'];

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

  const [suppliersRes, linksRes] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, supplier_tier, annual_spend')
      .eq('organization_id', orgId),
    supabase
      .from('xero_supplier_links')
      .select('supplier_id, total_spend')
      .eq('organization_id', orgId)
      .not('supplier_id', 'is', null),
  ]);
  if (suppliersRes.error) return NextResponse.json({ error: suppliersRes.error.message }, { status: 500 });

  // Xero spend per supplier (sum across linked contacts) takes precedence.
  const xeroSpend = new Map<string, number>();
  for (const l of linksRes.data ?? []) {
    const sid = l.supplier_id ? String(l.supplier_id) : null;
    if (!sid) continue;
    xeroSpend.set(sid, (xeroSpend.get(sid) ?? 0) + (Number(l.total_spend) || 0));
  }

  const suppliers = (suppliersRes.data ?? []).map((s) => ({
    id: String(s.id),
    name: s.name as string,
    currentTier: (s.supplier_tier as SupplierTier | null) ?? null,
    spend: xeroSpend.get(String(s.id)) ?? (Number(s.annual_spend) || 0),
  }));

  const suggestions = suggestTiers(suppliers).map((sug) => ({
    ...sug,
    name: suppliers.find((s) => s.id === sug.id)?.name ?? '',
  }));

  return NextResponse.json({ suggestions, summary: tier1Summary(suggestions) });
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const orgId: string | undefined = body.organization_id;
  const tiers: Record<string, SupplierTier | null> | undefined = body.tiers;
  if (!orgId || !tiers || typeof tiers !== 'object') {
    return NextResponse.json({ error: 'organization_id and tiers required' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Apply each tier; RLS ensures the caller can only update their org's rows,
  // and the org filter is belt-and-braces.
  const entries = Object.entries(tiers);
  for (const [supplierId, tier] of entries) {
    if (tier !== null && !VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 });
    }
    const { error } = await supabase
      .from('suppliers')
      .update({ supplier_tier: tier })
      .eq('id', supplierId)
      .eq('organization_id', orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: entries.length });
}
