import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateObligationTonnage, determinePRNStatus, calculatePRNCost, totalPRNSpend, overallFulfilmentPct, buildPRNObligations } from '@/lib/epr/prn-calculator'
import { mapMaterialToRPD } from '@/lib/epr/mappings'
import type { EPRMaterialType } from '@/lib/types/lca'
import type { EPRPRNTarget } from '@/lib/epr/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticateAndAuthorize(organizationId: string) {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return { user: null, authorized: false }

  const serviceClient = getServiceClient()
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    const { data: advisorAccess } = await serviceClient
      .from('advisor_organization_access')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('advisor_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!advisorAccess) return { user, authorized: false }
  }

  return { user, authorized: true }
}

/**
 * GET /api/epr/prn?organizationId=xxx&year=2025
 *
 * Fetch PRN obligations for a given year with fulfilment status.
 * Auto-generates obligations from packaging data if none exist.
 */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  const year = parseInt(request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString(), 10)

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { user, authorized } = await authenticateAndAuthorize(organizationId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const supabase = getServiceClient()

  try {
    // Fetch existing PRN obligations
    let { data: obligations, error } = await supabase
      .from('epr_prn_obligations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('obligation_year', year)
      .order('material_code', { ascending: true })

    if (error) {
      console.error('Error fetching PRN obligations:', error)
      return NextResponse.json({ error: 'Failed to fetch PRN obligations' }, { status: 500 })
    }

    // If no obligations exist, auto-generate from packaging data
    if (!obligations || obligations.length === 0) {
      // Fetch PRN targets for the year
      const { data: targets } = await supabase
        .from('epr_prn_targets')
        .select('*')
        .eq('obligation_year', year)

      if (targets && targets.length > 0) {
        // Calculate tonnage by material from packaging data
        const tonnageByMaterial = await calculateTonnageByMaterial(supabase, organizationId)

        // Build obligations
        const newObligations = buildPRNObligations(
          tonnageByMaterial,
          targets as EPRPRNTarget[],
          organizationId,
          year
        )

        if (newObligations.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('epr_prn_obligations')
            .insert(newObligations)
            .select('*')

          if (!insertError && inserted) {
            obligations = inserted
          }
        }
      }
    }

    // Calculate summary
    const totalSpend = totalPRNSpend(obligations || [])
    const fulfilmentPct = overallFulfilmentPct(obligations || [])

    return NextResponse.json({
      obligations: obligations || [],
      summary: {
        year,
        total_prn_spend_gbp: totalSpend,
        overall_fulfilment_pct: fulfilmentPct,
        materials_count: obligations?.length || 0,
        fulfilled_count: obligations?.filter(o => o.status === 'fulfilled' || o.status === 'exceeded').length || 0,
      },
    })
  } catch (err) {
    console.error('EPR PRN GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/epr/prn
 *
 * Update PRN purchases (tonnage acquired, cost per tonne).
 *
 * Input: { organizationId, obligationId, prns_purchased_tonnage, prn_cost_per_tonne_gbp }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, obligationId, prns_purchased_tonnage, prn_cost_per_tonne_gbp } = body

    if (!organizationId || !obligationId) {
      return NextResponse.json(
        { error: 'organizationId and obligationId are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch existing obligation
    const { data: existing, error: fetchError } = await supabase
      .from('epr_prn_obligations')
      .select('*')
      .eq('id', obligationId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'PRN obligation not found' }, { status: 404 })
    }

    // Calculate new values
    const purchasedTonnage = prns_purchased_tonnage ?? existing.prns_purchased_tonnage
    const costPerTonne = prn_cost_per_tonne_gbp ?? existing.prn_cost_per_tonne_gbp
    const totalCost = calculatePRNCost(purchasedTonnage, costPerTonne)
    const status = determinePRNStatus(existing.obligation_tonnage, purchasedTonnage)

    // Update
    const { data: updated, error: updateError } = await supabase
      .from('epr_prn_obligations')
      .update({
        prns_purchased_tonnage: purchasedTonnage,
        prn_cost_per_tonne_gbp: costPerTonne,
        total_prn_cost_gbp: totalCost,
        status,
      })
      .eq('id', obligationId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating PRN obligation:', updateError)
      return NextResponse.json({ error: 'Failed to update PRN obligation' }, { status: 500 })
    }

    // Audit log
    const fieldChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (existing.prns_purchased_tonnage !== purchasedTonnage) {
      fieldChanges.prns_purchased_tonnage = { old: existing.prns_purchased_tonnage, new: purchasedTonnage }
    }
    if (existing.prn_cost_per_tonne_gbp !== costPerTonne) {
      fieldChanges.prn_cost_per_tonne_gbp = { old: existing.prn_cost_per_tonne_gbp, new: costPerTonne }
    }
    if (existing.total_prn_cost_gbp !== totalCost) {
      fieldChanges.total_prn_cost_gbp = { old: existing.total_prn_cost_gbp, new: totalCost }
    }
    if (existing.status !== status) {
      fieldChanges.status = { old: existing.status, new: status }
    }

    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'prn_obligation',
      entity_id: obligationId,
      action: 'update',
      field_changes: fieldChanges,
      snapshot: updated,
      performed_by: user.id,
    })

    return NextResponse.json({ obligation: updated })
  } catch (err) {
    console.error('EPR PRN POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Calculate total packaging tonnage by RPD material code for the organisation.
 */
async function calculateTonnageByMaterial(
  supabase: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<Record<string, number>> {
  const { data: packagingData } = await supabase
    .from('product_materials')
    .select(`
      net_weight_g,
      epr_material_type,
      products!inner (
        organization_id,
        production_logs (
          units_produced
        )
      )
    `)
    .eq('products.organization_id', organizationId)
    .not('packaging_category', 'is', null)

  const tonnageByMaterial: Record<string, number> = {}

  for (const material of packagingData || []) {
    if (!material.net_weight_g || material.net_weight_g <= 0) continue

    const product = material.products as any
    const logs = product?.production_logs || []
    const totalUnits = logs.reduce((sum: number, log: any) => sum + (log.units_produced || 0), 0)

    if (totalUnits <= 0) continue

    const materialType = (material.epr_material_type || 'other') as EPRMaterialType
    const materialCode = mapMaterialToRPD(materialType)
    const totalTonnes = (material.net_weight_g / 1000 / 1000) * totalUnits

    tonnageByMaterial[materialCode] = (tonnageByMaterial[materialCode] || 0) + totalTonnes
  }

  return tonnageByMaterial
}
