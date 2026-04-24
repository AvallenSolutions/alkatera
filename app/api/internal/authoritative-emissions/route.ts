import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Internal endpoint — returns the canonical corporate emissions figure for a
 * (organization, year) pair. Replaces the legacy calculate_gaia_corporate_emissions
 * Postgres RPC, which diverged from the JS aggregator and ignored the new
 * suppression rules.
 *
 * Auth: shared-secret via `x-internal-key` header matching SUPABASE_SERVICE_ROLE_KEY.
 * Only server-to-server callers that already hold the service-role key (Edge
 * Functions, cron jobs) can read this endpoint; it is never exposed to browsers.
 */

interface Body {
  organizationId: string
  year: number
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const presented = request.headers.get('x-internal-key')
  if (!presented || presented !== serviceKey) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Partial<Body> | null
  if (!body?.organizationId || !body.year) {
    return NextResponse.json({ error: 'Missing organizationId or year' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await calculateCorporateEmissions(supabase, body.organizationId, body.year)

  return NextResponse.json({
    has_data: result.hasData,
    year: result.year,
    breakdown: {
      total: result.breakdown.total,
      scope1: result.breakdown.scope1,
      scope2: result.breakdown.scope2,
      scope3: {
        total: result.breakdown.scope3.total,
        products: result.breakdown.scope3.products,
        business_travel: result.breakdown.scope3.business_travel,
        purchased_services: result.breakdown.scope3.purchased_services,
        employee_commuting: result.breakdown.scope3.employee_commuting,
        capital_goods: result.breakdown.scope3.capital_goods,
        operational_waste: result.breakdown.scope3.operational_waste,
        downstream_logistics: result.breakdown.scope3.downstream_logistics,
        marketing_materials: result.breakdown.scope3.marketing_materials,
        upstream_transport: result.breakdown.scope3.upstream_transport,
        downstream_transport: result.breakdown.scope3.downstream_transport,
        use_phase: result.breakdown.scope3.use_phase,
      },
    },
    methodology: 'GHG Protocol — coverage resolver + inventory ledger (alkatera aggregator)',
    calculation_date: new Date().toISOString(),
  })
}
