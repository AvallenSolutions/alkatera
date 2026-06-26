/**
 * ESA WorldCover source — 10 m global land cover (2021, v200).
 *
 * Licence: CC-BY 4.0 (ESA / contains modified Copernicus Sentinel data). Read
 * directly from the free AWS Open Data bucket as a Cloud-Optimised GeoTIFF via
 * HTTP range requests (one ~tiny request per point), so there is no tile server
 * and £0 infra. Tiles are 3°×3°, named by their south-west corner.
 *
 * Pixel maths uses the image origin + resolution (verified against known points:
 * Iowa → Cropland, Paris → Built-up). nodata (0, e.g. open ocean) → null.
 */

import { fromUrl } from 'geotiff'

/** WorldCover class codes → human labels. */
export const WORLDCOVER_CLASSES: Record<number, string> = {
  10: 'Tree cover',
  20: 'Shrubland',
  30: 'Grassland',
  40: 'Cropland',
  50: 'Built-up',
  60: 'Bare / sparse vegetation',
  70: 'Snow and ice',
  80: 'Permanent water',
  90: 'Herbaceous wetland',
  95: 'Mangroves',
  100: 'Moss and lichen',
}

const BUCKET = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com'
const VERSION = 'v200'
const YEAR = '2021'

/** Name of the 3°×3° tile (by south-west corner) containing a coordinate. */
export function worldCoverTile(lat: number, lng: number): string {
  const la = Math.floor(lat / 3) * 3
  const lo = Math.floor(lng / 3) * 3
  const ns = la < 0 ? `S${String(Math.abs(la)).padStart(2, '0')}` : `N${String(la).padStart(2, '0')}`
  const ew = lo < 0 ? `W${String(Math.abs(lo)).padStart(3, '0')}` : `E${String(lo).padStart(3, '0')}`
  return `${ns}${ew}`
}

export function worldCoverTileUrl(lat: number, lng: number): string {
  const tile = worldCoverTile(lat, lng)
  return `${BUCKET}/${VERSION}/${YEAR}/map/ESA_WorldCover_10m_${YEAR}_${VERSION}_${tile}_Map.tif`
}

/**
 * Fetch the land-cover class at a coordinate. Returns { code: null } for a
 * no-data point (e.g. ocean) or a point outside the tile; throws only on a
 * transient HTTP/network error so the caller (Inngest) can retry.
 */
export async function fetchWorldCoverClass(
  lat: number,
  lng: number,
): Promise<{ code: number | null; label: string | null; raw: Record<string, unknown> }> {
  const tiff = await fromUrl(worldCoverTileUrl(lat, lng))
  const img = await tiff.getImage()
  const [ox, oy] = img.getOrigin()
  const [rx, ry] = img.getResolution()
  const px = Math.floor((lng - ox) / rx)
  const py = Math.floor((lat - oy) / ry)
  const w = img.getWidth()
  const h = img.getHeight()
  if (px < 0 || py < 0 || px >= w || py >= h) {
    return { code: null, label: null, raw: { outOfTile: true } }
  }
  const data = (await img.readRasters({ window: [px, py, px + 1, py + 1] })) as unknown as number[][]
  const code = Number(data[0]?.[0])
  if (!code || code === 0) return { code: null, label: null, raw: { nodata: true } }
  return { code, label: WORLDCOVER_CLASSES[code] ?? `Class ${code}`, raw: { code } }
}

export type LandCoverValidation = {
  status: 'match' | 'mismatch' | 'unknown'
  detectedCode: number | null
  detectedLabel: string | null
  message: string
}

// Classes that contradict "this is a vineyard / orchard / field".
const IMPLAUSIBLE_FOR_FARMLAND = new Set([50, 60, 70, 80]) // built-up, bare, snow/ice, water

/**
 * Validate a detected land-cover class against a farmland land unit. We only
 * flag clearly-wrong locations (built-up, water, bare, snow) rather than
 * nitpick cropland vs grassland, so this is a trustworthy "is the pin sane?"
 * check, not a noisy one.
 */
export function validateFarmlandCover(code: number | null): LandCoverValidation {
  if (code == null) {
    return { status: 'unknown', detectedCode: null, detectedLabel: null, message: 'No land-cover data for this location.' }
  }
  const label = WORLDCOVER_CLASSES[code] ?? `Class ${code}`
  if (IMPLAUSIBLE_FOR_FARMLAND.has(code)) {
    return {
      status: 'mismatch',
      detectedCode: code,
      detectedLabel: label,
      message: `These coordinates fall on "${label}", which is unexpected for farmland. Check the location is correct.`,
    }
  }
  return {
    status: 'match',
    detectedCode: code,
    detectedLabel: label,
    message: `Land cover here is "${label}", consistent with farmland.`,
  }
}
