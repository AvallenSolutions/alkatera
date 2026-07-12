'use client';

/**
 * Pulse -- headline figures data hook.
 *
 * The numbers that stand beside the statement: emissions over the last 12
 * months, what the impact costs each year, what needs attention, and the
 * B Corp readiness line. Extracted from the old OverviewStats card grid so
 * the statement can carry the figures; every fetch is preserved.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface PulseOverviewStats {
  emissionsKg: number | null;
  emissionsDeltaPct: number | null;
  emissionsSeries: number[];
  annualCostGbp: number | null;
  costDirection: 'improving' | 'worsening' | 'flat' | null;
  costSeries: number[];
  alertCounts: { high: number; medium: number; low: number } | null;
  bcorpReadiness: number | null;
}

export function useOverviewStats(): PulseOverviewStats | null {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [stats, setStats] = useState<PulseOverviewStats | null>(null);

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

      let alertCounts: PulseOverviewStats['alertCounts'] = null;
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

  return stats;
}
