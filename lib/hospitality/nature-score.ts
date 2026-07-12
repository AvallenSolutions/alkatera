/**
 * Lightweight nature/commodity risk + plant-forward scoring for hospitality
 * recipes, derived from ingredient names (no external data, no migration).
 *
 * Deliberately simple keyword matching: a recipe with high-risk commodities
 * (beef, soy, palm, non-certified cocoa/coffee, wild seafood) reads high risk;
 * a plant-forward recipe scores well. This is a directional signal for chefs,
 * not a certified footprint — the carbon PCF remains the quantitative measure.
 */

export type NatureRisk = 'low' | 'medium' | 'high'

interface CommodityRule {
  /** Lower-cased keywords that identify the commodity in an ingredient name. */
  keywords: string[]
  risk: NatureRisk
  /** Whether the commodity is plant-based (for the plant-forward score). */
  plant: boolean
  /** Short reason shown to the user. */
  note: string
}

// Order matters: earlier, more specific rules win.
const COMMODITY_RULES: CommodityRule[] = [
  { keywords: ['beef', 'steak', 'veal', 'ox '], risk: 'high', plant: false, note: 'Beef/veal — high land + methane' },
  { keywords: ['lamb', 'mutton', 'goat'], risk: 'high', plant: false, note: 'Lamb/mutton — high land + methane' },
  { keywords: ['palm oil', 'palm'], risk: 'high', plant: true, note: 'Palm oil — deforestation risk' },
  { keywords: ['soy', 'soya', 'tofu', 'tempeh', 'edamame'], risk: 'medium', plant: true, note: 'Soy — deforestation risk unless certified' },
  { keywords: ['prawn', 'shrimp', 'langoustine'], risk: 'high', plant: false, note: 'Prawns — high-impact aquaculture/wild catch' },
  { keywords: ['tuna', 'swordfish', 'eel', 'cod', 'haddock', 'seabass', 'sea bass'], risk: 'high', plant: false, note: 'Wild fish — stock/bycatch risk unless MSC' },
  { keywords: ['salmon', 'trout', 'mackerel', 'sardine', 'herring', 'fish'], risk: 'medium', plant: false, note: 'Fish — moderate, better if certified' },
  { keywords: ['cheese', 'butter', 'cream', 'milk', 'yoghurt', 'yogurt', 'dairy'], risk: 'medium', plant: false, note: 'Dairy — moderate land + methane' },
  { keywords: ['pork', 'bacon', 'ham', 'sausage', 'chorizo'], risk: 'medium', plant: false, note: 'Pork — moderate impact' },
  { keywords: ['chicken', 'poultry', 'turkey', 'duck'], risk: 'medium', plant: false, note: 'Poultry — lower than red meat' },
  { keywords: ['cocoa', 'chocolate'], risk: 'medium', plant: true, note: 'Cocoa — deforestation risk unless certified' },
  { keywords: ['coffee'], risk: 'medium', plant: true, note: 'Coffee — deforestation/water risk unless certified' },
  { keywords: ['egg'], risk: 'low', plant: false, note: 'Eggs — relatively low impact' },
  { keywords: ['rice'], risk: 'medium', plant: true, note: 'Rice — methane from paddies' },
  { keywords: ['almond', 'cashew', 'nut'], risk: 'medium', plant: true, note: 'Tree nuts — water intensive' },
  { keywords: ['avocado'], risk: 'medium', plant: true, note: 'Avocado — water/land intensive' },
]

const CERTIFICATION_HINTS = ['certified', 'organic', 'msc', 'asc', 'rainforest', 'fairtrade', 'rspca', 'free range', 'free-range']

export interface IngredientNatureRating {
  name: string
  risk: NatureRisk
  plant: boolean
  note: string
}

export interface RecipeNatureScore {
  risk_level: NatureRisk
  /** Share of classified ingredients that are plant-based, 0-100. */
  plant_forward_pct: number
  /** Ingredients contributing high risk, for a "hot-spot" list. */
  high_risk: IngredientNatureRating[]
  ratings: IngredientNatureRating[]
}

const RISK_ORDER: Record<NatureRisk, number> = { low: 0, medium: 1, high: 2 }

function classifyIngredient(rawName: string): IngredientNatureRating {
  const name = rawName.toLowerCase()
  const certified = CERTIFICATION_HINTS.some((h) => name.includes(h))
  for (const rule of COMMODITY_RULES) {
    if (rule.keywords.some((k) => name.includes(k))) {
      // Certification knocks a high-risk commodity down one band.
      const risk: NatureRisk = certified && rule.risk === 'high' ? 'medium' : certified && rule.risk === 'medium' ? 'low' : rule.risk
      return { name: rawName, risk, plant: rule.plant, note: certified ? `${rule.note} (certified)` : rule.note }
    }
  }
  // Unmatched ingredients are treated as low-risk plants (fruit, veg, grains, herbs).
  return { name: rawName, risk: 'low', plant: true, note: 'Plant/other — low risk' }
}

export function scoreRecipeNature(ingredientNames: string[]): RecipeNatureScore {
  const names = ingredientNames.map((n) => String(n ?? '').trim()).filter(Boolean)
  if (names.length === 0) {
    return { risk_level: 'low', plant_forward_pct: 100, high_risk: [], ratings: [] }
  }
  const ratings = names.map(classifyIngredient)
  const risk_level = ratings.reduce<NatureRisk>((worst, r) => (RISK_ORDER[r.risk] > RISK_ORDER[worst] ? r.risk : worst), 'low')
  const plantCount = ratings.filter((r) => r.plant).length
  const plant_forward_pct = Math.round((plantCount / ratings.length) * 100)
  const high_risk = ratings.filter((r) => r.risk === 'high')
  return { risk_level, plant_forward_pct, high_risk, ratings }
}
