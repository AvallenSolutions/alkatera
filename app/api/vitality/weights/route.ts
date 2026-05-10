/**
 * GET / POST /api/vitality/weights — read or save the org's ESG weighting.
 *
 * Stored on organizations.vitality_weights as a JSONB blob:
 *   { v: 1, e: number, s: number, g: number }
 *
 * The composite endpoint also reads this column. Saving here busts the
 * snapshot for today so the next vitality fetch reflects the new weights.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import {
  DEFAULT_VITALITY_WEIGHTS,
  normaliseWeights,
  type VitalityWeights,
} from '@/lib/vitality/composite'

export const runtime = 'nodejs'

async function resolveContext(req: NextRequest) {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }
  // Require admin/owner for writes — read is permitted for any member.
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
  return {
    userId: user.id,
    organizationId: (membership as any).organization_id as string,
    role,
    service,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  try {
    const { data } = await ctx.service
      .from('organizations')
      .select('vitality_weights')
      .eq('id', ctx.organizationId)
      .maybeSingle()
    const weights = normaliseWeights((data as any)?.vitality_weights ?? null)
    return NextResponse.json({ weights, default: DEFAULT_VITALITY_WEIGHTS })
  } catch (err) {
    return NextResponse.json({
      weights: DEFAULT_VITALITY_WEIGHTS,
      default: DEFAULT_VITALITY_WEIGHTS,
    })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only owners and admins can change weights' },
      { status: 403 },
    )
  }
  let body: Partial<VitalityWeights>
  try {
    body = (await req.json()) as Partial<VitalityWeights>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const weights = normaliseWeights(body)
  const stored = { v: 1, ...weights }
  try {
    await ctx.service
      .from('organizations')
      .update({ vitality_weights: stored })
      .eq('id', ctx.organizationId)
    // Bust today's snapshot so the next composite fetch reflects new weights.
    await ctx.service
      .from('esg_score_snapshots')
      .delete()
      .eq('organization_id', ctx.organizationId)
      .gte('snapshot_date', new Date().toISOString().slice(0, 10))
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, weights })
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only owners and admins can reset weights' },
      { status: 403 },
    )
  }
  try {
    await ctx.service
      .from('organizations')
      .update({ vitality_weights: null })
      .eq('id', ctx.organizationId)
    await ctx.service
      .from('esg_score_snapshots')
      .delete()
      .eq('organization_id', ctx.organizationId)
      .gte('snapshot_date', new Date().toISOString().slice(0, 10))
  } catch {}
  return NextResponse.json({ ok: true, weights: DEFAULT_VITALITY_WEIGHTS })
}
