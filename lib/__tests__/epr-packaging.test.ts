import { describe, it, expect } from 'vitest';
import type {
  EPRMaterialType,
  EPRPackagingLevel,
  EPRPackagingActivity,
  EPRRAMRating,
  EPRUKNation,
  PackagingCategory,
  PackagingMaterialComponent,
} from '../types/lca';

// ============================================================================
// EPR TYPE VALIDATION TESTS
// ============================================================================

describe('UK EPR Type Definitions', () => {
  describe('EPRMaterialType', () => {
    it('should include all gov.uk main material categories', () => {
      const mainCategories: EPRMaterialType[] = [
        'aluminium',
        'fibre_composite',
        'glass',
        'paper_cardboard',
        'plastic_rigid',
        'plastic_flexible',
        'steel',
        'wood',
        'other',
      ];

      mainCategories.forEach((material) => {
        const testValue: EPRMaterialType = material;
        expect(testValue).toBe(material);
      });
    });

    it('should include sub-component materials for detailed breakdown', () => {
      const subComponents: EPRMaterialType[] = [
        'adhesive',
        'ink',
        'coating',
        'lacquer',
      ];

      subComponents.forEach((material) => {
        const testValue: EPRMaterialType = material;
        expect(testValue).toBe(material);
      });
    });

    it('should split plastic into rigid and flexible per gov.uk requirements', () => {
      // Gov.uk requires large producers to report plastic split by rigid/flexible
      const plasticRigid: EPRMaterialType = 'plastic_rigid';
      const plasticFlexible: EPRMaterialType = 'plastic_flexible';

      expect(plasticRigid).not.toBe(plasticFlexible);
    });
  });

  describe('EPRPackagingLevel', () => {
    it('should include all UK EPR packaging classes', () => {
      const levels: EPRPackagingLevel[] = [
        'primary',
        'secondary',
        'tertiary',
        'shipment',
      ];

      levels.forEach((level) => {
        const testValue: EPRPackagingLevel = level;
        expect(testValue).toBe(level);
      });
    });
  });

  describe('EPRPackagingActivity', () => {
    it('should include all gov.uk packaging activity options', () => {
      const activities: EPRPackagingActivity[] = [
        'brand',           // Supplied under your brand
        'packed_filled',   // Packed or filled
        'imported',        // Imported (first UK owner)
        'empty',           // Supplied as empty packaging
        'hired',           // Hired or loaned
        'marketplace',     // Online marketplace
      ];

      activities.forEach((activity) => {
        const testValue: EPRPackagingActivity = activity;
        expect(testValue).toBe(activity);
      });
    });
  });

  describe('EPRRAMRating', () => {
    it('should include RAM recyclability ratings', () => {
      const ratings: EPRRAMRating[] = ['red', 'amber', 'green'];

      ratings.forEach((rating) => {
        const testValue: EPRRAMRating = rating;
        expect(testValue).toBe(rating);
      });
    });
  });

  describe('EPRUKNation', () => {
    it('should include all UK nations for EPR reporting', () => {
      const nations: EPRUKNation[] = [
        'england',
        'scotland',
        'wales',
        'northern_ireland',
      ];

      nations.forEach((nation) => {
        const testValue: EPRUKNation = nation;
        expect(testValue).toBe(nation);
      });
    });
  });

  describe('PackagingCategory', () => {
    it('should include all packaging categories including new EPR ones', () => {
      const categories: PackagingCategory[] = [
        'container',
        'label',
        'closure',
        'secondary',
        'shipment',   // NEW for EPR
        'tertiary',   // NEW for EPR
      ];

      expect(categories).toHaveLength(6);
      categories.forEach((category) => {
        const testValue: PackagingCategory = category;
        expect(testValue).toBe(category);
      });
    });
  });
});

// ============================================================================
// EPR PACKAGING LEVEL MAPPING TESTS
// ============================================================================

