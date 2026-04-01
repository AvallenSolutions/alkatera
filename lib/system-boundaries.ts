/**
 * System Boundary Definitions
 *
 * Single source of truth for LCA system boundary tiers
 * used across the entire platform: wizard, reports, PDF, passport, etc.
 */

export type SystemBoundary =
  | 'cradle-to-gate'
  | 'cradle-to-shelf'
  | 'cradle-to-consumer'
  | 'cradle-to-grave';

export const ALL_LIFECYCLE_STAGES = [
  'raw_materials',
  'processing',
  'packaging',
  'distribution',
  'use_phase',
  'end_of_life',
] as const;

export type LifecycleStage = (typeof ALL_LIFECYCLE_STAGES)[number];

export interface SystemBoundaryDefinition {
  value: SystemBoundary;
  label: string;
  shortLabel: string;
  description: string;
  includedStages: LifecycleStage[];
}

export const SYSTEM_BOUNDARIES: SystemBoundaryDefinition[] = [
  {
    value: 'cradle-to-gate',
    label: 'Cradle-to-Gate',
    shortLabel: 'Gate',
    description: 'Raw materials through factory gate',
    includedStages: ['raw_materials', 'processing', 'packaging'],
  },
  {
    value: 'cradle-to-shelf',
    label: 'Cradle-to-Shelf',
    shortLabel: 'Shelf',
    description: 'Includes distribution to point of sale',
    includedStages: ['raw_materials', 'processing', 'packaging', 'distribution'],
  },
  {
    value: 'cradle-to-consumer',
    label: 'Cradle-to-Consumer',
    shortLabel: 'Consumer',
    description: 'Includes consumer use phase (refrigeration, carbonation)',
    includedStages: ['raw_materials', 'processing', 'packaging', 'distribution', 'use_phase'],
  },
  {
    value: 'cradle-to-grave',
    label: 'Cradle-to-Grave',
    shortLabel: 'Grave',
    description: 'Full lifecycle including end-of-life disposal & recycling',
    includedStages: [
      'raw_materials',
      'processing',
      'packaging',
      'distribution',
      'use_phase',
      'end_of_life',
    ],
  },
];

/**
 * Friendly display names for lifecycle stages
 */
export const STAGE_LABELS: Record<LifecycleStage, string> = {
  raw_materials: 'Raw Materials',
  processing: 'Processing',
  packaging: 'Packaging',
  distribution: 'Distribution',
  use_phase: 'Use Phase',
  end_of_life: 'End of Life',
};

/**
 * Get the full definition for a system boundary value
 */
export function getBoundaryDefinition(boundary: string): SystemBoundaryDefinition {
  return (
    SYSTEM_BOUNDARIES.find((b) => b.value === boundary) ||
    SYSTEM_BOUNDARIES[0] // Default to cradle-to-gate
  );
}

/**
 * Get the human-readable label for a system boundary
 */
export function getBoundaryLabel(boundary: string): string {
  return getBoundaryDefinition(boundary).label;
}

/**
 * Get the included lifecycle stages for a system boundary
 */
export function getBoundaryIncludedStages(boundary: string): LifecycleStage[] {
  return getBoundaryDefinition(boundary).includedStages;
}

/**
 * Get the excluded lifecycle stages for a system boundary
 */
export function getBoundaryExcludedStages(boundary: string): LifecycleStage[] {
  const included = new Set(getBoundaryIncludedStages(boundary));
  return ALL_LIFECYCLE_STAGES.filter((s) => !included.has(s)) as LifecycleStage[];
}

/**
 * Check if a lifecycle stage is included in a system boundary
 */
export function isStageIncluded(boundary: string, stage: string): boolean {
  return getBoundaryIncludedStages(boundary).includes(stage as LifecycleStage);
}

/**
 * Whether the boundary requires use-phase configuration
 */
