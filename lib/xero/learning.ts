import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { calculateSpendBasedEmissions } from './spend-factors'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Core upsert-rule + reclassify operation for a single supplier contact.
 * Shared by the single-classification and batch-classification routes.
 */
async function applyOne(
  db: SupabaseClient,
  organizationId: string,
  contactName: string,
  emissionCategory: string
): Promise<{ ruleCreated: boolean; additionalClassified: number }> {
  if (!contactName || !emissionCategory) {
    return { ruleCreated: false, additionalClassified: 0 }
  }

  const { data: existingRules } = await db
    .from('xero_supplier_rules')
    .select('id, emission_category')
    .eq('organization_id', organizationId)
    .ilike('supplier_pattern', contactName)
    .limit(1)

  let ruleCreated = false

  if (existingRules && existingRules.length > 0) {
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

/**
 * Learn from a manual classification by creating or updating an
 * org-specific supplier rule. Also reclassifies other unclassified
 * transactions from the same contact.
 */
export async function learnFromManualClassification(
  organizationId: string,
  contactName: string,
  emissionCategory: string
): Promise<{ ruleCreated: boolean; additionalClassified: number }> {
  const db = getServiceClient()
  return applyOne(db, organizationId, contactName, emissionCategory)
}

/**
 * Batch variant: apply the same emissionCategory to multiple contact names
 * in one go. Used by the bulk-classify UI.
 */
export async function learnFromManualClassificationBatch(
  organizationId: string,
  contactNames: string[],
  emissionCategory: string
): Promise<{
  rulesCreated: number
  additionalClassified: number
  contacts: Array<{ contactName: string; ruleCreated: boolean; additionalClassified: number }>
}> {
  const db = getServiceClient()
  const unique = Array.from(new Set(contactNames.filter(Boolean)))

  const results = await Promise.all(
    unique.map(async contactName => {
      const r = await applyOne(db, organizationId, contactName, emissionCategory)
      return { contactName, ...r }
    })
  )

  return {
    rulesCreated: results.filter(r => r.ruleCreated).length,
    additionalClassified: results.reduce((sum, r) => sum + r.additionalClassified, 0),
    contacts: results,
  }
}
