/**
 * EPR Wizard — Unit Tests
 *
 * Tests step navigation, phase progression, state management, and progress
 * calculation for the Rosa-guided EPR data entry wizard.
 */
import { describe, it, expect } from 'vitest';

import {
  EPR_WIZARD_STEPS,
  EPR_WIZARD_PHASES,
  EPR_WIZARD_PHASE_CONFIG,
  TOTAL_EPR_WIZARD_STEPS,
  INITIAL_EPR_WIZARD_STATE,
  ROSA_WIZARD_MESSAGES,
  getEPRWizardStepConfig,
  getEPRWizardPhaseSteps,
  getNextEPRWizardStep,
  getPreviousEPRWizardStep,
  getEPRWizardProgress,
  isEPRWizardPhaseComplete,
  type EPRWizardStep,
  type EPRWizardPhase,
  type EPRWizardState,
} from '@/lib/epr/wizard-types';

// =============================================================================
// Step Configuration
// =============================================================================

describe('EPR Wizard Step Configuration', () => {
  it('has exactly 10 steps', () => {
    expect(EPR_WIZARD_STEPS).toHaveLength(10);
    expect(TOTAL_EPR_WIZARD_STEPS).toBe(10);
  });

  it('has sequential indexes from 0 to 9', () => {
    EPR_WIZARD_STEPS.forEach((step, i) => {
      expect(step.index).toBe(i);
    });
  });

  it('has unique step IDs', () => {
    const ids = EPR_WIZARD_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns each step to a valid phase', () => {
    const validPhases: EPRWizardPhase[] = ['org-setup', 'packaging-data', 'validate-generate', 'export-finish'];
    EPR_WIZARD_STEPS.forEach((step) => {
      expect(validPhases).toContain(step.phase);
    });
  });

  it('has title and description for every step', () => {
    EPR_WIZARD_STEPS.forEach((step) => {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    });
  });

  it('marks welcome step as first (index 0)', () => {
    expect(EPR_WIZARD_STEPS[0].id).toBe('welcome');
  });

  it('marks export-complete as last step', () => {
    expect(EPR_WIZARD_STEPS[EPR_WIZARD_STEPS.length - 1].id).toBe('export-complete');
  });
});

// =============================================================================
// Phase Configuration
// =============================================================================

describe('EPR Wizard Phase Configuration', () => {
  it('has exactly 4 phases', () => {
    expect(EPR_WIZARD_PHASES).toHaveLength(4);
  });

  it('has config for every phase', () => {
    EPR_WIZARD_PHASES.forEach((phase) => {
      const config = EPR_WIZARD_PHASE_CONFIG[phase];
      expect(config).toBeDefined();
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.duration.length).toBeGreaterThan(0);
      expect(config.color.length).toBeGreaterThan(0);
    });
  });

  it('org-setup phase has 4 steps', () => {
    const steps = getEPRWizardPhaseSteps('org-setup');
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.id)).toEqual(['welcome', 'registration', 'obligation', 'nation-split']);
  });

  it('packaging-data phase has 3 steps', () => {
    const steps = getEPRWizardPhaseSteps('packaging-data');
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.id)).toEqual(['defaults', 'data-review', 'bulk-edit']);
  });

  it('validate-generate phase has 2 steps', () => {
    const steps = getEPRWizardPhaseSteps('validate-generate');
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(['validation', 'generate']);
  });

  it('export-finish phase has 1 step', () => {
    const steps = getEPRWizardPhaseSteps('export-finish');
    expect(steps).toHaveLength(1);
    expect(steps.map((s) => s.id)).toEqual(['export-complete']);
  });
});

// =============================================================================
// Step Navigation
// =============================================================================

