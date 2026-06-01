import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Package,
  Building2,
  Network,
  Trophy,
  Gauge,
} from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { loadProcurementDashboard } from '@/lib/procurement/dashboard';
import { PageHeader } from '@/components/procurement/layout/page-header';
import { SectionCard } from '@/components/procurement/layout/section-card';
import { StatCard } from '@/components/procurement/dashboard/stat-card';
import { ChannelPie } from '@/components/procurement/dashboard/channel-pie';
import { CHANNEL_COLOURS as SLICE_COLOURS } from '@/lib/procurement/channel-colours';
import { TierBar } from '@/components/procurement/dashboard/tier-bar';
import { HorizontalBar } from '@/components/procurement/dashboard/horizontal-bar';
import { CompletenessBands } from '@/components/procurement/dashboard/completeness-bands';
import { BrandList } from '@/components/procurement/dashboard/brand-list';
import type { ProcurementOrganization } from '@/types/procurement';

export const dynamic = 'force-dynamic';

export default async function ProcurementDashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = getSupabasePortalServerClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: orgRow } = await sb
    .from('procurement_organizations')
    .select('id, name, display_name, parent_company, trial_ends_at, slug')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!orgRow) redirect(`/procurement/${params.slug}/login?error=org-not-found`);

  const org = orgRow as Pick<
    ProcurementOrganization,
    'id' | 'name' | 'display_name' | 'parent_company' | 'trial_ends_at' | 'slug'
  >;
  const displayName = org.display_name ?? org.name;

  const data = await loadProcurementDashboard(sb, org.id);

  const categoryRows = data.categories.slice(0, 8).map((c) => ({
    label: c.category,
    value: c.sku_count,
  }));
  const countryRows = data.countries.slice(0, 8).map((c) => ({
    label: c.country,
    value: c.sku_count,
  }));

  const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialMeta = trialEnd
    ? `Trial through ${trialEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`
    : 'Setup in progress';

  return (
    <div className="space-y-10">
      <PageHeader
        pill="Dashboard"
        pillIcon={LayoutDashboard}
        title={`${displayName} sustainability portfolio`}
        subtitle="Live view of every brand you procure through linked distributors. Coverage updates as outreach lands."
        meta={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {trialMeta}
            </span>
            {org.parent_company ? <span>· {org.parent_company}</span> : null}
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="SKUs"
          value={data.totals.sku_count.toLocaleString('en-GB')}
          hint="Active across linked distributors"
          icon={Package}
          tone="brand"
        />
        <StatCard
          label="Brands"
          value={data.totals.brand_count.toLocaleString('en-GB')}
          hint="Distinct in portfolio"
          icon={Building2}
          tone="brand"
        />
        <StatCard
          label="Channels"
          value={data.totals.channel_count.toLocaleString('en-GB')}
          hint="Supplying distributors"
          icon={Network}
        />
        <StatCard
          label="Coverage"
          value={data.totals.coverage_pct > 0 ? `${data.totals.coverage_pct.toFixed(1)}%` : 'No data'}
          hint="Average completeness"
          icon={Gauge}
        />
        <StatCard
          label="Leaders"
          value={data.totals.leader_count.toLocaleString('en-GB')}
          hint="Tier 1 brands"
          icon={Trophy}
          tone="success"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Channel split" subtitle="SKUs sourced by distributor channel">
          <ChannelPie channels={data.channels} metric="sku_count" />
          {data.channels.length > 0 ? <ChannelLegend channels={data.channels} /> : null}
        </SectionCard>
        <SectionCard
          title="Sustainability tier"
          subtitle="Brand distribution across tier bands"
        >
          <TierBar tiers={data.tiers} metric="brand_count" />
        </SectionCard>
        <SectionCard
          title="Coverage by completeness"
          subtitle="How well-evidenced each brand is"
        >
          <CompletenessBands bands={data.completeness_bands} />
        </SectionCard>
        <SectionCard
          title="Annual volume by channel"
          subtitle="Procurement litres per channel per year"
        >
          <ChannelPie channels={data.channels} metric="volume_liters" />
        </SectionCard>
        <SectionCard title="Category mix" subtitle="Wine and spirits categories">
          <HorizontalBar data={categoryRows} emptyText="No categories yet" />
        </SectionCard>
        <SectionCard title="Country of origin" subtitle="Top sourcing geographies">
          <HorizontalBar data={countryRows} emptyText="No countries yet" />
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="px-1 space-y-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Top wins
            </h2>
            <p className="text-xs text-muted-foreground">
              Highest-scoring brands in your portfolio. Lean on these in client storytelling.
            </p>
          </div>
          <BrandList
            brands={data.top_wins}
            slug={params.slug}
            emptyText="No scored brands yet. Leaders will surface here once outreach starts."
          />
        </div>
        <div className="space-y-3">
          <div className="px-1 space-y-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Top gaps
            </h2>
            <p className="text-xs text-muted-foreground">
              Lowest-coverage brands weighted by procurement volume. Outreach priority.
            </p>
          </div>
          <BrandList
            brands={data.top_gaps}
            slug={params.slug}
            emptyText="No coverage gaps. Every brand has full data on file."
            showGap
          />
        </div>
      </section>
    </div>
  );
}

function ChannelLegend({
  channels,
}: {
  channels: Array<{ channel: string; sku_count: number; volume_liters: number }>;
}) {
  return (
    <ul className="space-y-1.5 text-xs mt-4 pt-4 border-t border-border/60">
      {channels.map((c, i) => (
        <li key={c.channel} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-sm shrink-0"
            style={{ background: SLICE_COLOURS[i % SLICE_COLOURS.length] }}
          />
          <span className="flex-1 truncate text-foreground/80 font-medium">{c.channel}</span>
          <span className="tabular-nums text-muted-foreground">
            {c.sku_count} SKUs · {Math.round(c.volume_liters).toLocaleString('en-GB')} L
          </span>
        </li>
      ))}
    </ul>
  );
}
