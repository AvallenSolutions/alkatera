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
 * GET /api/epr/settings?organizationId=xxx
 * Fetch EPR organisation settings
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
      .from('epr_organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching EPR settings:', error)
      return NextResponse.json({ error: 'Failed to fetch EPR settings' }, { status: 500 })
    }

    // Return default shape if no settings exist yet
    if (!data) {
      return NextResponse.json({
        settings: {
          organization_id: organizationId,
          rpd_organization_id: null,
          rpd_subsidiary_id: null,
          annual_turnover_gbp: null,
          estimated_annual_packaging_tonnage: null,
          obligation_size: 'pending',
          default_packaging_activity: 'brand',
          default_uk_nation: 'england',
          nation_sales_england_pct: 84.3,
          nation_sales_scotland_pct: 8.2,
          nation_sales_wales_pct: 4.7,
          nation_sales_ni_pct: 2.8,
          nation_sales_method: 'manual',
          nation_sales_last_estimated_at: null,
          drs_applies: true,
          wizard_state: null,
        },
      })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error('EPR settings GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/epr/settings
 * Upsert EPR organisation settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, settings, wizard_state } = body

    // Support wizard_state-only updates (from EPR wizard)
    if (!organizationId || (!settings && wizard_state === undefined)) {
      return NextResponse.json(
        { error: 'organizationId and settings are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch existing to compute field_changes for audit log
    const { data: existing } = await supabase
      .from('epr_organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    // If only wizard_state is being updated (no settings object), do a lightweight update
    if (!settings && wizard_state !== undefined) {
      if (!existing) {
        // Create a minimal settings row to hold the wizard state
        const { data, error } = await supabase
          .from('epr_organization_settings')
          .upsert({ organization_id: organizationId, wizard_state }, { onConflict: 'organization_id' })
          .select()
          .single()

        if (error) {
          console.error('Error saving wizard state:', error)
          return NextResponse.json({ error: 'Failed to save wizard state' }, { status: 500 })
        }
        return NextResponse.json({ settings: data })
      }

      const { data, error } = await supabase
        .from('epr_organization_settings')
        .update({ wizard_state })
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        console.error('Error saving wizard state:', error)
        return NextResponse.json({ error: 'Failed to save wizard state' }, { status: 500 })
      }
      return NextResponse.json({ settings: data })
    }

    // Validate nation percentages sum to 100 (within tolerance)
    const nationSum =
      (settings.nation_sales_england_pct ?? 0) +
      (settings.nation_sales_scotland_pct ?? 0) +
      (settings.nation_sales_wales_pct ?? 0) +
      (settings.nation_sales_ni_pct ?? 0)

    if (Math.abs(nationSum - 100) > 0.5) {
      return NextResponse.json(
        { error: `Nation-of-sale percentages must sum to 100% (currently ${nationSum.toFixed(1)}%)` },
        { status: 400 }
      )
    }

    const upsertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      rpd_organization_id: settings.rpd_organization_id ?? null,
      rpd_subsidiary_id: settings.rpd_subsidiary_id ?? null,
      annual_turnover_gbp: settings.annual_turnover_gbp ?? null,
      estimated_annual_packaging_tonnage: settings.estimated_annual_packaging_tonnage ?? null,
      obligation_size: settings.obligation_size ?? 'pending',
      default_packaging_activity: settings.default_packaging_activity ?? 'brand',
      default_uk_nation: settings.default_uk_nation ?? 'england',
      nation_sales_england_pct: settings.nation_sales_england_pct ?? 84.3,
      nation_sales_scotland_pct: settings.nation_sales_scotland_pct ?? 8.2,
      nation_sales_wales_pct: settings.nation_sales_wales_pct ?? 4.7,
      nation_sales_ni_pct: settings.nation_sales_ni_pct ?? 2.8,
      nation_sales_method: settings.nation_sales_method ?? 'manual',
      nation_sales_last_estimated_at: settings.nation_sales_last_estimated_at ?? null,
      drs_applies: settings.drs_applies ?? true,
    }

    // Include wizard_state in the upsert if provided alongside settings
    if (wizard_state !== undefined) {
      upsertPayload.wizard_state = wizard_state
    }

    const { data, error } = await supabase
      .from('epr_organization_settings')
      .upsert(upsertPayload, { onConflict: 'organization_id' })
      .select()
      .single()

    if (error) {
      console.error('Error saving EPR settings:', error)
      return NextResponse.json({ error: 'Failed to save EPR settings' }, { status: 500 })
    }

    // Write audit log entry
    const fieldChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (existing) {
      for (const key of Object.keys(upsertPayload) as (keyof typeof upsertPayload)[]) {
        if (key === 'organization_id') continue
        const oldVal = (existing as Record<string, unknown>)[key]
        const newVal = upsertPayload[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          fieldChanges[key] = { old: oldVal, new: newVal }
        }
      }
    }

    if (Object.keys(fieldChanges).length > 0 || !existing) {
      await supabase.from('epr_audit_log').insert({
        organization_id: organizationId,
        entity_type: 'settings',
        entity_id: data.id,
        action: existing ? 'update' : 'create',
        field_changes: Object.keys(fieldChanges).length > 0 ? fieldChanges : null,
        snapshot: data,
        performed_by: user.id,
      })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error('EPR settings POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
