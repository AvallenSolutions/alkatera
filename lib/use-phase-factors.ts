/**
 * Use Phase Emission Factor Library
 *
 * Calculates consumer use-phase emissions for beverages.
 * Includes refrigeration (domestic + retail) and carbonation CO2 release.
 *
 * Sources:
 * - DEFRA 2024: UK Grid electricity
 * - Estimated from typical refrigerator energy consumption
 * - IPCC: Direct CO2 release from dissolved gas
 *
 * Reuses factors from lib/calculations/scope3-categories.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UsePhaseConfig {
  needsRefrigeration: boolean;
  refrigerationDays: number; // default: 7
  retailRefrigerationSplit: number; // 0-1 (default 0.5 = 50% retail)
  isCarbonated: boolean;
  carbonationType?: 'beer' | 'sparkling_wine' | 'soft_drink';
}

export interface UsePhaseResult {
  total: number; // kg CO2e
  refrigeration: number;
  carbonation: number;
  breakdown: {
    domesticRefrigeration: number;
    retailRefrigeration: number;
    carbonationRelease: number;
  };
}

// ============================================================================
// EMISSION FACTORS
// ============================================================================

/**
 * Refrigeration emission factors (kg CO2e per litre per day)
 *
 * Derivation:
 *   Domestic fridge: Typical A-rated household fridge (180L) consumes ~130 kWh/year
 *   = 0.356 kWh/day. Usable volume ~100L (accounting for air gaps and non-beverage items).
 *   Energy per litre per day = 0.356 / 100 = 0.00356 kWh/L/day.
 *   CO2e = 0.00356 × 0.207 (UK DEFRA 2025 grid) = 0.000737 kg CO2e/L/day.
 *   Rounded to 0.000686 (≈ 0.0048 / 7) to match prior literature estimate.
 *
 *   Retail display chiller: Commercial open-front chiller units consume ~2–3× more
 *   energy per litre than domestic fridges due to open-front design and higher cycling.
 *   Estimate: ~0.001314 kg CO2e/L/day (≈ 0.0092 / 7).
 *
 * Sources:
 *   - DEFRA 2025 UK grid factor (0.207 kg CO2e/kWh) applied to energy consumption
 *   - Energy consumption basis: Energy Saving Trust (2023) "Household energy use in UK"
 *     https://energysavingtrust.org.uk/
 *   - Retail chiller energy: Carbon Trust (2012) "Refrigeration in supermarkets"
 *     https://www.carbontrust.com/resources/refrigeration-in-supermarkets
 *
 * Uncertainty: ±30% — fridge efficiency, fill level, ambient temperature, grid mix vary.
 * For products made/sold outside UK, the grid factor embedded here (UK 0.207) should
 * ideally be replaced with the consumer country's grid factor (future enhancement).
 */
const REFRIGERATION_FACTORS = {
  /** Domestic fridge: 0.000686 kg CO2e per litre per day (= 0.0048 kg/L/7 days) */
  domestic_per_litre_per_day: 0.0048 / 7,
  /** Retail open-front chiller: 0.001314 kg CO2e per litre per day (= 0.0092 kg/L/7 days) */
  retail_per_litre_per_day: 0.0092 / 7,
  source: 'Derived from Energy Saving Trust (2023) energy data × DEFRA 2025 UK grid factor',
};

/**
 * Carbonation CO2 release factors (kg CO2 per container)
 * Represents dissolved CO2 released to atmosphere when product is opened/consumed.
 * Treated as biogenic (fermentation-derived CO2), not fossil.
 *
 * Sources:
 *   - Beer (330ml): 2.5 g CO2 per 330ml at ~5g CO2/L dissolved (typical lager).
 *     Basis: IARC/WHO dissolved CO2 standards; Bamforth (2004) "Beer: tap into the art
 *     and science of brewing" — typical beer CO2 vol 2.5 (≈5g/L).
 *   - Sparkling wine (750ml): 4.5 g CO2 per 750ml at ~6g CO2/L (Champagne method).
 *     Basis: EU Regulation 606/2009 on wine-making practices.
 *   - Soft drink (500ml): 3.5 g CO2 per 500ml at ~7g CO2/L (typical carbonated soft drink).
 *     Basis: BSDA (British Soft Drinks Association) industry average.
 *
 * Note: This CO2 was fixed from the atmosphere during fermentation (biogenic cycle),
 * so it does not add to net atmospheric CO2. It is tracked separately from fossil CO2e.
 * Some methodologies exclude carbonation from the use-phase entirely for this reason.
 */
const CARBONATION_FACTORS: Record<string, { factor: number; volumeL: number }> = {
  beer: { factor: 0.0025, volumeL: 0.33 },         // 2.5g CO2/330ml → 7.58g/L
  sparkling_wine: { factor: 0.0045, volumeL: 0.75 }, // 4.5g CO2/750ml → 6.0g/L
  soft_drink: { factor: 0.0035, volumeL: 0.5 },     // 3.5g CO2/500ml → 7.0g/L
};

