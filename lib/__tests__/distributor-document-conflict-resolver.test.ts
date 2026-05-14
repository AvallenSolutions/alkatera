import { describe, it, expect } from 'vitest';
import { autoResolve, decideConflict } from '@/lib/distributor/document-processing/conflict-resolver';

describe('autoResolve', () => {
  it('uses brand-uploaded value when it is high-confidence and beats existing', () => {
    expect(autoResolve(0.6, 0.85, 'brand_upload')).toBe('use_new');
    expect(autoResolve(0.5, 0.95, 'brand_upload')).toBe('use_new');
  });

  it('keeps existing when new confidence is much lower', () => {
    expect(autoResolve(0.9, 0.5, 'brand_upload')).toBe('keep_existing');
    expect(autoResolve(0.95, 0.4, 'brand_upload')).toBe('keep_existing');
  });

  it('flags for review when the gap is borderline', () => {
    expect(autoResolve(0.85, 0.85, 'brand_upload')).toBe('flagged_for_review');
    expect(autoResolve(0.85, 0.65, 'brand_upload')).toBe('flagged_for_review');
  });

  it('does not auto-prefer non-brand-upload new sources', () => {
    expect(autoResolve(0.5, 0.95, 'B Corp Directory')).toBe('flagged_for_review');
  });
});

describe('decideConflict — numeric fields', () => {
  it('treats values within 10% as not differing', () => {
    const decision = decideConflict({
      fieldKey: 'carbon_intensity_kgco2e_per_litre',
      existingValueText: '0.45',
      existingValueNumeric: 0.45,
      existingConfidence: 0.7,
      existingSource: 'B Corp Directory',
      newValueText: '0.42',
      newValueNumeric: 0.42,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(false);
  });

  it('treats values outside 10% as differing', () => {
    const decision = decideConflict({
      fieldKey: 'carbon_intensity_kgco2e_per_litre',
      existingValueText: '0.45',
      existingValueNumeric: 0.45,
      existingConfidence: 0.7,
      existingSource: 'B Corp Directory',
      newValueText: '0.30',
      newValueNumeric: 0.30,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(true);
    expect(decision.resolution).toBe('use_new');
  });

  it('ignores tiny absolute differences even at high relative gaps', () => {
    const decision = decideConflict({
      fieldKey: 'water_usage_litres_per_litre',
      existingValueText: '0.001',
      existingValueNumeric: 0.001,
      existingConfidence: 0.6,
      existingSource: 'B Corp Directory',
      newValueText: '0.0008',
      newValueNumeric: 0.0008,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(false);
  });
});

describe('decideConflict — boolean fields', () => {
  it('reports a difference when the canonical values differ', () => {
    const decision = decideConflict({
      fieldKey: 'bcorp_certified',
      existingValueText: 'true',
      existingValueNumeric: 1,
      existingConfidence: 0.8,
      existingSource: 'B Corp Directory',
      newValueText: 'false',
      newValueNumeric: 0,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(true);
  });

  it('does not flag matching booleans', () => {
    const decision = decideConflict({
      fieldKey: 'bcorp_certified',
      existingValueText: 'true',
      existingValueNumeric: 1,
      existingConfidence: 0.8,
      existingSource: 'B Corp Directory',
      newValueText: 'true',
      newValueNumeric: 1,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(false);
  });
});

describe('decideConflict — year fields', () => {
  it('differs on any year mismatch', () => {
    const a = decideConflict({
      fieldKey: 'founding_year',
      existingValueText: '1810',
      existingValueNumeric: 1810,
      existingConfidence: 0.7,
      existingSource: 'Wikipedia',
      newValueText: '1820',
      newValueNumeric: 1820,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(a.differs).toBe(true);
  });
});

describe('decideConflict — string fields', () => {
  it('case-insensitive equality is treated as equal', () => {
    const decision = decideConflict({
      fieldKey: 'parent_company',
      existingValueText: 'LVMH',
      existingValueNumeric: null,
      existingConfidence: 0.7,
      existingSource: 'Wikipedia',
      newValueText: 'lvmh',
      newValueNumeric: null,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(false);
  });

  it('flags genuinely different strings', () => {
    const decision = decideConflict({
      fieldKey: 'parent_company',
      existingValueText: 'LVMH',
      existingValueNumeric: null,
      existingConfidence: 0.7,
      existingSource: 'Wikipedia',
      newValueText: 'Pernod Ricard',
      newValueNumeric: null,
      newConfidence: 0.85,
      newSource: 'brand_upload',
    });
    expect(decision.differs).toBe(true);
  });
});
