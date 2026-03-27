import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
 * GET /api/epr/hmrc-details?organizationId=xxx
 * Fetch all HMRC registration data (org details, addresses, contacts)
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
    const [orgDetailsRes, addressesRes, contactsRes] = await Promise.all([
      supabase
        .from('epr_hmrc_org_details')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase
        .from('epr_hmrc_addresses')
        .select('*')
        .eq('organization_id', organizationId)
        .order('address_type'),
      supabase
        .from('epr_hmrc_contacts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('contact_type'),
    ])

    if (orgDetailsRes.error) throw orgDetailsRes.error
    if (addressesRes.error) throw addressesRes.error
    if (contactsRes.error) throw contactsRes.error

    return NextResponse.json({
      orgDetails: orgDetailsRes.data,
      addresses: addressesRes.data || [],
      contacts: contactsRes.data || [],
    })
  } catch (err) {
    console.error('HMRC details GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch HMRC details' }, { status: 500 })
  }
}

/**
 * POST /api/epr/hmrc-details
 * Upsert HMRC org details, addresses, and/or contacts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, orgDetails, addresses, contacts } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Upsert org details
    if (orgDetails) {
      const { error } = await supabase
        .from('epr_hmrc_org_details')
        .upsert(
          { organization_id: organizationId, ...orgDetails },
          { onConflict: 'organization_id' }
        )

      if (error) {
        console.error('Error saving HMRC org details:', error)
        return NextResponse.json({ error: 'Failed to save organisation details' }, { status: 500 })
      }
    }

    // Upsert addresses (replace all for the org)
    if (addresses && Array.isArray(addresses)) {
      // Delete existing then insert new (simpler than per-type upsert)
      await supabase
        .from('epr_hmrc_addresses')
        .delete()
        .eq('organization_id', organizationId)

      if (addresses.length > 0) {
        const rows = addresses.map((addr: Record<string, unknown>) => ({
          organization_id: organizationId,
          address_type: addr.address_type,
          line_1: addr.line_1,
          line_2: addr.line_2 || null,
          city: addr.city,
          county: addr.county || null,
          postcode: addr.postcode,
          country: addr.country || 'United Kingdom',
          phone: addr.phone || null,
        }))

        const { error } = await supabase
          .from('epr_hmrc_addresses')
          .insert(rows)

        if (error) {
          console.error('Error saving HMRC addresses:', error)
          return NextResponse.json({ error: 'Failed to save addresses' }, { status: 500 })
        }
      }
    }

    // Upsert contacts (replace all for the org)
    if (contacts && Array.isArray(contacts)) {
      await supabase
        .from('epr_hmrc_contacts')
        .delete()
        .eq('organization_id', organizationId)

      if (contacts.length > 0) {
        const rows = contacts.map((c: Record<string, unknown>) => ({
          organization_id: organizationId,
          contact_type: c.contact_type,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone || null,
          email: c.email || null,
          job_title: c.job_title || null,
        }))

        const { error } = await supabase
          .from('epr_hmrc_contacts')
          .insert(rows)

        if (error) {
          console.error('Error saving HMRC contacts:', error)
          return NextResponse.json({ error: 'Failed to save contacts' }, { status: 500 })
        }
      }
    }

    // Write audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'hmrc_details',
      entity_id: organizationId,
      action: 'update',
      field_changes: {
        sections_updated: [
          orgDetails ? 'org_details' : null,
          addresses ? 'addresses' : null,
          contacts ? 'contacts' : null,
        ].filter(Boolean),
      },
      performed_by: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('HMRC details POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
