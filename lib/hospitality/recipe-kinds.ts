/**
 * Recipe kinds for the hospitality module.
 *
 * Meals and made-drinks are mechanically identical — both are `products` rows
 * (with a `hospitality_meal_meta` row) whose ingredients are computed by the
 * shared LCA engine. They differ only in labels and the `product_kind`
 * discriminator, so a single recipe service/UI handles both, keyed by this map.
 */

export type RecipeKind = 'meal' | 'drink' | 'room_night'

export interface RecipeKindConfig {
  kind: RecipeKind
  /** products.product_kind value. */
  productKind: 'hospitality_meal' | 'hospitality_drink' | 'hospitality_room_night'
  /** Display label, singular / plural. */
  label: string
  labelPlural: string
  /** products.product_category seed value. */
  productCategory: string
  /** Per-portion noun (a meal serves "covers", a drink "serves"). */
  portionWord: string
  /** Whole-recipe noun ("recipe" / "batch"). */
  batchWord: string
  /** Default portion count seeded in the create dialog (meals are usually written for 4). */
  defaultCovers: number
  /** UI base path and API base path. */
  basePath: string
  apiBase: string
}

export const RECIPE_KINDS: Record<RecipeKind, RecipeKindConfig> = {
  meal: {
    kind: 'meal',
    productKind: 'hospitality_meal',
    label: 'Meal',
    labelPlural: 'Meals',
    productCategory: 'Food',
    portionWord: 'cover',
    batchWord: 'recipe',
    defaultCovers: 4,
    basePath: '/hospitality/meals',
    apiBase: '/api/hospitality/meals',
  },
  drink: {
    kind: 'drink',
    productKind: 'hospitality_drink',
    label: 'Drink',
    labelPlural: 'Drinks',
    productCategory: 'Beverage',
    portionWord: 'serve',
    batchWord: 'batch',
    defaultCovers: 1,
    basePath: '/hospitality/drinks',
    apiBase: '/api/hospitality/drinks',
  },
  room_night: {
    kind: 'room_night',
    productKind: 'hospitality_room_night',
    label: 'Room',
    labelPlural: 'Rooms',
    productCategory: 'Accommodation',
    portionWord: 'night',
    batchWord: 'room night',
    defaultCovers: 1,
    basePath: '/hospitality/rooms',
    apiBase: '/api/hospitality/rooms',
  },
}

export const PRODUCT_KIND_BY_RECIPE: Record<RecipeKind, string> = {
  meal: RECIPE_KINDS.meal.productKind,
  drink: RECIPE_KINDS.drink.productKind,
  room_night: RECIPE_KINDS.room_night.productKind,
}

/** Resolve a products.product_kind value back to its recipe kind config. */
export const RECIPE_KIND_BY_PRODUCT_KIND: Record<string, RecipeKind> = {
  hospitality_meal: 'meal',
  hospitality_drink: 'drink',
  hospitality_room_night: 'room_night',
}
