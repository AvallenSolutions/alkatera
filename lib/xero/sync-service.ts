import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedClient } from './client'
import { updateSyncStatus } from './token-store'
import { classifyTransaction, type AccountMapping, type SupplierRule } from './classifier'
import { calculateSpendBasedEmissions } from './spend-factors'
import { extractFromDescription, hasExtractedData } from './description-extractor'
import { classifyWithAI } from './ai-classifier'

/**
 * Retry a Xero API call once on 429 (rate limit), respecting the Retry-After
 * header with a 60-second cap. Only retries once to avoid cascading delays.
 */
async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.statusCode === 429 || err?.response?.status === 429) {
      const retryAfter = Math.min(
        parseInt(err?.response?.headers?.['retry-after'] || '5', 10),
        60
      )
      console.warn(`Xero 429 rate limit hit, retrying after ${retryAfter}s`)
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return await fn()
    }
    throw err
  }
}

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

export interface StageResult {
  done: boolean
  nextStage?: string
  cursor?: any
  progress: string
  stats?: Partial<SyncResult>
  error?: string
}

/**
 * Execute a single sync stage. Each stage is designed to complete
 * within Netlify's ~10-26s serverless timeout.
 *
 * The client calls stages sequentially:
 *   accounts → invoices (page 1..N) → bank_transactions (page 1..N) → classify → complete
 */
