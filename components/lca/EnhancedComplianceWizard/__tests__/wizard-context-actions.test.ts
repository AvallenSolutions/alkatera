/**
 * WizardContext Cascading Logic Tests
 *
 * Tests the pure business logic behind WizardContext actions:
 *   - Reference year -> facility session matching
 *   - Initial session selection during wizard init
 *   - Boundary change -> completed step reset
 *   - materialHasAssignedFactor validation
 *
 * These tests extract and exercise the algorithms independently of React state,
 * ensuring correctness of the cascading behaviours in updateField.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase modules before importing WizardContext (they run at module load)
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: { getUser: vi.fn(), getSession: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { getStepIdsForBoundary } from '../WizardContext';
import { materialHasAssignedFactor } from '@/components/lca/EnhancedComplianceWizard/types';
import type { ReportingSession, FacilityAllocation } from '@/components/lca/EnhancedComplianceWizard/types';
import type { ProductMaterial } from '@/lib/impact-waterfall-resolver';

// ============================================================================
// HELPER: Replicate the session-matching algorithm from WizardContext
// (updateField referenceYear handler, lines 819-848)
// ============================================================================

/**
 * Given a list of facility sessions and a selected year, find the best
 * matching session. Mirrors the logic in WizardContext.updateField when
 * field === 'referenceYear'.
 */
function findBestSessionForYear(
  sessions: ReportingSession[],
  selectedYear: number
): ReportingSession | undefined {
  if (sessions.length === 0) return undefined;

  const matchingSession = sessions.find((s) => {
    const startYear = new Date(s.reporting_period_start).getFullYear();
    const endYear = new Date(s.reporting_period_end).getFullYear();
    return selectedYear >= startYear && selectedYear <= endYear;
  });

  return matchingSession || sessions[0];
}

/**
 * Given a list of facility sessions and an init year, find the best
 * matching session for wizard initialisation. Mirrors the logic at
 * WizardContext line ~479.
 */
function findInitialSession(
  sessions: ReportingSession[],
  initYear: number
): ReportingSession | undefined {
  if (sessions.length === 0) return undefined;

  const yearMatchSession = sessions.find((s) => {
    const sy = new Date(s.reporting_period_start).getFullYear();
    const ey = new Date(s.reporting_period_end).getFullYear();
    return initYear >= sy && initYear <= ey;
  });

  return yearMatchSession || sessions[0];
}

/**
 * Replicate the boundary-change step reset logic from updateField
 * (lines 799-814). Returns the new completedSteps array.
 */
function resetStepsForBoundaryChange(
  newBoundary: string,
  showGuide: boolean
): number[] {
  const newStepIds = getStepIdsForBoundary(newBoundary, showGuide);
  const newCalcStepNumber = newStepIds.indexOf('calculate') + 1;
  return Array.from({ length: newCalcStepNumber }, (_, i) => i + 1);
}

// ============================================================================
// TEST DATA
// ============================================================================

