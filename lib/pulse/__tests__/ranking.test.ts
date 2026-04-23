/**
 * Tests for adaptive widget ranking.
 *
 * Verifies:
 *   - Score decays exponentially with time (30-day half-life)
 *   - Pinned items keep their position when reordering
 *   - Unpinned items sort by score desc
 *   - Stable sort: equal scores preserve input order
 *   - Empty inputs don't crash
 */

import { describe, expect, it } from 'vitest';
import {
  applyAdaptiveOrder,
  computeScore,
  scoresByWidget,
} from '../ranking';
import type { LayoutItem } from '../layout';
import type { WidgetId } from '../widget-registry';

const day = 86_400_000;

function nowIso(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * day).toISOString();
}

describe('computeScore', () => {
  it('returns 1.0 for a single open right now', () => {
    const score = computeScore({
      open_timestamps: [nowIso(0)],
      open_count: 1,
      last_opened_at: nowIso(0),
    });
    expect(score).toBeCloseTo(1, 2);
  });

  it('decays to 0.5 at 30 days', () => {
    const score = computeScore({
      open_timestamps: [nowIso(30)],
      open_count: 1,
      last_opened_at: nowIso(30),
    });
    expect(score).toBeCloseTo(0.5, 2);
  });

  it('decays to 0.25 at 60 days', () => {
    const score = computeScore({
      open_timestamps: [nowIso(60)],
      open_count: 1,
      last_opened_at: nowIso(60),
    });
    expect(score).toBeCloseTo(0.25, 2);
  });

  it('sums multiple opens at different ages', () => {
    const score = computeScore({
      open_timestamps: [nowIso(0), nowIso(30)],
      open_count: 2,
      last_opened_at: nowIso(0),
    });
    expect(score).toBeCloseTo(1.5, 2); // 1.0 + 0.5
  });

  it('ignores invalid timestamps', () => {
    const score = computeScore({
      open_timestamps: [nowIso(0), 'not-a-date'],
      open_count: 2,
      last_opened_at: nowIso(0),
    });
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('falls back to open_count when timestamps are empty', () => {
    const score = computeScore({
      open_timestamps: [],
      open_count: 4,
      last_opened_at: nowIso(0),
    });
    expect(score).toBeCloseTo(4, 2);
  });

  it('returns 0 when there is no data', () => {
    expect(
      computeScore({
        open_timestamps: [],
        open_count: 0,
        last_opened_at: '',
      }),
    ).toBe(0);
  });
});

describe('scoresByWidget', () => {
  it('maps rows to scores by widget_id', () => {
    const map = scoresByWidget([
      {
        widget_id: 'macc' as WidgetId,
        open_count: 1,
        last_opened_at: nowIso(0),
        open_timestamps: [nowIso(0)],
      },
      {
        widget_id: 'financial-footprint' as WidgetId,
        open_count: 1,
        last_opened_at: nowIso(30),
        open_timestamps: [nowIso(30)],
      },
    ]);
    expect(map.get('macc' as WidgetId)).toBeCloseTo(1, 2);
    expect(map.get('financial-footprint' as WidgetId)).toBeCloseTo(0.5, 2);
  });

  it('returns an empty map for empty input', () => {
    expect(scoresByWidget([]).size).toBe(0);
  });
});

describe('applyAdaptiveOrder', () => {
  const baseItem = (i: WidgetId, pinned = false): LayoutItem => ({
    i,
    x: 0,
    y: 0,
    w: 6,
    h: 10,
    pinned,
  });

  it('reorders unpinned items by score desc', () => {
    const items: LayoutItem[] = [
      baseItem('insight-card' as WidgetId), // score 0
      baseItem('macc' as WidgetId), // score 5
      baseItem('alerts-inbox' as WidgetId), // score 2
    ];
    const scores = new Map<WidgetId, number>([
      ['macc' as WidgetId, 5],
      ['alerts-inbox' as WidgetId, 2],
    ]);
    const ordered = applyAdaptiveOrder(items, scores);
    expect(ordered.map(i => i.i)).toEqual([
      'macc',
      'alerts-inbox',
      'insight-card',
    ]);
  });

  it('keeps pinned items before unpinned items', () => {
    const items: LayoutItem[] = [
      baseItem('insight-card' as WidgetId),
      baseItem('macc' as WidgetId, true), // pinned
      baseItem('alerts-inbox' as WidgetId),
    ];
    const scores = new Map<WidgetId, number>([
      ['insight-card' as WidgetId, 100],
      ['alerts-inbox' as WidgetId, 50],
    ]);
    const ordered = applyAdaptiveOrder(items, scores);
    // Pinned 'macc' should be first despite 0 score.
    expect(ordered[0].i).toBe('macc');
  });

  it('is stable for equal scores (preserves input order)', () => {
    const items: LayoutItem[] = [
      baseItem('insight-card' as WidgetId),
      baseItem('macc' as WidgetId),
      baseItem('alerts-inbox' as WidgetId),
    ];
    const scores = new Map<WidgetId, number>(); // all zero
    const ordered = applyAdaptiveOrder(items, scores);
    expect(ordered.map(i => i.i)).toEqual([
      'insight-card',
      'macc',
      'alerts-inbox',
    ]);
  });

  it('does not mutate the input array', () => {
    const items: LayoutItem[] = [
      baseItem('insight-card' as WidgetId),
      baseItem('macc' as WidgetId),
    ];
    const snapshot = items.map(i => i.i);
    const scores = new Map<WidgetId, number>([['macc' as WidgetId, 5]]);
    applyAdaptiveOrder(items, scores);
    expect(items.map(i => i.i)).toEqual(snapshot);
  });

  it('handles empty input', () => {
    expect(applyAdaptiveOrder([], new Map())).toEqual([]);
  });
});
