/**
 * Industry emissions benchmarks by product category (kg CO2e per litre).
 *
 * These benchmarks represent lifecycle emissions including raw materials,
 * production, packaging, and distribution. Values are mid-range estimates
 * from published industry studies.
 *
 * Sources are cited per category group so users can verify the data.
 */

export interface IndustryBenchmark {
  /** kg CO2e per litre (lifecycle) */
  kgCO2ePerLitre: number;
  /** Human-readable source name */
  sourceName: string;
  /** Clickable URL to the source document */
  sourceUrl: string;
  /** Year the data was published */
  sourceYear: number;
  /**
   * Optional human-friendly category label (e.g. "Spirits", "Wine").
   * Consumers such as priority-signals and environmental.ts read this
   * to surface a label in the UI; leave undefined when the benchmark
   * has no category-level label.
   */
  label?: string | null;
}

/**
 * Water-use benchmarks expressed as litres of water per litre of product.
 * BIER 2023 reports operational water-use ratios for spirits, beer, wine, RTD
 * and non-alc; we use those mid-range figures and override for sub-categories
 * where stronger data exists (e.g. Scotch whisky's higher distillation ratio).
 *
 * "Water" here means withdrawal — what comes out of the tap to make the
 * product. The score uses these as the per-litre denominator when scaled by
 * `unit_size_l` to reach a per-unit benchmark, mirroring the carbon path.
 */
export interface WaterBenchmark {
  /** Litres of water withdrawn per litre of product (operational + embedded). */
  litresPerLitre: number;
  /** Human-readable source name */
  sourceName: string;
  /** Clickable URL to the source document */
  sourceUrl: string;
  /** Year the data was published */
  sourceYear: number;
}

/**
 * Maps product category groups (from product-categories.ts) to benchmark data.
 * Individual categories within a group share the same benchmark unless overridden.
 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: 'Spirits', label: 'Spirits' },
  { value: 'Beer & Cider', label: 'Beer & Cider' },
  { value: 'Wine', label: 'Wine' },
  { value: 'Ready-to-Drink & Cocktails', label: 'Ready-to-Drink & Cocktails' },
  { value: 'Non-Alcoholic', label: 'Non-Alcoholic' },
] as const;

const GROUP_BENCHMARKS: Record<string, IndustryBenchmark> = {
  Spirits: {
    kgCO2ePerLitre: 3.0,
    sourceName: 'BIER / Institute of Brewing & Distilling',
    sourceUrl: 'https://www.bieroundtable.com/wp-content/uploads/49d7a0_7643fd3fae5d4daf939cd5373389e4e0.pdf',
    sourceYear: 2023,
  },
  'Beer & Cider': {
    kgCO2ePerLitre: 0.85,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
  Wine: {
    kgCO2ePerLitre: 1.6,
    sourceName: 'ScienceDirect – Wine Carbon Footprint Review',
    sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S2772801322000173',
    sourceYear: 2022,
  },
  'Ready-to-Drink & Cocktails': {
    kgCO2ePerLitre: 0.55,
    sourceName: 'BIER Carbonated Soft Drinks Study (RTD proxy)',
    sourceUrl: 'https://www.bieroundtable.com/wp-content/uploads/49d7a0_7a5cfa72d8e74c04be5aeb81f38b136b.pdf',
    sourceYear: 2023,
  },
  'Non-Alcoholic': {
    kgCO2ePerLitre: 0.35,
    sourceName: 'BIER Carbonated Soft Drinks / Bottled Water Study',
    sourceUrl: 'https://www.bieroundtable.com/wp-content/uploads/49d7a0_7a5cfa72d8e74c04be5aeb81f38b136b.pdf',
    sourceYear: 2023,
  },
};

/**
 * Overrides for specific categories within a group where more granular data exists.
 */
