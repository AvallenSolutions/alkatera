/**
 * Electricity Grid Emission Factors by Country
 *
 * kg CO2e per kWh of electricity consumed (market-based, location-based average)
 *
 * Sources:
 *   - IEA (2023) "CO2 Emissions from Fuel Combustion" — primary source for most countries
 *     https://www.iea.org/data-and-statistics/data-product/emissions-factors-2023
 *   - EMBER (2023) Global Electricity Review — cross-check for recent renewable penetration
 *     https://ember-climate.org/insights/research/global-electricity-review-2023/
 *   - DEFRA (2025) UK Government GHG Conversion Factors — authoritative for UK
 *     https://www.gov.uk/government/collections/government-conversion-factors-for-greenhouse-gas-reporting
 *   - EPA eGRID (2022) — authoritative for US regions
 *     https://www.epa.gov/egrid
 *   - European Environment Agency (2022) — EU member state factors
 *     https://www.eea.europa.eu/data-and-maps/daviz/co2-emission-intensity-9
 *
 * Update cadence: These factors should be reviewed annually. The year in the
 * FACTOR_DATA_YEAR constant indicates when these figures were last validated.
 *
 * Notes:
 *   - All values are market-based annual averages (not marginal grid factors)
 *   - Does not account for time-of-day or seasonal grid variation
 *   - For facilities using 100% renewable PPAs, use 0.0 and document the PPA
 *   - Country codes follow ISO 3166-1 alpha-2
 */

export const FACTOR_DATA_YEAR = 2023;

/**
 * Grid emission factors: ISO 3166-1 alpha-2 country code → kg CO2e per kWh
 */
export const GRID_FACTORS_BY_COUNTRY: Record<string, number> = {
  // ── Europe ──────────────────────────────────────────────────────────────
  GB: 0.207,  // UK — DEFRA 2025 (most authoritative for UK operations)
  DE: 0.380,  // Germany — IEA 2023 (high coal/gas share)
  FR: 0.052,  // France — IEA 2023 (nuclear-dominant)
  IE: 0.295,  // Ireland — SEAI 2023
  ES: 0.167,  // Spain — REE 2023
  PT: 0.168,  // Portugal — APREN 2023
  IT: 0.233,  // Italy — IEA 2023
  NL: 0.270,  // Netherlands — IEA 2023
  BE: 0.149,  // Belgium — IEA 2023
  AT: 0.096,  // Austria — IEA 2023 (high hydro share)
  CH: 0.028,  // Switzerland — IEA 2023 (nuclear + hydro)
  SE: 0.013,  // Sweden — IEA 2023 (hydro + nuclear dominant)
  NO: 0.017,  // Norway — IEA 2023 (hydro dominant)
  DK: 0.148,  // Denmark — IEA 2023 (high wind)
  FI: 0.069,  // Finland — IEA 2023
  PL: 0.697,  // Poland — IEA 2023 (coal dominant)
  CZ: 0.397,  // Czechia — IEA 2023
  SK: 0.120,  // Slovakia — IEA 2023
  HU: 0.218,  // Hungary — IEA 2023
  RO: 0.247,  // Romania — IEA 2023
  GR: 0.330,  // Greece — IEA 2023
  HR: 0.156,  // Croatia — IEA 2023
  RS: 0.557,  // Serbia — IEA 2023 (coal)
  TR: 0.430,  // Turkey — IEA 2023

  // ── Americas ────────────────────────────────────────────────────────────
  US: 0.386,  // USA — EPA eGRID 2022 national average
  CA: 0.130,  // Canada — Environment Canada 2022 (high hydro)
  MX: 0.455,  // Mexico — IEA 2023
  BR: 0.074,  // Brazil — IEA 2023 (hydro dominant)
  AR: 0.314,  // Argentina — IEA 2023
  CL: 0.280,  // Chile — IEA 2023
  CO: 0.176,  // Colombia — IEA 2023
  PE: 0.215,  // Peru — IEA 2023

  // ── Asia Pacific ────────────────────────────────────────────────────────
  AU: 0.610,  // Australia — DCCEEW 2023 (coal dominant)
  NZ: 0.098,  // New Zealand — MfE 2023 (hydro dominant)
  JP: 0.433,  // Japan — IEA 2023
  CN: 0.581,  // China — IEA 2023
  IN: 0.708,  // India — IEA 2023 (coal dominant)
  KR: 0.436,  // South Korea — IEA 2023
  SG: 0.408,  // Singapore — EMA 2023
  TW: 0.494,  // Taiwan — BSMI 2023

  // ── Africa & Middle East ─────────────────────────────────────────────
  ZA: 0.928,  // South Africa — ESKOM 2023 (coal dominant)
  EG: 0.434,  // Egypt — IEA 2023
  NG: 0.427,  // Nigeria — IEA 2023
  MA: 0.636,  // Morocco — IEA 2023
  KE: 0.047,  // Kenya — IEA 2023 (geothermal dominant)
  AE: 0.384,  // UAE — IEA 2023
  SA: 0.717,  // Saudi Arabia — IEA 2023
};

