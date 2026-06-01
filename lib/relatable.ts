/**
 * Human-relatable comparisons for sustainability metrics.
 *
 * Renders abstract numbers ("5.34 t CO₂e", "137 m³ water") as familiar
 * anchors a non-specialist can picture instantly — pints of beer, bathtubs,
 * km in a car. UK-centric defaults, every entry cites a defensible source.
 *
 * Pure module: no React, no Next.js imports, no `'server-only'`. Usable
 * from client components, server components, the PDF renderer, and Node
 * scripts.
 */

export type MetricKind = 'co2e' | 'water' | 'waste' | 'energy' | 'land'

/**
 * Canonical input units per metric kind. Call sites should pass values in
 * these units — no conversion is performed inside the helper.
 *
 * - co2e: kg
 * - waste: kg
 * - water: m³
 * - energy: kWh
 * - land:   hectares
 */

export interface Comparison {
  /** Display-rounded count, e.g. 44500 (or 1.2 for fractional small values). */
  count: number
  /** Unrounded count, useful for tests and downstream formatting. */
  rawCount: number
  /** Label, ready to render after the count (e.g. "km in an average UK car"). */
  label: string
  /** Lucide icon name (see iconRegistry in RelatableMetric.tsx). */
  icon: string
  /** Citable source string shown in the methodology tooltip. */
  source: string
}

interface RegistryEntry {
  /** Canonical input units consumed per 1 reference unit. */
  perInputUnit: number
  /** Plural-default label. Most read fine for "1" too ("1 km in an average UK car"). */
  label: string
  /** Optional singular override used when count rounds to exactly 1. */
  labelSingular?: string
  /** Lucide icon name. */
  icon: string
  source: string
  /** Result range that "feels right" for this entry. Used by the selector. */
  niceRange: [number, number]
}

const REGISTRY: Record<MetricKind, RegistryEntry[]> = {
  co2e: [
    {
      perInputUnit: 0.028,
      label: 'helium balloons of CO₂ gas',
      labelSingular: 'helium balloon of CO₂ gas',
      icon: 'Sparkles',
      source: 'Volume of 1 kg CO₂ at standard temperature and pressure ÷ standard 14 L party balloon',
      niceRange: [10, 100_000],
    },
    {
      perInputUnit: 0.12,
      label: 'km in an average UK car',
      icon: 'Car',
      source: 'DEFRA UK Government GHG Conversion Factors 2024, average passenger car',
      niceRange: [10, 200_000],
    },
    {
      perInputUnit: 0.6,
      label: 'loads of laundry',
      labelSingular: 'load of laundry',
      icon: 'Shirt',
      source: 'Energy Saving Trust UK (~0.6 kg CO₂e per warm-wash cycle)',
      niceRange: [10, 100_000],
    },
    {
      perInputUnit: 50,
      label: 'one-way flights London to Edinburgh, economy',
      labelSingular: 'one-way flight London to Edinburgh, economy',
      icon: 'Plane',
      source: 'DEFRA UK Government GHG Conversion Factors 2024, domestic UK economy',
      niceRange: [5, 10_000],
    },
    {
      perInputUnit: 10,
      label: "days of an average UK person's footprint",
      labelSingular: "day of an average UK person's footprint",
      icon: 'User',
      source: "UK per-capita ~3.5 t CO₂e/year ≈ 10 kg/day (DEFRA / Carbon Trust)",
      niceRange: [5, 50_000],
    },
    {
      perInputUnit: 1_600,
      label: 'round-trip flights London to New York, economy',
      labelSingular: 'round-trip flight London to New York, economy',
      icon: 'Plane',
      source: 'DEFRA UK Government GHG Conversion Factors 2024, long-haul economy passenger',
      niceRange: [1, 1_000],
    },
    {
      perInputUnit: 2_700,
      label: "UK households' annual energy emissions",
      labelSingular: "UK household's annual energy emissions",
      icon: 'Home',
      source: 'BEIS UK average household energy emissions (gas + electricity combined)',
      niceRange: [1, 500],
    },
  ],
  water: [
    {
      perInputUnit: 0.00075,
      label: '75 cl wine bottles',
      labelSingular: '75 cl wine bottle',
      icon: 'Wine',
      source: 'Standard 75 cl bottle volume',
      niceRange: [10, 100_000],
    },
    {
      perInputUnit: 0.07,
      label: '7-minute showers',
      labelSingular: '7-minute shower',
      icon: 'Droplets',
      source: 'Water UK average shower flow (10 L/min × 7 min)',
      niceRange: [5, 50_000],
    },
    {
      perInputUnit: 0.14,
      label: 'days of average UK personal water use',
      labelSingular: 'day of average UK personal water use',
      icon: 'User',
      source: 'Water UK 2024 (~140 L/person/day)',
      niceRange: [5, 50_000],
    },
    {
      perInputUnit: 0.15,
      label: 'standard UK bathtubs',
      labelSingular: 'standard UK bathtub',
      icon: 'Bath',
      source: 'Water UK average bathtub volume (~150 L)',
      niceRange: [5, 50_000],
    },
    {
      perInputUnit: 2_500,
      label: 'Olympic swimming pools',
      labelSingular: 'Olympic swimming pool',
      icon: 'Waves',
      source: 'FINA-approved Olympic pool (50 m × 25 m × 2 m = 2,500 m³)',
      niceRange: [1, 1_000],
    },
  ],
  waste: [
    {
      perInputUnit: 12,
      label: 'black bin bags',
      labelSingular: 'black bin bag',
      icon: 'Trash2',
      source: 'WRAP UK average black bin bag (~12 kg full)',
      niceRange: [10, 100_000],
    },
    {
      perInputUnit: 20,
      label: "UK households' weekly waste",
      labelSingular: "UK household's weekly waste",
      icon: 'Home',
      source: 'WRAP UK household waste (~20 kg/week)',
      niceRange: [5, 50_000],
    },
    {
      perInputUnit: 1_500,
      label: 'average family cars by weight',
      labelSingular: 'average family car by weight',
      icon: 'Car',
      source: 'Average UK family car kerb weight (~1,500 kg)',
      niceRange: [1, 10_000],
    },
    {
      perInputUnit: 6_000,
      label: 'African elephants by weight',
      labelSingular: 'African elephant by weight',
      icon: 'PawPrint',
      source: 'Adult African elephant ~6,000 kg',
      niceRange: [1, 5_000],
    },
  ],
  energy: [
    {
      perInputUnit: 0.012,
      label: 'smartphone full charges',
      labelSingular: 'smartphone full charge',
      icon: 'Smartphone',
      source: '~12 Wh per full smartphone charge',
      niceRange: [10, 1_000_000],
    },
    {
      perInputUnit: 0.1,
      label: 'kettle boils',
      labelSingular: 'kettle boil',
      icon: 'Coffee',
      source: '~0.1 kWh per full 1.7 L kettle boil',
      niceRange: [10, 500_000],
    },
    {
      perInputUnit: 50,
      label: 'EV full charges, mid-range battery',
      labelSingular: 'EV full charge, mid-range battery',
      icon: 'BatteryCharging',
      source: 'Typical mid-range EV battery (~50 kWh)',
      niceRange: [5, 100_000],
    },
    {
      perInputUnit: 2_900,
      label: "UK homes' annual electricity",
      labelSingular: "UK home's annual electricity",
      icon: 'Home',
      source: 'Ofgem UK average household electricity (~2,900 kWh/year)',
      niceRange: [1, 10_000],
    },
  ],
  land: [
    {
      perInputUnit: 0.026,
      label: 'tennis courts',
      labelSingular: 'tennis court',
      icon: 'Square',
      source: 'ITF tennis court footprint (~260 m²)',
      niceRange: [10, 50_000],
    },
    {
      perInputUnit: 0.714,
      label: 'football pitches',
      labelSingular: 'football pitch',
      icon: 'Goal',
      source: 'FIFA pitch footprint (~7,140 m²)',
      niceRange: [5, 10_000],
    },
    {
      perInputUnit: 140,
      label: "Hyde Parks (London)",
      labelSingular: 'Hyde Park (London)',
      icon: 'Map',
      source: 'Hyde Park, London (~140 hectares)',
      niceRange: [1, 1_000],
    },
  ],
}

