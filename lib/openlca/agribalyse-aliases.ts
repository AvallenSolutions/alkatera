/**
 * Agribalyse v3.2 process alias mappings for drinks-relevant ingredients.
 *
 * Agribalyse uses different naming conventions to ecoinvent (CIQUAL-based,
 * often French-English mixed). These aliases map common drinks terms to
 * their Agribalyse process names and indicate which ingredients should
 * prefer Agribalyse data over ecoinvent.
 *
 * Source: Agribalyse v3.2 (ADEME / INRAE)
 */

import { type OpenLCADatabaseSource } from './client';
import { matchesAtWordBoundary } from './drinks-aliases';

export interface AgribalyseAlias {
  /** Search terms that trigger this alias (lowercase) */
  searchTerms: string[];
  /** Agribalyse process name substrings to boost (lowercase, may include French) */
  agribalysePatterns: string[];
  /** Ecoinvent process name substrings for cross-reference */
  ecoinventPatterns?: string[];
  /** Which database should be preferred for this ingredient */
  preferredDatabase: OpenLCADatabaseSource;
  /** Category for grouping */
  category: 'ingredient' | 'packaging' | 'utility' | 'transport';
  /** Brief note on why Agribalyse is preferred (or not) */
  rationale: string;
}

// ─── INGREDIENTS WHERE AGRIBALYSE IS PREFERRED ──────────────────────────

