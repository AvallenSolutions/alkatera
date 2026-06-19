/**
 * Consumer carbon bands for menu items.
 *
 * Maps a per-serving carbon footprint (kg CO2e) to a simple low / medium / high
 * band for the public, QR-linked menu. Thresholds are deliberately broad and
 * cover-level: a salad lands low, a beef dish high.
 */

export type CarbonBand = 'low' | 'medium' | 'high'

/** Upper bounds (kg CO2e per serving) for low and medium. */
export const BAND_THRESHOLDS = { low: 1.0, medium: 3.0 } as const

export interface CarbonBandMeta {
  band: CarbonBand
  label: string
  /** Tailwind-ish token used by the public page (kept framework-agnostic). */
  color: string
}

const META: Record<CarbonBand, CarbonBandMeta> = {
  low: { band: 'low', label: 'Low', color: '#16a34a' },
  medium: { band: 'medium', label: 'Medium', color: '#d97706' },
  high: { band: 'high', label: 'High', color: '#dc2626' },
}

export function carbonBand(co2ePerServing: number | null | undefined): CarbonBandMeta | null {
  if (co2ePerServing == null || !Number.isFinite(co2ePerServing)) return null
  if (co2ePerServing <= BAND_THRESHOLDS.low) return META.low
  if (co2ePerServing <= BAND_THRESHOLDS.medium) return META.medium
  return META.high
}

/** Display a per-serving footprint as grams or kilograms, whichever reads better. */
export function formatFootprint(co2ePerServing: number | null | undefined): string {
  if (co2ePerServing == null || !Number.isFinite(co2ePerServing)) return '—'
  if (co2ePerServing < 1) return `${Math.round(co2ePerServing * 1000)} g CO₂e`
  return `${co2ePerServing.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg CO₂e`
}
