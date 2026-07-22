/**
 * Pointing a product at a liquid it is not currently made from.
 *
 * The "same liquid, different pack" case: a producer who already makes a gin
 * adds a 50ml of it and should not retype the recipe. Switching adopts the
 * target liquid's recipe, and from then on the two products stay in step
 * through the fan-out.
 *
 * Extracted from `LiquidStrip` so the ordering rules below are testable. They
 * matter more than they look: this is one of the few operations in the
 * authoring layer that destroys a saved recipe, so it has to be impossible for
 * a half-failure to leave a product with neither its old recipe nor its new
 * one.
 */

export interface SwitchLiquidStore {
  /** A product already bottling the target liquid, to copy the recipe from. */
  donorFor(liquidId: string, excludingProductId: number): Promise<number | null>;
  /** The donor's ingredient rows. */
  ingredientRows(productId: number): Promise<Record<string, unknown>[]>;
  /** Replace a product's ingredient rows with these. */
  replaceIngredients(productId: number, rows: Record<string, unknown>[]): Promise<void>;
  /** Point the product at the liquid. */
  setLiquid(productId: number, liquidId: string): Promise<void>;
}

export interface SwitchLiquidResult {
  /** True when the target liquid had a recipe to adopt. */
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
 * Adopt a liquid, and its recipe if it has one.
 *
 * Order is deliberate. The donor's rows are read BEFORE this product's are
 * cleared, so a failed read leaves the existing recipe untouched, and the link
 * is set LAST, so a product is never pointing at a liquid whose recipe it does
 * not yet hold. A failure at any step leaves a state the user can retry from.
 *
 * A liquid with no products yet is a valid target: the user is choosing to
 * make this product from a liquid they are about to write the recipe for, and
 * nothing is cleared in that case.
 */
export async function switchProductLiquid(
  store: SwitchLiquidStore,
  productId: number,
  targetLiquidId: string
): Promise<SwitchLiquidResult> {
  const donorId = await store.donorFor(targetLiquidId, productId);

  if (donorId === null) {
    // No recipe to adopt. Link only, and leave this product's own rows alone:
    // clearing them would destroy a recipe and put nothing in its place.
    await store.setLiquid(productId, targetLiquidId);
    return { adoptedRecipe: false, rowsCopied: 0 };
  }

  const donorRows = await store.ingredientRows(donorId);
  await store.replaceIngredients(productId, recipeRowsFor(donorRows, productId));
  await store.setLiquid(productId, targetLiquidId);

  return { adoptedRecipe: true, rowsCopied: donorRows.length };
}
