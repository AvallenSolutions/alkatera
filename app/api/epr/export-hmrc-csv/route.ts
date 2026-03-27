import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  generateOrganisationCSV,
  generateBrandsCSV,
  generatePartnersCSV,
} from '@/lib/epr/hmrc-csv-generator'
import { calculateCSVChecksum } from '@/lib/epr/csv-generator'
import type { HMRCOrgDetails, HMRCAddress, HMRCContact, HMRCBrand, HMRCPartner, EPROrganizationSettings } from '@/lib/epr/types'

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

type HMRCTemplate = 'organisation' | 'brands' | 'partners'

/**
 * POST /api/epr/export-hmrc-csv
 *
 * Generate an HMRC registration template CSV and store in Supabase Storage.
 * Body: { organizationId: string, template: 'organisation' | 'brands' | 'partners' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, template } = body as { organizationId: string; template: HMRCTemplate }

    if (!organizationId || !template) {
      return NextResponse.json(
        { error: 'organizationId and template are required' },
        { status: 400 }
      )
    }

    const validTemplates: HMRCTemplate[] = ['organisation', 'brands', 'partners']
    if (!validTemplates.includes(template)) {
      return NextResponse.json(
        { error: `Invalid template. Must be one of: ${validTemplates.join(', ')}` },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch common data
    const { data: eprSettings } = await supabase
      .from('epr_organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!eprSettings) {
      return NextResponse.json(
        { error: 'EPR settings not found. Complete the EPR wizard first.' },
        { status: 404 }
      )
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, description')
      .eq('id', organizationId)
      .single()

    let csvContent: string
    let filename: string

    if (template === 'organisation') {
      // Fetch all org-level HMRC data
      const [orgDetailsRes, addressesRes, contactsRes] = await Promise.all([
        supabase.from('epr_hmrc_org_details').select('*').eq('organization_id', organizationId).maybeSingle(),
        supabase.from('epr_hmrc_addresses').select('*').eq('organization_id', organizationId),
        supabase.from('epr_hmrc_contacts').select('*').eq('organization_id', organizationId),
      ])

      if (!orgDetailsRes.data) {
        return NextResponse.json(
          { error: 'Organisation details not found. Complete the HMRC registration steps first.' },
          { status: 404 }
        )
      }

      csvContent = generateOrganisationCSV({
        orgDetails: orgDetailsRes.data as HMRCOrgDetails,
        addresses: (addressesRes.data || []) as HMRCAddress[],
        contacts: (contactsRes.data || []) as HMRCContact[],
        eprSettings: eprSettings as EPROrganizationSettings,
        orgName: org?.name || '',
        tradingName: org?.description || undefined,
      })
      filename = `epr_organisation_details_${new Date().toISOString().slice(0, 10)}.csv`

    } else if (template === 'brands') {
      const { data: brands } = await supabase
        .from('epr_hmrc_brands')
        .select('*')
        .eq('organization_id', organizationId)
        .order('brand_name')

      if (!brands || brands.length === 0) {
        return NextResponse.json(
          { error: 'No brands found. Add brands in the HMRC registration steps.' },
          { status: 404 }
        )
      }

      csvContent = generateBrandsCSV(
        brands as HMRCBrand[],
        eprSettings.rpd_organization_id || '',
        eprSettings.rpd_subsidiary_id
      )
      filename = `epr_brand_details_${new Date().toISOString().slice(0, 10)}.csv`

    } else {
      // partners
      const { data: partners } = await supabase
        .from('epr_hmrc_partners')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_name')

      if (!partners || partners.length === 0) {
        return NextResponse.json(
          { error: 'No partners found. Add partners in the HMRC registration steps.' },
          { status: 404 }
        )
      }

      csvContent = generatePartnersCSV(
        partners as HMRCPartner[],
        eprSettings.rpd_organization_id || '',
        eprSettings.rpd_subsidiary_id
      )
      filename = `epr_partner_details_${new Date().toISOString().slice(0, 10)}.csv`
    }

    // Calculate checksum
    const checksum = await calculateCSVChecksum(csvContent)

    // Store in Supabase Storage
    const storagePath = `${organizationId}/hmrc/${filename}`
    const { error: uploadError } = await supabase.storage
      .from('epr-exports')
      .upload(storagePath, csvContent, {
        contentType: 'text/csv',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to store CSV file' }, { status: 500 })
    }

    // Generate signed URL (1 hour)
    const { data: signedUrlData } = await supabase.storage
      .from('epr-exports')
      .createSignedUrl(storagePath, 3600)

    // Audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: `hmrc_csv_${template}`,
      entity_id: organizationId,
      action: 'csv_generated',
      field_changes: {
        filename,
        checksum,
        size_bytes: new TextEncoder().encode(csvContent).length,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      filename,
      downloadUrl: signedUrlData?.signedUrl || null,
      checksum,
      sizeBytes: new TextEncoder().encode(csvContent).length,
    })
  } catch (err) {
    console.error('Export HMRC CSV error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
