/**
 * Programme 2 / Phase 3: energy-timing recommendations.
 *
 * Given a region's half-hourly grid-intensity profile (today's forecast), find
 * the cleanest and dirtiest windows and turn the gap into an actionable
 * recommendation: shifting an energy-intensive process from the dirty window to
 * the clean one saves (dirty − clean) g CO2e per kWh moved. Pure + testable; the
 * UI passes in the intensity series and (optionally) a shiftable load in kWh.
 */

export interface IntensityPoint {
  recordedAt: string // ISO, 30-min boundary
  gPerKwh: number
}

export interface TimingWindow {
  fromIso: string
  toIso: string
  /** "13:00–15:00" */
  label: string
  avgG: number
}

export interface TimingInsight {
  cleanest: TimingWindow | null
  dirtiest: TimingWindow | null
  /** dirtiest.avgG − cleanest.avgG (g/kWh); 0 when not computable. */
  spreadG: number
  /** kg CO2e saved per kWh shifted from the dirty to the clean window. */
  savingKgPerKwh: number
  /** Human recommendation, or null when there's no meaningful spread. */
  recommendation: string | null
}

function hhmm(iso: string): string {
  return iso.slice(11, 16)
}

/** Find the contiguous window of `windowHours` with the min (clean) or max (dirty) average. */
function extremeWindow(points: IntensityPoint[], windowHours: number, kind: 'min' | 'max'): TimingWindow | null {
  const n = Math.max(1, Math.round(windowHours * 2)) // half-hour slots
  if (points.length < n) return null
  const sorted = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

  let best: TimingWindow | null = null
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].gPerKwh
    if (i >= n) sum -= sorted[i - n].gPerKwh
    if (i >= n - 1) {
      const avg = sum / n
      const start = sorted[i - n + 1]
      const endSlot = sorted[i]
      const toIso = new Date(new Date(endSlot.recordedAt).getTime() + 30 * 60 * 1000).toISOString()
      const cand: TimingWindow = {
        fromIso: start.recordedAt,
        toIso,
        label: `${hhmm(start.recordedAt)}–${hhmm(toIso)}`,
        avgG: avg,
      }
      if (!best || (kind === 'min' ? avg < best.avgG : avg > best.avgG)) best = cand
    }
  }
  return best
}

export function findCleanestWindow(points: IntensityPoint[], windowHours = 2): TimingWindow | null {
  return extremeWindow(points, windowHours, 'min')
}

export function findDirtiestWindow(points: IntensityPoint[], windowHours = 2): TimingWindow | null {
  return extremeWindow(points, windowHours, 'max')
}

export function buildTimingInsight(
  points: IntensityPoint[],
  opts: { windowHours?: number; shiftableKwh?: number } = {},
): TimingInsight {
  const windowHours = opts.windowHours ?? 2
  const cleanest = findCleanestWindow(points, windowHours)
  const dirtiest = findDirtiestWindow(points, windowHours)

  if (!cleanest || !dirtiest) {
    return { cleanest, dirtiest, spreadG: 0, savingKgPerKwh: 0, recommendation: null }
  }

  const spreadG = Math.max(0, dirtiest.avgG - cleanest.avgG)
  const savingKgPerKwh = spreadG / 1000

  // Only recommend when the spread is material (>10% relative and >20 g/kWh).
  const meaningful = spreadG > 20 && cleanest.avgG > 0 && spreadG / cleanest.avgG > 0.1
  let recommendation: string | null = null
  if (meaningful) {
    const shiftable = opts.shiftableKwh && opts.shiftableKwh > 0 ? opts.shiftableKwh : null
    if (shiftable) {
      const saveKg = shiftable * savingKgPerKwh
      recommendation =
        `Shift ~${Math.round(shiftable).toLocaleString('en-GB')} kWh of flexible load from ${dirtiest.label} ` +
        `(≈${Math.round(dirtiest.avgG)} g/kWh) to ${cleanest.label} (≈${Math.round(cleanest.avgG)} g/kWh) ` +
        `to save ~${saveKg.toFixed(saveKg < 10 ? 1 : 0)} kg CO2e today.`
    } else {
      recommendation =
        `Run energy-intensive work in the ${cleanest.label} window (≈${Math.round(cleanest.avgG)} g/kWh) ` +
        `rather than ${dirtiest.label} (≈${Math.round(dirtiest.avgG)} g/kWh) — about ` +
        `${Math.round(savingKgPerKwh * 1000)} g CO2e saved per kWh moved.`
    }
  }

  return { cleanest, dirtiest, spreadG, savingKgPerKwh, recommendation }
}
