import { describe, it, expect } from 'vitest';
import {
  liquidRecipeFingerprint,
  findIdenticalLiquids,
  suggestLiquidSurvivor,
  type LiquidLike,
} from '../liquid-identity';

/**
 * Identical-liquid detection is propose-only, and a recipe IS the product, so
 * the bias runs hard against false positives. Missing a pair costs the user a
 * merge they can still make by hand; proposing a wrong one invites them to
 * collapse two different drinks into one.
 */

function liquid(over: Partial<LiquidLike> = {}): LiquidLike {
  return {
    id: 'l1',
    name: 'House Gin',
    recipe_scale_mode: 'per_unit',
    productCount: 1,
    lines: [
      { material_name: 'Juniper berries', quantity: 12, unit: 'g' },
      { material_name: 'Coriander seed', quantity: 6, unit: 'g' },
    ],
    ...over,
  };
}

describe('liquidRecipeFingerprint', () => {
  it('ignores the order the ingredients were entered in', () => {
    const a = liquid();
    const b = liquid({ lines: [...liquid().lines].reverse() });
    expect(liquidRecipeFingerprint(a)).toBe(liquidRecipeFingerprint(b));
  });

  it('ignores name casing and plural form', () => {
    const a = liquid();
    const b = liquid({
      lines: [
        { material_name: 'juniper berry', quantity: 12, unit: 'g' },
        { material_name: 'CORIANDER SEEDS', quantity: 6, unit: 'g' },
      ],
    });
    expect(liquidRecipeFingerprint(a)).toBe(liquidRecipeFingerprint(b));
  });

  it('treats a numeric string and a number as the same amount', () => {
    const b = liquid({
      lines: [
        { material_name: 'Juniper berries', quantity: '12', unit: 'g' },
        { material_name: 'Coriander seed', quantity: '6', unit: 'g' },
      ],
    });
    expect(liquidRecipeFingerprint(liquid())).toBe(liquidRecipeFingerprint(b));
  });

  it('separates recipes that differ in any amount', () => {
    const b = liquid({
      lines: [
        { material_name: 'Juniper berries', quantity: 14, unit: 'g' },
        { material_name: 'Coriander seed', quantity: 6, unit: 'g' },
      ],
    });
    expect(liquidRecipeFingerprint(liquid())).not.toBe(liquidRecipeFingerprint(b));
  });

  it('separates recipes that differ by an ingredient', () => {
    const b = liquid({
      lines: [...liquid().lines, { material_name: 'Angelica root', quantity: 3, unit: 'g' }],
    });
    expect(liquidRecipeFingerprint(liquid())).not.toBe(liquidRecipeFingerprint(b));
  });

  it('does not convert units, since a wrong density would merge two drinks', () => {
    // 12 g and 0.012 kg are the same amount, but treating them as the same
    // recipe means guessing a density for every volume unit.
    const b = liquid({
      lines: [
        { material_name: 'Juniper berries', quantity: 0.012, unit: 'kg' },
        { material_name: 'Coriander seed', quantity: 0.006, unit: 'kg' },
      ],
    });
    expect(liquidRecipeFingerprint(liquid())).not.toBe(liquidRecipeFingerprint(b));
  });

  it('separates the same lines measured at different batch scales', () => {
    const perUnit = liquid({ recipe_scale_mode: 'per_unit' });
    const perBatch = liquid({
      recipe_scale_mode: 'per_batch',
      batch_yield_value: 3500,
      batch_yield_unit: 'L',
    });
    expect(liquidRecipeFingerprint(perUnit)).not.toBe(liquidRecipeFingerprint(perBatch));
  });

  it('separates batches with different yields', () => {
    const a = liquid({ recipe_scale_mode: 'per_batch', batch_yield_value: 3500, batch_yield_unit: 'L' });
    const b = liquid({ recipe_scale_mode: 'per_batch', batch_yield_value: 1000, batch_yield_unit: 'L' });
    expect(liquidRecipeFingerprint(a)).not.toBe(liquidRecipeFingerprint(b));
  });

  it('is empty for a liquid with no recipe', () => {
    expect(liquidRecipeFingerprint(liquid({ lines: [] }))).toBe('');
  });
});

describe('findIdenticalLiquids', () => {
  it('finds the case the 1:1 migration creates: one gin, two formats', () => {
    const groups = findIdenticalLiquids([
      liquid({ id: 'l1', name: 'House Gin 700ml' }),
      liquid({ id: 'l2', name: 'House Gin 50ml' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(['l1', 'l2']);
    expect(groups[0].productCount).toBe(2);
  });

  it('proposes nothing when the recipes genuinely differ', () => {
    const groups = findIdenticalLiquids([
      liquid({ id: 'l1' }),
      liquid({
        id: 'l2',
        lines: [{ material_name: 'Juniper berries', quantity: 20, unit: 'g' }],
      }),
    ]);
    expect(groups).toEqual([]);
  });

  it('never groups liquids that have no recipe yet', () => {
    // An empty shelf is not evidence that two drinks are the same.
    expect(
      findIdenticalLiquids([
        liquid({ id: 'l1', lines: [] }),
        liquid({ id: 'l2', lines: [] }),
      ])
    ).toEqual([]);
  });

  it('puts the biggest group first', () => {
    const groups = findIdenticalLiquids([
      liquid({ id: 'a1' }),
      liquid({ id: 'a2' }),
      liquid({ id: 'a3' }),
      liquid({ id: 'b1', lines: [{ material_name: 'Malt', quantity: 5, unit: 'kg' }] }),
      liquid({ id: 'b2', lines: [{ material_name: 'Malt', quantity: 5, unit: 'kg' }] }),
    ]);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[1].members).toHaveLength(2);
  });
});

describe('suggestLiquidSurvivor', () => {
  it('keeps the liquid already bottled by the most products', () => {
    const group = findIdenticalLiquids([
      liquid({ id: 'few', name: 'Gin B', productCount: 1 }),
      liquid({ id: 'many', name: 'Gin A', productCount: 4 }),
    ])[0];
    expect(suggestLiquidSurvivor(group).id).toBe('many');
  });

  it('breaks a tie by name, so the suggestion is stable', () => {
    const group = findIdenticalLiquids([
      liquid({ id: 'z', name: 'Zephyr Gin', productCount: 1 }),
      liquid({ id: 'a', name: 'Alpha Gin', productCount: 1 }),
    ])[0];
    expect(suggestLiquidSurvivor(group).id).toBe('a');
  });
});
