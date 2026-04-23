/**
 * Pulse -- Quarterly reference shadow prices.
 *
 * This file is the single source of truth for the global default shadow
 * prices that Pulse applies when an org hasn't set their own override.
 *
 * HOW TO UPDATE EACH QUARTER
 * ==========================
 * 1. Review the current market / regulatory rates (sources listed below).
 * 2. Update the `price_per_unit` and `source` fields in REFERENCE_PRICES.
 * 3. Update REFERENCE_QUARTER to the new quarter label (e.g. "Q3 2026").
 * 4. Commit and deploy — the quarterly cron will pick up the new values
 *    automatically and upsert them with today's effective_from date.
 *
 * SOURCES
 * =======
 * - UK ETS carbon price:  https://www.gov.uk/guidance/uk-ets-market-stability-mechanism
 *                         ICE futures front-month UKA (via brokers or financial press)
 *                         Current reserve price / floor: ~£22; market ~£30-90 range.
 * - Water (Ofwat):        https://www.ofwat.gov.uk/households/your-water-bill/
 *                         Business rates ~£2-4/m3 depending on region.
 * - Waste (landfill tax): https://www.gov.uk/government/publications/rates-and-allowances-landfill-tax
 *                         Standard rate set in each Autumn Budget.
 *
 * IMPORTANT
 * =========
 * Do NOT change the `metric_key`, `currency`, `unit` or `native_unit_multiplier`
 * fields -- they must stay in sync with the org_shadow_prices table schema.
 * Only change `price_per_unit` and `source`.
 */

export const REFERENCE_QUARTER = 'Q2 2026';

export interface ReferencePriceRow {
  metric_key: string;
  currency: string;
  price_per_unit: number;
  unit: string;
  /** Multiplier to convert metric_snapshots.value → price unit. */
  native_unit_multiplier: number;
  source: string;
}

export const REFERENCE_PRICES: ReferencePriceRow[] = [
  {
    metric_key: 'total_co2e',
    currency: 'GBP',
    price_per_unit: 85.00,
    unit: 'tCO2e',
    native_unit_multiplier: 0.001, // snapshots in kg, price per tonne
    source: `UK ETS average ${REFERENCE_QUARTER}`,
  },
  {
    metric_key: 'water_consumption',
    currency: 'GBP',
    price_per_unit: 2.50,
    unit: 'm3',
    native_unit_multiplier: 1,
    source: `Ofwat UK business average ${REFERENCE_QUARTER}`,
  },
  {
    metric_key: 'waste_total',
    currency: 'GBP',
    price_per_unit: 103.70,
    unit: 'tonne',
    native_unit_multiplier: 0.001, // snapshots in kg
    source: `UK landfill tax standard rate ${REFERENCE_QUARTER}`,
  },
];
