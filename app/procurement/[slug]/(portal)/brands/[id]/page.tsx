import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Building2 } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { PageHeader } from '@/components/procurement/layout/page-header';
import { SectionCard } from '@/components/procurement/layout/section-card';
import { PillarBreakdown } from '@/components/sustainability/pillar-breakdown';
import { groupByPillar } from '@/lib/sustainability/pillars';

export const dynamic = 'force-dynamic';

const TIER_PILL: Record<string, string> = {
  leader: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  progressing: 'bg-teal-50 text-teal-700 border-teal-200',
  developing: 'bg-amber-50 text-amber-700 border-amber-200',
  insufficient: 'bg-rose-50 text-rose-700 border-rose-200',
};

const TIER_LABEL: Record<string, string> = {
  leader: 'Leader',
  progressing: 'Progressing',
  developing: 'Developing',
  insufficient: 'Insufficient',
};

export default async function ProcurementBrandPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;

  const { data: org } = await supabase
    .from('procurement_organizations')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!org) notFound();
  const orgId = (org as { id: string }).id;

  const { data: dir } = await supabase
    .from('brand_directory')
    .select(
      `id, name, normalized_name, website, country_of_origin, category,
       founding_year, parent_company, description, sustainability_score,
       completeness_score, score_tier, alkatera_org_id`,
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!dir) notFound();

  const brand = dir as {
    id: string;
    name: string;
    website: string | null;
    country_of_origin: string | null;
    category: string | null;
    founding_year: number | null;
    parent_company: string | null;
    description: string | null;
    sustainability_score: number | null;
    completeness_score: number | null;
    score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
    alkatera_org_id: string | null;
  };

  const { data: skuRows } = await supabase
    .from('procurement_skus')
    .select(
      `id, product_name, sku_code, vintage, volume_per_year_liters, list_price_gbp,
       channel_label, source_distributor_org_id, category, country_of_origin`,
    )
    .eq('procurement_org_id', orgId)
    .eq('brand_directory_id', params.id)
    .eq('listing_status', 'active');
  const skus = (skuRows ?? []) as Array<{
    id: string;
    product_name: string;
    sku_code: string | null;
    vintage: number | null;
    volume_per_year_liters: number | null;
    list_price_gbp: number | null;
    channel_label: string;
    source_distributor_org_id: string;
    category: string | null;
    country_of_origin: string | null;
  }>;

  const distributorIds = Array.from(new Set(skus.map((s) => s.source_distributor_org_id)));
  const distributorNames = new Map<string, string>();
  if (distributorIds.length > 0) {
    const { data } = await supabase
      .from('distributor_organizations')
      .select('id, name')
      .in('id', distributorIds);
    for (const d of (data ?? []) as Array<{ id: string; name: string }>) {
      distributorNames.set(d.id, d.name);
    }
  }

  const { data: threshold } = await supabase
    .from('brand_directory')
    .select('procurement_visibility_threshold')
    .eq('id', params.id)
    .maybeSingle();
  const visibilityThreshold =
    (threshold as { procurement_visibility_threshold: number | null } | null)
      ?.procurement_visibility_threshold ?? 0.6;

  type Finding = {
    field_key: string;
    field_value: string | null;
    source_name: string | null;
    confidence: number | null;
    scraped_at: string;
  };
  // Read findings via the procurement RPC, which honours brand data-sharing
  // opt-outs (brand_sharing_preferences) the same way the distributor portal
  // does. Falls back to a direct read if the RPC is not yet deployed.
  let findings: Finding[] | null = null;
  const rpc = await supabase.rpc('get_brand_data_for_procurement', {
    p_procurement_org_id: orgId,
    p_brand_directory_id: params.id,
  });
  if (!rpc.error && Array.isArray(rpc.data)) {
    findings = (rpc.data as Array<{
      field_key: string;
      field_value: string | null;
      source: string | null;
      confidence: number | null;
      scraped_at: string;
    }>).map((r) => ({
      field_key: r.field_key,
      field_value: r.field_value,
      source_name: r.source,
      confidence: r.confidence,
      scraped_at: r.scraped_at,
    }));
  } else {
    const direct = await supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, source_name, confidence, scraped_at')
      .eq('brand_directory_id', params.id)
      .order('scraped_at', { ascending: false })
      .limit(80);
    findings = (direct.data ?? null) as Finding[] | null;
  }
  const visibleMap = new Map<string, Finding>();
  for (const f of (findings ?? []) as Finding[]) {
    if (!f.field_value) continue;
    const passesGate =
      f.source_name === 'brand_verified' ||
      f.source_name === 'alkatera_live' ||
      (f.confidence ?? 0) >= visibilityThreshold;
    if (!passesGate) continue;
    if (!visibleMap.has(f.field_key)) visibleMap.set(f.field_key, f);
  }
  const findingList = Array.from(visibleMap.values());

  const tier = brand.score_tier;
  const meta = (
    <div className="flex items-center gap-2 flex-wrap">
      {brand.alkatera_org_id ? (
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-1">
          alka<strong>tera</strong> customer
        </span>
      ) : null}
      {tier ? (
        <span
          className={`inline-flex text-[10px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-full border ${TIER_PILL[tier] ?? ''}`}
        >
          {TIER_LABEL[tier] ?? tier}
        </span>
      ) : null}
      {brand.country_of_origin ? (
        <span className="text-xs text-muted-foreground">{brand.country_of_origin}</span>
      ) : null}
      {brand.category ? (
        <>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{brand.category}</span>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        pill="Brand detail"
        pillIcon={Building2}
        title={brand.name}
        subtitle={brand.description ?? undefined}
        backHref={`/procurement/${params.slug}/brands`}
        backLabel="Back to brands"
        meta={meta}
        action={
          <div className="flex gap-3">
            <div className="rounded-2xl border border-border/80 bg-card p-4 min-w-[120px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Score
              </div>
              <div className="text-[28px] font-semibold text-foreground tabular-nums leading-none mt-2">
                {brand.sustainability_score != null ? Math.round(brand.sustainability_score) : '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 min-w-[120px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Coverage
              </div>
              <div className="text-[28px] font-semibold text-foreground tabular-nums leading-none mt-2">
                {brand.completeness_score != null ? Math.round(brand.completeness_score) : '—'}
                <span className="text-base text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        }
      />

      <SectionCard
        title={`Procurement SKUs (${skus.length})`}
        subtitle="Active products this brand supplies via your linked distributors"
        contentClassName="p-0"
      >
        {skus.length === 0 ? (
          <div className="py-10 px-6 text-center text-xs text-muted-foreground">
            No active SKUs from this brand.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Product
                </th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  SKU code
                </th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Channel
                </th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Vintage
                </th>
                <th className="text-right px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Volume / yr
                </th>
                <th className="text-right px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  List price
                </th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                  <td className="px-5 py-3.5 font-medium text-foreground">{s.product_name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground tabular-nums">
                    {s.sku_code ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-foreground/70">
                    {distributorNames.get(s.source_distributor_org_id) ?? s.channel_label}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground tabular-nums">
                    {s.vintage ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {s.volume_per_year_liters
                      ? `${s.volume_per_year_liters.toLocaleString('en-GB')} L`
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {s.list_price_gbp ? `£${s.list_price_gbp.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {brand.alkatera_org_id ? (
        <SectionCard
          title={`alka​tera platform data (${findingList.length} metrics)`}
          subtitle="Granular, source-verified data across the six impact pillars, shared directly from this brand's alka​tera account. This is the depth of data a registered brand offers versus a scraped-only listing."
        >
          {findingList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No platform data on file yet.
            </div>
          ) : (
            <PillarBreakdown groups={groupByPillar(findingList)} />
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title={`Public sustainability data (${findingList.length} fields)`}
          subtitle={`Findings gathered from public sources, filtered to confidence ≥ ${Math.round(visibilityThreshold * 100)}%. Register this brand on alka​tera to unlock granular, verified data across all six impact pillars.`}
        >
          {findingList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No public data on file yet. Outreach to this brand will populate this view.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {findingList.map((f) => (
                <div
                  key={f.field_key}
                  className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                    {f.field_key}
                  </div>
                  <div className="text-sm font-medium text-foreground break-words">
                    {f.field_value}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {f.source_name} · {new Date(f.scraped_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
