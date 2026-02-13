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
 * GET /api/epr/audit-log?organizationId=xxx&page=1&limit=50&entity_type=settings&action=update&from=2025-01-01&to=2025-12-31
 *
 * Paginated audit log with filters.
 */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { user, authorized } = await authenticateAndAuthorize(organizationId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200)
  const entityType = request.nextUrl.searchParams.get('entity_type')
  const action = request.nextUrl.searchParams.get('action')
  const fromDate = request.nextUrl.searchParams.get('from')
  const toDate = request.nextUrl.searchParams.get('to')

  const supabase = getServiceClient()

  try {
    const offset = (page - 1) * limit

    let query = supabase
      .from('epr_audit_log')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('performed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) query = query.eq('entity_type', entityType)
    if (action) query = query.eq('action', action)
    if (fromDate) query = query.gte('performed_at', fromDate)
    if (toDate) query = query.lte('performed_at', toDate)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching audit log:', error)
      return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
    }

    // Enrich entries with user display names
    const userIds = Array.from(new Set((data || []).map(e => e.performed_by).filter(Boolean)))
    let userMap: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds)

      if (users) {
        for (const u of users) {
          userMap[u.id] = u.display_name || u.email || 'Unknown'
        }
      }
    }

    const enrichedEntries = (data || []).map(entry => ({
      ...entry,
      performed_by_name: entry.performed_by ? (userMap[entry.performed_by] || 'Unknown') : 'System',
    }))

    return NextResponse.json({
      entries: enrichedEntries,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (err) {
    console.error('EPR audit-log GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
