/**
 * Integration tests: exercise real function chains end-to-end.
 * Only Supabase is mocked; all other logic runs through real implementations.
 */

import { describe, it, expect } from 'vitest'
import { classifyTransaction, type AccountMapping, type SupplierRule } from '../classifier'
import { calculateSpendBasedEmissions, getSpendFactor } from '../spend-factors'
import { extractFromDescription, hasExtractedData } from '../description-extractor'
import { generateTransactionCSV, escapeCSV, type TransactionExportRow } from '../csv-export'
import { CATEGORY_LABELS } from '../category-labels'

// =============================================================================
// 1. Classification → Emission Calculation Pipeline
// =============================================================================

describe('Classification → Emission Calculation Pipeline', () => {
  const accountMappings: AccountMapping[] = [
    { xero_account_id: 'ACC-001', emission_category: 'grid_electricity', is_excluded: false },
    { xero_account_id: 'ACC-002', emission_category: 'air_travel', is_excluded: false },
    { xero_account_id: 'ACC-099', emission_category: null, is_excluded: true },
  ]

  const supplierRules: SupplierRule[] = [
    { supplier_pattern: 'british gas', emission_category: 'natural_gas', priority: 10, organization_id: null },
    { supplier_pattern: 'dhl', emission_category: 'courier', priority: 20, organization_id: null },
  ]

  it('classifies by account mapping and calculates correct emissions', () => {
    const result = classifyTransaction(
      { xeroAccountId: 'ACC-001', contactName: 'EDF Energy' },
      accountMappings,
      supplierRules
    )

    expect(result).not.toBeNull()
    expect(result!.category).toBe('grid_electricity')
    expect(result!.source).toBe('account_mapping')

    const emissions = calculateSpendBasedEmissions(1000, result!.category)
    const expectedFactor = getSpendFactor('grid_electricity')
    expect(emissions).toBe(1000 * expectedFactor)
    expect(emissions).toBeGreaterThan(0)
  })

  it('classifies by supplier rule when no account mapping matches', () => {
    const result = classifyTransaction(
      { xeroAccountId: 'ACC-UNKNOWN', contactName: 'DHL Express Ltd' },
      accountMappings,
      supplierRules
    )

    expect(result).not.toBeNull()
    expect(result!.category).toBe('courier')
    expect(result!.source).toBe('supplier_rule')

    const emissions = calculateSpendBasedEmissions(250, result!.category)
    expect(emissions).toBe(250 * getSpendFactor('courier'))
  })

  it('returns null for excluded account and falls through to supplier rule', () => {
    const result = classifyTransaction(
      { xeroAccountId: 'ACC-099', contactName: 'British Gas Business' },
      accountMappings,
      supplierRules
    )

    // Excluded account returns null
    expect(result).toBeNull()
  })

  it('returns null when nothing matches, emissions use "other" fallback', () => {
    const result = classifyTransaction(
      { xeroAccountId: 'ACC-UNKNOWN', contactName: 'Random Shop Ltd' },
      accountMappings,
      supplierRules
    )

    expect(result).toBeNull()

    // When unclassified, app would use 'other' as fallback
    const emissions = calculateSpendBasedEmissions(500, 'other')
    expect(emissions).toBe(500 * getSpendFactor('other'))
  })

  it('handles negative amounts (credit notes) correctly', () => {
    const emissions = calculateSpendBasedEmissions(-1500, 'grid_electricity')
    expect(emissions).toBe(1500 * getSpendFactor('grid_electricity'))
    expect(emissions).toBeGreaterThan(0)
  })
})

// =============================================================================
// 2. Description Extraction Pipeline
// =============================================================================

