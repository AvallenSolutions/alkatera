import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedClient } from './client'
import { updateSyncStatus } from './token-store'
import { classifyTransaction, type AccountMapping, type SupplierRule } from './classifier'
import { calculateSpendBasedEmissions } from './spend-factors'
import { extractFromDescription, hasExtractedData } from './description-extractor'
import { classifyWithAI } from './ai-classifier'

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

  // Create sync log
  await db
    .from('xero_sync_logs')
    .insert({
      organization_id: organizationId,
      sync_type: 'full',
      status: 'started',
      triggered_by: triggeredBy,
    })

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found. Please connect to Xero first.')

  const { client: xero, tenantId } = auth

  // Fetch chart of accounts
  const accountsResponse = await xero.accountingApi.getAccounts(tenantId)
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
    await db
      .from('xero_account_mappings')
      .upsert(accountRows, { onConflict: 'organization_id,xero_account_id', ignoreDuplicates: false })
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
    cursor: { page: 1 },
    progress: `Accounts synced (${expenseAccounts.length} expense accounts)`,
    stats: { accountsFetched: expenseAccounts.length },
  }
}

// ── Stage: Invoices (one page per call) ──────────────────────────────

async function stageInvoices(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string,
  cursor?: { page?: number }
): Promise<StageResult> {
  const page = cursor?.page || 1

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found.')

  const { client: xero, tenantId } = auth

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const invoicesResponse = await xero.accountingApi.getInvoices(
    tenantId,
    twelveMonthsAgo,
    'Type=="ACCPAY"',
    'Date DESC',
    undefined, undefined, undefined, undefined,
    page,
    undefined, undefined, undefined,
    true // summaryOnly
  )

  const invoices = invoicesResponse.body?.invoices || []
  let inserted = 0

  // Store raw transactions in a staging pattern (directly into xero_transactions with pending classification)
  const batchId = `sync_${Date.now()}`
  const rows = invoices
    .filter(inv => inv.invoiceID && !['DRAFT', 'DELETED', 'VOIDED'].includes(String(inv.status || '')))
    .map(inv => ({
      organization_id: organizationId,
      xero_transaction_id: inv.invoiceID!,
      xero_transaction_type: 'invoice',
      xero_contact_name: inv.contact?.name || null,
      xero_contact_id: inv.contact?.contactID || null,
      xero_account_id: null,
      xero_account_code: null,
      description: inv.reference || null,
      amount: inv.total || 0,
      currency: String(inv.currencyCode || 'GBP'),
      transaction_date: inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      reporting_year: inv.date ? new Date(inv.date).getFullYear() : new Date().getFullYear(),
      data_quality_tier: 4,
      upgrade_status: 'pending',
      sync_batch_id: batchId,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length > 0) {
    await db
      .from('xero_transactions')
      .upsert(rows, { onConflict: 'organization_id,xero_transaction_id' })
    inserted = rows.length
  }

  const hasMore = invoices.length >= 100 && page < 5

  return {
    done: false,
    nextStage: hasMore ? 'invoices' : 'bank_transactions',
    cursor: hasMore ? { page: page + 1 } : { page: 1 },
    progress: `Invoices page ${page}: ${inserted} imported${hasMore ? ', fetching more...' : ' (done)'}`,
    stats: { transactionsFetched: inserted },
  }
}

// ── Stage: Bank Transactions (one page per call) ─────────────────────

async function stageBankTransactions(
  db: ReturnType<typeof getServiceClient>,
  organizationId: string,
  cursor?: { page?: number }
): Promise<StageResult> {
  const page = cursor?.page || 1

  const auth = await getAuthenticatedClient(organizationId)
  if (!auth) throw new Error('No Xero connection found.')

  const { client: xero, tenantId } = auth

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const bankTxResponse = await xero.accountingApi.getBankTransactions(
    tenantId,
    twelveMonthsAgo,
    'Type=="SPEND"',
    'Date DESC',
    page
  )

  const bankTxs = bankTxResponse.body?.bankTransactions || []
  let inserted = 0

  const batchId = `sync_${Date.now()}`
  const rows = bankTxs
    .filter(tx => tx.bankTransactionID && String(tx.status || '') !== 'DELETED')
    .map(tx => {
      const lineItem = tx.lineItems?.[0]
      return {
        organization_id: organizationId,
        xero_transaction_id: tx.bankTransactionID!,
        xero_transaction_type: 'bank_transaction',
        xero_contact_name: tx.contact?.name || null,
        xero_contact_id: tx.contact?.contactID || null,
        xero_account_id: lineItem?.accountID || null,
        xero_account_code: lineItem?.accountCode || null,
        description: lineItem?.description || null,
        amount: tx.total || 0,
        currency: String(tx.currencyCode || 'GBP'),
        transaction_date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        reporting_year: tx.date ? new Date(tx.date).getFullYear() : new Date().getFullYear(),
        data_quality_tier: 4,
        upgrade_status: 'pending',
        sync_batch_id: batchId,
        updated_at: new Date().toISOString(),
      }
    })

  if (rows.length > 0) {
    await db
      .from('xero_transactions')
      .upsert(rows, { onConflict: 'organization_id,xero_transaction_id' })
    inserted = rows.length
  }

  const hasMore = bankTxs.length >= 100 && page < 5

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
    .select('id, xero_account_id, xero_contact_name, description, amount, emission_category')
    .eq('organization_id', organizationId)
    .is('emission_category', null)
    .limit(500)

  let classified = 0

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
        ? calculateSpendBasedEmissions(tx.amount, emissionCategory)
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

    // Batch update via individual calls (can't batch-update with different values easily)
    for (const update of updates) {
      const { id, ...fields } = update
      await db
        .from('xero_transactions')
        .update(fields)
        .eq('id', id)
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
    .select('id, xero_contact_name, description, amount')
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
      const spendBasedEmissions = calculateSpendBasedEmissions(
        unclassified.find(tx => tx.id === result.transactionId)?.amount || 0,
        result.suggestedCategory
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
