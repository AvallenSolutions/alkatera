'use client';

/**
 * Pulse -- vitality hero.
 *
 * Answers "how are we doing?" in two seconds, at the top of every persona
 * view. Three parts:
 *   - left:   the vitality score (0-100) + band, coloured by status
 *   - centre: a one-line plain-English verdict
 *   - right:  the annual environmental cost in £ with a year-on-year arrow
 * A thin sparkline of the vitality trend runs along the base.
 *
 * Data comes from the existing endpoints, no new backend:
 *   - /api/vitality/composite        (score, band, verdict, trend)
 *   - /api/pulse/financial-footprint (annual £ + YoY)
 */

import { useEffect, useMemo, useState } from 'react';
import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';

type Band =
  | 'EXCELLENT'
  | 'HEALTHY'
  | 'DEVELOPING'
  | 'EMERGING'
  | 'NEEDS ATTENTION'
  | 'AWAITING DATA';

interface VitalityResp {
  composite: { composite: number | null; band: Band };
  read: { headline: string } | null;
  trend: Array<{ composite: number | null }>;
}

interface FootprintResp {
  currency: string;
  trailing_12_months: { total_gbp: number };
  year_on_year: {
    delta_pct: number | null;
    direction: 'improving' | 'worsening' | 'flat';
  };
}

const BAND_STYLE: Record<Band, { label: string; text: string; ring: string }> = {
  EXCELLENT: { label: 'Excellent', text: 'text-emerald-500', ring: 'border-emerald-500/40' },
  HEALTHY: { label: 'Healthy', text: 'text-emerald-500', ring: 'border-emerald-500/40' },
  DEVELOPING: { label: 'Developing', text: 'text-amber-500', ring: 'border-amber-500/40' },
  EMERGING: { label: 'Emerging', text: 'text-amber-500', ring: 'border-amber-500/40' },
  'NEEDS ATTENTION': { label: 'Needs attention', text: 'text-red-500', ring: 'border-red-500/40' },
  'AWAITING DATA': { label: 'Awaiting data', text: 'text-muted-foreground', ring: 'border-border/60' },
};

function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function PulseVitalityHero() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [vitality, setVitality] = useState<VitalityResp | null>(null);
  const [footprint, setFootprint] = useState<FootprintResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [v, f] = await Promise.allSettled([
        fetch('/api/vitality/composite').then(r => (r.ok ? r.json() : null)),
        fetch(`/api/pulse/financial-footprint?organization_id=${orgId}`).then(r =>
          r.ok ? r.json() : null,
        ),
      ]);
      if (cancelled) return;
      setVitality(v.status === 'fulfilled' ? v.value : null);
      setFootprint(f.status === 'fulfilled' ? f.value : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const score = vitality?.composite?.composite ?? null;
  const band = vitality?.composite?.band ?? 'AWAITING DATA';
  const bandStyle = BAND_STYLE[band] ?? BAND_STYLE['AWAITING DATA'];
  const verdict = vitality?.read?.headline ?? null;

  const trendPath = useMemo(() => {
    const points = (vitality?.trend ?? [])
      .map(p => p.composite)
      .filter((n): n is number => typeof n === 'number');
    return points.length >= 2 ? points : null;
  }, [vitality]);

  const yoy = footprint?.year_on_year;

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80',
      )}
    >
      <CardContent className="relative p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-end"
        >
          <div className="h-56 w-56 -translate-y-12 translate-x-24 rounded-full bg-[#ccff00]/10 blur-3xl dark:bg-[#ccff00]/5" />
        </div>

        <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 bg-background/40',
                bandStyle.ring,
              )}
            >
              {loading ? (
                <div className="h-9 w-12 animate-pulse rounded bg-muted/60" />
              ) : (
                <span className={cn('text-4xl font-semibold tabular-nums', bandStyle.text)}>
                  {score === null ? '--' : Math.round(score)}
                </span>
              )}
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                / 100
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#ccff00]" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Vitality
                </span>
              </div>
              <p className={cn('mt-1 text-xl font-semibold', bandStyle.text)}>
                {bandStyle.label}
              </p>
            </div>
          </div>

          {/* Verdict */}
          <div className="min-w-0 lg:px-4">
            {loading ? (
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted/60" />
            ) : (
              <p className="text-base font-medium leading-snug text-foreground sm:text-lg">
                {verdict ?? 'Add data to see your live vitality verdict.'}
              </p>
            )}
            {trendPath && (
              <div className="mt-3 max-w-[260px]">
                <Sparkline values={trendPath} />
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Vitality trend
                </p>
              </div>
            )}
          </div>

          {/* Annual £ footprint */}
          <div className="lg:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Annual environmental cost
            </p>
            {loading ? (
              <div className="mt-1 h-8 w-28 animate-pulse rounded bg-muted/60 lg:ml-auto" />
            ) : footprint ? (
              <>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                  {formatGbp(footprint.trailing_12_months.total_gbp)}
                </p>
                {yoy && yoy.delta_pct !== null ? (
                  <YoyChip deltaPct={yoy.delta_pct} direction={yoy.direction} />
                ) : (
                  <span className="mt-1 inline-flex text-xs text-muted-foreground/70 lg:justify-end">
                    Building year-on-year
                  </span>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Not available yet</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function YoyChip({
  deltaPct,
  direction,
}: {
  deltaPct: number;
  direction: 'improving' | 'worsening' | 'flat';
}) {
  const Icon = direction === 'improving' ? TrendingDown : direction === 'worsening' ? TrendingUp : Minus;
  const tone =
    direction === 'improving'
      ? 'text-emerald-500'
      : direction === 'worsening'
        ? 'text-red-500'
        : 'text-muted-foreground';
  return (
    <span className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium lg:justify-end', tone)}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(deltaPct).toFixed(1)}% vs prior 12 months
    </span>
  );
}

/** Thin inline-SVG sparkline. No dependency, scales to its container. */
function Sparkline({ values }: { values: number[] }) {
  const w = 260;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#ccff00"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
