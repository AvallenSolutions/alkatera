import { describe, it, expect } from 'vitest';
import {
  // Emission Factors
  WASTE_EMISSION_FACTORS,
  getWasteEmissionFactor,
  calculateWasteEmissions,

  // Circularity Scores
  TREATMENT_CIRCULARITY_SCORES,
  getTreatmentCircularityScore,
  isCircularTreatment,

  // Diversion Rate
  DIVERSION_RATE_THRESHOLDS,
  getDiversionLevel,
  getDiversionColorClass,
  getDiversionBgColorClass,

  // Hazard Level
  HAZARDOUS_WASTE_THRESHOLDS,
  getHazardLevel,
  getHazardColorClass,

  // Labels
  WASTE_CATEGORY_LABELS,
  TREATMENT_METHOD_LABELS,
  getWasteCategoryLabel,
  getTreatmentMethodLabel,

  // Formatting
  formatWeight,
} from '../waste-circularity';

// ============================================================================
// EMISSION FACTORS TESTS
// ============================================================================

describe('Waste Emission Factors', () => {
  describe('WASTE_EMISSION_FACTORS constant', () => {
    it('should have correct emission factors for all treatment methods', () => {
      expect(WASTE_EMISSION_FACTORS.landfill).toBe(0.5);
      expect(WASTE_EMISSION_FACTORS.recycling).toBe(0.02);
      expect(WASTE_EMISSION_FACTORS.composting).toBe(0.01);
      expect(WASTE_EMISSION_FACTORS.incineration).toBe(0.3);
      expect(WASTE_EMISSION_FACTORS.anaerobic_digestion).toBe(0.005);
      expect(WASTE_EMISSION_FACTORS.reuse).toBe(0.0);
      expect(WASTE_EMISSION_FACTORS.other).toBe(0.5);
    });

    it('should rank landfill as highest-emitting standard disposal', () => {
      expect(WASTE_EMISSION_FACTORS.landfill).toBeGreaterThan(WASTE_EMISSION_FACTORS.incineration);
      expect(WASTE_EMISSION_FACTORS.landfill).toBeGreaterThan(WASTE_EMISSION_FACTORS.recycling);
      expect(WASTE_EMISSION_FACTORS.landfill).toBeGreaterThan(WASTE_EMISSION_FACTORS.composting);
    });

    it('should have reuse as zero-emission option', () => {
      expect(WASTE_EMISSION_FACTORS.reuse).toBe(0);
    });
  });

  describe('getWasteEmissionFactor', () => {
    it('should return correct factor for known treatment methods', () => {
      expect(getWasteEmissionFactor('landfill')).toBe(0.5);
      expect(getWasteEmissionFactor('recycling')).toBe(0.02);
      expect(getWasteEmissionFactor('composting')).toBe(0.01);
    });

    it('should return default factor for unknown methods', () => {
      expect(getWasteEmissionFactor('unknown_method')).toBe(0.5);
      expect(getWasteEmissionFactor('')).toBe(0.5);
    });
  });

  describe('calculateWasteEmissions', () => {
    it('should calculate emissions correctly for landfill', () => {
      // 1000kg * 0.5 = 500 kgCO2e
      const result = calculateWasteEmissions(1000, 'landfill');
      expect(result.emissionsKgCO2e).toBe(500);
      expect(result.weightKg).toBe(1000);
      expect(result.emissionFactor).toBe(0.5);
    });

    it('should calculate emissions correctly for recycling', () => {
      // 1000kg * 0.02 = 20 kgCO2e
      const result = calculateWasteEmissions(1000, 'recycling');
      expect(result.emissionsKgCO2e).toBe(20);
      expect(result.emissionFactor).toBe(0.02);
    });

    it('should return zero emissions for reuse', () => {
      const result = calculateWasteEmissions(1000, 'reuse');
      expect(result.emissionsKgCO2e).toBe(0);
    });

    it('should handle zero weight', () => {
      const result = calculateWasteEmissions(0, 'landfill');
      expect(result.emissionsKgCO2e).toBe(0);
    });

    it('should return structured result object', () => {
      const result = calculateWasteEmissions(100, 'composting');
      expect(result).toHaveProperty('weightKg', 100);
      expect(result).toHaveProperty('treatmentMethod', 'composting');
      expect(result).toHaveProperty('emissionFactor', 0.01);
      expect(result).toHaveProperty('emissionsKgCO2e', 1);
    });
  });
});