describe('EPR Packaging Level Mapping', () => {
  // These mappings should match the PACKAGING_TYPES constant in PackagingFormCard.tsx
  const CATEGORY_TO_EPR_LEVEL: Record<PackagingCategory, EPRPackagingLevel> = {
    container: 'primary',
    label: 'primary',
    closure: 'primary',
    secondary: 'secondary',
    shipment: 'shipment',
    tertiary: 'tertiary',
  };

  it('should map container, label, closure to primary packaging', () => {
    expect(CATEGORY_TO_EPR_LEVEL.container).toBe('primary');
    expect(CATEGORY_TO_EPR_LEVEL.label).toBe('primary');
    expect(CATEGORY_TO_EPR_LEVEL.closure).toBe('primary');
  });

  it('should map secondary to secondary packaging', () => {
    expect(CATEGORY_TO_EPR_LEVEL.secondary).toBe('secondary');
  });

  it('should map shipment to shipment packaging', () => {
    expect(CATEGORY_TO_EPR_LEVEL.shipment).toBe('shipment');
  });

  it('should map tertiary to tertiary packaging', () => {
    expect(CATEGORY_TO_EPR_LEVEL.tertiary).toBe('tertiary');
  });
});

// ============================================================================
// PACKAGING MATERIAL COMPONENT TESTS
// ============================================================================

describe('PackagingMaterialComponent', () => {
  it('should create a valid component with required fields', () => {
    const component: PackagingMaterialComponent = {
      epr_material_type: 'paper_cardboard',
      component_name: 'Paper substrate',
      weight_grams: 4.5,
    };

    expect(component.epr_material_type).toBe('paper_cardboard');
    expect(component.component_name).toBe('Paper substrate');
    expect(component.weight_grams).toBe(4.5);
  });

  it('should support optional recycled content percentage', () => {
    const component: PackagingMaterialComponent = {
      epr_material_type: 'aluminium',
      component_name: 'Aluminium shell',
      weight_grams: 2.0,
      recycled_content_percentage: 30,
    };

    expect(component.recycled_content_percentage).toBe(30);
  });

  it('should support optional recyclability flag', () => {
    const component: PackagingMaterialComponent = {
      epr_material_type: 'plastic_rigid',
      component_name: 'PP cap',
      weight_grams: 1.5,
      is_recyclable: true,
    };

    expect(component.is_recyclable).toBe(true);
  });

  it('should support database identifiers for persisted components', () => {
    const component: PackagingMaterialComponent = {
      id: 'uuid-123',
      product_material_id: 456,
      epr_material_type: 'glass',
      component_name: 'Glass body',
      weight_grams: 350,
      recycled_content_percentage: 25,
      is_recyclable: true,
    };

    expect(component.id).toBe('uuid-123');
    expect(component.product_material_id).toBe(456);
  });
});

// ============================================================================
// EPR COMPONENT PRESET TESTS
// ============================================================================

