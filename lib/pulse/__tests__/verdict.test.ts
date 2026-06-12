import { describe, it, expect } from 'vitest';
import {
  aggregateVerdict,
  buildVerdictCopy,
  type TargetVerdictInput,
} from '../verdict';

function target(overrides: Partial<TargetVerdictInput> = {}): TargetVerdictInput {
  return {
    targetId: 'tgt-1',
    metricKey: 'total_co2e',
    targetValue: 600,
    targetDate: '2030-12-31',
    status: 'on_track',
    probability: 0.9,
    gap: -50,
    ...overrides,
  };
}

describe('aggregateVerdict', () => {
  it('no targets means no verdict', () => {
    const v = aggregateVerdict([]);
    expect(v.state).toBe('no_targets');
    expect(v.driving).toBeNull();
  });

  it('all-unknown targets give insufficient_data', () => {
    const v = aggregateVerdict([
      target({ status: 'unknown', probability: null }),
      target({ targetId: 'tgt-2', status: 'unknown', probability: null }),
    ]);
    expect(v.state).toBe('insufficient_data');
    expect(v.driving).toBeNull();
  });

  it('a single on-track target is on track', () => {
    const v = aggregateVerdict([target()]);
    expect(v.state).toBe('on_track');
    expect(v.driving?.targetId).toBe('tgt-1');
  });

  it('worst-of: one off-track target outranks several on-track ones', () => {
    const v = aggregateVerdict([
      target(),
      target({ targetId: 'tgt-2', metricKey: 'water_consumption', status: 'off_track', probability: 0.1, gap: 200 }),
      target({ targetId: 'tgt-3', status: 'on_track' }),
    ]);
    expect(v.state).toBe('off_track');
    expect(v.driving?.targetId).toBe('tgt-2');
  });

  it('at_risk outranks on_track but not off_track', () => {
    const v = aggregateVerdict([
      target({ targetId: 'a', status: 'at_risk', probability: 0.5 }),
      target({ targetId: 'b', status: 'on_track' }),
    ]);
    expect(v.state).toBe('at_risk');
    expect(v.driving?.targetId).toBe('a');
  });

  it('ties within the worst tier break on lowest probability', () => {
    const v = aggregateVerdict([
      target({ targetId: 'a', status: 'at_risk', probability: 0.6 }),
      target({ targetId: 'b', status: 'at_risk', probability: 0.4 }),
    ]);
    expect(v.driving?.targetId).toBe('b');
  });

  it('null probabilities sort last within the tier', () => {
    const v = aggregateVerdict([
      target({ targetId: 'a', status: 'off_track', probability: null }),
      target({ targetId: 'b', status: 'off_track', probability: 0.2 }),
    ]);
    expect(v.driving?.targetId).toBe('b');
  });

  it('unknown targets are ignored when others are ranked', () => {
    const v = aggregateVerdict([
      target({ targetId: 'a', status: 'unknown', probability: null }),
      target({ targetId: 'b', status: 'on_track' }),
    ]);
    expect(v.state).toBe('on_track');
    expect(v.driving?.targetId).toBe('b');
  });

  it('works across mixed metrics: a water target can drive the verdict', () => {
    const v = aggregateVerdict([
      target({ targetId: 'co2', status: 'on_track' }),
      target({ targetId: 'water', metricKey: 'water_consumption', status: 'off_track', probability: 0.05, gap: 120 }),
    ]);
    expect(v.driving?.metricKey).toBe('water_consumption');
  });
});

describe('buildVerdictCopy', () => {
  it('off track copy names the year, metric and gap in plain language', () => {
    const v = aggregateVerdict([
      target({ status: 'off_track', probability: 0.1, gap: 250.4 }),
    ]);
    const copy = buildVerdictCopy(v);
    expect(copy.headline).toBe('Off track');
    expect(copy.sub).toContain('2030');
    expect(copy.sub).toContain('miss');
    expect(copy.sub).toContain('250');
  });

  it('on track copy is encouraging and names the target year', () => {
    const copy = buildVerdictCopy(aggregateVerdict([target()]));
    expect(copy.headline).toBe('On track');
    expect(copy.sub).toContain('2030');
  });

  it('insufficient data copy explains the wait without jargon', () => {
    const copy = buildVerdictCopy(
      aggregateVerdict([target({ status: 'unknown', probability: null })]),
    );
    expect(copy.headline).toBe('Building your forecast');
    expect(copy.sub).not.toMatch(/regression|forecast model|probability/i);
  });

  it('no targets copy invites setting one', () => {
    const copy = buildVerdictCopy(aggregateVerdict([]));
    expect(copy.headline).toBe('No targets yet');
    expect(copy.sub).toContain('Set a target');
  });

  it('copy never contains em dashes or underscores', () => {
    const states = [
      aggregateVerdict([]),
      aggregateVerdict([target()]),
      aggregateVerdict([target({ status: 'at_risk' })]),
      aggregateVerdict([target({ status: 'off_track', gap: 10 })]),
      aggregateVerdict([target({ status: 'unknown', probability: null })]),
    ];
    for (const v of states) {
      const copy = buildVerdictCopy(v);
      expect(`${copy.headline} ${copy.sub}`).not.toMatch(/—|_/);
    }
  });
});
