/**
 * Xero adapter for the SpendSource interface.
 *
 * Reads the `xero_transactions` table and exposes rows in the vendor-agnostic
 * SpendRow shape. Upgrade status (upgraded/dismissed) is passed through — the
 * resolver and hook decide what to do with those values.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SpendSource, SpendRow } from './types'

export const XeroSpendSource: SpendSource = {
  sourceKey: 'xero_transactions',
  displayName: 'Xero',

  async hasConnection(supabase, organizationId) {
    const { count } = await supabase
      .from('xero_connections')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
    return !!count && count > 0
  },

  async loadRows(supabase, organizationId, yearStart, yearEnd) {
    const { data } = await supabase
      .from('xero_transactions')
      .select(
        'id, xero_contact_name, description, amount, currency, emission_category, spend_based_emissions_kg, transaction_date, upgrade_status',
      )
      .eq('organization_id', organizationId)
      .not('emission_category', 'is', null)
      .gte('transaction_date', yearStart)
      .lte('transaction_date', yearEnd)

    return ((data || []) as Array<{
      id: string
      xero_contact_name: string | null
      description: string | null
      amount: number | null
      currency: string | null
      emission_category: string
      spend_based_emissions_kg: number | null
      transaction_date: string
      upgrade_status: string | null
    }>).map((r): SpendRow => ({
      id: r.id,
      transactionDate: r.transaction_date,
      amount: Math.abs(Number(r.amount) || 0),
      currency: r.currency || 'GBP',
      emissionCategory: r.emission_category,
      spendBasedEmissionsKg: Math.abs(Number(r.spend_based_emissions_kg) || 0),
      supplierName: r.xero_contact_name,
      description: r.description,
      upgradeStatus: r.upgrade_status,
    }))
  },
}
