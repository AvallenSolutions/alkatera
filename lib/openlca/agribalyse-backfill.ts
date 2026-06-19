/**
 * Agribalyse food-factor backfill.
 *
 * Populates `staging_emission_factors` (category 'Ingredient', global) with
 * cradle-to-gate factors for common restaurant food commodities, calculated
 * from the Agribalyse v3.2 database via the shared OpenLCA client. Once present,
 * the impact-waterfall resolver matches meal/drink ingredients to these factors
 * by name, so hospitality meals get real numbers instead of failing to resolve.
 *
 * Reuses the shared OpenLCA client (`createOpenLCAClientForDatabase('agribalyse')`)
 * and `calculateProcess` (this gdt-server build has no `create-system` endpoint).
 * Process selection is food-specific (`selectFoodProcess`): it prefers the raw,
 * aggregated CIQUAL supply-chain processes ("Beef, rib, raw, processed in FR |
 * … at distribution {FR} U") via per-query priority and word-boundary matching.
 *
 * Designed to run in the background (Inngest) and is fully idempotent — each
 * target is delete-then-inserted by name, so re-running refreshes values.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createOpenLCAClientForDatabase,
  type OpenLCAClient,
} from './client'
import { isFoodPackagingSystemName } from './drinks-process-filter'

/**
 * Pre-filter the full Agribalyse process list to plausible food commodities.
 *
 * NOTE: we deliberately do NOT reuse `filterAgribalyseProcesses` — that one is
 * drinks-scoped and explicitly EXCLUDES meat/fish/bread/pasta, which we need
 * here. Instead we drop the obvious noise ([Dummy] placeholders and
 * food-specific packaging systems) and let `searchAgribalyseWithAliases`'s
 * scorer (which heavily penalises sub-processes and boosts the food item) pick
 * the best match.
 */
export function filterFoodProcesses(allProcesses: any[]): any[] {
  return allProcesses.filter((p) => {
    const name = (p.name || '').toLowerCase()
    if (!name) return false
    if (name.includes('[dummy]')) return false
    if (isFoodPackagingSystemName(p.name)) return false
    return true
  })
}

/** ReCiPe 2016 Midpoint (H) — matches the live calculator's impact method. */
const IMPACT_METHOD = 'ReCiPe 2016 Midpoint (H)'

export interface BackfillTarget {
  /** Stored factor name (what recipe ingredients match against). */
  name: string
  /** Search queries tried in order against Agribalyse process names. */
  searchQueries: string[]
  targetGrade: 'HIGH' | 'MEDIUM'
  pedigree: {
    reliability: number
    completeness: number
    temporal: number
    geographical: number
    technological: number
  }
}

// Standard pedigree for an Agribalyse French commodity (1=best, 5=worst).
const STD_HIGH = { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 }
const STD_MED = { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 }

/**
 * Common restaurant food commodities. Names are the canonical ingredient terms
 * recipes are entered under; the resolver's keyword fallback handles variants
 * (e.g. "beef mince" → "Beef"). Search queries are English (Agribalyse CIQUAL
 * processes are English-named on this server).
 */