const SAFE_MAX_RESULT = 1_000_000_000

function scoreResult(result: number, range: [number, number]): number {
  if (!Number.isFinite(result) || result <= 0) return Infinity
  const logResult = Math.log10(result)
  const logMin = Math.log10(range[0])
  const logMax = Math.log10(range[1])
  const sweetSpot = (logMin + logMax) / 2
  const halfRange = (logMax - logMin) / 2
  const distance = Math.abs(logResult - sweetSpot)
  if (distance <= halfRange) return distance
  return distance + (distance - halfRange) * 5
}

export function relatable(
  kind: MetricKind,
  value: number,
  opts?: { max?: number },
): Comparison[] {
  const max = opts?.max ?? 3
  if (!Number.isFinite(value) || value <= 0) return []
  const entries = REGISTRY[kind]
  if (!entries || entries.length === 0) return []

  const scored = entries
    .map((entry) => {
      const result = value / entry.perInputUnit
      const score = scoreResult(result, entry.niceRange)
      return { entry, result, score }
    })
    .filter((s) => s.result >= 1 && s.result < SAFE_MAX_RESULT)

  scored.sort((a, b) => a.score - b.score)

  return scored.slice(0, max).map(({ entry, result }) => {
    const rounded = roundForDisplay(result)
    const labelSingular = entry.labelSingular ?? entry.label
    return {
      rawCount: result,
      count: rounded,
      label: rounded === 1 ? labelSingular : entry.label,
      icon: entry.icon,
      source: entry.source,
    }
  })
}

/**
 * Round for human display.
 *
 * - < 10:    one decimal place ("3.5")
 * - < 100:   integer ("47")
 * - >= 100:  two significant figures ("44,500", "1,200,000")
 */
export function roundForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 10) return Math.round(n * 10) / 10
  if (n < 100) return Math.round(n)
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / magnitude) * magnitude
}

/**
 * Human-friendly count formatting with UK separators and "million" abbreviation.
 *   1234     → "1,234"
 *   44500    → "44,500"
 *   1200000  → "1.2 million"
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m < 10 ? m.toFixed(1) : Math.round(m).toLocaleString('en-GB')} million`
  }
  if (n < 10 && !Number.isInteger(n)) return n.toFixed(1)
  return Math.round(n).toLocaleString('en-GB')
}

export const __testing = { REGISTRY, scoreResult }