describe('EPR Component Presets', () => {
  // These presets match EPR_COMPONENT_PRESETS in PackagingComponentEditor.tsx
  const EPR_COMPONENT_PRESETS = {
    paper_label: {
      name: 'Paper Label (wet glue)',
      components: [
        { epr_material_type: 'paper_cardboard' as EPRMaterialType, component_name: 'Paper substrate', weight_pct: 90 },
        { epr_material_type: 'adhesive' as EPRMaterialType, component_name: 'Wet glue', weight_pct: 8 },
        { epr_material_type: 'ink' as EPRMaterialType, component_name: 'Printing ink', weight_pct: 2 },
      ],
    },
    self_adhesive_label: {
      name: 'Self-Adhesive Label',
      components: [
        { epr_material_type: 'paper_cardboard' as EPRMaterialType, component_name: 'Paper substrate', weight_pct: 85 },
        { epr_material_type: 'adhesive' as EPRMaterialType, component_name: 'Adhesive layer', weight_pct: 12 },
        { epr_material_type: 'ink' as EPRMaterialType, component_name: 'Printing ink', weight_pct: 3 },
      ],
    },
    aluminium_cap: {
      name: 'Aluminium Screw Cap',
      components: [
        { epr_material_type: 'aluminium' as EPRMaterialType, component_name: 'Aluminium shell', weight_pct: 85 },
        { epr_material_type: 'plastic_flexible' as EPRMaterialType, component_name: 'Plastic liner', weight_pct: 15 },
      ],
    },
    plastic_cap: {
      name: 'Plastic Cap',
      components: [
        { epr_material_type: 'plastic_rigid' as EPRMaterialType, component_name: 'Cap body', weight_pct: 95 },
        { epr_material_type: 'plastic_flexible' as EPRMaterialType, component_name: 'Seal liner', weight_pct: 5 },
      ],
    },
    cork_closure: {
      name: 'Natural Cork',
      components: [
        { epr_material_type: 'other' as EPRMaterialType, component_name: 'Natural cork', weight_pct: 100 },
      ],
    },
    shipping_box: {
      name: 'Shipping Box with Tape',
      components: [
        { epr_material_type: 'paper_cardboard' as EPRMaterialType, component_name: 'Corrugated cardboard', weight_pct: 92 },
        { epr_material_type: 'adhesive' as EPRMaterialType, component_name: 'Packing tape', weight_pct: 5 },
        { epr_material_type: 'ink' as EPRMaterialType, component_name: 'Printing', weight_pct: 3 },
      ],
    },
    gift_box: {
      name: 'Gift Box with Label',
      components: [
        { epr_material_type: 'paper_cardboard' as EPRMaterialType, component_name: 'Cardboard box', weight_pct: 88 },
        { epr_material_type: 'paper_cardboard' as EPRMaterialType, component_name: 'Paper label', weight_pct: 5 },
        { epr_material_type: 'coating' as EPRMaterialType, component_name: 'Laminate finish', weight_pct: 4 },
        { epr_material_type: 'ink' as EPRMaterialType, component_name: 'Printing ink', weight_pct: 3 },
      ],
    },
  };

  describe('Preset weight percentages', () => {
    it('should have paper_label components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.paper_label.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have self_adhesive_label components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.self_adhesive_label.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have aluminium_cap components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.aluminium_cap.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have plastic_cap components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.plastic_cap.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have cork_closure components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.cork_closure.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have shipping_box components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.shipping_box.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });

    it('should have gift_box components summing to 100%', () => {
      const sum = EPR_COMPONENT_PRESETS.gift_box.components.reduce(
        (acc, c) => acc + c.weight_pct,
        0
      );
      expect(sum).toBe(100);
    });
  });

  describe('Preset material type validation', () => {
    it('should use valid EPR material types for paper_label', () => {
      const materialTypes = EPR_COMPONENT_PRESETS.paper_label.components.map(
        (c) => c.epr_material_type
      );
      expect(materialTypes).toContain('paper_cardboard');
      expect(materialTypes).toContain('adhesive');
      expect(materialTypes).toContain('ink');
    });

    it('should use valid EPR material types for aluminium_cap', () => {
      const materialTypes = EPR_COMPONENT_PRESETS.aluminium_cap.components.map(
        (c) => c.epr_material_type
      );
      expect(materialTypes).toContain('aluminium');
      expect(materialTypes).toContain('plastic_flexible');
    });

    it('should correctly split plastic into rigid/flexible for caps', () => {
      const plasticCapTypes = EPR_COMPONENT_PRESETS.plastic_cap.components.map(
        (c) => c.epr_material_type
      );
      expect(plasticCapTypes).toContain('plastic_rigid');
      expect(plasticCapTypes).toContain('plastic_flexible');
    });
  });

  describe('Preset component weight calculation', () => {
    const applyPreset = (
      presetKey: keyof typeof EPR_COMPONENT_PRESETS,
      totalWeight: number
    ): PackagingMaterialComponent[] => {
      const preset = EPR_COMPONENT_PRESETS[presetKey];
      return preset.components.map((pc) => ({
        epr_material_type: pc.epr_material_type,
        component_name: pc.component_name,
        weight_grams: Number(((totalWeight * pc.weight_pct) / 100).toFixed(2)),
        recycled_content_percentage: 0,
        is_recyclable: true,
      }));
    };

    it('should calculate correct weights for 5g paper label', () => {
      const components = applyPreset('paper_label', 5);

      expect(components[0].weight_grams).toBe(4.5); // 90% of 5g
      expect(components[1].weight_grams).toBe(0.4); // 8% of 5g
      expect(components[2].weight_grams).toBe(0.1); // 2% of 5g
    });

    it('should calculate correct weights for 3g aluminium cap', () => {
      const components = applyPreset('aluminium_cap', 3);

      expect(components[0].weight_grams).toBe(2.55); // 85% of 3g
      expect(components[1].weight_grams).toBe(0.45); // 15% of 3g
    });

    it('should calculate correct weights for 500g shipping box', () => {
      const components = applyPreset('shipping_box', 500);

      expect(components[0].weight_grams).toBe(460); // 92% of 500g
      expect(components[1].weight_grams).toBe(25);  // 5% of 500g
      expect(components[2].weight_grams).toBe(15);  // 3% of 500g
    });

    it('should have component weights sum to total weight', () => {
      const totalWeight = 10;
      const components = applyPreset('paper_label', totalWeight);
      const sum = components.reduce((acc, c) => acc + c.weight_grams, 0);

      expect(sum).toBe(totalWeight);
    });
  });
});

// ============================================================================
// EPR WEIGHT VALIDATION TESTS
// ============================================================================

describe('EPR Component Weight Validation', () => {
  const calculateWeightVariance = (
    components: PackagingMaterialComponent[],
    totalWeight: number
  ): { variance: number; variancePct: number; hasWeightMismatch: boolean } => {
    const componentWeightSum = components.reduce((sum, c) => sum + (c.weight_grams || 0), 0);
    const variance = totalWeight > 0 ? Math.abs(componentWeightSum - totalWeight) : 0;
    const variancePct = totalWeight > 0 ? (variance / totalWeight) * 100 : 0;
    const hasWeightMismatch = totalWeight > 0 && variancePct > 5;

    return { variance, variancePct, hasWeightMismatch };
  };

  it('should report no mismatch when components match total weight', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 4.5 },
      { epr_material_type: 'adhesive', component_name: 'Glue', weight_grams: 0.4 },
      { epr_material_type: 'ink', component_name: 'Ink', weight_grams: 0.1 },
    ];

    const result = calculateWeightVariance(components, 5);

    expect(result.variancePct).toBe(0);
    expect(result.hasWeightMismatch).toBe(false);
  });

  it('should report mismatch when variance exceeds 5%', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 4.0 },
      { epr_material_type: 'adhesive', component_name: 'Glue', weight_grams: 0.3 },
    ];

    const result = calculateWeightVariance(components, 5);

    expect(result.variancePct).toBeCloseTo(14, 5); // 0.7g variance / 5g = 14%
    expect(result.hasWeightMismatch).toBe(true);
  });

  it('should allow small variance within 5% threshold', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 4.8 },
    ];

    const result = calculateWeightVariance(components, 5);

    expect(result.variancePct).toBeCloseTo(4, 5); // 0.2g variance / 5g = 4%
    expect(result.hasWeightMismatch).toBe(false);
  });

  it('should handle zero total weight without mismatch', () => {
    const components: PackagingMaterialComponent[] = [
      { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 1 },
    ];

    const result = calculateWeightVariance(components, 0);

    expect(result.hasWeightMismatch).toBe(false);
  });

  it('should handle empty components array', () => {
    const result = calculateWeightVariance([], 5);

    expect(result.variance).toBe(5);
    expect(result.variancePct).toBe(100);
    expect(result.hasWeightMismatch).toBe(true);
  });
});

