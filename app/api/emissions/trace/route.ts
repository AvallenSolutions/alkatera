import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type {
  EmissionSource,
  EmissionsTrace,
  ResolvedEmissionRow,
  ScopeSlice,
  SourceAttribution,
} from '@/lib/emissions/types'
import { getXeroScopeMapping } from '@/lib/xero/scope-card-mapping'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// Utility emission factors (mirrors lib/calculations/corporate-emissions.ts).
// Kept local here so this diagnostic route never silently diverges from a
// refactor of the main calculator — the Phase 1 resolver will consume them
// from a single module.
// ─────────────────────────────────────────────────────────────────────────────
const UTILITY_FACTOR: Record<string, { factor: number; slice: ScopeSlice }> = {
  natural_gas: { factor: 0.18293, slice: 'scope1.natural_gas' },
  natural_gas_m3: { factor: 0.18293 * 10.55, slice: 'scope1.natural_gas' },
  diesel_stationary: { factor: 2.68787, slice: 'scope1.diesel_stationary' },
  diesel_mobile: { factor: 2.68787, slice: 'scope1.diesel_mobile' },
  petrol_mobile: { factor: 2.31, slice: 'scope1.petrol_mobile' },
  lpg: { factor: 1.55537, slice: 'scope1.lpg' },
  heavy_fuel_oil: { factor: 3.17740, slice: 'scope1.heavy_fuel_oil' },
  biomass_solid: { factor: 0.01551, slice: 'scope1.other' },
  refrigerant_leakage: { factor: 1430, slice: 'scope1.refrigerant' },
  electricity_grid: { factor: 0.207, slice: 'scope2.electricity' },
  heat_steam_purchased: { factor: 0.1662, slice: 'scope2.heat_steam' },
}

const OVERHEAD_CATEGORY_TO_SLICE: Record<string, ScopeSlice> = {
  business_travel: 'scope3.business_travel',
  employee_commuting: 'scope3.employee_commuting',
  capital_goods: 'scope3.capital_goods',
  operational_waste: 'scope3.operational_waste',
  downstream_logistics: 'scope3.downstream_logistics',
  upstream_transport: 'scope3.upstream_transport',
  downstream_transport: 'scope3.downstream_transport',
  use_phase: 'scope3.use_phase',
  purchased_services: 'scope3.purchased_services',
  purchased_services_materials: 'scope3.marketing_materials',
}

function periodFromDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown'
  return iso.slice(0, 7) // YYYY-MM
}

function scopeSliceForXero(category: string): ScopeSlice {
  const mapping = getXeroScopeMapping(category)
  if (mapping.scope === 1) {
    if (category === 'natural_gas') return 'scope1.natural_gas'
    if (category === 'diesel_stationary') return 'scope1.diesel_stationary'
    if (category === 'diesel_mobile') return 'scope1.diesel_mobile'
    if (category === 'petrol_mobile') return 'scope1.petrol_mobile'
    if (category === 'lpg') return 'scope1.lpg'
    return 'scope1.other'
  }
  if (mapping.scope === 2) return 'scope2.electricity'
  if (mapping.overheadCategory && OVERHEAD_CATEGORY_TO_SLICE[mapping.overheadCategory]) {
    return OVERHEAD_CATEGORY_TO_SLICE[mapping.overheadCategory]
  }
  return 'scope3.other'
}

