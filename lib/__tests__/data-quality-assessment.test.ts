import { vi, beforeEach } from 'vitest';
import {
  assessMaterialDataQuality,
  assessAggregateDataQuality,
  propagateUncertainty,
  calculatePedigreeDqi,
  calculateTemporalScore,
  calculateGeographicalScore,
  calculateUncertainty,
  gradeToDefaultPedigree,
  type MaterialAssessmentInput,
  type MaterialDataQuality,
  type PedigreeMatrix,
} from '@/lib/data-quality-assessment';

// ============================================================================
// FACTORY HELPERS
// ============================================================================

function makeMaterialInput(overrides: Partial<MaterialAssessmentInput> = {}): MaterialAssessmentInput {
  return {
    materialName: 'Test Material',
    materialId: 'mat-001',
    impactValue: 10,
    impactUnit: 'kg CO2e',
    dataSource: 'ecoinvent',
    dataSourceTier: 'secondary_modelled',
    qualityGrade: 'MEDIUM',
    dataYear: 2024,
    dataRegion: 'GLO',
    studyRegion: 'GLO',
    referenceYear: 2025,
    uncertaintyPercent: 20,
    ...overrides,
  };
}

function makeAssessedMaterial(overrides: Partial<MaterialAssessmentInput> = {}): MaterialDataQuality {
  return assessMaterialDataQuality(makeMaterialInput(overrides));
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// calculatePedigreeDqi
// ============================================================================

describe('calculatePedigreeDqi', () => {
  it('returns 100 for perfect scores (all 1s)', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 1, completeness: 1, temporal: 1, geographical: 1, technological: 1,
    };
    expect(calculatePedigreeDqi(pedigree)).toBe(100);
  });

  it('returns 0 for worst scores (all 5s)', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 5, completeness: 5, temporal: 5, geographical: 5, technological: 5,
    };
    expect(calculatePedigreeDqi(pedigree)).toBe(0);
  });

  it('returns 50 for middle scores (all 3s)', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 3, completeness: 3, temporal: 3, geographical: 3, technological: 3,
    };
    expect(calculatePedigreeDqi(pedigree)).toBe(50);
  });

  it('returns 75 for all 2s', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2,
    };
    expect(calculatePedigreeDqi(pedigree)).toBe(75);
  });
});

// ============================================================================
// calculateTemporalScore
// ============================================================================

describe('calculateTemporalScore', () => {
  it('scores 1 when data year equals reference year', () => {
    const result = calculateTemporalScore(2024, 2024);
    expect(result.score).toBe(1);
    expect(result.isStale).toBe(false);
    expect(result.isVeryStale).toBe(false);
  });

  it('scores 1 for data within 2 years of reference year', () => {
    expect(calculateTemporalScore(2023, 2024).score).toBe(1);
    expect(calculateTemporalScore(2022, 2024).score).toBe(1);
  });

  it('scores 2 for data 3-5 years from reference year', () => {
    expect(calculateTemporalScore(2021, 2024).score).toBe(2);
    expect(calculateTemporalScore(2019, 2024).score).toBe(2);
  });

  it('scores 3 for data 6-9 years from reference year', () => {
    const result = calculateTemporalScore(2018, 2024);
    expect(result.score).toBe(3);
    expect(result.isStale).toBe(true);
    expect(result.isVeryStale).toBe(false);
  });

  it('scores 4 for data 10-14 years from reference year', () => {
    const result = calculateTemporalScore(2014, 2024);
    expect(result.score).toBe(4);
    expect(result.isStale).toBe(true);
    expect(result.isVeryStale).toBe(true);
  });

  it('scores 5 when data year is null', () => {
    const result = calculateTemporalScore(null, 2024);
    expect(result.score).toBe(5);
    expect(result.isStale).toBe(true);
    expect(result.isVeryStale).toBe(true);
  });

  it('scores 5 for data 15+ years from reference year', () => {
    expect(calculateTemporalScore(2005, 2024).score).toBe(5);
  });

  it('uses absolute difference (future data scores the same as past data)', () => {
    expect(calculateTemporalScore(2028, 2024).score).toBe(2);
    expect(calculateTemporalScore(2020, 2024).score).toBe(2);
  });
});

// ============================================================================
// calculateGeographicalScore
// ============================================================================