export const HOSPITALITY_FOOD_TARGETS: BackfillTarget[] = [
  // Meat & poultry
  { name: 'Beef', searchQueries: ['beef, raw', 'beef, ', 'beef meat'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Beef mince', searchQueries: ['beef, minced', 'minced beef', 'ground beef'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Chicken', searchQueries: ['chicken breast', 'chicken meat', 'chicken muscle'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Pork', searchQueries: ['pork meat', 'pork muscle', 'pork'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Lamb', searchQueries: ['lamb meat', 'lamb muscle', 'lamb'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Bacon', searchQueries: ['bacon'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Turkey', searchQueries: ['turkey meat', 'turkey muscle', 'turkey'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Fish & seafood
  { name: 'Salmon', searchQueries: ['salmon, farmed', 'salmon, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Cod', searchQueries: ['cod fillet', 'cod'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Tuna', searchQueries: ['tuna'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Prawns', searchQueries: ['shrimp', 'prawn'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Dairy, eggs & fats
  { name: 'Egg', searchQueries: ['egg, ', 'whole egg', 'egg'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Butter', searchQueries: ['butter, unsalted', 'butter, salted', 'butter, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cheese', searchQueries: ['cheese, ', 'emmental', 'cheese'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Milk', searchQueries: ['whole milk', 'cow milk', 'milk, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cream', searchQueries: ['cream, ', 'dairy cream'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Yoghurt', searchQueries: ['yoghurt', 'yogurt'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Olive oil', searchQueries: ['olive oil'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Sunflower oil', searchQueries: ['sunflower oil'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Rapeseed oil', searchQueries: ['rapeseed oil', 'colza oil'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  // Vegetables
  { name: 'Potato', searchQueries: ['potato, ', 'potato'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Onion', searchQueries: ['onion, ', 'onion'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Carrot', searchQueries: ['carrot, ', 'carrot'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Tomato', searchQueries: ['tomato, ', 'tomato'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Garlic', searchQueries: ['garlic, consumption', 'garlic clove'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mushroom', searchQueries: ['mushroom'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Spinach', searchQueries: ['spinach'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Lettuce', searchQueries: ['lettuce'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Bell pepper', searchQueries: ['sweet pepper', 'bell pepper, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Courgette', searchQueries: ['courgette', 'zucchini'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Broccoli', searchQueries: ['broccoli'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Peas', searchQueries: ['green pea', 'pea, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Fruit
  { name: 'Lemon', searchQueries: ['lemon, pulp', 'lemon, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Apple', searchQueries: ['apple, ', 'apple'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Banana', searchQueries: ['banana'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Staples & legumes
  { name: 'Wheat flour', searchQueries: ['wheat flour'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Pasta', searchQueries: ['pasta, ', 'dry pasta', 'pasta'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Rice', searchQueries: ['rice, ', 'white rice', 'rice'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Bread', searchQueries: ['baguette', 'bread, french'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Sugar', searchQueries: ['sugar, white', 'white sugar'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Chickpeas', searchQueries: ['chickpea'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Lentils', searchQueries: ['lentil, dried', 'lentil, '], targetGrade: 'MEDIUM', pedigree: STD_MED },

  // ── Expanded pantry (curated against Agribalyse CIQUAL process names) ──
  // More meat & poultry
  { name: 'Duck', searchQueries: ['duck, ', 'duck meat'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Veal', searchQueries: ['veal, ', 'veal chop'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Sausage', searchQueries: ['sausage meat', 'pork sausage'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Ham', searchQueries: ['cured ham, raw', 'pork ham, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More fish & seafood
  { name: 'Sea bass', searchQueries: ['sea bass'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mackerel', searchQueries: ['mackerel, raw', 'mackerel'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Haddock', searchQueries: ['haddock, raw', 'haddock'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Sardine', searchQueries: ['sardine, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mussels', searchQueries: ['mussel, common', 'mussel, raw'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Squid', searchQueries: ['squid, raw', 'squid'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Scallop', searchQueries: ['scallop, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Crab', searchQueries: ['crab, ', 'crab meat'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Trout', searchQueries: ['trout, ', 'trout'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More vegetables
  { name: 'Aubergine', searchQueries: ['eggplant, raw', 'aubergine'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cucumber', searchQueries: ['cucumber, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Celery', searchQueries: ['celery stalk', 'celery'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Leek', searchQueries: ['leek, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cabbage', searchQueries: ['green cabbage', 'cabbage, raw'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cauliflower', searchQueries: ['cauliflower'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Green beans', searchQueries: ['french bean', 'green bean'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Sweetcorn', searchQueries: ['corn or maize grain', 'sweet corn'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Beetroot', searchQueries: ['beetroot'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Pumpkin', searchQueries: ['pumpkin'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Butternut squash', searchQueries: ['squash, all types', 'butternut'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Asparagus', searchQueries: ['asparagus'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Kale', searchQueries: ['curly kale', 'kale'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Sweet potato', searchQueries: ['sweet potato'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Shallot', searchQueries: ['shallot'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Spring onion', searchQueries: ['spring onion'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Fennel', searchQueries: ['fennel'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Parsnip', searchQueries: ['parsnip'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More fruit
  { name: 'Orange', searchQueries: ['orange, pulp', 'orange, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Strawberry', searchQueries: ['strawberry, raw', 'strawberry'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Raspberry', searchQueries: ['raspberry'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Blueberry', searchQueries: ['blueberry'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Pear', searchQueries: ['pear, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Grape', searchQueries: ['grape, raw', 'grape, '], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Pineapple', searchQueries: ['pineapple'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mango', searchQueries: ['mango'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Peach', searchQueries: ['peach'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cherry', searchQueries: ['cherry'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Avocado', searchQueries: ['avocado'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Lime', searchQueries: ['lime, pulp', 'lime'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Herbs & spices
  { name: 'Basil', searchQueries: ['basil'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Parsley', searchQueries: ['parsley'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Coriander', searchQueries: ['coriander'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Thyme', searchQueries: ['thyme'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Rosemary', searchQueries: ['rosemary'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mint', searchQueries: ['mint, fresh', 'mint, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Ginger', searchQueries: ['ginger, raw', 'ginger'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Black pepper', searchQueries: ['black pepper'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Cinnamon', searchQueries: ['cinnamon'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Cumin', searchQueries: ['cumin'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Paprika', searchQueries: ['paprika'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Salt', searchQueries: ['salt, white', 'salt, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More grains & staples
  { name: 'Quinoa', searchQueries: ['quinoa'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Oats', searchQueries: ['oats, ', 'oat, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Polenta', searchQueries: ['polenta', 'maize semolina'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Noodles', searchQueries: ['rice noodle', 'noodle'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Barley', searchQueries: ['barley, whole', 'barley'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Semolina', searchQueries: ['durum wheat semolina', 'wheat semolina'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cornflour', searchQueries: ['maize starch', 'corn starch', 'cornflour'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More legumes & nuts
  { name: 'Kidney beans', searchQueries: ['red kidney bean', 'kidney bean'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'White beans', searchQueries: ['haricot bean', 'white bean'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Tofu', searchQueries: ['tofu'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Almonds', searchQueries: ['almond'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Walnuts', searchQueries: ['walnut'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Cashews', searchQueries: ['cashew'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Pine nuts', searchQueries: ['pine nut'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Hazelnuts', searchQueries: ['hazelnut'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More dairy
  { name: 'Mozzarella', searchQueries: ['mozzarella'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Parmesan', searchQueries: ['parmesan'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Cheddar', searchQueries: ['cheddar'], targetGrade: 'HIGH', pedigree: STD_HIGH },
  { name: 'Feta', searchQueries: ['feta'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // Condiments, drinks & other
  { name: 'Honey', searchQueries: ['honey'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Maple syrup', searchQueries: ['maple syrup'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Soy sauce', searchQueries: ['soy sauce'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Tomato paste', searchQueries: ['tomato paste', 'tomato concentrate'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Mustard', searchQueries: ['mustard, '], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Coconut milk', searchQueries: ['coconut milk'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Dark chocolate', searchQueries: ['dark chocolate'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Cocoa powder', searchQueries: ['cocoa powder'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Coffee', searchQueries: ['coffee, ground', 'coffee, roasted'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Black tea', searchQueries: ['black tea'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Vanilla', searchQueries: ['vanilla'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  // More oils & fats
  { name: 'Coconut oil', searchQueries: ['coconut oil'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Sesame oil', searchQueries: ['sesame oil'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Vegetable oil', searchQueries: ['vegetable oil'], targetGrade: 'MEDIUM', pedigree: STD_MED },
  { name: 'Margarine', searchQueries: ['margarine'], targetGrade: 'MEDIUM', pedigree: STD_MED },
]

export interface MappedImpacts {
  impact_climate: number
  impact_climate_fossil: number
  impact_climate_biogenic: number
  impact_water: number
  impact_land: number
  impact_waste: number
  impact_terrestrial_ecotoxicity: number
  impact_freshwater_ecotoxicity: number
  impact_marine_ecotoxicity: number
  impact_freshwater_eutrophication: number
  impact_marine_eutrophication: number
  impact_terrestrial_acidification: number
}

interface RawImpact {
  impactCategory?: { name?: string }
  amount?: number
}

/** Map ReCiPe 2016 impact-category results onto staging factor columns. */
export function mapImpacts(results: RawImpact[]): MappedImpacts {
  const m: MappedImpacts = {
    impact_climate: 0,
    impact_climate_fossil: 0,
    impact_climate_biogenic: 0,
    impact_water: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: 0,
  }
  for (const r of results) {
    const cat = (r.impactCategory?.name || '').toLowerCase()
    const v = Number(r.amount ?? 0)
    if (cat.includes('climate change') || cat.includes('global warming')) {
      if (cat.includes('fossil')) m.impact_climate_fossil = v
      else if (cat.includes('biogenic')) m.impact_climate_biogenic = v
      else {
        m.impact_climate = v
      }
    } else if (cat.includes('water consumption') || cat.includes('water use')) m.impact_water = v
    else if (cat.includes('land use')) m.impact_land = v
    else if (cat.includes('freshwater eutrophication') || cat.includes('eutrophication: freshwater')) m.impact_freshwater_eutrophication = v
    else if (cat.includes('marine eutrophication') || cat.includes('eutrophication: marine')) m.impact_marine_eutrophication = v
    else if (cat.includes('terrestrial acidification') || cat.includes('acidification')) m.impact_terrestrial_acidification = v
    else if (cat.includes('freshwater ecotoxicity') || cat.includes('ecotoxicity: freshwater')) m.impact_freshwater_ecotoxicity = v
    else if (cat.includes('marine ecotoxicity') || cat.includes('ecotoxicity: marine')) m.impact_marine_ecotoxicity = v
    else if (cat.includes('terrestrial ecotoxicity') || cat.includes('ecotoxicity: terrestrial')) m.impact_terrestrial_ecotoxicity = v
  }
  // If only a total climate figure was returned, split fossil/biogenic by the
  // Agribalyse-typical 85/15 ratio so downstream consumers have a split.
  if (m.impact_climate > 0 && m.impact_climate_fossil === 0 && m.impact_climate_biogenic === 0) {
    m.impact_climate_fossil = m.impact_climate * 0.85
    m.impact_climate_biogenic = m.impact_climate * 0.15
  }
  // If fossil+biogenic were given but not a total, sum them.
  if (m.impact_climate === 0 && (m.impact_climate_fossil > 0 || m.impact_climate_biogenic > 0)) {
    m.impact_climate = m.impact_climate_fossil + m.impact_climate_biogenic
  }
  return m
}

export interface BackfillTargetResult {
  name: string
  status: 'upserted' | 'not_found' | 'error'
  processName?: string
  climate?: number
  error?: string
}

export interface BackfillSummary {
  configured: boolean
  upserted: number
  notFound: number
  errors: number
  results: BackfillTargetResult[]
}

// Process-name fragments that signal the wrong kind of process for a raw
// commodity factor (composite dishes, by-products, cooked/preserved forms).
const BAD_FRAGMENTS = [
  'blood', 'cooked', 'canned', 'fried', 'grilled', 'roasted', 'smoked',
  'sauce', 'soup', 'pizza', 'salad', ' dish', 'ready meal', 'baby food',
  'flavour', 'flavor', 'combined', 'breaded', 'in olive oil', 'dummy',
  'offal', 'gizzard', 'storage', 'feed',
  // Composite / prepared products that out-rank the raw commodity.
  'sandwich', 'pudding', 'broth', 'snack', 'praline', 'sauteed',
  'sautéed', 'pan-fried', 'coulis', 'with ', ' w ', 'w meat', 'filled',
  'stuffed', 'gratin', 'puree', 'purée', 'jam', 'compote', 'tart',
  'cake', 'biscuit', 'crisp', 'nuggets', 'burger', 'plant-based',
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True if `word` (or its simple `+s` plural) appears as a whole word in `name`.
 * Word boundaries stop short names matching inside longer ones ("pea" must not
 * match "Pearled barley"); the plural tolerance lets a singular query word match
 * a plural process name ("almond" → "Almonds, in shell").
 */
function wordIn(name: string, word: string): boolean {
  if (!word) return false
  return (
    new RegExp(`\\b${escapeRegExp(word)}s?\\b`).test(name) ||
    new RegExp(`\\b${escapeRegExp(word)}\\b`).test(name)
  )
}

/**
 * Pick the best Agribalyse process for a food commodity.
 *
 * Agribalyse/CIQUAL names look like "Beef, sirloin, raw, processed in FR |
 * Chilled | Pack | at distribution {FR} U" (an aggregated, calculable supply
 * chain) or "Onion, conventional, national average, at farm {FR} U" (aggregated
 * agricultural). We prefer those — name starting with the commodity, raw,
 * aggregated ("processed in FR" / "at farm"), nearest the as-purchased stage —
 * and avoid composite dishes, by-products and bare unlinked unit processes.
 */
export function selectFoodProcess(target: BackfillTarget, filtered: any[]): any | null {
  const head = target.name.toLowerCase()
  const headRegex = new RegExp(`^${escapeRegExp(head)}\\b`)

  const scoreOf = (n: string): number => {
    let s = 0
    if (headRegex.test(n)) s += 100
    if (n.includes('processed in fr')) s += 40
    if (n.includes('at farm')) s += 30
    if (n.includes('raw')) s += 20
    if (n.includes('at distribution')) s += 15
    else if (n.includes('at packaging')) s += 10
    else if (n.includes('at supermarket')) s += 8
    else if (n.includes('at plant') || n.includes('at farm gate')) s += 6
    for (const bad of BAD_FRAGMENTS) if (n.includes(bad)) s -= 60
    // Mild preference for fresh/ambient over preserved forms (freezing, drying
    // etc. add processing energy that isn't part of the raw commodity).
    for (const soft of ['frozen', 'freezing', 'dried', 'dehydrated', 'powder', 'concentrate']) {
      if (n.includes(soft)) s -= 25
    }
    return s - n.length * 0.05 // prefer concise / generic names
  }

  // Query priority: try each search query in order; the first query that has
  // any matching process wins (best-scored among its matches). This gives the
  // curator control — a specific first query ("lemon, pulp") beats a generic
  // one and stops the commodity name grabbing a prefix-sibling ("Lemon sole").
  for (const q of target.searchQueries) {
    const words = q
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter((w) => w.length > 1)
    if (words.length === 0) continue

    let best: any = null
    let bestScore = -Infinity
    for (const p of filtered) {
      const n = (p.name || '').toLowerCase()
      if (!n || !words.every((w) => wordIn(n, w))) continue
      const s = scoreOf(n)
      if (s > bestScore) {
        bestScore = s
        best = p
      }
    }
    if (best) return best
  }
  return null
}

/** Process a single target: select process, calculate, upsert. */
async function backfillOne(
  client: OpenLCAClient,
  filtered: any[],
  target: BackfillTarget,
  supabase: SupabaseClient,
): Promise<BackfillTargetResult> {
  const process = selectFoodProcess(target, filtered)
  if (!process) return { name: target.name, status: 'not_found' }

  let impacts: MappedImpacts
  try {
    // Direct process calculation. Agribalyse's CIQUAL processes are aggregated
    // ("... processed in FR | Ambient"), so they calculate cleanly without the
    // create-system step (which this gdt-server build doesn't expose).
    const raw = await client.calculateProcess(process['@id'], IMPACT_METHOD, 1)
    impacts = mapImpacts(raw as RawImpact[])
  } catch (e: unknown) {
    return {
      name: target.name,
      status: 'error',
      processName: process.name,
      error: e instanceof Error ? e.message : 'calculation failed',
    }
  }

  if (!(impacts.impact_climate > 0)) {
    return {
      name: target.name,
      status: 'error',
      processName: process.name,
      error: 'no climate impact returned (process did not calculate)',
    }
  }

  const metadata = {
    agribalyse_version: '3.2',
    agribalyse_process_id: process['@id'],
    agribalyse_process_name: process.name,
    impact_method: IMPACT_METHOD,
    source_note: 'Calculated from Agribalyse v3.2 (ADEME/INRAE) via OpenLCA. Per 1 kg at gate.',
  }
  const row = {
    organization_id: null,
    name: target.name,
    category: 'Ingredient',
    reference_unit: 'kg',
    co2_factor: impacts.impact_climate,
    co2_fossil_factor: impacts.impact_climate_fossil,
    co2_biogenic_factor: impacts.impact_climate_biogenic,
    water_factor: impacts.impact_water,
    land_factor: impacts.impact_land,
    waste_factor: impacts.impact_waste,
    terrestrial_ecotoxicity_factor: impacts.impact_terrestrial_ecotoxicity,
    freshwater_ecotoxicity_factor: impacts.impact_freshwater_ecotoxicity,
    marine_ecotoxicity_factor: impacts.impact_marine_ecotoxicity,
    freshwater_eutrophication_factor: impacts.impact_freshwater_eutrophication,
    marine_eutrophication_factor: impacts.impact_marine_eutrophication,
    terrestrial_acidification_factor: impacts.impact_terrestrial_acidification,
    source: 'Agribalyse v3.2 (ADEME/INRAE)',
    source_database: 'agribalyse',
    geographic_scope: 'FR',
    confidence_score: target.targetGrade === 'HIGH' ? 90 : 75,
    pedigree_reliability: target.pedigree.reliability,
    pedigree_completeness: target.pedigree.completeness,
    pedigree_temporal: target.pedigree.temporal,
    pedigree_geographical: target.pedigree.geographical,
    pedigree_technological: target.pedigree.technological,
    uncertainty_percent: target.targetGrade === 'HIGH' ? 15 : 25,
    data_collection_year: 2023,
    metadata,
  }

  // Idempotent: clear any prior Agribalyse row for this name, then insert.
  await supabase
    .from('staging_emission_factors')
    .delete()
    .ilike('name', target.name)
    .like('source', 'Agribalyse%')
    .is('organization_id', null)
  const { error } = await supabase.from('staging_emission_factors').insert(row)
  if (error) {
    return { name: target.name, status: 'error', processName: process.name, error: error.message }
  }

  return { name: target.name, status: 'upserted', processName: process.name, climate: impacts.impact_climate }
}

export interface RunBackfillOptions {
  supabase: SupabaseClient
  /** Restrict to these factor names (case-insensitive). Default: all targets. */
  names?: string[]
  /** Called after each target completes (for progress logging). */
  onProgress?: (done: number, total: number, result: BackfillTargetResult) => void
}

/**
 * Run the Agribalyse backfill. Fetches + filters the Agribalyse process list
 * once, then selects, calculates and upserts each target sequentially. Returns
 * a summary; never throws on a single-target failure (those are recorded).
 */
export async function runAgribalyseBackfill(opts: RunBackfillOptions): Promise<BackfillSummary> {
  const client = createOpenLCAClientForDatabase('agribalyse')
  if (!client) {
    return { configured: false, upserted: 0, notFound: 0, errors: 0, results: [] }
  }

  const wanted = opts.names
    ? HOSPITALITY_FOOD_TARGETS.filter((t) => opts.names!.some((n) => n.toLowerCase() === t.name.toLowerCase()))
    : HOSPITALITY_FOOD_TARGETS

  const allProcesses = await client.getAllProcesses()
  const filtered = filterFoodProcesses(allProcesses)

  const results: BackfillTargetResult[] = []
  for (let i = 0; i < wanted.length; i++) {
    const result = await backfillOne(client, filtered, wanted[i], opts.supabase)
    results.push(result)
    opts.onProgress?.(i + 1, wanted.length, result)
  }

  return {
    configured: true,
    upserted: results.filter((r) => r.status === 'upserted').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  }
}

export const BACKFILL_TARGET_COUNT = HOSPITALITY_FOOD_TARGETS.length
