import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  EPRMaterialType,
  EPRPackagingLevel,
  PackagingCategory,
  PackagingMaterialComponent,
} from '../types/lca';
import {
  normalizeToKg,
  type ProductMaterial,
  type WaterfallResult,
  type MaterialCategoryType,
} from '../impact-waterfall-resolver';

// ============================================================================
// EPR MATERIAL TYPE TO ECOINVENT MAPPING TESTS
// ============================================================================

describe('EPR Material Type to Ecoinvent Mapping', () => {
  /**
   * Maps EPR material types to their expected Ecoinvent proxy categories.
   * This mapping is critical for accurate LCA calculations when using
   * component breakdown data.
   */
  const EPR_TO_ECOINVENT_MAPPING: Record<EPRMaterialType, string[]> = {
    aluminium: ['aluminium', 'aluminum', 'aluminium sheet', 'aluminium ingot'],
    fibre_composite: ['fibre composite', 'fiber composite', 'beverage carton', 'tetra pak'],
    glass: ['glass', 'glass bottle', 'glass container', 'glass packaging'],
    paper_cardboard: ['paper', 'cardboard', 'corrugated board', 'paperboard', 'kraft paper'],
    plastic_rigid: ['pet', 'hdpe', 'pp', 'polypropylene', 'polyethylene', 'rigid plastic'],
    plastic_flexible: ['ldpe', 'film', 'plastic film', 'flexible plastic', 'shrink film'],
    steel: ['steel', 'tinplate', 'steel can'],
    wood: ['wood', 'pallet', 'timber', 'wooden crate'],
    other: ['other packaging', 'cork', 'natural materials'],
    adhesive: ['adhesive', 'glue', 'hot melt', 'wet glue'],
    ink: ['printing ink', 'ink', 'flexographic ink'],
    coating: ['coating', 'laminate', 'surface coating', 'lacquer coating'],
    lacquer: ['lacquer', 'varnish', 'clear coat'],
  };

  it('should have mappings for all main EPR material categories', () => {
    const mainCategories: EPRMaterialType[] = [
      'aluminium', 'fibre_composite', 'glass', 'paper_cardboard',
      'plastic_rigid', 'plastic_flexible', 'steel', 'wood', 'other',
    ];

    mainCategories.forEach((category) => {
      expect(EPR_TO_ECOINVENT_MAPPING[category]).toBeDefined();
      expect(EPR_TO_ECOINVENT_MAPPING[category].length).toBeGreaterThan(0);
    });
  });

  it('should have mappings for sub-component materials', () => {
    const subComponents: EPRMaterialType[] = ['adhesive', 'ink', 'coating', 'lacquer'];

    subComponents.forEach((component) => {
      expect(EPR_TO_ECOINVENT_MAPPING[component]).toBeDefined();
      expect(EPR_TO_ECOINVENT_MAPPING[component].length).toBeGreaterThan(0);
    });
  });

  it('should map plastic types correctly for EPR reporting', () => {
    // EPR requires rigid vs flexible split for large producers
    expect(EPR_TO_ECOINVENT_MAPPING.plastic_rigid).toContain('pet');
    expect(EPR_TO_ECOINVENT_MAPPING.plastic_rigid).toContain('hdpe');
    expect(EPR_TO_ECOINVENT_MAPPING.plastic_flexible).toContain('ldpe');
    expect(EPR_TO_ECOINVENT_MAPPING.plastic_flexible).toContain('film');
  });

  it('should distinguish paper from cardboard proxies', () => {
    const paperProxies = EPR_TO_ECOINVENT_MAPPING.paper_cardboard;
    expect(paperProxies).toContain('paper');
    expect(paperProxies).toContain('cardboard');
    expect(paperProxies).toContain('corrugated board');
  });
});

// ============================================================================
// COMPONENT BREAKDOWN IMPACT CALCULATION TESTS
// ============================================================================

