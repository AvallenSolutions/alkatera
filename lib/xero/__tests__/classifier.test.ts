import { describe, it, expect } from 'vitest'
import {
  classifyTransaction,
  classifyTransactions,
} from '../classifier'
import type { AccountMapping, SupplierRule } from '../classifier'

const accountMappings: AccountMapping[] = [
  { xero_account_id: 'ACC-001', emission_category: 'grid_electricity', is_excluded: false },
  { xero_account_id: 'ACC-002', emission_category: null, is_excluded: false },
  { xero_account_id: 'ACC-003', emission_category: 'air_travel', is_excluded: true },
]

const supplierRules: SupplierRule[] = [
  { supplier_pattern: '%british gas%', emission_category: 'natural_gas', priority: 10, organization_id: null },
  { supplier_pattern: '%edf energy%', emission_category: 'grid_electricity', priority: 10, organization_id: null },
  { supplier_pattern: '%british gas%', emission_category: 'grid_electricity', priority: 20, organization_id: 'org-001' },
  { supplier_pattern: '%dhl%', emission_category: 'courier', priority: 5, organization_id: null },
]

describe('classifyTransaction', () => {
  describe('account mapping', () => {
    it('returns account_mapping result with confidence 0.75 when account matches', () => {
      const result = classifyTransaction(
        { xeroAccountId: 'ACC-001' },
        accountMappings,
        supplierRules
      )
      expect(result).toEqual({
        category: 'grid_electricity',
        source: 'account_mapping',
        confidence: 0.75,
      })
    })

    it('returns null when account mapping is excluded', () => {
      const result = classifyTransaction(
        { xeroAccountId: 'ACC-003' },
        accountMappings,
        supplierRules
      )
      expect(result).toBeNull()
    })

    it('falls through to supplier rules when account mapping has null category', () => {
      const result = classifyTransaction(
        { xeroAccountId: 'ACC-002', contactName: 'British Gas' },
        accountMappings,
        supplierRules
      )
      // Should match supplier rule for British Gas
      expect(result).not.toBeNull()
      expect(result!.source).toBe('supplier_rule')
    })
  })

  describe('supplier rules', () => {
    it('returns supplier_rule result with confidence 0.80', () => {
      const result = classifyTransaction(
        { contactName: 'EDF Energy' },
        [],
        supplierRules
      )
      expect(result).toEqual({
        category: 'grid_electricity',
        source: 'supplier_rule',
        confidence: 0.80,
      })
    })

    it('org-specific rules take precedence over system defaults', () => {
      // Org-specific rule maps British Gas to grid_electricity (priority 20)
      // System default maps British Gas to natural_gas (priority 10)
      const result = classifyTransaction(
        { contactName: 'British Gas' },
        [],
        supplierRules
      )
      expect(result!.category).toBe('grid_electricity')
    })

    it('higher priority rules are tried first within same scope', () => {
      // Two system rules, higher priority should win
      const rules: SupplierRule[] = [
        { supplier_pattern: '%test%', emission_category: 'water', priority: 5, organization_id: null },
        { supplier_pattern: '%test%', emission_category: 'waste', priority: 10, organization_id: null },
      ]
      const result = classifyTransaction(
        { contactName: 'Test Supplier' },
        [],
        rules
      )
      expect(result!.category).toBe('waste')
    })

    it('strips SQL wildcards from patterns before matching', () => {
      const result = classifyTransaction(
        { contactName: 'DHL Express' },
        [],
        supplierRules
      )
      expect(result!.category).toBe('courier')
    })

    it('matching is case-insensitive', () => {
      const result = classifyTransaction(
        { contactName: 'BRITISH GAS' },
        [],
        supplierRules
      )
      expect(result).not.toBeNull()
    })

    it('partial match works', () => {
      const result = classifyTransaction(
        { contactName: 'British Gas Business Energy Ltd' },
        [],
        supplierRules
      )
      expect(result).not.toBeNull()
      expect(result!.source).toBe('supplier_rule')
    })
  })

  describe('no match', () => {
    it('returns null when nothing matches', () => {
      const result = classifyTransaction(
        { contactName: 'Random Unknown Supplier' },
        [],
        supplierRules
      )
      expect(result).toBeNull()
    })

    it('returns null when no account ID and no contact name', () => {
      const result = classifyTransaction(
        {},
        accountMappings,
        supplierRules
      )
      expect(result).toBeNull()
    })

    it('returns null with empty mappings and rules', () => {
      const result = classifyTransaction(
        { xeroAccountId: 'ACC-001', contactName: 'British Gas' },
        [],
        []
      )
      expect(result).toBeNull()
    })
  })
})

describe('classifyTransactions', () => {
  it('batch-classifies multiple transactions', () => {
    const transactions = [
      { xeroAccountId: 'ACC-001' },
      { contactName: 'DHL Express' },
    ]
    const results = classifyTransactions(transactions, accountMappings, supplierRules)
    expect(results.size).toBe(2)
    expect(results.get(0)!.category).toBe('grid_electricity')
    expect(results.get(1)!.category).toBe('courier')
  })

  it('returns null for unclassified transactions in batch', () => {
    const transactions = [
      { contactName: 'Unknown Corp' },
      { xeroAccountId: 'ACC-001' },
    ]
    const results = classifyTransactions(transactions, accountMappings, supplierRules)
    expect(results.get(0)).toBeNull()
    expect(results.get(1)).not.toBeNull()
  })

  it('returns empty Map for empty transactions array', () => {
    const results = classifyTransactions([], accountMappings, supplierRules)
    expect(results.size).toBe(0)
  })
})
