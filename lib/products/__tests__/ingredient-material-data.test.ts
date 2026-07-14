import { describe, expect, it } from 'vitest';
import { buildIngredientMaterialData } from '../ingredient-material-data';
import type { IngredientFormData } from '@/components/products/IngredientFormCard';

function form(overrides: Partial<IngredientFormData>): IngredientFormData {
  return {
    tempId: 'temp-1',
    name: 'Grape juice',
    amount: '2',
    unit: 'l',
    ...overrides,
  } as IngredientFormData;
}

describe('buildIngredientMaterialData', () => {
  it('persists self-grown farm links when the ingredient is self-grown', () => {
    const row = buildIngredientMaterialData(
      form({ is_self_grown: true, vineyard_id: 'vin-uuid', arable_field_id: null, orchard_id: null }),
      '12',
    );
    // Regression guard: these were silently dropped on save.
    expect(row.is_self_grown).toBe(true);
    expect(row.vineyard_id).toBe('vin-uuid');
    expect(row.product_id).toBe(12);
  });

  it('clears farm links when the ingredient is not self-grown', () => {
    const row = buildIngredientMaterialData(
      form({ is_self_grown: false, vineyard_id: 'vin-uuid', orchard_id: 'orch-uuid' }),
      '12',
    );
    expect(row.is_self_grown).toBe(false);
    expect(row.vineyard_id).toBeNull();
    expect(row.orchard_id).toBeNull();
  });

  it('persists the biogenic-carbon flag', () => {
    expect(buildIngredientMaterialData(form({ is_biogenic_carbon: true }), '12').is_biogenic_carbon).toBe(true);
    expect(buildIngredientMaterialData(form({}), '12').is_biogenic_carbon).toBe(false);
  });

  it('persists inbound-container fields and honours the reuse-cycles >= 1 constraint', () => {
    const row = buildIngredientMaterialData(
      form({
        inbound_container_type: 'ibc',
        inbound_container_volume_l: 1000,
        inbound_container_tare_kg: 60,
        inbound_container_reuse_cycles: 25,
        inbound_container_ef: 0.5,
        inbound_container_material: 'hdpe',
      }),
      '12',
    );
    expect(row.inbound_container_type).toBe('ibc');
    expect(row.inbound_container_volume_l).toBe(1000);
    expect(row.inbound_container_tare_kg).toBe(60);
    expect(row.inbound_container_reuse_cycles).toBe(25);
    expect(row.inbound_container_ef).toBe(0.5);
    expect(row.inbound_container_material).toBe('hdpe');

    // reuse_cycles < 1 must become null (CHECK constraint is >= 1 OR NULL).
    const zero = buildIngredientMaterialData(form({ inbound_container_reuse_cycles: 0 }), '12');
    expect(zero.inbound_container_reuse_cycles).toBeNull();
  });

  it('persists multi-leg transport and mirrors the first leg to mode/distance', () => {
    const row = buildIngredientMaterialData(
      form({ transport_legs: [{ transportMode: 'sea', distanceKm: 8000 }, { transportMode: 'truck', distanceKm: 200 }] as any }),
      '12',
    );
    expect(row.transport_legs).toHaveLength(2);
    expect(row.transport_mode).toBe('sea');
    expect(row.distance_km).toBe(8000);
  });

  it('nulls conditional columns by default so an UPDATE clears stale values', () => {
    const row = buildIngredientMaterialData(form({}), '12');
    for (const k of [
      'data_source', 'transport_legs', 'transport_mode', 'distance_km',
      'vineyard_id', 'arable_field_id', 'orchard_id', 'inbound_container_type',
    ]) {
      expect(row[k]).toBeNull();
    }
  });
});
