/**
 * Accounting / spend-source abstraction.
 *
 * Each supported accounting system (Xero today, QuickBooks / Sage next) plugs
 * into the emissions pipeline by implementing this interface. The coverage
 * resolver treats all sources uniformly as spend-based — they slot in with
 * the same priority below utility bills, corporate overheads and product LCAs.
 *
 * The adapter lives next to the integration code (e.g. `lib/xero/`), but
 * exposes this shared shape so the resolver, hooks and trace endpoint do not
 * need to know about vendor-specific tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmissionSource } from '../types'

export interface SpendRow {
  /** Row id in the underlying source table, used as the EmissionRow sourceRowId. */
  id: string
  /** ISO date string — YYYY-MM-DD. */
  transactionDate: string
  /** Absolute invoice/line amount in the source currency. */
  amount: number
  currency: string
  /** alkatera emission category key (e.g. 'raw_materials', 'grid_electricity'). */
  emissionCategory: string
  /** Pre-computed spend-based emission in kg CO2e (already multiplied by EEIO factor). */
  spendBasedEmissionsKg: number
  /** Optional display strings — ignored by the resolver. */
  supplierName: string | null
  description: string | null
  /** User-driven upgrade state: 'upgraded' | 'dismissed' | null. Upgraded rows never contribute. */
  upgradeStatus: string | null
}

export interface SpendSource {
  /**
   * Unique identifier. Must match an `EmissionSource` value so the resolver can
   * attribute rows back to the correct vendor. Currently only 'xero_transactions'
   * is wired up — QuickBooks/Sage add their own values when they ship.
   */
  readonly sourceKey: EmissionSource

  /** Human-readable name, for UI + trace output. */
  readonly displayName: string

  /** True if this organisation has the integration connected. */
  hasConnection(supabase: SupabaseClient, organizationId: string): Promise<boolean>

  /** Load all candidate rows in the given date window. */
  loadRows(
    supabase: SupabaseClient,
    organizationId: string,
    yearStart: string,
    yearEnd: string,
  ): Promise<SpendRow[]>
}
