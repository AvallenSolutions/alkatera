'use client';

/**
 * Ranked breakdown list matching the Pulse "top cost drivers" pattern: a rank
 * badge, a primary/secondary label, the value right-aligned, and a share bar
 * under each row. Used for top products and per-venue breakdowns.
 */

import { cn } from '@/lib/utils';

export interface RankListRow {
  key: string;
  primary: string;
  secondary?: string | null;
  value: number;
  /** Optional right-hand context (e.g. "120 served"). */
  meta?: string | null;
}

export function HospitalityRankList({
  rows,
  formatValue,
  barClassName = 'bg-[#ccff00]',
  emptyLabel = 'No data yet.',
}: {
  rows: RankListRow[];
  formatValue: (n: number) => string;
  barClassName?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const pct = (r.value / total) * 100;
        const barPct = (r.value / max) * 100;
        return (
          <li key={r.key} className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.primary}</p>
                {r.secondary && <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatValue(r.value)}</p>
                {r.meta && <p className="text-[10px] text-muted-foreground">{r.meta}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', barClassName)} style={{ width: `${barPct}%` }} />
              </div>
              <span className="w-10 flex-shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {pct.toFixed(0)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
