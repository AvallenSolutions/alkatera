import { describe, it, expect } from 'vitest';
import {
  isDRSExcluded,
  isGlassDrinksContainer,
  isAggregatedDrinksContainer,
  extractComponentWeights,
  processContainerComponents,
} from '@/lib/epr/drinks-container-rules';
import type { ComponentWeight } from '@/lib/epr/drinks-container-rules';

// =============================================================================
// isDRSExcluded
// =============================================================================

describe('isDRSExcluded', () => {
  describe('all 3 conditions met — DRS excluded', () => {
    it('excludes aluminium drinks container in 150-3000ml range', () => {
      expect(isDRSExcluded(true, 500, 'aluminium')).toBe(true);
    });

    it('excludes plastic_rigid drinks container in 150-3000ml range', () => {
      expect(isDRSExcluded(true, 330, 'plastic_rigid')).toBe(true);
    });

    it('excludes steel drinks container in 150-3000ml range', () => {
      expect(isDRSExcluded(true, 440, 'steel')).toBe(true);
    });

    it('excludes at exactly 150ml (lower boundary)', () => {
      expect(isDRSExcluded(true, 150, 'aluminium')).toBe(true);
    });

    it('excludes at exactly 3000ml (upper boundary)', () => {
      expect(isDRSExcluded(true, 3000, 'aluminium')).toBe(true);
    });
  });

  describe('glass is NOT DRS excluded', () => {
    it('returns false for glass drinks container', () => {
      expect(isDRSExcluded(true, 500, 'glass')).toBe(false);
    });

    it('returns false for glass drinks container at 330ml', () => {
      expect(isDRSExcluded(true, 330, 'glass')).toBe(false);
    });
  });

  describe('size outside DRS range', () => {
    it('returns false for over 3L', () => {
      expect(isDRSExcluded(true, 3001, 'aluminium')).toBe(false);
    });

    it('returns false for 5000ml', () => {
      expect(isDRSExcluded(true, 5000, 'plastic_rigid')).toBe(false);
    });

    it('returns false for under 150ml', () => {
      expect(isDRSExcluded(true, 149, 'aluminium')).toBe(false);
    });

    it('returns false for 50ml mini can', () => {
      expect(isDRSExcluded(true, 50, 'aluminium')).toBe(false);
    });
  });

  describe('not a drinks container', () => {
    it('returns false when isDrinksContainer is false', () => {
      expect(isDRSExcluded(false, 500, 'aluminium')).toBe(false);
    });
  });

  describe('null/undefined unit size', () => {
    it('returns false when unitSizeML is null', () => {
      expect(isDRSExcluded(true, null, 'aluminium')).toBe(false);
    });

    it('returns false when unitSizeML is undefined', () => {
      expect(isDRSExcluded(true, undefined, 'aluminium')).toBe(false);
    });
  });

  describe('non-DRS materials', () => {
    it('returns false for paper_cardboard', () => {
      expect(isDRSExcluded(true, 500, 'paper_cardboard')).toBe(false);
    });

    it('returns false for wood', () => {
      expect(isDRSExcluded(true, 500, 'wood')).toBe(false);
    });

    it('returns false for plastic_flexible', () => {
      expect(isDRSExcluded(true, 500, 'plastic_flexible')).toBe(false);
    });

    it('returns false for fibre_composite', () => {
      expect(isDRSExcluded(true, 500, 'fibre_composite')).toBe(false);
    });

    it('returns false for other', () => {
      expect(isDRSExcluded(true, 500, 'other')).toBe(false);
    });
  });
});

// =============================================================================
// isGlassDrinksContainer
// =============================================================================

describe('isGlassDrinksContainer', () => {
  it('returns true for glass drinks container', () => {
    expect(isGlassDrinksContainer(true, 'glass')).toBe(true);
  });

  it('returns false for glass non-drinks container', () => {
    expect(isGlassDrinksContainer(false, 'glass')).toBe(false);
  });

  it('returns false for aluminium drinks container', () => {
    expect(isGlassDrinksContainer(true, 'aluminium')).toBe(false);
  });

  it('returns false for plastic_rigid drinks container', () => {
    expect(isGlassDrinksContainer(true, 'plastic_rigid')).toBe(false);
  });

  it('returns false for steel drinks container', () => {
    expect(isGlassDrinksContainer(true, 'steel')).toBe(false);
  });
});