// ============================================================================
// CIRCULARITY SCORES TESTS
// ============================================================================

describe('Treatment Circularity Scores', () => {
  describe('TREATMENT_CIRCULARITY_SCORES constant', () => {
    it('should have correct circularity scores', () => {
      expect(TREATMENT_CIRCULARITY_SCORES.reuse).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.recycling).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.composting).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.anaerobic_digestion).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.incineration_with_recovery).toBe(50);
      expect(TREATMENT_CIRCULARITY_SCORES.incineration_without_recovery).toBe(0);
      expect(TREATMENT_CIRCULARITY_SCORES.landfill).toBe(0);
    });

    it('should follow waste hierarchy principles', () => {
      // Reuse > Recycling/Composting > Energy Recovery > Landfill
      expect(TREATMENT_CIRCULARITY_SCORES.reuse).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.recycling).toBe(100);
      expect(TREATMENT_CIRCULARITY_SCORES.incineration_with_recovery).toBeLessThan(
        TREATMENT_CIRCULARITY_SCORES.recycling
      );
      expect(TREATMENT_CIRCULARITY_SCORES.landfill).toBeLessThan(
        TREATMENT_CIRCULARITY_SCORES.incineration_with_recovery
      );
    });
  });

  describe('getTreatmentCircularityScore', () => {
    it('should return correct score for known methods', () => {
      expect(getTreatmentCircularityScore('reuse')).toBe(100);
      expect(getTreatmentCircularityScore('recycling')).toBe(100);
      expect(getTreatmentCircularityScore('landfill')).toBe(0);
    });

    it('should return 0 for unknown methods', () => {
      expect(getTreatmentCircularityScore('unknown')).toBe(0);
      expect(getTreatmentCircularityScore('')).toBe(0);
    });
  });

  describe('isCircularTreatment', () => {
    it('should return true for fully circular treatments (score = 100)', () => {
      expect(isCircularTreatment('reuse')).toBe(true);
      expect(isCircularTreatment('recycling')).toBe(true);
      expect(isCircularTreatment('composting')).toBe(true);
      expect(isCircularTreatment('anaerobic_digestion')).toBe(true);
    });

    it('should return false for partial recovery treatments (score < 100)', () => {
      // Energy recovery is not fully circular - materials are lost
      expect(isCircularTreatment('incineration_with_recovery')).toBe(false);
    });

    it('should return false for non-circular treatments (score = 0)', () => {
      expect(isCircularTreatment('landfill')).toBe(false);
      expect(isCircularTreatment('incineration_without_recovery')).toBe(false);
      expect(isCircularTreatment('other')).toBe(false);
    });
  });
});

// ============================================================================
// DIVERSION RATE TESTS
// ============================================================================

describe('Diversion Rate Calculations', () => {
  describe('DIVERSION_RATE_THRESHOLDS constant', () => {
    it('should have correct thresholds', () => {
      expect(DIVERSION_RATE_THRESHOLDS.EXCELLENT).toBe(90);
      expect(DIVERSION_RATE_THRESHOLDS.HIGH).toBe(70);
      expect(DIVERSION_RATE_THRESHOLDS.MEDIUM).toBe(40);
    });
  });

  describe('getDiversionLevel', () => {
    it('should return "excellent" for rates >= 90%', () => {
      expect(getDiversionLevel(90)).toBe('excellent');
      expect(getDiversionLevel(95)).toBe('excellent');
      expect(getDiversionLevel(100)).toBe('excellent');
    });

    it('should return "high" for rates >= 70% and < 90%', () => {
      expect(getDiversionLevel(70)).toBe('high');
      expect(getDiversionLevel(80)).toBe('high');
      expect(getDiversionLevel(89.9)).toBe('high');
    });

    it('should return "medium" for rates >= 40% and < 70%', () => {
      expect(getDiversionLevel(40)).toBe('medium');
      expect(getDiversionLevel(55)).toBe('medium');
      expect(getDiversionLevel(69.9)).toBe('medium');
    });

    it('should return "low" for rates < 40%', () => {
      expect(getDiversionLevel(0)).toBe('low');
      expect(getDiversionLevel(20)).toBe('low');
      expect(getDiversionLevel(39.9)).toBe('low');
    });
  });

  describe('getDiversionColorClass', () => {
    it('should return green for high performance levels', () => {
      expect(getDiversionColorClass('excellent')).toBe('text-green-600');
      expect(getDiversionColorClass('high')).toBe('text-green-600');
    });

    it('should return amber for medium performance', () => {
      expect(getDiversionColorClass('medium')).toBe('text-amber-600');
    });

    it('should return red for low performance', () => {
      expect(getDiversionColorClass('low')).toBe('text-red-600');
    });
  });

  describe('getDiversionBgColorClass', () => {
    it('should return correct background color classes', () => {
      expect(getDiversionBgColorClass('excellent')).toBe('bg-green-500');
      expect(getDiversionBgColorClass('high')).toBe('bg-green-500');
      expect(getDiversionBgColorClass('medium')).toBe('bg-amber-500');
      expect(getDiversionBgColorClass('low')).toBe('bg-red-500');
    });
  });
});

