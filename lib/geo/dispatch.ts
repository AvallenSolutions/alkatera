import 'server-only'
import { inngest } from '@/lib/inngest/client'
import type { LandUnitType } from './soil-baseline'

/**
 * Fire-and-forget: request a SoilGrids soil-carbon baseline for a land unit.
 * Best-effort — no-ops when Inngest isn't configured or coordinates are
 * missing/invalid, and never throws into the calling route.
 */
export async function dispatchSoilBaseline(p: {
  organizationId: string
  landUnitType: LandUnitType
  landUnitId: string
  lat: unknown
  lng: unknown
}): Promise<void> {
  if (!process.env.INNGEST_EVENT_KEY) return
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  if (p.lat == null || p.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return
  if (lat === 0 && lng === 0) return // null-island guard

  try {
    await inngest.send({
      name: 'geo/soil-baseline.requested',
      data: {
        organization_id: p.organizationId,
        land_unit_type: p.landUnitType,
        land_unit_id: p.landUnitId,
        lat,
        lng,
      },
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[geo] dispatchSoilBaseline failed:', e instanceof Error ? e.message : e)
  }
}
