/**
 * Pulse -- layout defaults + role-aware presets.
 *
 * Two role buckets:
 *   - 'executive' (owner / admin): narrative-first. Financial + insights prominent.
 *   - 'operator'  (member / advisor / supplier): action-first. Alerts + grid +
 *     live activity prominent at the top.
 *
 * Layouts are stored as a react-grid-layout compatible array of items. Widget
 * footprints drive width/height; layout files only need to specify widget
 * order and which side of the grid each card lives on (`x`).
 *
 * Exempt widgets (live-metrics-strip, ask-rosa) are rendered as full-width
 * bands by PulseShell and don't appear in the grid layout.
 */

import {
  WIDGET_REGISTRY,
  footprintToLayout,
  type WidgetId,
} from './widget-registry';

export type Role = 'owner' | 'admin' | 'member' | 'advisor' | 'supplier' | string | null;
export type LayoutBucket = 'executive' | 'operator';

export interface LayoutItem {
  i: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  /** True when the card is pinned by the user. Pinned cards ignore adaptive reorder. */
  pinned?: boolean;
}

export interface LayoutMap {
  lg: LayoutItem[];
}

export interface PulseLayout {
  layout: LayoutMap;
  hiddenWidgets: WidgetId[];
}

export function bucketForRole(role: Role): LayoutBucket {
  return role === 'owner' || role === 'admin' ? 'executive' : 'operator';
}

/**
 * Just the widget id + column position. Uniform-grid layouts are just an
 * ordered list; y/height/width are derived from the registry footprint.
 */
interface DefaultSlot {
  i: WidgetId;
  /** Column within the 12-col grid (0, 3, 6, 9 are the natural anchors). */
  x: number;
}

// Executive: money and narrative first. Operator: operational signals first.
// Both lists exclude exempt widgets (live-metrics-strip, ask-rosa), which
// PulseShell renders separately. Order matters -- placement follows list
// order, and auto-compaction in react-grid-layout resolves any overlaps.
const EXEC_DEFAULT: DefaultSlot[] = [
  { i: 'financial-footprint', x: 0 },   // 2x2 hero
  { i: 'macc', x: 6 },                  // 2x2 hero
  { i: 'insight-card', x: 0 },          // 2x1
  { i: 'scenario-sensitivity', x: 6 },  // 2x1
  { i: 'regulatory-exposure', x: 0 },   // 2x1
  { i: 'carbon-budgets', x: 6 },        // 2x1
  { i: 'target-trajectory', x: 0 },     // 2x1
  { i: 'supplier-hotspots', x: 6 },     // 2x1
  { i: 'facility-impact', x: 0 },       // 2x2
  { i: 'live-activity', x: 6 },         // 2x2
  { i: 'product-env-cost', x: 0 },      // 2x1
  { i: 'what-if', x: 6 },               // 2x1
  { i: 'harvest-seasons', x: 0 },       // 2x1
  { i: 'peer-benchmark', x: 6 },        // 1x1
  { i: 'grid-carbon', x: 9 },           // 1x1
  { i: 'alerts-inbox', x: 6 },          // 1x1
  { i: 'csrd-gaps', x: 9 },             // 1x1
];

const OPERATOR_DEFAULT: DefaultSlot[] = [
  { i: 'alerts-inbox', x: 0 },
  { i: 'grid-carbon', x: 3 },
  { i: 'csrd-gaps', x: 6 },
  { i: 'peer-benchmark', x: 9 },
  { i: 'facility-impact', x: 0 },       // 2x2
  { i: 'live-activity', x: 6 },         // 2x2
  { i: 'target-trajectory', x: 0 },
  { i: 'scenario-sensitivity', x: 6 },
  { i: 'carbon-budgets', x: 0 },
  { i: 'what-if', x: 6 },
  { i: 'insight-card', x: 0 },
  { i: 'harvest-seasons', x: 6 },
  { i: 'supplier-hotspots', x: 0 },
  { i: 'regulatory-exposure', x: 6 },
  { i: 'financial-footprint', x: 0 },   // 2x2
  { i: 'macc', x: 6 },                  // 2x2
  { i: 'product-env-cost', x: 0 },
];

/**
 * Turn an ordered slot list into real LayoutItems. Widget widths come from
 * the registry footprint. `y` is the running row offset; react-grid-layout
 * will auto-compact after drag, so the initial y values just need to be
 * monotonically increasing.
 */
function slotsToItems(slots: DefaultSlot[]): LayoutItem[] {
  const items: LayoutItem[] = [];
  // Track the maximum y reached in each column so we can pack cards into
  // rows without overlap.
  const columnY: number[] = new Array(12).fill(0);

  for (const slot of slots) {
    const meta = WIDGET_REGISTRY[slot.i];
    if (!meta || meta.exempt) continue;
    const { w, h, minW, minH } = footprintToLayout(meta.footprint);
    const x = clampColumn(slot.x, w);
    // y = max of all columns this card spans, so we never overlap.
    let y = 0;
    for (let c = x; c < x + w && c < 12; c += 1) {
      if (columnY[c] > y) y = columnY[c];
    }
    items.push({ i: slot.i, x, y, w, h, minW, minH });
    for (let c = x; c < x + w && c < 12; c += 1) {
      columnY[c] = y + h;
    }
  }
  return items;
}

