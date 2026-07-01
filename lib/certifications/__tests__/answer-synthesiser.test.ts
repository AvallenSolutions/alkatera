import { describe, it, expect } from 'vitest';
import {
  synthesiseRequirementAnswer,
  type RequirementAnswerInput,
} from '../answer-synthesiser';
import type { PlatformEvidenceResult } from '../platform-data';
import type { RequirementGuidance } from '../requirement-guidance';

const guidance: RequirementGuidance = {
  summary: 'Measure your GHG footprint across Scope 1, 2 and 3.',
  evidence: ['Your corporate emissions inventory.', 'A Scope 3 breakdown.'],
};

function platform(
  overrides: Partial<PlatformEvidenceResult> = {},
): PlatformEvidenceResult {
  return {
    module: 'emissions',
    moduleLabel: 'Emissions',
    moduleLink: '/data',
    found: true,
    completeness: 'complete',
    completenessNote: null,
    items: [
      {
        sourceRecordId: 'emissions-2024',
        label: 'GHG inventory 2024',
        summary: '12.34 tCO2e total. Scope 1 1.0, Scope 2 2.0, Scope 3 9.34',
      },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<RequirementAnswerInput> = {}): RequirementAnswerInput {
  return {
    status: 'passed',
    platform: null,
    evidenceLinks: [],
    guidance,
    ...overrides,
  };
}

describe('synthesiseRequirementAnswer', () => {
  it('uses real platform values as a strong answer', () => {
    const r = synthesiseRequirementAnswer(input({ platform: platform() }));
    expect(r.confidence).toBe('strong');
    expect(r.answer).toContain('GHG inventory 2024: 12.34 tCO2e total');
    expect(r.dataSource).toBe('Emissions');
    expect(r.dataQuality).toBe('Complete');
    expect(r.gap).toBeNull();
    expect(r.dataPoints).toHaveLength(1);
  });

  it('flags partial platform data and surfaces the completeness note as the gap', () => {
    const r = synthesiseRequirementAnswer(
      input({
        platform: platform({
          completeness: 'partial',
          completenessNote: 'You have a target but no method behind it.',
        }),
      }),
    );
    expect(r.confidence).toBe('partial');
    expect(r.dataQuality).toBe('Partial');
    expect(r.gap).toBe('You have a target but no method behind it.');
    // The real value is still present in the answer.
    expect(r.answer).toContain('12.34 tCO2e');
  });

  it('falls back to manual evidence descriptions when there is no platform mapping', () => {
    const r = synthesiseRequirementAnswer(
      input({
        platform: null,
        evidenceLinks: [
          { description: 'Living Wage Employer certificate 2026', status: 'verified', sourceModule: 'evidence_library' },
        ],
      }),
    );
    expect(r.confidence).toBe('manual');
    expect(r.dataSource).toBe('Manual evidence');
    expect(r.dataQuality).toBe('Manual');
    expect(r.answer).toBe('Living Wage Employer certificate 2026');
    expect(r.gap).toBeNull();
  });

  it('prefers platform values over manual descriptions when both exist', () => {
    const r = synthesiseRequirementAnswer(
      input({
        platform: platform(),
        evidenceLinks: [
          { description: 'A supporting note', status: 'verified', sourceModule: 'evidence_library' },
        ],
      }),
    );
    expect(r.dataPoints).toEqual([
      'GHG inventory 2024: 12.34 tCO2e total. Scope 1 1.0, Scope 2 2.0, Scope 3 9.34',
    ]);
  });

  it('gives an actionable gap from the guidance when nothing is on file', () => {
    const r = synthesiseRequirementAnswer(
      input({ status: 'not_started', platform: null, evidenceLinks: [] }),
    );
    expect(r.confidence).toBe('none');
    expect(r.answer).toBe('');
    expect(r.gap).toContain('Not in alkatera yet');
    expect(r.gap).toContain('Your corporate emissions inventory.');
    expect(r.dataSource).toBe('');
    expect(r.dataQuality).toBe('');
  });

  it('warns when evidence is attached but not yet verified', () => {
    const r = synthesiseRequirementAnswer(
      input({
        status: 'in_progress',
        platform: null,
        evidenceLinks: [
          { description: 'Draft policy', status: 'pending', sourceModule: 'evidence_library' },
        ],
      }),
    );
    expect(r.confidence).toBe('manual');
    expect(r.gap).toContain('not yet verified');
  });

  it('does not treat a probe that found nothing as a manual fallback source', () => {
    const r = synthesiseRequirementAnswer(
      input({
        platform: platform({ found: false, completeness: 'missing', items: [] }),
        evidenceLinks: [],
      }),
    );
    expect(r.confidence).toBe('none');
    expect(r.dataQuality).toBe('Missing');
    expect(r.answer).toBe('');
  });
});