export async function syncStage(
  organizationId: string,
  triggeredBy: string,
  stage: string,
  cursor?: any
): Promise<StageResult> {
  const db = getServiceClient()

  try {
    switch (stage) {
      case 'accounts':
        return await stageAccounts(db, organizationId, triggeredBy)
      case 'invoices':
        return await stageInvoices(db, organizationId, cursor)
      case 'bank_transactions':
        return await stageBankTransactions(db, organizationId, cursor)
      case 'classify':
        return await stageClassify(db, organizationId)
      case 'ai_classify':
        return await stageAIClassify(db, organizationId)
      case 'complete':
        return await stageComplete(db, organizationId)
      default:
        return { done: false, nextStage: 'accounts', progress: 'Starting...' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync stage failed'
    await updateSyncStatus(organizationId, 'error', message)
    return { done: true, progress: 'Failed', error: message }
  }
}

// ── Stage: Accounts ──────────────────────────────────────────────────

async function stageAccounts(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string,
  triggeredBy: string
): Promise<StageResult> {
  await updateSyncStatus(organizationId, 'syncing')

  // Determine if this is an incremental sync by finding last successful sync
  const { data: lastSync } = await db
    .from('xero_sync_logs')
    .select('completed_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  // Use last sync time as watermark, but never older than 12 months
  const syncSince = lastSync?.completed_at
    ? new Date(Math.max(new Date(lastSync.completed_at).getTime(), twelveMonthsAgo.getTime()))
    : twelveMonthsAgo

  const syncType = lastSync?.completed_at ? 'incremental' : 'full'

  // Create sync log
  await db
    .from('xero_sync_logs')
    .insert({
      organization_id: organizationId,
      sync_type: syncType,
      status: 'started',
      triggered_by: triggeredBy,
    })

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found. Please connect to Xero first.')

  const { client: xero, tenantId } = auth

  // Fetch chart of accounts
  const accountsResponse = await withRateLimit(() => xero.accountingApi.getAccounts(tenantId))
  const accounts = accountsResponse.body?.accounts || []
  const expenseAccounts = accounts.filter(a =>
    ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(String(a.type || ''))
  )

  // Batch upsert
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
    const { error } = await db
      .from('xero_account_mappings')
      .upsert(accountRows, { onConflict: 'organization_id,xero_account_id', ignoreDuplicates: false })
    if (error) throw new Error(`Failed to upsert account mappings: ${error.message}`)
  }

  // Clear any stale sync state (best effort)
  try {
    await db
      .from('xero_sync_staging')
      .delete()
      .eq('organization_id', organizationId)
  } catch {
    // Table may not exist - that's fine
  }

  return {
    done: false,
    nextStage: 'invoices',
    cursor: { page: 1, syncSince: syncSince.toISOString() },
    progress: `Accounts synced (${expenseAccounts.length} expense accounts, ${syncType} sync)`,
    stats: { accountsFetched: expenseAccounts.length },
  }
}

// ── Stage: Invoices (one page per call) ──────────────────────────────

async function stageInvoices(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string,
  cursor?: { page?: number; syncSince?: string }
): Promise<StageResult> {
  const page = cursor?.page || 1

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found.')

  const { client: xero, tenantId } = auth

  // Use watermark from accounts stage for incremental sync
  const syncSince = cursor?.syncSince ? new Date(cursor.syncSince) : (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d
  })()

  const invoicesResponse = await withRateLimit(() => xero.accountingApi.getInvoices(
    tenantId,
    syncSince,
    'Type=="ACCPAY"',
    'Date DESC',
    undefined, undefined, undefined, undefined,
    page
  ))

  const invoices = invoicesResponse.body?.invoices || []
  let inserted = 0

  // Store raw transactions in a staging pattern (directly into xero_transactions with pending classification)
  const batchId = crypto.randomUUID()
  // Split multi-line invoices into separate rows per line item so each
  // gets the correct account code for classification. Single-line invoices
  // use the invoice ID directly; multi-line ones get a suffix per line.
  const rows = invoices
    .filter(inv => inv.invoiceID && !['DRAFT', 'DELETED', 'VOIDED'].includes(String(inv.status || '')))
    .flatMap(inv => {
      const txDate = inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      const reportingYear = inv.date ? new Date(inv.date).getFullYear() : new Date().getFullYear()
      const baseCols = {
        organization_id: organizationId,
        xero_transaction_type: 'invoice' as const,
        xero_contact_name: inv.contact?.name || null,
        xero_contact_id: inv.contact?.contactID || null,
        currency: String(inv.currencyCode || 'GBP'),
        transaction_date: txDate,
        reporting_year: reportingYear,
        data_quality_tier: 4,
        upgrade_status: 'pending' as const,
        sync_batch_id: batchId,
        updated_at: new Date().toISOString(),
      }

      const lines = inv.lineItems?.filter(li => li.lineAmount && li.lineAmount !== 0) || []

      if (lines.length <= 1) {
        const li = lines[0]
        return [{
          ...baseCols,
          xero_transaction_id: inv.invoiceID!,
          xero_account_id: li?.accountID || null,
          xero_account_code: li?.accountCode || null,
          description: inv.reference || li?.description || null,
          amount: inv.total || 0,
        }]
      }

      return lines.map((li, idx) => ({
        ...baseCols,
        xero_transaction_id: `${inv.invoiceID!}_L${idx}`,
        xero_account_id: li.accountID || null,
        xero_account_code: li.accountCode || null,
        description: li.description || inv.reference || null,
        amount: li.lineAmount || 0,
      }))
    })

  if (rows.length > 0) {
    const { error } = await db
      .from('xero_transactions')
      .upsert(rows, { onConflict: 'organization_id,xero_transaction_id' })
    if (error) throw new Error(`Failed to upsert invoices: ${error.message}`)
    inserted = rows.length
  }

  const hasMore = invoices.length >= 100 && page < 50

  return {
    done: false,
    nextStage: hasMore ? 'invoices' : 'bank_transactions',
    cursor: hasMore
      ? { page: page + 1, syncSince: cursor?.syncSince }
      : { page: 1, syncSince: cursor?.syncSince },
    progress: `Invoices page ${page}: ${inserted} imported${hasMore ? ', fetching more...' : ' (done)'}`,
    stats: { transactionsFetched: inserted },
  }
}

// ── Stage: Bank Transactions (one page per call) ─────────────────────

async function stageBankTransactions(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string,
  cursor?: { page?: number; syncSince?: string }
): Promise<StageResult> {
  const page = cursor?.page || 1

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found.')

  const { client: xero, tenantId } = auth

  // Use watermark from accounts stage for incremental sync
  const syncSince = cursor?.syncSince ? new Date(cursor.syncSince) : (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d
  })()

  // Fetch ALL bank transactions (not just SPEND type) to capture bank feed
  // items, overpayments, and prepayments that represent actual spending
  const bankTxResponse = await withRateLimit(() => xero.accountingApi.getBankTransactions(
    tenantId,
    syncSince,
    undefined, // No type filter - get all types
    'Date DESC',
    page
  ))

  const bankTxs = bankTxResponse.body?.bankTransactions || []
  let inserted = 0

  // Filter to spend-related types only (exclude RECEIVE types)
  const spendTypes = ['SPEND', 'SPEND-OVERPAYMENT', 'SPEND-PREPAYMENT', 'SPEND-TRANSFER']
  const batchId = crypto.randomUUID()
  const rows = bankTxs
    .filter(tx => {
      if (!tx.bankTransactionID) return false
      if (String(tx.status || '') === 'DELETED') return false
      // Accept SPEND types, or any transaction with a positive total (money going out)
      const txType = String(tx.type || '')
      return spendTypes.includes(txType) || (tx.total && tx.total > 0 && !txType.startsWith('RECEIVE'))
    })
    .flatMap(tx => {
      const txDate = tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      const reportingYear = tx.date ? new Date(tx.date).getFullYear() : new Date().getFullYear()
      const baseCols = {
        organization_id: organizationId,
        xero_transaction_type: 'bank_transaction' as const,
        xero_contact_name: tx.contact?.name || null,
        xero_contact_id: tx.contact?.contactID || null,
        currency: String(tx.currencyCode || 'GBP'),
        transaction_date: txDate,
        reporting_year: reportingYear,
        data_quality_tier: 4,
        upgrade_status: 'pending' as const,
        sync_batch_id: batchId,
        updated_at: new Date().toISOString(),
      }

      const lines = tx.lineItems?.filter(li => li.lineAmount && li.lineAmount !== 0) || []

      if (lines.length <= 1) {
        const li = lines[0]
        return [{
          ...baseCols,
          xero_transaction_id: tx.bankTransactionID!,
          xero_account_id: li?.accountID || null,
          xero_account_code: li?.accountCode || null,
          description: li?.description || null,
          amount: tx.total || 0,
        }]
      }

      return lines.map((li, idx) => ({
        ...baseCols,
        xero_transaction_id: `${tx.bankTransactionID!}_L${idx}`,
        xero_account_id: li.accountID || null,
        xero_account_code: li.accountCode || null,
        description: li.description || null,
        amount: li.lineAmount || 0,
      }))
    })

  if (rows.length > 0) {
    const { error } = await db
      .from('xero_transactions')
      .upsert(rows, { onConflict: 'organization_id,xero_transaction_id' })
    if (error) throw new Error(`Failed to upsert bank transactions: ${error.message}`)
    inserted = rows.length
  }

  const hasMore = bankTxs.length >= 100 && page < 50

  return {
    done: false,
    nextStage: hasMore ? 'bank_transactions' : 'classify',
    cursor: hasMore ? { page: page + 1 } : undefined,
    progress: `Bank transactions page ${page}: ${inserted} imported${hasMore ? ', fetching more...' : ' (done)'}`,
    stats: { transactionsFetched: inserted },
  }
}

