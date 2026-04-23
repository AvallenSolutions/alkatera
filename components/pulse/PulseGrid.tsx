'use client';

/**
 * Pulse -- uniform-grid widget canvas.
 *
 * Every non-exempt widget from the registry is rendered as a card on a 12-col
 * react-grid-layout. Sizes come from the registry footprint (1x1 / 2x1 / 2x2)
 * and are fixed -- users can drag cards to rearrange but not resize. Height
 * measurement / auto-resize has been removed: cards clip to their footprint,
 * and overflow is a widget bug.
 *
 * Widgets that don't fit the card metaphor (live-metrics-strip, ask-rosa)
 * are marked `exempt: true` in the registry and rendered as full-width bands
 * by PulseShell instead of by this component.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ResponsiveGridLayout as ResponsiveGridLayoutTyped,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';

// react-grid-layout's type defs omit isDraggable / draggableHandle / isResizable
// from the Responsive variant. Cast to any to restore the real runtime props
// without disabling type checks elsewhere.
const ResponsiveGridLayout = ResponsiveGridLayoutTyped as unknown as React.ComponentType<any>;
import { GripVertical, Pin, PinOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePulseLayout } from '@/hooks/usePulseLayout';
import { WIDGET_REGISTRY, type WidgetId } from '@/lib/pulse/widget-registry';
import type { LayoutItem } from '@/lib/pulse/layout';
import { applyAdaptiveOrder } from '@/lib/pulse/ranking';
import { usePulseEngagement } from '@/hooks/usePulseEngagement';
import { PulseEditToolbar } from '@/components/pulse/PulseEditToolbar';
import { FinancialFootprintCard } from '@/components/pulse/widgets/financial-footprint/FinancialFootprintCard';
import { ScenarioSensitivityCard } from '@/components/pulse/widgets/scenario-sensitivity/ScenarioSensitivityCard';
import { MaccCard } from '@/components/pulse/widgets/macc/MaccCard';
import { CarbonBudgetsCard } from '@/components/pulse/widgets/carbon-budgets/CarbonBudgetsCard';
import { RegulatoryExposureCard } from '@/components/pulse/widgets/regulatory-exposure/RegulatoryExposureCard';
import { TargetTrajectoryCard } from '@/components/pulse/widgets/target-trajectory/TargetTrajectoryCard';
import { FacilityImpactCard } from '@/components/pulse/widgets/facility-impact/FacilityImpactCard';
// Phase U3 compact cards.
import { AlertsInboxCard } from '@/components/pulse/widgets/alerts-inbox/AlertsInboxCard';
import { GridCarbonCard } from '@/components/pulse/widgets/grid-carbon/GridCarbonCard';
import { PeerBenchmarkCard } from '@/components/pulse/widgets/peer-benchmark/PeerBenchmarkCard';
import { CsrdGapsCard } from '@/components/pulse/widgets/csrd-gaps/CsrdGapsCard';
import { InsightCardCompact } from '@/components/pulse/widgets/insight-card/InsightCardCompact';
import { WhatIfCard } from '@/components/pulse/widgets/what-if/WhatIfCard';
import { HarvestSeasonsCard } from '@/components/pulse/widgets/harvest-seasons/HarvestSeasonsCard';
import { ProductEnvCostCard } from '@/components/pulse/widgets/product-env-cost/ProductEnvCostCard';
import { SupplierHotspotsCard } from '@/components/pulse/widgets/supplier-hotspots/SupplierHotspotsCard';
import { LiveActivityCard } from '@/components/pulse/widgets/live-activity/LiveActivityCard';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Renderers for each widget id. `live-metrics-strip` and `ask-rosa` are exempt
// (rendered by PulseShell as full-width bands) and don't appear here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RENDERERS: Partial<Record<WidgetId, () => ReactNode>> = {
  // Phase U2 compact PulseCard variants. Click any of these and the drill
  // overlay opens with the rich expanded view registered via expanded.tsx.
  'financial-footprint': () => <FinancialFootprintCard />,
  'scenario-sensitivity': () => <ScenarioSensitivityCard />,
  macc: () => <MaccCard />,
  'carbon-budgets': () => <CarbonBudgetsCard />,
  'regulatory-exposure': () => <RegulatoryExposureCard />,
  'target-trajectory': () => <TargetTrajectoryCard />,
  'facility-impact': () => <FacilityImpactCard />,
  // Phase U3 compact cards.
  'insight-card': () => <InsightCardCompact />,
  'alerts-inbox': () => <AlertsInboxCard />,
  'grid-carbon': () => <GridCarbonCard />,
  'peer-benchmark': () => <PeerBenchmarkCard />,
  'live-activity': () => <LiveActivityCard />,
  'csrd-gaps': () => <CsrdGapsCard />,
  'supplier-hotspots': () => <SupplierHotspotsCard />,
  'what-if': () => <WhatIfCard />,
  'harvest-seasons': () => <HarvestSeasonsCard />,
  'product-env-cost': () => <ProductEnvCostCard />,
};

/**
 * Grid geometry -- fixed. `1x1` footprint = 10 row units = 200px visible:
 *   (10 units × 10px rowHeight) + (9 vertical gaps × 12px)  = 208px
 * `2x2` = 20 row units = 428px. These match PulseCard's internal padding.
 */
