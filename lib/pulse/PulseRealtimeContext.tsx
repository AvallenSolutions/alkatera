'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  usePulseRealtime,
  type PulseConnectionStatus,
} from '@/hooks/usePulseRealtime';
import type { PulseEvent } from '@/lib/pulse/realtime-events';

interface PulseRealtimeContextValue {
  events: PulseEvent[];
  status: PulseConnectionStatus;
  lastEventAt: Date | null;
}

const PulseRealtimeContext = createContext<PulseRealtimeContextValue | null>(null);

/**
 * Wrap the Pulse page once at the top, so MetricCard, LiveActivityFeed, and
 * the heartbeat indicator share a single set of Supabase Realtime channels.
 *
 * Without this, every widget that calls usePulseRealtime() would open its own
 * 5 channels — wasteful and confuses Supabase's per-connection limits.
 */
export function PulseRealtimeProvider({ children }: { children: ReactNode }) {
  const value = usePulseRealtime();
  return (
    <PulseRealtimeContext.Provider value={value}>
      {children}
    </PulseRealtimeContext.Provider>
  );
}

export function usePulseRealtimeContext(): PulseRealtimeContextValue {
  const ctx = useContext(PulseRealtimeContext);
  if (!ctx) {
    // Safe fallback for widgets rendered outside Pulse (defensive — should not happen in practice).
    return { events: [], status: 'connecting', lastEventAt: null };
  }
  return ctx;
}
