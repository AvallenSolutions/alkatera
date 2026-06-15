import { describe, it, expect } from 'vitest';
import {
  BCORP_SECTIONS,
  bcorpSectionForRequirement,
} from '../bcorp-structure';

describe('bcorpSectionForRequirement', () => {
  it('has Foundation first then the 7 Impact Topics in B Corp order', () => {
    expect(BCORP_SECTIONS.map((s) => s.abbrev)).toEqual([
      'FR',
      'PSG',
      'FW',
      'JEDI',
      'HR',
      'CA',
      'ESC',
      'GA',
    ]);
  });

  it('maps each topic label to its section', () => {
    expect(bcorpSectionForRequirement('foundation').abbrev).toBe('FR');
    expect(bcorpSectionForRequirement('Purpose & Stakeholder Governance').abbrev).toBe('PSG');
    expect(bcorpSectionForRequirement('Fair Work').abbrev).toBe('FW');
    expect(bcorpSectionForRequirement('Justice, Equity, Diversity & Inclusion').abbrev).toBe('JEDI');
    expect(bcorpSectionForRequirement('Human Rights').abbrev).toBe('HR');
    expect(bcorpSectionForRequirement('Climate Action').abbrev).toBe('CA');
    expect(bcorpSectionForRequirement('Environmental Stewardship & Circularity').abbrev).toBe('ESC');
    expect(bcorpSectionForRequirement('Government Affairs & Collective Action').abbrev).toBe('GA');
  });

  it('is case-insensitive on the topic label', () => {
    expect(bcorpSectionForRequirement('climate action').abbrev).toBe('CA');
  });

  it('falls back to the IT code prefix when the label is unknown', () => {
    expect(bcorpSectionForRequirement('renamed', 'IT3-Y3-001').abbrev).toBe('JEDI');
    expect(bcorpSectionForRequirement('', 'IT6-Y0-001').abbrev).toBe('ESC');
    expect(bcorpSectionForRequirement(null, 'FR-R-000').abbrev).toBe('FR');
  });

  it('defaults unknown requirements to Foundation rather than dropping them', () => {
    expect(bcorpSectionForRequirement('mystery', 'ZZ-1').abbrev).toBe('FR');
    expect(bcorpSectionForRequirement(null, null).abbrev).toBe('FR');
  });
});
