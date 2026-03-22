import { SupabaseClient } from '@supabase/supabase-js'

export interface SupplierMatch {
  xeroContactId: string
  xeroContactName: string
  supplierId: string | null
  supplierName: string | null
  matchType: 'auto_exact' | 'auto_fuzzy' | 'manual' | 'unmatched' | 'ignored'
  matchConfidence: number
  totalSpend: number
  transactionCount: number
}

export interface UnmatchedContact {
  xeroContactId: string
  xeroContactName: string
  totalSpend: number
  transactionCount: number
  suggestedMatches: Array<{
    supplierId: string
    supplierName: string
    confidence: number
  }>
}

/**
 * Strip common business suffixes and normalise for matching.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|inc|incorporated|llc|llp|corp|corporation|co|company|group|holdings)\b/gi, '')
    .replace(/[&+]/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate token overlap score between two normalised names.
 * Returns 0-1 where 1 is perfect overlap.
 */
function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1))
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let overlap = 0
  tokensA.forEach(token => {
    if (tokensB.has(token)) overlap++
  })

  // Jaccard-style: overlap / union
  const union = new Set([...Array.from(tokensA), ...Array.from(tokensB)])
  return union.size > 0 ? overlap / union.size : 0
}

/**
 * Run supplier matching for all Xero contacts in an organisation.
 *
 * 1. Aggregates Xero contacts with spend totals
 * 2. Loads existing alkatera suppliers for the org
 * 3. Matches by exact normalised name (confidence 1.0)
 * 4. Falls back to token overlap (confidence 0.5-0.9)
 * 5. Upserts results into xero_supplier_links
 *
 * @returns Count of new matches found
 */
export async function findSupplierMatches(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ matched: number; unmatched: number }> {
  // 1. Aggregate Xero contacts
  const { data: txData } = await supabase
    .from('xero_transactions')
    .select('xero_contact_id, xero_contact_name, amount')
    .eq('organization_id', organizationId)
    .not('xero_contact_id', 'is', null)
    .not('xero_contact_name', 'is', null)

  if (!txData || txData.length === 0) return { matched: 0, unmatched: 0 }

  // Group by contact
  const contactMap = new Map<string, { name: string; spend: number; count: number }>()
  for (const tx of txData) {
    if (!tx.xero_contact_id || !tx.xero_contact_name) continue
    const existing = contactMap.get(tx.xero_contact_id) || {
      name: tx.xero_contact_name,
      spend: 0,
      count: 0,
    }
    existing.spend += Math.abs(tx.amount || 0)
    existing.count++
    contactMap.set(tx.xero_contact_id, existing)
  }

  // 2. Load existing suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', organizationId)

  const supplierList = suppliers || []
  const normalisedSuppliers = supplierList.map(s => ({
    id: s.id,
    name: s.name,
    normalised: normaliseName(s.name),
  }))

  // 3. Load existing links to avoid overwriting manual matches
  const { data: existingLinks } = await supabase
    .from('xero_supplier_links')
    .select('xero_contact_id, match_type')
    .eq('organization_id', organizationId)

  const existingManual = new Set(
    (existingLinks || [])
      .filter(l => l.match_type === 'manual' || l.match_type === 'ignored')
      .map(l => l.xero_contact_id)
  )

  // 4. Match each contact
  let matched = 0
  let unmatched = 0

  for (const [contactId, contact] of Array.from(contactMap.entries())) {
    // Skip contacts with manual/ignored links
    if (existingManual.has(contactId)) continue

    const normContact = normaliseName(contact.name)
    let bestMatch: { id: string; name: string; confidence: number } | null = null

    // Exact normalised match
    for (const supplier of normalisedSuppliers) {
      if (supplier.normalised === normContact) {
        bestMatch = { id: supplier.id, name: supplier.name, confidence: 1.0 }
        break
      }
    }

    // Fuzzy token overlap if no exact match
    if (!bestMatch) {
      for (const supplier of normalisedSuppliers) {
        const score = tokenOverlapScore(normContact, supplier.normalised)
        if (score >= 0.5 && (!bestMatch || score > bestMatch.confidence)) {
          bestMatch = { id: supplier.id, name: supplier.name, confidence: Math.min(score, 0.9) }
        }
      }
    }

    const matchType = bestMatch
      ? bestMatch.confidence >= 1.0
        ? 'auto_exact'
        : 'auto_fuzzy'
      : 'unmatched'

    // Auto-link only if confidence > 0.8
    const shouldAutoLink = bestMatch && bestMatch.confidence > 0.8

    await supabase
      .from('xero_supplier_links')
      .upsert(
        {
          organization_id: organizationId,
          xero_contact_id: contactId,
          xero_contact_name: contact.name,
          supplier_id: shouldAutoLink ? bestMatch!.id : null,
          match_type: shouldAutoLink ? matchType : 'unmatched',
          match_confidence: bestMatch?.confidence || 0,
          total_spend: contact.spend,
          transaction_count: contact.count,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,xero_contact_id' }
      )

    if (shouldAutoLink) {
      matched++
    } else {
      unmatched++
    }
  }

  return { matched, unmatched }
}

/**
 * Get unmatched Xero contacts with suggested supplier matches.
 */
export async function getUnmatchedContacts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<UnmatchedContact[]> {
  const { data: links } = await supabase
    .from('xero_supplier_links')
    .select('xero_contact_id, xero_contact_name, total_spend, transaction_count, match_confidence')
    .eq('organization_id', organizationId)
    .eq('match_type', 'unmatched')
    .order('total_spend', { ascending: false })

  if (!links || links.length === 0) return []

  // Get all suppliers for suggestions
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', organizationId)

  const supplierList = suppliers || []
  const normalisedSuppliers = supplierList.map(s => ({
    id: s.id,
    name: s.name,
    normalised: normaliseName(s.name),
  }))

  return links.map(link => {
    const normName = normaliseName(link.xero_contact_name)

    // Find top 3 suggestions
    const suggestions = normalisedSuppliers
      .map(s => ({
        supplierId: s.id,
        supplierName: s.name,
        confidence: tokenOverlapScore(normName, s.normalised),
      }))
      .filter(s => s.confidence > 0.2)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)

    return {
      xeroContactId: link.xero_contact_id,
      xeroContactName: link.xero_contact_name,
      totalSpend: link.total_spend,
      transactionCount: link.transaction_count,
      suggestedMatches: suggestions,
    }
  })
}

/**
 * Manually link a Xero contact to a supplier.
 */
export async function linkContactToSupplier(
  supabase: SupabaseClient,
  organizationId: string,
  xeroContactId: string,
  supplierId: string
): Promise<void> {
  await supabase
    .from('xero_supplier_links')
    .update({
      supplier_id: supplierId,
      match_type: 'manual',
      match_confidence: 1.0,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('xero_contact_id', xeroContactId)
}

/**
 * Mark a Xero contact as ignored (no supplier link needed).
 */
export async function ignoreContact(
  supabase: SupabaseClient,
  organizationId: string,
  xeroContactId: string
): Promise<void> {
  await supabase
    .from('xero_supplier_links')
    .update({
      match_type: 'ignored',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('xero_contact_id', xeroContactId)
}
