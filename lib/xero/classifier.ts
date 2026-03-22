/**
 * Transaction classification engine.
 *
 * Classifies Xero transactions into emission categories using:
 * 1. Account code mappings (user-configured, highest priority)
 * 2. Supplier name pattern matching (system + org-specific rules)
 * 3. Falls back to 'other' if no match found
 */

export interface ClassificationResult {
  category: string
  source: 'account_mapping' | 'supplier_rule' | 'manual' | 'ai'
  confidence: number
}

export interface AccountMapping {
  xero_account_id: string
  emission_category: string | null
  is_excluded: boolean
}

export interface SupplierRule {
  supplier_pattern: string
  emission_category: string
  priority: number
  organization_id: string | null
}

interface TransactionInput {
  xeroAccountId?: string | null
  contactName?: string | null
  description?: string | null
}

/**
 * Classify a single transaction into an emission category.
 *
 * Priority order:
 * 1. Account mapping (user-configured, most reliable)
 * 2. Supplier rule match (pattern-based)
 * 3. Fallback to null (unclassified)
 */
export function classifyTransaction(
  tx: TransactionInput,
  accountMappings: AccountMapping[],
  supplierRules: SupplierRule[]
): ClassificationResult | null {
  // 1. Try account mapping first (highest confidence)
  if (tx.xeroAccountId) {
    const mapping = accountMappings.find(m => m.xero_account_id === tx.xeroAccountId)
    if (mapping) {
      if (mapping.is_excluded) {
        return null // User explicitly excluded this account
      }
      if (mapping.emission_category) {
        return {
          category: mapping.emission_category,
          source: 'account_mapping',
          confidence: 0.95,
        }
      }
    }
  }

  // 2. Try supplier name pattern matching
  if (tx.contactName) {
    const contactLower = tx.contactName.toLowerCase()

    // Sort rules: org-specific first (higher priority), then by priority descending
    const sortedRules = [...supplierRules].sort((a, b) => {
      // Org-specific rules take precedence over system defaults
      if (a.organization_id && !b.organization_id) return -1
      if (!a.organization_id && b.organization_id) return 1
      return b.priority - a.priority
    })

    for (const rule of sortedRules) {
      // Convert SQL ILIKE pattern to simple matching
      const pattern = rule.supplier_pattern
        .toLowerCase()
        .replace(/%/g, '') // Remove SQL wildcards
        .trim()

      if (contactLower.includes(pattern)) {
        return {
          category: rule.emission_category,
          source: 'supplier_rule',
          confidence: 0.80,
        }
      }
    }
  }

  // 3. No classification found
  return null
}

/**
 * Batch-classify multiple transactions.
 */
export function classifyTransactions(
  transactions: TransactionInput[],
  accountMappings: AccountMapping[],
  supplierRules: SupplierRule[]
): Map<number, ClassificationResult | null> {
  const results = new Map<number, ClassificationResult | null>()

  for (let i = 0; i < transactions.length; i++) {
    results.set(i, classifyTransaction(transactions[i], accountMappings, supplierRules))
  }

  return results
}
