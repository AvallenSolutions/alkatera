import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateScores, getSectionCompletion } from '@/lib/supplier-esg/scoring'
import type { EsgResponse } from '@/lib/supplier-esg/questions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticateUser() {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return null
  return user
}

/** POST /api/supplier-esg/save — Auto-save answers */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const { answers } = body as { answers: Record<string, EsgResponse> }

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Find the supplier for this user
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Not a supplier' }, { status: 403 })
    }

    // Calculate scores and completion
    const scores = calculateScores(answers)
    const completion = getSectionCompletion(answers)

    const updatePayload = {
      answers,
      labour_human_rights_completed: completion.labour_human_rights,
      environment_completed: completion.environment,
      ethics_completed: completion.ethics,
      health_safety_completed: completion.health_safety,
      management_systems_completed: completion.management_systems,
      score_labour: scores.sections.labour_human_rights,
      score_environment: scores.sections.environment,
      score_ethics: scores.sections.ethics,
      score_health_safety: scores.sections.health_safety,
      score_management: scores.sections.management_systems,
      score_total: scores.total,
      score_rating: scores.rating,
      updated_at: new Date().toISOString(),
    }

    // Upsert: create if not exists, update if exists
    const { data: existing } = await supabase
      .from('supplier_esg_assessments')
      .select('id, submitted')
      .eq('supplier_id', supplier.id)
      .maybeSingle()

    if (existing?.submitted) {
      return NextResponse.json(
        { error: 'Assessment already submitted. Cannot modify.' },
        { status: 400 }
      )
    }

    let assessment
    if (existing) {
      const { data, error } = await supabase
        .from('supplier_esg_assessments')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      assessment = data
    } else {
      const { data, error } = await supabase
        .from('supplier_esg_assessments')
        .insert({ supplier_id: supplier.id, ...updatePayload })
        .select()
        .single()

      if (error) throw error
      assessment = data

      // Link back to supplier
      await supabase
        .from('suppliers')
        .update({ esg_assessment_id: assessment.id })
        .eq('id', supplier.id)
    }

    return NextResponse.json({ assessment })
  } catch (err) {
    console.error('supplier-esg/save error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