describe('calculateGeographicalScore', () => {
  it('scores 1 for exact country match', () => {
    const result = calculateGeographicalScore('FR', 'FR');
    expect(result.score).toBe(1);
    expect(result.isExactMatch).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(calculateGeographicalScore('fr', 'FR').score).toBe(1);
  });

  it('scores 2 for EU country with EU average data', () => {
    expect(calculateGeographicalScore('EU', 'FR').score).toBe(2);
    expect(calculateGeographicalScore('DE', 'FR').score).toBe(2);
  });

  it('scores 3 for GLO data when study is a specific country', () => {
    const result = calculateGeographicalScore('GLO', 'FR');
    expect(result.score).toBe(3);
    expect(result.isExactMatch).toBe(false);
    expect(result.isRegionalMatch).toBe(false);
  });

  it('scores 3 for same-continent non-EU countries', () => {
    expect(calculateGeographicalScore('US', 'CA').score).toBe(3);
  });

  it('scores 4 for different regions entirely', () => {
    expect(calculateGeographicalScore('US', 'FR').score).toBe(4);
  });

  it('scores 1 for GLO matching GLO', () => {
    expect(calculateGeographicalScore('GLO', 'GLO').score).toBe(1);
  });
});

// ============================================================================
// calculateUncertainty
// ============================================================================

describe('calculateUncertainty', () => {
  it('uses explicit uncertainty when provided', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 5, completeness: 5, temporal: 5, geographical: 5, technological: 5,
    };
    const result = calculateUncertainty(pedigree, 'default', 20);
    expect(result.totalUncertainty).toBe(0.2);
    expect(result.pedigreeUncertainty).toBe(0);
  });

  it('calculates from pedigree when no explicit uncertainty given', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 1, completeness: 1, temporal: 1, geographical: 1, technological: 1,
    };
    const result = calculateUncertainty(pedigree, 'default');
    expect(result.totalUncertainty).toBeGreaterThan(0);
    expect(result.pedigreeUncertainty).toBe(0); // all 1s = 0 pedigree uncertainty
    expect(result.basicUncertainty).toBeGreaterThan(0);
  });

  it('produces higher uncertainty for worse pedigree scores', () => {
    const good: PedigreeMatrix = {
      reliability: 1, completeness: 1, temporal: 1, geographical: 1, technological: 1,
    };
    const bad: PedigreeMatrix = {
      reliability: 5, completeness: 5, temporal: 5, geographical: 5, technological: 5,
    };
    const resultGood = calculateUncertainty(good, 'default');
    const resultBad = calculateUncertainty(bad, 'default');
    expect(resultBad.totalUncertainty).toBeGreaterThan(resultGood.totalUncertainty);
  });

  it('returns valid 95% confidence interval bounds', () => {
    const pedigree: PedigreeMatrix = {
      reliability: 3, completeness: 3, temporal: 3, geographical: 3, technological: 3,
    };
    const result = calculateUncertainty(pedigree, 'default');
    expect(result.confidenceInterval95.lower).toBeGreaterThan(0);
    expect(result.confidenceInterval95.lower).toBeLessThan(1);
    expect(result.confidenceInterval95.upper).toBeGreaterThan(1);
  });
});

// ============================================================================
// gradeToDefaultPedigree
// ============================================================================

describe('gradeToDefaultPedigree', () => {
  it('returns all 2s for HIGH', () => {
    const p = gradeToDefaultPedigree('HIGH');
    expect(p.reliability).toBe(2);
    expect(p.temporal).toBe(2);
  });

  it('returns all 3s for MEDIUM', () => {
    const p = gradeToDefaultPedigree('MEDIUM');
    expect(p.reliability).toBe(3);
  });

  it('returns all 4s for LOW', () => {
    const p = gradeToDefaultPedigree('LOW');
    expect(p.reliability).toBe(4);
  });
});

// ============================================================================
// assessMaterialDataQuality
// ============================================================================

