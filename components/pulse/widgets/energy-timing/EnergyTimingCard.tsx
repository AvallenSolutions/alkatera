'use client';

/**
 * Pulse — Energy timing, compact card.
 *
 * Headline: today's cleanest 2-hour grid window for the org's representative GB
 * facility. Supporting: a clean-vs-dirty intensity comparison + the per-kWh
 * saving. The actionable payoff of the regional grid data.
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface TimingWindow {
  label: string;
  avgG: number;
}
interface EnergyTiming {
  region: string | null;
  regionName?: string;
  facilityName?: string;
  message?: string;
  timing?: {
    cleanest: TimingWindow | null;
    dirtiest: TimingWindow | null;
    spreadG: number;
    recommendation: string | null;
  };
}

export function EnergyTimingCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [data, setData] = useState<EnergyTiming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    setLoading(true);
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

  const cleanest = data?.timing?.cleanest ?? null;
  const dirtiest = data?.timing?.dirtiest ?? null;
  const spreadG = data?.timing?.spreadG ?? 0;
  const hasWindow = !!cleanest && !!data?.region;

  const status = hasWindow
    ? spreadG > 20
      ? ({ tone: 'good' as const, label: `save ${Math.round(spreadG)} g/kWh` })
      : ({ tone: 'neutral' as const, label: 'Flat day' })
    : null;

  // Two mini bars (clean vs dirty), scaled to the dirtiest average.
  const maxG = Math.max(cleanest?.avgG ?? 0, dirtiest?.avgG ?? 0, 1);
  const cleanPct = cleanest ? Math.max(4, (cleanest.avgG / maxG) * 100) : 0;
  const dirtyPct = dirtiest ? Math.max(4, (dirtiest.avgG / maxG) * 100) : 0;

  return (
    <PulseCard
      icon={Clock}
      label="Cleanest energy window"
      headline={hasWindow ? cleanest!.label : '—'}
      sub={
        hasWindow
          ? `${data?.regionName ?? data?.region} · ≈${Math.round(cleanest!.avgG)} g/kWh`
          : data?.message ?? 'No GB facility with a postcode'
      }
      status={status}
      footer={
        hasWindow && dirtiest
          ? `Shift flexible load out of ${dirtiest.label} to save ~${Math.round(spreadG)} g/kWh per kWh`
          : undefined
      }
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'energy-timing' })}
    >
      {hasWindow && dirtiest ? (
        <div className="flex h-full flex-col justify-center gap-1.5 px-0.5">
          <Bar label="Cleanest" pct={cleanPct} value={Math.round(cleanest!.avgG)} colour="#205E40" />
          <Bar label="Dirtiest" pct={dirtyPct} value={Math.round(dirtiest.avgG)} colour="#BF4B2A" />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-wider text-muted-foreground/50">
          {data?.region ? 'Flat grid today' : 'Add a GB facility postcode'}
        </div>
      )}
    </PulseCard>
  );
}

function Bar({ label, pct, value, colour }: { label: string; pct: number; value: number; colour: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{value} g</span>
    </div>
  );
}
