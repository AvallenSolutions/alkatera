'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  href: string;
  loading?: boolean;
  /** When true, an upward trend is good (e.g. compliance %). Default false (e.g. emissions). */
  higherIsBetter?: boolean;
  /**
   * Provenance of this value. Present only when the displayed number was
   * pulled from a historical import (prior sustainability report) rather than
   * operational data. Drives an "Imported" badge so users can tell the
   * difference at a glance.
   */
  source?: 'operational' | 'imported';
}

const statusDotColour: Record<string, string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  neutral: 'bg-slate-400',
};

export function StatCard({
  label,
  value,
  unit,
  trend,
  trendDirection,
  status = 'neutral',
  href,
  loading = false,
  higherIsBetter = false,
  source,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-4 space-y-3">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  // Determine trend chip colour
  const getTrendColour = () => {
    if (!trendDirection || trendDirection === 'stable') return 'text-slate-500';
    const isPositive = higherIsBetter
      ? trendDirection === 'up'
      : trendDirection === 'down';
    return isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  };

  const trendSymbol = trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '—';

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-4 transition-shadow hover:shadow-md"
    >
      {/* Status dot + optional provenance badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-2 w-2 rounded-full', statusDotColour[status])} />
        {source === 'imported' && (
          <span
            title="Value imported from a historical sustainability report — not measured this year"
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300"
          >
            Imported
          </span>
        )}
      </div>

      {/* Value + unit */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>

      {/* Label */}
      <p className="text-sm text-muted-foreground mt-1">{label}</p>

      {/* Trend chip + arrow link */}
      <div className="flex items-center justify-between mt-3">
        {trend !== undefined && trendDirection ? (
          <span className={cn('text-xs font-medium', getTrendColour())}>
            {trendSymbol} {trend}%
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
        <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">→</span>
      </div>
    </Link>
  );
}