function scopeSliceForFleet(scope: string | null): ScopeSlice {
  if (!scope) return 'scope1.fleet'
  if (scope.startsWith('Scope 1')) return 'scope1.fleet'
  if (scope.startsWith('Scope 2')) return 'scope2.fleet'
  return 'scope3.fleet'
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: authError } = await userClient.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: isAdmin } = await userClient.rpc('is_alkatera_admin')
    if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const url = new URL(request.url)
    const orgId = url.searchParams.get('organizationId')
    const yearRaw = url.searchParams.get('year')
    const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear()
    if (!orgId) return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    if (!Number.isFinite(year)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 })

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const rows: ResolvedEmissionRow[] = []

    // ── Xero transactions ────────────────────────────────────────────────────
    const { data: xeroRows } = await supabase
      .from('xero_transactions')
      .select('id, transaction_date, emission_category, spend_based_emissions_kg, upgrade_status')
      .eq('organization_id', orgId)
      .gte('transaction_date', yearStart)
      .lte('transaction_date', yearEnd)

    for (const r of xeroRows || []) {
      if (!r.emission_category || !r.spend_based_emissions_kg) continue
      const rec = r as {
        id: string
        transaction_date: string
        emission_category: string
        spend_based_emissions_kg: number
        upgrade_status: string | null
      }
      const slice = scopeSliceForXero(rec.emission_category)
      const currentlyExcluded = rec.upgrade_status === 'upgraded' || rec.upgrade_status === 'dismissed'
      rows.push({
        source: 'xero_transactions',
        sourceRowId: rec.id,
        scopeSlice: slice,
        period: periodFromDate(rec.transaction_date),
        kgCO2e: Number(rec.spend_based_emissions_kg) || 0,
        suppressed: currentlyExcluded,
        suppressedBy: null,
        meta: { category: rec.emission_category, upgradeStatus: rec.upgrade_status },
      })
    }

    // ── Utility data entries (via facility → org) ───────────────────────────
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id')
      .eq('organization_id', orgId)
    const facilityIds = (facilities || []).map((f: { id: string }) => f.id)

    if (facilityIds.length > 0) {
      const { data: utilityRows } = await supabase
        .from('utility_data_entries')
        .select('id, utility_type, quantity, unit, reporting_period_start')
        .in('facility_id', facilityIds)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_start', yearEnd)

      for (const u of utilityRows || []) {
        const rec = u as {
          id: string
          utility_type: string
          quantity: number
          unit: string | null
          reporting_period_start: string
        }
        // Pick factor key (handle m³ natural gas variant)
        let factorKey: keyof typeof UTILITY_FACTOR | null = null
        if (rec.utility_type === 'natural_gas' && rec.unit === 'm3') factorKey = 'natural_gas_m3'
        else if (rec.utility_type in UTILITY_FACTOR) factorKey = rec.utility_type as keyof typeof UTILITY_FACTOR
        if (!factorKey) continue
        const { factor, slice } = UTILITY_FACTOR[factorKey]
        rows.push({
          source: 'utility_data_entries',
          sourceRowId: rec.id,
          scopeSlice: slice,
          period: periodFromDate(rec.reporting_period_start),
          kgCO2e: Number(rec.quantity) * factor,
          suppressed: false,
          suppressedBy: null,
          meta: { utilityType: rec.utility_type, unit: rec.unit },
        })
      }
    }

    // ── Corporate overheads ─────────────────────────────────────────────────
    const { data: reports } = await supabase
      .from('corporate_reports')
      .select('id')
      .eq('organization_id', orgId)
      .eq('year', year)
    const reportIds = (reports || []).map((r: { id: string }) => r.id)

    if (reportIds.length > 0) {
      const { data: overheadRows } = await supabase
        .from('corporate_overheads')
        .select('id, category, material_type, entry_date, computed_co2e')
        .in('report_id', reportIds)

      for (const o of overheadRows || []) {
        const rec = o as {
          id: string
          category: string
          material_type: string | null
          entry_date: string | null
          computed_co2e: number | null
        }
        if (!rec.computed_co2e) continue
        let slice: ScopeSlice = OVERHEAD_CATEGORY_TO_SLICE[rec.category] || 'scope3.other'
        if (rec.category === 'purchased_services' && rec.material_type) {
          slice = 'scope3.marketing_materials'
        }
        rows.push({
          source: 'corporate_overheads',
          sourceRowId: rec.id,
          scopeSlice: slice,
          period: periodFromDate(rec.entry_date || yearStart),
          kgCO2e: Number(rec.computed_co2e),
          suppressed: false,
          suppressedBy: null,
          meta: { category: rec.category, materialType: rec.material_type },
        })
      }
    }

    // ── Fleet activities ────────────────────────────────────────────────────
    const { data: fleetRows } = await supabase
      .from('fleet_activities')
      .select('id, activity_date, emissions_tco2e, scope')
      .eq('organization_id', orgId)
      .gte('activity_date', yearStart)
      .lte('activity_date', yearEnd)

    for (const f of fleetRows || []) {
      const rec = f as {
        id: string
        activity_date: string
        emissions_tco2e: number | null
        scope: string | null
      }
      if (!rec.emissions_tco2e) continue
      rows.push({
        source: 'fleet_activities',
        sourceRowId: rec.id,
        scopeSlice: scopeSliceForFleet(rec.scope),
        period: periodFromDate(rec.activity_date),
        kgCO2e: Number(rec.emissions_tco2e) * 1000,
        suppressed: false,
        suppressedBy: null,
        meta: { scope: rec.scope },
      })
    }

    // ── Product LCAs via production_logs ────────────────────────────────────
    const { data: productionLogs } = await supabase
      .from('production_logs')
      .select('id, date, units_produced, product_id')
      .eq('organization_id', orgId)
      .gte('date', yearStart)
      .lte('date', yearEnd)

    const productIds = Array.from(new Set((productionLogs || []).map((p: { product_id: string }) => p.product_id).filter(Boolean)))
    if (productIds.length > 0) {
      const { data: pcfs } = await supabase
        .from('product_carbon_footprints')
        .select('product_id, aggregated_impacts, created_at')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })

      const latestPcf: Record<string, { scope3PerUnit: number }> = {}
      for (const row of pcfs || []) {
        const rec = row as {
          product_id: string
          aggregated_impacts: Record<string, unknown> | null
        }
        if (latestPcf[rec.product_id]) continue
        const ai = rec.aggregated_impacts as
          | {
              breakdown?: { by_scope?: { scope3?: { total?: number; per_unit?: number } } }
              scope3_per_unit?: number
            }
          | null
        const perUnit =
          ai?.breakdown?.by_scope?.scope3?.per_unit ||
          ai?.scope3_per_unit ||
          0
        latestPcf[rec.product_id] = { scope3PerUnit: Number(perUnit) || 0 }
      }

      for (const log of productionLogs || []) {
        const rec = log as {
          id: string
          date: string
          units_produced: number | null
          product_id: string
        }
        const perUnit = latestPcf[rec.product_id]?.scope3PerUnit || 0
        if (!perUnit || !rec.units_produced) continue
        rows.push({
          source: 'product_lca',
          sourceRowId: rec.id,
          scopeSlice: 'scope3.products',
          period: periodFromDate(rec.date),
          kgCO2e: perUnit * rec.units_produced,
          suppressed: false,
          suppressedBy: null,
          meta: { productId: rec.product_id, unitsProduced: rec.units_produced },
        })
      }
    }

    // ── Aggregate per (scopeSlice, period) ──────────────────────────────────
    const attributionMap = new Map<string, SourceAttribution>()
    for (const row of rows) {
      const key = `${row.scopeSlice}|${row.period}`
      let att = attributionMap.get(key)
      if (!att) {
        att = {
          scopeSlice: row.scopeSlice,
          period: row.period,
          winningSource: null,
          kgCO2e: 0,
          suppressedSources: [],
        }
        attributionMap.set(key, att)
      }
      if (!row.suppressed) {
        att.kgCO2e += row.kgCO2e
        att.winningSource = att.winningSource || row.source
      } else {
        const existing = att.suppressedSources.find((s) => s.source === row.source)
        if (existing) {
          existing.rowCount += 1
          existing.kgCO2e += row.kgCO2e
        } else {
          att.suppressedSources.push({ source: row.source, rowCount: 1, kgCO2e: row.kgCO2e })
        }
      }
    }

    // ── Overlap warnings: same (scopeSlice, period) touched by >1 source ────
    const warnings: EmissionsTrace['warnings'] = []
    const perKeySources = new Map<string, Set<EmissionSource>>()
    for (const row of rows) {
      if (row.suppressed) continue
      const key = `${row.scopeSlice}|${row.period}`
      if (!perKeySources.has(key)) perKeySources.set(key, new Set())
      perKeySources.get(key)!.add(row.source)
    }
    for (const [key, sources] of perKeySources.entries()) {
      if (sources.size < 2) continue
      const [scopeSlice, period] = key.split('|') as [ScopeSlice, string]
      warnings.push({
        scopeSlice,
        period,
        message: `${sources.size} sources contributing simultaneously — likely double-count`,
        sources: Array.from(sources),
      })
    }

    const trace: EmissionsTrace = {
      organizationId: orgId,
      year,
      generatedAt: new Date().toISOString(),
      rows,
      attributions: Array.from(attributionMap.values()).sort((a, b) =>
        a.scopeSlice === b.scopeSlice
          ? a.period.localeCompare(b.period)
          : a.scopeSlice.localeCompare(b.scopeSlice),
      ),
      warnings: warnings.sort((a, b) =>
        a.scopeSlice === b.scopeSlice ? a.period.localeCompare(b.period) : a.scopeSlice.localeCompare(b.scopeSlice),
      ),
    }

    return NextResponse.json(trace)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Trace failed'
    console.error('[EmissionsTrace] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