// ============================================================================
// HAZARD LEVEL TESTS
// ============================================================================

describe('Hazard Level Calculations', () => {
  describe('HAZARDOUS_WASTE_THRESHOLDS constant', () => {
    it('should have correct thresholds', () => {
      expect(HAZARDOUS_WASTE_THRESHOLDS.HIGH).toBe(10);
      expect(HAZARDOUS_WASTE_THRESHOLDS.MEDIUM).toBe(5);
    });
  });

  describe('getHazardLevel', () => {
    it('should return "high" for percentages > 10%', () => {
      expect(getHazardLevel(10.1)).toBe('high');
      expect(getHazardLevel(15)).toBe('high');
      expect(getHazardLevel(50)).toBe('high');
    });

    it('should return "medium" for percentages > 5% and <= 10%', () => {
      expect(getHazardLevel(5.1)).toBe('medium');
      expect(getHazardLevel(7)).toBe('medium');
      expect(getHazardLevel(10)).toBe('medium');
    });

    it('should return "low" for percentages <= 5%', () => {
      expect(getHazardLevel(0)).toBe('low');
      expect(getHazardLevel(3)).toBe('low');
      expect(getHazardLevel(5)).toBe('low');
    });
  });

  describe('getHazardColorClass', () => {
    it('should return correct color classes (inverted - low is good)', () => {
      expect(getHazardColorClass('low')).toBe('text-green-600');
      expect(getHazardColorClass('medium')).toBe('text-amber-600');
      expect(getHazardColorClass('high')).toBe('text-red-600');
    });
  });
});

// ============================================================================
// LABEL TESTS
// ============================================================================

