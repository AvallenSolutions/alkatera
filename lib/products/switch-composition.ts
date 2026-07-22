/**
 * Pointing a product at a composition it is not currently using.
 *
 * Serves both halves. The "same liquid, different pack" case: a producer who
 * already makes a gin adds a 50ml and should not retype the recipe. And its
 * mirror, "same bottle, different liquid": a second spirit in the same 700ml
 * flint bottle should not need the glass weighed again. Switching adopts the
 * target's rows, and from then on the products stay in step through the
 * fan-out.
 *
 * Extracted from `LiquidStrip` so the ordering rules below are testable. They
 * matter more than they look: this is one of the few operations in the
 * authoring layer that destroys a saved recipe, so it has to be impossible for
 * a half-failure to leave a product with neither its old recipe nor its new
 * one.
 */

export interface SwitchCompositionStore {
  /** A product already using the target, to copy its rows from. */
  donorFor(compositionId: string, excludingProductId: number): Promise<number | null>;
  /** The donor's rows for this composition's material type. */
  ingredientRows(productId: number): Promise<Record<string, unknown>[]>;
  /** Replace a product's rows of that material type with these. */
  replaceIngredients(productId: number, rows: Record<string, unknown>[]): Promise<void>;
  /** Point the product at the composition. */
  setLiquid(productId: number, compositionId: string): Promise<void>;
}

export interface SwitchCompositionResult {
  /** True when the target had rows to adopt. */
  adoptedRecipe: boolean;
  rowsCopied: number;
}

/**
 * Strip the columns that belong to the donor's own row rather than to the
 * recipe: the primary key and the timestamps. Carrying the id across would
 * update the donor's row instead of inserting one for this product.
 */
export function recipeRowsFor(
  rows: Record<string, unknown>[],
  productId: number
): Record<string, unknown>[] {
  return rows.map((row) => {
    const { id: _id, created_at: _created, updated_at: _updated, ...rest } = row;
    return { ...rest, product_id: productId };
  });
}

/**
 * Adopt a composition, and its rows if it has any.
 *
 * Order is deliberate. The donor's rows are read BEFORE this product's are
 * cleared, so a failed read leaves the existing recipe untouched, and the link
 * is set LAST, so a product is never pointing at a liquid whose recipe it does
 * not yet hold. A failure at any step leaves a state the user can retry from.
 *
 * A composition with no products yet is a valid target: the user is choosing
 * one they are about to specify, and nothing is cleared in that case.
 */
export async function switchProductComposition(
  store: SwitchCompositionStore,
  productId: number,
  targetCompositionId: string
): Promise<SwitchCompositionResult> {
  const donorId = await store.donorFor(targetCompositionId, productId);

  if (donorId === null) {
    // Nothing to adopt. Link only, and leave this product's own rows alone:
    // clearing them would destroy a specification and put nothing in its place.
    await store.setLiquid(productId, targetCompositionId);
    return { adoptedRecipe: false, rowsCopied: 0 };
  }

  const donorRows = await store.ingredientRows(donorId);
  await store.replaceIngredients(productId, recipeRowsFor(donorRows, productId));
  await store.setLiquid(productId, targetCompositionId);

  return { adoptedRecipe: true, rowsCopied: donorRows.length };
}
