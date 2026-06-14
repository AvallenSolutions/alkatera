import { describe, it, expect } from 'vitest';
import { buildDeadlinePlan, recertDeadline } from '../deadline-plan';

describe('deadline-plan', () => {
  it('recert deadline is 5 years after cycle start', () => {
    expect(recertDeadline('2024-06-01')).toBe('2029-06-01');
    expect(recertDeadline('not-a-date')).toBeNull();
  });

  it('builds four backward-planned milestones and a countdown', () => {
    const today = new Date('2029-01-01T00:00:00Z');
    const plan = buildDeadlinePlan('2029-06-01', today)!;
    expect(plan.overdue).toBe(false);
    expect(plan.milestones).toHaveLength(4);
    expect(plan.milestones.map((m) => m.label.split(' ')[0])).toEqual(['Close', 'All', 'Audit', 'Submit']);
    // -6mo milestone (2028-12-01) is in the past relative to 2029-01-01
    expect(plan.milestones[0].done).toBe(true);
    // submit milestone is in the future
    expect(plan.milestones[3].done).toBe(false);
    expect(plan.daysRemaining).toBeGreaterThan(0);
  });

  it('flags an overdue deadline', () => {
    const plan = buildDeadlinePlan('2024-01-01', new Date('2026-01-01T00:00:00Z'))!;
    expect(plan.overdue).toBe(true);
    expect(plan.daysRemaining).toBeLessThan(0);
  });
});
