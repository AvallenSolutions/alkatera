'use client';

/**
 * Pulse -- Regulatory exposure, compact card.
 *
 * Headline: total £ annual exposure across all regimes.
 * Supporting: horizontal stacked bar showing each regime's share.
 */

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface RegLine {
  id: string;
  label: string;
  annual_cost_gbp: number;
  assumed: boolean;
}

interface ApiPayload {
  total_annual_gbp: number;
  lines: RegLine[];
}

const LINE_COLOURS: Record<string, string> = {
  uk_ets: '#ccff00',
  cbam: '#38bdf8',
  plastic_tax: '#f59e0b',
  epr: '#c084fc',
};

export function RegulatoryExposureCard() {
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
          `/api/pulse/regulatory-exposure?organization_id=${currentOrganization.id}`,
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

  const needsData = data?.lines.filter(l => l.assumed).length ?? 0;
  const status = needsData > 0
    ? ({ tone: 'warn' as const, label: `${needsData} needs data` })
    : null;

  return (
    <PulseCard
      icon={Scale}
      label="Regulatory exposure"
      headline={data ? formatGbp(data.total_annual_gbp) : '—'}
      sub="UK ETS · CBAM · Plastic Tax · EPR"
      status={status}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'regulatory-exposure' })}
      footer={
        data && data.total_annual_gbp === 0
          ? 'Fill in packaging tonnage + ETS allowance to populate'
          : undefined
      }
    >
      {data && data.total_annual_gbp > 0 ? (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {data.lines
              .filter(l => l.annual_cost_gbp > 0)
              .map(l => (
                <div
                  key={l.id}
                  style={{
                    width: `${(l.annual_cost_gbp / data.total_annual_gbp) * 100}%`,
                    backgroundColor: LINE_COLOURS[l.id] ?? '#94a3b8',
                  }}
                  title={`${l.label}: ${formatGbp(l.annual_cost_gbp)}`}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {data.lines
              .filter(l => l.annual_cost_gbp > 0)
              .map(l => (
                <span key={l.id} className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-sm"
                    style={{ backgroundColor: LINE_COLOURS[l.id] ?? '#94a3b8' }}
                  />
                  <span className="text-foreground">{l.label}</span>
                </span>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Needs data
        </div>
      )}
    </PulseCard>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
