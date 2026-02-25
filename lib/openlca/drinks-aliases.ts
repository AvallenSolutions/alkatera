/**
 * Curated alias mappings for drinks-relevant ecoinvent processes.
 *
 * When a user searches for a common drinks term (e.g. "aluminium can"),
 * these aliases boost the most relevant ecoinvent processes to the top
 * of the search results.
 *
 * Maintainers: add new entries here when users report missing or
 * poorly-ranked results. No code changes needed — just add a new
 * alias object to the appropriate array.
 */

export interface DrinksAlias {
  /** Search terms that trigger this alias (lowercase) */
  searchTerms: string[];
  /** Ecoinvent process name substrings to boost (lowercase) */
  processPatterns: string[];
  /** Category for grouping */
  category: 'ingredient' | 'packaging' | 'utility' | 'transport';
}

// ─── INGREDIENTS ────────────────────────────────────────────────────────────

export const INGREDIENT_ALIASES: DrinksAlias[] = [
  // Grains & cereals
  {
    searchTerms: ['barley', 'barley grain'],
    processPatterns: ['market for barley grain', 'barley grain production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['malt', 'malted barley'],
    processPatterns: ['malt production', 'market for malt'],
    category: 'ingredient',
  },
  {
    searchTerms: ['wheat', 'wheat grain'],
    processPatterns: ['market for wheat grain', 'wheat grain production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['rice', 'rice grain'],
    processPatterns: ['market for rice', 'rice production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['maize', 'corn'],
    processPatterns: ['market for maize grain', 'maize grain production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['oats', 'oat grain'],
    processPatterns: ['oat grain production', 'market for oat grain', 'oat production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['rye', 'rye grain'],
    processPatterns: ['rye grain production', 'market for rye grain', 'ethanol production from rye'],
    category: 'ingredient',
  },
  {
    searchTerms: ['sorghum'],
    processPatterns: ['sorghum grain production', 'market for sorghum'],
    category: 'ingredient',
  },

  // Hops & botanicals
  {
    searchTerms: ['hops', 'hop'],
    processPatterns: ['hop production', 'market for hop'],
    category: 'ingredient',
  },
  {
    searchTerms: ['juniper', 'juniper berry'],
    processPatterns: ['juniper berry', 'juniper'],
    category: 'ingredient',
  },
  {
    searchTerms: ['coriander'],
    processPatterns: ['coriander production', 'market for coriander'],
    category: 'ingredient',
  },
  {
    searchTerms: ['ginger'],
    processPatterns: ['ginger production', 'market for ginger'],
    category: 'ingredient',
  },
  {
    searchTerms: ['vanilla'],
    processPatterns: ['market for vanilla', 'vanilla production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cinnamon'],
    processPatterns: ['cinnamon production', 'market for cinnamon'],
    category: 'ingredient',
  },
  {
    searchTerms: ['pepper', 'black pepper'],
    processPatterns: ['pepper production', 'market for pepper'],
    category: 'ingredient',
  },

  // Spirits & aperitif botanicals
  {
    searchTerms: ['gentian', 'gentiane'],
    processPatterns: ['gentian', 'gentiane'],
    category: 'ingredient',
  },
  {
    searchTerms: ['liquorice', 'licorice'],
    processPatterns: ['liquorice', 'licorice'],
    category: 'ingredient',
  },
  {
    searchTerms: ['orris root', 'iris root'],
    processPatterns: ['iris', 'orris'],
    category: 'ingredient',
  },
  {
    searchTerms: ['angelica', 'angelica root'],
    processPatterns: ['angelica'],
    category: 'ingredient',
  },
  {
    searchTerms: ['elderflower', 'elder flower', 'sureau'],
    processPatterns: ['elderflower', 'elder'],
    category: 'ingredient',
  },
  {
    searchTerms: ['wormwood', 'absinthe herb'],
    processPatterns: ['wormwood', 'artemisia'],
    category: 'ingredient',
  },
  {
    searchTerms: ['caraway', 'carvi'],
    processPatterns: ['caraway', 'carvi'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cardamom', 'cardamome'],
    processPatterns: ['cardamom', 'cardamome'],
    category: 'ingredient',
  },
  {
    searchTerms: ['star anise', 'badiane'],
    processPatterns: ['anise', 'badiane'],
    category: 'ingredient',
  },
  {
    searchTerms: ['orange blossom', 'orange flower water', 'neroli'],
    processPatterns: ['orange blossom', 'orange flower', 'neroli'],
    category: 'ingredient',
  },
  {
    searchTerms: ['fennel', 'fenouil'],
    processPatterns: ['fennel', 'fenouil'],
    category: 'ingredient',
  },
  {
    searchTerms: ['saffron', 'safran'],
    processPatterns: ['saffron', 'safran'],
    category: 'ingredient',
  },

  // Additives & stabilisers
  {
    searchTerms: ['carrageenan', 'carrageen'],
    processPatterns: ['carrageenan', 'seaweed'],
    category: 'ingredient',
  },
  {
    searchTerms: ['acacia gum', 'gum arabic', 'arabic gum'],
    processPatterns: ['acacia', 'arabic gum'],
    category: 'ingredient',
  },
  {
    searchTerms: ['malic acid'],
    processPatterns: ['malic acid'],
    category: 'ingredient',
  },
  {
    searchTerms: ['tartaric acid'],
    processPatterns: ['tartaric acid'],
    category: 'ingredient',
  },
  {
    searchTerms: ['potassium sorbate'],
    processPatterns: ['potassium sorbate', 'sorbate'],
    category: 'ingredient',
  },
  {
    searchTerms: ['sodium benzoate'],
    processPatterns: ['sodium benzoate', 'benzoate'],
    category: 'ingredient',
  },

  // Sugars & sweeteners
  {
    searchTerms: ['sugar', 'cane sugar', 'sugar cane'],
    processPatterns: ['market for sugar', 'sugar production', 'sugarcane production', 'sugar beet production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['molasses'],
    processPatterns: ['market for molasses', 'molasses production', 'ethanol production from sugar beet molasses'],
    category: 'ingredient',
  },
  {
    searchTerms: ['honey'],
    processPatterns: ['honey production', 'market for honey'],
    category: 'ingredient',
  },
  {
    searchTerms: ['agave'],
    processPatterns: ['agave production', 'market for agave'],
    category: 'ingredient',
  },
  {
    searchTerms: ['syrup', 'glucose syrup'],
    processPatterns: ['glucose production', 'market for glucose', 'syrup production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['maple syrup', 'maple'],
    processPatterns: ['maple syrup', 'syrup, maple', 'market for maple'],
    category: 'ingredient',
  },
  {
    searchTerms: ['liquorice', 'licorice', 'liquorice root'],
    processPatterns: ['liquorice', 'licorice', 'glycyrrhiza'],
    category: 'ingredient',
  },

  // Yeast & fermentation
  {
    searchTerms: ['yeast'],
    processPatterns: ['market for fodder yeast', 'fodder yeast'],
    category: 'ingredient',
  },

  // Fruits
  {
    searchTerms: ['grape', 'grapes'],
    processPatterns: ['grape production', 'market for grape'],
    category: 'ingredient',
  },
  {
    searchTerms: ['apple', 'apples'],
    processPatterns: ['market for apple', 'apple production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['pear', 'pears'],
    processPatterns: ['market for pear', 'pear production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['orange', 'oranges'],
    processPatterns: ['market for orange', 'orange production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['lemon', 'lemons'],
    processPatterns: ['market for lemon', 'lemon production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['lime', 'limes'],
    processPatterns: ['market for lime', 'lime production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['grapefruit'],
    processPatterns: ['grapefruit production', 'market for grapefruit'],
    category: 'ingredient',
  },
  {
    searchTerms: ['mango', 'mangoes'],
    processPatterns: ['market for mango', 'mango production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['pineapple'],
    processPatterns: ['market for pineapple', 'pineapple production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['passion fruit'],
    processPatterns: ['passion fruit production', 'market for passion fruit'],
    category: 'ingredient',
  },
  {
    searchTerms: ['banana', 'bananas'],
    processPatterns: ['market for banana', 'banana production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['strawberry', 'strawberries'],
    processPatterns: ['strawberry production', 'market for strawberry'],
    category: 'ingredient',
  },
  {
    searchTerms: ['raspberry', 'raspberries'],
    processPatterns: ['raspberry production', 'market for raspberry'],
    category: 'ingredient',
  },
  {
    searchTerms: ['blueberry', 'blueberries'],
    processPatterns: ['blueberry production', 'market for blueberry'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cherry', 'cherries'],
    processPatterns: ['cherry production', 'market for cherry'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cranberry', 'cranberries'],
    processPatterns: ['cranberry production', 'market for cranberry'],
    category: 'ingredient',
  },
  {
    searchTerms: ['coconut'],
    processPatterns: ['market for coconut', 'coconut production'],
    category: 'ingredient',
  },

  // Nuts & plant-based
  {
    searchTerms: ['almond', 'almonds'],
    processPatterns: ['market for almond', 'almond production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['soy', 'soybean', 'soya'],
    processPatterns: ['market for soybean', 'soybean production', 'soybean beverage production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['oat milk'],
    processPatterns: ['oat drink production', 'market for oat drink', 'oat grain production'],
    category: 'ingredient',
  },

  // Coffee, tea, cocoa
  {
    searchTerms: ['coffee', 'coffee bean'],
    processPatterns: ['market for coffee', 'coffee green bean production'],
    category: 'ingredient',
  },
  {
    searchTerms: ['tea', 'tea leaves'],
    processPatterns: ['tea production', 'market for tea'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cocoa', 'cacao'],
    processPatterns: ['market for cocoa bean', 'cocoa bean production'],
    category: 'ingredient',
  },

  // Dairy & alternatives
  {
    searchTerms: ['milk', 'dairy milk', 'cow milk'],
    processPatterns: ['market for raw milk', 'milk production', 'market for milk'],
    category: 'ingredient',
  },
  {
    searchTerms: ['cream'],
    processPatterns: ['cream production', 'market for cream'],
    category: 'ingredient',
  },
  {
    searchTerms: ['whey'],
    processPatterns: ['whey production', 'market for whey', 'ethanol production from whey'],
    category: 'ingredient',
  },

  // Additives & processing aids
  {
    searchTerms: ['citric acid'],
    processPatterns: ['citric acid production', 'market for citric acid'],
    category: 'ingredient',
  },
  {
    searchTerms: ['carbon dioxide', 'co2'],
    processPatterns: ['carbon dioxide production', 'market for carbon dioxide'],
    category: 'ingredient',
  },
  {
    searchTerms: ['ethanol', 'alcohol'],
    processPatterns: ['ethanol production', 'market for ethanol', 'dewatering of ethanol'],
    category: 'ingredient',
  },
  {
    searchTerms: ['salt', 'sodium chloride'],
    processPatterns: ['market for sodium chloride', 'sodium chloride production'],
    category: 'ingredient',
  },
];

// ─── PACKAGING ──────────────────────────────────────────────────────────────

export const PACKAGING_ALIASES: DrinksAlias[] = [
  // Glass
  {
    searchTerms: ['glass bottle', 'glass container', 'glass packaging'],
    processPatterns: ['packaging glass production', 'market for packaging glass'],
    category: 'packaging',
  },
  {
    searchTerms: ['glass', 'glass production'],
    processPatterns: ['packaging glass production', 'market for packaging glass', 'glass bottle'],
    category: 'packaging',
  },

  // Aluminium/aluminum
  {
    searchTerms: ['aluminium can', 'aluminum can', 'aluminium cans', 'aluminum cans'],
    processPatterns: ['aluminium, wrought alloy', 'sheet rolling, aluminium', 'deep drawing', 'used beverage can'],
    category: 'packaging',
  },
  {
    searchTerms: ['aluminium', 'aluminum'],
    processPatterns: ['aluminium, wrought alloy', 'sheet rolling, aluminium', 'aluminium, primary, ingot', 'aluminium alloy production', 'market for aluminium, wrought', 'market for aluminium, primary, ingot', 'market for aluminium alloy'],
    category: 'packaging',
  },
  {
    searchTerms: ['aluminium foil', 'aluminum foil'],
    processPatterns: ['aluminium collector foil', 'aluminium, wrought alloy', 'sheet rolling, aluminium'],
    category: 'packaging',
  },

  // Steel/tinplate
  {
    searchTerms: ['steel can', 'tin can', 'tinplate'],
    processPatterns: ['steel production', 'tinplate', 'sheet rolling, steel', 'market for steel'],
    category: 'packaging',
  },

  // Plastics
  {
    searchTerms: ['pet bottle', 'pet', 'plastic bottle'],
    processPatterns: ['polyethylene terephthalate, bottle grade', 'market for polyethylene terephthalate', 'stretch blow moulding'],
    category: 'packaging',
  },
  {
    searchTerms: ['hdpe', 'high density polyethylene'],
    processPatterns: ['polyethylene, high density', 'market for polyethylene, high density'],
    category: 'packaging',
  },
  {
    searchTerms: ['ldpe', 'low density polyethylene'],
    processPatterns: ['polyethylene, low density', 'market for polyethylene, low density'],
    category: 'packaging',
  },
  {
    searchTerms: ['polypropylene', 'pp'],
    processPatterns: ['polypropylene production', 'market for polypropylene'],
    category: 'packaging',
  },
  {
    searchTerms: ['shrink wrap', 'shrink film'],
    processPatterns: ['polyethylene, low density', 'blown film', 'market for packaging film'],
    category: 'packaging',
  },

  // Paper & cardboard
  {
    searchTerms: ['corrugated box', 'corrugated board', 'cardboard box'],
    processPatterns: ['market for corrugated board box', 'corrugated board box'],
    category: 'packaging',
  },
  {
    searchTerms: ['cardboard', 'carton board'],
    processPatterns: ['corrugated board box', 'folding boxboard carton', 'market for corrugated board', 'carton board box'],
    category: 'packaging',
  },
  {
    searchTerms: ['beverage carton', 'tetra pak', 'drink carton'],
    processPatterns: ['beverage carton converting', 'market for beverage carton'],
    category: 'packaging',
  },
  {
    searchTerms: ['paper', 'paper packaging'],
    processPatterns: ['market for packaging paper', 'single use paper wrap', 'paper production'],
    category: 'packaging',
  },

  // Labels & closures
  {
    searchTerms: ['label', 'bottle label'],
    processPatterns: ['polyethylene terephthalate, labels', 'paper label', 'market for label'],
    category: 'packaging',
  },
  {
    searchTerms: ['crown cork', 'bottle cap', 'cap', 'closure'],
    processPatterns: ['steel production', 'tinplate', 'injection moulding', 'polypropylene'],
    category: 'packaging',
  },
  {
    searchTerms: ['cork', 'wine cork'],
    processPatterns: ['cork production', 'market for cork'],
    category: 'packaging',
  },

  // Secondary packaging
  {
    searchTerms: ['pallet', 'wooden pallet'],
    processPatterns: ['EUR-flat pallet', 'market for EUR-flat pallet'],
    category: 'packaging',
  },
  {
    searchTerms: ['stretch wrap', 'pallet wrap'],
    processPatterns: ['stretch blow moulding', 'polyethylene, low density', 'blown film'],
    category: 'packaging',
  },
  {
    searchTerms: ['multipack', 'ring carrier', 'can ring'],
    processPatterns: ['polyethylene, low density', 'injection moulding'],
    category: 'packaging',
  },
];

// ─── UTILITIES ──────────────────────────────────────────────────────────────

export const UTILITY_ALIASES: DrinksAlias[] = [
  {
    searchTerms: ['electricity', 'power', 'grid electricity'],
    processPatterns: ['market for electricity', 'electricity, low voltage', 'market group for electricity'],
    category: 'utility',
  },
  {
    searchTerms: ['tap water', 'water', 'process water', 'mains water'],
    processPatterns: ['market for tap water', 'tap water production'],
    category: 'utility',
  },
  {
    searchTerms: ['natural gas', 'gas'],
    processPatterns: ['market for natural gas', 'heat production, natural gas', 'market for heat, district or industrial, natural gas'],
    category: 'utility',
  },
  {
    searchTerms: ['steam', 'process steam'],
    processPatterns: ['steam production', 'market for steam'],
    category: 'utility',
  },
  {
    searchTerms: ['cooling', 'refrigeration', 'chilling'],
    processPatterns: ['cooling energy production', 'market for cooling energy'],
    category: 'utility',
  },
  {
    searchTerms: ['heat', 'heating', 'thermal energy'],
    processPatterns: ['heat production', 'market for heat'],
    category: 'utility',
  },
];

// ─── TRANSPORT ──────────────────────────────────────────────────────────────

export const TRANSPORT_ALIASES: DrinksAlias[] = [
  {
    searchTerms: ['truck', 'lorry', 'road transport', 'road freight'],
    processPatterns: ['transport, freight, lorry', 'market for transport, freight, lorry'],
    category: 'transport',
  },
  {
    searchTerms: ['ship', 'sea freight', 'ocean freight', 'maritime'],
    processPatterns: ['transport, freight, sea', 'market for transport, freight, sea'],
    category: 'transport',
  },
  {
    searchTerms: ['rail', 'train', 'rail freight'],
    processPatterns: ['transport, freight train', 'market for transport, freight train'],
    category: 'transport',
  },
  {
    searchTerms: ['air freight', 'air cargo'],
    processPatterns: ['transport, freight, aircraft', 'market for transport, freight, aircraft'],
    category: 'transport',
  },
  {
    searchTerms: ['van', 'delivery van'],
    processPatterns: ['transport, freight, light commercial vehicle'],
    category: 'transport',
  },
];

// ─── COMBINED ALIAS LIST ────────────────────────────────────────────────────

export const ALL_DRINKS_ALIASES: DrinksAlias[] = [
  ...INGREDIENT_ALIASES,
  ...PACKAGING_ALIASES,
  ...UTILITY_ALIASES,
  ...TRANSPORT_ALIASES,
];

/**
 * Check whether `needle` appears in `haystack` at a word boundary.
 *
 * Word boundaries are: start/end of string, space, or hyphen.
 * This prevents "liquorice".includes("rice") from triggering the rice alias.
 */
export function matchesAtWordBoundary(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;

  // Word boundary characters: whitespace, punctuation, or start/end of string
  const isBoundaryChar = (ch: string) =>
    ch === ' ' || ch === '-' || ch === ',' || ch === '.' || ch === '_' || ch === '/' || ch === '(' || ch === ')';

  // Check character BEFORE the match is a word boundary (or start of string)
  const charBefore = idx > 0 ? haystack[idx - 1] : null;
  const isBoundaryBefore = charBefore === null || isBoundaryChar(charBefore);

  // Check character AFTER the match is a word boundary (or end of string)
  const afterIdx = idx + needle.length;
  const charAfter = afterIdx < haystack.length ? haystack[afterIdx] : null;
  const isBoundaryAfter = charAfter === null || isBoundaryChar(charAfter);

  return isBoundaryBefore && isBoundaryAfter;
}

/**
 * Find matching aliases for a given search query.
 * Returns all aliases where the query matches any searchTerm.
 *
 * Uses word-boundary matching to prevent false positives
 * (e.g. "liquorice" should NOT match the "rice" alias).
 */
export function findMatchingAliases(query: string): DrinksAlias[] {
  const queryLower = query.toLowerCase().trim();

  return ALL_DRINKS_ALIASES.filter(alias =>
    alias.searchTerms.some(term => {
      // Exact match
      if (queryLower === term) return true;

      // Query contains the term at a word boundary
      if (matchesAtWordBoundary(queryLower, term)) return true;

      // Term contains the query at a word boundary
      if (matchesAtWordBoundary(term, queryLower)) return true;

      return false;
    })
  );
}
