import { describe, it, expect } from 'vitest';
import {
  BIA_AREAS,
  biaAreaForRequirement,
  biaAreaNote,
} from '../bia-mapping';

describe('biaAreaForRequirement', () => {
  it('maps the 2026 impact topics to BIA areas by label', () => {
    expect(biaAreaForRequirement('foundation')).toBe('Governance');
    expect(biaAreaForRequirement('Purpose & Stakeholder Governance')).toBe('Governance');
    expect(biaAreaForRequirement('Fair Work')).toBe('Workers');
    expect(biaAreaForRequirement('Justice, Equity, Diversity & Inclusion')).toBe('Workers');
    expect(biaAreaForRequirement('Human Rights')).toBe('Community');
    expect(biaAreaForRequirement('Climate Action')).toBe('Environment');
    expect(biaAreaForRequirement('Environmental Stewardship & Circularity')).toBe('Environment');
    expect(biaAreaForRequirement('Government Affairs & Collective Action')).toBe('Community');
  });

  it('is case-insensitive on the topic label', () => {
    expect(biaAreaForRequirement('CLIMATE ACTION')).toBe('Environment');
  });

  it('falls back to the IT code prefix when the label is unknown', () => {
    expect(biaAreaForRequirement('Some renamed topic', 'IT2-Y0-001')).toBe('Workers');
    expect(biaAreaForRequirement('', 'IT5-Y3-002')).toBe('Environment');
    expect(biaAreaForRequirement(null, 'FR-R-000')).toBe('Governance');
  });

  it('defaults unknown requirements to Governance rather than dropping them', () => {
    expect(biaAreaForRequirement('totally unknown', 'ZZ-1')).toBe('Governance');
    expect(biaAreaForRequirement(null, null)).toBe('Governance');
  });

  it('every BIA area has a placement note', () => {
    for (const area of BIA_AREAS) {
      expect(biaAreaNote(area).length).toBeGreaterThan(10);
    }
  });
});
