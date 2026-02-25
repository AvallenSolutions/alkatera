/**
 * IPCC AR6 GWP-100 Constants (Global Warming Potential, 100-year horizon)
 *
 * Single source of truth for greenhouse gas conversion factors used across
 * the entire LCA calculation stack. All GHG-to-CO₂e conversions must use
 * these constants to ensure consistency between the waterfall resolver,
 * aggregator, report generator, and PDF templates.
 *
 * Source: IPCC Sixth Assessment Report (AR6), Working Group I, Chapter 7,
 * Table 7.15 (2021). https://www.ipcc.ch/report/ar6/wg1/
 *
 * Note on methane GWP values:
 *   - CH4_TOTAL (27.9): Weighted average of fossil + biogenic methane.
 *     Used when the fossil/biogenic split is unknown.
 *   - CH4_FOSSIL (29.8): Fossil-origin methane includes a CO₂ oxidation
 *     product credit. Used when the source is known to be fossil.
 *   - CH4_BIOGENIC (27.0): Biogenic methane (e.g. fermentation, landfill
 *     of organic waste). CO₂ product is biogenic-neutral.
 *
 * Update cadence: Review when a new IPCC Assessment Report is published
 * (next expected: AR7 ~2028). The GWP_REPORT_VERSION constant tracks
 * which report edition these values come from.
 */

/** IPCC report edition these GWP values are sourced from */
export const GWP_REPORT_VERSION = 'AR6' as const;

/**
 * IPCC AR6 GWP-100 values (kg CO₂e per kg of gas)
 *
 * Usage:
 *   co2e = mass_kg_ch4 * IPCC_AR6_GWP.CH4
 *   co2e = mass_kg_n2o * IPCC_AR6_GWP.N2O
 */
export const IPCC_AR6_GWP = {
  /** Carbon dioxide — reference gas, GWP = 1 by definition */
  CO2: 1,
  /** Methane — total (weighted average, use when fossil/biogenic split unknown) */
  CH4: 27.9,
  /** Methane — fossil origin (includes CO₂ oxidation product) */
  CH4_FOSSIL: 29.8,
  /** Methane — biogenic origin */
  CH4_BIOGENIC: 27.0,
  /** Nitrous oxide */
  N2O: 273,
} as const;

/** Type for the GWP constants object */
export type IPCC_AR6_GWP_Type = typeof IPCC_AR6_GWP;
