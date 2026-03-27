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
 * GET /api/epr/hmrc-partners?organizationId=xxx
 * Fetch all HMRC partners for an organisation (partnerships only)
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
      .from('epr_hmrc_partners')
      .select('*')
      .eq('organization_id', organizationId)
      .order('last_name')

    if (error) throw error

    return NextResponse.json({ partners: data || [] })
  } catch (err) {
    console.error('HMRC partners GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
  }
}

/**
 * POST /api/epr/hmrc-partners
 * Bulk upsert partners (replaces all existing partners for the org)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, partners } = body

    if (!organizationId || !Array.isArray(partners)) {
      return NextResponse.json(
        { error: 'organizationId and partners array are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Replace all partners
    await supabase
      .from('epr_hmrc_partners')
      .delete()
      .eq('organization_id', organizationId)

    if (partners.length > 0) {
      const rows = partners.map((p: { first_name: string; last_name: string; phone?: string; email?: string }) => ({
        organization_id: organizationId,
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        phone: p.phone?.trim() || null,
        email: p.email?.trim() || null,
      }))

      const { error } = await supabase
        .from('epr_hmrc_partners')
        .insert(rows)

      if (error) {
        console.error('Error saving HMRC partners:', error)
        return NextResponse.json({ error: 'Failed to save partners' }, { status: 500 })
      }
    }

    // Audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'hmrc_partners',
      entity_id: organizationId,
      action: 'update',
      field_changes: { partner_count: partners.length },
      performed_by: user.id,
    })

    // Return updated list
    const { data } = await supabase
      .from('epr_hmrc_partners')
      .select('*')
      .eq('organization_id', organizationId)
      .order('last_name')

    return NextResponse.json({ partners: data || [] })
  } catch (err) {
    console.error('HMRC partners POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
