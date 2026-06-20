'use client';

/**
 * Hospitality impact overview — a Pulse-quality summary of the hospitality
 * footprint: headline contribution with a year-on-year verdict and monthly
 * trend, a food/room split, stat tiles, a per-kind breakdown, top products and
 * per-venue rankings, a monthly trend chart, and data-coverage nudges.
 *
 * Reads the aggregated read model from /api/hospitality/dashboard.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Leaf,
  UtensilsCrossed,
  Wine,
  BedDouble,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Trophy,
  Store,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/pulse/Sparkline';
import { HospitalityStatCard, type StatTone } from './HospitalityStatCard';
import { HospitalityRankList, type RankListRow } from './HospitalityRankList';

type Kind = 'hospitality_meal' | 'hospitality_drink' | 'hospitality_room_night';

interface KindBreakdown {
  kind: Kind;
  contribution: number;
  units: number;
  product_count: number;
  costed_count: number;
  avg_per_cover: number | null;
}
interface RankRow {
  id: string;
  name: string;
  sub?: string | null;
  contribution: number;
  units: number;
}
interface Dashboard {
  year: number;
  total: number;
  food: number;
  supplies: number;
  volume_rows: number;
  prev_total: number;
  monthly: number[];
  by_kind: KindBreakdown[];
  by_venue: RankRow[];
  top_products: Array<RankRow & { kind: Kind }>;
  coverage: {
    recipes_total: number;
    recipes_costed: number;
    menus: number;
    menus_avg_co2e: number | null;
    venues: number;
    has_sales: boolean;
  };
}

const KIND_META: Record<Kind, { label: string; plural: string; icon: typeof UtensilsCrossed; href: string }> = {
  hospitality_meal: { label: 'Meal', plural: 'Meals', icon: UtensilsCrossed, href: '/hospitality/meals/' },
  hospitality_drink: { label: 'Drink', plural: 'Drinks', icon: Wine, href: '/hospitality/drinks/' },
  hospitality_room_night: { label: 'Room night', plural: 'Rooms', icon: BedDouble, href: '/hospitality/rooms/' },
};

/** Decimal places that keep small footprints legible (0.04 not 0). */
function kgDigits(kg: number): number {
  if (kg >= 100) return 0;
  if (kg >= 1) return 1;
  return 2;
}
function fmtCo2(kg: number): string {
  if (!Number.isFinite(kg)) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 })} t CO₂e`;
  return `${kg.toLocaleString('en-GB', { maximumFractionDigits: kgDigits(kg) })} kg CO₂e`;
}
function fmtKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 })} t`;
  return `${kg.toLocaleString('en-GB', { maximumFractionDigits: kgDigits(kg) })} kg`;
}
function fmtNum(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function MonthlyBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 0) || 1;
  return (
    <div className="flex h-32 items-end gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end rounded-sm bg-muted/40">
            <div
              className="w-full rounded-sm bg-[#ccff00] transition-all"
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%` }}
              title={fmtCo2(v)}
            />
          </div>
          <span className="text-[9px] text-muted-foreground">{MONTH_LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function HospitalityOverview() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hospitality/dashboard?year=${y}`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch {
      /* leave previous data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  if (loading && !data) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }
  if (!data) return null;

  const { total, food, supplies, prev_total, monthly, by_kind, by_venue, top_products, coverage } = data;
  const foodPct = total > 0 ? (food / total) * 100 : 0;
  const deltaPct = prev_total > 0 ? ((total - prev_total) / prev_total) * 100 : null;
  const yoyTone: StatTone = deltaPct == null ? 'neutral' : deltaPct <= 0 ? 'good' : 'bad';
  const yoyLabel =
    deltaPct == null ? 'No prior year' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}% YoY`;

  const activeKinds = by_kind.filter((k) => k.product_count > 0 || k.contribution > 0);

  // Coverage nudges — surface the most useful next step, Pulse-style.
  const nudges: Array<{ tone: StatTone; text: string; href: string; cta: string }> = [];
  const uncosted = coverage.recipes_total - coverage.recipes_costed;
  if (coverage.recipes_total === 0) {
    nudges.push({ tone: 'neutral', text: 'No recipes yet. Add your meals and drinks to measure their footprint.', href: '/hospitality/meals/', cta: 'Add recipes' });
  } else if (uncosted > 0) {
    nudges.push({ tone: 'warn', text: `${uncosted} recipe${uncosted === 1 ? '' : 's'} have no calculated footprint yet.`, href: '/hospitality/meals/', cta: 'Add quantities' });
  }
  if (!coverage.has_sales) {
    nudges.push({ tone: 'warn', text: `No sales recorded for ${year}. Record volumes so hospitality counts toward your company total.`, href: '/hospitality/sales/', cta: 'Record sales' });
  }
  if (coverage.venues === 0) {
    nudges.push({ tone: 'neutral', text: 'No venues set up. Add a venue to break impact down by location.', href: '/hospitality/venues/', cta: 'Add a venue' });
  }

  const topProductRows: RankListRow[] = top_products.map((p) => ({
    key: p.id,
    primary: p.name,
    secondary: p.sub ?? null,
    value: p.contribution,
    meta: `${fmtNum(p.units)} served`,
  }));
  // Only worth a venue breakdown once sales are attributed to a named venue —
  // otherwise it's a single "Unassigned" row that says nothing.
  const hasNamedVenue = by_venue.some((v) => v.id !== '__none__');
  const venueRows: RankListRow[] = hasNamedVenue
    ? by_venue.map((v) => ({
        key: v.id,
        primary: v.name,
        value: v.contribution,
        meta: `${fmtNum(v.units)} served`,
      }))
    : [];

  return (
    <div className="space-y-4">
      {/* Hero ---------------------------------------------------------------- */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-[#ccff00]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hospitality footprint
              </span>
              <div className="ml-1 flex items-center gap-1 rounded-md border border-border/60 text-muted-foreground">
                <button onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="px-1.5 py-0.5 hover:text-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-medium tabular-nums text-foreground">{year}</span>
                <button onClick={() => setYear((y) => y + 1)} aria-label="Next year" className="px-1.5 py-0.5 hover:text-foreground">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{fmtCo2(total)}</span>
              {deltaPct != null && (
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${yoyTone === 'good' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {yoyTone === 'good' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  {yoyLabel}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Added to your Scope 3 total. Own wines and venue energy are excluded to avoid double-counting.
            </p>

            {/* Food vs room split */}
            <div className="mt-4 max-w-md">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-[#ccff00]" style={{ width: `${foodPct}%` }} />
                <div className="bg-sky-400" style={{ width: `${100 - foodPct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ccff00]" /> Food &amp; drink{' '}
                  <span className="font-medium tabular-nums">{fmtKg(food)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Room consumables{' '}
                  <span className="font-medium tabular-nums">{fmtKg(supplies)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Trend sparkline */}
          {monthly.some((v) => v > 0) && (
            <div className="w-full max-w-xs shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monthly trend</span>
              <div className="mt-2">
                <Sparkline values={monthly} height={56} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat tiles ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HospitalityStatCard
          icon={UtensilsCrossed}
          label="Food &amp; drink"
          headline={fmtKg(food)}
          sub={total > 0 ? `${foodPct.toFixed(0)}% of hospitality` : 'CO₂e this year'}
          status={deltaPct != null ? { tone: yoyTone, label: yoyLabel } : null}
        />
        <HospitalityStatCard
          icon={BedDouble}
          label="Room consumables"
          headline={fmtKg(supplies)}
          sub={total > 0 ? `${(100 - foodPct).toFixed(0)}% of hospitality` : 'CO₂e this year'}
        />
        <HospitalityStatCard
          icon={Leaf}
          label="Recipes costed"
          headline={`${coverage.recipes_costed}/${coverage.recipes_total}`}
          sub="have a calculated footprint"
          status={
            coverage.recipes_total === 0
              ? null
              : coverage.recipes_costed === coverage.recipes_total
              ? { tone: 'good', label: 'Complete' }
              : { tone: 'warn', label: `${coverage.recipes_total - coverage.recipes_costed} to do` }
          }
          href="/hospitality/meals/"
        />
        <HospitalityStatCard
          icon={BookOpen}
          label="Menus"
          headline={fmtNum(coverage.menus)}
          sub={coverage.menus_avg_co2e != null ? `${fmtKg(coverage.menus_avg_co2e)} avg / cover` : 'across your venues'}
          href="/hospitality/menus/"
        />
      </div>

      {/* By kind ------------------------------------------------------------- */}
      {activeKinds.length > 0 && (
        <Panel title="Impact by type">
          <ul className="space-y-3">
            {activeKinds.map((k) => {
              const meta = KIND_META[k.kind];
              const KindIcon = meta.icon;
              const share = total > 0 ? (k.contribution / total) * 100 : 0;
              return (
                <li key={k.kind} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <KindIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{meta.plural}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtNum(k.units)} served · {k.costed_count}/{k.product_count} costed
                        {k.avg_per_cover != null && ` · ${fmtKg(k.avg_per_cover)} avg / cover`}
                      </p>
                    </div>
                    <p className="flex-shrink-0 text-sm font-semibold tabular-nums">{fmtCo2(k.contribution)}</p>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#ccff00]" style={{ width: `${share}%` }} />
                    </div>
                    <span className="w-10 flex-shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                      {share.toFixed(0)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Rankings ------------------------------------------------------------ */}
      {(topProductRows.length > 0 || venueRows.length > 0) && (
        <div className={`grid gap-3 ${topProductRows.length > 0 && venueRows.length > 0 ? 'lg:grid-cols-2' : ''}`}>
          {topProductRows.length > 0 && (
            <Panel
              title="Top contributors"
              action={
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Trophy className="h-3 w-3" /> by CO₂e
                </span>
              }
            >
              <HospitalityRankList rows={topProductRows} formatValue={fmtCo2} />
            </Panel>
          )}
          {venueRows.length > 0 && (
            <Panel
              title="By venue"
              action={
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Store className="h-3 w-3" /> by CO₂e
                </span>
              }
            >
              <HospitalityRankList rows={venueRows} formatValue={fmtCo2} barClassName="bg-sky-400" />
            </Panel>
          )}
        </div>
      )}

      {/* Monthly trend ------------------------------------------------------- */}
      {monthly.some((v) => v > 0) && (
        <Panel title={`Monthly contribution · ${year}`}>
          <MonthlyBars values={monthly} />
        </Panel>
      )}

      {/* Coverage nudges ----------------------------------------------------- */}
      {nudges.length > 0 && (
        <Panel title="Make it count">
          <ul className="space-y-2">
            {nudges.map((n, i) => (
              <li key={i}>
                <Link
                  href={n.href}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-[#ccff00]/50"
                >
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${n.tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="min-w-0 flex-1 text-sm">{n.text}</span>
                  <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-[#ccff00]/90">
                    {n.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
