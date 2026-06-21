'use client';

/**
 * Hospitality impact overview — mirrors the Company Vitality (/performance) page
 * exactly: a vitality score ring + 12-week trend hero, then the same four
 * PillarCards (Climate / Water / Waste / Nature) and a Strengths / Improvements
 * summary. Reuses the vitality components so the two dashboards are identical.
 *
 * Reads the aggregated read model from /api/hospitality/dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, UtensilsCrossed, Wine, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { VitalityRing } from '@/components/vitality/VitalityRing';
import { PillarCard, PillarGrid, PerformanceSummary } from '@/components/vitality/PillarCard';

type Kind = 'hospitality_meal' | 'hospitality_drink' | 'hospitality_room_night';

interface KindBreakdown {
  kind: Kind;
  contribution: number;
  units: number;
  product_count: number;
  costed_count: number;
  avg_per_cover: number | null;
}
interface WasteSummary {
  total_kg: number;
  total_co2e: number;
  food_kg: number;
  dry_kg: number;
  food_co2e: number;
  dry_co2e: number;
  diverted_kg: number;
  diversion_rate: number;
}
interface Dashboard {
  year: number;
  total: number;
  food: number;
  supplies: number;
  prev_total: number;
  weekly: { label: string; value: number }[];
  water_litres: number;
  land_m2a: number;
  waste: WasteSummary;
  score: { value: number; label: string; tone: string };
  pillar_scores: { climate: number | null; water: number | null; waste: number | null; nature: number | null };
  by_kind: KindBreakdown[];
  coverage: {
    recipes_total: number;
    recipes_costed: number;
    menus: number;
    venues: number;
    has_sales: boolean;
  };
}

const KIND_LABEL: Record<Kind, string> = {
  hospitality_meal: 'Meals',
  hospitality_drink: 'Drinks',
  hospitality_room_night: 'Rooms',
};
const KIND_ICON: Record<Kind, typeof UtensilsCrossed> = {
  hospitality_meal: UtensilsCrossed,
  hospitality_drink: Wine,
  hospitality_room_night: BedDouble,
};

const AVAILABLE_YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value < 0.1 && value > 0) return value.toExponential(1);
  return value.toFixed(1);
}
function fmtCo2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 })} t`;
  return `${kg.toLocaleString('en-GB', { maximumFractionDigits: kg < 1 ? 2 : kg < 100 ? 1 : 0 })} kg`;
}
function fmtNum(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}
function bandFor(score: number): string {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'developing';
  return 'critical';
}

/** 12-week trend bars — same pattern as the /performance composite chart. */
function WeeklyTrend({ weekly }: { weekly: { label: string; value: number }[] }) {
  const vals = weekly.map((w) => w.value);
  const max = Math.max(...vals, 0) || 1;
  let lastNonZero = -1;
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] > 0) { lastNonZero = i; break; }
  return (
    <div aria-label="12-week footprint trend">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">12-week trend</p>
      <div className="flex items-end gap-1.5 h-20">
        {vals.map((v, i) => {
          const filled = v > 0;
          const heightPct = filled ? Math.max(8, Math.min(100, (v / max) * 100)) : 5;
          return (
            <div key={i} className="flex-1 flex items-end h-full" aria-hidden="true">
              <div
                className={cn('w-full rounded-sm transition-colors', filled ? (i === lastNonZero ? 'opacity-100' : 'opacity-65') : 'opacity-15')}
                style={{ height: `${heightPct}%`, backgroundColor: '#ccff00' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{weekly[0]?.label ?? '12 weeks ago'}</span>
        <span>{weekly[weekly.length - 1]?.label ?? 'Today'}</span>
      </div>
    </div>
  );
}

export function HospitalityOverview() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hospitality/dashboard?year=${y}`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  const { strengths, improvements } = useMemo(() => {
    const strengths: Array<{ text: string }> = [];
    const improvements: Array<{ text: string; priority?: 'high' | 'medium' }> = [];
    if (!data) return { strengths, improvements };
    const { coverage, waste, total, prev_total } = data;
    const uncosted = coverage.recipes_total - coverage.recipes_costed;
    if (coverage.recipes_total > 0 && uncosted === 0) strengths.push({ text: `All ${coverage.recipes_total} recipes have a calculated footprint` });
    if (waste.total_kg > 0 && waste.diversion_rate >= 0.5) strengths.push({ text: `${(waste.diversion_rate * 100).toFixed(0)}% of waste diverted from disposal` });
    if (prev_total > 0 && total < prev_total) strengths.push({ text: `Footprint down ${(((prev_total - total) / prev_total) * 100).toFixed(0)}% year on year` });
    if (coverage.menus > 0) strengths.push({ text: `${coverage.menus} menu${coverage.menus === 1 ? '' : 's'} with live impact` });

    if (coverage.recipes_total === 0) improvements.push({ text: 'Add your meals and drinks to measure their footprint', priority: 'high' });
    else if (uncosted > 0) improvements.push({ text: `${uncosted} recipe${uncosted === 1 ? '' : 's'} need ingredient quantities`, priority: 'high' });
    if (!coverage.has_sales) improvements.push({ text: `Record sales volumes for ${data.year} so hospitality counts toward your total`, priority: 'high' });
    if (waste.total_kg === 0) improvements.push({ text: 'Log food and dry waste to track diversion and disposal emissions', priority: 'medium' });
    else if (waste.diversion_rate < 0.5) improvements.push({ text: `Improve waste diversion (currently ${(waste.diversion_rate * 100).toFixed(0)}%)`, priority: 'medium' });
    return { strengths: strengths.slice(0, 5), improvements: improvements.slice(0, 5) };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { total, prev_total, weekly, water_litres, land_m2a, waste, score, pillar_scores } = data;
  const band = bandFor(score.value);
  const togglePillar = (p: string) => setExpandedPillar(expandedPillar === p ? null : p);

  const waterValue = water_litres >= 1000 ? `${(water_litres / 1000).toFixed(1)}` : water_litres.toFixed(1);
  const waterUnit = water_litres >= 1000 ? 'm³' : 'L';

  return (
    <div className="space-y-6">
      {/* Vitality hero — identical structure to /performance EsgVitalityScoreHero */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hospitality vitality</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold leading-tight">
            {score.value > 0 ? `Your hospitality vitality is ${band}.` : 'Awaiting more data to call your score.'}
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
          <div className="lg:col-span-2 flex flex-col items-center justify-center">
            <VitalityRing score={score.value} size="xl" animated showLabel />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-4">
            {weekly.some((w) => w.value > 0) ? (
              <WeeklyTrend weekly={weekly} />
            ) : (
              <p className="text-xs text-muted-foreground italic">Trend builds up as you record sales and waste over the weeks.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Scope 3 from food &amp; drink, room consumables and waste. Own wines and venue energy are excluded to avoid double-counting.
            </p>
          </div>
        </div>
      </div>

      {/* Action bar — year selector (matches /performance) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y}>{y} Data</option>
            ))}
          </select>
        </div>
      </div>

      {/* Four pillars — same component as /performance, Circularity → Waste */}
      <PillarGrid>
        <PillarCard
          pillar="climate"
          score={pillar_scores.climate}
          value={total > 0 ? formatValue(total / 1000) : '--'}
          unit="tCO₂e"
          showExplainer={false}
          expanded={expandedPillar === 'climate'}
          onToggle={() => togglePillar('climate')}
        >
          <ClimateDeepDive byKind={data.by_kind} total={total} />
        </PillarCard>

        <PillarCard
          pillar="water"
          score={pillar_scores.water}
          value={water_litres > 0 ? waterValue : '--'}
          unit={waterUnit}
          showExplainer={false}
          expanded={expandedPillar === 'water'}
          onToggle={() => togglePillar('water')}
        >
          <p className="text-sm text-muted-foreground">
            Embodied water in the food and drink you served, from each item&apos;s life-cycle assessment. {fmtNum(water_litres)} litres this year.
          </p>
        </PillarCard>

        <PillarCard
          pillar="waste"
          score={pillar_scores.waste}
          value={waste.total_kg > 0 ? (waste.diversion_rate * 100).toFixed(0) : '--'}
          unit="% diverted"
          showExplainer={false}
          expanded={expandedPillar === 'waste'}
          onToggle={() => togglePillar('waste')}
        >
          <WasteDeepDive waste={waste} />
        </PillarCard>

        <PillarCard
          pillar="nature"
          score={pillar_scores.nature}
          value={land_m2a > 0 ? formatValue(land_m2a) : '--'}
          unit="m²a"
          showExplainer={false}
          expanded={expandedPillar === 'nature'}
          onToggle={() => togglePillar('nature')}
        >
          <p className="text-sm text-muted-foreground">
            Land use embodied in the food and drink you served (ReCiPe 2016), a proxy for biodiversity pressure. {formatValue(land_m2a)} m²a this year.
          </p>
        </PillarCard>
      </PillarGrid>

      {/* Strengths & improvements — same component as /performance */}
      <PerformanceSummary strengths={strengths} improvements={improvements} />
    </div>
  );
}

function ClimateDeepDive({ byKind, total }: { byKind: KindBreakdown[]; total: number }) {
  const active = byKind.filter((k) => k.product_count > 0 || k.contribution > 0);
  if (active.length === 0) return <p className="text-sm text-muted-foreground">No calculated recipes yet.</p>;
  return (
    <div className="space-y-3">
      {active.map((k) => {
        const Icon = KIND_ICON[k.kind];
        const share = total > 0 ? (k.contribution / total) * 100 : 0;
        return (
          <div key={k.kind} className="space-y-1">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{KIND_LABEL[k.kind]}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtNum(k.units)} served · {k.costed_count}/{k.product_count} costed
                </p>
              </div>
              <p className="flex-shrink-0 text-sm font-semibold tabular-nums">{fmtCo2(k.contribution)} CO₂e</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WasteDeepDive({ waste }: { waste: WasteSummary }) {
  if (waste.total_kg === 0) {
    return <p className="text-sm text-muted-foreground">No waste logged yet. Use the Waste section to record food and dry waste.</p>;
  }
  const rows = [
    { label: 'Food waste', kg: waste.food_kg, co2e: waste.food_co2e },
    { label: 'Dry waste', kg: waste.dry_kg, co2e: waste.dry_co2e },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = waste.total_kg > 0 ? (r.kg / waste.total_kg) * 100 : 0;
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums">{fmtCo2(r.kg)} · {fmtCo2(r.co2e)} CO₂e</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{(waste.diversion_rate * 100).toFixed(0)}% diverted from disposal.</p>
    </div>
  );
}
