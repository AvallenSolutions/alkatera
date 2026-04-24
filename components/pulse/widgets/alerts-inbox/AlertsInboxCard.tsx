'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

export function AlertsInboxCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [counts, setCounts] = useState<{ high: number; medium: number; low: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dashboard_anomalies')
        .select('severity, status')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'open');
      if (cancelled) return;
      const high = (data ?? []).filter((r: any) => r.severity === 'high').length;
      const medium = (data ?? []).filter((r: any) => r.severity === 'medium').length;
      const low = (data ?? []).filter((r: any) => r.severity === 'low').length;
      setCounts({ high, medium, low });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const total = (counts?.high ?? 0) + (counts?.medium ?? 0) + (counts?.low ?? 0);
  const status =
    (counts?.high ?? 0) > 0
      ? ({ tone: 'bad' as const, label: `${counts!.high} critical` })
      : total === 0
        ? ({ tone: 'good' as const, label: 'Clear' })
        : ({ tone: 'warn' as const, label: `${total} open` });

  return (
    <PulseCard
      icon={AlertTriangle}
      label="Alerts inbox"
      headline={counts ? `${total}` : '—'}
      sub={total === 1 ? 'open alert' : 'open alerts'}
      status={status}
      footprint="1x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'alerts-inbox' })}
    >
      {counts ? (
        <div className="flex h-full items-center gap-1.5">
          <SeverityPip count={counts.high} colour="bg-red-500" label="High" />
          <SeverityPip count={counts.medium} colour="bg-amber-500" label="Medium" />
          <SeverityPip count={counts.low} colour="bg-slate-400" label="Low" />
        </div>
      ) : null}
    </PulseCard>
  );
}

function SeverityPip({
  count,
  colour,
  label,
}: {
  count: number;
  colour: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span
        className={`h-1.5 w-full rounded-full ${count > 0 ? colour : 'bg-muted'}`}
        title={`${label}: ${count}`}
      />
      <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}
