'use client';

import { useEffect, useState } from 'react';
import { Wheat } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';
import type { CropSeason } from '@/lib/pulse/harvest-seasons';

interface ApiPayload {
  crops: CropSeason[];
}

export function HarvestSeasonsCard() {
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
          `/api/pulse/harvest-seasons?organization_id=${currentOrganization.id}`,
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

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // Find the next upcoming peak across all tracked crops. Guards against
  // incomplete `CropSeason` payloads (missing peakMonths etc.) so a single
  // malformed crop can't crash the card.
  const next = (() => {
    if (!data?.crops?.length) return null;
    const today = currentMonth;
    let best: { crop: CropSeason; month: number; weeks: number } | null = null;
    for (const crop of data.crops) {
      const peaks = Array.isArray(crop?.peakMonths) ? crop.peakMonths : [];
      if (peaks.length === 0) continue;
      if (peaks.includes(today)) {
        return { crop, month: today, weeks: 0 };
      }
      const sorted = [...peaks].sort((a, b) => a - b);
      const nextMonth = sorted.find(m => m > today) ?? (sorted[0] + 12);
      const weeks = Math.round((nextMonth - today) * 4.345);
      if (!best || weeks < best.weeks) {
        best = { crop, month: nextMonth % 12 || 12, weeks };
      }
    }
    return best;
  })();

  return (
    <PulseCard
      icon={Wheat}
      label="Harvest calendar"
      headline={
        next === null
          ? '—'
          : next.weeks === 0
            ? `${next.crop.label}`
            : `~${next.weeks} wks`
      }
      sub={next === null ? 'No crop data' : next.weeks === 0 ? 'peak now' : `until ${next.crop.label} peak`}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'harvest-seasons' })}
      footer={data ? `${data.crops.length} crop${data.crops.length === 1 ? '' : 's'} tracked` : undefined}
    >
      {data?.crops?.length ? (
        <div className="flex h-full flex-col justify-center">
          {/* 12-month strip of the top crop */}
          <div className="grid grid-cols-12 gap-px">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const crop = data.crops[0];
              const peaks = Array.isArray(crop?.peakMonths) ? crop.peakMonths : [];
              const windows = Array.isArray(crop?.windowMonths) ? crop.windowMonths : [];
              const isPeak = peaks.includes(m);
              const isWindow = windows.includes(m);
              const isCurrent = m === currentMonth;
              return (
                <div
                  key={m}
                  className={cn(
                    'h-4 flex items-center justify-center rounded-sm text-[8px] font-medium',
                    isPeak ? 'bg-[#ccff00] text-black' : isWindow ? 'bg-[#ccff00]/25 text-foreground' : 'bg-muted text-muted-foreground/60',
                    isCurrent && 'ring-1 ring-foreground',
                  )}
                >
                  {'JFMAMJJASOND'[m - 1]}
                </div>
              );
            })}
          </div>
          {data.crops.length > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Top crop: <span className="text-foreground">{data.crops[0].label}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          No crops detected
        </div>
      )}
    </PulseCard>
  );
}
