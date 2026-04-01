import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role'
import { classifyTransaction, type AccountMapping, type SupplierRule } from '@/lib/xero/classifier'
import { calculateSpendBasedEmissions } from '@/lib/xero/spend-factors'
import { extractFromDescription, hasExtractedData } from '@/lib/xero/description-extractor'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/xero/reclassify
 *
 * Re-runs the rule-based classifier on ALL transactions for an organisation.
 * Called after account mappings are updated so that existing transactions
 * pick up the new category assignments.
 *
 * Only updates transactions whose classification actually changed, and never
 * overwrites manual or AI classifications with lower-confidence results.
 *
 * Body: { organizationId: string }
 * Returns: { reclassified: number, total: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // 2. Parse body
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // 3. Check admin role
    const role = await getMemberRole(supabase, organizationId, user.id)
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 4. Use service client for bulk updates
    const db = getServiceClient()

    // 5. Load classification data
    const { data: accountMappings } = await db
      .from('xero_account_mappings')
      .select('xero_account_id, emission_category, is_excluded')
      .eq('organization_id', organizationId)

    const { data: supplierRules } = await db
      .from('xero_supplier_rules')
      .select('supplier_pattern, emission_category, priority, organization_id')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order('priority', { ascending: false })

    const mappings: AccountMapping[] = accountMappings || []
    const rules: SupplierRule[] = supplierRules || []

    // 6. Fetch ALL transactions for the org (not just unclassified)
    const { data: transactions } = await db
      .from('xero_transactions')
      .select('id, xero_account_id, xero_contact_name, description, amount, currency, emission_category, classification_source, spend_based_emissions_kg')
      .eq('organization_id', organizationId)

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ reclassified: 0, total: 0 })
    }

    // 7. Re-classify each transaction and collect those that changed
    let reclassified = 0

    for (const tx of transactions) {
      // Skip manually classified transactions - user intent takes priority
      if (tx.classification_source === 'manual') continue

      const classification = classifyTransaction(
        {
          xeroAccountId: tx.xero_account_id,
          contactName: tx.xero_contact_name,
          description: tx.description,
        },
        mappings,
        rules
      )

      const newCategory = classification?.category || null
      const newSource = classification?.source || null
      const newConfidence = classification?.confidence || null
      const newEmissions = newCategory
        ? calculateSpendBasedEmissions(tx.amount, newCategory, tx.currency || 'GBP')
        : null

      // Only update if classification actually changed
      const categoryChanged = newCategory !== tx.emission_category
      // Also update if source upgraded (e.g. supplier_rule -> account_mapping)
      const sourceUpgraded = newSource === 'account_mapping' && tx.classification_source === 'supplier_rule'

      if (!categoryChanged && !sourceUpgraded) continue

      // Don't downgrade AI classifications unless we have an account_mapping
      if (tx.classification_source === 'ai' && newSource !== 'account_mapping') continue

      const extracted = extractFromDescription(tx.description, tx.xero_contact_name)
      const extractedMetadata = hasExtractedData(extracted) ? extracted : null

      await db
        .from('xero_transactions')
        .update({
          emission_category: newCategory,
          classification_source: newSource,
          classification_confidence: newConfidence,
          spend_based_emissions_kg: newEmissions,
          upgrade_status: newCategory ? 'pending' : 'not_applicable',
          extracted_metadata: extractedMetadata,
        })
        .eq('id', tx.id)

      reclassified++
    }

    return NextResponse.json({ reclassified, total: transactions.length })
  } catch (error: unknown) {
    console.error('Error in Xero reclassify:', error)
    const message = error instanceof Error ? error.message : 'Reclassification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