describe('EPR Wizard Step Navigation', () => {
  it('getNextEPRWizardStep returns next step', () => {
    expect(getNextEPRWizardStep('welcome')).toBe('registration');
    expect(getNextEPRWizardStep('registration')).toBe('obligation');
    expect(getNextEPRWizardStep('obligation')).toBe('nation-split');
    expect(getNextEPRWizardStep('nation-split')).toBe('defaults');
    expect(getNextEPRWizardStep('defaults')).toBe('data-review');
    expect(getNextEPRWizardStep('data-review')).toBe('bulk-edit');
    expect(getNextEPRWizardStep('bulk-edit')).toBe('validation');
    expect(getNextEPRWizardStep('validation')).toBe('generate');
    expect(getNextEPRWizardStep('generate')).toBe('export-complete');
  });

  it('getNextEPRWizardStep returns null for last step', () => {
    expect(getNextEPRWizardStep('export-complete')).toBeNull();
  });

  it('getPreviousEPRWizardStep returns previous step', () => {
    expect(getPreviousEPRWizardStep('export-complete')).toBe('generate');
    expect(getPreviousEPRWizardStep('generate')).toBe('validation');
    expect(getPreviousEPRWizardStep('validation')).toBe('bulk-edit');
    expect(getPreviousEPRWizardStep('bulk-edit')).toBe('data-review');
    expect(getPreviousEPRWizardStep('data-review')).toBe('defaults');
    expect(getPreviousEPRWizardStep('defaults')).toBe('nation-split');
    expect(getPreviousEPRWizardStep('nation-split')).toBe('obligation');
    expect(getPreviousEPRWizardStep('obligation')).toBe('registration');
    expect(getPreviousEPRWizardStep('registration')).toBe('welcome');
  });

  it('getPreviousEPRWizardStep returns null for first step', () => {
    expect(getPreviousEPRWizardStep('welcome')).toBeNull();
  });

  it('getEPRWizardStepConfig returns correct config', () => {
    const config = getEPRWizardStepConfig('obligation');
    expect(config.id).toBe('obligation');
    expect(config.phase).toBe('org-setup');
    expect(config.index).toBe(2);
    expect(config.skippable).toBe(false);
  });

  it('navigation is bidirectional (forward then back returns to same step)', () => {
    const steps: EPRWizardStep[] = ['welcome', 'registration', 'obligation', 'nation-split', 'defaults', 'data-review', 'bulk-edit', 'validation', 'generate'];
    for (const step of steps) {
      const next = getNextEPRWizardStep(step);
      if (next) {
        const back = getPreviousEPRWizardStep(next);
        expect(back).toBe(step);
      }
    }
  });
});

// =============================================================================
// Skippable Steps
// =============================================================================

describe('EPR Wizard Skippable Steps', () => {
  it('welcome is not skippable', () => {
    expect(getEPRWizardStepConfig('welcome').skippable).toBe(false);
  });

  it('registration is skippable', () => {
    expect(getEPRWizardStepConfig('registration').skippable).toBe(true);
  });

  it('obligation is not skippable', () => {
    expect(getEPRWizardStepConfig('obligation').skippable).toBe(false);
  });

  it('nation-split is skippable', () => {
    expect(getEPRWizardStepConfig('nation-split').skippable).toBe(true);
  });

  it('defaults is skippable', () => {
    expect(getEPRWizardStepConfig('defaults').skippable).toBe(true);
  });

  it('data-review is not skippable', () => {
    expect(getEPRWizardStepConfig('data-review').skippable).toBe(false);
  });

  it('bulk-edit is skippable', () => {
    expect(getEPRWizardStepConfig('bulk-edit').skippable).toBe(true);
  });

  it('validation is not skippable', () => {
    expect(getEPRWizardStepConfig('validation').skippable).toBe(false);
  });

  it('generate is not skippable', () => {
    expect(getEPRWizardStepConfig('generate').skippable).toBe(false);
  });

  it('export-complete is not skippable', () => {
    expect(getEPRWizardStepConfig('export-complete').skippable).toBe(false);
  });

  it('has exactly 4 skippable steps', () => {
    const skippable = EPR_WIZARD_STEPS.filter((s) => s.skippable);
    expect(skippable).toHaveLength(4);
  });
});

// =============================================================================
// Progress Calculation
// =============================================================================