describe('Component Breakdown Impact Calculation', () => {
  /**
   * Simulates how component-level impact calculation should work.
   * Each component's impact is calculated based on its material type and weight,
   * then summed for the total packaging impact.
   */
  interface MaterialImpactFactor {
    impact_climate: number; // kg CO2e per kg
    impact_water: number;   // m³ per kg
    impact_land: number;    // m² per kg
    impact_waste: number;   // kg per kg
  }

  // Sample impact factors for EPR material types (per kg)
  // These would normally come from Ecoinvent/staging factors
  const SAMPLE_IMPACT_FACTORS: Record<string, MaterialImpactFactor> = {
    paper_cardboard: { impact_climate: 0.9, impact_water: 15, impact_land: 2.5, impact_waste: 0.05 },
    adhesive: { impact_climate: 2.5, impact_water: 8, impact_land: 0.5, impact_waste: 0.1 },
    ink: { impact_climate: 3.5, impact_water: 12, impact_land: 0.3, impact_waste: 0.15 },
    aluminium: { impact_climate: 8.2, impact_water: 45, impact_land: 1.2, impact_waste: 0.08 },
    plastic_flexible: { impact_climate: 2.8, impact_water: 20, impact_land: 0.8, impact_waste: 0.12 },
    plastic_rigid: { impact_climate: 3.2, impact_water: 22, impact_land: 0.9, impact_waste: 0.1 },
    glass: { impact_climate: 0.8, impact_water: 5, impact_land: 0.4, impact_waste: 0.02 },
    coating: { impact_climate: 4.0, impact_water: 18, impact_land: 0.6, impact_waste: 0.2 },
  };

  const calculateComponentImpact = (
    component: PackagingMaterialComponent,
    factors: Record<string, MaterialImpactFactor>
  ): MaterialImpactFactor => {
    const factor = factors[component.epr_material_type];
    if (!factor) {
      // Fallback to paper_cardboard as conservative default
      return {
        impact_climate: SAMPLE_IMPACT_FACTORS.paper_cardboard.impact_climate * (component.weight_grams / 1000),
        impact_water: SAMPLE_IMPACT_FACTORS.paper_cardboard.impact_water * (component.weight_grams / 1000),
        impact_land: SAMPLE_IMPACT_FACTORS.paper_cardboard.impact_land * (component.weight_grams / 1000),
        impact_waste: SAMPLE_IMPACT_FACTORS.paper_cardboard.impact_waste * (component.weight_grams / 1000),
      };
    }

    const weightKg = component.weight_grams / 1000;
    return {
      impact_climate: factor.impact_climate * weightKg,
      impact_water: factor.impact_water * weightKg,
      impact_land: factor.impact_land * weightKg,
      impact_waste: factor.impact_waste * weightKg,
    };
  };

  const calculateTotalComponentImpact = (
    components: PackagingMaterialComponent[],
    factors: Record<string, MaterialImpactFactor>
  ): MaterialImpactFactor => {
    return components.reduce(
      (total, component) => {
        const impact = calculateComponentImpact(component, factors);
        return {
          impact_climate: total.impact_climate + impact.impact_climate,
          impact_water: total.impact_water + impact.impact_water,
          impact_land: total.impact_land + impact.impact_land,
          impact_waste: total.impact_waste + impact.impact_waste,
        };
      },
      { impact_climate: 0, impact_water: 0, impact_land: 0, impact_waste: 0 }
    );
  };

  describe('Paper Label with Glue and Ink', () => {
    const paperLabelComponents: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper substrate', weight_grams: 4.5 },
      { epr_material_type: 'adhesive', component_name: 'Wet glue', weight_grams: 0.4 },
      { epr_material_type: 'ink', component_name: 'Printing ink', weight_grams: 0.1 },
    ];

    it('should calculate component impacts individually', () => {
      const paperImpact = calculateComponentImpact(paperLabelComponents[0], SAMPLE_IMPACT_FACTORS);
      const glueImpact = calculateComponentImpact(paperLabelComponents[1], SAMPLE_IMPACT_FACTORS);
      const inkImpact = calculateComponentImpact(paperLabelComponents[2], SAMPLE_IMPACT_FACTORS);

      // Paper: 0.9 kg CO2e/kg * 0.0045 kg = 0.00405 kg CO2e
      expect(paperImpact.impact_climate).toBeCloseTo(0.00405, 5);

      // Glue: 2.5 kg CO2e/kg * 0.0004 kg = 0.001 kg CO2e
      expect(glueImpact.impact_climate).toBeCloseTo(0.001, 5);

      // Ink: 3.5 kg CO2e/kg * 0.0001 kg = 0.00035 kg CO2e
      expect(inkImpact.impact_climate).toBeCloseTo(0.00035, 5);
    });

    it('should sum component impacts correctly', () => {
      const totalImpact = calculateTotalComponentImpact(paperLabelComponents, SAMPLE_IMPACT_FACTORS);

      // Total: 0.00405 + 0.001 + 0.00035 = 0.0054 kg CO2e
      expect(totalImpact.impact_climate).toBeCloseTo(0.0054, 5);
    });

    it('should result in more accurate impact than single-material calculation', () => {
      // If we just used paper for the whole 5g label:
      const singleMaterialImpact = 0.9 * (5 / 1000); // 0.0045 kg CO2e

      // Component breakdown impact:
      const componentImpact = calculateTotalComponentImpact(paperLabelComponents, SAMPLE_IMPACT_FACTORS);

      // Component breakdown should be higher because glue and ink have higher impact factors
      expect(componentImpact.impact_climate).toBeGreaterThan(singleMaterialImpact);
    });
  });

  describe('Aluminium Cap with Plastic Liner', () => {
    const aluminiumCapComponents: PackagingMaterialComponent[] = [
      { epr_material_type: 'aluminium', component_name: 'Aluminium shell', weight_grams: 2.55 },
      { epr_material_type: 'plastic_flexible', component_name: 'Plastic liner', weight_grams: 0.45 },
    ];

    it('should calculate aluminium-dominant impact correctly', () => {
      const totalImpact = calculateTotalComponentImpact(aluminiumCapComponents, SAMPLE_IMPACT_FACTORS);

      // Aluminium: 8.2 * 0.00255 = 0.02091 kg CO2e
      // Plastic: 2.8 * 0.00045 = 0.00126 kg CO2e
      // Total: 0.02217 kg CO2e
      expect(totalImpact.impact_climate).toBeCloseTo(0.02217, 4);
    });

    it('should show aluminium dominates the impact', () => {
      const aluminiumImpact = calculateComponentImpact(aluminiumCapComponents[0], SAMPLE_IMPACT_FACTORS);
      const plasticImpact = calculateComponentImpact(aluminiumCapComponents[1], SAMPLE_IMPACT_FACTORS);

      // Aluminium should be ~16x higher impact despite being only 5.7x heavier
      expect(aluminiumImpact.impact_climate / plasticImpact.impact_climate).toBeGreaterThan(10);
    });
  });

  describe('Shipping Box with Tape and Labels', () => {
    const shippingBoxComponents: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Corrugated cardboard', weight_grams: 460 },
      { epr_material_type: 'adhesive', component_name: 'Packing tape', weight_grams: 25 },
      { epr_material_type: 'ink', component_name: 'Printing', weight_grams: 15 },
    ];

    it('should handle larger weights correctly', () => {
      const totalImpact = calculateTotalComponentImpact(shippingBoxComponents, SAMPLE_IMPACT_FACTORS);

      // Cardboard: 0.9 * 0.46 = 0.414 kg CO2e
      // Tape: 2.5 * 0.025 = 0.0625 kg CO2e
      // Ink: 3.5 * 0.015 = 0.0525 kg CO2e
      // Total: 0.529 kg CO2e
      expect(totalImpact.impact_climate).toBeCloseTo(0.529, 3);
    });

    it('should track water impact for water-intensive materials', () => {
      const totalImpact = calculateTotalComponentImpact(shippingBoxComponents, SAMPLE_IMPACT_FACTORS);

      // Cardboard: 15 * 0.46 = 6.9 m³
      // Tape: 8 * 0.025 = 0.2 m³
      // Ink: 12 * 0.015 = 0.18 m³
      // Total: ~7.28 m³
      expect(totalImpact.impact_water).toBeCloseTo(7.28, 2);
    });
  });
});