const CATEGORY_OVERRIDES: Record<string, IndustryBenchmark> = {
  Whisky: {
    kgCO2ePerLitre: 3.8,
    sourceName: 'MDPI – Scottish Malt Whisky GHG Study',
    sourceUrl: 'https://www.mdpi.com/2071-1050/10/5/1473',
    sourceYear: 2018,
  },
  Bourbon: {
    kgCO2ePerLitre: 3.8,
    sourceName: 'MDPI – Scottish Malt Whisky GHG Study',
    sourceUrl: 'https://www.mdpi.com/2071-1050/10/5/1473',
    sourceYear: 2018,
  },
  'Rye Whiskey': {
    kgCO2ePerLitre: 3.8,
    sourceName: 'MDPI – Scottish Malt Whisky GHG Study',
    sourceUrl: 'https://www.mdpi.com/2071-1050/10/5/1473',
    sourceYear: 2018,
  },
  'Sparkling Wine': {
    kgCO2ePerLitre: 2.0,
    sourceName: 'Nature – Eco-innovation & Wine Carbon Footprint',
    sourceUrl: 'https://www.nature.com/articles/s43247-024-01766-0',
    sourceYear: 2024,
  },
  'Still Water': {
    kgCO2ePerLitre: 0.15,
    sourceName: 'IBWA Environmental Footprint Study',
    sourceUrl: 'https://bottledwater.org/environmental-footprint/',
    sourceYear: 2021,
  },
  'Sparkling Water': {
    kgCO2ePerLitre: 0.20,
    sourceName: 'IBWA Environmental Footprint Study',
    sourceUrl: 'https://bottledwater.org/environmental-footprint/',
    sourceYear: 2021,
  },
  'Energy Drink': {
    kgCO2ePerLitre: 0.55,
    sourceName: 'BIER Carbonated Soft Drinks Study',
    sourceUrl: 'https://www.bieroundtable.com/wp-content/uploads/49d7a0_7a5cfa72d8e74c04be5aeb81f38b136b.pdf',
    sourceYear: 2023,
  },
};

/** Default benchmark used when no category is available */
const DEFAULT_BENCHMARK: IndustryBenchmark = {
  kgCO2ePerLitre: 1.0,
  sourceName: 'BIER Beverage Industry Average',
  sourceUrl: 'https://www.bieroundtable.com/work/benchmarking/',
  sourceYear: 2023,
};

/**
 * Water-use benchmarks per category group. Mid-range withdrawal ratios from
 * the BIER 2023 benchmarking study, with category overrides where the
 * literature publishes a tighter figure (e.g. Scotch whisky distilleries).
 */