function clampColumn(x: number, w: number): number {
  if (x < 0) return 0;
  if (x + w > 12) return Math.max(0, 12 - w);
  return x;
}

export function defaultLayoutForRole(role: Role): PulseLayout {
  const slots = bucketForRole(role) === 'executive' ? EXEC_DEFAULT : OPERATOR_DEFAULT;
  return {
    layout: { lg: slotsToItems(slots) },
    hiddenWidgets: [],
  };
}

/**
 * Reconcile a saved layout against the current widget registry.
 *
 * - Drops items whose widget id is no longer known (renamed / removed).
 * - Drops items that belong to exempt widgets (they moved to full-width bands).
 * - Re-applies the registry footprint so saved width/height from an older
 *   version of the registry don't leak through. This means changing a
 *   widget's footprint automatically re-sizes it on next load.
 * - Preserves x / y / pinned so user customisations survive, UNLESS the
 *   saved layout is degenerate (all items stacked at x:0).
 * - Appends entries for new widgets using their default layout position.
 */
export function reconcileLayout(saved: PulseLayout, role: Role): PulseLayout {
  const known = new Set(Object.keys(WIDGET_REGISTRY) as WidgetId[]);
  const hidden = new Set(saved.hiddenWidgets ?? []);
  const savedItems = (saved.layout?.lg ?? []).filter(
    item => known.has(item.i) && !WIDGET_REGISTRY[item.i].exempt,
  );

  // Detect degenerate layouts. The grid is 12 columns wide; healthy layouts
  // distribute cards across both halves. If we have 4+ items but NONE of
  // them sit in the right half (x >= 6), the layout was saved from a broken
  // state (or pre-dates the two-column design). Fall back to the role
  // default but preserve which widgets the user has hidden and which are
  // pinned.
  const hasItemOnRight = savedItems.some(item => (item.x ?? 0) >= 6);
  const isDegenerate = savedItems.length >= 4 && !hasItemOnRight;
  if (isDegenerate) {
    const defaults = defaultLayoutForRole(role);
    const pinnedIds = new Set(savedItems.filter(it => it.pinned).map(it => it.i));
    return {
      layout: {
        lg: defaults.layout.lg
          .filter(it => !hidden.has(it.i))
          .map(it => ({ ...it, pinned: pinnedIds.has(it.i) || undefined })),
      },
      hiddenWidgets: Array.from(hidden) as WidgetId[],
    };
  }

  // Replace saved w/h with the current footprint. Keeps layouts fresh when
  // we tweak a widget's size class without a data migration.
  const normalised: LayoutItem[] = savedItems.map(item => {
    const meta = WIDGET_REGISTRY[item.i];
    const { w, h, minW, minH } = footprintToLayout(meta.footprint);
    return {
      i: item.i,
      x: clampColumn(item.x ?? 0, w),
      y: item.y ?? 0,
      w,
      h,
      minW,
      minH,
      pinned: item.pinned,
    };
  });

  // Build a lookup of default x positions so new widgets land in the right
  // column rather than piling up on the left.
  const defaultItems = defaultLayoutForRole(role).layout.lg;
  const defaultXById = new Map(defaultItems.map(it => [it.i, it.x]));

  // Append any registry widgets we don't have a saved row for.
  const present = new Set(normalised.map(item => item.i));
  const maxY = normalised.reduce((m, it) => Math.max(m, it.y + it.h), 0);

  // Track per-column y offsets so new items don't overlap anything.
  const columnY: number[] = new Array(12).fill(0);
  for (const it of normalised) {
    for (let c = it.x; c < it.x + it.w && c < 12; c++) {
      columnY[c] = Math.max(columnY[c], it.y + it.h);
    }
  }
  // Ensure we start below all existing content.
  const floorY = Math.max(maxY, ...columnY);

  for (const id of Object.keys(WIDGET_REGISTRY) as WidgetId[]) {
    if (present.has(id) || hidden.has(id)) continue;
    const meta = WIDGET_REGISTRY[id];
    if (meta.exempt) continue;
    const { w, h, minW, minH } = footprintToLayout(meta.footprint);
    // Use the default column if available; otherwise left-align.
    const x = clampColumn(defaultXById.get(id) ?? 0, w);
    // y = max occupied row across the columns this item spans.
    let y = 0;
    for (let c = x; c < x + w && c < 12; c++) {
      if (columnY[c] > y) y = columnY[c];
    }
    // Ensure we never go above the floor (below all pre-existing items).
    y = Math.max(y, floorY);
    normalised.push({ i: id, x, y, w, h, minW, minH });
    for (let c = x; c < x + w && c < 12; c++) {
      columnY[c] = y + h;
    }
  }

  return {
    layout: { lg: normalised },
    hiddenWidgets: Array.from(hidden) as WidgetId[],
  };
}
