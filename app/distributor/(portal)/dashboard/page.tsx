import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Building2,
  Package,
  BarChart3,
  AlertTriangle,
  MailCheck,
  Inbox,
  Sparkles,
  TrendingUp,
  Search,
} from 'lucide-react';
import { CompletenessChart } from '@/components/distributor/dashboard/completeness-chart';
import { ActionQueue, type ActionItem } from '@/components/distributor/dashboard/action-queue';
import { FindingActivityPill } from '@/components/distributor/dashboard/finding-activity-pill';

export const dynamic = 'force-dynamic';

export default async function DistributorDashboardPage() {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  const orgId = member?.distributor_org_id;
  if (!orgId) return null;

  // Pull every brand row we need to compute the dashboard. Cheaper than
  // running six count queries because we use the same dataset for the
  // stat cards, the chart, and the action queue. Phase 3: scores live
  // on brand_directory now, so we hydrate them in a second batch keyed
  // by brand_directory_id.
  const { data: brandRows } = await supabase
    .from('brand_profiles')
    .select(
      'id, brand_directory_id, name, outreach_email, outreach_sent_at, first_submission_at, last_submission_at',
    )
    .eq('distributor_org_id', orgId);
  type BrandRow = {
    id: string;
    brand_directory_id: string;
    name: string;
    completeness_score: number | null;
    sustainability_score: number | null;
    score_tier: string | null;
    outreach_email: string | null;
    outreach_sent_at: string | null;
    first_submission_at: string | null;
    last_submission_at: string | null;
  };
  const baseBrands = (brandRows ?? []) as Array<Omit<BrandRow, 'completeness_score' | 'sustainability_score' | 'score_tier'>>;
  const directoryIds = Array.from(new Set(baseBrands.map((b) => b.brand_directory_id)));

  const { data: directoryScoresRaw } = directoryIds.length > 0
    ? await supabase
        .from('brand_directory')
        .select('id, completeness_score, sustainability_score, score_tier')
        .in('id', directoryIds)
    : { data: [] };
  const scoresById = new Map<string, {
    completeness_score: number | null;
    sustainability_score: number | null;
    score_tier: string | null;
  }>();
  for (const row of (directoryScoresRaw ?? []) as Array<{
    id: string;
    completeness_score: number | null;
    sustainability_score: number | null;
    score_tier: string | null;
  }>) {
    scoresById.set(row.id, {
      completeness_score: row.completeness_score,
      sustainability_score: row.sustainability_score,
      score_tier: row.score_tier,
    });
  }
  const brands: BrandRow[] = baseBrands.map((b) => {
    const s = scoresById.get(b.brand_directory_id);
    return {
      ...b,
      completeness_score: s?.completeness_score ?? null,
      sustainability_score: s?.sustainability_score ?? null,
      score_tier: s?.score_tier ?? null,
    };
  });

  const totalBrands = brands.length;
  const totalSkus = await countActiveSkus(supabase, orgId);
  const responded = brands.filter((b) => b.first_submission_at).length;
  const notContacted = brands.filter((b) => !b.outreach_sent_at).length;
  const avgCompleteness = average(
    brands.map((b) => b.completeness_score).filter((v): v is number => v != null),
  );
  const avgVitality = average(
    brands.map((b) => b.sustainability_score).filter((v): v is number => v != null),
  );
  const leaderCount = brands.filter((b) => b.score_tier === 'leader').length;

  const { count: unresolvedConflicts } = await supabase
    .from('brand_data_conflicts')
    .select('id', { count: 'exact', head: true })
    .in(
      'brand_directory_id',
      directoryIds.length > 0 ? directoryIds : ['00000000-0000-0000-0000-000000000000'],
    )
    .is('resolution', null);

  const buckets = bucketize(brands);
  const actions = await buildActionQueue(supabase, brands);

  const { data: lists } = await supabase
    .from('distributor_sku_lists')
    .select('id')
    .eq('distributor_org_id', orgId)
    .limit(1);
  const hasUploaded = (lists ?? []).length > 0;

  // Industry directory totals — used to power the Discover tile in
  // the hero strip below. Both queries are head-only counts so they
  // don't pull rows. Defensive nulls on errors (e.g. product_directory
  // missing in environments where Phase 1 hasn't been applied).
  const [{ count: directoryBrandCount }, { count: directoryProductCount }] = await Promise.all([
    supabase
      .from('brand_directory')
      .select('id', { count: 'exact', head: true })
      .eq('discovery_opt_out', false)
      .eq('verification_status', 'verified'),
    supabase
      .from('product_directory')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified'),
  ]);

  return (
    <div className="space-y-10">
      <DashboardHero hasUploaded={hasUploaded} />

      {!hasUploaded && <OnboardingCard />}

      <Link
        href="/distributor/discover"
        className="group block rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent px-5 py-4 hover:from-sky-500/15 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Search className="h-5 w-5 text-sky-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Industry directory</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <strong className="text-foreground tabular-nums">
                {(directoryBrandCount ?? 0).toLocaleString()}
              </strong>{' '}
              brand{(directoryBrandCount ?? 0) === 1 ? '' : 's'} ·{' '}
              <strong className="text-foreground tabular-nums">
                {(directoryProductCount ?? 0).toLocaleString()}
              </strong>{' '}
              product{(directoryProductCount ?? 0) === 1 ? '' : 's'} ready to add to your portfolio.
            </div>
          </div>
          <span className="text-[11px] text-sky-200 font-semibold uppercase tracking-wider">
            Discover →
          </span>
        </div>
      </Link>

      <section className="space-y-4">
        <SectionEyebrow icon={<TrendingUp className="h-3 w-3" />}>
          Portfolio snapshot
        </SectionEyebrow>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total brands"
            value={totalBrands}
            icon={<Building2 className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Total SKUs"
            value={totalSkus}
            icon={<Package className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Avg vitality"
            value={avgVitality != null ? Math.round(avgVitality) : '—'}
            hint={leaderCount > 0 ? `${leaderCount} leader${leaderCount === 1 ? '' : 's'}` : undefined}
            tone="positive"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <StatCard
            label="Avg data"
            value={avgCompleteness != null ? `${Math.round(avgCompleteness)}%` : '—'}
            icon={<BarChart3 className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Responded"
            value={`${responded}/${totalBrands}`}
            icon={<MailCheck className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Conflicts"
            value={unresolvedConflicts ?? 0}
            tone={unresolvedConflicts && unresolvedConflicts > 0 ? 'warn' : 'neutral'}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PanelCard className="lg:col-span-2" title="Completeness distribution" icon={<BarChart3 className="h-4 w-4 text-sky-300" />}>
          {totalBrands === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
              <Inbox className="h-4 w-4 mr-2" /> No brands yet.
            </div>
          ) : (
            <CompletenessChart buckets={buckets} />
          )}
        </PanelCard>

        <PanelCard title="Outreach pipeline" icon={<MailCheck className="h-4 w-4 text-sky-300" />}>
          <div className="space-y-2.5 text-sm">
            <PipelineRow label="Not yet contacted" value={notContacted} dotColour="bg-muted-foreground/50" />
            <PipelineRow
              label="Sent, awaiting reply"
              value={brands.filter((b) => b.outreach_sent_at && !b.first_submission_at).length}
              dotColour="bg-amber-400"
            />
            <PipelineRow label="Responded" value={responded} dotColour="bg-emerald-400" />
          </div>
        </PanelCard>
      </div>

      <ActionQueue items={actions.slice(0, 5)} />
    </div>
  );
}

function DashboardHero({ hasUploaded }: { hasUploaded: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-7 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            Portfolio overview
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Your sustainability picture across every brand.
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Snapshot of every brand and SKU in your portfolio, scored against 26 sustainability
            fields. Continually refreshed as the data behind each brand grows.
          </p>
          <div className="pt-1">
            <FindingActivityPill />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100">
            <Link href="/distributor/reports">Reports & exports</Link>
          </Button>
          <Button asChild className="bg-sky-400 hover:bg-sky-300 text-black font-semibold">
            <Link href={hasUploaded ? '/distributor/sku-lists/upload' : '/distributor/sku-lists/upload'}>
              Upload product list
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function OnboardingCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 via-card/40 to-card/40 p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
      <div className="flex items-start gap-5">
        <div className="h-12 w-12 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
          <Upload className="h-6 w-6 text-sky-300" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-300">
              Get started
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              Upload your product list to begin
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload a CSV, Excel or PDF and we'll auto-detect brands and SKUs across your portfolio.
            Each new brand kicks off automatic data finding straight away, so you'll see a starting
            picture within minutes.
          </p>
          <div>
            <Button asChild className="bg-sky-400 hover:bg-sky-300 text-black font-semibold">
              <Link href="/distributor/sku-lists/upload">Upload product list</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
      {icon}
      {children}
    </div>
  );
}

function PanelCard({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        {icon && <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">{icon}</div>}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'brand',
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: 'brand' | 'warn' | 'positive' | 'neutral';
  hint?: string;
  icon: React.ReactNode;
}) {
  const palette = {
    brand: {
      bg: 'from-sky-500/10 via-card/40 to-card/40',
      border: 'border-sky-500/30',
      chipBg: 'bg-sky-500/15 border-sky-400/30',
      chipText: 'text-sky-300',
      value: '',
    },
    positive: {
      bg: 'from-emerald-500/10 via-card/40 to-card/40',
      border: 'border-emerald-500/30',
      chipBg: 'bg-emerald-500/15 border-emerald-400/30',
      chipText: 'text-emerald-300',
      value: 'text-emerald-100',
    },
    warn: {
      bg: 'from-amber-500/10 via-card/40 to-card/40',
      border: 'border-amber-500/30',
      chipBg: 'bg-amber-500/15 border-amber-400/30',
      chipText: 'text-amber-300',
      value: 'text-amber-100',
    },
    neutral: {
      bg: 'from-card/60 via-card/40 to-card/40',
      border: 'border-border/60',
      chipBg: 'bg-muted/40 border-border',
      chipText: 'text-muted-foreground',
      value: '',
    },
  }[tone];

  return (
    <div
      className={`rounded-xl border ${palette.border} bg-gradient-to-br ${palette.bg} p-4 transition-transform hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(56,189,248,0.25)]`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className={`rounded-md border ${palette.chipBg} p-1 ${palette.chipText}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-semibold tabular-nums tracking-tight ${palette.value}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function PipelineRow({
  label,
  value,
  dotColour,
}: {
  label: string;
  value: number;
  dotColour: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColour}`} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

async function countActiveSkus(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await supabase
    .from('brand_skus')
    .select('id', { count: 'exact', head: true })
    .eq('distributor_org_id', orgId)
    .eq('listing_status', 'active');
  return count ?? 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function bucketize(brands: Array<{ completeness_score: number | null }>) {
  const buckets = [
    { label: '0–25%', count: 0 },
    { label: '25–50%', count: 0 },
    { label: '50–75%', count: 0 },
    { label: '75–100%', count: 0 },
  ];
  for (const brand of brands) {
    const score = brand.completeness_score ?? 0;
    if (score < 25) buckets[0].count += 1;
    else if (score < 50) buckets[1].count += 1;
    else if (score < 75) buckets[2].count += 1;
    else buckets[3].count += 1;
  }
  return buckets;
}

async function buildActionQueue(
  supabase: SupabaseClient,
  brands: Array<{
    id: string;
    brand_directory_id: string;
    name: string;
    completeness_score: number | null;
    outreach_email: string | null;
    outreach_sent_at: string | null;
    first_submission_at: string | null;
  }>,
): Promise<ActionItem[]> {
  if (brands.length === 0) return [];
  const items: ActionItem[] = [];

  // 1. Conflicts — query the directory-keyed conflict table, then map
  //    back to the listing(s) the distributor sees in their portfolio.
  const directoryIds = Array.from(new Set(brands.map((b) => b.brand_directory_id)));
  const { data: conflicts } = await supabase
    .from('brand_data_conflicts')
    .select('brand_directory_id')
    .in('brand_directory_id', directoryIds)
    .is('resolution', null);
  const conflictCountsByDirectory = new Map<string, number>();
  for (const c of (conflicts ?? []) as Array<{ brand_directory_id: string }>) {
    conflictCountsByDirectory.set(
      c.brand_directory_id,
      (conflictCountsByDirectory.get(c.brand_directory_id) ?? 0) + 1,
    );
  }
  // Surface against this org's listing of the brand. If two listings
  // share one directory entry (rare pre-Phase 4) both surface the same
  // count — acceptable for now since dedup is a Phase 4 concern.
  for (const brand of brands) {
    const count = conflictCountsByDirectory.get(brand.brand_directory_id);
    if (!count) continue;
    items.push({ type: 'conflict', brand_id: brand.id, brand_name: brand.name, count });
  }

  // 2. Stale outreach (>14d, no response).
  const now = Date.now();
  for (const b of brands) {
    if (!b.outreach_sent_at || b.first_submission_at) continue;
    const days = Math.floor((now - new Date(b.outreach_sent_at).getTime()) / (24 * 60 * 60 * 1000));
    if (days < 14) continue;
    if (items.find((i) => i.brand_id === b.id)) continue;
    items.push({ type: 'stale_outreach', brand_id: b.id, brand_name: b.name, days });
  }

  // 3. Brands with no outreach_email set.
  for (const b of brands) {
    if (b.outreach_email) continue;
    if (items.find((i) => i.brand_id === b.id)) continue;
    items.push({ type: 'no_outreach_email', brand_id: b.id, brand_name: b.name });
  }

  // 4. Zero-completeness brands.
  for (const b of brands) {
    if ((b.completeness_score ?? 0) > 0) continue;
    if (items.find((i) => i.brand_id === b.id)) continue;
    items.push({ type: 'zero_completeness', brand_id: b.id, brand_name: b.name });
  }

  return items;
}