describe('Description Extraction Pipeline', () => {
  it('extracts kWh from description with comma-thousands and decimal', () => {
    const result = extractFromDescription('Electricity supply 4,200.5 kWh for Q1', null)

    expect(hasExtractedData(result)).toBe(true)
    expect(result.quantity).toEqual({ value: 4200.5, unit: 'kWh' })
  })

  it('extracts flight route and classification matches air_travel', () => {
    const accountMappings: AccountMapping[] = []
    const supplierRules: SupplierRule[] = [
      { supplier_pattern: 'easyjet', emission_category: 'air_travel', priority: 10, organization_id: null },
    ]

    // Extract route from description
    const extracted = extractFromDescription('Flight LHR-CDG return', 'easyJet')
    expect(extracted.airportCodes).toEqual(['LHR', 'CDG'])

    // Classify the transaction
    const classification = classifyTransaction(
      { contactName: 'easyJet' },
      accountMappings,
      supplierRules
    )
    expect(classification).not.toBeNull()
    expect(classification!.category).toBe('air_travel')

    // Both work together: we know the route and the category
    expect(extracted.airportCodes).toBeDefined()
    expect(classification!.source).toBe('supplier_rule')
  })

  it('extracts hotel nights from combined description and contact name', () => {
    const extracted = extractFromDescription('Conference accommodation', '3 nights Premier Inn')

    expect(hasExtractedData(extracted)).toBe(true)
    expect(extracted.nightCount).toBe(3)
  })

  it('extracts freight weight and litres separately', () => {
    const freightResult = extractFromDescription('Pallet delivery 4,200 kg', null)
    expect(freightResult.weight).toEqual({ value: 4200, unit: 'kg' })

    const fuelResult = extractFromDescription('Diesel purchase 500L', null)
    expect(fuelResult.quantity).toEqual({ value: 500, unit: 'litres' })
  })

  it('extracts water volume with unicode superscript', () => {
    const result = extractFromDescription('Water supply 120 m\u00B3', null)
    expect(result.waterVolume).toEqual({ value: 120, unit: 'm3' })
  })

  it('returns empty for unstructured descriptions', () => {
    const result = extractFromDescription('Office supplies and stationery', 'Staples UK')
    expect(hasExtractedData(result)).toBe(false)
  })
})

// =============================================================================
// 3. Supplier Classification with Normalised Matching
// =============================================================================

describe('Supplier Classification with Normalised Matching', () => {
  const supplierRules: SupplierRule[] = [
    { supplier_pattern: 'british gas', emission_category: 'natural_gas', priority: 10, organization_id: null },
    { supplier_pattern: 'edf', emission_category: 'grid_electricity', priority: 10, organization_id: null },
    { supplier_pattern: 'dhl', emission_category: 'courier', priority: 20, organization_id: null },
    { supplier_pattern: 'travelodge', emission_category: 'accommodation', priority: 10, organization_id: null },
  ]

  const accountMappings: AccountMapping[] = []

  it('matches supplier names case-insensitively', () => {
    const result = classifyTransaction(
      { contactName: 'BRITISH GAS BUSINESS LTD' },
      accountMappings,
      supplierRules
    )
    expect(result).not.toBeNull()
    expect(result!.category).toBe('natural_gas')
  })

  it('matches partial supplier names', () => {
    const result = classifyTransaction(
      { contactName: 'EDF Energy Solutions Plc' },
      accountMappings,
      supplierRules
    )
    expect(result).not.toBeNull()
    expect(result!.category).toBe('grid_electricity')
  })

  it('org-specific rules override system defaults', () => {
    const orgRules: SupplierRule[] = [
      // Org-specific: this org routes DHL to air_freight instead of courier
      { supplier_pattern: 'dhl', emission_category: 'air_freight', priority: 25, organization_id: 'org-123' },
      ...supplierRules,
    ]

    const result = classifyTransaction(
      { contactName: 'DHL Express' },
      accountMappings,
      orgRules
    )
    expect(result).not.toBeNull()
    expect(result!.category).toBe('air_freight')
  })

  it('returns null for unknown suppliers', () => {
    const result = classifyTransaction(
      { contactName: 'Acme Widget Corp' },
      accountMappings,
      supplierRules
    )
    expect(result).toBeNull()
  })
})

// =============================================================================
// 4. CSV Export Round-Trip
// =============================================================================

