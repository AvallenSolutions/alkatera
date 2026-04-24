'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';

interface BenchmarkRow {
  metric_key: string;
  percentile?: number;
}

interface ApiPayload {
  benchmarks: BenchmarkRow[];
}

export function PeerBenchmarkCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/peer-benchmark?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setData(json as ApiPayload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  // Average percentile across the metrics we have benchmarks for.
  const percentiles = (data?.benchmarks ?? [])
    .map(b => b.percentile)
    .filter((p): p is number => typeof p === 'number');
  const avg =
    percentiles.length > 0
      ? Math.round(percentiles.reduce((s, p) => s + p, 0) / percentiles.length)
      : null;

  const status =
    avg !== null
      ? avg >= 75
        ? ({ tone: 'good' as const, label: 'Top quartile' })
        : avg <= 25
          ? ({ tone: 'bad' as const, label: 'Bottom quartile' })
          : ({ tone: 'neutral' as const, label: 'Middle pack' })
      : null;

  return (
    <PulseCard
      icon={BarChart3}
      label="Peer benchmark"
      headline={avg !== null ? `${ordinal(avg)}` : '—'}
      sub={avg !== null ? 'percentile vs peers' : 'Need more data'}
      status={status}
      footprint="1x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'peer-benchmark' })}
    >
      {avg !== null ? (
        <div className="relative flex h-full items-center">
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-red-500/60 via-amber-500/60 to-emerald-500/60" />
          <div
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-sm bg-foreground shadow-[0_0_6px_rgba(204,255,0,0.8)]"
            style={{ left: `calc(${avg}% - 2px)` }}
          />
          <div className={cn('absolute inset-x-0 -bottom-1 flex justify-between text-[9px] text-muted-foreground/60')}>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      ) : null}
    </PulseCard>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
