import { describe, it, expect } from 'vitest';
import {
  checkMissingFields,
  assessDataCompleteness,
  isSubmissionReady,
} from '@/lib/epr/validation';

// =============================================================================
// Helpers — packaging item fixture
// =============================================================================

function makePackagingItem(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    product_id: 100,
    product_name: 'Test Lager',
    material_name: 'Glass Bottle',
    packaging_category: 'container' as string,
    net_weight_g: 350,
    epr_packaging_activity: 'brand',
    epr_packaging_level: 'primary',
    epr_uk_nation: 'england',
    epr_ram_rating: 'green',
    epr_is_household: true,
    epr_is_drinks_container: true,
    epr_material_type: 'glass',
    ...overrides,
  };
}

// =============================================================================
// checkMissingFields
// =============================================================================

describe('checkMissingFields', () => {
  describe('container packaging', () => {
    it('returns empty array for a complete container item', () => {
      const item = makePackagingItem();
      expect(checkMissingFields(item)).toHaveLength(0);
    });

    it('reports missing activity', () => {
      const item = makePackagingItem({ epr_packaging_activity: null });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Packaging Activity');
    });

    it('reports missing activity when empty string', () => {
      const item = makePackagingItem({ epr_packaging_activity: '' });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Packaging Activity');
    });

    it('reports missing nation', () => {
      const item = makePackagingItem({ epr_uk_nation: null });
      const missing = checkMissingFields(item);
      expect(missing).toContain('UK Nation');
    });

    it('reports missing weight (null)', () => {
      const item = makePackagingItem({ net_weight_g: null });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Net Weight');
    });

    it('reports missing weight (zero)', () => {
      const item = makePackagingItem({ net_weight_g: 0 });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Net Weight');
    });

    it('reports missing household flag for container', () => {
      const item = makePackagingItem({ epr_is_household: null });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Household/Non-household');
    });

    it('reports missing drinks_container flag for container', () => {
      const item = makePackagingItem({ epr_is_drinks_container: null });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Drinks Container flag');
    });

    it('reports all five required fields when all are missing', () => {
      const item = makePackagingItem({
        epr_packaging_activity: null,
        epr_uk_nation: null,
        net_weight_g: null,
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Packaging Activity');
      expect(missing).toContain('UK Nation');
      expect(missing).toContain('Net Weight');
      expect(missing).toContain('Household/Non-household');
      expect(missing).toContain('Drinks Container flag');
    });

    it('does not report household as missing when set to false', () => {
      const item = makePackagingItem({ epr_is_household: false });
      const missing = checkMissingFields(item);
      expect(missing).not.toContain('Household/Non-household');
    });

    it('does not report drinks_container as missing when set to false', () => {
      const item = makePackagingItem({ epr_is_drinks_container: false });
      const missing = checkMissingFields(item);
      expect(missing).not.toContain('Drinks Container flag');
    });
  });

  describe('label packaging', () => {
    it('requires household flag but NOT drinks_container flag', () => {
      const item = makePackagingItem({
        packaging_category: 'label',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Household/Non-household');
      expect(missing).not.toContain('Drinks Container flag');
    });

    it('returns empty for a complete label item', () => {
      const item = makePackagingItem({
        packaging_category: 'label',
        epr_is_household: true,
        epr_is_drinks_container: null, // Not required for label
      });
      const missing = checkMissingFields(item);
      expect(missing).toHaveLength(0);
    });
  });

  describe('closure packaging', () => {
    it('requires household flag but NOT drinks_container flag', () => {
      const item = makePackagingItem({
        packaging_category: 'closure',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).toContain('Household/Non-household');
      expect(missing).not.toContain('Drinks Container flag');
    });
  });

  describe('secondary packaging', () => {
    it('does not require household flag', () => {
      const item = makePackagingItem({
        packaging_category: 'secondary',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).not.toContain('Household/Non-household');
      expect(missing).not.toContain('Drinks Container flag');
    });

    it('returns empty for complete secondary item with only always-required fields', () => {
      const item = makePackagingItem({
        packaging_category: 'secondary',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).toHaveLength(0);
    });
  });

  describe('shipment packaging', () => {
    it('does not require household or drinks_container flags', () => {
      const item = makePackagingItem({
        packaging_category: 'shipment',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).not.toContain('Household/Non-household');
      expect(missing).not.toContain('Drinks Container flag');
    });
  });

  describe('tertiary packaging', () => {
    it('does not require household or drinks_container flags', () => {
      const item = makePackagingItem({
        packaging_category: 'tertiary',
        epr_is_household: null,
        epr_is_drinks_container: null,
      });
      const missing = checkMissingFields(item);
      expect(missing).not.toContain('Household/Non-household');
      expect(missing).not.toContain('Drinks Container flag');
    });
  });
});

// =============================================================================
// assessDataCompleteness
// =============================================================================

describe('assessDataCompleteness', () => {
  it('returns 100% completeness for all complete items', () => {
    const items = [makePackagingItem(), makePackagingItem({ id: 2 })];
    const result = assessDataCompleteness(items);
    expect(result.total_packaging_items).toBe(2);
    expect(result.complete_items).toBe(2);
    expect(result.incomplete_items).toBe(0);
    expect(result.completeness_pct).toBe(100);
    expect(result.gaps).toHaveLength(0);
  });

  it('returns correct counts with a mix of complete and incomplete items', () => {
    const items = [
      makePackagingItem(),
      makePackagingItem({ id: 2, epr_packaging_activity: null }),
      makePackagingItem({ id: 3, net_weight_g: null }),
    ];
    const result = assessDataCompleteness(items);
    expect(result.total_packaging_items).toBe(3);
    expect(result.complete_items).toBe(1);
    expect(result.incomplete_items).toBe(2);
    expect(result.completeness_pct).toBe(33); // Math.round(1/3 * 100) = 33
    expect(result.gaps).toHaveLength(2);
  });

  it('returns 0% completeness when all items are incomplete', () => {
    const items = [
      makePackagingItem({ id: 1, epr_packaging_activity: null }),
      makePackagingItem({ id: 2, epr_uk_nation: null }),
    ];
    const result = assessDataCompleteness(items);
    expect(result.complete_items).toBe(0);
    expect(result.incomplete_items).toBe(2);
    expect(result.completeness_pct).toBe(0);
  });

  it('returns 100% for empty items array', () => {
    const result = assessDataCompleteness([]);
    expect(result.total_packaging_items).toBe(0);
    expect(result.completeness_pct).toBe(100);
    expect(result.gaps).toHaveLength(0);
  });

  it('populates gap entries with correct product details', () => {
    const items = [
      makePackagingItem({
        id: 5,
        product_id: 42,
        product_name: 'Pale Ale',
        material_name: 'Aluminium Can',
        packaging_category: 'container',
        epr_packaging_activity: null,
      }),
    ];
    const result = assessDataCompleteness(items);
    expect(result.gaps).toHaveLength(1);
    const gap = result.gaps[0];
    expect(gap.product_id).toBe(42);
    expect(gap.product_name).toBe('Pale Ale');
    expect(gap.product_material_id).toBe(5);
    expect(gap.material_name).toBe('Aluminium Can');
    expect(gap.packaging_category).toBe('container');
    expect(gap.missing_fields).toContain('Packaging Activity');
  });

  it('uses fallback product name when product_name is empty', () => {
    const items = [
      makePackagingItem({
        id: 1,
        product_id: 99,
        product_name: undefined,
        epr_packaging_activity: null,
      }),
    ];
    const result = assessDataCompleteness(items);
    expect(result.gaps[0].product_name).toBe('Product #99');
  });
});

// =============================================================================
// isSubmissionReady
// =============================================================================

describe('isSubmissionReady', () => {
  it('returns true when all items are complete', () => {
    const items = [
      makePackagingItem(),
      makePackagingItem({ id: 2 }),
    ];
    expect(isSubmissionReady(items)).toBe(true);
  });

  it('returns false when any item is incomplete', () => {
    const items = [
      makePackagingItem(),
      makePackagingItem({ id: 2, epr_packaging_activity: null }),
    ];
    expect(isSubmissionReady(items)).toBe(false);
  });

  it('returns true for empty items array', () => {
    expect(isSubmissionReady([])).toBe(true);
  });

  it('returns false when all items are incomplete', () => {
    const items = [
      makePackagingItem({ id: 1, epr_uk_nation: null }),
      makePackagingItem({ id: 2, net_weight_g: 0 }),
    ];
    expect(isSubmissionReady(items)).toBe(false);
  });
});
