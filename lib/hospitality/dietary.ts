/**
 * Controlled vocabularies for dietary labels and allergens on hospitality
 * recipes. Shown as chips on the recipe editor and the public QR menu. Allergens
 * follow the 14 UK/EU FIC declarable allergens.
 */

export const DIETARY_TAGS = [
  'vegan',
  'vegetarian',
  'pescatarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

export const ALLERGENS = [
  'celery',
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
] as const
export type Allergen = (typeof ALLERGENS)[number]

const DIETARY_LABELS: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  pescatarian: 'Pescatarian',
  halal: 'Halal',
  kosher: 'Kosher',
  gluten_free: 'Gluten free',
  dairy_free: 'Dairy free',
}

export function dietaryLabel(tag: string): string {
  return DIETARY_LABELS[tag] ?? tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function allergenLabel(a: string): string {
  return a.replace(/\b\w/g, (c) => c.toUpperCase())
}

const DIETARY_SET = new Set<string>(DIETARY_TAGS)
const ALLERGEN_SET = new Set<string>(ALLERGENS)

/** Keep only recognised values, de-duplicated, preserving vocabulary order. */
export function sanitiseDietaryTags(values: unknown): string[] {
  const set = new Set((Array.isArray(values) ? values : []).map((v) => String(v)))
  return DIETARY_TAGS.filter((t) => set.has(t))
}
export function sanitiseAllergens(values: unknown): string[] {
  const set = new Set((Array.isArray(values) ? values : []).map((v) => String(v)))
  return ALLERGENS.filter((a) => set.has(a))
}

export { DIETARY_SET, ALLERGEN_SET }