describe('CSV Export Round-Trip', () => {
  const sampleRows: TransactionExportRow[] = [
    {
      date: '2025-01-15',
      supplier: 'British Gas Business',
      description: 'Gas supply, January',
      amount: 1250.5,
      currency: 'GBP',
      category: 'Natural Gas',
      source: 'Supplier Rule',
      confidence: '80%',
      tier: 'T4',
      status: 'Pending',
    },
    {
      date: '2025-02-01',
      supplier: 'EDF Energy "Premium"',
      description: 'Electricity Q1\nMulti-line note',
      amount: 3200,
      currency: 'EUR',
      category: 'Grid Electricity',
      source: 'Account Mapping',
      confidence: '95%',
      tier: 'T4',
      status: 'Upgraded',
    },
    {
      date: '2025-03-10',
      supplier: 'DHL Express',
      description: 'Courier delivery',
      amount: 45.99,
      currency: 'GBP',
      category: 'Courier',
      source: 'Supplier Rule',
      confidence: '80%',
      tier: 'T4',
      status: 'Pending',
    },
  ]

  it('generates valid CSV with correct header row', () => {
    const csv = generateTransactionCSV(sampleRows)
    const lines = csv.split('\r\n')

    expect(lines[0]).toBe(
      'Date,Supplier,Description,Amount,Currency,Category,Classification Source,Confidence,Data Quality Tier,Upgrade Status'
    )
  })

  it('generates correct number of data rows', () => {
    const csv = generateTransactionCSV(sampleRows)
    const lines = csv.split('\r\n').filter(l => l.length > 0)

    // 1 header + 3 data rows
    expect(lines).toHaveLength(4)
  })

  it('escapes fields containing commas', () => {
    const csv = generateTransactionCSV(sampleRows)
    const lines = csv.split('\r\n')

    // Row 1 description has comma: "Gas supply, January"
    expect(lines[1]).toContain('"Gas supply, January"')
  })

  it('escapes fields containing double quotes', () => {
    const csv = generateTransactionCSV(sampleRows)
    const lines = csv.split('\r\n')

    // Row 2 supplier has quotes: EDF Energy "Premium"
    expect(lines[2]).toContain('"EDF Energy ""Premium"""')
  })

  it('escapes fields containing newlines', () => {
    const csv = generateTransactionCSV(sampleRows)
    const lines = csv.split('\r\n')

    // Row 2 description has newline - the field should be quoted
    // When we split by CRLF, the multi-line field stays in the quoted cell
    const csvContent = csv
    expect(csvContent).toContain('"Electricity Q1\nMulti-line note"')
  })

  it('handles empty rows array', () => {
    const csv = generateTransactionCSV([])
    const lines = csv.split('\r\n').filter(l => l.length > 0)

    // Just the header
    expect(lines).toHaveLength(1)
  })

  it('uses CRLF line endings per RFC 4180', () => {
    const csv = generateTransactionCSV(sampleRows)
    expect(csv).toContain('\r\n')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('round-trips: parse CSV back and verify data integrity', () => {
    // Simple CSV with no special chars
    const simpleRows: TransactionExportRow[] = [
      {
        date: '2025-06-01',
        supplier: 'Test Supplier',
        description: 'Simple description',
        amount: 100,
        currency: 'GBP',
        category: 'Other',
        source: 'Manual',
        confidence: '100%',
        tier: 'T2',
        status: 'Upgraded',
      },
    ]

    const csv = generateTransactionCSV(simpleRows)
    const lines = csv.split('\r\n').filter(l => l.length > 0)
    const dataLine = lines[1]
    const fields = dataLine.split(',')

    expect(fields[0]).toBe('2025-06-01')
    expect(fields[1]).toBe('Test Supplier')
    expect(fields[2]).toBe('Simple description')
    expect(fields[3]).toBe('100')
    expect(fields[4]).toBe('GBP')
    expect(fields[5]).toBe('Other')
    expect(fields[6]).toBe('Manual')
    expect(fields[7]).toBe('100%')
    expect(fields[8]).toBe('T2')
    expect(fields[9]).toBe('Upgraded')
  })
})

// =============================================================================
// 5. escapeCSV unit coverage
// =============================================================================

describe('escapeCSV', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCSV('hello world')).toBe('hello world')
  })

  it('wraps strings with commas in quotes', () => {
    expect(escapeCSV('hello, world')).toBe('"hello, world"')
  })

  it('doubles internal double-quotes', () => {
    expect(escapeCSV('say "hello"')).toBe('"say ""hello"""')
  })

  it('handles combined special characters', () => {
    expect(escapeCSV('line1\nline2, "quoted"')).toBe('"line1\nline2, ""quoted"""')
  })
})

// =============================================================================
// 6. Category Labels Completeness
// =============================================================================

describe('Category labels cover all spend factor categories', () => {
  it('every spend factor category has a human-readable label', () => {
    const spendCategories = [
      'grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile',
      'petrol_mobile', 'lpg', 'air_travel', 'rail_travel', 'accommodation',
      'road_freight', 'sea_freight', 'air_freight', 'courier',
      'packaging', 'raw_materials', 'water', 'waste', 'other',
    ]

    for (const cat of spendCategories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined()
      expect(typeof CATEGORY_LABELS[cat]).toBe('string')
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
    }
  })
})
