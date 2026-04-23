/**
 * Tests for the drill-target encoding / decoding helpers.
 *
 * These power the `?drill=<...>` URL sync so deep links survive page reloads
 * and back/forward navigation. A regression here silently breaks shareable
 * drill URLs.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeDrillTarget,
  encodeDrillTarget,
  isMetricTarget,
  isWidgetTarget,
  type DrillTarget,
} from '../drill-target';

describe('encodeDrillTarget', () => {
  it('encodes a metric target as m:<key>', () => {
    expect(encodeDrillTarget({ kind: 'metric', key: 'total_co2e' as any })).toBe(
      'm:total_co2e',
    );
  });

  it('encodes a widget target as w:<id>', () => {
    expect(
      encodeDrillTarget({ kind: 'widget', id: 'financial-footprint' as any }),
    ).toBe('w:financial-footprint');
  });

  it('returns null for null input', () => {
    expect(encodeDrillTarget(null)).toBeNull();
  });
});

describe('decodeDrillTarget', () => {
  it('round-trips every metric id', () => {
    const ids = ['total_co2e', 'water_consumption', 'products_assessed'];
    for (const id of ids) {
      const target: DrillTarget = { kind: 'metric', key: id as any };
      const encoded = encodeDrillTarget(target);
      expect(decodeDrillTarget(encoded)).toEqual(target);
    }
  });

  it('round-trips every widget id', () => {
    const ids = ['financial-footprint', 'macc', 'carbon-budgets'];
    for (const id of ids) {
      const target: DrillTarget = { kind: 'widget', id: id as any };
      const encoded = encodeDrillTarget(target);
      expect(decodeDrillTarget(encoded)).toEqual(target);
    }
  });

  it('returns null for empty / missing input', () => {
    expect(decodeDrillTarget(null)).toBeNull();
    expect(decodeDrillTarget(undefined)).toBeNull();
    expect(decodeDrillTarget('')).toBeNull();
  });

  it('returns null for unknown prefix', () => {
    expect(decodeDrillTarget('x:something')).toBeNull();
    expect(decodeDrillTarget('nope')).toBeNull();
  });

  it('returns null when prefix is present but value is empty', () => {
    expect(decodeDrillTarget('m:')).toBeNull();
    expect(decodeDrillTarget('w:')).toBeNull();
  });
});

describe('type guards', () => {
  it('isMetricTarget narrows correctly', () => {
    expect(isMetricTarget({ kind: 'metric', key: 'total_co2e' as any })).toBe(true);
    expect(isMetricTarget({ kind: 'widget', id: 'macc' as any })).toBe(false);
    expect(isMetricTarget(null)).toBe(false);
  });

  it('isWidgetTarget narrows correctly', () => {
    expect(isWidgetTarget({ kind: 'widget', id: 'macc' as any })).toBe(true);
    expect(isWidgetTarget({ kind: 'metric', key: 'total_co2e' as any })).toBe(false);
    expect(isWidgetTarget(null)).toBe(false);
  });
});