export function boundaryNeedsUsePhase(boundary: string): boolean {
  return boundary === 'cradle-to-consumer' || boundary === 'cradle-to-grave';
}

/**
 * Whether the boundary requires end-of-life configuration
 */
export function boundaryNeedsEndOfLife(boundary: string): boolean {
  return boundary === 'cradle-to-grave';
}

/**
 * Whether the boundary requires distribution configuration
 */
export function boundaryNeedsDistribution(boundary: string): boolean {
  return boundary === 'cradle-to-shelf' || boundary === 'cradle-to-consumer' || boundary === 'cradle-to-grave';
}

/**
 * Convert between DB enum format (underscores) and code format (hyphens)
 */
export function boundaryToDbEnum(boundary: string): string {
  return boundary.replace(/-/g, '_');
}

export function boundaryFromDbEnum(dbValue: string): SystemBoundary {
  return dbValue.replace(/_/g, '-') as SystemBoundary;
}

/**
 * Product loss rates at downstream lifecycle stages.
 * Applied as an upstream emission multiplier: lost units' burden
 * is allocated to the units that survive to the next stage.
 */
export interface ProductLossConfig {
  distributionLossPercent: number;  // % lost during distribution (default 2)
  retailLossPercent: number;        // % lost at retail/storage (default 3)
  consumerWastePercent: number;     // % wasted by consumer (category-dependent)
}

/**
 * Consumer waste data entry: rate + source provenance.
 */
export interface ConsumerWasteEntry {
  rate: number;       // % of purchased product not consumed
  source: string;     // Short citation or methodology note
  confidence: 'high' | 'medium' | 'low';  // Data quality indicator
}

/**
 * Category-specific consumer waste defaults (% of purchased product not consumed).
 * Each entry carries its source citation and a confidence level:
 *  - high: directly supported by published LCA studies or government data
 *  - medium: derived from closely related published data
 *  - low: estimated by analogy from adjacent categories
 */
