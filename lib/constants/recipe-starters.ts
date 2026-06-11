// Typical starter recipes for the guided ingredient flow.
//
// Editing a plausible recipe is far less stressful than authoring one from a
// blank tab. Each starter lists typical ingredients with mid-range amounts
// PER LITRE of finished product; the dialog scales them to the product's
// unit size. Every amount is an editable starting point, every row is
// auto-matched and flagged "Matched, please check" — nothing is presented
// as more certain than it is.
//
// searchQuery values target the curated Global Drinks Factor Library names
// and the ecoinvent ingredient aliases (same rules as the packaging
// catalogue: terms that appear in factor names, never bare jargon).

export interface StarterIngredient {
  name: string;
  /** Deterministic factor search (run through ef-auto-match, ingredient mode) */
  searchQuery: string;
  /** Typical amount per litre of finished product */
  amountPerLitre: number;
  unit: 'g' | 'kg' | 'ml' | 'l';
  /** Optional plain-language note shown in the preview */
  note?: string;
}

export interface RecipeStarter {
  key: string;
  label: string;
  /** Lower-case keywords matched against the product category */
  categoryKeywords: string[];
  description: string;
  ingredients: StarterIngredient[];
}

export const RECIPE_STARTERS: RecipeStarter[] = [
  {
    key: 'lager',
    label: 'Lager',
    categoryKeywords: ['lager', 'pilsner', 'beer'],
    description: 'A typical lager grain bill with brewing water',
    ingredients: [
      { name: 'Malted barley', searchQuery: 'malted barley', amountPerLitre: 160, unit: 'g' },
      { name: 'Hops', searchQuery: 'hops', amountPerLitre: 4, unit: 'g' },
      { name: 'Yeast', searchQuery: 'yeast', amountPerLitre: 0.5, unit: 'g' },
      { name: 'Brewing water', searchQuery: 'tap water', amountPerLitre: 3.5, unit: 'l', note: 'Total water used in brewing, not just what ends up in the glass' },
      { name: 'Carbon dioxide', searchQuery: 'carbon dioxide', amountPerLitre: 5, unit: 'g' },
    ],
  },
  {
    key: 'pale_ale',
    label: 'Pale ale or IPA',
    categoryKeywords: ['ale', 'ipa', 'stout', 'porter'],
    description: 'A hop-forward ale grain bill',
    ingredients: [
      { name: 'Malted barley', searchQuery: 'malted barley', amountPerLitre: 200, unit: 'g' },
      { name: 'Hops', searchQuery: 'hops', amountPerLitre: 8, unit: 'g' },
      { name: 'Yeast', searchQuery: 'yeast', amountPerLitre: 0.5, unit: 'g' },
      { name: 'Brewing water', searchQuery: 'tap water', amountPerLitre: 3.5, unit: 'l', note: 'Total water used in brewing' },
      { name: 'Carbon dioxide', searchQuery: 'carbon dioxide', amountPerLitre: 5, unit: 'g' },
    ],
  },
  {
    key: 'cider',
    label: 'Cider',
    categoryKeywords: ['cider', 'perry'],
    description: 'Pressed apples with fermentation inputs',
    ingredients: [
      { name: 'Apples', searchQuery: 'apples', amountPerLitre: 1300, unit: 'g', note: 'Roughly 1.3 kg of apples pressed per litre of juice' },
      { name: 'Yeast', searchQuery: 'yeast', amountPerLitre: 0.3, unit: 'g' },
      { name: 'Sugar', searchQuery: 'sugar', amountPerLitre: 20, unit: 'g', note: 'Only if you chaptalise or back-sweeten' },
    ],
  },
  {
    key: 'wine',
    label: 'Wine (still)',
    categoryKeywords: ['wine', 'red', 'white', 'rosé', 'rose'],
    description: 'Grapes and fermentation inputs',
    ingredients: [
      { name: 'Grapes', searchQuery: 'grapes', amountPerLitre: 1400, unit: 'g', note: 'Roughly 1.4 kg of grapes per litre of wine' },
      { name: 'Yeast', searchQuery: 'yeast', amountPerLitre: 0.3, unit: 'g' },
    ],
  },
  {
    key: 'gin',
    label: 'Gin',
    categoryKeywords: ['gin'],
    description: 'Grain for the spirit base plus core botanicals',
    ingredients: [
      { name: 'Wheat (for spirit base)', searchQuery: 'wheat grain', amountPerLitre: 1800, unit: 'g', note: 'Grain used to make the neutral spirit' },
      { name: 'Juniper berries', searchQuery: 'juniper', amountPerLitre: 15, unit: 'g' },
      { name: 'Coriander seed', searchQuery: 'coriander', amountPerLitre: 5, unit: 'g' },
      { name: 'Citrus peel', searchQuery: 'oranges', amountPerLitre: 5, unit: 'g' },
      { name: 'Process water', searchQuery: 'tap water', amountPerLitre: 4, unit: 'l', note: 'Distillation and dilution water' },
    ],
  },
  {
    key: 'vodka',
    label: 'Vodka',
    categoryKeywords: ['vodka'],
    description: 'Grain base and process water',
    ingredients: [
      { name: 'Wheat', searchQuery: 'wheat grain', amountPerLitre: 2200, unit: 'g' },
      { name: 'Process water', searchQuery: 'tap water', amountPerLitre: 5, unit: 'l' },
    ],
  },
  {
    key: 'whisky',
    label: 'Whisky',
    categoryKeywords: ['whisky', 'whiskey', 'bourbon', 'scotch'],
    description: 'Malt bill and process water',
    ingredients: [
      { name: 'Malted barley', searchQuery: 'malted barley', amountPerLitre: 2300, unit: 'g' },
      { name: 'Yeast', searchQuery: 'yeast', amountPerLitre: 1, unit: 'g' },
      { name: 'Process water', searchQuery: 'tap water', amountPerLitre: 8, unit: 'l', note: 'Mashing, distillation and dilution water' },
    ],
  },
  {
    key: 'soft_drink',
    label: 'Soft drink or RTD',
    categoryKeywords: ['soft', 'rtd', 'soda', 'lemonade', 'tonic', 'mixer', 'kombucha', 'juice'],
    description: 'Sweetened carbonated drink basics',
    ingredients: [
      { name: 'Sugar', searchQuery: 'sugar', amountPerLitre: 90, unit: 'g' },
      { name: 'Citric acid', searchQuery: 'citric acid', amountPerLitre: 3, unit: 'g' },
      { name: 'Natural flavourings', searchQuery: 'natural flavourings', amountPerLitre: 2, unit: 'g' },
      { name: 'Water', searchQuery: 'tap water', amountPerLitre: 1.1, unit: 'l' },
      { name: 'Carbon dioxide', searchQuery: 'carbon dioxide', amountPerLitre: 6, unit: 'g' },
    ],
  },
];

/** Starters whose keywords appear in the product category, best matches first. */
export function startersForCategory(category: string | null | undefined): RecipeStarter[] {
  if (!category) return RECIPE_STARTERS;
  const lower = category.toLowerCase();
  const matching = RECIPE_STARTERS.filter((s) =>
    s.categoryKeywords.some((k) => lower.includes(k))
  );
  if (matching.length === 0) return RECIPE_STARTERS;
  const rest = RECIPE_STARTERS.filter((s) => !matching.includes(s));
  return [...matching, ...rest];
}

/** Scale a per-litre amount to the product's unit size, sensibly rounded. */
export function scaleStarterAmount(amountPerLitre: number, unitSizeMl: number | null | undefined): number {
  const litres = unitSizeMl && unitSizeMl > 0 ? unitSizeMl / 1000 : 1;
  const scaled = amountPerLitre * litres;
  if (scaled >= 100) return Math.round(scaled);
  if (scaled >= 10) return Math.round(scaled * 10) / 10;
  return Math.round(scaled * 100) / 100;
}
