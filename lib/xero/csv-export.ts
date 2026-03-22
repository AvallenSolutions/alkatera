/**
 * Xero Transaction CSV Export
 *
 * Generates a CSV file of Xero transactions for download,
 * with all current filter/classification metadata included.
 */

// =============================================================================
// Types
// =============================================================================

export interface TransactionExportRow {
  date: string
  supplier: string
  description: string
  amount: number
  currency: string
  category: string
  source: string
  confidence: string
  tier: string
  status: string
}

// =============================================================================
// CSV Generation
// =============================================================================

const CSV_HEADERS = [
  'Date',
  'Supplier',
  'Description',
  'Amount',
  'Currency',
  'Category',
  'Classification Source',
  'Confidence',
  'Data Quality Tier',
  'Upgrade Status',
]

/**
 * Generate a CSV string from an array of transaction export rows.
 *
 * - Header row first
 * - CRLF line endings (RFC 4180)
 * - Fields with commas, quotes, or newlines are escaped
 */
export function generateTransactionCSV(rows: TransactionExportRow[]): string {
  const lines: string[] = []

  // Header row
  lines.push(CSV_HEADERS.join(','))

  // Data rows
  for (const row of rows) {
    const cells = [
      escapeCSV(row.date),
      escapeCSV(row.supplier),
      escapeCSV(row.description),
      escapeCSV(String(row.amount)),
      escapeCSV(row.currency),
      escapeCSV(row.category),
      escapeCSV(row.source),
      escapeCSV(row.confidence),
      escapeCSV(row.tier),
      escapeCSV(row.status),
    ]
    lines.push(cells.join(','))
  }

  // CRLF line endings per RFC 4180
  return lines.join('\r\n') + '\r\n'
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Escape a CSV field value per RFC 4180.
 * - If value contains comma, double-quote, or newline, wrap in double quotes
 * - Double any internal double-quotes
 */
export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
