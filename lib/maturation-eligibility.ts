/**
 * Single source of truth for "can this product plausibly be barrel-aged?".
 *
 * The recipe editor's Maturation tab and the LCA calculator previously used
 * two different rules (a broad category regex vs a narrow product_type set),
 * so a user could see the tab, fill in a profile, and have the persisted LCA
 * silently drop it. Both now call this predicate with everything they know
 * about the product.
 */
export const MATURATION_STYLE_PATTERN =
  /whisk|whiskey|rum|brandy|cognac|armagnac|calvados|wine|port|sherry|madeira|mead|tequila|mezcal|barrel|cask|aged|spirit/i;

export function isMaturationEligibleProduct(input: {
  productType?: string | null;
  category?: string | null;
}): boolean {
  const haystack = [input.productType, input.category].filter(Boolean).join(' ');
  if (!haystack) return false;
  return MATURATION_STYLE_PATTERN.test(haystack);
}