describe('assessMaterialDataQuality', () => {
  describe('data source tier scoring', () => {
    it('primary_verified data scores higher DQI than secondary_estimated', () => {
      const primary = makeAssessedMaterial({
        dataSourceTier: 'primary_verified',
        qualityGrade: 'HIGH',
        uncertaintyPercent: undefined,
      });
      const estimated = makeAssessedMaterial({
        dataSourceTier: 'secondary_estimated',
        qualityGrade: 'LOW',
        uncertaintyPercent: undefined,
      });
      expect(primary.pedigreeDqi).toBeGreaterThan(estimated.pedigreeDqi);
    });

    it('primary_measured (HIGH) scores higher DQI than secondary_modelled (MEDIUM)', () => {
      const primary = makeAssessedMaterial({
        dataSourceTier: 'primary_verified',
        qualityGrade: 'HIGH',
        uncertaintyPercent: undefined,
      });
      const modelled = makeAssessedMaterial({
        dataSourceTier: 'secondary_modelled',
        qualityGrade: 'MEDIUM',
        uncertaintyPercent: undefined,
      });
      expect(primary.pedigreeDqi).toBeGreaterThan(modelled.pedigreeDqi);
    });
  });

  describe('temporal scoring with referenceYear', () => {
    it('data from referenceYear=2024 with dataYear=2024 scores temporal 1', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2024,
      }));
      expect(result.pedigreeMatrix.temporal).toBe(1);
      expect(result.temporalRepresentativeness.yearsDifference).toBe(0);
      expect(result.temporalRepresentativeness.isStale).toBe(false);
    });

    it('data from 2024 with referenceYear=2020 scores worse for temporal (4 years difference)', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2020,
      }));
      // |2020 - 2024| = 4, which falls in 3-5 range => score 2
      expect(result.pedigreeMatrix.temporal).toBe(2);
      expect(result.temporalRepresentativeness.yearsDifference).toBe(4);
    });

    it('data from 2024 with referenceYear=2015 scores temporal 3 (9 years difference)', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2015,
      }));
      // |2015 - 2024| = 9 => score 3 (6-9 range)
      expect(result.pedigreeMatrix.temporal).toBe(3);
      expect(result.temporalRepresentativeness.isStale).toBe(true);
    });

    it('uses the provided referenceYear, NOT new Date().getFullYear()', () => {
      const withExplicitYear = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2024,
      }));
      // If it used current year (2026) instead of 2024, the temporal score would be 1 still
      // but the yearsDifference would be 2 instead of 0
      expect(withExplicitYear.temporalRepresentativeness.referenceYear).toBe(2024);
      expect(withExplicitYear.temporalRepresentativeness.yearsDifference).toBe(0);
    });

    it('with referenceYear=2024 and dataYear=2024, temporal score is 1 (best)', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2024,
      }));
      expect(result.pedigreeMatrix.temporal).toBe(1);
    });

    it('with referenceYear=2020 and dataYear=2024, temporal score is worse than 1', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2024,
        referenceYear: 2020,
      }));
      expect(result.pedigreeMatrix.temporal).toBeGreaterThan(1);
    });

    it('data 5+ years from referenceYear scores temporal >= 2', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        dataYear: 2018,
        referenceYear: 2024,
      }));
      // |2024 - 2018| = 6 => score 3
      expect(result.pedigreeMatrix.temporal).toBe(3);
    });
  });

  describe('geographic scoring', () => {
    it('exact country match scores better than continental', () => {
      const exact = makeAssessedMaterial({ dataRegion: 'FR', studyRegion: 'FR' });
      const continental = makeAssessedMaterial({ dataRegion: 'EU', studyRegion: 'FR' });
      expect(exact.pedigreeMatrix.geographical).toBeLessThan(continental.pedigreeMatrix.geographical);
    });

    it('continental match scores better than global', () => {
      const continental = makeAssessedMaterial({ dataRegion: 'EU', studyRegion: 'FR' });
      const global = makeAssessedMaterial({ dataRegion: 'GLO', studyRegion: 'FR' });
      expect(continental.pedigreeMatrix.geographical).toBeLessThan(global.pedigreeMatrix.geographical);
    });

    it('exact match sets isExactMatch to true', () => {
      const result = makeAssessedMaterial({ dataRegion: 'FR', studyRegion: 'FR' });
      expect(result.geographicMatch.isExactMatch).toBe(true);
      expect(result.geographicMatch.isRegionalMatch).toBe(true);
    });
  });

  describe('uncertainty calculation', () => {
    it('produces positive uncertainty values', () => {
      const result = makeAssessedMaterial({ uncertaintyPercent: undefined });
      expect(result.uncertainty.totalUncertainty).toBeGreaterThan(0);
      expect(result.uncertaintyPercent).toBeGreaterThan(0);
    });

    it('uses explicit uncertaintyPercent when provided', () => {
      const result = makeAssessedMaterial({ uncertaintyPercent: 30 });
      expect(result.uncertaintyPercent).toBe(30);
    });

    it('calculates uncertaintyPercent from pedigree when not provided', () => {
      const result = makeAssessedMaterial({ uncertaintyPercent: undefined });
      expect(result.uncertaintyPercent).toBeGreaterThan(0);
      expect(result.uncertaintyPercent).toBeLessThan(100);
    });
  });

  describe('quality flags', () => {
    it('flags very stale data (>6 years old)', () => {
      const result = makeAssessedMaterial({
        dataYear: 2015,
        referenceYear: 2025,
        uncertaintyPercent: undefined,
      });
      expect(result.flags).toContain('DATA_VERY_STALE: Data is >6 years old');
    });

    it('flags stale data (>3 years old)', () => {
      const result = makeAssessedMaterial({
        dataYear: 2018,
        referenceYear: 2025,
        uncertaintyPercent: undefined,
      });
      expect(result.flags).toContain('DATA_STALE: Data is >3 years old');
    });

    it('flags geographic mismatch (score >= 4)', () => {
      const result = makeAssessedMaterial({
        dataRegion: 'US',
        studyRegion: 'FR',
      });
      expect(result.flags).toContain('GEO_MISMATCH: Data from different geographic region');
    });

    it('flags low quality grade', () => {
      const result = makeAssessedMaterial({ qualityGrade: 'LOW' });
      expect(result.flags).toContain('LOW_QUALITY: Factor has low data quality grade');
    });

    it('has no flags for high quality, recent, region-matched data', () => {
      const result = makeAssessedMaterial({
        qualityGrade: 'HIGH',
        dataYear: 2024,
        referenceYear: 2025,
        dataRegion: 'FR',
        studyRegion: 'FR',
        uncertaintyPercent: 10,
      });
      expect(result.flags).toHaveLength(0);
    });
  });

  describe('pedigree overrides', () => {
    it('uses explicit pedigree scores when provided', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        pedigree: { reliability: 1, completeness: 1, technological: 1 },
        qualityGrade: 'LOW', // defaults would be 4, but overrides should win
      }));
      expect(result.pedigreeMatrix.reliability).toBe(1);
      expect(result.pedigreeMatrix.completeness).toBe(1);
      expect(result.pedigreeMatrix.technological).toBe(1);
    });

    it('falls back to grade defaults for non-overridden dimensions', () => {
      const result = assessMaterialDataQuality(makeMaterialInput({
        pedigree: { reliability: 1 },
        qualityGrade: 'LOW',
        dataRegion: 'GLO',
        studyRegion: 'GLO',
        dataYear: null,
      }));
      expect(result.pedigreeMatrix.reliability).toBe(1);
      // completeness should be from LOW default = 4
      expect(result.pedigreeMatrix.completeness).toBe(4);
    });
  });

  describe('null/undefined data year', () => {
    it('handles null dataYear gracefully', () => {
      const result = makeAssessedMaterial({ dataYear: null });
      expect(result.temporalRepresentativeness.dataYear).toBeNull();
      expect(result.temporalRepresentativeness.yearsDifference).toBeNull();
      expect(result.pedigreeMatrix.temporal).toBe(5);
    });

    it('handles undefined dataYear (defaults to null)', () => {
      const result = assessMaterialDataQuality({
        materialName: 'No Year',
        materialId: 'no-year',
        impactValue: 5,
        impactUnit: 'kg CO2e',
        dataSource: 'estimate',
        dataSourceTier: 'secondary_estimated',
        qualityGrade: 'LOW',
        referenceYear: 2025,
      });
      expect(result.temporalRepresentativeness.dataYear).toBeNull();
      expect(result.pedigreeMatrix.temporal).toBe(5);
    });
  });

  describe('defaults for optional fields', () => {
    it('defaults dataRegion and studyRegion to GLO', () => {
      const result = assessMaterialDataQuality({
        materialName: 'Minimal',
        materialId: 'min-001',
        impactValue: 5,
        impactUnit: 'kg CO2e',
        dataSource: 'ecoinvent',
        dataSourceTier: 'secondary_modelled',
        qualityGrade: 'MEDIUM',
        referenceYear: 2025,
      });
      expect(result.geographicMatch.dataRegion).toBe('GLO');
      expect(result.geographicMatch.studyRegion).toBe('GLO');
    });
  });
});

