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
 * GET /api/epr/hmrc-brands?organizationId=xxx
 * Fetch all HMRC brands for an organisation
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
    const { data, error } = await supabase
      .from('epr_hmrc_brands')
      .select('*')
      .eq('organization_id', organizationId)
      .order('brand_name')

    if (error) throw error

    return NextResponse.json({ brands: data || [] })
  } catch (err) {
    console.error('HMRC brands GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
  }
}

/**
 * POST /api/epr/hmrc-brands
 * Bulk upsert brands (replaces all existing brands for the org)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, brands } = body

    if (!organizationId || !Array.isArray(brands)) {
      return NextResponse.json(
        { error: 'organizationId and brands array are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Replace all brands
    await supabase
      .from('epr_hmrc_brands')
      .delete()
      .eq('organization_id', organizationId)

    if (brands.length > 0) {
      const rows = brands.map((b: { brand_name: string; brand_type_code?: string }) => ({
        organization_id: organizationId,
        brand_name: b.brand_name.trim(),
        brand_type_code: b.brand_type_code || 'BN',
      }))

      const { error } = await supabase
        .from('epr_hmrc_brands')
        .insert(rows)

      if (error) {
        console.error('Error saving HMRC brands:', error)
        return NextResponse.json({ error: 'Failed to save brands' }, { status: 500 })
      }
    }

    // Audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'hmrc_brands',
      entity_id: organizationId,
      action: 'update',
      field_changes: { brand_count: brands.length },
      performed_by: user.id,
    })

    // Return updated list
    const { data } = await supabase
      .from('epr_hmrc_brands')
      .select('*')
      .eq('organization_id', organizationId)
      .order('brand_name')

    return NextResponse.json({ brands: data || [] })
  } catch (err) {
    console.error('HMRC brands POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
