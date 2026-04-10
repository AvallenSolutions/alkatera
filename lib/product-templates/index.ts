/**
 * Industry Starter Templates
 *
 * Pre-built product profiles for common drink types, used in the Fast Track
 * onboarding to let users start with a realistic baseline rather than a blank slate.
 *
 * Benchmark values (kg CO₂e per litre) are sourced from published industry studies
 * matching those in lib/industry-benchmarks.ts.
 */

export interface ProductTemplate {
  id: string
  name: string
  description: string
  /** Emoji icon for display in template picker */
  icon: string
  category: string
  subcategory: string
  unit_size_value: number
  unit_size_unit: 'ml' | 'cl' | 'l'
  abv: number | null
  /** kg CO₂e per litre (lifecycle benchmark) */
  benchmark_co2e_per_litre: number
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // Beer & Cider
  {
    id: 'craft-lager-can',
    name: 'Craft Lager 330ml Can',
    description: 'A light, refreshing lager in a 330ml aluminium can. Typical recipe: malted barley, hops, water, and yeast.',
    icon: '🍺',
    category: 'Beer & Cider',
    subcategory: 'Lager',
    unit_size_value: 330,
    unit_size_unit: 'ml',
    abv: 4.5,
    benchmark_co2e_per_litre: 0.85,
  },
  {
    id: 'craft-lager-bottle',
    name: 'Craft Lager 500ml Bottle',
    description: 'A premium lager in a 500ml glass bottle. Clean, crisp, and balanced.',
    icon: '🍺',
    category: 'Beer & Cider',
    subcategory: 'Lager',
    unit_size_value: 500,
    unit_size_unit: 'ml',
    abv: 4.5,
    benchmark_co2e_per_litre: 0.90,
  },
  {
    id: 'ipa-can',
    name: 'IPA 440ml Can',
    description: 'A hop-forward India Pale Ale in a 440ml can. Aromatic, bitter, and full of citrus character.',
    icon: '🍻',
    category: 'Beer & Cider',
    subcategory: 'IPA',
    unit_size_value: 440,
    unit_size_unit: 'ml',
    abv: 5.5,
    benchmark_co2e_per_litre: 0.95,
  },
  {
    id: 'cider-bottle',
    name: 'Still Cider 500ml Bottle',
    description: 'A traditional still cider made from pressed apples in a 500ml glass bottle.',
    icon: '🍏',
    category: 'Beer & Cider',
    subcategory: 'Cider',
    unit_size_value: 500,
    unit_size_unit: 'ml',
    abv: 5.0,
    benchmark_co2e_per_litre: 0.80,
  },
  // Spirits
  {
    id: 'gin-bottle',
    name: 'London Dry Gin 70cl',
    description: 'A classic London Dry Gin distilled with juniper, coriander, and citrus botanicals. 70cl glass bottle.',
    icon: '🍸',
    category: 'Spirits',
    subcategory: 'Gin',
    unit_size_value: 700,
    unit_size_unit: 'ml',
    abv: 40,
    benchmark_co2e_per_litre: 3.2,
  },
  {
    id: 'whisky-bottle',
    name: 'Single Malt Whisky 70cl',
    description: 'A single malt Scotch whisky aged in oak casks. Complex, rich, and smooth. 70cl glass bottle.',
    icon: '🥃',
    category: 'Spirits',
    subcategory: 'Whisky',
    unit_size_value: 700,
    unit_size_unit: 'ml',
    abv: 40,
    benchmark_co2e_per_litre: 3.8,
  },
  {
    id: 'vodka-bottle',
    name: 'Vodka 70cl',
    description: 'A clean, neutral vodka distilled for purity and smoothness. 70cl glass bottle.',
    icon: '🍸',
    category: 'Spirits',
    subcategory: 'Vodka',
    unit_size_value: 700,
    unit_size_unit: 'ml',
    abv: 40,
    benchmark_co2e_per_litre: 2.8,
  },
  {
    id: 'rum-bottle',
    name: 'Rum 70cl',
    description: 'A Caribbean-style rum with notes of molasses and tropical fruit. 70cl glass bottle.',
    icon: '🍹',
    category: 'Spirits',
    subcategory: 'Rum',
    unit_size_value: 700,
    unit_size_unit: 'ml',
    abv: 40,
    benchmark_co2e_per_litre: 2.6,
  },
  // Wine
  {
    id: 'red-wine-bottle',
    name: 'Red Wine 75cl',
    description: 'A full-bodied red wine with ripe fruit and smooth tannins. 75cl glass bottle.',
    icon: '🍷',
    category: 'Wine',
    subcategory: 'Red Wine',
    unit_size_value: 750,
    unit_size_unit: 'ml',
    abv: 13,
    benchmark_co2e_per_litre: 1.6,
  },
  {
    id: 'white-wine-bottle',
    name: 'White Wine 75cl',
    description: 'A crisp, refreshing white wine with citrus and stone fruit notes. 75cl glass bottle.',
    icon: '🥂',
    category: 'Wine',
    subcategory: 'White Wine',
    unit_size_value: 750,
    unit_size_unit: 'ml',
    abv: 12.5,
    benchmark_co2e_per_litre: 1.5,
  },
  {
    id: 'sparkling-wine-bottle',
    name: 'Sparkling Wine 75cl',
    description: 'An elegant sparkling wine made using the traditional method. Celebratory and fresh. 75cl glass bottle.',
    icon: '🍾',
    category: 'Wine',
    subcategory: 'Sparkling Wine',
    unit_size_value: 750,
    unit_size_unit: 'ml',
    abv: 12,
    benchmark_co2e_per_litre: 2.0,
  },
  // RTD
  {
    id: 'hard-seltzer-can',
    name: 'Hard Seltzer 330ml Can',
    description: 'A light, sparkling alcoholic seltzer with natural fruit flavour. Low calorie and refreshing.',
    icon: '🫧',
    category: 'Ready-to-Drink & Cocktails',
    subcategory: 'Hard Seltzer',
    unit_size_value: 330,
    unit_size_unit: 'ml',
    abv: 4.5,
    benchmark_co2e_per_litre: 0.55,
  },
]

/** Filter templates by beverage type string (from BeverageType) */
export function getTemplatesForBeverageType(beverageType: string): ProductTemplate[] {
  const MAP: Record<string, string> = {
    beer: 'Beer & Cider',
    cider: 'Beer & Cider',
    spirits: 'Spirits',
    wine: 'Wine',
    rtd: 'Ready-to-Drink & Cocktails',
    non_alcoholic: 'Non-Alcoholic',
  }
  const category = MAP[beverageType.toLowerCase()]
  if (!category) return PRODUCT_TEMPLATES
  return PRODUCT_TEMPLATES.filter(t => t.category === category)
}

/** Get a single template by ID */
export function getTemplateById(id: string): ProductTemplate | undefined {
  return PRODUCT_TEMPLATES.find(t => t.id === id)
}