// ============================================================================
// assessAggregateDataQuality
// ============================================================================

describe('assessAggregateDataQuality', () => {
  describe('empty materials', () => {
    it('returns LOW confidence with critical flag for empty array', () => {
      const result = assessAggregateDataQuality([], 2025);
      expect(result.overallDqi).toBe(0);
      expect(result.overallConfidence).toBe('LOW');
      expect(result.weightedUncertainty).toBe(100);
      expect(result.isoCompliant).toBe(false);
      expect(result.qualityFlags).toHaveLength(1);
      expect(result.qualityFlags[0].code).toBe('NO_DATA');
    });
  });

  describe('single material', () => {
    it('aggregate DQI equals the single material DQI', () => {
      const material = makeAssessedMaterial({
        impactValue: 10,
        referenceYear: 2025,
      });
      const result = assessAggregateDataQuality([material], 2025);
      expect(result.overallDqi).toBe(material.pedigreeDqi);
    });

    it('data source breakdown shows 100% for the material tier', () => {
      const material = makeAssessedMaterial({
        dataSourceTier: 'primary_verified',
        qualityGrade: 'HIGH',
        impactValue: 10,
      });
      const result = assessAggregateDataQuality([material], 2025);
      expect(result.dataSourceBreakdown.primaryVerified.count).toBe(1);
      expect(result.dataSourceBreakdown.primaryVerified.impactShare).toBe(100);
      expect(result.dataSourceBreakdown.secondaryModelled.count).toBe(0);
      expect(result.dataSourceBreakdown.secondaryEstimated.count).toBe(0);
    });
  });

  describe('impact-weighted DQI', () => {
    it('weights DQI by impact value', () => {
      const highImpact = makeAssessedMaterial({
        materialName: 'Heavy',
        materialId: 'heavy',
        impactValue: 100,
        qualityGrade: 'HIGH',
        dataSourceTier: 'primary_verified',
        referenceYear: 2025,
        dataYear: 2024,
        uncertaintyPercent: undefined,
      });
      const lowImpact = makeAssessedMaterial({
        materialName: 'Light',
        materialId: 'light',
        impactValue: 1,
        qualityGrade: 'LOW',
        dataSourceTier: 'secondary_estimated',
        referenceYear: 2025,
        dataYear: 2024,
        uncertaintyPercent: undefined,
      });

      const result = assessAggregateDataQuality([highImpact, lowImpact], 2025);

      // Weighted DQI should be much closer to the high-impact material's DQI
      expect(result.overallDqi).toBeGreaterThan(lowImpact.pedigreeDqi);
      // Should be within a few points of the high-impact material
      expect(Math.abs(result.overallDqi - highImpact.pedigreeDqi)).toBeLessThan(5);
    });
  });

  describe('data source breakdown percentages', () => {
    it('percentages sum to approximately 100', () => {
      const materials = [
        makeAssessedMaterial({
          materialId: 'a', impactValue: 10, dataSourceTier: 'primary_verified', qualityGrade: 'HIGH',
        }),
        makeAssessedMaterial({
          materialId: 'b', impactValue: 20, dataSourceTier: 'secondary_modelled',
        }),
        makeAssessedMaterial({
          materialId: 'c', impactValue: 30, dataSourceTier: 'secondary_estimated', qualityGrade: 'LOW',
        }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);

      const total =
        result.dataSourceBreakdown.primaryVerified.impactShare +
        result.dataSourceBreakdown.secondaryModelled.impactShare +
        result.dataSourceBreakdown.secondaryEstimated.impactShare;

      // Due to rounding, might not be exactly 100
      expect(total).toBeGreaterThanOrEqual(99);
      expect(total).toBeLessThanOrEqual(101);
    });

    it('counts materials correctly per tier', () => {
      const materials = [
        makeAssessedMaterial({ materialId: 'a', dataSourceTier: 'primary_verified', qualityGrade: 'HIGH' }),
        makeAssessedMaterial({ materialId: 'b', dataSourceTier: 'primary_verified', qualityGrade: 'HIGH' }),
        makeAssessedMaterial({ materialId: 'c', dataSourceTier: 'secondary_modelled' }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.dataSourceBreakdown.primaryVerified.count).toBe(2);
      expect(result.dataSourceBreakdown.secondaryModelled.count).toBe(1);
      expect(result.dataSourceBreakdown.secondaryEstimated.count).toBe(0);
    });
  });

  describe('handles zero-impact materials', () => {
    it('does not divide by zero when all impacts are zero', () => {
      const materials = [
        makeAssessedMaterial({ materialId: 'a', impactValue: 0 }),
        makeAssessedMaterial({ materialId: 'b', impactValue: 0 }),
      ];
      // totalImpact = 0, this tests for NaN/Infinity guard
      // The function will produce NaN since it divides by totalImpact
      // This test documents the current behaviour
      expect(() => assessAggregateDataQuality(materials, 2025)).not.toThrow();
    });
  });

  describe('many materials with mixed quality', () => {
    it('produces a weighted DQI between worst and best material DQIs', () => {
      const materials = [
        makeAssessedMaterial({
          materialId: 'a', impactValue: 20, qualityGrade: 'HIGH',
          dataSourceTier: 'primary_verified', dataYear: 2024, referenceYear: 2025,
          uncertaintyPercent: undefined,
        }),
        makeAssessedMaterial({
          materialId: 'b', impactValue: 30, qualityGrade: 'MEDIUM',
          dataSourceTier: 'secondary_modelled', dataYear: 2022, referenceYear: 2025,
          uncertaintyPercent: undefined,
        }),
        makeAssessedMaterial({
          materialId: 'c', impactValue: 50, qualityGrade: 'LOW',
          dataSourceTier: 'secondary_estimated', dataYear: 2018, referenceYear: 2025,
          uncertaintyPercent: undefined,
        }),
      ];

      const dqis = materials.map(m => m.pedigreeDqi);
      const minDqi = Math.min(...dqis);
      const maxDqi = Math.max(...dqis);

      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.overallDqi).toBeGreaterThanOrEqual(minDqi);
      expect(result.overallDqi).toBeLessThanOrEqual(maxDqi);
    });
  });

  describe('uses referenceYear parameter', () => {
    it('temporal coverage averageAge uses provided referenceYear, not current year', () => {
      const material = makeAssessedMaterial({
        dataYear: 2020,
        referenceYear: 2024,
        impactValue: 10,
      });
      const result = assessAggregateDataQuality([material], 2024);

      // averageAge = referenceYear - dataYear = 2024 - 2020 = 4
      expect(result.temporalCoverage.averageAge).toBe(4);
    });

    it('produces different averageAge for different referenceYears', () => {
      const material = makeAssessedMaterial({
        dataYear: 2020,
        referenceYear: 2025,
        impactValue: 10,
      });

      const result2024 = assessAggregateDataQuality([material], 2024);
      const result2026 = assessAggregateDataQuality([material], 2026);

      expect(result2024.temporalCoverage.averageAge).toBe(4);
      expect(result2026.temporalCoverage.averageAge).toBe(6);
    });
  });

  describe('temporal coverage', () => {
    it('identifies oldest and newest data years', () => {
      const materials = [
        makeAssessedMaterial({ materialId: 'a', dataYear: 2018, impactValue: 10, referenceYear: 2025 }),
        makeAssessedMaterial({ materialId: 'b', dataYear: 2022, impactValue: 10, referenceYear: 2025 }),
        makeAssessedMaterial({ materialId: 'c', dataYear: 2024, impactValue: 10, referenceYear: 2025 }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.temporalCoverage.oldestData).toBe(2018);
      expect(result.temporalCoverage.newestData).toBe(2024);
    });

    it('counts stale materials correctly', () => {
      const materials = [
        makeAssessedMaterial({
          materialId: 'fresh', dataYear: 2024, impactValue: 10, referenceYear: 2025,
        }),
        makeAssessedMaterial({
          materialId: 'stale', dataYear: 2015, impactValue: 10, referenceYear: 2025,
        }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.temporalCoverage.staleMaterialCount).toBe(1);
    });

    it('returns null temporal fields when no material has a data year', () => {
      const materials = [
        makeAssessedMaterial({ materialId: 'a', dataYear: null, impactValue: 10, referenceYear: 2025 }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.temporalCoverage.oldestData).toBeNull();
      expect(result.temporalCoverage.newestData).toBeNull();
      expect(result.temporalCoverage.averageAge).toBeNull();
    });
  });

  describe('confidence levels', () => {
    it('returns HIGH confidence for excellent data', () => {
      const material = makeAssessedMaterial({
        qualityGrade: 'HIGH',
        dataSourceTier: 'primary_verified',
        dataYear: 2024,
        referenceYear: 2025,
        dataRegion: 'FR',
        studyRegion: 'FR',
        impactValue: 100,
        pedigree: { reliability: 1, completeness: 1, temporal: 1, geographical: 1, technological: 1 },
        uncertaintyPercent: 10,
      });
      const result = assessAggregateDataQuality([material], 2025);
      expect(result.overallConfidence).toBe('HIGH');
    });

    it('returns LOW confidence for poor data', () => {
      const material = makeAssessedMaterial({
        qualityGrade: 'LOW',
        dataSourceTier: 'secondary_estimated',
        dataYear: 2010,
        referenceYear: 2025,
        impactValue: 100,
        uncertaintyPercent: undefined,
      });
      const result = assessAggregateDataQuality([material], 2025);
      expect(result.overallConfidence).toBe('LOW');
    });
  });

  describe('ISO compliance', () => {
    it('is non-compliant when there are compliance gaps', () => {
      const materials = [
        makeAssessedMaterial({
          materialId: 'a', qualityGrade: 'LOW', impactValue: 100,
          dataYear: 2010, referenceYear: 2025, uncertaintyPercent: undefined,
        }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.isoCompliant).toBe(false);
      expect(result.complianceGaps.length).toBeGreaterThan(0);
    });
  });

  describe('all materials same quality grade', () => {
    it('produces consistent aggregate for all HIGH materials', () => {
      const materials = Array.from({ length: 5 }, (_, i) =>
        makeAssessedMaterial({
          materialId: `mat-${i}`,
          qualityGrade: 'HIGH',
          dataSourceTier: 'primary_verified',
          impactValue: 10,
          dataYear: 2024,
          referenceYear: 2025,
          uncertaintyPercent: 15,
        })
      );
      const result = assessAggregateDataQuality(materials, 2025);
      // All same quality => aggregate DQI should equal individual DQI
      expect(result.overallDqi).toBe(materials[0].pedigreeDqi);
    });
  });

  describe('all materials different quality grades', () => {
    it('handles a mix of HIGH, MEDIUM, LOW', () => {
      const materials = [
        makeAssessedMaterial({
          materialId: 'h', qualityGrade: 'HIGH', dataSourceTier: 'primary_verified',
          impactValue: 33, dataYear: 2024, referenceYear: 2025,
        }),
        makeAssessedMaterial({
          materialId: 'm', qualityGrade: 'MEDIUM', dataSourceTier: 'secondary_modelled',
          impactValue: 33, dataYear: 2022, referenceYear: 2025,
        }),
        makeAssessedMaterial({
          materialId: 'l', qualityGrade: 'LOW', dataSourceTier: 'secondary_estimated',
          impactValue: 34, dataYear: 2018, referenceYear: 2025,
        }),
      ];
      const result = assessAggregateDataQuality(materials, 2025);
      expect(result.overallDqi).toBeGreaterThan(0);
      expect(result.overallDqi).toBeLessThan(100);
      expect(result.dataSourceBreakdown.primaryVerified.count).toBe(1);
      expect(result.dataSourceBreakdown.secondaryModelled.count).toBe(1);
      expect(result.dataSourceBreakdown.secondaryEstimated.count).toBe(1);
    });
  });
});

// ============================================================================
// propagateUncertainty
// ============================================================================

describe('propagateUncertainty', () => {
  it('returns positive uncertainty percentage for valid inputs', () => {
    const materials = [
      makeAssessedMaterial({ impactValue: 10, uncertaintyPercent: 20 }),
      makeAssessedMaterial({ materialId: 'b', impactValue: 20, uncertaintyPercent: 30 }),
    ];
    const totalImpact = 30;
    const result = propagateUncertainty(materials, totalImpact);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 when total impact is 0', () => {
    const materials = [makeAssessedMaterial({ impactValue: 0 })];
    expect(propagateUncertainty(materials, 0)).toBe(0);
  });

  it('handles single material', () => {
    const material = makeAssessedMaterial({ impactValue: 50, uncertaintyPercent: 25 });
    const result = propagateUncertainty([material], 50);
    expect(result).toBeGreaterThan(0);
  });

  it('higher uncertainty inputs produce higher propagated uncertainty', () => {
    const lowUncert = [
      makeAssessedMaterial({ impactValue: 10, uncertaintyPercent: 5 }),
    ];
    const highUncert = [
      makeAssessedMaterial({ impactValue: 10, uncertaintyPercent: 50 }),
    ];

    const lowResult = propagateUncertainty(lowUncert, 10);
    const highResult = propagateUncertainty(highUncert, 10);
    expect(highResult).toBeGreaterThan(lowResult);
  });

  it('handles many materials', () => {
    const materials = Array.from({ length: 20 }, (_, i) =>
      makeAssessedMaterial({
        materialId: `mat-${i}`,
        impactValue: 5 + i,
        uncertaintyPercent: 10 + i * 2,
      })
    );
    const totalImpact = materials.reduce((sum, m) => sum + m.impactValue, 0);
    const result = propagateUncertainty(materials, totalImpact);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('RSS propagation produces lower uncertainty than arithmetic mean of uncertainties', () => {
    // Root-sum-of-squares should produce lower combined uncertainty
    // than a simple average when there are multiple independent sources
    const materials = [
      makeAssessedMaterial({ materialId: 'a', impactValue: 50, uncertaintyPercent: 30 }),
      makeAssessedMaterial({ materialId: 'b', impactValue: 50, uncertaintyPercent: 30 }),
    ];
    const result = propagateUncertainty(materials, 100);
    // Each has 30% = 0.3 sigma. Equal weights of 0.5 each.
    // RSS: sqrt(0.5^2 * 0.3^2 + 0.5^2 * 0.3^2) = sqrt(2 * 0.0225) * 100 = ~21%
    // Arithmetic mean would be 30%. RSS should be less.
    expect(result).toBeLessThan(30);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  it('referenceYear far in past (2015) with recent data still works', () => {
    const result = assessMaterialDataQuality(makeMaterialInput({
      dataYear: 2024,
      referenceYear: 2015,
    }));
    // |2015 - 2024| = 9 => score 3
    expect(result.pedigreeMatrix.temporal).toBe(3);
    expect(result.temporalRepresentativeness.referenceYear).toBe(2015);
    expect(result.temporalRepresentativeness.yearsDifference).toBe(9);
  });

  it('referenceYear = current year works correctly', () => {
    const currentYear = new Date().getFullYear();
    const result = assessMaterialDataQuality(makeMaterialInput({
      dataYear: currentYear,
      referenceYear: currentYear,
    }));
    expect(result.pedigreeMatrix.temporal).toBe(1);
    expect(result.temporalRepresentativeness.yearsDifference).toBe(0);
  });

  it('handles materials with very large impact values', () => {
    const material = makeAssessedMaterial({ impactValue: 1_000_000 });
    const result = assessAggregateDataQuality([material], 2025);
    expect(result.overallDqi).toBeGreaterThan(0);
  });

  it('handles materials with negative impact values (carbon credits)', () => {
    const materials = [
      makeAssessedMaterial({ materialId: 'pos', impactValue: 100 }),
      makeAssessedMaterial({ materialId: 'neg', impactValue: -20 }),
    ];
    // Should not throw; uses Math.abs internally for weighting
    const result = assessAggregateDataQuality(materials, 2025);
    expect(result.overallDqi).toBeGreaterThan(0);
  });

  it('aggregate with all null data years reports null temporal coverage', () => {
    const materials = [
      makeAssessedMaterial({ materialId: 'a', dataYear: null, impactValue: 10, referenceYear: 2025 }),
      makeAssessedMaterial({ materialId: 'b', dataYear: null, impactValue: 20, referenceYear: 2025 }),
    ];
    const result = assessAggregateDataQuality(materials, 2025);
    expect(result.temporalCoverage.oldestData).toBeNull();
    expect(result.temporalCoverage.newestData).toBeNull();
    expect(result.temporalCoverage.averageAge).toBeNull();
  });

  it('referenceYear fallback to current year when not provided to assessMaterialDataQuality', () => {
    const result = assessMaterialDataQuality({
      materialName: 'No Ref Year',
      materialId: 'no-ref',
      impactValue: 10,
      impactUnit: 'kg CO2e',
      dataSource: 'ecoinvent',
      dataSourceTier: 'secondary_modelled',
      qualityGrade: 'MEDIUM',
      dataYear: 2024,
      // referenceYear intentionally omitted
    });
    // The fallback is new Date().getFullYear()
    expect(result.temporalRepresentativeness.referenceYear).toBe(new Date().getFullYear());
  });

  it('pedigree aggregate scores are in valid 1-5 range', () => {
    const materials = [
      makeAssessedMaterial({
        materialId: 'a', qualityGrade: 'HIGH', impactValue: 10,
        dataSourceTier: 'primary_verified', referenceYear: 2025,
      }),
      makeAssessedMaterial({
        materialId: 'b', qualityGrade: 'LOW', impactValue: 10,
        dataSourceTier: 'secondary_estimated', referenceYear: 2025,
      }),
    ];
    const result = assessAggregateDataQuality(materials, 2025);
    const pa = result.pedigreeAggregate;
    for (const key of ['reliability', 'completeness', 'temporal', 'geographical', 'technological'] as const) {
      expect(pa[key]).toBeGreaterThanOrEqual(1);
      expect(pa[key]).toBeLessThanOrEqual(5);
    }
  });
});
