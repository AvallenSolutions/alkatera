'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

interface BenchmarkRow {
  metric_key: MetricKey;
  unit: string;
  org_value: number;
  snapshot_date: string;
  peer: {
    sample_size: number;
    p25: number;
    p50: number;
    p75: number;
    min_value: number;
    max_value: number;
    mean_value: number;
  };
  percentile: number;
}

/**
 * Pulse — PeerBenchmarkWidget
 *
 * Shows the org's percentile rank vs anonymised peers for each metric that
 * meets the k-anonymity threshold (≥5 orgs in the peer set).
 *
 * For metrics where lower is better (emissions), we invert the displayed
 * percentile so "Top 23%" always means "you're doing well".
 */
export function PeerBenchmarkWidget() {
  const { currentOrganization } = useOrganization();
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/pulse/peer-benchmark?organization_id=${currentOrganization.id}`);
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      setRows(body.benchmarks ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col p-0">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">Peer benchmarks</h3>
          </div>
          <span className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">
            Anonymised · k ≥ 5
          </span>
        </header>

        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading benchmarks…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Not enough peers in your segment yet to compute a benchmark. As more orgs accrue snapshots, this lights up.
          </p>
        ) : (
          <ul className="max-h-[480px] divide-y divide-border/40 overflow-y-auto">
            {rows.map(r => (
              <BenchmarkRow key={r.metric_key} row={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BenchmarkRow({ row }: { row: BenchmarkRow }) {
  const def = METRIC_DEFINITIONS[row.metric_key];
  const higherIsBetter = def?.higherIsBetter ?? false;

  // For "lower is better" metrics (emissions, water), invert the displayed
  // percentile so the human-friendly chip always reads as "good vs bad".
  const friendlyPercentile = higherIsBetter ? row.percentile : 100 - row.percentile;
  const friendlyLabel = describePercentile(friendlyPercentile);

  // Position 0..1 of the org marker on the min..max strip.
  const range = row.peer.max_value - row.peer.min_value;
  const orgPos = range === 0 ? 0.5 : Math.min(1, Math.max(0, (row.org_value - row.peer.min_value) / range));

  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{def?.label ?? row.metric_key}</p>
          <p className="text-[11px] text-muted-foreground">
            You: {row.org_value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} {row.unit} · peer median {row.peer.p50.toLocaleString('en-GB', { maximumFractionDigits: 1 })} · n={row.peer.sample_size}
          </p>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', percentileChip(friendlyPercentile))}>
          {friendlyLabel}
        </span>
      </div>

      {/* Distribution strip with org marker */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500/15 via-amber-500/15 to-red-500/15">
        <div
          className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${orgPos * 100}%` }}
          title={`Your value: ${row.org_value}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70">
        <span>min</span>
        <span>p25</span>
        <span>median</span>
        <span>p75</span>
        <span>max</span>
      </div>
    </li>
  );
}

function describePercentile(p: number): string {
  if (p >= 90) return `Top ${Math.round(100 - p)}%`;
  if (p >= 75) return 'Top quartile';
  if (p >= 50) return 'Above median';
  if (p >= 25) return 'Below median';
  return 'Bottom quartile';
}

function percentileChip(p: number): string {
  if (p >= 75) return 'bg-emerald-500/15 text-emerald-500';
  if (p >= 50) return 'bg-[#ccff00]/15 text-[#ccff00]';
  if (p >= 25) return 'bg-amber-500/15 text-amber-500';
  return 'bg-red-500/15 text-red-500';
}
