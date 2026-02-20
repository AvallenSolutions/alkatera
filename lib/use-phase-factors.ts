/**
 * Use Phase Emission Factor Library
 *
 * Calculates consumer use-phase emissions for beverages.
 * Includes refrigeration (domestic + retail) and carbonation CO2 release.
 *
 * Sources:
 * - DEFRA 2025: UK Grid electricity (default fallback)
 * - IEA 2023: Country-specific grid factors (via lib/grid-emission-factors.ts)
 * - Estimated from typical refrigerator energy consumption
 * - IPCC: Direct CO2 release from dissolved gas
 *
 * Reuses factors from lib/calculations/scope3-categories.ts
 */

import { getGridFactor } from './grid-emission-factors';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePhaseConfig {
  needsRefrigeration: boolean;
  refrigerationDays: number; // default: 7
  retailRefrigerationSplit: number; // 0-1 (default 0.5 = 50% retail)
  isCarbonated: boolean;
  carbonationType?: 'beer' | 'sparkling_wine' | 'soft_drink';
  /**
   * ISO 3166-1 alpha-2 country code for the consumer market.
   * Used to select the correct electricity grid emission factor for refrigeration.
   * When null/undefined, falls back to global average (0.490 kg CO2e/kWh).
   * Pass the product's primary market country for best accuracy.
   * Example: 'GB' = UK, 'DE' = Germany, 'US' = USA, 'FR' = France.
   */
  consumerCountryCode?: string | null;
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
 * Refrigeration energy consumption factors (kWh per litre per day)
 *
 * These are ENERGY values (not CO2e). They are multiplied by the consumer
 * country's electricity grid factor at calculation time, so the emissions
 * correctly reflect where the product is consumed rather than always using
 * the UK grid factor regardless of market.
 *
 * Derivation:
 *   Domestic fridge: Typical A-rated household fridge (180L) consumes ~130 kWh/year
 *   = 0.356 kWh/day. Usable volume ~100L (accounting for air gaps and non-beverage items).
 *   Energy per litre per day = 0.356 / 100 = 0.00356 kWh/L/day.
 *
 *   Retail display chiller: Commercial open-front chiller units consume ~2–3× more
 *   energy per litre than domestic fridges due to open-front design and higher cycling.
 *   Estimate: ~0.00636 kWh/L/day (≈ 0.00356 × 1.79).
 *
 * Sources:
 *   - Energy consumption basis: Energy Saving Trust (2023) "Household energy use in UK"
 *     https://energysavingtrust.org.uk/
 *   - Retail chiller energy: Carbon Trust (2012) "Refrigeration in supermarkets"
 *     https://www.carbontrust.com/resources/refrigeration-in-supermarkets
 *   - Grid emission factor applied at calculation time from lib/grid-emission-factors.ts
 *     (IEA 2023 / DEFRA 2025). Default fallback: global average 0.490 kg CO2e/kWh.
 *
 * Uncertainty: ±30% — fridge efficiency, fill level, ambient temperature, grid mix vary.
 */
const REFRIGERATION_ENERGY = {
  /** Domestic fridge: ~0.00356 kWh per litre per day */
  domestic_kwh_per_litre_per_day: 0.00356,
  /** Retail open-front chiller: ~0.00636 kWh per litre per day (≈ domestic × 1.79) */
  retail_kwh_per_litre_per_day: 0.00636,
  source: 'Energy Saving Trust (2023); Carbon Trust (2012). Grid factor applied per consumer country.',
};

/**
 * Default electricity grid factor for refrigeration when consumer country is unknown.
 * Uses global average (IEA 2023) — conservative choice that avoids underestimating
 * the use-phase impact of products sold in high-carbon-grid markets.
 *
 * Source: IEA (2023) World Energy Outlook — global average grid factor.
 */
const DEFAULT_REFRIGERATION_GRID_FACTOR = 0.490; // kg CO2e/kWh, IEA 2023 global average

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
 * Calculate use-phase emissions for a product.
 *
 * Refrigeration emissions are calculated using the consumer country's
 * electricity grid factor (via lib/grid-emission-factors.ts), or the global
 * average (0.490 kg CO2e/kWh) when the country is not specified.
 * This corrects the previous behaviour of always using the UK grid factor
 * (0.207 kg CO2e/kWh) regardless of where the product is sold.
 *
 * @param config - Use-phase configuration (include consumerCountryCode for best accuracy)
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

    // Resolve the consumer country grid factor.
    // CRITICAL FIX: Previously this used hardcoded UK factor (0.207) regardless
    // of where the product is sold. Now it uses the consumer country's factor,
    // falling back to the global average (0.490) when country is unknown.
    // This can be up to 4× different between low-carbon grids (FR: 0.052) and
    // high-carbon grids (IN: 0.708), so country matters significantly.
    const gridFactorResult = config.consumerCountryCode
      ? getGridFactor(config.consumerCountryCode, 'global')
      : { factor: DEFAULT_REFRIGERATION_GRID_FACTOR, source: 'IEA 2023 global average (consumer country not specified)', isEstimated: true };

    const gridFactor = gridFactorResult.factor;

    // Convert energy consumption to CO2e using country-specific grid factor
    const domesticCO2ePerLitrePerDay = REFRIGERATION_ENERGY.domestic_kwh_per_litre_per_day * gridFactor;
    const retailCO2ePerLitrePerDay = REFRIGERATION_ENERGY.retail_kwh_per_litre_per_day * gridFactor;

    domesticRefrigeration = volumeLitres * domesticCO2ePerLitrePerDay * days * domesticSplit;
    retailRefrigeration = volumeLitres * retailCO2ePerLitrePerDay * days * retailSplit;
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
