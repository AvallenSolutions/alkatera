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

// Import-free mapping: maps category values to their group name.
// This mirrors the groups defined in product-categories.ts.
const CATEGORY_TO_GROUP: Record<string, string> = {
  // Spirits
  Gin: 'Spirits', Vodka: 'Spirits', Rum: 'Spirits', Whisky: 'Spirits',
  Tequila: 'Spirits', Mezcal: 'Spirits', Brandy: 'Spirits', Liqueur: 'Spirits',
  Bourbon: 'Spirits', 'Rye Whiskey': 'Spirits', Absinthe: 'Spirits',
  Grappa: 'Spirits', 'Other Spirits': 'Spirits',
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
