import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { learnFromManualClassificationBatch } from '@/lib/xero/learning'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/learn-rule/batch
 *
 * Body: { organizationId: string, contactNames: string[], emissionCategory: string }
 * Returns: { rulesCreated, additionalClassified, contacts: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, contactNames, emissionCategory } = await request.json()
    if (!organizationId || !Array.isArray(contactNames) || contactNames.length === 0 || !emissionCategory) {
      return NextResponse.json(
        { error: 'organizationId, contactNames (non-empty array), and emissionCategory are required' },
        { status: 400 }
      )
    }

    if (contactNames.length > 500) {
      return NextResponse.json(
        { error: 'Too many contactNames in one batch (max 500)' },
        { status: 400 }
      )
    }

    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const result = await learnFromManualClassificationBatch(
      organizationId,
      contactNames,
      emissionCategory
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error in batch learn-rule:', error)
    const message = error instanceof Error ? error.message : 'Failed to create rules'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
