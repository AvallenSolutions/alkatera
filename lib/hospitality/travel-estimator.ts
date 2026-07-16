/**
 * Guest / attendee travel carbon estimator for hospitality events (modal-split
 * method). Given the number of attendees, the split by transport mode and an
 * average one-way distance, returns total and per-attendee travel CO2e using
 * DESNZ/BEIS 2024 passenger emission factors (round trip = 2 × one-way).
 *
 * The postcode-distance method (ONS centroids) is a heavier follow-on; this
 * modal-split version is self-contained and needs no external data.
 */

export type TravelMode = 'car' | 'train' | 'bus' | 'coach' | 'motorcycle' | 'cycle' | 'walk' | 'domestic_flight'

/** kg CO2e per passenger-km (DESNZ 2024 GHG conversion factors, well-to-wheel where published). */
export const TRAVEL_FACTORS: Record<TravelMode, number> = {
  car: 0.1665, // average car, per passenger-km
  train: 0.0354, // national rail
  bus: 0.102, // local bus
  coach: 0.0271,
  motorcycle: 0.1136,
  cycle: 0,
  walk: 0,
  domestic_flight: 0.2443,
}

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  car: 'Car',
  train: 'Train',
  bus: 'Bus',
  coach: 'Coach',
  motorcycle: 'Motorcycle',
  cycle: 'Cycle',
  walk: 'Walk',
  domestic_flight: 'Domestic flight',
}

export interface TravelSplit {
  /** Percentage of attendees using each mode (0-100). Missing modes = 0. */
  split: Partial<Record<TravelMode, number>>
  /** Average one-way distance to the venue, km. */
  avg_distance_km: number
  attendees: number
}

export interface TravelEstimate {
  total_kg: number
  per_attendee_kg: number
  by_mode: Array<{ mode: TravelMode; attendees: number; kg: number }>
  /** True when the split percentages don't sum to ~100 (surfaced as a warning). */
  split_incomplete: boolean
}

/**
 * Estimate round-trip travel carbon. Each mode's attendees = attendees × share;
 * distance is doubled for the return leg.
 */
export function estimateTravel(input: TravelSplit): TravelEstimate {
  const attendees = Math.max(0, Number(input.attendees) || 0)
  const distance = Math.max(0, Number(input.avg_distance_km) || 0)
  const roundTrip = distance * 2

  let pctSum = 0
  const by_mode: TravelEstimate['by_mode'] = []
  let total = 0
  for (const mode of Object.keys(TRAVEL_FACTORS) as TravelMode[]) {
    const pct = Math.max(0, Number(input.split[mode]) || 0)
    if (pct === 0) continue
    pctSum += pct
    const modeAttendees = attendees * (pct / 100)
    const kg = modeAttendees * roundTrip * TRAVEL_FACTORS[mode]
    total += kg
    by_mode.push({ mode, attendees: modeAttendees, kg })
  }

  return {
    total_kg: total,
    per_attendee_kg: attendees > 0 ? total / attendees : 0,
    by_mode,
    split_incomplete: Math.abs(pctSum - 100) > 1,
  }
}
