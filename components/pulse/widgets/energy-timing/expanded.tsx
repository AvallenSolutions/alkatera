'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';

interface TimingWindow {
  label: string;
  avgG: number;
}
interface EnergyTiming {
  region: string | null;
  regionName?: string;
  facilityName?: string;
  facilityId?: string;
  hasHalfHourlyData?: boolean;
  currentG?: number | null;
  message?: string;
  timing?: {
    cleanest: TimingWindow | null;
    dirtiest: TimingWindow | null;
    spreadG: number;
    recommendation: string | null;
  };
}

function EnergyTimingExpanded() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<EnergyTiming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pulse/energy-timing?organization_id=${currentOrganization.id}`);
        const body = await res.json();
        if (!cancelled) setData(body as EnergyTiming);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading grid timing…</p>;
  if (!data?.region || !data.timing?.cleanest || !data.timing?.dirtiest) {
    return (
      <p className="text-sm text-muted-foreground">
        {data?.message ?? 'Live grid timing needs a GB facility with a postcode.'}
      </p>
    );
  }

  const { cleanest, dirtiest, spreadG, recommendation } = data.timing;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Based on today&apos;s forecast grid intensity for{' '}
        <span className="font-medium text-foreground">{data.facilityName}</span> ({data.regionName})
        {data.currentG != null && ` · now ≈${Math.round(data.currentG)} g/kWh`}.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cleanest window</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{cleanest.label}</p>
          <p className="text-xs text-muted-foreground">≈{Math.round(cleanest.avgG)} g CO₂/kWh</p>
        </div>
        <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dirtiest window</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{dirtiest.label}</p>
          <p className="text-xs text-muted-foreground">≈{Math.round(dirtiest.avgG)} g CO₂/kWh</p>
        </div>
      </div>

      {recommendation && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#8da300] dark:text-[#ccff00]" />
          <p>{recommendation}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Spread today: <span className="font-medium text-foreground">{Math.round(spreadG)} g/kWh</span> between the
        cleanest and dirtiest 2-hour windows.
        {!data.hasHalfHourlyData &&
          ' Upload half-hourly meter data on the facility to weight this by your actual consumption.'}
      </p>

      {data.facilityId && (
        <Link
          href={`/company/facilities/${data.facilityId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8da300] hover:underline dark:text-[#ccff00]"
        >
          Open the facility Energy &amp; grid tab
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function EnergyTimingExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <EnergyTimingExpanded />, []);
  useRegisterDrillSlot({
    id: 'energy-timing-expanded',
    title: 'Cleanest vs dirtiest windows today',
    order: 11,
    match: (t) => t.kind === 'widget' && t.id === 'energy-timing',
    render: renderer,
  });
  return null;
}
