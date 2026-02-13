import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkObligation } from '@/lib/epr/obligation-checker'

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
 * GET /api/epr/obligation?organizationId=xxx
 *
 * Returns obligation status calculated from:
 * - EPR settings (annual turnover)
 * - Actual packaging tonnage (product_materials × production_logs)
 */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { user, authorized } = await authenticateAndAuthorize(organizationId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const supabase = getServiceClient()

  try {
    // Get EPR settings for turnover
    const { data: settings } = await supabase
      .from('epr_organization_settings')
      .select('annual_turnover_gbp, estimated_annual_packaging_tonnage, obligation_size')
      .eq('organization_id', organizationId)
      .maybeSingle()

    // Calculate actual packaging tonnage from product_materials × production_logs
    // Get all packaging materials for products in this org with their production volumes
    const { data: packagingData, error: packagingError } = await supabase
      .from('product_materials')
      .select(`
        id,
        net_weight_g,
        packaging_category,
        products!inner (
          id,
          organization_id,
          production_logs (
            units_produced
          )
        )
      `)
      .eq('products.organization_id', organizationId)
      .not('packaging_category', 'is', null)

    if (packagingError) {
      console.error('Error fetching packaging data:', packagingError)
      return NextResponse.json({ error: 'Failed to fetch packaging data' }, { status: 500 })
    }

    // Calculate total packaging tonnage
    let totalWeightKg = 0
    let totalItems = 0

    for (const material of packagingData || []) {
      if (!material.net_weight_g || material.net_weight_g <= 0) continue
      totalItems++

      const product = material.products as any
      const logs = product?.production_logs || []
      const totalUnits = logs.reduce((sum: number, log: any) => sum + (log.units_produced || 0), 0)

      if (totalUnits > 0) {
        totalWeightKg += (material.net_weight_g / 1000) * totalUnits
      }
    }

    const totalTonnes = totalWeightKg / 1000

    // Use settings-provided turnover, or 0 if not set
    const turnoverGBP = settings?.annual_turnover_gbp ?? 0

    // Calculate obligation
    const obligation = checkObligation(turnoverGBP, totalTonnes)

    // If calculated tonnage differs from stored estimate, note it
    const storedTonnage = settings?.estimated_annual_packaging_tonnage ?? null

    return NextResponse.json({
      obligation,
      packaging_summary: {
        total_weight_kg: Math.round(totalWeightKg * 100) / 100,
        total_tonnes: Math.round(totalTonnes * 1000) / 1000,
        total_packaging_items: totalItems,
        stored_tonnage_estimate: storedTonnage,
        turnover_gbp: turnoverGBP,
      },
    })
  } catch (err) {
    console.error('EPR obligation GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
