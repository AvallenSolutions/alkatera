/**
 * Fanning a liquid's recipe out to every product that bottles it.
 *
 * This is L1's exit criterion from tasks/liquid-and-pack-plan.md: correcting
 * one ingredient in a liquid updates every format's rows and footprints
 * without another click. A distillery with a 700ml and a 50ml of the same gin
 * corrects the malt origin once.
 *
 * `product_materials` remains the calculator's contract. The liquid is an
 * authoring-layer entity that WRITES those rows; nothing about how they are
 * read changes, which is what makes this safe to ship against a sacred
 * calculator.
 */

/** A material row as the editor builds it, before it is given a product. */
export type MaterialRow = Record<string, unknown>;

export interface FanoutTargets {
  /** The product the user was actually editing. Already written; never rewritten here. */
  sourceProductId: number;
  /** Every other product sharing the liquid. */
  siblingProductIds: number[];
}

export interface FanoutStore {
  /** Products sharing this liquid, excluding the one being edited. */
  siblingsOf(liquidId: string, sourceProductId: number): Promise<number[]>;
  /** Replace a product's ingredient rows with these. */
  replaceIngredients(productId: number, rows: MaterialRow[]): Promise<void>;
  /** Ask for a recalculation of a product's footprint. */
  requestRecalc(productId: number): Promise<void>;
}

/**
 * Re-point a set of built material rows at another product.
 *
 * Ids must be dropped, not carried: `id` belongs to the source product's row
 * and reusing it would update that row instead of inserting a sibling's. The
 * same applies to any `tempId` the form attached.
 */
export function rowsForProduct(rows: MaterialRow[], productId: number): MaterialRow[] {
  return rows.map((row) => {
    const { id: _id, tempId: _tempId, ...rest } = row as Record<string, unknown>;
    return { ...rest, product_id: productId };
  });
}

export interface FanoutResult {
  /** Products whose rows were rewritten. */
  updated: number[];
  /** Products whose rewrite failed; the edit still stands on the source product. */
  failed: { productId: number; message: string }[];
}

/**
 * Write the liquid's rows to every sibling product and ask for their
 * footprints to be recalculated.
 *
 * Deliberately non-fatal per sibling: the user's own edit has already been
 * saved by the time this runs, so one failing sibling must not present as
 * "your recipe did not save". Failures are returned for the caller to report
 * honestly rather than swallowed.
 */
export async function fanOutLiquidRecipe(
  store: FanoutStore,
  liquidId: string | null | undefined,
  sourceProductId: number,
  rows: MaterialRow[]
): Promise<FanoutResult> {
  const result: FanoutResult = { updated: [], failed: [] };
  if (!liquidId) return result;

  const siblings = await store.siblingsOf(liquidId, sourceProductId);
  if (siblings.length === 0) return result;

  for (const productId of siblings) {
    try {
      await store.replaceIngredients(productId, rowsForProduct(rows, productId));
      result.updated.push(productId);
      // The recalc is requested after the rows land, and its failure does not
      // undo them: a stale footprint is recoverable, a lost recipe is not.
      try {
        await store.requestRecalc(productId);
      } catch (err) {
        console.error('[liquid fanout] recalc request failed for product', productId, err);
      }
    } catch (err: any) {
      result.failed.push({ productId, message: err?.message ?? 'Unknown error' });
    }
  }

  return result;
}

/**
 * How to tell the user what just happened, in the studio's voice.
 *
 * Silence would be wrong: a recipe edit that quietly rewrote three other
 * products is exactly the kind of surprise the propagation decision was
 * supposed to be explicit about.
 */
export function describeFanout(result: FanoutResult): string | null {
  const { updated, failed } = result;
  if (updated.length === 0 && failed.length === 0) return null;

  if (failed.length === 0) {
    return `Also updated ${updated.length} other product${updated.length === 1 ? '' : 's'} made from this liquid.`;
  }
  if (updated.length === 0) {
    return `This product saved, but ${failed.length} other product${failed.length === 1 ? '' : 's'} made from this liquid could not be updated.`;
  }
  return `Updated ${updated.length} other product${updated.length === 1 ? '' : 's'} made from this liquid; ${failed.length} could not be updated.`;
}
