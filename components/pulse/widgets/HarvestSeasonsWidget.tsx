'use client';

/**
 * Pulse -- Harvest season overlay.
 *
 * 12-month strip per crop showing the harvest window, peak weeks and how
 * many weeks until the next peak. Lets the user anticipate seasonal
 * emissions / supply spikes without having to read a viticulture textbook.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Wheat } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CropSeason } from '@/lib/pulse/harvest-seasons';

interface ApiPayload {
  ok: boolean;
  crops: CropSeason[];
  detected_from_corpus: boolean;
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function HarvestSeasonsWidget() {
  const { currentOrganization } = useOrganization();
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

  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-5">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wheat className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">Harvest calendar</h3>
          </div>
          {data?.detected_from_corpus && (
            <span className="rounded-full bg-[#ccff00]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ccff00]">
              Detected from your data
            </span>
          )}
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.crops.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            No matching crops yet. Add product or BOM data so we can detect the
            seasonality of your ingredients.
          </p>
        )}

        {!loading && data && data.crops.length > 0 && (
          <div className="space-y-3">
            {data.crops.map(crop => (
              <CropRow key={crop.key} crop={crop} currentMonth={currentMonth} />
            ))}
            <p className="text-[10px] text-muted-foreground/70">
              Northern-hemisphere windows. Add ±6 months for southern-hemisphere
              suppliers (e.g. Chilean wine, NZ hops).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CropRow({ crop, currentMonth }: { crop: CropSeason; currentMonth: number }) {
  // Compute weeks-until-next-peak for the headline.
  const weeksUntilPeak = useMemo(() => {
    if (crop.peakMonths.length === 0) return null;
    // If today's month is itself a peak, return 0.
    if (crop.peakMonths.includes(currentMonth)) return 0;
    // Find the next peak month -- wrap into next year if needed.
    const sortedPeaks = [...crop.peakMonths].sort((a, b) => a - b);
    const nextPeakMonth = sortedPeaks.find(m => m > currentMonth) ?? (sortedPeaks[0] + 12);
    const monthsAway = nextPeakMonth - currentMonth;
    return Math.round(monthsAway * 4.345);
  }, [crop.peakMonths, currentMonth]);

  const inWindow = crop.windowMonths.includes(currentMonth);
  const inPeak = crop.peakMonths.includes(currentMonth);

  return (
    <div className="rounded-md border border-border/40 bg-card/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{crop.label}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {inPeak
            ? 'Peak now'
            : weeksUntilPeak === null
              ? '—'
              : `Next peak in ~${weeksUntilPeak} wk${weeksUntilPeak === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-12 gap-px overflow-hidden rounded-sm">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
          const isPeak = crop.peakMonths.includes(m);
          const isWindow = crop.windowMonths.includes(m);
          const isCurrent = m === currentMonth;
          return (
            <div
              key={m}
              className={cn(
                'relative flex h-5 items-center justify-center text-[9px] font-medium',
                isPeak
                  ? 'bg-[#ccff00] text-black'
                  : isWindow
                    ? 'bg-[#ccff00]/30 text-foreground'
                    : 'bg-muted text-muted-foreground/60',
              )}
              title={`${MONTH_LABELS[m - 1]}${isPeak ? ' · peak' : isWindow ? ' · in window' : ''}`}
            >
              {MONTH_LABELS[m - 1]}
              {isCurrent && (
                <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-1.5 -translate-x-1/2 rounded-full bg-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">{crop.notes}</p>
      {inWindow && !inPeak && (
        <p className="mt-1 text-[11px] text-amber-500">
          In harvest window — expect inbound emissions and material variability now.
        </p>
      )}
    </div>
  );
}