// ── Stage: Classify ──────────────────────────────────────────────────

async function stageClassify(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<StageResult> {
  // Load classification data
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

  // Fetch unclassified transactions
  const { data: unclassified } = await db
    .from('xero_transactions')
    .select('id, xero_account_id, xero_contact_name, description, amount, currency, emission_category')
    .eq('organization_id', organizationId)
    .is('emission_category', null)
    .limit(2000)

  let classified = 0

  if (unclassified && unclassified.length === 2000) {
    console.warn(
      `[Xero Sync] Classification query hit 2000-row limit for org ${organizationId}. ` +
      'Some transactions may remain unclassified. Consider running sync again.'
    )
  }

  if (unclassified && unclassified.length > 0) {
    const updates = unclassified.map(tx => {
      const classification = classifyTransaction(
        {
          xeroAccountId: tx.xero_account_id,
          contactName: tx.xero_contact_name,
          description: tx.description,
        },
        mappings,
        rules
      )

      const emissionCategory = classification?.category || null
      const spendBasedEmissions = emissionCategory
        ? calculateSpendBasedEmissions(tx.amount, emissionCategory, tx.currency || 'GBP')
        : null

      const extracted = extractFromDescription(tx.description, tx.xero_contact_name)
      const extractedMetadata = hasExtractedData(extracted) ? extracted : null

      if (classification) classified++

      return {
        id: tx.id,
        emission_category: emissionCategory,
        classification_source: classification?.source || null,
        classification_confidence: classification?.confidence || null,
        spend_based_emissions_kg: spendBasedEmissions,
        upgrade_status: emissionCategory ? 'pending' : 'not_applicable',
        extracted_metadata: extractedMetadata,
      }
    })

    // Batch update in parallel (each row has different values)
    const results = await Promise.all(
      updates.map(({ id, ...fields }) =>
        db.from('xero_transactions').update(fields).eq('id', id)
      )
    )
    const updateErrors = results.filter(r => r.error)
    if (updateErrors.length > 0) {
      console.error(`[Xero Sync] ${updateErrors.length} classification updates failed:`, updateErrors[0].error?.message)
    }
  }

  return {
    done: false,
    nextStage: 'ai_classify',
    progress: `Classified ${classified} of ${unclassified?.length || 0} transactions`,
    stats: { transactionsClassified: classified },
  }
}

// ── Stage: AI Classify ───────────────────────────────────────────────

async function stageAIClassify(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<StageResult> {
  // Fetch up to 50 unclassified transactions (those the rule-based classifier missed)
  const { data: unclassified } = await db
    .from('xero_transactions')
    .select('id, xero_contact_name, description, amount, currency')
    .eq('organization_id', organizationId)
    .is('emission_category', null)
    .eq('upgrade_status', 'not_applicable')
    .order('amount', { ascending: false })
    .limit(50)

  if (!unclassified || unclassified.length === 0) {
    return {
      done: false,
      nextStage: 'complete',
      progress: 'No unclassified transactions for AI',
    }
  }

  const aiResults = await classifyWithAI(
    unclassified.map(tx => ({
      id: tx.id,
      contactName: tx.xero_contact_name,
      description: tx.description,
      amount: tx.amount,
    }))
  )

  let autoClassified = 0
  let needsReview = 0

  for (const result of aiResults) {
    if (result.suggestedCategory && result.confidence >= 0.7) {
      // High confidence: auto-apply
      const matchedTx = unclassified.find(tx => tx.id === result.transactionId)
      const spendBasedEmissions = calculateSpendBasedEmissions(
        matchedTx?.amount || 0,
        result.suggestedCategory,
        matchedTx?.currency || 'GBP'
      )

      await db
        .from('xero_transactions')
        .update({
          emission_category: result.suggestedCategory,
          classification_source: 'ai',
          classification_confidence: result.confidence,
          upgrade_status: 'pending',
          spend_based_emissions_kg: spendBasedEmissions,
        })
        .eq('id', result.transactionId)

      autoClassified++
    } else if (result.suggestedCategory && result.confidence >= 0.3) {
      // Low confidence: store suggestion for manual review without applying
      // Keep upgrade_status as 'not_applicable' (valid CHECK value) - the AI
      // suggestion columns signal that review is needed
      await db
        .from('xero_transactions')
        .update({
          ai_suggested_category: result.suggestedCategory,
          ai_suggested_confidence: result.confidence,
          ai_suggested_reasoning: result.reasoning || null,
        })
        .eq('id', result.transactionId)

      needsReview++
    } else {
      needsReview++
    }
  }

  return {
    done: false,
    nextStage: 'complete',
    progress: `AI classified ${autoClassified} transactions (${needsReview} need review)`,
    stats: { transactionsClassified: autoClassified },
  }
}

// ── Stage: Complete ──────────────────────────────────────────────────

async function stageComplete(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<StageResult> {
  await updateSyncStatus(organizationId, 'idle')

  // Count totals for the log
  const { count: totalTx } = await db
    .from('xero_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  const { count: classifiedTx } = await db
    .from('xero_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .not('emission_category', 'is', null)

  // Update sync log
  await db
    .from('xero_sync_logs')
    .update({
      status: 'completed',
      transactions_fetched: totalTx || 0,
      transactions_classified: classifiedTx || 0,
      completed_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('status', 'started')
    .order('created_at', { ascending: false })
    .limit(1)

  return {
    done: true,
    progress: `Sync complete: ${totalTx || 0} transactions (${classifiedTx || 0} classified)`,
    stats: {
      transactionsFetched: totalTx || 0,
      transactionsClassified: classifiedTx || 0,
    },
  }
}

// Legacy export for backward compatibility (cron route)
export async function syncOrganisation(
  organizationId: string,
  triggeredBy: string
): Promise<SyncResult> {
  // Run all stages sequentially
  let stage = 'accounts'
  let cursor: any = undefined
  const result: SyncResult = {
    transactionsFetched: 0,
    transactionsClassified: 0,
    accountsFetched: 0,
    errors: [],
  }

  while (stage) {
    const stageResult = await syncStage(organizationId, triggeredBy, stage, cursor)

    if (stageResult.stats) {
      result.transactionsFetched += stageResult.stats.transactionsFetched || 0
      result.transactionsClassified += stageResult.stats.transactionsClassified || 0
      result.accountsFetched += stageResult.stats.accountsFetched || 0
    }
    if (stageResult.error) {
      result.errors.push(stageResult.error)
      break
    }

    stage = stageResult.done ? '' : (stageResult.nextStage || '')
    cursor = stageResult.cursor
  }

  return result
}
