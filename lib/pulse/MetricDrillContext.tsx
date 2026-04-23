'use client';

/**
 * Pulse -- Widget drill-down context (née MetricDrillContext).
 *
 * Originally built to drill MetricCard KPIs into a side sheet. Now generalised
 * to drill ANY widget (financial-footprint, MACC, carbon-budgets etc.) into a
 * full-page overlay. The old "metric" API surface is kept as sugar so MetricCard
 * and existing slots (TrendSlot, WaterfallSlot) keep working unchanged.
 *
 * A single overlay is mounted once by PulseShell. Any card calls
 * `openDrill(target)` to push a `DrillTarget` onto the context; the overlay
 * composes every registered slot whose `match(target)` predicate returns true.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MetricKey } from './metric-keys';
import {
  type DrillOpenSource,
  type DrillTarget,
  isMetricTarget,
} from './drill-target';

// Re-export for downstream convenience so widgets only import from one place.
export type { DrillTarget };
export {
  encodeDrillTarget,
  decodeDrillTarget,
  isMetricTarget,
  isWidgetTarget,
} from './drill-target';

/**
 * Slot render function. Receives the active target so the slot can adapt its
 * content (e.g. the waterfall slot renders differently for total_co2e vs water).
 */
export type DrillSlotRenderer = (ctx: { target: DrillTarget }) => ReactNode;

export interface DrillSlot {
  id: string;
  title: string;
  /** Lower numbers render first. Defaults to 100. */
  order?: number;
  /**
   * Predicate. Returns true when this slot should render for the given drill
   * target. When omitted, the slot matches metric targets only -- which
   * preserves the original "metric drill" semantics for slots registered
   * before the generalisation (WaterfallSlot etc.).
   */
  match?: (target: DrillTarget) => boolean;
  render: DrillSlotRenderer;
}

interface WidgetDrillContextShape {
  /** The active drill target, or null when the overlay is closed. */
  activeTarget: DrillTarget | null;
  /** Kept for legacy consumers that only know about metric drills. */
  activeMetric: MetricKey | null;
  open: boolean;
  /** Source of the most recent open (so engagement telemetry can skip URL-driven opens). */
  lastOpenSource: DrillOpenSource | null;
  slots: DrillSlot[];
  /**
   * Open the drill overlay. Accepts either a DrillTarget or a bare MetricKey
   * (the latter is legacy sugar for `{ kind: 'metric', key }`).
   */
  openDrill: (target: DrillTarget | MetricKey, source?: DrillOpenSource) => void;
  closeDrill: () => void;
  registerSlot: (slot: DrillSlot) => () => void;
}

const WidgetDrillContext = createContext<WidgetDrillContextShape | null>(null);

export function WidgetDrillProvider({ children }: { children: ReactNode }) {
  const [activeTarget, setActiveTarget] = useState<DrillTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [lastOpenSource, setLastOpenSource] = useState<DrillOpenSource | null>(null);
  const [slots, setSlots] = useState<DrillSlot[]>([]);

  const openDrill = useCallback(
    (target: DrillTarget | MetricKey, source: DrillOpenSource = 'click') => {
      const next: DrillTarget =
        typeof target === 'string' ? { kind: 'metric', key: target } : target;
      setActiveTarget(next);
      setLastOpenSource(source);
      setOpen(true);
    },
    [],
  );

  const closeDrill = useCallback(() => {
    setOpen(false);
    // Hold the target briefly so the exit animation still has a title.
    setTimeout(() => setActiveTarget(null), 250);
  }, []);

  const registerSlot = useCallback((slot: DrillSlot) => {
    setSlots(current => {
      // De-dupe by id so a component re-registering (e.g. HMR) replaces its
      // old entry rather than appending a duplicate.
      const filtered = current.filter(s => s.id !== slot.id);
      const next = [...filtered, slot];
      next.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
      return next;
    });
    return () => {
      setSlots(current => current.filter(s => s.id !== slot.id));
    };
  }, []);

  const activeMetric = isMetricTarget(activeTarget) ? activeTarget.key : null;

  const value = useMemo<WidgetDrillContextShape>(
    () => ({
      activeTarget,
      activeMetric,
      open,
      lastOpenSource,
      slots,
      openDrill,
      closeDrill,
      registerSlot,
    }),
    [activeTarget, activeMetric, open, lastOpenSource, slots, openDrill, closeDrill, registerSlot],
  );

  return <WidgetDrillContext.Provider value={value}>{children}</WidgetDrillContext.Provider>;
}

/**
 * Legacy alias for MetricDrillProvider. Identical to WidgetDrillProvider.
 * Kept so existing PulseShell imports keep working without edits.
 */
export const MetricDrillProvider = WidgetDrillProvider;

export function useWidgetDrill() {
  const ctx = useContext(WidgetDrillContext);
  if (!ctx) {
    throw new Error('useWidgetDrill must be used within a WidgetDrillProvider');
  }
  return ctx;
}

/** Legacy alias. Same context, same shape -- just the old name. */
export const useMetricDrill = useWidgetDrill;

/**
 * Register a drill-down slot for the lifetime of the calling component.
 * Wrap the renderer in `useCallback` to avoid re-registering every render.
 *
 * Back-compat: slots that don't declare a `match` predicate default to
 * matching metric targets only. This preserves the original behaviour for
 * slots like WaterfallSlot that predate widget-drill support.
 */
export function useRegisterDrillSlot(slot: DrillSlot) {
  const { registerSlot } = useWidgetDrill();
  useEffect(() => {
    const withDefaultMatch: DrillSlot = {
      ...slot,
      match: slot.match ?? isMetricTarget,
    };
    return registerSlot(withDefaultMatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.id]);
}