const ROW_HEIGHT = 10;
const MARGIN: [number, number] = [12, 12];

/**
 * Measure the container width so react-grid-layout knows how wide to render.
 * Waits for the sidebar CSS transition (~300ms) before locking in the width.
 * See the original implementation for the rationale.
 */
function useContainerWidthStable(): {
  containerRef: React.RefObject<HTMLDivElement>;
  width: number;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1100;
    return Math.max(900, window.innerWidth - 320);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };

    measure();
    const tid = setTimeout(measure, 350);
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => {
      clearTimeout(tid);
      ro.disconnect();
    };
  }, []);

  return { containerRef, width };
}

export function PulseGrid() {
  const { layout, ready, setLayout, hideWidget, showWidget, resetToDefault } = usePulseLayout();
  const [editMode, setEditMode] = useState(false);
  const { width, containerRef } = useContainerWidthStable();
  const { scores, loaded: scoresLoaded, adaptiveEnabled, setAdaptiveEnabled } =
    usePulseEngagement();

  // Whether we've applied the adaptive sort for this session. Once applied
  // (or once the user drags / edits), we respect the saved order and only
  // re-sort on a hard page reload.
  const [adaptiveApplied, setAdaptiveApplied] = useState(false);

  // Saved (non-exempt) items from the layout.
  const savedItems = useMemo<LayoutItem[]>(
    () =>
      (layout.layout.lg ?? []).filter(item => {
        const meta = WIDGET_REGISTRY[item.i];
        // Drop exempt widgets silently -- they render elsewhere.
        return meta && !meta.exempt;
      }),
    [layout],
  );

  // Items the grid actually renders. Once per session, after scores load,
  // apply the adaptive sort. After that, saved order wins.
  const items = useMemo<LayoutItem[]>(() => {
    if (!adaptiveEnabled || adaptiveApplied || !scoresLoaded) return savedItems;
    return applyAdaptiveOrder(savedItems, scores);
  }, [savedItems, scores, scoresLoaded, adaptiveEnabled, adaptiveApplied]);

  // Persist the adaptive order once -- so next mount has a warm layout and
  // we don't reshuffle on every render.
  useEffect(() => {
    if (!scoresLoaded || adaptiveApplied || !adaptiveEnabled) return;
    if (savedItems.length === 0) return;
    const sorted = applyAdaptiveOrder(savedItems, scores);
    const changed = sorted.some(
      (it, idx) => it.i !== savedItems[idx]?.i || it.y !== savedItems[idx]?.y,
    );
    if (changed) {
      setLayout({ lg: sorted });
    }
    setAdaptiveApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresLoaded, savedItems.length, adaptiveEnabled]);

  const togglePin = useCallback(
    (id: WidgetId) => {
      // Once user pins/unpins, we consider layout manual -- don't re-sort.
      setAdaptiveApplied(true);
      const next = savedItems.map(item =>
        item.i === id ? { ...item, pinned: !item.pinned } : item,
      );
      setLayout({ lg: next });
    },
    [savedItems, setLayout],
  );

  const persistLayout = useCallback(
    (allLayouts: ResponsiveLayouts<string>) => {
      if (!allLayouts?.lg) return;
      // Dragging is a deliberate signal that the user wants manual order.
      // Lock adaptive ordering for the rest of the session.
      setAdaptiveApplied(true);
      // Preserve pinned flag from the current in-memory items.
      const pinnedById = new Map(items.map(i => [i.i, i.pinned]));
      const next = (allLayouts.lg as unknown as LayoutItem[]).map(item => ({
        ...item,
        pinned: pinnedById.get(item.i),
      }));
      setLayout({ lg: next });
    },
    [items, setLayout],
  );

  if (!ready) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading layout…
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      <PulseEditToolbar
        editMode={editMode}
        onToggleEdit={() => setEditMode(v => !v)}
        hiddenWidgets={layout.hiddenWidgets}
        onAddWidget={showWidget}
        onResetToDefault={resetToDefault}
        adaptiveEnabled={adaptiveEnabled}
        onToggleAdaptive={() => setAdaptiveEnabled(!adaptiveEnabled)}
      />

      <ResponsiveGridLayout
        width={width}
        className={cn('layout', editMode && 'pulse-grid-editing')}
        layouts={{ lg: items as unknown as Layout }}
        breakpoints={{ lg: 900, md: 600, sm: 480, xs: 240, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN as unknown as readonly [number, number]}
        containerPadding={[0, 0] as const}
        isDraggable={editMode}
        draggableHandle=".pulse-drag-handle"
        isResizable={false}
        onLayoutChange={(_current: Layout, allLayouts: ResponsiveLayouts<string>) =>
          persistLayout(allLayouts)
        }
      >
        {items.map(item => {
          const meta = WIDGET_REGISTRY[item.i];
          const renderer = RENDERERS[item.i];
          if (!meta || !renderer) return <div key={item.i} />;
          return (
            <div key={item.i} className="h-full overflow-hidden">
              <WidgetCell
                meta={meta}
                editMode={editMode}
                pinned={Boolean(item.pinned)}
                onTogglePin={() => togglePin(item.i)}
                onRemove={() => hideWidget(item.i)}
              >
                {renderer()}
              </WidgetCell>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}

/**
 * Grid-cell wrapper. In non-edit mode it's just a height-100% flex container.
 * In edit mode it overlays a drag handle + remove button at the top, so users
 * can rearrange without stealing clicks from the card body.
 */
function WidgetCell({
  meta,
  editMode,
  pinned,
  onTogglePin,
  onRemove,
  children,
}: {
  meta: { id: WidgetId; label: string };
  editMode: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group relative h-full w-full">
      {/* Pin toggle -- always visible when pinned, fades in on hover/focus
          otherwise. Sits above the card body so it doesn't trigger the
          whole-card drill click. */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onTogglePin();
        }}
        title={pinned ? 'Unpin card' : 'Pin to keep position'}
        aria-label={pinned ? 'Unpin card' : 'Pin card'}
        className={cn(
          'absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md border transition',
          pinned
            ? 'border-[#ccff00]/60 bg-[#ccff00]/15 text-[#ccff00] opacity-100'
            : 'border-border/60 bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm hover:text-foreground group-hover:opacity-90 group-focus-within:opacity-90',
        )}
      >
        {pinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
      </button>

      {editMode && (
        <div className="pulse-drag-handle absolute inset-x-0 top-0 z-30 flex cursor-move items-center justify-between rounded-t-xl border-b border-[#ccff00]/30 bg-[#ccff00]/10 px-2 py-1 text-[10px] font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-3 w-3" />
            {meta.label}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
            title="Remove from layout"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className={cn('h-full w-full', editMode ? 'pt-6' : '')}>{children}</div>
    </div>
  );
}
