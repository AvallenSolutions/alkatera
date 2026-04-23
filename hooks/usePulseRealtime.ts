'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import {
  MAX_EVENT_BUFFER,
  normalisePayload,
  type PulseEvent,
} from '@/lib/pulse/realtime-events';

export type PulseConnectionStatus = 'connecting' | 'live' | 'reconnecting';

interface UsePulseRealtimeReturn {
  /** Most recent N events, newest first. */
  events: PulseEvent[];
  /** Aggregate connection state across all subscribed channels. */
  status: PulseConnectionStatus;
  /** When the most recent event arrived. */
  lastEventAt: Date | null;
}

/**
 * Subscribe to live changes across all Pulse-relevant tables and expose
 * a normalised event stream + heartbeat.
 *
 * RLS on each table ensures users only receive events for rows in orgs
 * they belong to. The currentOrganization filter at consumer level
 * (e.g. MetricCard, LiveActivityFeed) further narrows to the active org.
 *
 * Channels watched:
 *   - facility_activity_entries (INSERT, UPDATE)
 *   - product_carbon_footprints (UPDATE only — captures status transitions)
 *   - supplier_products (INSERT, UPDATE)
 *   - production_logs (INSERT)
 *   - metric_snapshots (INSERT, UPDATE — fires after the nightly cron)
 */
export function usePulseRealtime(): UsePulseRealtimeReturn {
  const { currentOrganization } = useOrganization();
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [status, setStatus] = useState<PulseConnectionStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  // Track each channel's status so the aggregate can flip to 'reconnecting'
  // when any channel drops, and back to 'live' when all channels are healthy.
  const channelStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrganization?.id) {
      setStatus('connecting');
      return;
    }

    const orgId = currentOrganization.id;
    const channelDefinitions: Array<{
      table: string;
      events: ('INSERT' | 'UPDATE' | 'DELETE')[];
    }> = [
      { table: 'facility_activity_entries', events: ['INSERT', 'UPDATE'] },
      { table: 'product_carbon_footprints', events: ['UPDATE'] },
      { table: 'supplier_products', events: ['INSERT', 'UPDATE'] },
      { table: 'production_logs', events: ['INSERT'] },
      {
        table: 'metric_snapshots',
        events: ['INSERT', 'UPDATE'],
      },
    ];

    function recomputeAggregateStatus() {
      const values = Object.values(channelStatusesRef.current);
      if (values.length === 0) {
        setStatus('connecting');
        return;
      }
      if (values.every(v => v === 'SUBSCRIBED')) {
        setStatus('live');
      } else if (values.some(v => v === 'CHANNEL_ERROR' || v === 'TIMED_OUT' || v === 'CLOSED')) {
        setStatus('reconnecting');
      } else {
        setStatus('connecting');
      }
    }

    const channels = channelDefinitions.map(({ table, events: tableEvents }) => {
      const channelName = `pulse:${table}:${orgId}`;
      let channel = supabase.channel(channelName);

      for (const event of tableEvents) {
        channel = channel.on(
          // postgres_changes is the supabase realtime "event" key
          'postgres_changes' as any,
          {
            event,
            schema: 'public',
            table,
          },
          (payload: any) => {
            const normalised = normalisePayload({
              table,
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              commit_timestamp: payload.commit_timestamp,
            });
            if (!normalised) return;

            // Filter to current org. Most rows have organization_id directly;
            // metric_snapshots also has organization_id; facility_activity_entries
            // is keyed by facility_id — for Phase 2 we accept events that don't
            // expose org_id and let the LiveActivityFeed render them. RLS already
            // prevents cross-org leakage.
            const recordOrgId = (payload.new as any)?.organization_id;
            if (recordOrgId && recordOrgId !== orgId) return;

            setEvents(prev => {
              if (prev.some(e => e.id === normalised.id)) return prev;
              return [normalised, ...prev].slice(0, MAX_EVENT_BUFFER);
            });
            setLastEventAt(normalised.occurredAt);
          },
        );
      }

      channel.subscribe(subscriptionStatus => {
        channelStatusesRef.current[table] = subscriptionStatus;
        recomputeAggregateStatus();
      });

      return channel;
    });

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch);
      }
      channelStatusesRef.current = {};
    };
  }, [currentOrganization?.id]);

  return { events, status, lastEventAt };
}
