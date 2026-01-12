import { describe, it, expect } from 'vitest';
import {
  // Emission Factors (Fallback)
  WASTE_EMISSION_FACTORS_FALLBACK,
  DEFAULT_WASTE_EMISSION_FACTOR,
  getWasteEmissionFactor,
  calculateWasteEmissions,

  // Waste Hierarchy Scores (renamed from circularity)
  WASTE_HIERARCHY_SCORES,
  TREATMENT_CIRCULARITY_SCORES, // Legacy alias
  ANAEROBIC_DIGESTION_SCORES,
  getWasteHierarchyScore,
  getTreatmentCircularityScore, // Legacy alias
  isCircularTreatment,

  // Diversion Rate
  DIVERSION_RATE_THRESHOLDS,
  getDiversionLevel,
  getDiversionColorClass,
  getDiversionBgColorClass,

  // Hazard Level
  HAZARDOUS_WASTE_THRESHOLDS,
  HAZARD_THRESHOLDS, // Legacy alias
  getHazardLevel,
  getHazardColorClass,

  // Labels
  WASTE_CATEGORY_LABELS,
  TREATMENT_METHOD_LABELS,
  getWasteCategoryLabel,
  getTreatmentMethodLabel,

  // Formatting
  formatWeight,

  // Compliance
  getMethodologyDocumentation,
} from '../waste-circularity';

// ============================================================================
// DEFRA 2024 EMISSION FACTORS TESTS
// ============================================================================

describe('DEFRA 2024 Waste Emission Factors', () => {
  describe('WASTE_EMISSION_FACTORS_FALLBACK constant', () => {
    it('should have DEFRA 2024 values for all treatment methods', () => {
      // DEFRA 2024 values (kgCO2e/kg)
      expect(WASTE_EMISSION_FACTORS_FALLBACK.landfill).toBe(0.467); // Mixed C&I
      expect(WASTE_EMISSION_FACTORS_FALLBACK.recycling).toBe(0.021); // Open-loop
      expect(WASTE_EMISSION_FACTORS_FALLBACK.composting).toBe(0.011); // Industrial
      expect(WASTE_EMISSION_FACTORS_FALLBACK.incineration).toBe(0.366); // EfW
      expect(WASTE_EMISSION_FACTORS_FALLBACK.incineration_with_recovery).toBe(0.366);
      expect(WASTE_EMISSION_FACTORS_FALLBACK.incineration_without_recovery).toBe(0.445);
      expect(WASTE_EMISSION_FACTORS_FALLBACK.anaerobic_digestion).toBe(0.005);
      expect(WASTE_EMISSION_FACTORS_FALLBACK.reuse).toBe(0.005);
    });

    it('should use landfill as conservative default for unknown methods', () => {
      expect(WASTE_EMISSION_FACTORS_FALLBACK.other).toBe(0.467);
      expect(DEFAULT_WASTE_EMISSION_FACTOR).toBe(0.467);
    });

    it('should rank disposal methods correctly by emission intensity', () => {
      // Landfill > Incineration (no recovery) > Incineration (with recovery) > Recycling > Composting > AD > Reuse
      expect(WASTE_EMISSION_FACTORS_FALLBACK.landfill).toBeGreaterThan(
        WASTE_EMISSION_FACTORS_FALLBACK.incineration_with_recovery
      );
      expect(WASTE_EMISSION_FACTORS_FALLBACK.incineration_without_recovery).toBeGreaterThan(
        WASTE_EMISSION_FACTORS_FALLBACK.incineration_with_recovery
      );
      expect(WASTE_EMISSION_FACTORS_FALLBACK.incineration_with_recovery).toBeGreaterThan(
        WASTE_EMISSION_FACTORS_FALLBACK.recycling
      );
      expect(WASTE_EMISSION_FACTORS_FALLBACK.recycling).toBeGreaterThan(
        WASTE_EMISSION_FACTORS_FALLBACK.composting
      );
      expect(WASTE_EMISSION_FACTORS_FALLBACK.composting).toBeGreaterThan(
        WASTE_EMISSION_FACTORS_FALLBACK.anaerobic_digestion
      );
    });
  });

  describe('getWasteEmissionFactor', () => {
    it('should return correct DEFRA 2024 factor for known methods', () => {
      expect(getWasteEmissionFactor('landfill')).toBe(0.467);
      expect(getWasteEmissionFactor('recycling')).toBe(0.021);
      expect(getWasteEmissionFactor('composting')).toBe(0.011);
    });

    it('should return landfill as conservative default for unknown methods', () => {
      expect(getWasteEmissionFactor('unknown_method')).toBe(0.467);
      expect(getWasteEmissionFactor('')).toBe(0.467);
    });

    it('should normalize method names', () => {
      expect(getWasteEmissionFactor('LANDFILL')).toBe(0.467);
      expect(getWasteEmissionFactor('Recycling')).toBe(0.021);
    });
  });

  describe('calculateWasteEmissions', () => {
    it('should calculate emissions correctly for landfill', () => {
      // 1000kg * 0.467 = 467 kgCO2e
      const result = calculateWasteEmissions(1000, 'landfill');
      expect(result.emissionsKgCO2e).toBe(467);
      expect(result.weightKg).toBe(1000);
      expect(result.emissionFactor).toBe(0.467);
    });

    it('should calculate emissions correctly for recycling', () => {
      // 1000kg * 0.021 = 21 kgCO2e
      const result = calculateWasteEmissions(1000, 'recycling');
      expect(result.emissionsKgCO2e).toBe(21);
      expect(result.emissionFactor).toBe(0.021);
    });

    it('should handle zero weight', () => {
      const result = calculateWasteEmissions(0, 'landfill');
      expect(result.emissionsKgCO2e).toBe(0);
    });
  });
});

