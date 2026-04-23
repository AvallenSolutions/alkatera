/**
 * Unit tests for the CSRD gap rule evaluator.
 *
 * We don't hit Supabase here; instead we exercise the pure rule functions
 * via a fake context so each rule's branches are covered.
 */

import { describe, expect, it } from 'vitest';
import { __testing } from '../csrd-gaps';

const { RULES } = __testing;

function ctx(overrides: Partial<Parameters<typeof RULES[number]['evaluate']>[0]> = {}) {
  return {
    organizationId: 'org-1',
    cutoffIso: '2025-04-17',
    activityCounts: {},
    activityLast: {},
    hasWaterStressFacility: false,
    hasWaterStressRecycling: false,
    targetCount: 0,
    hasNetZeroTarget: false,
    workforceRowCount: 0,
    governancePolicyCount: 0,
    materialityCompletedAt: null,
    ...overrides,
  };
}

function runRule(id: string, c: ReturnType<typeof ctx>) {
  const rule = RULES.find(r => r.rule.id === id);
  if (!rule) throw new Error(`No rule ${id}`);
  return rule.evaluate(c as any);
}

describe('csrd-gaps rules', () => {
  it('flags Scope 1 critical when no fuel/gas entries', () => {
    expect(runRule('e1-scope1-fuel', ctx()).severity).toBe('critical');
  });

  it('marks Scope 1 ok when gas entries exist', () => {
    expect(
      runRule('e1-scope1-fuel', ctx({ activityCounts: { utility_gas: 4 } })).severity,
    ).toBe('ok');
  });

  it('flags Scope 2 critical when no electricity', () => {
    expect(runRule('e1-scope2-electricity', ctx()).severity).toBe('critical');
  });

  it('flags target critical when none set', () => {
    expect(runRule('e1-target', ctx()).severity).toBe('critical');
  });

  it('flags target warning when set but no net-zero', () => {
    expect(
      runRule('e1-target', ctx({ targetCount: 2, hasNetZeroTarget: false })).severity,
    ).toBe('warning');
  });

  it('marks target ok with net-zero target', () => {
    expect(
      runRule('e1-target', ctx({ targetCount: 1, hasNetZeroTarget: true })).severity,
    ).toBe('ok');
  });

  it('flags water-stress recycling warning when stressed facility lacks rate', () => {
    expect(
      runRule(
        'e3-water-stress',
        ctx({ hasWaterStressFacility: true, hasWaterStressRecycling: false }),
      ).severity,
    ).toBe('warning');
  });

  it('marks water-stress ok when no stressed facility', () => {
    expect(runRule('e3-water-stress', ctx()).severity).toBe('ok');
  });

  it('flags waste warning when entries exist but none recycled', () => {
    expect(
      runRule('e5-waste', ctx({ activityCounts: { waste_general: 10 } })).severity,
    ).toBe('warning');
  });

  it('marks waste ok when recycling present', () => {
    expect(
      runRule(
        'e5-waste',
        ctx({ activityCounts: { waste_general: 8, waste_recycling: 4 } }),
      ).severity,
    ).toBe('ok');
  });

  it('flags governance warning when fewer than 3 policies', () => {
    expect(runRule('g1-policies', ctx({ governancePolicyCount: 2 })).severity).toBe(
      'warning',
    );
  });

  it('flags materiality warning when stale', () => {
    const stale = new Date();
    stale.setDate(stale.getDate() - 400);
    expect(
      runRule(
        'esrs2-materiality',
        ctx({ materialityCompletedAt: stale.toISOString() }),
      ).severity,
    ).toBe('warning');
  });

  it('marks materiality ok when fresh', () => {
    const fresh = new Date();
    fresh.setDate(fresh.getDate() - 30);
    expect(
      runRule(
        'esrs2-materiality',
        ctx({ materialityCompletedAt: fresh.toISOString() }),
      ).severity,
    ).toBe('ok');
  });
});
