'use client';

/**
 * Pulse -- engagement telemetry + adaptive-order hook.
 *
 * Two responsibilities:
 *   1. Fetch the current user's engagement rows on mount and expose a
 *      widget_id -> score map for PulseGrid to sort by.
 *   2. Watch the drill context; when a widget drill opens from a CLICK
 *      (not URL), fire a fire-and-forget POST /api/pulse/engagement.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import type { WidgetId } from '@/lib/pulse/widget-registry';
import { scoresByWidget, type EngagementRow } from '@/lib/pulse/ranking';

export function usePulseEngagement(): {
  scores: Map<WidgetId, number>;
  loaded: boolean;
  /** True when the user has explicitly opted out of adaptive ordering. */
  adaptiveEnabled: boolean;
  setAdaptiveEnabled: (v: boolean) => void;
} {
  const { activeTarget, open, lastOpenSource } = useWidgetDrill();
  const [scores, setScores] = useState<Map<WidgetId, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('pulse.adaptiveEnabled');
    return stored === null ? true : stored === 'true';
  });

  // Load scores once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pulse/engagement');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setScores(scoresByWidget((json.rows ?? []) as EngagementRow[]));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Record engagement when a widget drill opens. Only counts clicks; URL /
  // programmatic opens are ignored at the server level, but we still skip
  // posting to save a round trip.
  const lastOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !activeTarget) return;
    if (activeTarget.kind !== 'widget') return;
    if (lastOpenSource !== 'click') return;
    const id = activeTarget.id;
    // De-dupe: React may rerun this effect when unrelated context fields
    // change. Only post once per (widget, open).
    const fingerprint = `${id}:${Date.now()}`;
    if (lastOpenedRef.current === fingerprint) return;
    lastOpenedRef.current = fingerprint;

    fetch('/api/pulse/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widget_id: id, source: 'click' }),
    })
      .then(r => {
        if (!r.ok) return;
        // Optimistically bump local score so the next sort feels responsive.
        setScores(prev => {
          const next = new Map(prev);
          next.set(id as WidgetId, (next.get(id as WidgetId) ?? 0) + 1);
          return next;
        });
      })
      .catch(() => {
        // Best-effort telemetry; never surface.
      });
  }, [open, activeTarget, lastOpenSource]);

  const setAdaptiveEnabled = useCallback((v: boolean) => {
    setAdaptiveEnabledState(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pulse.adaptiveEnabled', v ? 'true' : 'false');
    }
  }, []);

  return { scores, loaded, adaptiveEnabled, setAdaptiveEnabled };
}
