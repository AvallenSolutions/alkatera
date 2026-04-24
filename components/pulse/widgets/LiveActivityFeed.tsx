'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Award,
  Factory,
  Gauge,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePulseRealtimeContext } from '@/lib/pulse/PulseRealtimeContext';
import type { PulseEvent, PulseEventKind } from '@/lib/pulse/realtime-events';

const KIND_ICON: Record<PulseEventKind, LucideIcon> = {
  emissions_entry: Factory,
  lca_progress: Award,
  supplier_update: Users,
  production_log: Gauge,
  metric_snapshot: Activity,
};

const KIND_LABEL: Record<PulseEventKind, string> = {
  emissions_entry: 'Emissions',
  lca_progress: 'LCA',
  supplier_update: 'Supplier',
  production_log: 'Production',
  metric_snapshot: 'Snapshot',
};

/**
 * Pulse — LiveActivityFeed
 *
 * Renders a chronological stream of recent realtime events. Newer items
 * slide in at the top with a brief highlight, push older items down, and
 * carry a relative timestamp that auto-refreshes every 15 seconds.
 *
 * Empty state explains how the feed populates so the user knows nothing's
 * broken when their org has had no recent activity.
 */
export function LiveActivityFeed({ limit = 12 }: { limit?: number }) {
  const { events, status } = usePulseRealtimeContext();
  const visible = events.slice(0, limit);

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60">
      <CardContent className="flex flex-col p-0">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">Live activity</h3>
          </div>
          <span className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">
            {status === 'live' ? 'Streaming' : status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </span>
        </header>

        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="max-h-[420px] divide-y divide-border/40 overflow-y-auto">
            <AnimatePresence initial={false}>
              {visible.map(event => (
                <motion.li
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -8, backgroundColor: 'rgba(204,255,0,0.12)' }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    backgroundColor: 'rgba(204,255,0,0)',
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    backgroundColor: { duration: 1.4, ease: 'easeOut' },
                    opacity: { duration: 0.25 },
                    y: { type: 'spring', stiffness: 320, damping: 28 },
                  }}
                >
                  <ActivityRow event={event} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ event }: { event: PulseEvent }) {
  const Icon = KIND_ICON[event.kind];
  const ago = useRelativeTime(event.occurredAt);

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className={cn(
        'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
        kindBadgeClass(event.kind),
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{event.description}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">
            {KIND_LABEL[event.kind]}
          </span>
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {ago}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        Waiting for the first event.
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Anything anyone in your org logs will appear here in real time.
      </p>
    </div>
  );
}

function kindBadgeClass(kind: PulseEventKind): string {
  switch (kind) {
    case 'emissions_entry':
      return 'bg-orange-500/10 text-orange-500';
    case 'lca_progress':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'supplier_update':
      return 'bg-sky-500/10 text-sky-500';
    case 'production_log':
      return 'bg-amber-500/10 text-amber-500';
    case 'metric_snapshot':
      return 'bg-[#ccff00]/15 text-[#ccff00]';
  }
}

/** Returns a short relative-time string and re-renders every 15 seconds. */
function useRelativeTime(date: Date): string {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  return formatRelative(date);
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