function makeSession(overrides: Partial<ReportingSession> & { id: string }): ReportingSession {
  return {
    facility_id: 'fac-1',
    reporting_period_start: '2024-01-01',
    reporting_period_end: '2024-12-31',
    total_production_volume: 1000,
    volume_unit: 'units',
    data_source_type: 'manual',
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<ProductMaterial> = {}): ProductMaterial {
  return {
    id: 'mat-1',
    product_id: 'prod-1',
    material_name: 'Test Material',
    material_type: 'ingredient',
    quantity: '100',
    unit: 'kg',
    ...overrides,
  };
}

// ============================================================================
// TEST GROUP 1: Reference Year -> Facility Session Selection
// ============================================================================

describe('Reference year facility session matching', () => {
  const sessions: ReportingSession[] = [
    makeSession({
      id: 's1',
      reporting_period_start: '2023-01-01',
      reporting_period_end: '2023-12-31',
      total_production_volume: 1000,
    }),
    makeSession({
      id: 's2',
      reporting_period_start: '2024-01-01',
      reporting_period_end: '2024-12-31',
      total_production_volume: 1200,
    }),
    makeSession({
      id: 's3',
      reporting_period_start: '2025-01-01',
      reporting_period_end: '2025-12-31',
      total_production_volume: 1500,
    }),
  ];

  it('selects session matching the reference year', () => {
    const result = findBestSessionForYear(sessions, 2024);
    expect(result).toBeDefined();
    expect(result!.id).toBe('s2');
  });

  it('selects the correct session for each available year', () => {
    expect(findBestSessionForYear(sessions, 2023)!.id).toBe('s1');
    expect(findBestSessionForYear(sessions, 2024)!.id).toBe('s2');
    expect(findBestSessionForYear(sessions, 2025)!.id).toBe('s3');
  });

  it('falls back to first session when no year match', () => {
    const result = findBestSessionForYear(sessions, 2020);
    expect(result).toBeDefined();
    expect(result!.id).toBe('s1');
  });

  it('falls back to first session for future year with no match', () => {
    const result = findBestSessionForYear(sessions, 2030);
    expect(result).toBeDefined();
    expect(result!.id).toBe('s1');
  });

  it('handles sessions spanning multiple years', () => {
    const multiYearSessions: ReportingSession[] = [
      makeSession({
        id: 'multi',
        reporting_period_start: '2023-07-01',
        reporting_period_end: '2024-06-30',
        total_production_volume: 800,
      }),
      makeSession({
        id: 'later',
        reporting_period_start: '2025-01-01',
        reporting_period_end: '2025-12-31',
        total_production_volume: 1000,
      }),
    ];

    // 2023 falls within the multi-year session (2023-07 to 2024-06)
    expect(findBestSessionForYear(multiYearSessions, 2023)!.id).toBe('multi');
    // 2024 also falls within the multi-year session
    expect(findBestSessionForYear(multiYearSessions, 2024)!.id).toBe('multi');
    // 2025 matches the later session
    expect(findBestSessionForYear(multiYearSessions, 2025)!.id).toBe('later');
  });

  it('handles empty sessions array', () => {
    const result = findBestSessionForYear([], 2024);
    expect(result).toBeUndefined();
  });

  it('returns the first overlapping session when multiple sessions cover the same year', () => {
    const overlappingSessions: ReportingSession[] = [
      makeSession({
        id: 'first-match',
        reporting_period_start: '2024-01-01',
        reporting_period_end: '2024-12-31',
      }),
      makeSession({
        id: 'second-match',
        reporting_period_start: '2024-06-01',
        reporting_period_end: '2025-05-31',
      }),
    ];

    // .find() returns the first match
    const result = findBestSessionForYear(overlappingSessions, 2024);
    expect(result!.id).toBe('first-match');
  });
});

// ============================================================================
// TEST GROUP 2: Initial Session Selection Logic
// ============================================================================

describe('Initial facility session selection', () => {
  const currentYear = new Date().getFullYear();

  it('prefers session matching the default reference year over latest', () => {
    // Sessions ordered by reporting_period_end descending (as from DB query)
    const sessions: ReportingSession[] = [
      makeSession({
        id: 'latest',
        reporting_period_start: `${currentYear + 1}-01-01`,
        reporting_period_end: `${currentYear + 1}-12-31`,
        total_production_volume: 2000,
      }),
      makeSession({
        id: 'current-year',
        reporting_period_start: `${currentYear}-01-01`,
        reporting_period_end: `${currentYear}-12-31`,
        total_production_volume: 1500,
      }),
      makeSession({
        id: 'old',
        reporting_period_start: `${currentYear - 1}-01-01`,
        reporting_period_end: `${currentYear - 1}-12-31`,
        total_production_volume: 1000,
      }),
    ];

    // initYear = currentYear (matches INITIAL_FORM_DATA.referenceYear)
    const result = findInitialSession(sessions, currentYear);
    expect(result).toBeDefined();
    expect(result!.id).toBe('current-year');
  });

  it('falls back to latest session when no year match', () => {
    // No session covers the current year
    const sessions: ReportingSession[] = [
      makeSession({
        id: 'latest',
        reporting_period_start: '2020-01-01',
        reporting_period_end: '2020-12-31',
        total_production_volume: 500,
      }),
      makeSession({
        id: 'older',
        reporting_period_start: '2019-01-01',
        reporting_period_end: '2019-12-31',
        total_production_volume: 400,
      }),
    ];

    const result = findInitialSession(sessions, currentYear);
    expect(result).toBeDefined();
    // Falls back to sessions[0] which is the latest (DB orders descending)
    expect(result!.id).toBe('latest');
  });

  it('uses undefined when no sessions exist (caller provides default dates)', () => {
    const result = findInitialSession([], currentYear);
    expect(result).toBeUndefined();
  });

  it('matches session that spans the init year boundary', () => {
    const sessions: ReportingSession[] = [
      makeSession({
        id: 'spanning',
        reporting_period_start: `${currentYear - 1}-07-01`,
        reporting_period_end: `${currentYear}-06-30`,
        total_production_volume: 1200,
      }),
    ];

    const result = findInitialSession(sessions, currentYear);
    expect(result).toBeDefined();
    expect(result!.id).toBe('spanning');
  });

  it('returns the only available session when it matches the year', () => {
    const sessions: ReportingSession[] = [
      makeSession({
        id: 'only-one',
        reporting_period_start: `${currentYear}-01-01`,
        reporting_period_end: `${currentYear}-12-31`,
        total_production_volume: 1000,
      }),
    ];

    const result = findInitialSession(sessions, currentYear);
    expect(result!.id).toBe('only-one');
  });
});

// ============================================================================
// TEST GROUP 3: Boundary Change Step Reset Logic
// ============================================================================

describe('Boundary change step reset', () => {
  it('preserves pre-calculate completed steps for cradle-to-gate', () => {
    const completed = resetStepsForBoundaryChange('cradle-to-gate', false);
    const stepIds = getStepIdsForBoundary('cradle-to-gate', false);
    const calcStepNumber = stepIds.indexOf('calculate') + 1;

    // Should include steps 1 through calcStepNumber
    expect(completed).toHaveLength(calcStepNumber);
    expect(completed).toEqual(Array.from({ length: calcStepNumber }, (_, i) => i + 1));
  });

  it('resets post-calculate completed steps', () => {
    const completed = resetStepsForBoundaryChange('cradle-to-gate', false);
    const stepIds = getStepIdsForBoundary('cradle-to-gate', false);
    const totalSteps = stepIds.length;
    const calcStepNumber = stepIds.indexOf('calculate') + 1;

    // Post-calculate steps should NOT be in the completed array
    for (let i = calcStepNumber + 1; i <= totalSteps; i++) {
      expect(completed).not.toContain(i);
    }
  });

  it('adjusts step count for cradle-to-grave (adds distribution, use-phase, EoL)', () => {
    const gateCompleted = resetStepsForBoundaryChange('cradle-to-gate', false);
    const graveCompleted = resetStepsForBoundaryChange('cradle-to-grave', false);

    // cradle-to-grave has 3 more dynamic steps (distribution, use-phase, end-of-life)
    // which all appear before calculate, so the calculate step number shifts by 3
    expect(graveCompleted.length).toBe(gateCompleted.length + 3);
  });

  it('includes correct step count for cradle-to-shelf (adds distribution)', () => {
    const gateCompleted = resetStepsForBoundaryChange('cradle-to-gate', false);
    const shelfCompleted = resetStepsForBoundaryChange('cradle-to-shelf', false);

    expect(shelfCompleted.length).toBe(gateCompleted.length + 1);
  });

  it('includes correct step count for cradle-to-consumer (adds distribution + use-phase)', () => {
    const gateCompleted = resetStepsForBoundaryChange('cradle-to-gate', false);
    const consumerCompleted = resetStepsForBoundaryChange('cradle-to-consumer', false);

    expect(consumerCompleted.length).toBe(gateCompleted.length + 2);
  });

  it('accounts for guide step when showGuide is true', () => {
    const withoutGuide = resetStepsForBoundaryChange('cradle-to-gate', false);
    const withGuide = resetStepsForBoundaryChange('cradle-to-gate', true);

    // Guide adds 1 step before everything, so calculate shifts by 1
    expect(withGuide.length).toBe(withoutGuide.length + 1);
  });

  it('completed steps are always sequential starting from 1', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const completed = resetStepsForBoundaryChange(boundary, showGuide);
        completed.forEach((step, idx) => {
          expect(step).toBe(idx + 1);
        });
      }
    }
  });

  it('calculate step is always the last completed step after reset', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      const completed = resetStepsForBoundaryChange(boundary, false);
      const stepIds = getStepIdsForBoundary(boundary, false);
      const lastCompletedIdx = completed[completed.length - 1] - 1; // 0-based
      expect(stepIds[lastCompletedIdx]).toBe('calculate');
    }
  });

  it('post-calculate ISO doc steps (goal, cutoff, data-quality, etc.) are all cleared', () => {
    const completed = resetStepsForBoundaryChange('cradle-to-gate', false);
    const stepIds = getStepIdsForBoundary('cradle-to-gate', false);
    const postCalcIds = ['goal', 'cutoff', 'data-quality', 'interpretation', 'review', 'summary'];

    for (const id of postCalcIds) {
      const stepNumber = stepIds.indexOf(id) + 1;
      expect(stepNumber).toBeGreaterThan(0); // Sanity: step exists
      expect(completed).not.toContain(stepNumber);
    }
  });
});

