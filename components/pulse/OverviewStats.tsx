'use client';

/**
 * Pulse Overview -- the four numbers under the verdict hero.
 *
 * Exactly four, by design: emissions, what it costs, what needs attention,
 * and the certification goal. Each tile clicks through to depth (a drill or
 * a tab). Captioned "today's snapshot" rather than "live" -- honest about
 * the daily update cadence.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useMetricDrill } from '@/lib/pulse/MetricDrillContext';
import { cn } from '@/lib/utils';

function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCo2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}

interface Stats {
  emissionsKg: number | null;
  emissionsDeltaPct: number | null;
  annualCostGbp: number | null;
  costDirection: 'improving' | 'worsening' | 'flat' | null;
  openAlerts: number | null;
  bcorpReadiness: number | null;
}

export function OverviewStats({ onOpenMoneyTab }: { onOpenMoneyTab?: () => void }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { openDrill } = useMetricDrill();
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
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'open'),
        fetch('/api/certifications/readiness').then(r => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;

      let emissionsKg: number | null = null;
      let emissionsDeltaPct: number | null = null;
      if (snapshots.status === 'fulfilled') {
        const rows = (snapshots.value.data ?? []) as Array<{ snapshot_date: string; value: number }>;
        if (rows.length > 0) {
          const latest = rows[rows.length - 1];
          emissionsKg = Number(latest.value);
          const yearAgo = new Date(latest.snapshot_date);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          const prior = rows.filter(r => new Date(r.snapshot_date) <= yearAgo).pop();
          if (prior && Number(prior.value) > 0) {
            emissionsDeltaPct = ((emissionsKg - Number(prior.value)) / Number(prior.value)) * 100;
          }
        }
      }

      const fp = footprint.status === 'fulfilled' ? footprint.value : null;
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
        annualCostGbp: fp?.trailing_12_months?.total_gbp ?? null,
        costDirection: fp?.year_on_year?.direction ?? null,
        openAlerts: anomalies.status === 'fulfilled' ? (anomalies.value.count ?? 0) : null,
        bcorpReadiness,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const tiles: Array<{
    key: string;
    label: string;
    value: string;
    sub?: string;
    subTone?: string;
    onClick?: () => void;
    href?: string;
  } | null> = [
    {
      key: 'emissions',
      label: 'Emissions, last 12 months',
      value: stats?.emissionsKg != null ? `${formatCo2(stats.emissionsKg)} CO2e` : '--',
      sub:
        stats?.emissionsDeltaPct != null
          ? `${stats.emissionsDeltaPct <= 0 ? '' : '+'}${stats.emissionsDeltaPct.toFixed(0)}% vs a year ago`
          : undefined,
      subTone: stats?.emissionsDeltaPct != null && stats.emissionsDeltaPct <= 0 ? 'text-emerald-500' : 'text-red-500',
      onClick: () => openDrill('total_co2e'),
    },
    {
      key: 'cost',
      label: 'What it costs each year',
      value: stats?.annualCostGbp != null ? formatGbp(stats.annualCostGbp) : '--',
      sub:
        stats?.costDirection === 'improving'
          ? 'Falling year on year'
          : stats?.costDirection === 'worsening'
            ? 'Rising year on year'
            : undefined,
      subTone: stats?.costDirection === 'improving' ? 'text-emerald-500' : 'text-red-500',
      onClick: onOpenMoneyTab,
    },
    {
      key: 'alerts',
      label: 'Needs attention',
      value: stats?.openAlerts != null ? String(stats.openAlerts) : '--',
      sub: stats?.openAlerts === 0 ? 'No open alerts' : 'open alerts',
      subTone: stats?.openAlerts === 0 ? 'text-emerald-500' : 'text-amber-500',
      onClick: () => openDrill({ kind: 'widget', id: 'alerts-inbox' }),
    },
    stats?.bcorpReadiness != null
      ? {
          key: 'bcorp',
          label: 'B Corp readiness',
          value: `${Math.round(stats.bcorpReadiness)}%`,
          sub: 'of first-year requirements',
          href: '/pulse/targets',
        }
      : null,
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.filter(Boolean).map(tile => {
        const t = tile!;
        const body = (
          <CardContent className="flex h-full flex-col justify-between p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <div className="mt-2">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{t.value}</p>
              {t.sub && <p className={cn('mt-0.5 text-xs', t.subTone ?? 'text-muted-foreground')}>{t.sub}</p>}
            </div>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {"Today's snapshot"}
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </CardContent>
        );
        const className = 'h-full cursor-pointer border-border/60 transition-colors hover:border-[#ccff00]/50';
        return t.href ? (
          <Link key={t.key} href={t.href}>
            <Card className={className}>{body}</Card>
          </Link>
        ) : (
          <Card key={t.key} className={className} onClick={t.onClick} role="button" tabIndex={0}>
            {body}
          </Card>
        );
      })}
    </div>
  );
}