describe('Waste Category and Treatment Labels', () => {
  describe('WASTE_CATEGORY_LABELS', () => {
    it('should have human-readable labels for all categories', () => {
      expect(WASTE_CATEGORY_LABELS.food_waste).toBe('Food Waste');
      expect(WASTE_CATEGORY_LABELS.packaging_waste).toBe('Packaging Waste');
      expect(WASTE_CATEGORY_LABELS.hazardous).toBe('Hazardous Waste');
    });
  });

  describe('TREATMENT_METHOD_LABELS', () => {
    it('should have human-readable labels for all methods', () => {
      expect(TREATMENT_METHOD_LABELS.landfill).toBe('Landfill');
      expect(TREATMENT_METHOD_LABELS.recycling).toBe('Recycling');
      expect(TREATMENT_METHOD_LABELS.incineration_with_recovery).toBe('Incineration (Energy Recovery)');
    });
  });

  describe('getWasteCategoryLabel', () => {
    it('should return label for known categories', () => {
      expect(getWasteCategoryLabel('food_waste')).toBe('Food Waste');
    });

    it('should return raw category if unknown', () => {
      expect(getWasteCategoryLabel('custom_category')).toBe('custom_category');
    });
  });

  describe('getTreatmentMethodLabel', () => {
    it('should return label for known methods', () => {
      expect(getTreatmentMethodLabel('recycling')).toBe('Recycling');
    });

    it('should return raw method if unknown', () => {
      expect(getTreatmentMethodLabel('custom_method')).toBe('custom_method');
    });
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('Weight Formatting', () => {
  describe('formatWeight', () => {
    it('should format small weights in kg', () => {
      const result = formatWeight(500);
      expect(result.value).toBe('500');
      expect(result.unit).toBe('kg');
    });

    it('should format weights >= 1000kg in tonnes', () => {
      const result = formatWeight(1000);
      expect(result.value).toBe('1.0');
      expect(result.unit).toBe('t');
    });

    it('should format larger weights correctly', () => {
      const result = formatWeight(5500);
      expect(result.value).toBe('5.5');
      expect(result.unit).toBe('t');
    });

    it('should format very large weights in kilotonnes', () => {
      const result = formatWeight(1500000);
      expect(result.value).toBe('1.5');
      expect(result.unit).toBe('kt');
    });

    it('should handle zero weight', () => {
      const result = formatWeight(0);
      expect(result.value).toBe('0');
      expect(result.unit).toBe('kg');
    });
  });
});

// ============================================================================
// REGRESSION TESTS - Prevent hardcoding issues
// ============================================================================

describe('Regression Tests - Preventing hardcoding issues', () => {
  it('should use consistent thresholds across the application', () => {
    // These values must match what's used in:
    // - WasteCard.tsx
    // - useWasteMetrics.ts
    // - OperationalWasteCard.tsx
    // - Database views

    // Diversion rate thresholds
    expect(DIVERSION_RATE_THRESHOLDS.HIGH).toBe(70);
    expect(DIVERSION_RATE_THRESHOLDS.MEDIUM).toBe(40);

    // Hazard thresholds
    expect(HAZARDOUS_WASTE_THRESHOLDS.HIGH).toBe(10);
    expect(HAZARDOUS_WASTE_THRESHOLDS.MEDIUM).toBe(5);
  });

  it('should use consistent emission factors across the application', () => {
    // These values must match what's displayed in:
    // - OperationalWasteCard.tsx dropdown options
    // - Database calculations

    expect(WASTE_EMISSION_FACTORS.recycling).toBe(0.02);
    expect(WASTE_EMISSION_FACTORS.composting).toBe(0.01);
    expect(WASTE_EMISSION_FACTORS.anaerobic_digestion).toBe(0.005);
    expect(WASTE_EMISSION_FACTORS.incineration).toBe(0.3);
    expect(WASTE_EMISSION_FACTORS.landfill).toBe(0.5);
  });

  it('should use consistent circularity scores', () => {
    // These values must match EU Waste Framework Directive hierarchy
    // and be consistent with what useWasteMetrics uses

    expect(TREATMENT_CIRCULARITY_SCORES.reuse).toBe(100);
    expect(TREATMENT_CIRCULARITY_SCORES.recycling).toBe(100);
    expect(TREATMENT_CIRCULARITY_SCORES.composting).toBe(100);
    expect(TREATMENT_CIRCULARITY_SCORES.anaerobic_digestion).toBe(100);
    expect(TREATMENT_CIRCULARITY_SCORES.incineration_with_recovery).toBe(50);
    expect(TREATMENT_CIRCULARITY_SCORES.incineration_without_recovery).toBe(0);
    expect(TREATMENT_CIRCULARITY_SCORES.landfill).toBe(0);
  });

  it('should have all treatment methods with both emission factors and circularity scores', () => {
    const commonMethods = ['recycling', 'composting', 'landfill', 'anaerobic_digestion', 'reuse'];

    commonMethods.forEach(method => {
      expect(WASTE_EMISSION_FACTORS[method]).toBeDefined();
      expect(TREATMENT_CIRCULARITY_SCORES[method]).toBeDefined();
      expect(TREATMENT_METHOD_LABELS[method]).toBeDefined();
    });
  });

  it('should calculate diversion level consistently with WasteCard thresholds', () => {
    // WasteCard.tsx originally had: diversionRate >= 70 ? 'high' : diversionRate >= 40 ? 'medium' : 'low'
    // The shared function should return compatible values
    expect(getDiversionLevel(75)).toBe('high'); // >= 70
    expect(getDiversionLevel(50)).toBe('medium'); // >= 40 and < 70
    expect(getDiversionLevel(30)).toBe('low'); // < 40
  });

  it('should calculate hazard level consistently with WasteCard thresholds', () => {
    // WasteCard.tsx originally had: hazardousPercentage > 10 ? 'high' : hazardousPercentage > 5 ? 'medium' : 'low'
    expect(getHazardLevel(15)).toBe('high'); // > 10
    expect(getHazardLevel(7)).toBe('medium'); // > 5 and <= 10
    expect(getHazardLevel(3)).toBe('low'); // <= 5
  });
});
