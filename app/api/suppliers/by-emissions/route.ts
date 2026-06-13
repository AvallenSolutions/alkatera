import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * GET /api/suppliers/by-emissions?organization_id=...
 *
 * Rolls Xero spend-based emissions up per linked supplier so a brand can see
 * which suppliers carry the most impact and act on them. Joins
 * xero_transactions -> xero_supplier_links -> suppliers in application code
 * (PostgREST can't group a three-table join cleanly), under RLS.
 *
 * Returns suppliers ranked by spend-based emissions desc.
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

  // RLS limits these to orgs the caller can see; the org filter scopes to the
  // one the page is showing (a caller can't read an org they don't belong to).
  const [linksRes, suppliersRes, txRes, esgRes] = await Promise.all([
    supabase
      .from('xero_supplier_links')
      .select('supplier_id, xero_contact_id, total_spend')
      .eq('organization_id', orgId)
      .not('supplier_id', 'is', null),
    supabase
      .from('suppliers')
      .select('id, name, supplier_tier, esg_assessment_id')
      .eq('organization_id', orgId),
    supabase
      .from('xero_transactions')
      .select('xero_contact_id, spend_based_emissions_kg')
      .eq('organization_id', orgId),
    supabase
      .from('supplier_esg_assessments')
      .select('id, supplier_id, submitted'),
  ]);

  if (linksRes.error) return NextResponse.json({ error: linksRes.error.message }, { status: 500 });

  // Emissions per Xero contact.
  const emissionsByContact = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    const cid = t.xero_contact_id as string | null;
    if (!cid) continue;
    emissionsByContact.set(cid, (emissionsByContact.get(cid) ?? 0) + (Number(t.spend_based_emissions_kg) || 0));
  }

  // ESG status per supplier.
  const esgBySupplier = new Map<string, boolean>();
  for (const a of esgRes.data ?? []) {
    if (a.supplier_id) esgBySupplier.set(String(a.supplier_id), Boolean(a.submitted));
  }

  const supplierMeta = new Map<string, { name: string; tier: string | null; hasEsg: boolean }>();
  for (const s of suppliersRes.data ?? []) {
    supplierMeta.set(String(s.id), {
      name: s.name as string,
      tier: (s.supplier_tier as string | null) ?? null,
      hasEsg: Boolean(s.esg_assessment_id) || esgBySupplier.has(String(s.id)),
    });
  }

  // Aggregate links per supplier (a supplier may map to several Xero contacts).
  const bySupplier = new Map<string, { spend: number; emissions: number }>();
  for (const link of linksRes.data ?? []) {
    const sid = link.supplier_id ? String(link.supplier_id) : null;
    if (!sid) continue;
    const agg = bySupplier.get(sid) ?? { spend: 0, emissions: 0 };
    agg.spend += Number(link.total_spend) || 0;
    if (link.xero_contact_id) agg.emissions += emissionsByContact.get(link.xero_contact_id as string) ?? 0;
    bySupplier.set(sid, agg);
  }

  const suppliers = Array.from(bySupplier.entries())
    .map(([id, agg]) => {
      const meta = supplierMeta.get(id);
      return {
        id,
        name: meta?.name ?? 'Unknown supplier',
        annualSpendGbp: Math.round(agg.spend),
        spendEmissionsKg: Math.round(agg.emissions),
        tier: meta?.tier ?? null,
        esgSubmitted: meta?.hasEsg ?? false,
      };
    })
    .filter((s) => supplierMeta.has(s.id))
    .sort((a, b) => b.spendEmissionsKg - a.spendEmissionsKg || b.annualSpendGbp - a.annualSpendGbp);

  return NextResponse.json({ suppliers });
}