const WATER_GROUP_BENCHMARKS: Record<string, WaterBenchmark> = {
  Spirits: {
    litresPerLitre: 30,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
  'Beer & Cider': {
    litresPerLitre: 5,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
  Wine: {
    litresPerLitre: 5,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
  'Ready-to-Drink & Cocktails': {
    litresPerLitre: 3,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
  'Non-Alcoholic': {
    litresPerLitre: 2.5,
    sourceName: 'BIER 2023 Benchmarking Study',
    sourceUrl: 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
    sourceYear: 2023,
  },
};

/** Category-level water overrides where category-specific data is stronger. */
const WATER_CATEGORY_OVERRIDES: Record<string, WaterBenchmark> = {
  Whisky: {
    litresPerLitre: 50,
    sourceName: 'Scotch Whisky Association / BIER',
    sourceUrl: 'https://www.scotch-whisky.org.uk/insights/topics/sustainability/',
    sourceYear: 2023,
  },
  Bourbon: {
    litresPerLitre: 50,
    sourceName: 'Scotch Whisky Association / BIER',
    sourceUrl: 'https://www.scotch-whisky.org.uk/insights/topics/sustainability/',
    sourceYear: 2023,
  },
  'Rye Whiskey': {
    litresPerLitre: 50,
    sourceName: 'Scotch Whisky Association / BIER',
    sourceUrl: 'https://www.scotch-whisky.org.uk/insights/topics/sustainability/',
    sourceYear: 2023,
  },
};

/** Default water benchmark used when no category is available. */
const DEFAULT_WATER_BENCHMARK: WaterBenchmark = {
  litresPerLitre: 4,
  sourceName: 'BIER Beverage Industry Average',
  sourceUrl: 'https://www.bieroundtable.com/work/benchmarking/',
  sourceYear: 2023,
};

// Import-free mapping: maps category values to their group name.
// This mirrors the groups defined in product-categories.ts.
const CATEGORY_TO_GROUP: Record<string, string> = {
  // Spirits
  Gin: 'Spirits', Vodka: 'Spirits', Rum: 'Spirits', Whisky: 'Spirits',
  Tequila: 'Spirits', Mezcal: 'Spirits', Brandy: 'Spirits', Liqueur: 'Spirits',
  Bourbon: 'Spirits', 'Rye Whiskey': 'Spirits', Absinthe: 'Spirits',
  Grappa: 'Spirits', 'Other Spirits': 'Spirits',
  // Cane / grape spirits the scraper commonly meets but that weren't in
  // the closed set — without these, e.g. cachaça brands could never be
  // categorised and showed a blank "Category".
  Cachaça: 'Spirits', Cachaca: 'Spirits', Pisco: 'Spirits',
  Aguardiente: 'Spirits', Vermouth: 'Spirits',
  // Beer & Cider
  Lager: 'Beer & Cider', Ale: 'Beer & Cider', IPA: 'Beer & Cider',
  'Stout & Porter': 'Beer & Cider', 'Wheat Beer': 'Beer & Cider',
  'Sour Beer': 'Beer & Cider', Cider: 'Beer & Cider', Perry: 'Beer & Cider',
  // Wine
  'Red Wine': 'Wine', 'White Wine': 'Wine', 'Rosé': 'Wine',
  'Sparkling Wine': 'Wine', 'Fortified Wine': 'Wine', 'Natural Wine': 'Wine',
  // RTD
  'Spirit-based RTD': 'Ready-to-Drink & Cocktails',
  'Wine-based RTD': 'Ready-to-Drink & Cocktails',
  'Canned Cocktail': 'Ready-to-Drink & Cocktails',
  'Bottled Cocktail': 'Ready-to-Drink & Cocktails',
  'Hard Seltzer': 'Ready-to-Drink & Cocktails',
  'Hard Kombucha': 'Ready-to-Drink & Cocktails',
  Alcopop: 'Ready-to-Drink & Cocktails',
  // Non-Alcoholic
  'Carbonated Soft Drink': 'Non-Alcoholic', 'Still Soft Drink': 'Non-Alcoholic',
  'Energy Drink': 'Non-Alcoholic', 'Sports Drink': 'Non-Alcoholic',
  '100% Juice': 'Non-Alcoholic', Smoothie: 'Non-Alcoholic',
  'Still Water': 'Non-Alcoholic', 'Sparkling Water': 'Non-Alcoholic',
  'Coffee Drink': 'Non-Alcoholic', 'Tea Drink': 'Non-Alcoholic',
  'Non-Alcoholic Beer': 'Non-Alcoholic', 'Non-Alcoholic Wine': 'Non-Alcoholic',
  'Non-Alcoholic Cider': 'Non-Alcoholic', 'Non-Alcoholic Spirit': 'Non-Alcoholic',
  Kombucha: 'Non-Alcoholic', 'Coconut Water': 'Non-Alcoholic',
  'Functional Drink': 'Non-Alcoholic', Mixer: 'Non-Alcoholic',
  Cordial: 'Non-Alcoholic', Syrup: 'Non-Alcoholic',
  'Flavoured Water': 'Non-Alcoholic', 'Plant-Based Milk': 'Non-Alcoholic',
  'Dairy Drink': 'Non-Alcoholic', 'Other Non-Alcoholic': 'Non-Alcoholic',
};

/**
 * Every specific product category we recognise, sorted. Exposed so the
 * distributor category-detector can constrain the LLM to a closed set
 * (and validate its answer) rather than inventing free-text categories.
 */
export const KNOWN_PRODUCT_CATEGORIES: string[] = Object.keys(CATEGORY_TO_GROUP).sort();

/** True when `category` is a recognised specific product category. */
export function isKnownCategory(category: string | null | undefined): boolean {
  return !!category && Object.prototype.hasOwnProperty.call(CATEGORY_TO_GROUP, category);
}

/**
 * Ordered keyword → category rules for deterministic category inference
 * from free text (a brand name + its SKU/product names). Drinks products
 * almost always name their type in plain text ("Arcane Rhum", "X Single
 * Malt", "Y London Dry Gin"), so this resolves the vast majority of the
 * catalogue with zero LLM calls — and works on data we already hold,
 * unlike the website-corpus extractor which needs a (re)scrape.
 *
 * Rules are matched in order; the FIRST hit wins, so more specific terms
 * (bourbon, single malt, rhum agricole) precede generic ones (whisky,
 * rum). Each keyword is matched on a word boundary so "gin" doesn't fire
 * on "ginger" and "ale" doesn't fire on "pale"/"whale".
 */
const CATEGORY_KEYWORD_RULES: Array<[RegExp, string]> = [
  // Spirits — specific first
  [/\bcacha[çc]a\b/i, 'Cachaça'],
  [/\bbourbon\b/i, 'Bourbon'],
  [/\brye\s+whisk(?:e)?y\b/i, 'Rye Whiskey'],
  [/\b(?:single\s+malt|scotch|whisk(?:e)?y)\b/i, 'Whisky'],
  [/\b(?:rhum|rum)\b/i, 'Rum'],
  [/\btequila\b/i, 'Tequila'],
  [/\bme[zs]cal\b/i, 'Mezcal'],
  [/\bpisco\b/i, 'Pisco'],
  [/\baguardiente\b/i, 'Aguardiente'],
  [/\bvermouth\b/i, 'Vermouth'],
  [/\b(?:cognac|armagnac|brandy)\b/i, 'Brandy'],
  [/\bgrappa\b/i, 'Grappa'],
  [/\babsinthe\b/i, 'Absinthe'],
  [/\bvodka\b/i, 'Vodka'],
  [/\bgin\b/i, 'Gin'],
  [/\bliqueu?r\b/i, 'Liqueur'],
  // Beer & cider
  [/\bipa\b/i, 'IPA'],
  [/\b(?:stout|porter)\b/i, 'Stout & Porter'],
  [/\b(?:wheat\s+beer|witbier|hefeweizen)\b/i, 'Wheat Beer'],
  [/\b(?:sour\s+beer|gose)\b/i, 'Sour Beer'],
  [/\b(?:lager|pilsner|pils)\b/i, 'Lager'],
  [/\bpale\s+ale\b/i, 'Ale'],
  [/\bale\b/i, 'Ale'],
  [/\bbeer\b/i, 'Lager'],
  [/\bperry\b/i, 'Perry'],
  [/\bcider\b/i, 'Cider'],
  // Wine — specific varietals/styles first
  [/\b(?:champagne|prosecco|cava|cr[ée]mant|sparkling)\b/i, 'Sparkling Wine'],
  [/\b(?:port|sherry|madeira|fortified)\b/i, 'Fortified Wine'],
  [/\bnatural\s+wine\b/i, 'Natural Wine'],
  // The accented "rosé" is unambiguous wine; bare "rose" only counts when
  // followed by "wine" (avoids "rosemary"/"primrose"). A trailing \b after
  // "é" never matches in JS (é is a non-word char), so match it directly.
  [/rosé|\bros[eé]\s+wine\b/i, 'Rosé'],
  [/\b(?:red\s+wine|cabernet|merlot|shiraz|syrah|malbec|pinot\s+noir|tempranillo)\b/i, 'Red Wine'],
  [/\b(?:white\s+wine|chardonnay|sauvignon|riesling|pinot\s+grigio|chenin)\b/i, 'White Wine'],
  // RTD
  [/\bhard\s+seltzer\b/i, 'Hard Seltzer'],
];

/**
 * Best-effort deterministic category from free text (brand + product
 * names). Returns a value from {@link KNOWN_PRODUCT_CATEGORIES} or null.
 * No I/O, no LLM — pure keyword matching, safe to run on every recalc.
 */
export function inferCategoryFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [pattern, category] of CATEGORY_KEYWORD_RULES) {
    if (pattern.test(text)) return category;
  }
  return null;
}

/**
 * Get the industry benchmark for a given product category.
 * Returns category-specific override if available, otherwise group benchmark, otherwise default.
 */
export function getBenchmarkForCategory(category: string | null | undefined): IndustryBenchmark {
  if (!category) return DEFAULT_BENCHMARK;

  // Check for category-specific override first
  if (CATEGORY_OVERRIDES[category]) return CATEGORY_OVERRIDES[category];

  // Fall back to group benchmark
  const group = CATEGORY_TO_GROUP[category];
  if (group && GROUP_BENCHMARKS[group]) return GROUP_BENCHMARKS[group];

  return DEFAULT_BENCHMARK;
}

/**
 * Water benchmark lookup for a given product category. Mirrors the carbon
 * lookup: category override → group benchmark → default. Uses BIER 2023
 * mid-range water-use ratios.
 */
export function getWaterBenchmarkForCategory(
  category: string | null | undefined,
): WaterBenchmark {
  if (!category) return DEFAULT_WATER_BENCHMARK;
  if (WATER_CATEGORY_OVERRIDES[category]) return WATER_CATEGORY_OVERRIDES[category];
  const group = CATEGORY_TO_GROUP[category];
  if (group && WATER_GROUP_BENCHMARKS[group]) return WATER_GROUP_BENCHMARKS[group];
  return DEFAULT_WATER_BENCHMARK;
}

/**
 * Water benchmark lookup by org product type (with category fallback to
 * pick the dominant). Same shape as `getBenchmarkForProductType` for carbon.
 */
export function getWaterBenchmarkForProductType(
  productType: string | null | undefined,
  productCategories?: (string | null | undefined)[],
): { benchmark: WaterBenchmark; dominantCategory: string | null } {
  if (productType && WATER_GROUP_BENCHMARKS[productType]) {
    return { benchmark: WATER_GROUP_BENCHMARKS[productType], dominantCategory: productType };
  }
  if (productCategories && productCategories.length > 0) {
    const filtered = productCategories.filter((c): c is string => !!c);
    if (filtered.length === 0) {
      return { benchmark: DEFAULT_WATER_BENCHMARK, dominantCategory: null };
    }
    const counts: Record<string, number> = {};
    for (const cat of filtered) counts[cat] = (counts[cat] || 0) + 1;
    let dominant = filtered[0];
    let maxCount = 0;
    for (const [cat, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = cat;
      }
    }
    return {
      benchmark: getWaterBenchmarkForCategory(dominant),
      dominantCategory: dominant,
    };
  }
  return { benchmark: DEFAULT_WATER_BENCHMARK, dominantCategory: null };
}

/**
 * Get the industry benchmark for an organisation based on its dominant product category.
 * Takes an array of product categories and returns the benchmark for the most common one.
 */
export function getBenchmarkForOrganisation(
  productCategories: (string | null | undefined)[]
): { benchmark: IndustryBenchmark; dominantCategory: string | null } {
  const filtered = productCategories.filter((c): c is string => !!c);
  if (filtered.length === 0) return { benchmark: DEFAULT_BENCHMARK, dominantCategory: null };

  // Count occurrences
  const counts: Record<string, number> = {};
  for (const cat of filtered) {
    counts[cat] = (counts[cat] || 0) + 1;
  }

  // Find dominant
  let dominant = filtered[0];
  let maxCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cat;
    }
  }

  return {
    benchmark: getBenchmarkForCategory(dominant),
    dominantCategory: dominant,
  };
}

/**
 * Get the industry benchmark for an organisation based on its configured product type.
 * Falls back to the product-category inference method if product_type is not set.
 */
export function getBenchmarkForProductType(
  productType: string | null | undefined,
  productCategories?: (string | null | undefined)[]
): { benchmark: IndustryBenchmark; dominantCategory: string | null } {
  // If org has an explicit product type, use it directly
  if (productType && GROUP_BENCHMARKS[productType]) {
    return { benchmark: GROUP_BENCHMARKS[productType], dominantCategory: productType };
  }

  // Fall back to inference from product categories
  if (productCategories && productCategories.length > 0) {
    return getBenchmarkForOrganisation(productCategories);
  }

  return { benchmark: DEFAULT_BENCHMARK, dominantCategory: null };
}

/**
 * Convert a per-litre benchmark to a total benchmark for a given production volume.
 * This replaces the old hardcoded 50,000 kg CO2e figure.
 *
 * @param benchmark - the per-litre benchmark
 * @param totalLitres - estimated total production volume in litres
 * @returns total benchmark in kg CO2e
 */
export function getTotalBenchmark(benchmark: IndustryBenchmark, totalLitres: number): number {
  return benchmark.kgCO2ePerLitre * totalLitres;
}
