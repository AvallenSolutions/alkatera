'use client';

/**
 * Pulse -- verdict hero.
 *
 * THE five-second answer: are we on track against our targets? Aggregates
 * every active target's trajectory (lib/pulse/forecast.ts) into a worst-of
 * verdict (lib/pulse/verdict.ts) and says it plainly, naming the target in
 * the worst shape. With no targets it shows current emissions and invites
 * setting one.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Hourglass, Target as TargetIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { forecastTrajectory } from '@/lib/pulse/forecast';
import {
  aggregateVerdict,
  buildVerdictCopy,
  type TargetVerdictInput,
  type VerdictState,
} from '@/lib/pulse/verdict';

interface TargetRow {
  id: string;
  metric_key: string;
  target_value: number;
  target_date: string;
}

const STATE_STYLE: Record<VerdictState, { icon: typeof CheckCircle2; text: string; ring: string }> = {
  on_track: { icon: CheckCircle2, text: 'text-emerald-500', ring: 'border-emerald-500/40' },
  at_risk: { icon: AlertTriangle, text: 'text-amber-500', ring: 'border-amber-500/40' },
  off_track: { icon: XCircle, text: 'text-red-500', ring: 'border-red-500/40' },
  insufficient_data: { icon: Hourglass, text: 'text-muted-foreground', ring: 'border-border/60' },
  no_targets: { icon: TargetIcon, text: 'text-muted-foreground', ring: 'border-border/60' },
};

export function PulseVerdictHero() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [loading, setLoading] = useState(true);
  const [verdictInputs, setVerdictInputs] = useState<TargetVerdictInput[]>([]);
  const [emissionsNow, setEmissionsNow] = useState<{ value: number; deltaPct: number | null } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: targetRows } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date')
        .eq('organization_id', orgId)
        .eq('status', 'active');
      const targets = (targetRows ?? []) as TargetRow[];

      const metricKeys = Array.from(new Set([...targets.map(t => t.metric_key), 'total_co2e']));
      const { data: snapshotRows } = await supabase
        .from('metric_snapshots')
        .select('metric_key, snapshot_date, value')
        .eq('organization_id', orgId)
        .in('metric_key', metricKeys)
        .order('snapshot_date', { ascending: true });
      if (cancelled) return;

      const byMetric: Record<string, { date: string; value: number }[]> = {};
      for (const row of snapshotRows ?? []) {
        const key = row.metric_key as string;
        (byMetric[key] ??= []).push({ date: row.snapshot_date as string, value: Number(row.value) });
      }

      setVerdictInputs(
        targets.map(t => {
          const def = METRIC_DEFINITIONS[t.metric_key as MetricKey];
          const { targetStatus } = forecastTrajectory({
            history: byMetric[t.metric_key] ?? [],
            targetDate: t.target_date,
            targetValue: Number(t.target_value),
            higherIsBetter: def?.higherIsBetter ?? false,
          });
          return {
            targetId: t.id,
            metricKey: t.metric_key,
            targetValue: Number(t.target_value),
            targetDate: t.target_date,
            status: targetStatus.status,
            probability: targetStatus.probability,
            gap: targetStatus.gap,
          };
        }),
      );

      // Current emissions + 12-month direction, for the no-targets state.
      const co2 = byMetric['total_co2e'] ?? [];
      if (co2.length > 0) {
        const latest = co2[co2.length - 1].value;
        const yearAgoDate = new Date(co2[co2.length - 1].date);
        yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
        const prior = co2.filter(p => new Date(p.date) <= yearAgoDate).pop();
        setEmissionsNow({
          value: latest,
          deltaPct: prior && prior.value > 0 ? ((latest - prior.value) / prior.value) * 100 : null,
        });
      } else {
        setEmissionsNow(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const verdict = useMemo(() => aggregateVerdict(verdictInputs), [verdictInputs]);
  const copy = useMemo(() => buildVerdictCopy(verdict), [verdict]);
  const style = STATE_STYLE[verdict.state];
  const Icon = style.icon;

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80">
      <CardContent className="relative p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-end">
          <div className="h-56 w-56 -translate-y-12 translate-x-24 rounded-full bg-[#ccff00]/10 blur-3xl dark:bg-[#ccff00]/5" />
        </div>

        <div className="relative flex flex-wrap items-center gap-5">
          <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl border-2 bg-background/40', style.ring)}>
            {loading ? (
              <div className="h-7 w-7 animate-pulse rounded-full bg-muted/60" />
            ) : (
              <Icon className={cn('h-8 w-8', style.text)} aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted/60" />
              </>
            ) : (
              <>
                <h2 className={cn('text-2xl font-semibold', style.text)}>{copy.headline}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{copy.sub}</p>
              </>
            )}
          </div>

          {!loading && verdict.state === 'no_targets' && (
            <div className="flex flex-col items-end gap-2">
              {emissionsNow && (
                <p className="text-sm text-muted-foreground">
                  Emissions now:{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {Math.round(emissionsNow.value).toLocaleString('en-GB')} kg CO2e
                  </span>
                  {emissionsNow.deltaPct !== null && (
                    <span className={cn('ml-1.5 text-xs', emissionsNow.deltaPct <= 0 ? 'text-emerald-500' : 'text-red-500')}>
                      {emissionsNow.deltaPct <= 0 ? '' : '+'}
                      {emissionsNow.deltaPct.toFixed(0)}% vs a year ago
                    </span>
                  )}
                </p>
              )}
              <Button asChild size="sm">
                <Link href="/pulse/targets">Set a target</Link>
              </Button>
            </div>
          )}

          {!loading && verdict.state !== 'no_targets' && (
            <Button asChild size="sm" variant="outline">
              <Link href="/pulse/targets">Targets &amp; actions</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