export const AGRIBALYSE_PREFERRED_ALIASES: AgribalyseAlias[] = [
  // Wine & Viticulture
  {
    searchTerms: ['wine grape', 'wine grapes', 'grape for wine', 'raisin de cuve'],
    agribalysePatterns: ['grape', 'raisin', 'viticulture'],
    ecoinventPatterns: ['grape production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has detailed French regional wine grape data with conventional/organic variants',
  },
  {
    searchTerms: ['cider apple', 'cider apples'],
    agribalysePatterns: ['pomme cidre', 'apple cider', 'apple', 'pomme'],
    ecoinventPatterns: ['apple production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse provides French cider apple data; ecoinvent only has generic apple',
  },

  // Grains & Cereals
  {
    searchTerms: ['barley', 'barley grain', 'orge'],
    agribalysePatterns: ['barley', 'orge'],
    ecoinventPatterns: ['market for barley grain', 'barley grain production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse provides French/EU barley data with better agricultural modelling',
  },
  {
    searchTerms: ['wheat', 'wheat grain', 'ble', 'blé'],
    agribalysePatterns: ['wheat', 'ble', 'blé'],
    ecoinventPatterns: ['market for wheat grain'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has comprehensive French wheat data',
  },

  // Sweeteners
  {
    searchTerms: ['beet sugar', 'sugar beet', 'sucre betterave'],
    agribalysePatterns: ['sugar beet', 'sucre betterave', 'betterave'],
    ecoinventPatterns: ['sugar production, from sugar beet'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has dedicated French beet sugar chain data',
  },
  {
    searchTerms: ['honey', 'miel'],
    agribalysePatterns: ['honey', 'miel'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no honey process; Agribalyse includes apiculture data',
  },

  // Dairy & Plant Milks
  {
    searchTerms: ['cow milk', 'whole milk', 'dairy milk', 'lait'],
    agribalysePatterns: ['milk', 'lait entier', 'lait'],
    ecoinventPatterns: ['market for raw milk'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has detailed French dairy chain with full processing data',
  },
  {
    searchTerms: ['cream', 'dairy cream', 'crème'],
    agribalysePatterns: ['cream', 'creme', 'crème'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has cream separation from dairy processing',
  },
  {
    searchTerms: ['oat milk', 'oat drink'],
    agribalysePatterns: ['oat milk', 'boisson avoine', 'lait avoine'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no oat milk process; Agribalyse covers plant-based drinks',
  },
  {
    searchTerms: ['soy milk', 'soya milk'],
    agribalysePatterns: ['soy milk', 'boisson soja', 'lait soja'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no soy milk process; Agribalyse covers plant-based drinks',
  },
  {
    searchTerms: ['almond milk', 'almond drink'],
    agribalysePatterns: ['almond milk', 'boisson amande', 'lait amande'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no almond milk process; Agribalyse covers plant-based drinks',
  },
  {
    searchTerms: ['coconut milk', 'coconut drink'],
    agribalysePatterns: ['coconut milk', 'boisson coco', 'lait coco'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no coconut milk process; Agribalyse covers plant-based drinks',
  },

  // Fruits
  {
    searchTerms: ['orange', 'orange juice'],
    agribalysePatterns: ['orange', 'jus orange'],
    ecoinventPatterns: ['orange production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has juice processing data; ecoinvent only has raw fruit',
  },
  {
    searchTerms: ['lemon', 'citron'],
    agribalysePatterns: ['lemon', 'citron'],
    ecoinventPatterns: ['lemon production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has better citrus fruit data for food applications',
  },
  {
    searchTerms: ['pineapple', 'ananas'],
    agribalysePatterns: ['pineapple', 'ananas'],
    ecoinventPatterns: ['pineapple production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has food-chain-specific tropical fruit data',
  },

  // Coffee & Tea
  {
    searchTerms: ['coffee', 'coffee bean', 'café'],
    agribalysePatterns: ['coffee', 'cafe', 'café'],
    ecoinventPatterns: ['green coffee bean production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse covers roasted coffee; ecoinvent only has green beans',
  },
  {
    searchTerms: ['green tea', 'thé vert'],
    agribalysePatterns: ['green tea', 'the vert', 'thé vert'],
    ecoinventPatterns: ['tea production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse distinguishes tea types; ecoinvent has generic tea only',
  },
  {
    searchTerms: ['black tea', 'thé noir'],
    agribalysePatterns: ['black tea', 'the noir', 'thé noir'],
    ecoinventPatterns: ['tea production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse distinguishes tea types; ecoinvent has generic tea only',
  },
  {
    searchTerms: ['cocoa', 'cocoa powder', 'cacao'],
    agribalysePatterns: ['cocoa', 'cacao', 'poudre cacao'],
    ecoinventPatterns: ['cocoa bean production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has processed cocoa products; ecoinvent has raw beans only',
  },

  // Spices & Botanicals
  {
    searchTerms: ['ginger', 'gingembre'],
    agribalysePatterns: ['ginger', 'gingembre'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no ginger process; Agribalyse covers spices',
  },
  {
    searchTerms: ['cinnamon', 'cannelle'],
    agribalysePatterns: ['cinnamon', 'cannelle'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no cinnamon process; Agribalyse covers spices',
  },
  {
    searchTerms: ['vanilla', 'vanille'],
    agribalysePatterns: ['vanilla', 'vanille'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no vanilla process; Agribalyse may cover it',
  },
  {
    searchTerms: ['mint', 'menthe'],
    agribalysePatterns: ['mint', 'menthe'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Ecoinvent has no mint process; Agribalyse covers herbs',
  },
  {
    searchTerms: ['gentian', 'gentiane'],
    agribalysePatterns: ['gentian', 'gentiane'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Gentian is a classic French bitter herb (Suze, Salers); Agribalyse covers it',
  },
  {
    searchTerms: ['liquorice', 'licorice', 'réglisse'],
    agribalysePatterns: ['liquorice', 'licorice', 'réglisse', 'reglisse'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse covers liquorice as a food/spice ingredient',
  },
  {
    searchTerms: ['saffron', 'safran'],
    agribalysePatterns: ['saffron', 'safran'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has saffron spice data with French agricultural context',
  },
  {
    searchTerms: ['fennel', 'fenouil'],
    agribalysePatterns: ['fennel', 'fenouil'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse covers fennel as a herb/spice ingredient',
  },
  {
    searchTerms: ['elderflower', 'sureau', 'elder flower'],
    agribalysePatterns: ['elderflower', 'sureau', 'elder'],
    ecoinventPatterns: [],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Elderflower is common in European beverages; Agribalyse has relevant botanical data',
  },

  // Nuts
  {
    searchTerms: ['almond', 'almonds', 'amande'],
    agribalysePatterns: ['almond', 'amande'],
    ecoinventPatterns: ['almond production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has food-chain-optimised nut data',
  },
  {
    searchTerms: ['hazelnut', 'hazelnuts', 'noisette'],
    agribalysePatterns: ['hazelnut', 'noisette'],
    ecoinventPatterns: ['hazelnut production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has food-chain-optimised nut data',
  },
  {
    searchTerms: ['coconut', 'noix de coco'],
    agribalysePatterns: ['coconut', 'noix de coco', 'coco'],
    ecoinventPatterns: ['coconut production'],
    preferredDatabase: 'agribalyse',
    category: 'ingredient',
    rationale: 'Agribalyse has coconut processing chain data',
  },
];

// ─── INGREDIENTS WHERE ECOINVENT IS PREFERRED ───────────────────────────
// (Energy, transport, packaging, industrial chemicals — ecoinvent is stronger)

export const ECOINVENT_PREFERRED_CATEGORIES: string[] = [
  'electricity', 'natural gas', 'diesel', 'fuel', 'heating',
  'transport', 'hgv', 'lorry', 'freight', 'shipping',
  'glass bottle', 'aluminium can', 'pet bottle', 'cardboard',
  'steel', 'plastic', 'polyethylene', 'polypropylene',
  'sodium hydroxide', 'chlorine', 'nitrogen gas',
];

/**
 * Determine whether a given ingredient name should prefer Agribalyse
 * or ecoinvent for its OpenLCA calculation.
 *
 * @param materialName - The name of the ingredient/material
 * @returns The preferred database source
 */
export function getPreferredDatabase(materialName: string): OpenLCADatabaseSource {
  const nameLower = materialName.toLowerCase();

  // Check if it matches an ecoinvent-preferred category (word boundary match)
  if (ECOINVENT_PREFERRED_CATEGORIES.some(term =>
    nameLower === term || matchesAtWordBoundary(nameLower, term)
  )) {
    return 'ecoinvent';
  }

  // Check if it matches an Agribalyse-preferred alias (word boundary match)
  const agribalyseMatch = AGRIBALYSE_PREFERRED_ALIASES.find(alias =>
    alias.searchTerms.some(term =>
      nameLower === term || matchesAtWordBoundary(nameLower, term)
    )
  );

  if (agribalyseMatch) {
    return agribalyseMatch.preferredDatabase;
  }

  // Default to ecoinvent for anything not explicitly mapped
  return 'ecoinvent';
}

/**
 * Get the Agribalyse search patterns for a given ingredient name.
 * Returns null if no Agribalyse alias exists.
 */
export function getAgribalysePatterns(materialName: string): string[] | null {
  const nameLower = materialName.toLowerCase();

  const match = AGRIBALYSE_PREFERRED_ALIASES.find(alias =>
    alias.searchTerms.some(term =>
      nameLower === term || matchesAtWordBoundary(nameLower, term)
    )
  );

  return match ? match.agribalysePatterns : null;
}
