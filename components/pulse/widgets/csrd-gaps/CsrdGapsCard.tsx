'use client';

import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';

interface ApiPayload {
  summary: { critical: number; warning: number; ok: number };
  results: Array<{ severity: 'critical' | 'warning' | 'ok'; category: string }>;
}

export function CsrdGapsCard() {
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
          `/api/pulse/csrd-gaps?organization_id=${currentOrganization.id}`,
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

  const total = data
    ? data.summary.critical + data.summary.warning + data.summary.ok
    : 0;
  const gapsOpen = data ? data.summary.critical + data.summary.warning : 0;

  const status =
    data && data.summary.critical > 0
      ? ({ tone: 'bad' as const, label: `${data.summary.critical} critical` })
      : data && data.summary.warning > 0
        ? ({ tone: 'warn' as const, label: `${data.summary.warning} warnings` })
        : data
          ? ({ tone: 'good' as const, label: 'Ready' })
          : null;

  return (
    <PulseCard
      icon={FileCheck2}
      label="CSRD readiness"
      headline={data ? `${gapsOpen}` : '—'}
      sub={gapsOpen === 1 ? 'gap open' : 'gaps open'}
      status={status}
      footprint="1x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'csrd-gaps' })}
      footer={data && total > 0 ? `${data.summary.ok}/${total} disclosure points ready` : undefined}
    >
      {data ? (
        <div className="flex h-full flex-col justify-center gap-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {data.summary.critical > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${total > 0 ? (data.summary.critical / total) * 100 : 0}%` }}
              />
            )}
            {data.summary.warning > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${total > 0 ? (data.summary.warning / total) * 100 : 0}%` }}
              />
            )}
            {data.summary.ok > 0 && (
              <div
                className={cn('bg-emerald-500')}
                style={{ width: `${total > 0 ? (data.summary.ok / total) * 100 : 0}%` }}
              />
            )}
          </div>
        </div>
      ) : null}
    </PulseCard>
  );
}
