'use client';

/**
 * Pulse -- the statement.
 *
 * The page opens the studio way: the verdict as the headline sentence,
 * ending with a full stop, and the three headline figures (emissions over
 * the last 12 months, what it costs each year, what needs attention)
 * standing right as display-bold numbers over mono labels. B Corp readiness
 * follows as a quiet fact row, not a card.
 *
 * Data comes from usePulseVerdict and useOverviewStats: the same fetches
 * the old verdict hero and stat tiles made, re-presented.
 */

import Link from 'next/link';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { FactRow } from '@/components/studio/fact-row';
import { PillButton } from '@/components/studio/pill-button';
import { useMetricDrill } from '@/lib/pulse/MetricDrillContext';
import { useSubscription } from '@/hooks/useSubscription';
import { isWidgetAllowedForTier, WIDGET_MIN_TIER } from '@/lib/pulse/widget-registry';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { isFiniteNumber, safePct } from '@/lib/pulse/format';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { cn } from '@/lib/utils';
import { usePulseVerdict } from './usePulseVerdict';
import { useOverviewStats } from './useOverviewStats';

function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function PulseStatement() {
  const { loading, copy, verdict, availableMetrics, focusMetric, setFocusMetric } = usePulseVerdict();
  const stats = useOverviewStats();
  const { openDrill } = useMetricDrill();
  const { tierName } = useSubscription();
  // The £ cost figure is the financial-footprint (Canopy) value surfaced on
  // the all-tier statement, so it stays locked below Canopy (hybrid gating).
  const canSeeCost = isWidgetAllowedForTier('financial-footprint', tierName);

  const totalAlerts = stats?.alertCounts
    ? stats.alertCounts.high + stats.alertCounts.medium + stats.alertCounts.low
    : null;

  const alertParts = stats?.alertCounts
    ? ([
        stats.alertCounts.high > 0 ? `${stats.alertCounts.high} high` : null,
        stats.alertCounts.medium > 0 ? `${stats.alertCounts.medium} medium` : null,
        stats.alertCounts.low > 0 ? `${stats.alertCounts.low} low` : null,
      ].filter(Boolean) as string[])
    : [];

  return (
    <div className="space-y-6">
      <Statement
        eyebrow="THE PULSE"
        headline={
          loading ? (
            <span className="inline-block h-[0.9em] w-64 rounded bg-border/60 align-baseline" aria-hidden="true" />
          ) : (
            `${copy.headline}.`
          )
        }
      >
        {/* Emissions, last 12 months: opens the emissions drill. */}
        <button
          type="button"
          onClick={() => openDrill('total_co2e')}
          className="group text-left"
          title="Open the emissions drill-down"
        >
          <AnimatedCo2 kg={stats?.emissionsKg ?? null} />
          <div className="mt-1 h-4">
            {stats && isFiniteNumber(stats.emissionsDeltaPct) && (
              <StateChip tone={stats.emissionsDeltaPct <= 0 ? 'good' : 'stale'}>
                {safePct(stats.emissionsDeltaPct, 0, { sign: true })} vs a year ago
              </StateChip>
            )}
          </div>
        </button>

        {/* What it costs each year: the one money surface is Financial. */}
        {canSeeCost ? (
          <Link href="/pulse/financial/" className="group text-left" title="Open the financial view">
            <AnimatedGbp value={stats?.annualCostGbp ?? null} />
            <div className="mt-1 h-4">
              {stats?.costDirection && stats.costDirection !== 'flat' && (
                <StateChip tone={stats.costDirection === 'improving' ? 'good' : 'stale'}>
                  {stats.costDirection === 'improving' ? 'Falling year on year' : 'Rising year on year'}
                </StateChip>
              )}
            </div>
          </Link>
        ) : (
          <Link href="/settings/" className="group text-left" title="Upgrade to see what your impact costs">
            <BigNumber
              size="display"
              value={<span className="text-muted-foreground">--</span>}
              label="What it costs each year"
            />
            <div className="mt-1 h-4">
              <StateChip tone="quiet">Upgrade to {WIDGET_MIN_TIER['financial-footprint']}</StateChip>
            </div>
          </Link>
        )}

        {/* Needs attention: opens the alerts inbox drill. */}
        <button
          type="button"
          onClick={() => openDrill({ kind: 'widget', id: 'alerts-inbox' })}
          className="group text-left"
          title="Open the alerts inbox"
        >
          <AnimatedCount value={totalAlerts} tone={totalAlerts != null && totalAlerts > 0 ? 'attention' : 'ink'} />
          <div className="mt-1 h-4">
            {totalAlerts !== null && (
              <StateChip tone={totalAlerts === 0 ? 'good' : 'attention'}>
                {totalAlerts === 0 ? 'No open alerts' : alertParts.join(' · ')}
              </StateChip>
            )}
          </div>
        </button>
      </Statement>

      {/* The quiet lines under the statement: what the verdict means, which
          metric it tracks, and the one act it points at. */}
      {!loading && (
        <div className="max-w-2xl space-y-3">
          {availableMetrics.length > 1 && (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
                Tracking
              </span>
              {availableMetrics.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFocusMetric(m)}
                  className={cn(
                    'border-b-2 pb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ease-studio',
                    m === focusMetric
                      ? 'border-room-accent text-room-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {METRIC_DEFINITIONS[m as MetricKey]?.label ?? m}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{copy.sub}</p>
          {verdict.state === 'no_targets' ? (
            <PillButton variant="room" size="sm" href="/pulse/targets">
              Set a target
            </PillButton>
          ) : (
            <Link
              href="/pulse/targets"
              className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent transition-opacity duration-200 ease-studio hover:opacity-70"
            >
              Targets and actions
            </Link>
          )}
        </div>
      )}

      {/* B Corp readiness: a quiet fact row, not a card. */}
      {stats?.bcorpReadiness != null ? (
        <FactRow
          subject="B Corp readiness"
          detail="of first-year requirements met"
          meta={`${stats.bcorpReadiness}%`}
          href="/pulse/targets"
        />
      ) : (
        <FactRow
          subject="B Corp readiness"
          detail="start your journey on the Targets page"
          meta="SET UP"
          href="/pulse/targets"
        />
      )}
    </div>
  );
}

function AnimatedCo2({ kg }: { kg: number | null }) {
  const animated = useAnimatedNumber(kg ?? 0);
  const tonnes = animated >= 1000;
  return (
    <BigNumber
      size="display"
      label="Emissions, last 12 months"
      value={
        kg === null ? (
          <span className="text-muted-foreground">--</span>
        ) : (
          <>
            {tonnes
              ? `${(animated / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`
              : `${Math.round(animated).toLocaleString('en-GB')} kg`}
            <span className="ml-1 text-base font-normal text-muted-foreground">CO₂e</span>
          </>
        )
      }
    />
  );
}

function AnimatedGbp({ value }: { value: number | null }) {
  const animated = useAnimatedNumber(value ?? 0);
  return (
    <BigNumber
      size="display"
      label="What it costs each year"
      value={value === null ? <span className="text-muted-foreground">--</span> : formatGbp(animated)}
    />
  );
}

function AnimatedCount({ value, tone }: { value: number | null; tone: 'attention' | 'ink' }) {
  const animated = useAnimatedNumber(value ?? 0, 0.5);
  return (
    <BigNumber
      size="display"
      label="Needs attention"
      tone={value === null ? 'ink' : tone}
      value={value === null ? <span className="text-muted-foreground">--</span> : Math.round(animated)}
    />
  );
}
