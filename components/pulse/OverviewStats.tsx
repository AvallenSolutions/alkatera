'use client';

/**
 * Pulse Overview -- the four numbers under the verdict hero.
 *
 * Exactly four, by design: emissions, what it costs, what needs attention,
 * and the certification goal. Each tile draws its own story: 12-month
 * sparklines on emissions and cost, severity dots on alerts, a progress
 * ring on B Corp, numbers that count up on load. Captioned "today's
 * snapshot" rather than "live" -- honest about the daily update cadence.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { isWidgetAllowedForTier, WIDGET_MIN_TIER } from '@/lib/pulse/widget-registry';
import { WidgetLockCard } from '@/components/pulse/WidgetLockCard';
import { useMetricDrill } from '@/lib/pulse/MetricDrillContext';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { Sparkline } from '@/components/pulse/Sparkline';
import { cn } from '@/lib/utils';
import { isFiniteNumber, safePct } from '@/lib/pulse/format';

function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

interface Stats {
  emissionsKg: number | null;
  emissionsDeltaPct: number | null;
  emissionsSeries: number[];
  annualCostGbp: number | null;
  costDirection: 'improving' | 'worsening' | 'flat' | null;
  costSeries: number[];
  alertCounts: { high: number; medium: number; low: number } | null;
  bcorpReadiness: number | null;
}

export function OverviewStats({ onOpenMoneyTab }: { onOpenMoneyTab?: () => void }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { openDrill } = useMetricDrill();
  const { tierName } = useSubscription();
  // The £ cost stat is the financial-footprint (Canopy) value surfaced on the
  // all-tier Overview, so it's locked below Canopy (hybrid gating).
  const canSeeCost = isWidgetAllowedForTier('financial-footprint', tierName);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const [snapshots, footprint, anomalies, readiness] = await Promise.allSettled([
        supabase
          .from('metric_snapshots')
          .select('snapshot_date, value')
          .eq('organization_id', orgId)
          .eq('metric_key', 'total_co2e')
          .order('snapshot_date', { ascending: true }),
        fetch(`/api/pulse/financial-footprint?organization_id=${orgId}`).then(r => (r.ok ? r.json() : null)),
        supabase
          .from('dashboard_anomalies')
          .select('severity')
          .eq('organization_id', orgId)
          .eq('status', 'open'),
        fetch('/api/certifications/readiness').then(r => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;

      let emissionsKg: number | null = null;
      let emissionsDeltaPct: number | null = null;
      let emissionsSeries: number[] = [];
      if (snapshots.status === 'fulfilled') {
        const rows = (snapshots.value.data ?? []) as Array<{ snapshot_date: string; value: number }>;
        if (rows.length > 0) {
          const latest = rows[rows.length - 1];
          emissionsKg = Number(latest.value);
          const cutoff = new Date(latest.snapshot_date);
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          const lastYear = rows.filter(r => new Date(r.snapshot_date) >= cutoff);
          emissionsSeries = lastYear.map(r => Number(r.value));
          const prior = rows.filter(r => new Date(r.snapshot_date) <= cutoff).pop();
          if (prior && Number(prior.value) > 0) {
            emissionsDeltaPct = ((emissionsKg - Number(prior.value)) / Number(prior.value)) * 100;
          }
        }
      }

      const fp = footprint.status === 'fulfilled' ? footprint.value : null;
      const costSeries: number[] = Array.isArray(fp?.monthly)
        ? fp.monthly.slice(-12).map((m: any) => Number(m.total_gbp) || 0)
        : [];

      let alertCounts: Stats['alertCounts'] = null;
      if (anomalies.status === 'fulfilled') {
        const rows = (anomalies.value.data ?? []) as Array<{ severity: string }>;
        alertCounts = {
          high: rows.filter(r => r.severity === 'high').length,
          medium: rows.filter(r => r.severity === 'medium').length,
          low: rows.filter(r => r.severity === 'low').length,
        };
      }

      const rd = readiness.status === 'fulfilled' ? readiness.value : null;
      // Year 0 completion, the same formula the readiness engine persists.
      let bcorpReadiness: number | null = null;
      if (rd?.hasCertification && Array.isArray(rd.requirementStatuses)) {
        const year0 = rd.requirementStatuses.filter((rs: any) => rs.applicableFromYear === 0);
        if (year0.length > 0) {
          const met = year0.filter((rs: any) => rs.status === 'passed').length;
          bcorpReadiness = rd.isReadyToSubmit ? 100 : Math.round((met / year0.length) * 100);
        }
      }

      setStats({
        emissionsKg,
        emissionsDeltaPct,
        emissionsSeries,
        annualCostGbp: fp?.trailing_12_months?.total_gbp ?? null,
        costDirection: fp?.year_on_year?.direction ?? null,
        costSeries,
        alertCounts,
        bcorpReadiness,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const totalAlerts = stats?.alertCounts
    ? stats.alertCounts.high + stats.alertCounts.medium + stats.alertCounts.low
    : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Emissions, last 12 months"
        onClick={() => openDrill('total_co2e')}
      >
        <AnimatedCo2 kg={stats?.emissionsKg ?? null} />
        {stats && stats.emissionsSeries.length >= 2 && (
          <Sparkline values={stats.emissionsSeries} stroke="#205E40" height={24} />
        )}
        {stats && isFiniteNumber(stats.emissionsDeltaPct) && (
          <p className={cn('text-xs', stats.emissionsDeltaPct <= 0 ? 'text-studio-good' : 'text-studio-stale')}>
            {safePct(stats.emissionsDeltaPct, 0, { sign: true })} vs a year ago
          </p>
        )}
      </StatTile>

      {canSeeCost ? (
        <StatTile label="What it costs each year" onClick={onOpenMoneyTab}>
          <AnimatedGbp value={stats?.annualCostGbp ?? null} />
          {stats && stats.costSeries.length >= 2 && (
            <Sparkline values={stats.costSeries} stroke="#6F6F68" height={24} />
          )}
          {stats?.costDirection && stats.costDirection !== 'flat' && (
            <p className={cn('text-xs', stats.costDirection === 'improving' ? 'text-studio-good' : 'text-studio-stale')}>
              {stats.costDirection === 'improving' ? 'Falling year on year' : 'Rising year on year'}
            </p>
          )}
        </StatTile>
      ) : (
        <WidgetLockCard label="What it costs each year" minTier={WIDGET_MIN_TIER['financial-footprint']} />
      )}

      <StatTile
        label="Needs attention"
        onClick={() => openDrill({ kind: 'widget', id: 'alerts-inbox' })}
      >
        <AnimatedCount value={totalAlerts} />
        {stats?.alertCounts && totalAlerts !== null && totalAlerts > 0 ? (
          <div className="flex h-6 items-center gap-1">
            {Array.from({ length: Math.min(stats.alertCounts.high, 6) }).map((_, i) => (
              <span key={`h${i}`} className="h-2 w-2 rounded-full bg-studio-stale" />
            ))}
            {Array.from({ length: Math.min(stats.alertCounts.medium, 6) }).map((_, i) => (
              <span key={`m${i}`} className="h-2 w-2 rounded-full bg-studio-attention" />
            ))}
            {Array.from({ length: Math.min(stats.alertCounts.low, 6) }).map((_, i) => (
              <span key={`l${i}`} className="h-2 w-2 rounded-full bg-studio-dim" />
            ))}
          </div>
        ) : (
          <div className="h-6" />
        )}
        <p className={cn('text-xs', totalAlerts === 0 ? 'text-studio-good' : 'text-studio-attention')}>
          {totalAlerts === 0 ? 'No open alerts' : 'open alerts'}
        </p>
      </StatTile>

      {stats?.bcorpReadiness != null ? (
        <Link href="/pulse/targets" className="block">
          <Card className={TILE_CLASS}>
            <CardContent className="flex h-full items-center gap-3 p-4">
              <ReadinessRing pct={stats.bcorpReadiness} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">B Corp readiness</p>
                <p className="mt-0.5 text-xs text-muted-foreground">of first-year requirements</p>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {"Today's snapshot"}
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <StatTile label="B Corp readiness" href="/pulse/targets">
          <p className="text-2xl font-semibold tabular-nums text-muted-foreground">--</p>
          <div className="h-6" />
          <p className="text-xs text-muted-foreground">Start your journey on the Targets page</p>
        </StatTile>
      )}
    </div>
  );
}

const TILE_CLASS =
  'h-full cursor-pointer rounded-[6px] border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-studio-forest/50';

function StatTile({
  label,
  children,
  onClick,
  href,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <CardContent className="flex h-full flex-col gap-1.5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {"Today's snapshot"}
        <ArrowUpRight className="h-3 w-3" />
      </span>
    </CardContent>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={TILE_CLASS}>{body}</Card>
      </Link>
    );
  }
  return (
    <Card className={TILE_CLASS} onClick={onClick} role="button" tabIndex={0}>
      {body}
    </Card>
  );
}

function AnimatedCo2({ kg }: { kg: number | null }) {
  const animated = useAnimatedNumber(kg ?? 0);
  if (kg === null) return <p className="text-2xl font-semibold tabular-nums text-muted-foreground">--</p>;
  const tonnes = animated >= 1000;
  return (
    <p className="text-2xl font-semibold tabular-nums text-foreground">
      {tonnes
        ? `${(animated / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`
        : `${Math.round(animated).toLocaleString('en-GB')} kg`}{' '}
      <span className="text-sm font-normal text-muted-foreground">CO₂e</span>
    </p>
  );
}

function AnimatedGbp({ value }: { value: number | null }) {
  const animated = useAnimatedNumber(value ?? 0);
  if (value === null) return <p className="text-2xl font-semibold tabular-nums text-muted-foreground">--</p>;
  return <p className="text-2xl font-semibold tabular-nums text-foreground">{formatGbp(animated)}</p>;
}

function AnimatedCount({ value }: { value: number | null }) {
  const animated = useAnimatedNumber(value ?? 0, 0.5);
  if (value === null) return <p className="text-2xl font-semibold tabular-nums text-muted-foreground">--</p>;
  return <p className="text-2xl font-semibold tabular-nums text-foreground">{Math.round(animated)}</p>;
}

/** Radial progress ring for the B Corp tile. */
function ReadinessRing({ pct }: { pct: number }) {
  const animated = useAnimatedNumber(pct);
  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, animated));
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0" role="img" aria-label={`B Corp readiness ${Math.round(pct)} percent`}>
      <circle cx="28" cy="28" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/40" opacity={0.3} />
      <circle
        cx="28"
        cy="28"
        r={R}
        fill="none"
        stroke="#205E40"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * CIRC} ${CIRC}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">
        {Math.round(animated)}%
      </text>
    </svg>
  );
}