// ============================================================================
// EU WASTE FRAMEWORK DIRECTIVE HIERARCHY TESTS
// ============================================================================

describe('EU Waste Framework Directive Hierarchy Scores', () => {
  describe('WASTE_HIERARCHY_SCORES constant', () => {
    it('should match EU WFD Article 4 hierarchy', () => {
      // Rank 2: Preparing for Reuse
      expect(WASTE_HIERARCHY_SCORES.reuse).toBe(100);

      // Rank 3: Recycling
      expect(WASTE_HIERARCHY_SCORES.recycling).toBe(100);
      expect(WASTE_HIERARCHY_SCORES.composting).toBe(100); // Art. 3(17)

      // Rank 4: Other Recovery (energy)
      expect(WASTE_HIERARCHY_SCORES.anaerobic_digestion).toBe(50); // Default: energy
      expect(WASTE_HIERARCHY_SCORES.incineration_with_recovery).toBe(50);

      // Rank 5: Disposal
      expect(WASTE_HIERARCHY_SCORES.incineration_without_recovery).toBe(0);
      expect(WASTE_HIERARCHY_SCORES.landfill).toBe(0);
    });

    it('should be aliased as TREATMENT_CIRCULARITY_SCORES for backwards compatibility', () => {
      expect(TREATMENT_CIRCULARITY_SCORES).toBe(WASTE_HIERARCHY_SCORES);
    });
  });

  describe('ANAEROBIC_DIGESTION_SCORES', () => {
    it('should distinguish energy vs fertilizer end-use per EU WFD', () => {
      // Art. 3(17): Digestate as fertilizer = recycling
      expect(ANAEROBIC_DIGESTION_SCORES.fertilizer).toBe(100);

      // Biogas for energy = other recovery
      expect(ANAEROBIC_DIGESTION_SCORES.energy).toBe(50);

      // Conservative default
      expect(ANAEROBIC_DIGESTION_SCORES.default).toBe(50);
    });
  });

  describe('getWasteHierarchyScore', () => {
    it('should return correct scores for standard methods', () => {
      expect(getWasteHierarchyScore('reuse')).toBe(100);
      expect(getWasteHierarchyScore('recycling')).toBe(100);
      expect(getWasteHierarchyScore('landfill')).toBe(0);
    });

    it('should handle anaerobic digestion based on end-use', () => {
      // Without end-use, defaults to energy (50)
      expect(getWasteHierarchyScore('anaerobic_digestion')).toBe(50);

      // With end-use specified
      expect(getWasteHierarchyScore('anaerobic_digestion', 'energy')).toBe(50);
      expect(getWasteHierarchyScore('anaerobic_digestion', 'fertilizer')).toBe(100);
    });

    it('should return 0 for unknown methods', () => {
      expect(getWasteHierarchyScore('unknown')).toBe(0);
    });
  });

  describe('getTreatmentCircularityScore (legacy alias)', () => {
    it('should work as alias for getWasteHierarchyScore', () => {
      expect(getTreatmentCircularityScore('reuse')).toBe(100);
      expect(getTreatmentCircularityScore('recycling')).toBe(100);
      expect(getTreatmentCircularityScore('landfill')).toBe(0);
    });
  });

  describe('isCircularTreatment', () => {
    it('should return true only for fully circular treatments (score = 100)', () => {
      expect(isCircularTreatment('reuse')).toBe(true);
      expect(isCircularTreatment('recycling')).toBe(true);
      expect(isCircularTreatment('composting')).toBe(true);
    });

    it('should return false for energy recovery (score = 50)', () => {
      expect(isCircularTreatment('anaerobic_digestion')).toBe(false); // Default to energy
      expect(isCircularTreatment('incineration_with_recovery')).toBe(false);
    });

    it('should return true for AD with fertilizer end-use', () => {
      expect(isCircularTreatment('anaerobic_digestion', 'fertilizer')).toBe(true);
    });

    it('should return false for disposal methods', () => {
      expect(isCircularTreatment('landfill')).toBe(false);
      expect(isCircularTreatment('incineration_without_recovery')).toBe(false);
    });
  });
});

