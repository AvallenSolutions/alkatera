'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Dual-source fallback for trend widgets.
 *
 * When an operational query returns no data for a given year, widgets can ask
 * this helper whether the historical_imports table has a headline metric for
 * that year instead. Imported values carry a `source: 'imported'` flag so the
 * UI can visually distinguish them (badge, dashed line, etc.) — operational
 * data keeps full credibility, imported data fills gaps without silently
 * replacing measured numbers.
 */

export type MetricSource = 'operational' | 'imported'

export interface HistoricalSustainabilityMetrics {
  reporting_year: number
  scope1_tco2e?: number
  scope2_tco2e_market?: number
  scope2_tco2e_location?: number
  scope3_tco2e?: number
  water_m3?: number
  waste_tonnes?: number
  waste_diversion_rate_pct?: number
  headcount?: number
  revenue_gbp?: number
}

/**
 * Fetch the historical sustainability-report row for a given org + year.
 * Returns null if no import exists for that year. Multiple imports for the
 * same year are de-duplicated by taking the most recent.
 */
export async function fetchHistoricalSustainabilityMetrics(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<HistoricalSustainabilityMetrics | null> {
  try {
    const { data, error } = await supabase
      .from('historical_imports')
      .select('reporting_year, extracted_data, created_at')
      .eq('organization_id', organizationId)
      .eq('kind', 'sustainability_report')
      .eq('reporting_year', year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const d = (data.extracted_data || {}) as Record<string, any>
    return {
      reporting_year: year,
      scope1_tco2e: numeric(d.scope1_tco2e),
      scope2_tco2e_market: numeric(d.scope2_tco2e_market),
      scope2_tco2e_location: numeric(d.scope2_tco2e_location),
      scope3_tco2e: numeric(d.scope3_tco2e),
      water_m3: numeric(d.water_m3),
      waste_tonnes: numeric(d.waste_tonnes),
      waste_diversion_rate_pct: numeric(d.waste_diversion_rate_pct),
      headcount: numeric(d.headcount),
      revenue_gbp: numeric(d.revenue_gbp),
    }
  } catch {
    return null
  }
}

function numeric(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Sum the three scope totals (tCO2e) into one operational-equivalent value
 * (kg CO2e — matches the units of calculateCorporateEmissions). If no scope
 * is populated, returns undefined — the caller should then fall back to
 * "no data" rather than showing zero.
 */
export function historicalTotalKgCo2e(m: HistoricalSustainabilityMetrics): number | undefined {
  const s1 = m.scope1_tco2e ?? 0
  const s2 = m.scope2_tco2e_market ?? m.scope2_tco2e_location ?? 0
  const s3 = m.scope3_tco2e ?? 0
  if (s1 === 0 && s2 === 0 && s3 === 0) return undefined
  return (s1 + s2 + s3) * 1000
}
