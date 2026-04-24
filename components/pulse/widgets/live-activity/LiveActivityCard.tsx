'use client';

import { Activity } from 'lucide-react';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { usePulseRealtimeContext } from '@/lib/pulse/PulseRealtimeContext';
import { PulseCard } from '@/components/pulse/PulseCard';

/**
 * Pulse -- Live activity feed, compact card.
 * Headline: latest event title. Supporting: last 3 events as compact rows.
 */
export function LiveActivityCard() {
  const { events, status } = usePulseRealtimeContext();
  const { openDrill } = useWidgetDrill();

  const top3 = events.slice(0, 3);
  const latest = top3[0];

  const pill =
    status === 'live'
      ? ({ tone: 'good' as const, label: 'Live' })
      : status === 'reconnecting'
        ? ({ tone: 'warn' as const, label: 'Reconnecting' })
        : ({ tone: 'neutral' as const, label: 'Connecting' });

  return (
    <PulseCard
      icon={Activity}
      label="Live activity"
      headline={latest ? truncate(latest.description, 40) : 'No activity yet'}
      sub={latest ? timeAgo(latest.occurredAt) : 'Waiting for the first event'}
      status={pill}
      footprint="2x2"
      onExpand={() => openDrill({ kind: 'widget', id: 'live-activity' })}
      footer={events.length > 0 ? `${events.length} event${events.length === 1 ? '' : 's'} this session` : undefined}
    >
      {top3.length > 0 ? (
        <ul className="flex h-full flex-col gap-1.5 text-[11px]">
          {top3.map(e => (
            <li key={e.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-card/30 px-2 py-1">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ccff00]" />
              <span className="min-w-0 flex-1 truncate text-foreground">{e.description}</span>
              <span className="whitespace-nowrap text-muted-foreground">{timeAgo(e.occurredAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Stream idle
        </div>
      )}
    </PulseCard>
  );
}

function timeAgo(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  if (!Number.isFinite(t)) return '';
  const ms = Date.now() - t;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}
