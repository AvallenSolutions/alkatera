import { describe, it, expect } from 'vitest';
import {
  assessReductionPlan,
  assessNetZeroPathway,
  isEmissionsTarget,
  hasDeclaredMethodology,
  PROGRESS_FRESHNESS_DAYS,
  type InitiativeEvidenceRow,
  type TargetEvidenceRow,
} from '../initiative-evidence';

const NOW = Date.parse('2026-06-12T12:00:00Z');
const DAY = 86_400_000;

function initiative(overrides: Partial<InitiativeEvidenceRow> = {}): InitiativeEvidenceRow {
  return {
    id: 'init-1',
    title: 'Switch to renewable electricity',
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    owner_user_id: 'user-1',
    owner_name: null,
    approved_at: new Date(NOW - 10 * DAY).toISOString(),
    percent_complete: 25,
    progress_updated_at: new Date(NOW - 5 * DAY).toISOString(),
    expected_annual_reduction_value: 120,
    expected_annual_reduction_unit: 'tCO2e per year',
    ...overrides,
  };
}

function target(overrides: Partial<TargetEvidenceRow> = {}): TargetEvidenceRow {
  return {
    id: 'tgt-1',
    metric_key: 'total_co2e',
    target_value: 100,
    target_date: '2030-12-31',
    scope: null,
    status: 'active',
    methodology: null,
    notes: null,
    ...overrides,
  };
}

describe('isEmissionsTarget', () => {
  it('matches CO2/carbon/emission/ghg/scope metric keys', () => {
    expect(isEmissionsTarget({ metric_key: 'total_co2e' })).toBe(true);
    expect(isEmissionsTarget({ metric_key: 'carbon_intensity' })).toBe(true);
    expect(isEmissionsTarget({ metric_key: 'some_metric', scope: 'scope 1' })).toBe(true);
    expect(isEmissionsTarget({ metric_key: 'water_consumption' })).toBe(false);
  });
});

describe('hasDeclaredMethodology', () => {
  it('true when methodology or notes carry text', () => {
    expect(hasDeclaredMethodology(target({ methodology: 'SBTi 1.5C' }))).toBe(true);
    expect(hasDeclaredMethodology(target({ notes: 'Science Based Targets initiative' }))).toBe(true);
    expect(hasDeclaredMethodology(target())).toBe(false);
    expect(hasDeclaredMethodology(target({ methodology: '  ' }))).toBe(false);
  });
});

describe('assessReductionPlan', () => {
  it('missing when no initiatives', () => {
    const r = assessReductionPlan([], NOW);
    expect(r.completeness).toBe('missing');
    expect(r.note).toContain('Create an action plan');
  });

  it('complete for an active, time-bound, owned, fresh initiative', () => {
    const r = assessReductionPlan([initiative()], NOW);
    expect(r.completeness).toBe('complete');
    expect(r.qualifying).toHaveLength(1);
  });

  it('completed initiatives also qualify', () => {
    const r = assessReductionPlan([initiative({ status: 'completed' })], NOW);
    expect(r.completeness).toBe('complete');
  });

  it('free-text owner_name counts as an owner', () => {
    const r = assessReductionPlan([initiative({ owner_user_id: null, owner_name: 'Sam the brewer' })], NOW);
    expect(r.completeness).toBe('complete');
  });

  it('partial when all initiatives are drafts', () => {
    const r = assessReductionPlan([initiative({ status: 'draft' })], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('Send one for approval');
  });

  it('partial with approval guidance when initiatives are pending', () => {
    const r = assessReductionPlan([initiative({ status: 'pending_approval' })], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('none has been approved yet');
  });

  it('partial when the approved initiative lacks dates', () => {
    const r = assessReductionPlan([initiative({ start_date: null })], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('start date and a finish date');
  });

  it('partial when the approved initiative lacks an owner', () => {
    const r = assessReductionPlan([initiative({ owner_user_id: null, owner_name: null })], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('named owner');
  });

  it('partial when progress is stale beyond the freshness window', () => {
    const stale = initiative({
      approved_at: new Date(NOW - (PROGRESS_FRESHNESS_DAYS + 30) * DAY).toISOString(),
      progress_updated_at: new Date(NOW - (PROGRESS_FRESHNESS_DAYS + 1) * DAY).toISOString(),
    });
    const r = assessReductionPlan([stale], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('update its progress');
  });

  it('a fresh approval keeps a not-yet-tracked initiative complete (no instant staleness)', () => {
    const justApproved = initiative({
      approved_at: new Date(NOW - 1 * DAY).toISOString(),
      progress_updated_at: null,
    });
    expect(assessReductionPlan([justApproved], NOW).completeness).toBe('complete');
  });

  it('exact freshness boundary: 90 days is fresh, 91 is stale', () => {
    const at90 = initiative({
      approved_at: null,
      progress_updated_at: new Date(NOW - PROGRESS_FRESHNESS_DAYS * DAY).toISOString(),
    });
    const at91 = initiative({
      approved_at: null,
      progress_updated_at: new Date(NOW - (PROGRESS_FRESHNESS_DAYS + 1) * DAY).toISOString(),
    });
    expect(assessReductionPlan([at90], NOW).completeness).toBe('complete');
    expect(assessReductionPlan([at91], NOW).completeness).toBe('partial');
  });
});

describe('assessNetZeroPathway', () => {
  it('missing without a net-zero target', () => {
    const r = assessNetZeroPathway([target({ target_value: 100 })], [initiative()], NOW);
    expect(r.completeness).toBe('missing');
  });

  it('partial with a net-zero target but no qualifying plan', () => {
    const r = assessNetZeroPathway([target({ target_value: 0 })], [initiative({ status: 'draft' })], NOW);
    expect(r.completeness).toBe('partial');
    expect(r.note).toContain('net-zero target');
  });

  it('complete with a net-zero target and a qualifying plan, still pointing at manual validation', () => {
    const r = assessNetZeroPathway([target({ target_value: 0 })], [initiative()], NOW);
    expect(r.completeness).toBe('complete');
    expect(r.note).toContain('validated pathway document');
  });

  it('ignores non-emissions zero targets', () => {
    const r = assessNetZeroPathway(
      [target({ metric_key: 'water_consumption', target_value: 0 })],
      [initiative()],
      NOW,
    );
    expect(r.completeness).toBe('missing');
  });
});
