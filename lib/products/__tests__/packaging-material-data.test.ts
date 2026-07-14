/**
 * buildPackagingMaterialData regression tests.
 *
 * Focus: the fields the review found were silently lost or collapsed on save
 * (0% recycled content, epr_material_type, circularity fields).
 */

import { describe, it, expect } from 'vitest';
import { buildPackagingMaterialData } from '../packaging-material-data';

// Minimal packaging form factory; only the fields under test matter, the rest
// are given harmless defaults matching the form's shape.
function form(overrides: Record<string, any> = {}) {
  return {
    tempId: 'temp-pkg-1',
    name: 'Glass Bottle 500ml',
    data_source: null,
    amount: '',
    unit: 'g',
    packaging_category: 'container',
    recycled_content_percentage: '',
    printing_process: '',
    net_weight_g: 400,
    origin_country: '',
    transport_mode: 'truck',
    distance_km: '',
    has_component_breakdown: false,
    components: [],
    epr_is_household: true,
    epr_is_drinks_container: false,
    units_per_group: '',
    ...overrides,
  } as any;
}

describe('buildPackagingMaterialData — recycled content round-trip', () => {
  it('preserves an explicit 0% (declared zero, not unknown)', () => {
    const row = buildPackagingMaterialData(form({ recycled_content_percentage: 0 }), '1');
    expect(row.recycled_content_percentage).toBe(0);
  });

  it('stores a real percentage', () => {
    const row = buildPackagingMaterialData(form({ recycled_content_percentage: 30 }), '1');
    expect(row.recycled_content_percentage).toBe(30);
  });

  it('treats blank/unknown as null', () => {
    expect(buildPackagingMaterialData(form({ recycled_content_percentage: '' }), '1').recycled_content_percentage).toBeNull();
    expect(buildPackagingMaterialData(form({ recycled_content_percentage: null }), '1').recycled_content_percentage).toBeNull();
  });
});

describe('buildPackagingMaterialData — epr_material_type derivation', () => {
  it('derives glass from the material name', () => {
    const row = buildPackagingMaterialData(form({ name: 'Glass Bottle 500ml' }), '1');
    expect(row.epr_material_type).toBe('glass');
  });

  it('derives aluminium for a plain drinks can', () => {
    const row = buildPackagingMaterialData(form({ name: '330ml Can', packaging_category: 'container' }), '1');
    expect(row.epr_material_type).toBe('aluminium');
  });

  it('honours an explicit override', () => {
    const row = buildPackagingMaterialData(form({ name: 'Mystery wrap', epr_material_type: 'plastic_flexible' }), '1');
    expect(row.epr_material_type).toBe('plastic_flexible');
  });

  it('uses container_material when the name carries no material word', () => {
    const row = buildPackagingMaterialData(form({ name: 'Keg', container_material: 'steel' }), '1');
    expect(row.epr_material_type).toBe('steel');
  });
});
