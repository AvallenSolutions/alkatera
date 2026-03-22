/**
 * Shared travel and accommodation emission calculation helpers
 * for Xero upgrade forms.
 *
 * Flight and rail factors are fetched from the `emissions_factors` table
 * (DEFRA 2025 Business Travel factors, already seeded).
 *
 * Hotel factors are constants from DEFRA 2025 hotel stay guidance.
 */

import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

// ─── Types ───────────────────────────────────────────────────────────

export type TravelClass = 'Domestic' | 'Short-haul' | 'Long-haul'
export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First'
export type CountryRegion = 'uk' | 'europe' | 'north_america' | 'rest_of_world'
export type HotelType = 'budget' | 'mid_range' | 'luxury' | 'average'

export interface EmissionFactor {
  factor_id: string
  name: string
  value: number
  unit: string
  travel_class: string
  cabin_class?: string
}

// ─── Cabin class options (shared with BusinessTravelCard) ────────────

export const CABIN_CLASS_OPTIONS = [
  { value: 'Economy' as CabinClass, label: 'Economy', icon: '💺', description: 'Standard seating' },
  { value: 'Premium Economy' as CabinClass, label: 'Premium Economy', icon: '🪑', description: 'Extra legroom' },
  { value: 'Business' as CabinClass, label: 'Business', icon: '🛋️', description: 'Business class' },
  { value: 'First' as CabinClass, label: 'First', icon: '👑', description: 'First class' },
] as const

// ─── Travel class auto-detection from distance ──────────────────────

/**
 * Auto-detect travel class from one-way distance.
 * Based on DEFRA distance band definitions:
 * - Domestic: flights within the UK (< 500 km)
 * - Short-haul: flights to Europe, North Africa, Middle East (500-3700 km)
 * - Long-haul: intercontinental flights (> 3700 km)
 */
export function detectTravelClass(distanceKm: number): TravelClass {
  if (distanceKm < 500) return 'Domestic'
  if (distanceKm <= 3700) return 'Short-haul'
  return 'Long-haul'
}

// ─── Flight emission factors ─────────────────────────────────────────

/**
 * Fetch DEFRA 2025 flight and rail emission factors from the database.
 * These are stored in the `emissions_factors` table with:
 * - source: 'DEFRA 2025'
 * - category: 'Scope 3'
 * - type: 'Business Travel - Air' or 'Business Travel - Rail'
 */
export async function fetchTravelEmissionFactors(): Promise<EmissionFactor[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('emissions_factors')
    .select('factor_id, name, value, unit, travel_class, cabin_class')
    .eq('source', 'DEFRA 2025')
    .eq('category', 'Scope 3')
    .in('type', ['Business Travel - Air', 'Business Travel - Rail'])
    .order('travel_class, cabin_class')

  if (error) {
    console.error('[TravelEmissions] Failed to fetch factors:', error)
    return []
  }

  return data || []
}

/**
 * Find the matching emission factor for a flight.
 */
export function findFlightFactor(
  factors: EmissionFactor[],
  travelClass: TravelClass,
  cabinClass: CabinClass
): EmissionFactor | undefined {
  return factors.find(
    f => f.travel_class === travelClass && f.cabin_class === cabinClass
  )
}

/**
 * Find the matching emission factor for rail travel.
 */
export function findRailFactor(
  factors: EmissionFactor[],
  travelClass: string = 'National'
): EmissionFactor | undefined {
  return factors.find(f => f.travel_class === travelClass)
}

/**
 * Calculate flight CO2e from activity data.
 * Returns kg CO2e.
 */
export function calculateFlightCO2e(
  factor: EmissionFactor,
  distanceKm: number,
  passengerCount: number,
  isReturn: boolean
): number {
  const effectiveDistance = isReturn ? distanceKm * 2 : distanceKm
  return factor.value * effectiveDistance * passengerCount
}