export const CONSUMER_WASTE_DATA: Record<string, ConsumerWasteEntry> = {
  // ── Spirits (1%) ──────────────────────────────────────────────────────
  // High ABV preserves indefinitely; served in measured quantities.
  'Gin':          { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Vodka':        { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Rum':          { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Whisky':       { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Tequila':      { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Mezcal':       { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Brandy':       { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Bourbon':      { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Rye Whiskey':  { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Calvados':     { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Baijiu':       { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Aquavit':      { rate: 1,  source: 'BIER carbon footprint research; high ABV self-preserves', confidence: 'high' },
  'Liqueur':      { rate: 3,  source: 'Adjusted from spirits baseline; cream/sugar liqueurs have shorter shelf life', confidence: 'medium' },

  // ── Beer & Cider (3%) ────────────────────────────────────────────────
  // Mostly single-serve cans/bottles; main waste is unfinished dregs.
  'Lager':          { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'Ale':            { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'IPA':            { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'Stout & Porter': { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'Wheat Beer':     { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'Sour Beer':      { rate: 3, source: 'EU PEFCR Beer (2018); WRAP household waste data', confidence: 'high' },
  'Cider':          { rate: 3, source: 'Grouped with beer in WRAP data; same single-serve format', confidence: 'medium' },
  'Perry':          { rate: 3, source: 'Grouped with cider in WRAP data; same single-serve format', confidence: 'medium' },

  // ── Wine (10%) ────────────────────────────────────────────────────────
  // Multi-serve 750ml bottles; oxidation after opening is the main driver.
  'Red Wine':       { rate: 10, source: 'WRAP UK data; MDPI wine closure study (Sustainability, 2012, 4(10), 2673)', confidence: 'high' },
  'White Wine':     { rate: 10, source: 'WRAP UK data; MDPI wine closure study (Sustainability, 2012, 4(10), 2673)', confidence: 'high' },
  'Rosé':           { rate: 10, source: 'WRAP UK data; aligned with still wine baseline', confidence: 'high' },
  'Natural Wine':   { rate: 12, source: 'Still wine baseline + minimal sulphites reduce shelf life once opened', confidence: 'medium' },
  'Fortified Wine': { rate: 3,  source: 'Higher ABV (17-22%) self-preserves like spirits; analogous to liqueur', confidence: 'medium' },
  'Sparkling Wine': { rate: 15, source: 'Still wine baseline + rapid carbonation loss after opening', confidence: 'medium' },

  // ── Ready-to-Drink & Cocktails (2%) ──────────────────────────────────
  // Almost always single-serve cans, consumed in one sitting.
  'Spirit-based RTD': { rate: 2, source: 'Single-serve format; analogous to canned beer', confidence: 'medium' },
  'Wine-based RTD':   { rate: 2, source: 'Single-serve format; analogous to canned beer', confidence: 'medium' },
  'Canned Cocktail':  { rate: 2, source: 'Single-serve format; analogous to canned beer', confidence: 'medium' },
  'Bottled Cocktail': { rate: 3, source: 'Multi-serve bottles have higher waste than cans', confidence: 'low' },
  'Hard Seltzer':     { rate: 2, source: 'Single-serve format; analogous to canned beer', confidence: 'medium' },
  'Hard Kombucha':    { rate: 3, source: 'Live culture increases spoilage risk vs standard RTD', confidence: 'low' },
  'Alcopop':          { rate: 2, source: 'Single-serve format; analogous to canned beer', confidence: 'medium' },

  // ── Non-Alcoholic ────────────────────────────────────────────────────
  'Carbonated Soft Drink':    { rate: 5, source: 'WRAP "Down the Drain" campaign; 240k tonnes/year UK', confidence: 'high' },
  'Still Soft Drink':         { rate: 3, source: 'No carbonation loss; lower than fizzy equivalents', confidence: 'medium' },
  'Energy Drink':             { rate: 2, source: 'Single-serve cans; consumed during activity', confidence: 'medium' },
  'Sports Drink':             { rate: 2, source: 'Single-serve bottles; consumed during activity', confidence: 'medium' },
  '100% Juice':               { rate: 7, source: 'Perishable once opened (3-7 days refrigerated)', confidence: 'medium' },
  'Juice Drink':              { rate: 5, source: 'Less perishable than pure juice; preservatives extend life', confidence: 'medium' },
  'Smoothie':                 { rate: 7, source: 'Perishable; short fridge life (2-3 days)', confidence: 'medium' },
  'Still Water':              { rate: 2, source: 'EU PEFCR Packaged Water (2018); no spoilage mechanism', confidence: 'high' },
  'Sparkling Water':          { rate: 3, source: 'Some carbonation loss in multi-serve bottles', confidence: 'medium' },
  'Flavoured Water':          { rate: 3, source: 'Aligned with sparkling water; minimal spoilage', confidence: 'low' },
  'Functional Beverage':      { rate: 3, source: 'Typically single-serve; minimal spoilage risk', confidence: 'low' },
  'Plant-based Milk':         { rate: 8, source: 'Short shelf life once opened (5-7 days); multi-serve cartons', confidence: 'medium' },
  'Coffee Drink':             { rate: 2, source: 'Typically single-serve RTD format', confidence: 'low' },
  'Tea Drink':                { rate: 3, source: 'Typically single-serve RTD format', confidence: 'low' },
  'Kombucha (Non-Alcoholic)': { rate: 7, source: 'Live culture continues fermenting; product becomes too sour', confidence: 'low' },
  'Non-Alcoholic Spirit':     { rate: 5, source: 'No alcohol preservative; shorter shelf life than spirits', confidence: 'low' },
  'Non-Alcoholic Liqueur':    { rate: 5, source: 'No alcohol preservative; shorter shelf life than liqueur', confidence: 'low' },
  'Non-Alcoholic Beer':       { rate: 4, source: 'Single-serve format but no alcohol preservative', confidence: 'low' },
  'Non-Alcoholic Wine':       { rate: 8, source: 'Multi-serve bottle + no alcohol preservative; faster spoilage than wine', confidence: 'low' },
  'Non-Alcoholic Cider':      { rate: 4, source: 'Single-serve format but no alcohol preservative', confidence: 'low' },
};

/**
 * Flat rate-only lookup for backward compatibility and fast access.
 * Auto-derived from CONSUMER_WASTE_DATA.
 */
export const CONSUMER_WASTE_BY_CATEGORY: Record<string, number> =
  Object.fromEntries(
    Object.entries(CONSUMER_WASTE_DATA).map(([k, v]) => [k, v.rate])
  );

/**
 * Fallback consumer waste defaults by product type group.
 * Used when the specific product category is not in the map above.
 */
export const CONSUMER_WASTE_BY_GROUP: Record<string, number> = {
  'Spirits': 1,
  'Beer & Cider': 3,
  'Wine': 10,
  'Ready-to-Drink & Cocktails': 2,
  'Non-Alcoholic': 4,
};

/**
 * Get the default consumer waste percentage for a product based on its
 * category (specific) and/or product type (group). Falls back to 5% if
 * neither is recognised.
 */
export function getDefaultConsumerWaste(
  productCategory?: string | null,
  productType?: string | null
): number {
  if (productCategory && productCategory in CONSUMER_WASTE_BY_CATEGORY) {
    return CONSUMER_WASTE_BY_CATEGORY[productCategory];
  }
  if (productType && productType in CONSUMER_WASTE_BY_GROUP) {
    return CONSUMER_WASTE_BY_GROUP[productType];
  }
  return 5; // Conservative global fallback
}

/**
 * Get the full consumer waste entry (rate + source + confidence) for a
 * product category. Returns null if no category-specific data exists.
 */
export function getConsumerWasteEntry(
  productCategory?: string | null
): ConsumerWasteEntry | null {
  if (productCategory && productCategory in CONSUMER_WASTE_DATA) {
    return CONSUMER_WASTE_DATA[productCategory];
  }
  return null;
}

/**
 * Build a default ProductLossConfig for a product, with category-aware
 * consumer waste and standard distribution/retail defaults.
 */
export function getDefaultLossConfig(
  productCategory?: string | null,
  productType?: string | null
): ProductLossConfig {
  return {
    distributionLossPercent: 2,
    retailLossPercent: 3,
    consumerWastePercent: getDefaultConsumerWaste(productCategory, productType),
  };
}

export const DEFAULT_PRODUCT_LOSS_CONFIG: ProductLossConfig = {
  distributionLossPercent: 2,
  retailLossPercent: 3,
  consumerWastePercent: 5,  // Generic fallback; prefer getDefaultLossConfig() for accuracy
};

/**
 * Calculate the upstream loss multiplier for a given boundary and loss config.
 * Each stage's loss compounds: survival = (1-dist)(1-retail)(1-consumer).
 * Only stages included in the boundary contribute losses.
 * Returns 1.0 when no adjustment is needed.
 */
export function calculateLossMultiplier(
  boundary: string,
  config?: ProductLossConfig
): number {
  if (!config) return 1.0;

  const dist = isStageIncluded(boundary, 'distribution')
    ? (config.distributionLossPercent || 0) / 100 : 0;
  const retail = isStageIncluded(boundary, 'distribution')
    ? (config.retailLossPercent || 0) / 100 : 0;
  const consumer = isStageIncluded(boundary, 'use_phase')
    ? (config.consumerWastePercent || 0) / 100 : 0;

  const survivalRate = (1 - dist) * (1 - retail) * (1 - consumer);

  if (survivalRate <= 0) return 1.0; // Guard against division by zero
  if (survivalRate >= 1) return 1.0; // No losses

  return 1 / survivalRate;
}
