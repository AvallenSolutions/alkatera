import 'server-only'

// Shared Claude tool-use input schema for UK utility-bill extraction.
// Lives here (rather than exported from a Next.js route file, which is
// prohibited — route files can only export HTTP method handlers) so both
// /api/utilities/import-from-pdf and /api/ingest/auto can reuse it verbatim.
// Kept as plain objects (no `as const`) so TypeScript returns mutable types
// that satisfy Anthropic's InputSchema contract.

export const UTILITY_TYPE_VALUES = [
  'electricity_grid',
  'heat_steam_purchased',
  'natural_gas',
  'natural_gas_m3',
  'lpg',
  'diesel_stationary',
  'heavy_fuel_oil',
  'biomass_solid',
  'refrigerant_leakage',
  'diesel_mobile',
  'petrol_mobile',
]

export const METER_TYPE_VALUES = [
  'single_rate',
  'economy_7',
  'economy_10',
  'half_hourly',
  'dual_rate',
  'other',
]

export const BILL_TOOL_INPUT_SCHEMA: {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
} = {
  type: 'object',
  properties: {
    supplier_name: {
      type: 'string',
      description:
        'Name of the utility supplier (e.g. British Gas, EDF, Octopus Energy, Thames Water).',
    },
    period_start: {
      type: 'string',
      description: 'Billing period start date in YYYY-MM-DD format.',
    },
    period_end: {
      type: 'string',
      description: 'Billing period end date in YYYY-MM-DD format.',
    },
    account_number: {
      type: 'string',
      description: 'Customer / account reference printed on the bill.',
    },
    supply_address: { type: 'string', description: 'Full address of the supply point.' },
    supply_postcode: { type: 'string', description: 'Supply postcode alone (UK format).' },
    gsp_group: {
      type: 'string',
      description:
        'UK grid supply point group / DNO region (e.g. "London", "South East") if stated.',
    },
    is_green_tariff: {
      type: 'boolean',
      description:
        'True only when the supplier explicitly claims 100% renewable electricity for this supply.',
    },
    fuel_mix: {
      type: 'object',
      description:
        'Generation mix percentages if stated. Percentages should sum close to 100.',
      properties: {
        renewable_pct: { type: 'number' },
        gas_pct: { type: 'number' },
        nuclear_pct: { type: 'number' },
        coal_pct: { type: 'number' },
        other_pct: { type: 'number' },
        source: {
          type: 'string',
          enum: ['bill', 'annual'],
          description:
            "'bill' if the mix covers this billing period; 'annual' if it's the supplier's annual disclosure.",
        },
      },
    },
    ccl_amount_gbp: {
      type: 'number',
      description: 'Climate Change Levy line total in GBP, if itemised.',
    },
    total_charged_gbp: { type: 'number', description: 'Total charge for the bill in GBP.' },
    entries: {
      type: 'array',
      description:
        'One entry per utility type found on the bill (usually one, sometimes multiple on dual-fuel bills).',
      items: {
        type: 'object',
        properties: {
          utility_type: {
            type: 'string',
            enum: UTILITY_TYPE_VALUES,
            description: `Map to one of these values:
- electricity_grid: mains electricity (kWh on bill)
- natural_gas: gas by kWh
- natural_gas_m3: gas by m³ or cubic metres
- lpg: LPG, propane, or butane (litres)
- diesel_stationary: diesel for generators or stationary equipment
- heavy_fuel_oil: HFO or fuel oil
- biomass_solid: wood pellets, chips, biogas (kg)
- heat_steam_purchased: district heat or steam
- diesel_mobile: diesel for company vehicles/fleet
- petrol_mobile: petrol for company vehicles/fleet`,
          },
          quantity: {
            type: 'number',
            description: 'Consumption quantity (not cost). E.g. 1250 for 1250 kWh.',
          },
          unit: {
            type: 'string',
            description: 'Unit matching the quantity: kWh, m3, litre, kg, etc.',
          },
          mpan: {
            type: 'string',
            description:
              'Electricity Meter Point Administration Number — 21 digits. Return as digits only, spaces stripped. Only on electricity rows.',
          },
          mprn: {
            type: 'string',
            description: 'Gas Meter Point Reference Number — 6-10 digits. Only on gas rows.',
          },
          meter_type: {
            type: 'string',
            enum: METER_TYPE_VALUES,
            description:
              'For electricity: single_rate = one unit rate; economy_7 = two rates day/night; economy_10 = three bands; half_hourly = HH-metered (typical for >100kW sites); dual_rate = day/evening weekday/weekend; other for anything else. Omit for non-electricity rows.',
          },
          rate_breakdown: {
            type: 'array',
            description:
              'For multi-rate meters: split of kWh across each rate band. E.g. [{label:"Day",kwh:1000},{label:"Night",kwh:400}].',
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'Day / Night / Peak / Off-peak / Weekend / Weekday etc.',
                },
                kwh: { type: 'number' },
                rate_p_per_kwh: {
                  type: 'number',
                  description: 'Unit rate in pence per kWh if stated.',
                },
              },
              required: ['label', 'kwh'],
            },
          },
          emissions_factor_g_per_kwh: {
            type: 'number',
            description:
              'Supplier-declared emissions factor in grams CO2e per kWh, if printed on the bill.',
          },
        },
        required: ['utility_type', 'quantity', 'unit'],
      },
    },
  },
  required: ['entries'],
}
