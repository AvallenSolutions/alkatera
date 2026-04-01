import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

function getAuthClient() {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
}

/** POST /api/supplier-esg/verify — Admin verify or request revision */
export async function POST(request: NextRequest) {
  try {
    const authClient = getAuthClient()

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // Check admin status using auth client (has auth.uid() context)
    const { data: isAdmin } = await authClient.rpc('is_alkatera_admin')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { assessment_id, action, notes } = body as {
      assessment_id: string
      action: 'verify' | 'request_revision'
      notes?: string
    }

    if (!assessment_id || !action) {
      return NextResponse.json(
        { error: 'assessment_id and action are required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Validate assessment exists and is in the correct state before acting
    const { data: assessment, error: fetchErr } = await supabase
      .from('supplier_esg_assessments')
      .select('id, submitted, is_verified')
      .eq('id', assessment_id)
      .single()

    if (fetchErr || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (action === 'verify') {
      if (!assessment.submitted) {
        return NextResponse.json(
          { error: 'Assessment must be submitted before verification' },
          { status: 400 }
        )
      }
      if (assessment.is_verified) {
        return NextResponse.json(
          { error: 'Assessment is already verified' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('supplier_esg_assessments')
        .update({
          is_verified: true,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessment_id)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    if (action === 'request_revision') {
      if (!assessment.submitted) {
        return NextResponse.json(
          { error: 'Assessment is not in submitted state' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('supplier_esg_assessments')
        .update({
          submitted: false,
          submitted_at: null,
          verification_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessment_id)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('supplier-esg/verify error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
