import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { mapActivityToRPD, mapMaterialToRPD, mapNationToRPD, mapRAMRatingToRPD, derivePackagingType, derivePackagingClass, deriveMaterialSubtype } from '@/lib/epr/mappings'
import { calculateLineFee, getApplicableRate, findFeeRate } from '@/lib/epr/fee-calculator'
import { isDRSExcluded, isGlassDrinksContainer, processContainerComponents, extractComponentWeights } from '@/lib/epr/drinks-container-rules'
import { FEE_YEARS, RPD_MATERIAL_NAMES } from '@/lib/epr/constants'
import type { EPRFeeRate, RPDMaterialCode, RPDOrganisationSize } from '@/lib/epr/types'
import type { EPRMaterialType, EPRPackagingActivity, EPRPackagingLevel, EPRRAMRating, EPRUKNation, PackagingCategory } from '@/lib/types/lca'

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
 * POST /api/epr/generate-submission
 *
 * Generate RPD submission lines from product/packaging/production data.
 *
 * Input: { organizationId, submission_period, fee_year }
 * Returns: { submission, lines, warnings }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, submission_period, fee_year } = body

    if (!organizationId || !submission_period || !fee_year) {
      return NextResponse.json(
        { error: 'organizationId, submission_period, and fee_year are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch EPR settings
    const { data: settings } = await supabase
      .from('epr_organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!settings?.rpd_organization_id) {
      return NextResponse.json(
        { error: 'Please set your RPD Organisation ID in EPR Settings before generating a submission.' },
        { status: 400 }
      )
    }

    // Determine organisation size
    const orgSize: RPDOrganisationSize = settings.obligation_size === 'large' ? 'L' : 'S'
    const feeYearDef = FEE_YEARS.find(f => f.id === fee_year)
    const isModulated = feeYearDef?.is_modulated ?? false

    // Fetch fee rates
    const { data: feeRates } = await supabase
      .from('epr_fee_rates')
      .select('*')
      .eq('fee_year', fee_year)

    // Fetch all packaging materials with production data
    const { data: packagingData, error: packagingError } = await supabase
      .from('product_materials')
      .select(`
        id,
        material_name,
        net_weight_g,
        packaging_category,
        epr_material_type,
        epr_packaging_activity,
        epr_packaging_level,
        epr_is_drinks_container,
        epr_is_household,
        epr_ram_rating,
        epr_uk_nation,
        component_glass_weight,
        component_aluminium_weight,
        component_steel_weight,
        component_paper_weight,
        component_wood_weight,
        component_other_weight,
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

    const warnings: string[] = []
    const submissionLines: any[] = []

    // Process each packaging material into submission lines
    for (const material of packagingData || []) {
      if (!material.net_weight_g || material.net_weight_g <= 0) continue

      const product = material.products as any
      const logs = product?.production_logs || []
      const totalUnits = logs.reduce((sum: number, log: any) => sum + (log.units_produced || 0), 0)

      if (totalUnits <= 0) {
        warnings.push(`${product.name}: No production volume recorded — skipped.`)
        continue
      }

      // Use material-level EPR fields, falling back to org defaults
      const activity = (material.epr_packaging_activity || settings.default_packaging_activity || 'brand') as EPRPackagingActivity
      const nation = (material.epr_uk_nation || settings.default_uk_nation || 'england') as EPRUKNation
      const ramRating = (material.epr_ram_rating || null) as EPRRAMRating | null
      const packagingCategory = (material.packaging_category || 'container') as PackagingCategory
      const packagingLevel = (material.epr_packaging_level || null) as EPRPackagingLevel | null
      const materialType = (material.epr_material_type || 'other') as EPRMaterialType
      const isDrinksContainer = material.epr_is_drinks_container ?? false
      const isHousehold = material.epr_is_household ?? true

      // Missing field warnings
      if (!material.epr_packaging_activity) {
        warnings.push(`${product.name} / ${material.material_name}: Using default packaging activity (${activity}).`)
      }
      if (!material.epr_uk_nation) {
        warnings.push(`${product.name} / ${material.material_name}: Using default UK nation (${nation}).`)
      }

      // Unit size for DRS check
      let unitSizeML: number | null = null
      if (product.unit_size_value && product.unit_size_unit) {
        const size = product.unit_size_value
        const unit = product.unit_size_unit?.toLowerCase()
        if (unit === 'ml') unitSizeML = size
        else if (unit === 'l' || unit === 'litre' || unit === 'liter') unitSizeML = size * 1000
        else if (unit === 'cl') unitSizeML = size * 10
      }

      const drsExcluded = (settings.drs_applies ?? true) && isDRSExcluded(isDrinksContainer, unitSizeML, materialType)

      // Handle drinks container component rules
      const components = extractComponentWeights(material)
      const processedComponents = processContainerComponents(isDrinksContainer, materialType, components, material.net_weight_g)

      // For glass drinks containers, each component becomes a separate line
      // For aggregated containers, all components merge into one line
      for (const component of processedComponents) {
        const componentMaterialCode = component.rpd_material_code
        const totalWeightKg = (component.weight_grams / 1000) * totalUnits

        // RPD field derivation
        const rpdActivity = mapActivityToRPD(activity)
        const rpdPackagingType = derivePackagingType(packagingCategory, isHousehold, isDrinksContainer)
        const rpdPackagingClass = derivePackagingClass(packagingLevel, packagingCategory)
        const rpdFromNation = mapNationToRPD(nation)
        const rpdRecyclabilityRating = mapRAMRatingToRPD(ramRating, isModulated)
        const rpdMaterialSubtype = deriveMaterialSubtype(component.material_type)

        // Fee calculation
        const feeRate = findFeeRate((feeRates || []) as EPRFeeRate[], componentMaterialCode, fee_year)
        const lineFee = feeRate ? calculateLineFee(totalWeightKg, feeRate, ramRating, drsExcluded) : 0
        const rate = feeRate ? getApplicableRate(feeRate, ramRating, drsExcluded) : 0

        // Nation-of-sale split: for now we use the primary nation;
        // when generating per-nation lines, this would be split
        submissionLines.push({
          organization_id: organizationId,
          product_id: product.id,
          product_name: product.name,
          product_material_id: material.id,
          rpd_organisation_id: settings.rpd_organization_id,
          rpd_subsidiary_id: settings.rpd_subsidiary_id || null,
          rpd_organisation_size: orgSize,
          rpd_submission_period: submission_period,
          rpd_packaging_activity: rpdActivity,
          rpd_packaging_type: rpdPackagingType,
          rpd_packaging_class: rpdPackagingClass,
          rpd_packaging_material: componentMaterialCode,
          rpd_material_subtype: rpdMaterialSubtype,
          rpd_from_nation: rpdFromNation,
          rpd_to_nation: rpdFromNation, // Same as from_nation by default
          rpd_material_weight_kg: Math.round(totalWeightKg),
          rpd_material_units: (rpdPackagingType === 'HDC' || rpdPackagingType === 'NDC') ? totalUnits : null,
          rpd_transitional_weight: null,
          rpd_recyclability_rating: rpdRecyclabilityRating,
          fee_rate_per_tonne: rate,
          estimated_fee_gbp: lineFee,
          is_drs_excluded: drsExcluded,
        })
      }
    }

    if (submissionLines.length === 0) {
      return NextResponse.json(
        { error: 'No packaging data with production volume found. Please ensure products have packaging materials and production logs recorded.' },
        { status: 400 }
      )
    }

    // Calculate totals
    const totalWeightKg = submissionLines.reduce((sum: number, l: any) => sum + l.rpd_material_weight_kg, 0)
    const totalFeeGBP = submissionLines.reduce((sum: number, l: any) => sum + l.estimated_fee_gbp, 0)

    // Material summary
    const materialSummary: Record<string, { weight_kg: number; fee_gbp: number; count: number }> = {}
    for (const line of submissionLines) {
      const code = line.rpd_packaging_material
      if (!materialSummary[code]) materialSummary[code] = { weight_kg: 0, fee_gbp: 0, count: 0 }
      materialSummary[code].weight_kg += line.rpd_material_weight_kg
      materialSummary[code].fee_gbp += line.estimated_fee_gbp
      materialSummary[code].count++
    }

    // Check if a draft submission already exists for this period — if so, update it
    const { data: existingSubmission } = await supabase
      .from('epr_submissions')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('submission_period', submission_period)
      .eq('fee_year', fee_year)
      .in('status', ['draft', 'ready'])
      .maybeSingle()

    let submissionId: string

    if (existingSubmission) {
      // Update existing submission
      submissionId = existingSubmission.id

      // Delete old lines
      await supabase
        .from('epr_submission_lines')
        .delete()
        .eq('submission_id', submissionId)

      // Update submission record
      await supabase
        .from('epr_submissions')
        .update({
          organization_size: orgSize,
          status: 'draft',
          total_packaging_weight_kg: totalWeightKg,
          total_estimated_fee_gbp: Math.round(totalFeeGBP * 100) / 100,
          total_line_items: submissionLines.length,
          material_summary: materialSummary,
          csv_generated_at: null,
          csv_storage_path: null,
          csv_checksum: null,
        })
        .eq('id', submissionId)
    } else {
      // Create new submission
      const { data: newSubmission, error: subError } = await supabase
        .from('epr_submissions')
        .insert({
          organization_id: organizationId,
          submission_period,
          fee_year,
          organization_size: orgSize,
          status: 'draft',
          total_packaging_weight_kg: totalWeightKg,
          total_estimated_fee_gbp: Math.round(totalFeeGBP * 100) / 100,
          total_line_items: submissionLines.length,
          material_summary: materialSummary,
        })
        .select()
        .single()

      if (subError || !newSubmission) {
        console.error('Error creating submission:', subError)
        return NextResponse.json({ error: 'Failed to create submission record' }, { status: 500 })
      }

      submissionId = newSubmission.id
    }

    // Insert submission lines
    const linesWithSubmissionId = submissionLines.map(l => ({
      ...l,
      submission_id: submissionId,
    }))

    const { error: linesError } = await supabase
      .from('epr_submission_lines')
      .insert(linesWithSubmissionId)

    if (linesError) {
      console.error('Error inserting submission lines:', linesError)
      return NextResponse.json({ error: 'Failed to create submission lines' }, { status: 500 })
    }

    // Write audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'submission',
      entity_id: submissionId,
      action: existingSubmission ? 'update' : 'create',
      snapshot: {
        submission_period,
        fee_year,
        total_line_items: submissionLines.length,
        total_weight_kg: totalWeightKg,
        total_fee_gbp: Math.round(totalFeeGBP * 100) / 100,
        material_summary: materialSummary,
      },
      performed_by: user.id,
    })

    // Fetch the full submission back
    const { data: fullSubmission } = await supabase
      .from('epr_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    const { data: fullLines } = await supabase
      .from('epr_submission_lines')
      .select('*')
      .eq('submission_id', submissionId)
      .order('rpd_packaging_material', { ascending: true })

    return NextResponse.json({
      submission: fullSubmission,
      lines: fullLines || [],
      warnings,
    }, { status: existingSubmission ? 200 : 201 })
  } catch (err) {
    console.error('EPR generate-submission POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
