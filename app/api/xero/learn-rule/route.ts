import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { learnFromManualClassification } from '@/lib/xero/learning'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/learn-rule
 *
 * Creates or updates an org-specific supplier rule from a manual
 * classification, and reclassifies other unclassified transactions
 * from the same contact.
 *
 * Body: { organizationId: string, contactName: string, emissionCategory: string }
 * Returns: { ruleCreated: boolean, additionalClassified: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { organizationId, contactName, emissionCategory } = await request.json()
    if (!organizationId || !contactName || !emissionCategory) {
      return NextResponse.json(
        { error: 'organizationId, contactName, and emissionCategory are required' },
        { status: 400 }
      )
    }

    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const result = await learnFromManualClassification(
      organizationId,
      contactName,
      emissionCategory
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error in learn-rule:', error)
    const message = error instanceof Error ? error.message : 'Failed to create rule'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
