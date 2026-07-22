import { describe, it, expect } from 'vitest';
import {
  WIDGET_MIN_TIER,
  widgetIdsForTier,
  isWidgetAllowedForTier,
  ALL_WIDGET_IDS,
} from '../widget-registry';

/**
 * Locks the Pulse-widget tier matrix: Seed (7) = live awareness + targets,
 * Blossom (+6) = operational analytics, Canopy (+11) = financial valuation +
 * compliance. Mirrors the feature/metric min-tier maps.
 */
describe('Pulse widget tier gating', () => {
  it('every widget is classified (Record type guarantees it)', () => {
    for (const id of ALL_WIDGET_IDS) {
      expect(['seed', 'blossom', 'canopy']).toContain(WIDGET_MIN_TIER[id]);
    }
  });

  it('Seed gets exactly the 7 awareness/targets widgets', () => {
    expect(widgetIdsForTier('seed').sort()).toEqual(
      [
        'ask-rosa',
        'energy-timing',
        'grid-carbon',
        'insight-card',
        'live-activity',
        'live-metrics-strip',
        'target-trajectory',
      ].sort(),
    );
  });

  it('Blossom adds 6 operational widgets (13 total)', () => {
    const blossom = widgetIdsForTier('blossom');
    expect(blossom).toHaveLength(13);
    for (const id of ['alerts-inbox', 'peer-benchmark', 'facility-impact', 'supplier-hotspots', 'harvest-seasons', 'carbon-budgets'] as const) {
      expect(blossom).toContain(id);
    }
    expect(blossom).not.toContain('financial-footprint');
  });

  it('Canopy gets every widget (24 total)', () => {
    expect(widgetIdsForTier('canopy').sort()).toEqual([...ALL_WIDGET_IDS].sort());
  });

  it('is cumulative across tiers', () => {
    const seed = new Set(widgetIdsForTier('seed'));
    const blossom = new Set(widgetIdsForTier('blossom'));
    const canopy = new Set(widgetIdsForTier('canopy'));
    for (const id of seed) expect(blossom.has(id)).toBe(true);
    for (const id of blossom) expect(canopy.has(id)).toBe(true);
  });

  it('isWidgetAllowedForTier matches the map', () => {
    expect(isWidgetAllowedForTier('financial-footprint', 'seed')).toBe(false);
    expect(isWidgetAllowedForTier('financial-footprint', 'canopy')).toBe(true);
    expect(isWidgetAllowedForTier('target-trajectory', 'seed')).toBe(true);
    expect(isWidgetAllowedForTier('carbon-budgets', 'seed')).toBe(false);
    expect(isWidgetAllowedForTier('carbon-budgets', 'blossom')).toBe(true);
  });
});