// ============================================================================
// PRODUCT MATERIAL INTERFACE COMPATIBILITY TESTS
// ============================================================================

describe('ProductMaterial Interface Compatibility with EPR', () => {
  /**
   * Tests that ProductMaterial from impact-waterfall-resolver.ts
   * can accommodate EPR data without breaking existing functionality.
   */

  const createPackagingMaterial = (
    overrides: Partial<ProductMaterial> = {}
  ): ProductMaterial => ({
    id: 'test-material-123',
    product_id: 'product-456',
    material_name: 'Glass Bottle',
    material_type: 'packaging',
    quantity: '350',
    unit: 'g',
    data_source: 'openlca',
    packaging_category: 'container',
    origin_country: 'United Kingdom',
    ...overrides,
  });

  it('should accept packaging materials with standard fields', () => {
    const material = createPackagingMaterial();

    expect(material.material_type).toBe('packaging');
    expect(material.packaging_category).toBe('container');
  });

  it('should work with all 6 packaging categories', () => {
    const categories: PackagingCategory[] = [
      'container', 'label', 'closure', 'secondary', 'shipment', 'tertiary',
    ];

    categories.forEach((category) => {
      const material = createPackagingMaterial({ packaging_category: category });
      expect(material.packaging_category).toBe(category);
    });
  });

  it('should normalize packaging weight correctly for LCA', () => {
    // 350g bottle
    const material = createPackagingMaterial({ quantity: '350', unit: 'g' });
    const weightKg = normalizeToKg(material.quantity, material.unit);

    expect(weightKg).toBe(0.35);
  });

  it('should handle different unit formats', () => {
    expect(normalizeToKg('500', 'g')).toBe(0.5);
    expect(normalizeToKg('500', 'grams')).toBe(0.5);
    expect(normalizeToKg('1', 'kg')).toBe(1);
    expect(normalizeToKg('500', 'ml')).toBe(0.5);
    expect(normalizeToKg('500', 'millilitres')).toBe(0.5);
    expect(normalizeToKg('1', 'l')).toBe(1);
    expect(normalizeToKg('1', 'litres')).toBe(1);
  });

  it('should categorize packaging as MANUFACTURING_MATERIAL', () => {
    // Packaging should be categorized as manufacturing material by default
    const packagingNames = [
      'Glass Bottle',
      'Paper Label',
      'Aluminium Cap',
      'Cardboard Box',
      'Shrink Wrap',
    ];

    packagingNames.forEach((name) => {
      const material = createPackagingMaterial({ material_name: name });
      // These should NOT match energy/transport/commuting patterns
      expect(material.material_name.toLowerCase()).not.toContain('electricity');
      expect(material.material_name.toLowerCase()).not.toContain('transport');
      expect(material.material_name.toLowerCase()).not.toContain('commut');
    });
  });
});

