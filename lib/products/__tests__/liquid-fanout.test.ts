import { describe, it, expect, vi } from 'vitest';
import {
  rowsForProduct,
  fanOutLiquidRecipe,
  describeFanout,
  type FanoutStore,
} from '../liquid-fanout';

/**
 * L1's exit criterion: correcting one ingredient in a liquid updates every
 * format's rows without another click.
 *
 * The rule that protects the user: their own edit is already saved before any
 * of this runs, so a sibling that fails must never present as "your recipe did
 * not save".
 */

function makeStore(siblings: number[]): { store: FanoutStore; writes: Map<number, any[]>; recalcs: number[] } {
  const writes = new Map<number, any[]>();
  const recalcs: number[] = [];
  const store: FanoutStore = {
    siblingsOf: vi.fn(async () => siblings),
    replaceIngredients: vi.fn(async (productId, rows) => {
      writes.set(productId, rows);
    }),
    requestRecalc: vi.fn(async (productId) => {
      recalcs.push(productId);
    }),
  };
  return { store, writes, recalcs };
}

const ROWS = [
  { id: 101, tempId: 'temp-1', product_id: 1, material_name: 'Juniper berries', quantity: 12 },
  { id: 102, product_id: 1, material_name: 'Coriander seed', quantity: 6 },
];

describe('rowsForProduct', () => {
  it('re-points rows at the target product', () => {
    const rows = rowsForProduct(ROWS, 7);
    expect(rows.every((r) => r.product_id === 7)).toBe(true);
    expect(rows.map((r) => r.material_name)).toEqual(['Juniper berries', 'Coriander seed']);
  });

  it('drops the source row ids', () => {
    // Carrying `id` across would update the source product's own row instead
    // of inserting one for the sibling.
    const rows = rowsForProduct(ROWS, 7);
    expect(rows.every((r) => !('id' in r))).toBe(true);
    expect(rows.every((r) => !('tempId' in r))).toBe(true);
  });

  it('keeps every other field intact', () => {
    expect(rowsForProduct([{ id: 1, product_id: 1, cached_co2_factor: 0.42 }], 7)[0]).toEqual({
      product_id: 7,
      cached_co2_factor: 0.42,
    });
  });
});

describe('fanOutLiquidRecipe', () => {
  it('does nothing when the product has no liquid', async () => {
    const { store } = makeStore([2, 3]);
    const result = await fanOutLiquidRecipe(store, null, 1, ROWS);
    expect(result).toEqual({ updated: [], failed: [] });
    expect(store.siblingsOf).not.toHaveBeenCalled();
  });

  it('does nothing when the liquid has only one product', async () => {
    // The 1:1 state every product starts in after the backfill: nothing
    // anyone sees changes on day one.
    const { store } = makeStore([]);
    const result = await fanOutLiquidRecipe(store, 'liq-1', 1, ROWS);
    expect(result.updated).toEqual([]);
    expect(store.replaceIngredients).not.toHaveBeenCalled();
  });

  it('writes the recipe to every sibling and asks for a recalc', async () => {
    const { store, writes, recalcs } = makeStore([2, 3]);
    const result = await fanOutLiquidRecipe(store, 'liq-1', 1, ROWS);

    expect(result.updated).toEqual([2, 3]);
    expect(result.failed).toEqual([]);
    expect(writes.get(2)?.every((r: any) => r.product_id === 2)).toBe(true);
    expect(writes.get(3)?.every((r: any) => r.product_id === 3)).toBe(true);
    expect(recalcs).toEqual([2, 3]);
    // Never rewrites the product the user was editing; it is already saved.
    expect(writes.has(1)).toBe(false);
  });

  it('carries on when one sibling fails, and reports it', async () => {
    const { store } = makeStore([2, 3, 4]);
    (store.replaceIngredients as any).mockImplementation(async (productId: number) => {
      if (productId === 3) throw new Error('constraint violation');
    });

    const result = await fanOutLiquidRecipe(store, 'liq-1', 1, ROWS);
    expect(result.updated).toEqual([2, 4]);
    expect(result.failed).toEqual([{ productId: 3, message: 'constraint violation' }]);
  });

  it('counts a sibling as updated even if its recalc request fails', async () => {
    // A stale footprint is recoverable; a lost recipe is not.
    const { store } = makeStore([2]);
    (store.requestRecalc as any).mockRejectedValue(new Error('inngest down'));
    const result = await fanOutLiquidRecipe(store, 'liq-1', 1, ROWS);
    expect(result.updated).toEqual([2]);
    expect(result.failed).toEqual([]);
  });
});

describe('describeFanout', () => {
  it('says nothing when nothing else was touched', () => {
    expect(describeFanout({ updated: [], failed: [] })).toBeNull();
  });

  it('reports a clean fan-out, since a silent rewrite of other products would be a surprise', () => {
    expect(describeFanout({ updated: [2], failed: [] })).toBe(
      'Also updated 1 other product made from this liquid.'
    );
    expect(describeFanout({ updated: [2, 3], failed: [] })).toBe(
      'Also updated 2 other products made from this liquid.'
    );
  });

  it('is honest when siblings failed', () => {
    expect(describeFanout({ updated: [], failed: [{ productId: 3, message: 'x' }] })).toBe(
      'This product saved, but 1 other product made from this liquid could not be updated.'
    );
    expect(
      describeFanout({ updated: [2], failed: [{ productId: 3, message: 'x' }] })
    ).toBe('Updated 1 other product made from this liquid; 1 could not be updated.');
  });
});