describe('EPR Wizard Progress Calculation', () => {
  it('welcome step is 10%', () => {
    expect(getEPRWizardProgress('welcome')).toBe(10);
  });

  it('registration step is 20%', () => {
    expect(getEPRWizardProgress('registration')).toBe(20);
  });

  it('obligation step is 30%', () => {
    expect(getEPRWizardProgress('obligation')).toBe(30);
  });

  it('data-review step is 60%', () => {
    expect(getEPRWizardProgress('data-review')).toBe(60);
  });

  it('export-complete step is 100%', () => {
    expect(getEPRWizardProgress('export-complete')).toBe(100);
  });

  it('progress is always between 1 and 100', () => {
    EPR_WIZARD_STEPS.forEach((step) => {
      const progress = getEPRWizardProgress(step.id);
      expect(progress).toBeGreaterThanOrEqual(1);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  it('progress increases monotonically', () => {
    let prev = 0;
    EPR_WIZARD_STEPS.forEach((step) => {
      const progress = getEPRWizardProgress(step.id);
      expect(progress).toBeGreaterThan(prev);
      prev = progress;
    });
  });
});

// =============================================================================
// Phase Completion
// =============================================================================

describe('EPR Wizard Phase Completion', () => {
  it('empty completed steps means no phase is complete', () => {
    EPR_WIZARD_PHASES.forEach((phase) => {
      expect(isEPRWizardPhaseComplete(phase, [])).toBe(false);
    });
  });

  it('org-setup is complete when all 4 steps are done', () => {
    const steps: EPRWizardStep[] = ['welcome', 'registration', 'obligation', 'nation-split'];
    expect(isEPRWizardPhaseComplete('org-setup', steps)).toBe(true);
  });

  it('org-setup is not complete with only 3 of 4 steps', () => {
    const steps: EPRWizardStep[] = ['welcome', 'registration', 'obligation'];
    expect(isEPRWizardPhaseComplete('org-setup', steps)).toBe(false);
  });

  it('packaging-data is complete when all 3 steps are done', () => {
    const steps: EPRWizardStep[] = ['defaults', 'data-review', 'bulk-edit'];
    expect(isEPRWizardPhaseComplete('packaging-data', steps)).toBe(true);
  });

  it('validate-generate is complete when both steps are done', () => {
    const steps: EPRWizardStep[] = ['validation', 'generate'];
    expect(isEPRWizardPhaseComplete('validate-generate', steps)).toBe(true);
  });

  it('export-finish is complete when export-complete is done', () => {
    const steps: EPRWizardStep[] = ['export-complete'];
    expect(isEPRWizardPhaseComplete('export-finish', steps)).toBe(true);
  });

  it('all phases complete when all 10 steps are done', () => {
    const allSteps = EPR_WIZARD_STEPS.map((s) => s.id);
    EPR_WIZARD_PHASES.forEach((phase) => {
      expect(isEPRWizardPhaseComplete(phase, allSteps)).toBe(true);
    });
  });

  it('phases from other groups do not affect completion', () => {
    // Only packaging-data steps completed — org-setup should still be incomplete
    const steps: EPRWizardStep[] = ['defaults', 'data-review', 'bulk-edit'];
    expect(isEPRWizardPhaseComplete('org-setup', steps)).toBe(false);
    expect(isEPRWizardPhaseComplete('packaging-data', steps)).toBe(true);
  });
});

// =============================================================================
// Initial State
// =============================================================================

describe('EPR Wizard Initial State', () => {
  it('starts not completed', () => {
    expect(INITIAL_EPR_WIZARD_STATE.completed).toBe(false);
  });

  it('starts not dismissed', () => {
    expect(INITIAL_EPR_WIZARD_STATE.dismissed).toBe(false);
  });

  it('starts on welcome step', () => {
    expect(INITIAL_EPR_WIZARD_STATE.currentStep).toBe('welcome');
  });

  it('starts with empty completed steps', () => {
    expect(INITIAL_EPR_WIZARD_STATE.completedSteps).toEqual([]);
  });

  it('has no timestamps initially', () => {
    expect(INITIAL_EPR_WIZARD_STATE.startedAt).toBeUndefined();
    expect(INITIAL_EPR_WIZARD_STATE.completedAt).toBeUndefined();
  });
});

// =============================================================================
// Rosa Messages
// =============================================================================

describe('Rosa Wizard Messages', () => {
  it('has a message for every step', () => {
    EPR_WIZARD_STEPS.forEach((step) => {
      expect(ROSA_WIZARD_MESSAGES[step.id]).toBeDefined();
      expect(ROSA_WIZARD_MESSAGES[step.id].length).toBeGreaterThan(0);
    });
  });

  it('welcome message mentions Rosa by name', () => {
    expect(ROSA_WIZARD_MESSAGES['welcome']).toContain('Rosa');
  });

  it('welcome message mentions EPR', () => {
    expect(ROSA_WIZARD_MESSAGES['welcome']).toContain('EPR');
  });

  it('registration message mentions RPD Organisation ID', () => {
    expect(ROSA_WIZARD_MESSAGES['registration']).toContain('RPD Organisation ID');
  });

  it('obligation message mentions turnover or reporting', () => {
    const msg = ROSA_WIZARD_MESSAGES['obligation'];
    expect(msg.includes('reporting') || msg.includes('turnover') || msg.includes('size')).toBe(true);
  });

  it('nation-split message mentions nations', () => {
    const msg = ROSA_WIZARD_MESSAGES['nation-split'];
    expect(msg.includes('England') || msg.includes('Scotland') || msg.includes('Wales')).toBe(true);
  });

  it('export-complete message mentions CSV or download', () => {
    const msg = ROSA_WIZARD_MESSAGES['export-complete'];
    expect(msg.includes('CSV') || msg.includes('download')).toBe(true);
  });

  it('no message is identical to another', () => {
    const messages = Object.values(ROSA_WIZARD_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
  });
});

// =============================================================================
// State Simulation (without React hooks)
// =============================================================================

describe('EPR Wizard State Transitions', () => {
  function simulateCompleteStep(state: EPRWizardState): EPRWizardState {
    const completedSteps = state.completedSteps.includes(state.currentStep)
      ? state.completedSteps
      : [...state.completedSteps, state.currentStep];

    const next = getNextEPRWizardStep(state.currentStep);

    if (!next) {
      return {
        ...state,
        completedSteps,
        completed: true,
        completedAt: new Date().toISOString(),
      };
    }

    return {
      ...state,
      completedSteps,
      currentStep: next,
    };
  }

  function simulateSkipStep(state: EPRWizardState): EPRWizardState {
    const config = getEPRWizardStepConfig(state.currentStep);
    if (!config.skippable) return state;
    const next = getNextEPRWizardStep(state.currentStep);
    if (!next) return state;
    return { ...state, currentStep: next };
  }

  it('completing welcome advances to registration', () => {
    const result = simulateCompleteStep(INITIAL_EPR_WIZARD_STATE);
    expect(result.currentStep).toBe('registration');
    expect(result.completedSteps).toContain('welcome');
  });

  it('completing all 10 steps marks wizard as completed', () => {
    let state = { ...INITIAL_EPR_WIZARD_STATE };
    for (let i = 0; i < 10; i++) {
      state = simulateCompleteStep(state);
    }
    expect(state.completed).toBe(true);
    expect(state.completedAt).toBeDefined();
    expect(state.completedSteps).toHaveLength(10);
  });

  it('skipping registration advances to obligation without completing registration', () => {
    let state = simulateCompleteStep(INITIAL_EPR_WIZARD_STATE); // welcome → registration
    state = simulateSkipStep(state); // skip registration → obligation
    expect(state.currentStep).toBe('obligation');
    expect(state.completedSteps).not.toContain('registration');
  });

  it('cannot skip non-skippable steps', () => {
    const state = { ...INITIAL_EPR_WIZARD_STATE }; // welcome (not skippable)
    const result = simulateSkipStep(state);
    expect(result.currentStep).toBe('welcome'); // unchanged
  });

  it('completing a step twice does not duplicate in completedSteps', () => {
    let state = simulateCompleteStep(INITIAL_EPR_WIZARD_STATE); // welcome → registration
    // Go back to welcome manually
    state = { ...state, currentStep: 'welcome' as EPRWizardStep };
    // Complete welcome again
    state = simulateCompleteStep(state);
    const welcomeCount = state.completedSteps.filter((s) => s === 'welcome').length;
    expect(welcomeCount).toBe(1);
  });

  it('dismissing sets dismissed to true', () => {
    const state: EPRWizardState = {
      ...INITIAL_EPR_WIZARD_STATE,
      dismissed: true,
    };
    expect(state.dismissed).toBe(true);
    expect(state.completed).toBe(false);
  });

  it('full walkthrough: complete all steps in order', () => {
    const expectedOrder: EPRWizardStep[] = [
      'welcome', 'registration', 'obligation', 'nation-split',
      'defaults', 'data-review', 'bulk-edit',
      'validation', 'generate', 'export-complete',
    ];

    let state = { ...INITIAL_EPR_WIZARD_STATE };
    const visitedSteps: EPRWizardStep[] = [];

    for (let i = 0; i < 10; i++) {
      visitedSteps.push(state.currentStep);
      state = simulateCompleteStep(state);
    }

    expect(visitedSteps).toEqual(expectedOrder);
    expect(state.completed).toBe(true);
    expect(state.completedSteps).toEqual(expectedOrder);
  });

  it('mixed skip + complete walkthrough', () => {
    let state = { ...INITIAL_EPR_WIZARD_STATE };

    // Complete welcome
    state = simulateCompleteStep(state);
    expect(state.currentStep).toBe('registration');

    // Skip registration
    state = simulateSkipStep(state);
    expect(state.currentStep).toBe('obligation');

    // Complete obligation
    state = simulateCompleteStep(state);
    expect(state.currentStep).toBe('nation-split');

    // Skip nation-split
    state = simulateSkipStep(state);
    expect(state.currentStep).toBe('defaults');

    // Skip defaults
    state = simulateSkipStep(state);
    expect(state.currentStep).toBe('data-review');

    // Complete rest
    state = simulateCompleteStep(state); // data-review → bulk-edit
    state = simulateSkipStep(state);     // skip bulk-edit → validation
    state = simulateCompleteStep(state); // validation → generate
    state = simulateCompleteStep(state); // generate → export-complete
    state = simulateCompleteStep(state); // export-complete → done

    expect(state.completed).toBe(true);
    // Only completed (not skipped) steps are in completedSteps
    expect(state.completedSteps).toContain('welcome');
    expect(state.completedSteps).toContain('obligation');
    expect(state.completedSteps).toContain('data-review');
    expect(state.completedSteps).toContain('validation');
    expect(state.completedSteps).toContain('generate');
    expect(state.completedSteps).toContain('export-complete');
    // Skipped steps are NOT in completedSteps
    expect(state.completedSteps).not.toContain('registration');
    expect(state.completedSteps).not.toContain('nation-split');
    expect(state.completedSteps).not.toContain('defaults');
    expect(state.completedSteps).not.toContain('bulk-edit');
  });
});

// =============================================================================
// Cross-phase Navigation
// =============================================================================

describe('EPR Wizard Cross-Phase Navigation', () => {
  it('nation-split (org-setup) advances to defaults (packaging-data)', () => {
    expect(getNextEPRWizardStep('nation-split')).toBe('defaults');
    expect(getEPRWizardStepConfig('nation-split').phase).toBe('org-setup');
    expect(getEPRWizardStepConfig('defaults').phase).toBe('packaging-data');
  });

  it('bulk-edit (packaging-data) advances to validation (validate-generate)', () => {
    expect(getNextEPRWizardStep('bulk-edit')).toBe('validation');
    expect(getEPRWizardStepConfig('bulk-edit').phase).toBe('packaging-data');
    expect(getEPRWizardStepConfig('validation').phase).toBe('validate-generate');
  });

  it('generate (validate-generate) advances to export-complete (export-finish)', () => {
    expect(getNextEPRWizardStep('generate')).toBe('export-complete');
    expect(getEPRWizardStepConfig('generate').phase).toBe('validate-generate');
    expect(getEPRWizardStepConfig('export-complete').phase).toBe('export-finish');
  });
});
