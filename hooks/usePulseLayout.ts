'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import {
  defaultLayoutForRole,
  reconcileLayout,
  type LayoutItem,
  type LayoutMap,
  type PulseLayout,
} from '@/lib/pulse/layout';
import type { WidgetId } from '@/lib/pulse/widget-registry';

export interface UsePulseLayoutReturn {
  layout: PulseLayout;
  ready: boolean;
  /** Update layout in memory + debounced persist. */
  setLayout: (next: LayoutMap) => void;
  /** Hide a widget (removed from grid, available in "Add widget" sheet). */
  hideWidget: (id: WidgetId) => void;
  /** Add a widget back at the bottom of the grid. */
  showWidget: (id: WidgetId) => void;
  /** Reset to the role-default layout (deletes the persisted row). */
  resetToDefault: () => Promise<void>;
}

const DEBOUNCE_MS = 800;

export function usePulseLayout(): UsePulseLayoutReturn {
  const { currentOrganization, userRole } = useOrganization();
  const [layout, setLayoutState] = useState<PulseLayout>(() =>
    defaultLayoutForRole(userRole ?? null),
  );
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // Initial load: fetch persisted layout, fall back to role default, reconcile
  // against the current registry so newly-added widgets show up.
  useEffect(() => {
    if (!currentOrganization?.id) {
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/pulse/layout?organization_id=${currentOrganization.id}`,
      );
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;

      const baseline =
        body?.layout && Object.keys(body.layout).length > 0
          ? {
              layout: body.layout as LayoutMap,
              hiddenWidgets: (body.hidden_widgets ?? []) as WidgetId[],
            }
          : defaultLayoutForRole(userRole ?? null);

      const reconciled = reconcileLayout(baseline, userRole ?? null);
      setLayoutState(reconciled);
      lastSavedRef.current = JSON.stringify(reconciled);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, userRole]);

  /** Persist after debounce, deduped against the last-saved snapshot. */
  const schedulePersist = useCallback(
    (next: PulseLayout) => {
      if (!currentOrganization?.id) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const serialised = JSON.stringify(next);
        if (serialised === lastSavedRef.current) return;
        lastSavedRef.current = serialised;
        await fetch('/api/pulse/layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
            layout: next.layout,
            hidden_widgets: next.hiddenWidgets,
          }),
        });
      }, DEBOUNCE_MS);
    },
    [currentOrganization?.id],
  );

  const setLayout = useCallback(
    (nextLayout: LayoutMap) => {
      setLayoutState(prev => {
        const next = { ...prev, layout: nextLayout };
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const hideWidget = useCallback(
    (id: WidgetId) => {
      setLayoutState(prev => {
        const newLg = (prev.layout.lg ?? []).filter((it: LayoutItem) => it.i !== id);
        const next: PulseLayout = {
          layout: { lg: newLg },
          hiddenWidgets: Array.from(new Set([...prev.hiddenWidgets, id])),
        };
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const showWidget = useCallback(
    (id: WidgetId) => {
      setLayoutState(prev => {
        const next: PulseLayout = {
          layout: prev.layout,
          hiddenWidgets: prev.hiddenWidgets.filter(h => h !== id),
        };
        // reconcileLayout will append the now-visible widget at the bottom.
        const reconciled = reconcileLayout(next, userRole ?? null);
        schedulePersist(reconciled);
        return reconciled;
      });
    },
    [schedulePersist, userRole],
  );

  const resetToDefault = useCallback(async () => {
    if (!currentOrganization?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await fetch(`/api/pulse/layout?organization_id=${currentOrganization.id}`, {
      method: 'DELETE',
    });
    const fresh = defaultLayoutForRole(userRole ?? null);
    lastSavedRef.current = JSON.stringify(fresh);
    setLayoutState(fresh);
  }, [currentOrganization?.id, userRole]);

  return { layout, ready, setLayout, hideWidget, showWidget, resetToDefault };
}
