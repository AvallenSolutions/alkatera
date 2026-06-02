import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isReadyToSubmit } from '@/lib/supplier-esg/scoring'
import { recalculateBcorpForSupplier } from '@/lib/certifications/recalculate'

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

/** POST /api/supplier-esg/submit — Mark assessment as submitted */
export async function POST() {
  try {
    const user = await authenticateUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const supabase = getServiceClient()

    // Find supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Not a supplier' }, { status: 403 })
    }

    // Fetch assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('supplier_esg_assessments')
      .select('*')
      .eq('supplier_id', supplier.id)
      .maybeSingle()

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: 'No assessment found. Please complete the questionnaire first.' },
        { status: 404 }
      )
    }

    if (assessment.submitted) {
      return NextResponse.json({ error: 'Assessment already submitted' }, { status: 400 })
    }

    // Deforestation questions only apply to suppliers with commodity products;
    // mirror the UI's applicability rule so the server doesn't require hidden ones.
    const { data: commodityProducts } = await supabase
      .from('supplier_products')
      .select('id')
      .eq('supplier_id', supplier.id)
      .neq('commodity_type', 'none')
      .limit(1)
    const hasCommodityProducts = !!(commodityProducts && commodityProducts.length > 0)

    // Validate all applicable questions answered
    if (!isReadyToSubmit(assessment.answers || {}, { hasCommodityProducts })) {
      return NextResponse.json(
        { error: 'All questions must be answered before submitting.' },
        { status: 400 }
      )
    }

    // Mark as submitted
    const { error: updateError } = await supabase
      .from('supplier_esg_assessments')
      .update({
        submitted: true,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessment.id)

    if (updateError) throw updateError

    // Submitting flips this supplier into the buyer's B Corp supply-chain coverage.
    // Refresh the buyer's readiness now rather than waiting for the nightly cron.
    await recalculateBcorpForSupplier(supabase, supplier.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('supplier-esg/submit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
