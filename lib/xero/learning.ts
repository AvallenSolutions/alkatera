import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { classifyTransaction, type AccountMapping, type SupplierRule } from './classifier'
import { calculateSpendBasedEmissions } from './spend-factors'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Learn from a manual classification by creating or updating an
 * org-specific supplier rule. Also reclassifies other unclassified
 * transactions from the same contact.
 *
 * Returns the number of additional transactions reclassified.
 */
export async function learnFromManualClassification(
  organizationId: string,
  contactName: string,
  emissionCategory: string
): Promise<{ ruleCreated: boolean; additionalClassified: number }> {
  if (!contactName || !emissionCategory) {
    return { ruleCreated: false, additionalClassified: 0 }
  }

  const db = getServiceClient()

  // Check for existing org-specific rule for this exact contact name
  const { data: existingRules } = await db
    .from('xero_supplier_rules')
    .select('id, emission_category, supplier_pattern')
    .eq('organization_id', organizationId)
    .ilike('supplier_pattern', contactName)
    .limit(1)

  let ruleCreated = false

  if (existingRules && existingRules.length > 0) {
    // Update existing rule if category changed
    if (existingRules[0].emission_category !== emissionCategory) {
      await db
        .from('xero_supplier_rules')
        .update({
          emission_category: emissionCategory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRules[0].id)
      ruleCreated = true
    }
  } else {
    // Create new org-specific supplier rule
    const { error } = await db
      .from('xero_supplier_rules')
      .insert({
        organization_id: organizationId,
        supplier_pattern: contactName,
        emission_category: emissionCategory,
        priority: 50,
        is_system_default: false,
      })

    if (error) {
      console.error('[Learning] Failed to create supplier rule:', error.message)
    } else {
      ruleCreated = true
    }
  }

  // Reclassify other unclassified transactions from the same contact
  const { data: unclassified } = await db
    .from('xero_transactions')
    .select('id, amount, currency')
    .eq('organization_id', organizationId)
    .eq('xero_contact_name', contactName)
    .is('emission_category', null)

  let additionalClassified = 0

  if (unclassified && unclassified.length > 0) {
    const updates = unclassified.map(tx => ({
      id: tx.id,
      emission_category: emissionCategory,
      classification_source: 'supplier_rule' as const,
      classification_confidence: 0.9,
      spend_based_emissions_kg: calculateSpendBasedEmissions(
        tx.amount,
        emissionCategory,
        tx.currency || 'GBP'
      ),
      upgrade_status: 'pending' as const,
      updated_at: new Date().toISOString(),
    }))

    const results = await Promise.all(
      updates.map(({ id, ...fields }) =>
        db.from('xero_transactions').update(fields).eq('id', id)
      )
    )

    additionalClassified = results.filter(r => !r.error).length
  }

  return { ruleCreated, additionalClassified }
}
