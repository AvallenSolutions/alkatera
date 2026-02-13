import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { estimateFromAddresses, populationWeightedFallback } from '@/lib/epr/nation-estimator'
import type { AddressRecord } from '@/lib/epr/nation-estimator'

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
 * POST /api/epr/estimate-nations
 *
 * Auto-estimate nation-of-sale split from available customer/delivery data.
 * Falls back to ONS population-weighted defaults when insufficient data.
 *
 * Input: { organizationId }
 * Returns: { estimation, audit_justification }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Try to gather address data from various sources
    const addresses: AddressRecord[] = []

    // Source 1: Facility addresses (production/warehousing locations)
    const { data: facilities } = await supabase
      .from('facilities')
      .select('postcode, address')
      .eq('organization_id', organizationId)
      .not('postcode', 'is', null)

    if (facilities) {
      for (const facility of facilities) {
        if (facility.postcode) {
          addresses.push({ postcode: facility.postcode, quantity: 1 })
        }
      }
    }

    // Source 2: Customer/sales addresses (if the org tracks delivery data)
    // Check for customer_addresses or sales_orders tables
    const { data: customerAddresses } = await supabase
      .from('customer_addresses')
      .select('postcode, order_count')
      .eq('organization_id', organizationId)
      .not('postcode', 'is', null)
      .limit(10000)

    if (customerAddresses && customerAddresses.length > 0) {
      for (const addr of customerAddresses) {
        addresses.push({
          postcode: addr.postcode,
          quantity: addr.order_count ?? 1,
        })
      }
    }

    // Source 3: Invoice addresses
    const { data: invoiceAddresses } = await supabase
      .from('invoices')
      .select('delivery_postcode')
      .eq('organization_id', organizationId)
      .not('delivery_postcode', 'is', null)
      .limit(10000)

    if (invoiceAddresses && invoiceAddresses.length > 0) {
      for (const inv of invoiceAddresses) {
        addresses.push({ postcode: inv.delivery_postcode, quantity: 1 })
      }
    }

    // Run estimation
    const estimation = addresses.length > 0
      ? estimateFromAddresses(addresses)
      : populationWeightedFallback()

    // Write audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'settings',
      entity_id: organizationId,
      action: 'estimate_nations',
      field_changes: null,
      snapshot: {
        estimation,
        source_counts: {
          facilities: facilities?.length ?? 0,
          customer_addresses: customerAddresses?.length ?? 0,
          invoices: invoiceAddresses?.length ?? 0,
          total_addresses: addresses.length,
        },
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      estimation,
      data_sources: {
        facilities: facilities?.length ?? 0,
        customer_addresses: customerAddresses?.length ?? 0,
        invoices: invoiceAddresses?.length ?? 0,
        total_records: addresses.length,
      },
    })
  } catch (err) {
    console.error('EPR estimate-nations POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
