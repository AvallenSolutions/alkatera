// Which products take part in the liquid-and-pack composition model.
//
// `products` is shared with hospitality, which stores meals, drinks, menus and
// room nights in the same table under `product_kind`. The composition model is
// about what goes in a bottle, a can or a keg: a meal is not a liquid, and a
// room night is emphatically not one.
//
// This was learnt the hard way. The L1 backfill gave a liquid to every product
// with a recipe, so the cellar's liquid shelf filled with puddings and hotel
// rooms, and two room nights ended up SHARING one liquid — meaning a correction
// to one would have silently rewritten the other's inputs through the fan-out.
//
// Hospitality has its own surfaces under /hospitality and its own editors. If a
// hospitality recipe should ever be owned once and shared across menus, that is
// a hospitality decision made on its own terms, not a by-product of the cellar.

/** The only `product_kind` the composition model applies to. */
export const COMPOSABLE_PRODUCT_KIND = 'product';

/** True when a product is one the cellar composes from a liquid and a pack. */
export function isComposableKind(productKind: string | null | undefined): boolean {
  // The column is NOT NULL DEFAULT 'product'; the nullish case is only for
  // partially-selected rows in the client.
  return (productKind ?? COMPOSABLE_PRODUCT_KIND) === COMPOSABLE_PRODUCT_KIND;
}