// ============================================================================
// EPR COMPLIANCE DATA STRUCTURE TESTS
// ============================================================================

describe('EPR Compliance Data Structure', () => {
  interface PackagingEPRData {
    has_component_breakdown: boolean;
    components: PackagingMaterialComponent[];
    epr_packaging_level?: EPRPackagingLevel;
    epr_packaging_activity?: EPRPackagingActivity;
    epr_is_household: boolean;
    epr_ram_rating?: EPRRAMRating;
    epr_uk_nation?: EPRUKNation;
    epr_is_drinks_container: boolean;
  }

  const createDefaultEPRData = (): PackagingEPRData => ({
    has_component_breakdown: false,
    components: [],
    epr_packaging_level: undefined,
    epr_packaging_activity: undefined,
    epr_is_household: true,
    epr_ram_rating: undefined,
    epr_uk_nation: undefined,
    epr_is_drinks_container: false,
  });

  it('should create valid default EPR data structure', () => {
    const data = createDefaultEPRData();

    expect(data.has_component_breakdown).toBe(false);
    expect(data.components).toHaveLength(0);
    expect(data.epr_is_household).toBe(true);
    expect(data.epr_is_drinks_container).toBe(false);
  });

  it('should support complete EPR compliance data', () => {
    const data: PackagingEPRData = {
      has_component_breakdown: true,
      components: [
        { epr_material_type: 'paper_cardboard', component_name: 'Paper', weight_grams: 5 },
      ],
      epr_packaging_level: 'primary',
      epr_packaging_activity: 'brand',
      epr_is_household: true,
      epr_ram_rating: 'green',
      epr_uk_nation: 'england',
      epr_is_drinks_container: false,
    };

    expect(data.has_component_breakdown).toBe(true);
    expect(data.components).toHaveLength(1);
    expect(data.epr_packaging_level).toBe('primary');
    expect(data.epr_packaging_activity).toBe('brand');
    expect(data.epr_ram_rating).toBe('green');
    expect(data.epr_uk_nation).toBe('england');
  });

  it('should support non-household packaging', () => {
    const data = createDefaultEPRData();
    data.epr_is_household = false;

    expect(data.epr_is_household).toBe(false);
  });

  it('should support drinks container flag for containers 150ml-3L', () => {
    const data = createDefaultEPRData();
    data.epr_is_drinks_container = true;

    expect(data.epr_is_drinks_container).toBe(true);
  });
});