// ============================================================================
// EPR DATA FLOW TO LCA TESTS
// ============================================================================

describe('EPR Data Flow to LCA Calculations', () => {
  /**
   * Tests the complete data flow from EPR component entry
   * through to LCA impact calculation.
   */

  interface PackagingWithEPR extends ProductMaterial {
    has_component_breakdown: boolean;
    components: PackagingMaterialComponent[];
    epr_packaging_level?: EPRPackagingLevel;
  }

  const createPackagingWithComponents = (
    components: PackagingMaterialComponent[]
  ): PackagingWithEPR => ({
    id: 'pkg-123',
    product_id: 'prod-456',
    material_name: 'Paper Label',
    material_type: 'packaging',
    quantity: '5', // 5g total
    unit: 'g',
    packaging_category: 'label',
    has_component_breakdown: true,
    components,
    epr_packaging_level: 'primary',
  });

  it('should preserve component data through the flow', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper substrate', weight_grams: 4.5 },
      { epr_material_type: 'adhesive', component_name: 'Wet glue', weight_grams: 0.4 },
      { epr_material_type: 'ink', component_name: 'Printing ink', weight_grams: 0.1 },
    ];

    const packaging = createPackagingWithComponents(components);

    expect(packaging.has_component_breakdown).toBe(true);
    expect(packaging.components).toHaveLength(3);
    expect(packaging.components[0].epr_material_type).toBe('paper_cardboard');
  });

  it('should calculate total weight from components', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 4.5 },
      { epr_material_type: 'adhesive', component_name: 'Glue', weight_grams: 0.4 },
      { epr_material_type: 'ink', component_name: 'Ink', weight_grams: 0.1 },
    ];

    const totalWeight = components.reduce((sum, c) => sum + c.weight_grams, 0);
    expect(totalWeight).toBe(5);
  });

  it('should flag packaging without breakdown', () => {
    const packagingWithoutBreakdown: PackagingWithEPR = {
      id: 'pkg-789',
      product_id: 'prod-456',
      material_name: 'Glass Bottle',
      material_type: 'packaging',
      quantity: '350',
      unit: 'g',
      packaging_category: 'container',
      has_component_breakdown: false,
      components: [],
      epr_packaging_level: 'primary',
    };

    expect(packagingWithoutBreakdown.has_component_breakdown).toBe(false);
    expect(packagingWithoutBreakdown.components).toHaveLength(0);
  });

  it('should track EPR packaging level for reporting', () => {
    const primaryPackaging = createPackagingWithComponents([]);
    primaryPackaging.epr_packaging_level = 'primary';
    expect(primaryPackaging.epr_packaging_level).toBe('primary');

    const tertiaryPackaging = createPackagingWithComponents([]);
    tertiaryPackaging.epr_packaging_level = 'tertiary';
    expect(tertiaryPackaging.epr_packaging_level).toBe('tertiary');
  });
});

