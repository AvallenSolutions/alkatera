import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { mapMaterialToRPD } from '@/lib/epr/mappings'
import { calculateLineFee, getApplicableRate, findFeeRate } from '@/lib/epr/fee-calculator'
import { isDRSExcluded } from '@/lib/epr/drinks-container-rules'
import type { EPRFeeRate, RPDMaterialCode, EPRFeeCalculationResult, EPRMaterialFeeBreakdown, EPRProductFeeBreakdown, EPRPackagingItemFee } from '@/lib/epr/types'
import type { EPRMaterialType, EPRRAMRating } from '@/lib/types/lca'
import { RPD_MATERIAL_NAMES } from '@/lib/epr/constants'

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
 * POST /api/epr/calculate-fees
 *
 * Calculate estimated EPR fees for an organisation.
 * Input: { organizationId, fee_year }
 * Returns: material-level + product-level fee breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, fee_year } = body

    if (!organizationId || !fee_year) {
      return NextResponse.json(
        { error: 'organizationId and fee_year are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch fee rates for the year
    const { data: feeRates, error: ratesError } = await supabase
      .from('epr_fee_rates')
      .select('*')
      .eq('fee_year', fee_year)

    if (ratesError || !feeRates) {
      return NextResponse.json({ error: 'Failed to fetch fee rates' }, { status: 500 })
    }

    // Fetch EPR settings for DRS config
    const { data: settings } = await supabase
      .from('epr_organization_settings')
      .select('drs_applies')
      .eq('organization_id', organizationId)
      .maybeSingle()

    const drsApplies = settings?.drs_applies ?? true

    // Fetch all packaging materials with product info and production logs
    const { data: packagingData, error: packagingError } = await supabase
      .from('product_materials')
      .select(`
        id,
        material_name,
        net_weight_g,
        packaging_category,
        epr_material_type,
        epr_is_drinks_container,
        epr_is_household,
        epr_ram_rating,
        products!inner (
          id,
          name,
          organization_id,
          unit_size_value,
          unit_size_unit,
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

    // Calculate fees
    const materialTotals: Record<string, EPRMaterialFeeBreakdown> = {}
    const productMap: Record<number, EPRProductFeeBreakdown> = {}
    let totalFee = 0
    let totalWeight = 0
    let totalDRSExcluded = 0

    for (const material of packagingData || []) {
      if (!material.net_weight_g || material.net_weight_g <= 0) continue

      const product = material.products as any
      const logs = product?.production_logs || []
      const totalUnits = logs.reduce((sum: number, log: any) => sum + (log.units_produced || 0), 0)

      if (totalUnits <= 0) continue

      const weightPerUnitKg = material.net_weight_g / 1000
      const totalWeightKg = weightPerUnitKg * totalUnits

      // Map material type to RPD code
      const materialType = (material.epr_material_type || 'other') as EPRMaterialType
      const materialCode = mapMaterialToRPD(materialType)

      // Check DRS exclusion
      let unitSizeML: number | null = null
      if (product.unit_size_value && product.unit_size_unit) {
        // Convert to ml
        const size = product.unit_size_value
        const unit = product.unit_size_unit?.toLowerCase()
        if (unit === 'ml') unitSizeML = size
        else if (unit === 'l' || unit === 'litre' || unit === 'liter') unitSizeML = size * 1000
        else if (unit === 'cl') unitSizeML = size * 10
      }

      const drsExcluded = drsApplies && isDRSExcluded(
        material.epr_is_drinks_container ?? false,
        unitSizeML,
        materialType
      )

      // Find fee rate
      const feeRate = findFeeRate(feeRates as EPRFeeRate[], materialCode, fee_year)
      if (!feeRate) continue

      const ramRating = (material.epr_ram_rating || null) as EPRRAMRating | null
      const lineFee = calculateLineFee(totalWeightKg, feeRate, ramRating, drsExcluded)
      const rate = getApplicableRate(feeRate, ramRating, drsExcluded)

      totalFee += lineFee
      totalWeight += totalWeightKg
      if (drsExcluded) totalDRSExcluded += totalWeightKg

      // Aggregate by material
      if (!materialTotals[materialCode]) {
        materialTotals[materialCode] = {
          material_code: materialCode,
          material_name: RPD_MATERIAL_NAMES[materialCode] || materialCode,
          weight_kg: 0,
          fee_rate_per_tonne: rate,
          fee_gbp: 0,
          drs_excluded_weight_kg: 0,
        }
      }
      materialTotals[materialCode].weight_kg += totalWeightKg
      materialTotals[materialCode].fee_gbp += lineFee
      if (drsExcluded) materialTotals[materialCode].drs_excluded_weight_kg += totalWeightKg

      // Aggregate by product
      const productId = product.id
      if (!productMap[productId]) {
        productMap[productId] = {
          product_id: productId,
          product_name: product.name || `Product #${productId}`,
          packaging_items: [],
          total_fee_gbp: 0,
          total_weight_kg: 0,
        }
      }

      productMap[productId].packaging_items.push({
        product_material_id: material.id,
        material_name: material.material_name || materialType,
        material_code: materialCode,
        weight_per_unit_kg: weightPerUnitKg,
        units_produced: totalUnits,
        total_weight_kg: totalWeightKg,
        ram_rating: ramRating,
        fee_rate_per_tonne: rate,
        fee_gbp: lineFee,
        is_drs_excluded: drsExcluded,
      })

      productMap[productId].total_fee_gbp += lineFee
      productMap[productId].total_weight_kg += totalWeightKg
    }

    const result: EPRFeeCalculationResult = {
      total_fee_gbp: Math.round(totalFee * 100) / 100,
      total_weight_kg: Math.round(totalWeight * 100) / 100,
      total_drs_excluded_weight_kg: Math.round(totalDRSExcluded * 100) / 100,
      by_material: Object.values(materialTotals).map(m => ({
        ...m,
        weight_kg: Math.round(m.weight_kg * 100) / 100,
        fee_gbp: Math.round(m.fee_gbp * 100) / 100,
        drs_excluded_weight_kg: Math.round(m.drs_excluded_weight_kg * 100) / 100,
      })),
      by_product: Object.values(productMap).map(p => ({
        ...p,
        total_fee_gbp: Math.round(p.total_fee_gbp * 100) / 100,
        total_weight_kg: Math.round(p.total_weight_kg * 100) / 100,
      })),
    }

    return NextResponse.json({ calculation: result, fee_year })
  } catch (err) {
    console.error('EPR calculate-fees POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