/**
 * EU-27 weighted average for when country is unknown but EU region is known.
 * Source: EEA 2022 weighted average.
 */
export const EU_AVERAGE_GRID_FACTOR = 0.255;

/**
 * Global average for unknown regions.
 * Source: IEA 2023 World Energy Outlook.
 */
export const GLOBAL_AVERAGE_GRID_FACTOR = 0.490;

/**
 * Resolve the electricity grid emission factor for a given country code.
 *
 * HIGH FIX #8: The global average fallback (0.490 kg CO2e/kWh) is significantly
 * higher than many national grids (e.g. FR 0.052, SE 0.013, NO 0.017) and lower
 * than some (e.g. IN 0.708, ZA 0.928). Using it silently for unknown countries
 * can both over- and under-report facility emissions. The returned object now
 * always includes `isEstimated: true` and a clear `dataGapWarning` field when
 * a fallback is used, so callers can surface this to the user.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code (e.g. 'GB', 'DE', 'US')
 * @param fallback - What to fall back to if country not found:
 *   'uk'     → UK DEFRA factor (0.207) — previous hardcoded behaviour
 *   'eu'     → EU-27 average (0.255)
 *   'global' → Global average (0.490) — most conservative for unknown markets
 * @returns kg CO2e per kWh with provenance metadata
 */
export function getGridFactor(
  countryCode: string | null | undefined,
  fallback: 'uk' | 'eu' | 'global' = 'global'
): { factor: number; source: string; isEstimated: boolean; dataGapWarning?: string } {
  if (countryCode) {
    const normalized = countryCode.toUpperCase().trim();
    const factor = GRID_FACTORS_BY_COUNTRY[normalized];
    if (factor !== undefined) {
      return {
        factor,
        source: `IEA/DEFRA 2023 — ${normalized} national grid average`,
        isEstimated: false,
      };
    }
    // Country code provided but not in lookup table — warn
    const warning = `Country code '${normalized}' is not in the grid factor lookup table. ` +
      `Using ${fallback === 'global' ? `global average (${GLOBAL_AVERAGE_GRID_FACTOR})` : fallback === 'eu' ? `EU average (${EU_AVERAGE_GRID_FACTOR})` : `UK factor (0.207)`}. ` +
      `Add '${normalized}' to lib/grid-emission-factors.ts for more accurate results.`;
    switch (fallback) {
      case 'uk':
        return { factor: 0.207, source: `DEFRA 2025 UK — fallback (${normalized} not in lookup)`, isEstimated: true, dataGapWarning: warning };
      case 'eu':
        return { factor: EU_AVERAGE_GRID_FACTOR, source: `EEA 2022 EU-27 average — fallback (${normalized} not in lookup)`, isEstimated: true, dataGapWarning: warning };
      case 'global':
      default:
        return { factor: GLOBAL_AVERAGE_GRID_FACTOR, source: `IEA 2023 global average — fallback (${normalized} not in lookup)`, isEstimated: true, dataGapWarning: warning };
    }
  }

  // No country code provided at all
  const noCountryWarning = `No facility country code was set. Using ${fallback === 'global' ? `global average (${GLOBAL_AVERAGE_GRID_FACTOR} kg CO2e/kWh)` : fallback === 'eu' ? `EU average (${EU_AVERAGE_GRID_FACTOR} kg CO2e/kWh)` : `UK factor (0.207 kg CO2e/kWh)`}. ` +
    `Set location_country_code on the facility record for country-specific accuracy.`;
  switch (fallback) {
    case 'uk':
      return { factor: 0.207, source: 'DEFRA 2025 UK — fallback (country not specified)', isEstimated: true, dataGapWarning: noCountryWarning };
    case 'eu':
      return { factor: EU_AVERAGE_GRID_FACTOR, source: 'EEA 2022 EU-27 average — fallback (country not specified)', isEstimated: true, dataGapWarning: noCountryWarning };
    case 'global':
    default:
      return { factor: GLOBAL_AVERAGE_GRID_FACTOR, source: 'IEA 2023 global average — fallback (country unknown)', isEstimated: true, dataGapWarning: noCountryWarning };
  }
}