// ============================================================================
// TEST GROUP 4: materialHasAssignedFactor
// ============================================================================

describe('materialHasAssignedFactor', () => {
  it('returns true for supplier source with supplier_product_id', () => {
    const mat = makeMaterial({
      data_source: 'supplier',
      supplier_product_id: 'sp-123',
    });
    expect(materialHasAssignedFactor(mat)).toBe(true);
  });

  it('returns true for openlca source with data_source_id', () => {
    const mat = makeMaterial({
      data_source: 'openlca',
      data_source_id: 'uuid-456',
    });
    expect(materialHasAssignedFactor(mat)).toBe(true);
  });

  it('returns true for ecoinvent source with data_source_id', () => {
    const mat = makeMaterial({
      data_source: 'ecoinvent',
      data_source_id: 'uuid-789',
    });
    expect(materialHasAssignedFactor(mat)).toBe(true);
  });

  it('returns false when data_source is null/undefined', () => {
    const mat = makeMaterial({
      data_source: undefined,
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });

  it('returns false when data_source is explicitly undefined and no IDs set', () => {
    const mat = makeMaterial({
      data_source: undefined,
      data_source_id: undefined,
      supplier_product_id: undefined,
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });

  it('returns false for supplier source without supplier_product_id', () => {
    const mat = makeMaterial({
      data_source: 'supplier',
      supplier_product_id: undefined,
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });

  it('returns false for openlca source without data_source_id', () => {
    const mat = makeMaterial({
      data_source: 'openlca',
      data_source_id: undefined,
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });

  it('returns true for supplier source even if data_source_id is also set', () => {
    // The supplier branch is checked first: data_source='supplier' + supplier_product_id
    const mat = makeMaterial({
      data_source: 'supplier',
      supplier_product_id: 'sp-123',
      data_source_id: 'uuid-extra',
    });
    expect(materialHasAssignedFactor(mat)).toBe(true);
  });

  it('returns true for agribalyse source with data_source_id', () => {
    const mat = makeMaterial({
      data_source: 'agribalyse',
      data_source_id: 'uuid-agri',
    });
    expect(materialHasAssignedFactor(mat)).toBe(true);
  });

  it('returns false for empty string data_source_id (falsy)', () => {
    const mat = makeMaterial({
      data_source: 'openlca',
      data_source_id: '',
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });

  it('returns false for empty string supplier_product_id (falsy)', () => {
    const mat = makeMaterial({
      data_source: 'supplier',
      supplier_product_id: '',
    });
    expect(materialHasAssignedFactor(mat)).toBe(false);
  });
});
