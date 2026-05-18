import { describe, it, expect } from 'vitest';
import { isRecertPrepActive } from '@/lib/certifications/scoring';
import {
  computeRiskProfile,
  deriveTriggeredRequirements,
  isRiskToolComplete,
  RISK_TOOL_QUESTIONS,
} from '@/lib/certifications/risk-tool-questions';

describe('isRecertPrepActive', () => {
  const today = new Date('2026-05-17');
  it('is false with no start date', () => {
    expect(isRecertPrepActive(null, today)).toBe(false);
  });
  it('is false before the 4th anniversary', () => {
    expect(isRecertPrepActive('2022-06-01', today)).toBe(false);
  });
  it('is true on or after the 4th anniversary', () => {
    expect(isRecertPrepActive('2022-05-17', today)).toBe(true);
    expect(isRecertPrepActive('2021-01-01', today)).toBe(true);
  });
});

describe('computeRiskProfile', () => {
  it('returns low for all-low answers', () => {
    const responses: Record<string, string> = {};
    for (const q of RISK_TOOL_QUESTIONS) {
      responses[q.id] = q.options[0].value; // weight 0
    }
    const profile = computeRiskProfile(responses);
    expect(profile).toEqual({
      sector: 'low',
      geographic: 'low',
      supply_chain: 'low',
      workforce: 'low',
    });
  });

  it('returns high when both questions in a dimension are max weight', () => {
    const responses: Record<string, string> = {};
    for (const q of RISK_TOOL_QUESTIONS) {
      const high = q.options.find((o) => o.weight === 2) ?? q.options[0];
      responses[q.id] = high.value;
    }
    const profile = computeRiskProfile(responses);
    expect(profile.sector).toBe('high');
    expect(profile.workforce).toBe('high');
    expect(deriveTriggeredRequirements(profile).length).toBeGreaterThan(0);
  });

  it('isRiskToolComplete requires every question answered', () => {
    expect(isRiskToolComplete({})).toBe(false);
    const full: Record<string, string> = {};
    for (const q of RISK_TOOL_QUESTIONS) full[q.id] = q.options[0].value;
    expect(isRiskToolComplete(full)).toBe(true);
  });
});
