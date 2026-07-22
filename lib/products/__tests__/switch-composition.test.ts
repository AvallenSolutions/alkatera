import { describe, it, expect, vi } from 'vitest';
import {
  recipeRowsFor,
  switchProductComposition,
  type SwitchCompositionStore,
} from '../switch-composition';

/**
 * Switching a product onto another liquid is one of the few authoring
 * operations that destroys a saved recipe, so the ordering rules are the
 * point: read the donor before clearing, link last, and never clear when
 * there is nothing to put in place.
 */

function makeStore(over: Partial<SwitchCompositionStore> = {}) {
  const calls: string[] = [];
  const store: SwitchCompositionStore = {
    donorFor: vi.fn(async () => {
      calls.push('donorFor');
      return 12;
    }),
    ingredientRows: vi.fn(async () => {
      calls.push('ingredientRows');
      return [
        { id: 1, product_id: 12, material_name: 'Juniper berries', quantity: 12, created_at: 'x' },
        { id: 2, product_id: 12, material_name: 'Coriander seed', quantity: 6, updated_at: 'y' },
      ];
    }),
    replaceIngredients: vi.fn(async () => {
      calls.push('replaceIngredients');
    }),
    setLiquid: vi.fn(async () => {
      calls.push('setLiquid');
    }),
    ...over,
  };
  return { store, calls };
}

describe('recipeRowsFor', () => {
  it('re-points rows and drops the donor row identity', () => {
    const rows = recipeRowsFor(
      [{ id: 1, product_id: 12, material_name: 'Juniper', created_at: 'x', updated_at: 'y' }],
      29
    );
    expect(rows).toEqual([{ product_id: 29, material_name: 'Juniper' }]);
  });

  it('keeps everything that is part of the recipe', () => {
    const rows = recipeRowsFor(
      [{ id: 1, product_id: 12, quantity: 12, unit: 'g', material_id: 'ing-1', cached_co2_factor: 1.2 }],
      29
    );
    expect(rows[0]).toEqual({
      product_id: 29,
      quantity: 12,
      unit: 'g',
      material_id: 'ing-1',
      cached_co2_factor: 1.2,
    });
  });
});

describe('switchProductComposition', () => {
  it('adopts the target liquid’s recipe', async () => {
    const { store } = makeStore();
    const result = await switchProductComposition(store, 29, 'liq-1');

    expect(result).toEqual({ adoptedRecipe: true, rowsCopied: 2 });
    expect(store.replaceIngredients).toHaveBeenCalledWith(29, [
      { product_id: 29, material_name: 'Juniper berries', quantity: 12 },
      { product_id: 29, material_name: 'Coriander seed', quantity: 6 },
    ]);
    expect(store.setLiquid).toHaveBeenCalledWith(29, 'liq-1');
  });

  it('reads the donor before clearing, and links last', async () => {
    // A failed read must leave the existing recipe untouched, and a product
    // must never point at a liquid whose recipe it does not yet hold.
    const { store, calls } = makeStore();
    await switchProductComposition(store, 29, 'liq-1');
    expect(calls).toEqual(['donorFor', 'ingredientRows', 'replaceIngredients', 'setLiquid']);
  });

  it('leaves the existing recipe alone when the donor cannot be read', async () => {
    const { store } = makeStore({
      ingredientRows: vi.fn(async () => {
        throw new Error('network');
      }),
    });
    await expect(switchProductComposition(store, 29, 'liq-1')).rejects.toThrow('network');
    expect(store.replaceIngredients).not.toHaveBeenCalled();
    expect(store.setLiquid).not.toHaveBeenCalled();
  });

  it('does not link when the rows could not be written', async () => {
    const { store } = makeStore({
      replaceIngredients: vi.fn(async () => {
        throw new Error('constraint');
      }),
    });
    await expect(switchProductComposition(store, 29, 'liq-1')).rejects.toThrow('constraint');
    expect(store.setLiquid).not.toHaveBeenCalled();
  });

  it('links without clearing when the target liquid has no recipe yet', async () => {
    // Choosing a liquid you are about to write the recipe for is valid, and
    // must not destroy the recipe this product already has.
    const { store } = makeStore({ donorFor: vi.fn(async () => null) });
    const result = await switchProductComposition(store, 29, 'liq-empty');

    expect(result).toEqual({ adoptedRecipe: false, rowsCopied: 0 });
    expect(store.replaceIngredients).not.toHaveBeenCalled();
    expect(store.setLiquid).toHaveBeenCalledWith(29, 'liq-empty');
  });
});