// =============================================================================
// isAggregatedDrinksContainer
// =============================================================================

describe('isAggregatedDrinksContainer', () => {
  it('returns true for aluminium drinks container', () => {
    expect(isAggregatedDrinksContainer(true, 'aluminium')).toBe(true);
  });

  it('returns true for plastic_rigid drinks container', () => {
    expect(isAggregatedDrinksContainer(true, 'plastic_rigid')).toBe(true);
  });

  it('returns true for steel drinks container', () => {
    expect(isAggregatedDrinksContainer(true, 'steel')).toBe(true);
  });

  it('returns false for glass drinks container (glass is separate, not aggregated)', () => {
    expect(isAggregatedDrinksContainer(true, 'glass')).toBe(false);
  });

  it('returns false for aluminium non-drinks container', () => {
    expect(isAggregatedDrinksContainer(false, 'aluminium')).toBe(false);
  });

  it('returns false for paper_cardboard drinks container', () => {
    expect(isAggregatedDrinksContainer(true, 'paper_cardboard')).toBe(false);
  });

  it('returns false for plastic_flexible drinks container', () => {
    expect(isAggregatedDrinksContainer(true, 'plastic_flexible')).toBe(false);
  });
});

// =============================================================================
// extractComponentWeights
// =============================================================================

describe('extractComponentWeights', () => {
  it('extracts glass component', () => {
    const result = extractComponentWeights({ component_glass_weight: 350 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      material_type: 'glass',
      rpd_material_code: 'GL',
      component_name: 'Glass',
      weight_grams: 350,
    });
  });

  it('extracts aluminium component', () => {
    const result = extractComponentWeights({ component_aluminium_weight: 15 });
    expect(result).toHaveLength(1);
    expect(result[0].material_type).toBe('aluminium');
    expect(result[0].rpd_material_code).toBe('AL');
    expect(result[0].weight_grams).toBe(15);
  });

  it('extracts steel component', () => {
    const result = extractComponentWeights({ component_steel_weight: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].material_type).toBe('steel');
    expect(result[0].rpd_material_code).toBe('ST');
  });

  it('extracts paper component', () => {
    const result = extractComponentWeights({ component_paper_weight: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].material_type).toBe('paper_cardboard');
    expect(result[0].rpd_material_code).toBe('PC');
  });

  it('extracts wood component', () => {
    const result = extractComponentWeights({ component_wood_weight: 20 });
    expect(result).toHaveLength(1);
    expect(result[0].material_type).toBe('wood');
    expect(result[0].rpd_material_code).toBe('WD');
  });

  it('extracts other component', () => {
    const result = extractComponentWeights({ component_other_weight: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].material_type).toBe('other');
    expect(result[0].rpd_material_code).toBe('OT');
  });

  it('extracts multiple components', () => {
    const result = extractComponentWeights({
      component_glass_weight: 350,
      component_aluminium_weight: 5,
      component_paper_weight: 2,
    });
    expect(result).toHaveLength(3);
  });

  it('returns empty array when all components are null', () => {
    const result = extractComponentWeights({
      component_glass_weight: null,
      component_aluminium_weight: null,
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when all components are zero', () => {
    const result = extractComponentWeights({
      component_glass_weight: 0,
      component_aluminium_weight: 0,
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const result = extractComponentWeights({});
    expect(result).toHaveLength(0);
  });

  it('skips negative weight components', () => {
    // Negative values are falsy-ish but actually truthy in JS; however the code checks > 0
    // Actually -5 is truthy but fails the > 0 check in the source code:
    // The source checks `material.component_glass_weight && material.component_glass_weight > 0`
    // -5 is truthy, but -5 > 0 is false
    const result = extractComponentWeights({ component_glass_weight: -5 });
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// processContainerComponents
// =============================================================================

describe('processContainerComponents', () => {
  describe('no components (single item)', () => {
    it('returns single item with container material when no components exist', () => {
      const result = processContainerComponents(true, 'glass', [], 350);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        material_type: 'glass',
        rpd_material_code: 'GL',
        component_name: 'Container',
        weight_grams: 350,
      });
    });

    it('returns single item with aluminium material when no components', () => {
      const result = processContainerComponents(true, 'aluminium', [], 15);
      expect(result).toHaveLength(1);
      expect(result[0].material_type).toBe('aluminium');
      expect(result[0].rpd_material_code).toBe('AL');
      expect(result[0].weight_grams).toBe(15);
    });
  });

  describe('glass drinks container — separate lines', () => {
    it('returns each component as a separate line', () => {
      const components: ComponentWeight[] = [
        { material_type: 'glass', rpd_material_code: 'GL', component_name: 'Glass', weight_grams: 350 },
        { material_type: 'aluminium', rpd_material_code: 'AL', component_name: 'Aluminium', weight_grams: 5 },
        { material_type: 'paper_cardboard', rpd_material_code: 'PC', component_name: 'Paper/Card', weight_grams: 2 },
      ];

      const result = processContainerComponents(true, 'glass', components, 357);
      expect(result).toHaveLength(3);
      expect(result[0].material_type).toBe('glass');
      expect(result[0].weight_grams).toBe(350);
      expect(result[1].material_type).toBe('aluminium');
      expect(result[1].weight_grams).toBe(5);
      expect(result[2].material_type).toBe('paper_cardboard');
      expect(result[2].weight_grams).toBe(2);
    });
  });

  describe('aluminium drinks container — aggregated', () => {
    it('sums all component weights into a single aluminium line', () => {
      const components: ComponentWeight[] = [
        { material_type: 'aluminium', rpd_material_code: 'AL', component_name: 'Aluminium', weight_grams: 13 },
        { material_type: 'plastic_rigid', rpd_material_code: 'PL', component_name: 'Plastic', weight_grams: 1 },
        { material_type: 'paper_cardboard', rpd_material_code: 'PC', component_name: 'Paper/Card', weight_grams: 1 },
      ];

      const result = processContainerComponents(true, 'aluminium', components, 15);
      expect(result).toHaveLength(1);
      expect(result[0].material_type).toBe('aluminium');
      expect(result[0].rpd_material_code).toBe('AL');
      expect(result[0].component_name).toBe('Container (aggregated)');
      expect(result[0].weight_grams).toBe(15); // 13 + 1 + 1
    });
  });

  describe('plastic_rigid drinks container — aggregated', () => {
    it('aggregates all components under plastic_rigid material', () => {
      const components: ComponentWeight[] = [
        { material_type: 'plastic_rigid', rpd_material_code: 'PL', component_name: 'PET', weight_grams: 25 },
        { material_type: 'paper_cardboard', rpd_material_code: 'PC', component_name: 'Label', weight_grams: 2 },
      ];

      const result = processContainerComponents(true, 'plastic_rigid', components, 27);
      expect(result).toHaveLength(1);
      expect(result[0].material_type).toBe('plastic_rigid');
      expect(result[0].rpd_material_code).toBe('PL');
      expect(result[0].weight_grams).toBe(27);
    });
  });

  describe('steel drinks container — aggregated', () => {
    it('aggregates all components under steel material', () => {
      const components: ComponentWeight[] = [
        { material_type: 'steel', rpd_material_code: 'ST', component_name: 'Steel', weight_grams: 50 },
        { material_type: 'other', rpd_material_code: 'OT', component_name: 'Gasket', weight_grams: 3 },
      ];

      const result = processContainerComponents(true, 'steel', components, 53);
      expect(result).toHaveLength(1);
      expect(result[0].material_type).toBe('steel');
      expect(result[0].weight_grams).toBe(53);
    });
  });

  describe('non-drinks container with components', () => {
    it('returns separate lines per component (same as glass drinks)', () => {
      const components: ComponentWeight[] = [
        { material_type: 'paper_cardboard', rpd_material_code: 'PC', component_name: 'Paper/Card', weight_grams: 100 },
        { material_type: 'plastic_flexible', rpd_material_code: 'PL', component_name: 'Plastic', weight_grams: 5 },
      ];

      const result = processContainerComponents(false, 'paper_cardboard', components, 105);
      expect(result).toHaveLength(2);
      expect(result[0].material_type).toBe('paper_cardboard');
      expect(result[1].material_type).toBe('plastic_flexible');
    });
  });
});
