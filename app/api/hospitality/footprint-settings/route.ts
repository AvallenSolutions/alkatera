/**
 * GET / PUT /api/hospitality/footprint-settings — read or set whether the
 * hospitality element counts toward the company total.
 *
 * Stored on organizations.report_defaults.include_hospitality (boolean).
 * Absent ⇒ treated as true (count it). Governs carbon, water and waste together.
 * calculateCorporateEmissions reads the same flag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { parseBandThresholds } from '@/lib/hospitality/carbon-band'

export const runtime = 'nodejs'

async function resolveContext() {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }
  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id, roles!inner(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ error: 'Service role missing' }, { status: 500 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const role = String((membership as any)?.roles?.name ?? '').toLowerCase()
  return { organizationId: (membership as any).organization_id as string, role, service }
}

export async function GET() {
  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error
  const { data } = await ctx.service
    .from('organizations')
    .select('report_defaults')
    .eq('id', ctx.organizationId)
    .maybeSingle()
  const defaults = (data?.report_defaults as any) ?? {}
  const include = defaults.include_hospitality !== false
  const band_thresholds = parseBandThresholds(defaults.hospitality_band_thresholds)
  return NextResponse.json({ include_hospitality: include, band_thresholds })
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can change this' }, { status: 403 })
  }
  let body: { include_hospitality?: unknown; band_thresholds?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.include_hospitality !== undefined) {
    if (typeof body.include_hospitality !== 'boolean') {
      return NextResponse.json({ error: 'include_hospitality must be a boolean' }, { status: 400 })
    }
    patch.include_hospitality = body.include_hospitality
  }
  if (body.band_thresholds !== undefined) {
    const raw = body.band_thresholds as any
    const low = Number(raw?.low)
    const medium = Number(raw?.medium)
    if (!Number.isFinite(low) || !Number.isFinite(medium) || low <= 0 || medium <= low) {
      return NextResponse.json({ error: 'band_thresholds must have 0 < low < medium' }, { status: 400 })
    }
    patch.hospitality_band_thresholds = { low, medium }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Read-modify-write the JSONB so other report_defaults keys survive.
  const { data: org } = await ctx.service
    .from('organizations')
    .select('report_defaults')
    .eq('id', ctx.organizationId)
    .maybeSingle()
  const merged = { ...((org?.report_defaults as any) ?? {}), ...patch }
  const { error } = await ctx.service
    .from('organizations')
    .update({ report_defaults: merged })
    .eq('id', ctx.organizationId)
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  return NextResponse.json({
    include_hospitality: merged.include_hospitality !== false,
    band_thresholds: parseBandThresholds(merged.hospitality_band_thresholds),
  })
}