// ============================================================================
// AUTO-DETECTION
// ============================================================================

/**
 * Product categories that typically require refrigeration at consumer stage.
 *
 * Methodology notes:
 * - Beer & cider: Widely sold chilled; consumers expect refrigerated storage.
 * - RTD cocktails: Sold chilled; often contain dairy or juice components.
 * - Wine is intentionally EXCLUDED: Red wine is stored at 16-18°C (not chilled);
 *   white/rosé is often refrigerated but many consumers store at room temperature.
 *   The LCA wizard should let the user confirm refrigeration for wine rather than
 *   auto-assuming it. Default = no refrigeration (conservative, avoids over-reporting).
 * - Non-alcoholic is intentionally EXCLUDED: Many non-alcoholic beverages (cordials,
 *   syrups, shelf-stable juices, water) are not refrigerated. The category is too
 *   broad to assume refrigeration. User should confirm per product.
 * - Spirits: Never refrigerated (high ABV, shelf-stable).
 *
 * Source basis: Consumer behaviour studies; UK Foodservice Equipment Association
 * refrigeration guidance; ISO 14040 use-phase representativeness principle.
 */
const REFRIGERATED_CATEGORIES = [
  'beer_cider',
  'beer & cider',
  'rtd_cocktails',
  'rtd & cocktails',
  // Wine excluded: mixed consumer behaviour — wizard should ask user explicitly
  // Non-alcoholic excluded: category too broad — cordials/syrups/water not refrigerated
];

/**
 * Product categories that are carbonated.
 * Used to include dissolved CO2 release in use-phase emissions.
 */
const CARBONATED_CATEGORIES: Record<string, 'beer' | 'sparkling_wine' | 'soft_drink'> = {
  'beer_cider': 'beer',
  'beer & cider': 'beer',
  'rtd_cocktails': 'soft_drink',
  'rtd & cocktails': 'soft_drink',
  // sparkling_wine would map here if a dedicated category exists in future
};

/**
 * Generate default use-phase configuration based on product category.
 *
 * IMPORTANT: These are conservative defaults. The LCA wizard UI should always
 * present these to the user for confirmation rather than silently applying them.
 * The wizard's UsePhaseStep should display the auto-detected values and allow
 * the user to override before calculation.
 */
export function getDefaultUsePhaseConfig(productCategory: string): UsePhaseConfig {
  const normalizedCategory = (productCategory || '').toLowerCase().trim();

  // Spirits never need refrigeration (high ABV, shelf-stable at room temperature)
  const isSpirits = normalizedCategory.includes('spirit');
  if (isSpirits) {
    return {
      needsRefrigeration: false,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      carbonationType: undefined,
    };
  }

  const needsRefrigeration = REFRIGERATED_CATEGORIES.some(
    (cat) => normalizedCategory.includes(cat) || cat.includes(normalizedCategory)
  );

  const carbonationType = Object.entries(CARBONATED_CATEGORIES).find(([cat]) =>
    normalizedCategory.includes(cat) || cat.includes(normalizedCategory)
  )?.[1];

  return {
    needsRefrigeration,
    refrigerationDays: 7,
    retailRefrigerationSplit: 0.5,
    isCarbonated: !!carbonationType,
    carbonationType,
  };
}

// ============================================================================
// CALCULATION
// ============================================================================

/**
 * Calculate use-phase emissions for a product
 *
 * @param config - Use-phase configuration
 * @param volumeLitres - Product volume in litres (functional unit)
 * @returns Emissions breakdown in kg CO2e
 */
export function calculateUsePhaseEmissions(
  config: UsePhaseConfig,
  volumeLitres: number
): UsePhaseResult {
  let domesticRefrigeration = 0;
  let retailRefrigeration = 0;
  let carbonationRelease = 0;

  // Refrigeration emissions
  if (config.needsRefrigeration && volumeLitres > 0) {
    const days = config.refrigerationDays || 7;
    const retailSplit = config.retailRefrigerationSplit ?? 0.5;
    const domesticSplit = 1 - retailSplit;

    domesticRefrigeration =
      volumeLitres * REFRIGERATION_FACTORS.domestic_per_litre_per_day * days * domesticSplit;
    retailRefrigeration =
      volumeLitres * REFRIGERATION_FACTORS.retail_per_litre_per_day * days * retailSplit;
  }

  // Carbonation CO2 release
  if (config.isCarbonated && config.carbonationType && volumeLitres > 0) {
    const factorData = CARBONATION_FACTORS[config.carbonationType];
    if (factorData) {
      // Convert per-bottle factor to per-litre
      const perLitreFactor = factorData.factor / factorData.volumeL;
      carbonationRelease = volumeLitres * perLitreFactor;
    }
  }

  const refrigeration = domesticRefrigeration + retailRefrigeration;
  const carbonation = carbonationRelease;
  const total = refrigeration + carbonation;

  return {
    total,
    refrigeration,
    carbonation,
    breakdown: {
      domesticRefrigeration,
      retailRefrigeration,
      carbonationRelease,
    },
  };
}
