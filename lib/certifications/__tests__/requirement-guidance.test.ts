import { describe, it, expect } from 'vitest';
import { getRequirementGuidance } from '../requirement-guidance';

// The rich guidance (evidence examples, pitfalls, templates) is keyed by the
// pre-v2.1 codes, while the live requirements now use v2.1 codes (CA1.1, PSG1.1).
// getRequirementGuidance must bridge the two via each requirement's `legacy`
// code, or every requirement falls through to generic guidance.
describe('getRequirementGuidance — v2.1 code resolution', () => {
  it('resolves rich evidence + pitfalls for a v2.1 code via its legacy code', () => {
    // CA1.1 supersedes IT5-Y0-001 (GHG measurement).
    const g = getRequirementGuidance('CA1.1', 'Climate Action');
    expect(g.summary.toLowerCase()).toContain('scope 1, 2 and 3');
    expect(g.evidence.join(' ').toLowerCase()).toContain('emissions inventory');
    expect((g.pitfalls ?? []).join(' ').toLowerCase()).toContain('scope 3');
  });

  it('surfaces a starter template for a v2.1 code whose legacy code has one', () => {
    // PSG1.1 supersedes IT1-Y0-001, which has a purpose-statement template.
    const g = getRequirementGuidance('PSG1.1', 'Purpose & Stakeholder Governance');
    expect(g.template).toBeTruthy();
    expect(g.template).toContain('[Company]');
  });

  it('keeps the current v2.1 summary even when no legacy guidance exists', () => {
    // CA1.2 (third-party verification) has no legacy mapping.
    const g = getRequirementGuidance('CA1.2', 'Climate Action');
    expect(g.summary.toLowerCase()).toContain('verif');
    expect(g.evidence.length).toBeGreaterThan(0);
  });
});
