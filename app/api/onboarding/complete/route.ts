import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { UserRole, PrimaryGoal } from '@/lib/onboarding/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticate(organizationId: string) {
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

  const service = getServiceClient()
  const { data: membership } = await service
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()
  return { user, authorized: !!membership }
}

type RosaPersona = 'leadership' | 'finance' | 'sustainability' | 'operator'

const ROLE_TO_PERSONA: Record<UserRole, RosaPersona | null> = {
  sustainability_manager: 'sustainability',
  operations_manager: 'operator',
  production_manager: 'operator',
  founder_executive: 'leadership',
  consultant_advisor: 'sustainability',
  other: null,
}

type TrackerId =
  | 'total_emissions'
  | 'water_use'
  | 'lca_coverage'
  | 'supplier_esg_signal'
  | 'target_progress'
  | 'custom_rosa'

/**
 * Pick the tracker the user is most likely to find immediately useful, given
 * what data we have. Falls through to LCA coverage which only needs products
 * and PCFs — both guaranteed by the estimate step.
 */
async function pickTrackerId(
  service: ReturnType<typeof getServiceClient>,
  orgId: string,
  goals: PrimaryGoal[] | undefined,
  hasTarget: boolean,
): Promise<TrackerId> {
  // Real time-series data wins. Breww sync produces production_logs; bill
  // uploads produce activity_data.
  const { count: logCount } = await service
    .from('production_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  if ((logCount ?? 0) > 0) return 'total_emissions'

  const { count: activityCount } = await service
    .from('activity_data')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  if ((activityCount ?? 0) > 0) return 'water_use'

  if (hasTarget && goals?.includes('get_certified')) return 'target_progress'
  if (goals?.includes('supply_chain')) return 'supplier_esg_signal'
  return 'lca_coverage'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId } = body
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const { user, authorized } = await authenticate(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const service = getServiceClient()

    // Pull the latest onboarding state so we read from the source of truth
    // (the client passes state with each save, but completing is the moment
    // we commit the side effects — read fresh).
    const { data: onboardingRow } = await service
      .from('onboarding_state')
      .select('state')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    const personalization = ((onboardingRow?.state as any)?.personalization ?? {}) as {
      role?: UserRole
      primaryGoals?: PrimaryGoal[]
      estimateTonnesCO2e?: number
      targetReductionPct?: number
      targetYear?: number
    }

    const results: Record<string, 'ok' | 'skipped' | 'error'> = {}

    // 1) Persona — map UserRole to RosaPersona so QuickPrompts + drawer
    //    speak in the right register from the first render.
    const persona = personalization.role ? ROLE_TO_PERSONA[personalization.role] : null
    if (persona) {
      const { error } = await service
        .from('rosa_memory')
        .upsert(
          {
            organization_id: organizationId,
            user_id: user.id,
            scope: 'user',
            key: 'persona',
            value: persona,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,user_id,scope,key' },
        )
      results.persona = error ? 'error' : 'ok'
      if (error) console.error('[onboarding/complete] persona write failed:', error)
    } else {
      results.persona = 'skipped'
    }

    // 2) Sustainability target — write one row keyed to total_co2e if the
    //    user picked a target in the new fast-track-target step.
    let hasTarget = false
    if (personalization.estimateTonnesCO2e && personalization.targetReductionPct && personalization.targetYear) {
      const baseline = personalization.estimateTonnesCO2e * 1000 // tonnes → kg CO₂e
      const targetValue = baseline * (1 - personalization.targetReductionPct / 100)
      const today = new Date().toISOString().slice(0, 10)
      const targetDate = `${personalization.targetYear}-12-31`
      const { error } = await service
        .from('sustainability_targets')
        .insert({
          organization_id: organizationId,
          metric_key: 'total_co2e',
          baseline_value: baseline,
          baseline_date: today,
          target_value: targetValue,
          target_date: targetDate,
          status: 'active',
          methodology: 'Onboarding baseline (industry-benchmark estimate)',
          notes: `Set during onboarding: reduce by ${personalization.targetReductionPct}% by ${personalization.targetYear}.`,
          created_by: user.id,
        })
      results.target = error ? 'error' : 'ok'
      if (error) console.error('[onboarding/complete] target insert failed:', error)
      else hasTarget = true
    } else {
      results.target = 'skipped'
    }

    // 3) Tracker selection — pre-pick what to show on the hub so the user
    //    doesn't land on a setup modal.
    const trackerId = await pickTrackerId(service, organizationId, personalization.primaryGoals, hasTarget)
    {
      const { error } = await service
        .from('rosa_progress_tracker_cache')
        .upsert(
          {
            organization_id: organizationId,
            user_id: user.id,
            tracker_id: trackerId,
            payload: { source: 'onboarding_default', selected_reason: hasTarget ? 'target_set' : 'data_available' },
            signals_hash: 'onboarding-default',
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,user_id' },
        )
      results.tracker = error ? 'error' : 'ok'
      if (error) console.error('[onboarding/complete] tracker write failed:', error)
    }

    // 4) Seed Rosa activity so RecentlyFromRosa isn't empty on the first
    //    visit. These are real records of what just happened, not fakes.
    const seedRows: Array<Record<string, any>> = []
    if (personalization.estimateTonnesCO2e) {
      seedRows.push({
        organization_id: organizationId,
        kind: 'onboarding_estimate',
        source: 'manual',
        source_ref: { source: 'fast_track_onboarding' },
        payload: {
          estimate_tonnes_co2e: personalization.estimateTonnesCO2e,
          methodology: 'industry-benchmark',
        },
        title: `Starter footprint estimate: ~${personalization.estimateTonnesCO2e.toLocaleString()} t CO₂e/yr`,
        summary: 'Calculated from your products and annual volumes using industry benchmarks. Refine with real data.',
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
    }
    if (hasTarget) {
      seedRows.push({
        organization_id: organizationId,
        kind: 'propose_target',
        source: 'manual',
        source_ref: { source: 'fast_track_onboarding' },
        payload: {
          reduction_pct: personalization.targetReductionPct,
          target_year: personalization.targetYear,
        },
        title: `Target locked in: ${personalization.targetReductionPct}% by ${personalization.targetYear}`,
        summary: 'You set a reduction target during onboarding. Rosa will track progress against it.',
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
    }
    // Always nudge the user to bring in a real bill — this is the most
    // valuable next action regardless of what they captured above.
    seedRows.push({
      organization_id: organizationId,
      kind: 'request_data',
      source: 'manual',
      source_ref: { source: 'fast_track_onboarding' },
      payload: { suggested: 'utility_bill_upload' },
      title: 'Add a utility bill to sharpen your estimate',
      summary: 'Drop in a recent energy, gas or water bill. Rosa reads it and replaces the estimate with real numbers.',
      status: 'open',
    })

    if (seedRows.length > 0) {
      const { error } = await service.from('agent_exceptions').insert(seedRows)
      results.seed_activity = error ? 'error' : 'ok'
      if (error) console.error('[onboarding/complete] seed rows insert failed:', error)
    } else {
      results.seed_activity = 'skipped'
    }

    return NextResponse.json({ success: true, results, trackerId })
  } catch (err) {
    console.error('[onboarding/complete] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