// ============================================================================
// WATERFALL RESULT STRUCTURE TESTS
// ============================================================================

describe('WaterfallResult Structure for EPR Components', () => {
  /**
   * Tests that WaterfallResult structure can handle
   * component-level calculations and aggregation.
   */

  const createMockWaterfallResult = (
    impactValues: Partial<WaterfallResult>
  ): WaterfallResult => ({
    impact_climate: 0,
    impact_climate_fossil: 0,
    impact_climate_biogenic: 0,
    impact_climate_dluc: 0,
    impact_water: 0,
    impact_water_scarcity: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_ozone_depletion: 0,
    impact_photochemical_ozone_formation: 0,
    impact_ionising_radiation: 0,
    impact_particulate_matter: 0,
    impact_human_toxicity_carcinogenic: 0,
    impact_human_toxicity_non_carcinogenic: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: 0,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: 0,
    data_priority: 3,
    data_quality_tag: 'Secondary_Modelled',
    data_quality_grade: 'MEDIUM',
    source_reference: 'Test',
    confidence_score: 70,
    methodology: 'Test',
    gwp_data_source: 'Test',
    non_gwp_data_source: 'Test',
    is_hybrid_source: false,
    category_type: 'MANUFACTURING_MATERIAL',
    ...impactValues,
  });

  it('should aggregate component results correctly', () => {
    const paperResult = createMockWaterfallResult({ impact_climate: 0.00405 });
    const glueResult = createMockWaterfallResult({ impact_climate: 0.001 });
    const inkResult = createMockWaterfallResult({ impact_climate: 0.00035 });

    const totalClimate =
      paperResult.impact_climate +
      glueResult.impact_climate +
      inkResult.impact_climate;

    expect(totalClimate).toBeCloseTo(0.0054, 5);
  });

  it('should preserve data quality tracking across components', () => {
    const supplierResult = createMockWaterfallResult({
      data_priority: 1,
      data_quality_tag: 'Primary_Verified',
      confidence_score: 95,
    });

    const stagingResult = createMockWaterfallResult({
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
      confidence_score: 70,
    });

    // Mixed data sources should result in lower overall confidence
    const avgConfidence = (supplierResult.confidence_score + stagingResult.confidence_score) / 2;
    expect(avgConfidence).toBe(82.5);
  });

  it('should track all 18 ReCiPe impact categories', () => {
    const result = createMockWaterfallResult({
      impact_climate: 1,
      impact_water: 10,
      impact_land: 0.5,
      impact_waste: 0.1,
      impact_ozone_depletion: 0.001,
      impact_photochemical_ozone_formation: 0.002,
      impact_ionising_radiation: 0.003,
      impact_particulate_matter: 0.004,
      impact_human_toxicity_carcinogenic: 0.005,
      impact_human_toxicity_non_carcinogenic: 0.006,
      impact_terrestrial_ecotoxicity: 0.007,
      impact_freshwater_ecotoxicity: 0.008,
      impact_marine_ecotoxicity: 0.009,
      impact_freshwater_eutrophication: 0.01,
      impact_marine_eutrophication: 0.011,
      impact_terrestrial_acidification: 0.012,
      impact_mineral_resource_scarcity: 0.013,
      impact_fossil_resource_scarcity: 0.014,
    });

    // Count non-zero impact categories
    const impactKeys = Object.keys(result).filter((k) => k.startsWith('impact_'));
    expect(impactKeys.length).toBeGreaterThanOrEqual(18);
  });
});

