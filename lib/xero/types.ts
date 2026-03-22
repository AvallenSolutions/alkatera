/**
 * Shared types for Xero transaction data used across upgrade forms.
 *
 * These mirror the actual column names in the `xero_transactions` table
 * to prevent column-name drift between forms.
 */

export interface XeroTransactionRow {
  id: string
  xero_contact_name: string | null
  transaction_date: string
  amount: number
  description: string | null
  spend_based_emissions_kg: number | null
  extracted_metadata: Record<string, unknown> | null
}

/**
 * Client-side view of a Xero transaction used in upgrade form UIs.
 * Maps DB column names to friendlier property names.
 */
export interface XeroTransactionView {
  id: string
  supplierName: string | null
  date: string
  amount: number
  description: string | null
  extractedMetadata: Record<string, unknown> | null
}

/**
 * Convert a database row into the client-side view.
 */
export function toTransactionView(row: XeroTransactionRow): XeroTransactionView {
  return {
    id: row.id,
    supplierName: row.xero_contact_name,
    date: row.transaction_date,
    amount: Math.abs(row.amount || 0),
    description: row.description,
    extractedMetadata: row.extracted_metadata,
  }
}

/**
 * The columns we SELECT from xero_transactions in upgrade forms.
 */
export const XERO_TX_SELECT_COLUMNS =
  'id, xero_contact_name, transaction_date, amount, description, spend_based_emissions_kg, extracted_metadata' as const
