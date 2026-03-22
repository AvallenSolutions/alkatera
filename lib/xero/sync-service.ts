import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedClient } from './client'
import { updateSyncStatus } from './token-store'
import { classifyTransaction, type AccountMapping, type SupplierRule } from './classifier'
import { calculateSpendBasedEmissions } from './spend-factors'
import { extractFromDescription, hasExtractedData } from './description-extractor'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface SyncResult {
  transactionsFetched: number
  transactionsClassified: number
  accountsFetched: number
  errors: string[]
}

/**
 * Synchronise financial data from Xero for an organisation.
 *
 * 1. Fetches chart of accounts (expense accounts only)
 * 2. Fetches purchase invoices (ACCPAY) and bank transactions (SPEND)
 * 3. Classifies each transaction using account mappings + supplier rules
 * 4. Calculates spend-based emission baselines
 * 5. Upserts into xero_transactions
 */
export async function syncOrganisation(
  organizationId: string,
  triggeredBy: string
): Promise<SyncResult> {
  const db = getServiceClient()
  const result: SyncResult = {
    transactionsFetched: 0,
    transactionsClassified: 0,
    accountsFetched: 0,
    errors: [],
  }

  // Create sync log entry
  const { data: syncLog } = await db
    .from('xero_sync_logs')
    .insert({
      organization_id: organizationId,
      sync_type: 'full',
      status: 'started',
      triggered_by: triggeredBy,
    })
    .select('id')
    .single()

  const syncLogId = syncLog?.id

  try {
    await updateSyncStatus(organizationId, 'syncing')

    // Get authenticated Xero client
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) {
      throw new Error('No Xero connection found. Please connect to Xero first.')
    }

    const { client: xero, tenantId } = auth

    // ── 1. Fetch and store chart of accounts ──────────────────────────

    const accountsResponse = await xero.accountingApi.getAccounts(tenantId)
    const accounts = accountsResponse.body?.accounts || []

    // Filter to expense-type accounts
    const expenseAccounts = accounts.filter(a =>
      ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(String(a.type || ''))
    )

    result.accountsFetched = expenseAccounts.length

    // Batch upsert into xero_account_mappings
    const accountRows = expenseAccounts
      .filter(a => a.accountID)
      .map(account => ({
        organization_id: organizationId,
        xero_account_id: account.accountID!,
        xero_account_code: account.code || null,
        xero_account_name: account.name || 'Unknown',
        xero_account_type: String(account.type || '') || null,
        updated_at: new Date().toISOString(),
      }))

    if (accountRows.length > 0) {
      await db
        .from('xero_account_mappings')
        .upsert(accountRows, { onConflict: 'organization_id,xero_account_id', ignoreDuplicates: false })
    }

    // ── 2. Load classification data ───────────────────────────────────

    const { data: accountMappings } = await db
      .from('xero_account_mappings')
      .select('xero_account_id, emission_category, is_excluded')
      .eq('organization_id', organizationId)

    const { data: supplierRules } = await db
      .from('xero_supplier_rules')
      .select('supplier_pattern, emission_category, priority, organization_id')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order('priority', { ascending: false })

    const mappings: AccountMapping[] = accountMappings || []
    const rules: SupplierRule[] = supplierRules || []

    // ── 3. Fetch purchase invoices (ACCPAY) ───────────────────────────
    // Limit to last 12 months to stay within serverless timeout

    const transactions: Array<{
      xeroId: string
      type: string
      contactName: string | null
      contactId: string | null
      accountId: string | null
      accountCode: string | null
      description: string | null
      amount: number
      currency: string
      date: string
    }> = []

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

    let page = 1
    let hasMore = true
    const MAX_PAGES = 5 // Safety cap: 500 invoices max per sync

    while (hasMore && page <= MAX_PAGES) {
      try {
        const invoicesResponse = await xero.accountingApi.getInvoices(
          tenantId,
          twelveMonthsAgo, // ifModifiedSince - only recent invoices
          'Type=="ACCPAY"', // where - purchase invoices only
          'Date DESC', // order
          undefined, // IDs
          undefined, // invoiceNumbers
          undefined, // contactIDs
          undefined, // statuses
          page,
          undefined, // includeArchived
          undefined, // createdByMyApp
          undefined, // unitdp
          true // summaryOnly
        )

        const invoices = invoicesResponse.body?.invoices || []
        if (invoices.length === 0) {
          hasMore = false
          break
        }

        for (const inv of invoices) {
          if (!inv.invoiceID) continue
          // Skip draft invoices
          const invStatus = String(inv.status || '')
          if (invStatus === 'DRAFT' || invStatus === 'DELETED' || invStatus === 'VOIDED') continue

          transactions.push({
            xeroId: inv.invoiceID,
            type: 'invoice',
            contactName: inv.contact?.name || null,
            contactId: inv.contact?.contactID || null,
            accountId: null, // Invoices don't have a single account - handled via line items
            accountCode: null,
            description: inv.reference || null,
            amount: inv.total || 0,
            currency: String(inv.currencyCode || 'GBP'),
            date: inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          })
        }

        page++
        // Xero returns up to 100 per page
        if (invoices.length < 100) hasMore = false
      } catch (err) {
        result.errors.push(`Failed to fetch invoices page ${page}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        hasMore = false
      }
    }

    // ── 4. Fetch bank transactions (SPEND type) ──────────────────────

    page = 1
    hasMore = true

    while (hasMore && page <= MAX_PAGES) {
      try {
        const bankTxResponse = await xero.accountingApi.getBankTransactions(
          tenantId,
          twelveMonthsAgo, // ifModifiedSince - only recent transactions
          'Type=="SPEND"', // where
          'Date DESC', // order
          page
        )

        const bankTxs = bankTxResponse.body?.bankTransactions || []
        if (bankTxs.length === 0) {
          hasMore = false
          break
        }

        for (const tx of bankTxs) {
          if (!tx.bankTransactionID) continue
          if (String(tx.status || '') === 'DELETED') continue

          // Bank transactions have line items with account codes
          const lineItem = tx.lineItems?.[0]
          transactions.push({
            xeroId: tx.bankTransactionID,
            type: 'bank_transaction',
            contactName: tx.contact?.name || null,
            contactId: tx.contact?.contactID || null,
            accountId: lineItem?.accountID || null,
            accountCode: lineItem?.accountCode || null,
            description: lineItem?.description || null,
            amount: tx.total || 0,
            currency: String(tx.currencyCode || 'GBP'),
            date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          })
        }

        page++
        if (bankTxs.length < 100) hasMore = false
      } catch (err) {
        result.errors.push(`Failed to fetch bank transactions page ${page}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        hasMore = false
      }
    }

    result.transactionsFetched = transactions.length

    // ── 5. Classify and upsert transactions ──────────────────────────

    const batchId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Build all rows first, then batch upsert for performance
    const upsertRows = transactions.map(tx => {
      const classification = classifyTransaction(
        {
          xeroAccountId: tx.accountId,
          contactName: tx.contactName,
          description: tx.description,
        },
        mappings,
        rules
      )

      const emissionCategory = classification?.category || null
      const spendBasedEmissions = emissionCategory
        ? calculateSpendBasedEmissions(tx.amount, emissionCategory)
        : null

      // Auto-extract structured data from descriptions
      const extracted = extractFromDescription(tx.description, tx.contactName)
      const extractedMetadata = hasExtractedData(extracted) ? extracted : null

      if (classification) {
        result.transactionsClassified++
      }

      const reportingYear = new Date(tx.date).getFullYear()

      return {
        organization_id: organizationId,
        xero_transaction_id: tx.xeroId,
        xero_transaction_type: tx.type,
        xero_contact_name: tx.contactName,
        xero_contact_id: tx.contactId,
        xero_account_id: tx.accountId,
        xero_account_code: tx.accountCode,
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency,
        transaction_date: tx.date,
        emission_category: emissionCategory,
        classification_source: classification?.source || null,
        classification_confidence: classification?.confidence || null,
        spend_based_emissions_kg: spendBasedEmissions,
        data_quality_tier: 4,
        upgrade_status: emissionCategory ? 'pending' : 'not_applicable',
        extracted_metadata: extractedMetadata,
        sync_batch_id: batchId,
        reporting_year: reportingYear,
        updated_at: now,
      }
    })

    // Batch upsert in chunks of 200 to avoid payload limits
    const BATCH_SIZE = 200
    for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
      const chunk = upsertRows.slice(i, i + BATCH_SIZE)
      await db
        .from('xero_transactions')
        .upsert(chunk, { onConflict: 'organization_id,xero_transaction_id' })
    }

    // ── 6. Update sync status ─────────────────────────────────────────

    await updateSyncStatus(organizationId, 'idle')

    if (syncLogId) {
      await db
        .from('xero_sync_logs')
        .update({
          status: 'completed',
          transactions_fetched: result.transactionsFetched,
          transactions_classified: result.transactionsClassified,
          accounts_fetched: result.accountsFetched,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId)
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Sync failed'
    result.errors.push(errorMessage)

    await updateSyncStatus(organizationId, 'error', errorMessage)

    if (syncLogId) {
      await db
        .from('xero_sync_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          transactions_fetched: result.transactionsFetched,
          transactions_classified: result.transactionsClassified,
          accounts_fetched: result.accountsFetched,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId)
    }

    throw err
  }

  return result
}