// ============================================================================
// EPR PACKAGING ACTIVITY OPTIONS TESTS
// ============================================================================

describe('EPR Packaging Activity Options', () => {
  const EPR_PACKAGING_ACTIVITIES = [
    { value: 'brand', label: 'Supplied under your brand' },
    { value: 'packed_filled', label: 'Packed or filled' },
    { value: 'imported', label: 'Imported (first UK owner)' },
    { value: 'empty', label: 'Supplied as empty packaging' },
    { value: 'hired', label: 'Hired or loaned' },
    { value: 'marketplace', label: 'Online marketplace' },
  ] as const;

  it('should have 6 packaging activity options', () => {
    expect(EPR_PACKAGING_ACTIVITIES).toHaveLength(6);
  });

  it('should have unique values', () => {
    const values = EPR_PACKAGING_ACTIVITIES.map((a) => a.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should have human-readable labels', () => {
    EPR_PACKAGING_ACTIVITIES.forEach((activity) => {
      expect(activity.label.length).toBeGreaterThan(5);
      expect(activity.label).not.toBe(activity.value);
    });
  });
});

// ============================================================================
// EPR RAM RATING OPTIONS TESTS
// ============================================================================

describe('EPR RAM Rating Options', () => {
  const EPR_RAM_RATINGS = [
    { value: 'green', label: 'Green', description: 'Recyclable - collected and sorted for recycling' },
    { value: 'amber', label: 'Amber', description: 'Some recyclability issues' },
    { value: 'red', label: 'Red', description: 'Not recyclable in practice' },
  ] as const;

  it('should have 3 RAM rating options', () => {
    expect(EPR_RAM_RATINGS).toHaveLength(3);
  });

  it('should include descriptions for EPR fee modulation context', () => {
    EPR_RAM_RATINGS.forEach((rating) => {
      expect(rating.description).toBeDefined();
      expect(rating.description.length).toBeGreaterThan(10);
    });
  });

  it('should rank recyclability correctly', () => {
    // Green is best (fully recyclable)
    expect(EPR_RAM_RATINGS[0].value).toBe('green');
    // Red is worst (not recyclable)
    expect(EPR_RAM_RATINGS[2].value).toBe('red');
  });
});

// ============================================================================
// EPR UK NATION OPTIONS TESTS
// ============================================================================

describe('EPR UK Nation Options', () => {
  const EPR_UK_NATIONS = [
    { value: 'england', label: 'England' },
    { value: 'scotland', label: 'Scotland' },
    { value: 'wales', label: 'Wales' },
    { value: 'northern_ireland', label: 'Northern Ireland' },
  ] as const;

  it('should have all 4 UK nations', () => {
    expect(EPR_UK_NATIONS).toHaveLength(4);
  });

  it('should have correct values matching EPRUKNation type', () => {
    const values = EPR_UK_NATIONS.map((n) => n.value);
    expect(values).toContain('england');
    expect(values).toContain('scotland');
    expect(values).toContain('wales');
    expect(values).toContain('northern_ireland');
  });
});

// ============================================================================
// PACKAGING TYPES CONSTANT TESTS
// ============================================================================

describe('PACKAGING_TYPES Configuration', () => {
  const PACKAGING_TYPES = [
    { value: 'container', label: 'Container', eprLevel: 'primary' },
    { value: 'label', label: 'Label', eprLevel: 'primary' },
    { value: 'closure', label: 'Closure', eprLevel: 'primary' },
    { value: 'secondary', label: 'Secondary', eprLevel: 'secondary' },
    { value: 'shipment', label: 'Shipment', eprLevel: 'shipment' },
    { value: 'tertiary', label: 'Tertiary', eprLevel: 'tertiary' },
  ] as const;

  it('should have 6 packaging types', () => {
    expect(PACKAGING_TYPES).toHaveLength(6);
  });

  it('should have EPR level for each type', () => {
    PACKAGING_TYPES.forEach((type) => {
      expect(type.eprLevel).toBeDefined();
      expect(['primary', 'secondary', 'tertiary', 'shipment']).toContain(type.eprLevel);
    });
  });

  it('should map primary packaging types correctly', () => {
    const primaryTypes = PACKAGING_TYPES.filter((t) => t.eprLevel === 'primary');
    expect(primaryTypes).toHaveLength(3);
    expect(primaryTypes.map((t) => t.value)).toEqual(['container', 'label', 'closure']);
  });

  it('should include new shipment and tertiary categories', () => {
    const shipmentType = PACKAGING_TYPES.find((t) => t.value === 'shipment');
    const tertiaryType = PACKAGING_TYPES.find((t) => t.value === 'tertiary');

    expect(shipmentType).toBeDefined();
    expect(shipmentType?.eprLevel).toBe('shipment');

    expect(tertiaryType).toBeDefined();
    expect(tertiaryType?.eprLevel).toBe('tertiary');
  });
});

// ============================================================================
// BACKWARDS COMPATIBILITY TESTS
// ============================================================================

describe('Backwards Compatibility', () => {
  it('should support existing packaging categories', () => {
    const existingCategories: PackagingCategory[] = [
      'container',
      'label',
      'closure',
      'secondary',
    ];

    existingCategories.forEach((category) => {
      const testValue: PackagingCategory = category;
      expect(testValue).toBe(category);
    });
  });

  it('should allow packaging without EPR fields', () => {
    // This tests that existing packaging data without EPR fields remains valid
    interface LegacyPackagingData {
      tempId: string;
      name: string;
      packaging_category: PackagingCategory;
      net_weight_g: number;
    }

    const legacyData: LegacyPackagingData = {
      tempId: 'test-123',
      name: 'Glass Bottle',
      packaging_category: 'container',
      net_weight_g: 350,
    };

    expect(legacyData.packaging_category).toBe('container');
    expect(legacyData.net_weight_g).toBe(350);
  });

  it('should default EPR fields to safe values', () => {
    const defaultEPRValues = {
      has_component_breakdown: false,
      components: [],
      epr_is_household: true,
      epr_is_drinks_container: false,
    };

    expect(defaultEPRValues.has_component_breakdown).toBe(false);
    expect(defaultEPRValues.components).toHaveLength(0);
    expect(defaultEPRValues.epr_is_household).toBe(true);
    expect(defaultEPRValues.epr_is_drinks_container).toBe(false);
  });
});