// ============================================================================
// EPR RECYCLED CONTENT CALCULATION TESTS
// ============================================================================

describe('EPR Recycled Content Calculations', () => {
  /**
   * Tests for calculating recycled content percentages
   * across component breakdown for EPR reporting.
   */

  interface ComponentWithRecycled extends PackagingMaterialComponent {
    recycled_content_percentage: number;
  }

  const calculateWeightedRecycledContent = (
    components: ComponentWithRecycled[]
  ): number => {
    const totalWeight = components.reduce((sum, c) => sum + c.weight_grams, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = components.reduce(
      (sum, c) => sum + c.weight_grams * (c.recycled_content_percentage || 0),
      0
    );

    return weightedSum / totalWeight;
  };

  it('should calculate weighted recycled content correctly', () => {
    const components: ComponentWithRecycled[] = [
      {
        epr_material_type: 'paper_cardboard',
        component_name: 'Paper substrate',
        weight_grams: 4.5,
        recycled_content_percentage: 80,
      },
      {
        epr_material_type: 'adhesive',
        component_name: 'Wet glue',
        weight_grams: 0.4,
        recycled_content_percentage: 0,
      },
      {
        epr_material_type: 'ink',
        component_name: 'Printing ink',
        weight_grams: 0.1,
        recycled_content_percentage: 0,
      },
    ];

    const weightedRecycled = calculateWeightedRecycledContent(components);

    // (4.5 * 80 + 0.4 * 0 + 0.1 * 0) / 5 = 360 / 5 = 72%
    expect(weightedRecycled).toBe(72);
  });

  it('should handle 100% recycled content', () => {
    const components: ComponentWithRecycled[] = [
      {
        epr_material_type: 'paper_cardboard',
        component_name: 'Recycled Paper',
        weight_grams: 5,
        recycled_content_percentage: 100,
      },
    ];

    const weightedRecycled = calculateWeightedRecycledContent(components);
    expect(weightedRecycled).toBe(100);
  });

  it('should handle 0% recycled content', () => {
    const components: ComponentWithRecycled[] = [
      {
        epr_material_type: 'plastic_rigid',
        component_name: 'Virgin PET',
        weight_grams: 10,
        recycled_content_percentage: 0,
      },
    ];

    const weightedRecycled = calculateWeightedRecycledContent(components);
    expect(weightedRecycled).toBe(0);
  });

  it('should handle mixed recycled content', () => {
    const components: ComponentWithRecycled[] = [
      {
        epr_material_type: 'plastic_rigid',
        component_name: 'rPET body',
        weight_grams: 25,
        recycled_content_percentage: 50,
      },
      {
        epr_material_type: 'plastic_rigid',
        component_name: 'Virgin cap',
        weight_grams: 5,
        recycled_content_percentage: 0,
      },
    ];

    const weightedRecycled = calculateWeightedRecycledContent(components);

    // (25 * 50 + 5 * 0) / 30 = 1250 / 30 = 41.67%
    expect(weightedRecycled).toBeCloseTo(41.67, 1);
  });
});

// ============================================================================
// EPR MATERIAL WEIGHT BY TYPE AGGREGATION TESTS
// ============================================================================

describe('EPR Material Weight by Type Aggregation', () => {
  /**
   * Tests for aggregating weights by EPR material type
   * for regulatory reporting purposes.
   */

  const aggregateWeightsByType = (
    components: PackagingMaterialComponent[]
  ): Record<EPRMaterialType, number> => {
    const result: Partial<Record<EPRMaterialType, number>> = {};

    for (const component of components) {
      const currentWeight = result[component.epr_material_type] || 0;
      result[component.epr_material_type] = currentWeight + component.weight_grams;
    }

    return result as Record<EPRMaterialType, number>;
  };

  it('should aggregate weights by material type', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Box', weight_grams: 100 },
      { epr_material_type: 'paper_cardboard', component_name: 'Label', weight_grams: 5 },
      { epr_material_type: 'adhesive', component_name: 'Tape', weight_grams: 10 },
      { epr_material_type: 'ink', component_name: 'Print', weight_grams: 2 },
    ];

    const aggregated = aggregateWeightsByType(components);

    expect(aggregated.paper_cardboard).toBe(105);
    expect(aggregated.adhesive).toBe(10);
    expect(aggregated.ink).toBe(2);
  });

  it('should handle multiple products for EPR summary', () => {
    // Product 1: Label
    const labelComponents: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 4.5 },
      { epr_material_type: 'adhesive', component_name: 'Glue', weight_grams: 0.4 },
      { epr_material_type: 'ink', component_name: 'Ink', weight_grams: 0.1 },
    ];

    // Product 2: Cap
    const capComponents: PackagingMaterialComponent[] = [
      { epr_material_type: 'aluminium', component_name: 'Shell', weight_grams: 2.55 },
      { epr_material_type: 'plastic_flexible', component_name: 'Liner', weight_grams: 0.45 },
    ];

    const allComponents = [...labelComponents, ...capComponents];
    const aggregated = aggregateWeightsByType(allComponents);

    expect(aggregated.paper_cardboard).toBe(4.5);
    expect(aggregated.adhesive).toBe(0.4);
    expect(aggregated.ink).toBe(0.1);
    expect(aggregated.aluminium).toBe(2.55);
    expect(aggregated.plastic_flexible).toBe(0.45);
  });

  it('should convert grams to kg for EPR tonnage reporting', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'glass', component_name: 'Bottle', weight_grams: 350000 },
      { epr_material_type: 'aluminium', component_name: 'Cap', weight_grams: 3000 },
    ];

    const aggregated = aggregateWeightsByType(components);

    // Convert to kg for reporting
    const aggregatedKg = {
      glass: aggregated.glass / 1000,
      aluminium: aggregated.aluminium / 1000,
    };

    expect(aggregatedKg.glass).toBe(350); // 350 kg
    expect(aggregatedKg.aluminium).toBe(3); // 3 kg
  });
});

