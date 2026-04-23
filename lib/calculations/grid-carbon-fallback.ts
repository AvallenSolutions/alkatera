/**
 * Grid carbon fallback factors — country-level annual averages.
 *
 * Used when live grid intensity data isn't available for a facility's
 * country. Source: IEA Emission Factors 2024 (covering generation in
 * 2022-23). Values in g CO₂/kWh, location-based, scope-2 conformant.
 *
 * Hierarchy applied at call sites:
 *   1. Live grid_carbon_readings  (sub-hourly, real-time)         🟢 confidence
 *   2. Country annual average     (this table)                    🟡 confidence
 *   3. Global average (475)       (no country code available)     🔴 confidence
 *
 * Notes:
 *   - Keys are ISO 3166-1 alpha-2 country codes (matches
 *     facilities.location_country_code / address_country)
 *   - These are LOCATION-based factors; market-based reporting using green
 *     tariffs/RECs requires AIB residual mix or supplier-specific factors
 *     (out of scope for this widget)
 *   - Refresh annually when IEA publishes new data (typically Q4)
 */

/** g CO₂/kWh, IEA 2024. */
export const GRID_CARBON_COUNTRY_AVERAGE: Record<string, number> = {
  // Europe
  AT: 110, // Austria
  BE: 165, // Belgium
  BG: 380, // Bulgaria
  HR: 175, // Croatia
  CY: 615, // Cyprus
  CZ: 415, // Czechia
  DK: 138, // Denmark
  EE: 462, // Estonia
  FI: 79,  // Finland
  FR: 56,  // France
  DE: 380, // Germany
  GR: 365, // Greece
  HU: 215, // Hungary
  IE: 296, // Ireland
  IT: 233, // Italy
  LV: 113, // Latvia
  LT: 130, // Lithuania
  LU: 60,  // Luxembourg (mostly imports)
  MT: 405, // Malta
  NL: 268, // Netherlands
  PL: 661, // Poland
  PT: 158, // Portugal
  RO: 245, // Romania
  SK: 109, // Slovakia
  SI: 215, // Slovenia
  ES: 158, // Spain
  SE: 9,   // Sweden (mostly hydro/nuclear)
  GB: 207, // UK
  NO: 30,  // Norway
  CH: 28,  // Switzerland
  IS: 28,  // Iceland (geothermal)

  // North America
  US: 369, // United States (national avg, varies hugely by state)
  CA: 130, // Canada (heavy hydro mix)
  MX: 437, // Mexico

  // South America
  AR: 312, // Argentina
  BR: 91,  // Brazil (heavy hydro)
  CL: 354, // Chile
  CO: 165, // Colombia
  PE: 248, // Peru
  UY: 134, // Uruguay (very high renewables)

  // Oceania
  AU: 540, // Australia (still coal-heavy)
  NZ: 100, // New Zealand (hydro/geo)

  // Asia-Pacific
  CN: 581, // China
  IN: 713, // India
  ID: 760, // Indonesia (coal-dominant)
  JP: 463, // Japan
  KR: 436, // South Korea
  MY: 549, // Malaysia
  PH: 654, // Philippines
  SG: 408, // Singapore
  TH: 421, // Thailand
  TW: 565, // Taiwan
  VN: 432, // Vietnam
  HK: 658, // Hong Kong

  // Middle East
  AE: 488, // UAE
  IL: 575, // Israel
  SA: 560, // Saudi Arabia
  TR: 442, // Türkiye
  QA: 491, // Qatar
  KW: 567, // Kuwait

  // Africa
  EG: 504, // Egypt
  KE: 153, // Kenya (geo/hydro)
  MA: 678, // Morocco
  NG: 437, // Nigeria
  ZA: 916, // South Africa (very coal-heavy)
  TN: 470, // Tunisia
  ET: 28,  // Ethiopia (hydro)

  // Other notable
  RU: 360, // Russia
  UA: 287, // Ukraine
  KZ: 729, // Kazakhstan
  BY: 401, // Belarus
};

/** Global average (IEA, 2022). Last-resort fallback. */
export const GLOBAL_GRID_AVERAGE_G_PER_KWH = 475;

export type GridCarbonConfidence = 'live' | 'country_average' | 'global_average';

export interface GridCarbonFactor {
  /** Intensity in g CO₂/kWh. */
  intensity: number;
  /** Confidence in this value, drives the widget's badge colour. */
  confidence: GridCarbonConfidence;
  /** Human-readable methodology source. */
  source: string;
}

/**
 * Resolve a country annual average from an ISO country code, falling back
 * to the global average if the country isn't in our table.
 *
 * `countryCode` is case-insensitive. Returns the global average for null /
 * undefined / unknown inputs (with `global_average` confidence).
 */
export function getCountryAverageGridCarbon(
  countryCode: string | null | undefined,
): GridCarbonFactor {
  if (!countryCode) {
    return {
      intensity: GLOBAL_GRID_AVERAGE_G_PER_KWH,
      confidence: 'global_average',
      source: 'IEA world average 2022 (475 g CO₂/kWh)',
    };
  }
  const code = countryCode.toUpperCase();
  const intensity = GRID_CARBON_COUNTRY_AVERAGE[code];
  if (intensity == null) {
    return {
      intensity: GLOBAL_GRID_AVERAGE_G_PER_KWH,
      confidence: 'global_average',
      source: `IEA world average 2022 (no factor for ${code})`,
    };
  }
  return {
    intensity,
    confidence: 'country_average',
    source: `IEA 2024 country average (${code}): ${intensity} g CO₂/kWh`,
  };
}

/**
 * Map a country code to a `region_code` used in `grid_carbon_readings`.
 * Currently only the UK has a live feed — anywhere else falls back to
 * country average. Easy to extend when ElectricityMaps is wired up.
 */
export function countryToLiveRegion(
  countryCode: string | null | undefined,
): string | null {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  if (code === 'GB' || code === 'UK') return 'GB-NATIONAL';
  return null;
}