// ============================================================================
// DIVERSION RATE TESTS
// ============================================================================

describe('Diversion Rate Calculations', () => {
  describe('DIVERSION_RATE_THRESHOLDS', () => {
    it('should have industry benchmark thresholds', () => {
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
  describe('HAZARDOUS_WASTE_THRESHOLDS', () => {
    it('should have correct thresholds', () => {
      expect(HAZARDOUS_WASTE_THRESHOLDS.HIGH).toBe(10);
      expect(HAZARDOUS_WASTE_THRESHOLDS.MEDIUM).toBe(5);
    });

    it('should be aliased as HAZARD_THRESHOLDS for backwards compatibility', () => {
      expect(HAZARD_THRESHOLDS).toBe(HAZARDOUS_WASTE_THRESHOLDS);
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
      expect(WASTE_CATEGORY_LABELS.paper_cardboard).toBe('Paper/Cardboard');
    });
  });

  describe('TREATMENT_METHOD_LABELS', () => {
    it('should have human-readable labels for all methods', () => {
      expect(TREATMENT_METHOD_LABELS.landfill).toBe('Landfill');
      expect(TREATMENT_METHOD_LABELS.recycling).toBe('Recycling');
      expect(TREATMENT_METHOD_LABELS.incineration_with_recovery).toBe(
        'Incineration (Energy Recovery)'
      );
      expect(TREATMENT_METHOD_LABELS.anaerobic_digestion).toBe('Anaerobic Digestion');
      expect(TREATMENT_METHOD_LABELS.anaerobic_digestion_energy).toBe(
        'Anaerobic Digestion (Energy)'
      );
      expect(TREATMENT_METHOD_LABELS.anaerobic_digestion_fertilizer).toBe(
        'Anaerobic Digestion (Digestate)'
      );
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
// COMPLIANCE DOCUMENTATION TESTS
// ============================================================================

describe('ESRS E5 Compliance Documentation', () => {
  describe('getMethodologyDocumentation', () => {
    it('should return complete methodology documentation', () => {
      const docs = getMethodologyDocumentation();

      expect(docs.disclosureStandard).toBe('CSRD ESRS E5 - Resource Use and Circular Economy');
      expect(docs.disclosureRequirement).toBe('E5-5: Resource outflows');
    });

    it('should document emission factor sources', () => {
      const docs = getMethodologyDocumentation();

      expect(docs.emissionFactors.primarySource).toContain('DEFRA 2024');
      expect(docs.emissionFactors.scope).toContain('Scope 3 Category 5');
    });

    it('should document hierarchy score methodology', () => {
      const docs = getMethodologyDocumentation();

      expect(docs.hierarchyScores.source).toContain('EU Waste Framework Directive');
      expect(docs.hierarchyScores.circularDefinition).toContain('100');
    });

    it('should include disclaimers about MCI', () => {
      const docs = getMethodologyDocumentation();

      expect(docs.disclaimers).toContain(
        'Hierarchy scores represent EU Waste Framework compliance, not Ellen MacArthur MCI'
      );
      expect(docs.disclaimers).toContain(
        'The Ellen MacArthur MCI is calculated using: MCI = 1 - LFI × F(X)'
      );
    });

    it('should include reference URLs', () => {
      const docs = getMethodologyDocumentation();

      expect(docs.references.defra2024).toContain('gov.uk');
      expect(docs.references.euWasteFramework).toContain('eur-lex.europa.eu');
    });
  });
});

// ============================================================================
// REGRESSION TESTS - Standards Compliance
// ============================================================================

describe('Standards Compliance Regression Tests', () => {
  describe('DEFRA 2024 Values', () => {
    it('should use DEFRA 2024 emission factors, not arbitrary values', () => {
      // These are the actual DEFRA 2024 values, not the old hardcoded approximations
      expect(WASTE_EMISSION_FACTORS_FALLBACK.landfill).toBe(0.467); // Was 0.5
      expect(WASTE_EMISSION_FACTORS_FALLBACK.recycling).toBe(0.021); // Was 0.02
      expect(WASTE_EMISSION_FACTORS_FALLBACK.composting).toBe(0.011); // Was 0.01
    });
  });

  describe('EU Waste Framework Directive Compliance', () => {
    it('should correctly classify anaerobic digestion based on end-use', () => {
      // Per Article 3(17) and recitals
      // Digestate as fertilizer = recycling (Art. 3(17))
      expect(getWasteHierarchyScore('anaerobic_digestion', 'fertilizer')).toBe(100);

      // Biogas for energy = other recovery (not recycling)
      expect(getWasteHierarchyScore('anaerobic_digestion', 'energy')).toBe(50);

      // Default should be conservative (energy)
      expect(getWasteHierarchyScore('anaerobic_digestion')).toBe(50);
    });

    it('should follow EU WFD Article 4 hierarchy ranking', () => {
      // Reuse (Rank 2) >= Recycling (Rank 3) > Recovery (Rank 4) > Disposal (Rank 5)
      expect(WASTE_HIERARCHY_SCORES.reuse).toBeGreaterThanOrEqual(
        WASTE_HIERARCHY_SCORES.recycling
      );
      expect(WASTE_HIERARCHY_SCORES.recycling).toBeGreaterThan(
        WASTE_HIERARCHY_SCORES.incineration_with_recovery
      );
      expect(WASTE_HIERARCHY_SCORES.incineration_with_recovery).toBeGreaterThan(
        WASTE_HIERARCHY_SCORES.landfill
      );
    });
  });

  describe('Ellen MacArthur MCI Disclaimer', () => {
    it('should NOT use MCI terminology for fixed treatment scores', () => {
      // The scores are called WASTE_HIERARCHY_SCORES, not MCI
      expect(WASTE_HIERARCHY_SCORES).toBeDefined();

      // Verify we're not claiming these are MCI
      const docs = getMethodologyDocumentation();
      expect(docs.hierarchyScores.source).not.toContain('Ellen MacArthur');
      expect(docs.hierarchyScores.source).toContain('EU Waste Framework');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain legacy exports for existing code', () => {
      // TREATMENT_CIRCULARITY_SCORES is alias for WASTE_HIERARCHY_SCORES
      expect(TREATMENT_CIRCULARITY_SCORES.reuse).toBe(WASTE_HIERARCHY_SCORES.reuse);

      // getTreatmentCircularityScore is alias for getWasteHierarchyScore
      expect(getTreatmentCircularityScore('recycling')).toBe(getWasteHierarchyScore('recycling'));

      // HAZARD_THRESHOLDS is alias for HAZARDOUS_WASTE_THRESHOLDS
      expect(HAZARD_THRESHOLDS.HIGH).toBe(HAZARDOUS_WASTE_THRESHOLDS.HIGH);
    });
  });
});