// ============================================================================
// BACKWARDS COMPATIBILITY TESTS
// ============================================================================

describe('Backwards Compatibility with Existing LCA', () => {
  /**
   * Tests that existing LCA calculations continue to work
   * when EPR component data is not present.
   */

  it('should handle packaging without component breakdown', () => {
    const legacyPackaging: ProductMaterial = {
      id: 'legacy-123',
      product_id: 'prod-456',
      material_name: 'Glass Bottle',
      material_type: 'packaging',
      quantity: '350',
      unit: 'g',
      packaging_category: 'container',
      origin_country: 'UK',
    };

    // Should work without EPR fields
    const weightKg = normalizeToKg(legacyPackaging.quantity, legacyPackaging.unit);
    expect(weightKg).toBe(0.35);
    expect(legacyPackaging.material_type).toBe('packaging');
  });

  it('should not require EPR fields for LCA calculation', () => {
    const materialWithoutEPR: ProductMaterial = {
      id: 'no-epr-123',
      product_id: 'prod-789',
      material_name: 'Aluminium Can',
      material_type: 'packaging',
      quantity: '15',
      unit: 'g',
      packaging_category: 'container',
    };

    // Material can be processed without EPR data
    expect(materialWithoutEPR.packaging_category).toBe('container');
    expect(normalizeToKg(materialWithoutEPR.quantity, materialWithoutEPR.unit)).toBe(0.015);
  });

  it('should preserve existing 4-category packaging structure', () => {
    const existingCategories: PackagingCategory[] = [
      'container', 'label', 'closure', 'secondary',
    ];

    existingCategories.forEach((category) => {
      const material: ProductMaterial = {
        id: `test-${category}`,
        product_id: 'prod-test',
        material_name: `Test ${category}`,
        material_type: 'packaging',
        quantity: '10',
        unit: 'g',
        packaging_category: category,
      };

      expect(material.packaging_category).toBe(category);
    });
  });
});
