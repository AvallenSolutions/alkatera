'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import type { MetricKey } from '@/lib/pulse/metric-keys';

export interface MetricSnapshot {
  snapshot_date: string;
  value: number;
  unit: string;
}

export interface MetricSnapshotsResult {
  snapshots: MetricSnapshot[];
  current: MetricSnapshot | null;
  prior: MetricSnapshot | null;
  /** Percentage change from prior to current. Null if prior is missing or zero. */
  deltaPct: number | null;
  trendDirection: 'up' | 'down' | 'stable' | null;
  loading: boolean;
  error: string | null;
}

/**
 * Reads metric_snapshots for the current organisation.
 *
 * @param metricKey  Stable identifier from metric-keys.ts.
 * @param days       Trailing window (default 365). Used for the sparkline range.
 * @param compareDays  How far back the "prior" sample is for delta calc (default 30).
 */
export function useMetricSnapshots(
  metricKey: MetricKey,
  days: number = 365,
  compareDays: number = 30,
): MetricSnapshotsResult {
  const { currentOrganization } = useOrganization();
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('metric_snapshots')
        .select('snapshot_date, value, unit')
        .eq('organization_id', currentOrganization!.id)
        .eq('metric_key', metricKey)
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setSnapshots([]);
      } else {
        setSnapshots((data || []) as MetricSnapshot[]);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, metricKey, days]);

  const current = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  // Find the snapshot closest to (current - compareDays).
  let prior: MetricSnapshot | null = null;
  if (current) {
    const target = new Date(current.snapshot_date);
    target.setUTCDate(target.getUTCDate() - compareDays);
    const targetTime = target.getTime();
    let bestDelta = Infinity;
    for (const s of snapshots) {
      const delta = Math.abs(new Date(s.snapshot_date).getTime() - targetTime);
      if (delta < bestDelta) {
        bestDelta = delta;
        prior = s;
      }
    }
    // Don't compare against itself.
    if (prior && prior.snapshot_date === current.snapshot_date) prior = null;
  }

  const deltaPct =
    current && prior && prior.value !== 0
      ? ((current.value - prior.value) / Math.abs(prior.value)) * 100
      : null;

  const trendDirection: 'up' | 'down' | 'stable' | null =
    deltaPct === null
      ? null
      : Math.abs(deltaPct) < 0.5
        ? 'stable'
        : deltaPct > 0
          ? 'up'
          : 'down';

  return { snapshots, current, prior, deltaPct, trendDirection, loading, error };
}
