/**
 * Consumer carbon bands for menu items.
 *
 * Maps a per-serving carbon footprint (kg CO2e) to a simple low / medium / high
 * band for the public, QR-linked menu.
 *
 * Basis for the default thresholds: a 1.5°C-compatible daily food budget is on
 * the order of ~3 kg CO2e/person (WWF Livewell / One Planet Plate puts a
 * sustainable single meal near ~0.9 kg), and in the Poore & Nemecek (2018) meal
 * distribution the >3 kg tail is dominated by red meat. So ≤1 kg reads as a low
 * plant-forward dish and >3 kg as the beef-dish tail. Orgs can override the
 * thresholds (organizations.report_defaults.hospitality_band_thresholds).
 */

export type CarbonBand = 'low' | 'medium' | 'high'

export interface BandThresholds {
  /** Upper bound (kg CO2e per serving) for the low band. */
  low: number
  /** Upper bound (kg CO2e per serving) for the medium band. */
  medium: number
}

/** Default upper bounds (kg CO2e per serving) for low and medium. */
export const BAND_THRESHOLDS: BandThresholds = { low: 1.0, medium: 3.0 }

/** Validate a raw thresholds object; fall back to the defaults if it's malformed. */
export function parseBandThresholds(raw: unknown): BandThresholds {
  if (raw && typeof raw === 'object') {
    const low = Number((raw as any).low)
    const medium = Number((raw as any).medium)
    if (Number.isFinite(low) && Number.isFinite(medium) && low > 0 && medium > low) {
      return { low, medium }
    }
  }
  return BAND_THRESHOLDS
}

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

export function carbonBand(
  co2ePerServing: number | null | undefined,
  thresholds: BandThresholds = BAND_THRESHOLDS,
): CarbonBandMeta | null {
  if (co2ePerServing == null || !Number.isFinite(co2ePerServing)) return null
  if (co2ePerServing <= thresholds.low) return META.low
  if (co2ePerServing <= thresholds.medium) return META.medium
  return META.high
}

export interface CarbonBandLegendEntry extends CarbonBandMeta {
  /** Upper bound (kg CO2e per serving) for this band; null for the open-ended top band. */
  max: number | null
}

/**
 * Legend rows for the public menu, derived from the band thresholds so the
 * swatches can never drift from `carbonBand()`. Phase 4d passes org-configured
 * thresholds here; the default keeps the standalone case working.
 */
export function bandLegend(
  thresholds: { low: number; medium: number } = BAND_THRESHOLDS,
): CarbonBandLegendEntry[] {
  return [
    { ...META.low, max: thresholds.low },
    { ...META.medium, max: thresholds.medium },
    { ...META.high, max: null },
  ]
}

/** Display a per-serving footprint as grams or kilograms, whichever reads better. */
export function formatFootprint(co2ePerServing: number | null | undefined): string {
  if (co2ePerServing == null || !Number.isFinite(co2ePerServing)) return '—'
  if (co2ePerServing < 1) return `${Math.round(co2ePerServing * 1000)} g CO₂e`
  return `${co2ePerServing.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg CO₂e`
}