/**
 * Calculate rail CO2e from activity data.
 * Returns kg CO2e.
 */
export function calculateRailCO2e(
  factor: EmissionFactor,
  distanceKm: number,
  passengerCount: number,
  isReturn: boolean
): number {
  const effectiveDistance = isReturn ? distanceKm * 2 : distanceKm
  return factor.value * effectiveDistance * passengerCount
}

// ─── Hotel emission factors ─────────────────────────────────────────

/**
 * DEFRA 2025 hotel stay emission factors (kg CO2e per room-night).
 *
 * Source: DEFRA 2025 Government GHG Conversion Factors, Table 14
 * "Hotel stay" category under Business Travel.
 *
 * Factors vary by country/region. Hotel type multipliers are estimated
 * from studies on energy intensity by hotel star rating.
 */
export const HOTEL_EMISSION_FACTORS: Record<CountryRegion, Record<HotelType, number>> = {
  uk: {
    budget: 14.2,    // Budget (2-star): ~70% of average
    mid_range: 20.3, // Mid-range (3-star): average
    luxury: 32.5,    // Luxury (4-5 star): ~160% of average
    average: 20.3,   // UK average per room-night
  },
  europe: {
    budget: 16.8,
    mid_range: 24.0,
    luxury: 38.4,
    average: 24.0,
  },
  north_america: {
    budget: 22.4,
    mid_range: 32.0,
    luxury: 51.2,
    average: 32.0,
  },
  rest_of_world: {
    budget: 19.6,
    mid_range: 28.0,
    luxury: 44.8,
    average: 28.0,
  },
}

export const COUNTRY_REGION_OPTIONS = [
  { value: 'uk' as CountryRegion, label: 'United Kingdom' },
  { value: 'europe' as CountryRegion, label: 'Europe' },
  { value: 'north_america' as CountryRegion, label: 'North America' },
  { value: 'rest_of_world' as CountryRegion, label: 'Rest of World' },
] as const

export const HOTEL_TYPE_OPTIONS = [
  { value: 'budget' as HotelType, label: 'Budget (1-2 star)', icon: '🏠' },
  { value: 'mid_range' as HotelType, label: 'Mid-range (3 star)', icon: '🏨' },
  { value: 'luxury' as HotelType, label: 'Luxury (4-5 star)', icon: '🏰' },
  { value: 'average' as HotelType, label: 'Average (unknown)', icon: '🏢' },
] as const

/**
 * Calculate hotel stay CO2e from activity data.
 * Returns kg CO2e.
 */
export function calculateHotelCO2e(
  nights: number,
  countryRegion: CountryRegion,
  hotelType: HotelType = 'average'
): number {
  const factor = HOTEL_EMISSION_FACTORS[countryRegion]?.[hotelType]
    ?? HOTEL_EMISSION_FACTORS.uk.average
  return nights * factor
}

/**
 * Get the emission factor for a specific hotel configuration (for display).
 */
export function getHotelFactor(
  countryRegion: CountryRegion,
  hotelType: HotelType = 'average'
): number {
  return HOTEL_EMISSION_FACTORS[countryRegion]?.[hotelType]
    ?? HOTEL_EMISSION_FACTORS.uk.average
}

// ─── Freight mode mapping for upgrade forms ─────────────────────────

/**
 * Map Xero emission categories to transport-emissions-calculator modes.
 */
export const FREIGHT_CATEGORY_TO_MODE: Record<string, import('@/lib/utils/transport-emissions-calculator').TransportMode> = {
  road_freight: 'truck',
  sea_freight: 'ship',
  air_freight: 'air',
}

export const FREIGHT_VEHICLE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  road_freight: [
    { value: 'truck', label: 'HGV (Articulated, average laden)' },
  ],
  sea_freight: [
    { value: 'ship', label: 'Container Ship (Average)' },
  ],
  air_freight: [
    { value: 'air', label: 'Dedicated Freighter (Average)' },
  ],
}
