'use client'

/**
 * The per-transaction AI confirm flow, folded in beneath the supplier
 * queue as one quiet sub-section rather than a separate Sparkles card.
 * Same one "Suggest with AI" story as the queue above; behaviour
 * (classify, confirm, dismiss, learn-rule) is unchanged.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS } from '@/lib/xero/category-labels'
import { classifyTransactionsChunked } from '@/lib/xero/classify-ai-client'
import { Eyebrow } from '@/components/studio/eyebrow'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import type { WorkingTone } from '@/components/studio/theme'

interface UnclassifiedTransaction {
  id: string
  contactName: string | null
  description: string | null
  amount: number
  date: string
  currency: string
}

interface AISuggestion {
  transactionId: string
  suggestedCategory: string | null
  confidence: number
  reasoning: string
}

function confidenceTone(confidence: number): WorkingTone {
  if (confidence >= 0.8) return 'good'
  if (confidence >= 0.5) return 'attention'
  return 'stale'
}

export function AIClassificationPanel() {
  const { currentOrganization } = useOrganization()
  const [unclassified, setUnclassified] = useState<UnclassifiedTransaction[]>([])
  const [suggestions, setSuggestions] = useState<Map<string, AISuggestion>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isClassifying, setIsClassifying] = useState(false)
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Fetch both fully unclassified and needs_review transactions
    const { data } = await supabase
      .from('xero_transactions')
      .select('id, xero_contact_name, description, amount, transaction_date, currency, upgrade_status, ai_suggested_category, ai_suggested_confidence, ai_suggested_reasoning')
      .eq('organization_id', currentOrganization.id)
      .is('emission_category', null)
      .in('upgrade_status', ['not_applicable', 'needs_review'])
      .order('amount', { ascending: false })
      .limit(50)

    if (data) {
      setUnclassified(data.map(t => ({
        id: t.id,
        contactName: t.xero_contact_name,
        description: t.description,
        amount: Math.abs(t.amount || 0),
        date: t.transaction_date,
        currency: t.currency || 'GBP',
      })))

      // Pre-populate suggestions from stored AI results (needs_review items)
      const storedSuggestions = new Map<string, AISuggestion>()
      for (const t of data) {
        if (t.ai_suggested_category) {
          storedSuggestions.set(t.id, {
            transactionId: t.id,
            suggestedCategory: t.ai_suggested_category,
            confidence: t.ai_suggested_confidence || 0,
            reasoning: t.ai_suggested_reasoning || 'Suggested during sync',
          })
        }
      }
      if (storedSuggestions.size > 0) {
        setSuggestions(storedSuggestions)
      }
    }

    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleClassify() {
    if (!currentOrganization?.id || unclassified.length === 0) return

    setIsClassifying(true)
    try {
      const { results } = await classifyTransactionsChunked({
        organizationId: currentOrganization.id,
        transactions: unclassified.map(t => ({
          id: t.id,
          contactName: t.contactName,
          description: t.description,
          amount: t.amount,
        })),
      }) as { results: AISuggestion[] }
      const newSuggestions = new Map<string, AISuggestion>()
      for (const r of results) {
        if (r.suggestedCategory) {
          newSuggestions.set(r.transactionId, r)
        }
      }
      setSuggestions(newSuggestions)

      const classified = results.filter(r => r.suggestedCategory).length
      toast.success(`AI classified ${classified} of ${unclassified.length} transactions`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Classification failed'
      toast.error(message)
    } finally {
      setIsClassifying(false)
    }
  }

  async function handleConfirm(txId: string) {
    const suggestion = suggestions.get(txId)
    if (!suggestion?.suggestedCategory || !currentOrganization?.id) return

    try {
      const { error } = await supabase
        .from('xero_transactions')
        .update({
          emission_category: suggestion.suggestedCategory,
          classification_source: 'ai',
          classification_confidence: suggestion.confidence,
          upgrade_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', txId)

      if (error) throw error

      setConfirmedIds(prev => {
        const next = new Set(prev)
        next.add(txId)
        return next
      })

      // Learn from this confirmation: create a supplier rule for future syncs
      const tx = unclassified.find(t => t.id === txId)
      if (tx?.contactName) {
        fetch('/api/xero/learn-rule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            contactName: tx.contactName,
            emissionCategory: suggestion.suggestedCategory,
          }),
        }).then(res => {
          if (res.ok) return res.json()
        }).then(data => {
          if (data?.additionalClassified > 0) {
            toast.success(`Rule saved. ${data.additionalClassified} more transaction${data.additionalClassified !== 1 ? 's' : ''} from ${tx.contactName} also classified.`)
          }
        }).catch(() => {
          // Non-critical - rule creation failure shouldn't block the confirmation
        })
      }

      toast.success('Classification confirmed')
    } catch {
      toast.error('Failed to confirm classification')
    }
  }

  const visibleTransactions = unclassified.filter(
    t => !confirmedIds.has(t.id) && !dismissedIds.has(t.id)
  )

  // Group visible transactions by supplier where AI suggestions agree
  interface SupplierGroup {
    contactName: string
    category: string
    confidence: number
    reasoning: string
    transactions: UnclassifiedTransaction[]
    totalAmount: number
  }

  const supplierGroups: SupplierGroup[] = []
  const ungroupedTransactions: UnclassifiedTransaction[] = []

  const bySupplier = new Map<string, UnclassifiedTransaction[]>()
  for (const tx of visibleTransactions) {
    if (!suggestions.has(tx.id)) continue
    const name = tx.contactName || 'Unknown'
    if (!bySupplier.has(name)) bySupplier.set(name, [])
    bySupplier.get(name)!.push(tx)
  }

  const supplierEntries = Array.from(bySupplier.entries())
  for (const [contactName, txs] of supplierEntries) {
    if (txs.length >= 2) {
      // Check if all suggestions agree on the same category
      const categories = new Set(txs.map((t: UnclassifiedTransaction) => suggestions.get(t.id)?.suggestedCategory))
      if (categories.size === 1) {
        const firstSuggestion = suggestions.get(txs[0].id)!
        supplierGroups.push({
          contactName,
          category: firstSuggestion.suggestedCategory!,
          confidence: Math.min(...txs.map((t: UnclassifiedTransaction) => suggestions.get(t.id)?.confidence ?? 0)),
          reasoning: firstSuggestion.reasoning,
          transactions: txs,
          totalAmount: txs.reduce((sum: number, t: UnclassifiedTransaction) => sum + t.amount, 0),
        })
        continue
      }
    }
    ungroupedTransactions.push(...txs)
  }

  // Also include transactions without suggestions in the ungrouped list
  for (const tx of visibleTransactions) {
    if (!suggestions.has(tx.id)) ungroupedTransactions.push(tx)
  }

  async function handleConfirmGroup(group: SupplierGroup) {
    if (!currentOrganization?.id) return

    try {
      const updates = group.transactions.map(t => {
        const suggestion = suggestions.get(t.id)!
        return supabase
          .from('xero_transactions')
          .update({
            emission_category: suggestion.suggestedCategory,
            classification_source: 'ai',
            classification_confidence: suggestion.confidence,
            upgrade_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', t.id)
      })

      const results = await Promise.all(updates)
      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        toast.error(`Failed to confirm ${failed.length} classifications`)
        return
      }

      setConfirmedIds(prev => {
        const next = new Set(prev)
        for (const t of group.transactions) next.add(t.id)
        return next
      })

      // Learn from this confirmation
      fetch('/api/xero/learn-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          contactName: group.contactName,
          emissionCategory: group.category,
        }),
      }).catch(() => {})

      toast.success(`Confirmed ${group.transactions.length} transactions from ${group.contactName}`)
    } catch {
      toast.error('Failed to confirm group')
    }
  }

  async function handleDismissGroup(group: SupplierGroup) {
    const ids = group.transactions.map(t => t.id)
    setDismissedIds(prev => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })

    await supabase
      .from('xero_transactions')
      .update({ upgrade_status: 'dismissed', updated_at: new Date().toISOString() })
      .in('id', ids)

    toast.success(`Dismissed ${ids.length} transactions from ${group.contactName}`)
  }

  async function handleDismiss(txId: string) {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(txId)
      return next
    })

    // Persist dismissal to database
    await supabase
      .from('xero_transactions')
      .update({ upgrade_status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', txId)
  }

  async function handleConfirmAll() {
    if (!currentOrganization?.id) return

    const toConfirm = visibleTransactions.filter(t => suggestions.has(t.id))
    if (toConfirm.length === 0) return

    try {
      const updates = toConfirm.map(t => {
        const suggestion = suggestions.get(t.id)!
        return supabase
          .from('xero_transactions')
          .update({
            emission_category: suggestion.suggestedCategory,
            classification_source: 'ai',
            classification_confidence: suggestion.confidence,
            upgrade_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', t.id)
      })

      const results = await Promise.all(updates)
      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        toast.error(`Failed to confirm ${failed.length} classifications`)
        return
      }

      setConfirmedIds(prev => {
        const next = new Set(prev)
        for (const t of toConfirm) {
          next.add(t.id)
        }
        return next
      })
      toast.success(`Confirmed ${toConfirm.length} classifications`)
    } catch {
      toast.error('Failed to confirm classifications')
    }
  }

  async function handleDismissAll() {
    const toDismiss = visibleTransactions.filter(t => suggestions.has(t.id))
    if (toDismiss.length === 0) return

    setDismissedIds(prev => {
      const next = new Set(prev)
      for (const t of toDismiss) {
        next.add(t.id)
      }
      return next
    })

    // Persist dismissals to database in batch
    const dismissIds = toDismiss.map(t => t.id)
    await supabase
      .from('xero_transactions')
      .update({ upgrade_status: 'dismissed', updated_at: new Date().toISOString() })
      .in('id', dismissIds)

    toast.success(`Dismissed ${toDismiss.length} suggestions`)
  }

  const formatCurrency = (amount: number, currency: string = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
  }

  if (unclassified.length === 0) return null

  return (
    <section className="space-y-4 border-t border-studio-hairline pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow tone="dim">
            TRANSACTIONS THE SYNC COULD NOT PLACE · {unclassified.length}
          </Eyebrow>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggest a category with AI, then confirm each one before it is applied.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {suggestions.size > 0 && visibleTransactions.length > 0 && (
            <>
              <PillButton variant="outline" size="sm" onClick={handleConfirmAll}>
                Confirm all
              </PillButton>
              <PillButton variant="ghost" size="sm" onClick={handleDismissAll}>
                Dismiss all
              </PillButton>
            </>
          )}
          <PillButton
            variant="outline"
            size="sm"
            onClick={handleClassify}
            disabled={isClassifying || unclassified.length === 0}
          >
            {isClassifying ? 'Analysing…' : suggestions.size > 0 ? 'Re-classify' : 'Suggest with AI'}
          </PillButton>
        </div>
      </div>

      {suggestions.size === 0 && (
        <p className="text-sm text-muted-foreground">
          Run &ldquo;Suggest with AI&rdquo; to get category suggestions for these transactions.
          You confirm each one before it is applied.
        </p>
      )}

      {suggestions.size > 0 && visibleTransactions.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          {/* Grouped supplier rows */}
          {supplierGroups.map(group => (
            <div
              key={`group-${group.contactName}`}
              className="border-b border-studio-hairline py-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="truncate font-display text-sm font-semibold">
                  {group.contactName}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                  {group.transactions.length} TX · {formatCurrency(group.totalAmount)}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <StateChip tone={confidenceTone(group.confidence)}>
                    {CATEGORY_LABELS[group.category] || group.category} · {Math.round(group.confidence * 100)}%
                  </StateChip>
                  <span className="truncate text-xs text-muted-foreground">{group.reasoning}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <PillButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmGroup(group)}
                  >
                    Confirm all
                  </PillButton>
                  <PillButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissGroup(group)}
                    aria-label={`Dismiss ${group.contactName}`}
                  >
                    Dismiss
                  </PillButton>
                </div>
              </div>
            </div>
          ))}

          {/* Individual transaction rows */}
          {ungroupedTransactions.map(tx => {
            const suggestion = suggestions.get(tx.id)
            if (!suggestion) return null

            return (
              <div key={tx.id} className="border-b border-studio-hairline py-3">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-display text-sm font-semibold">
                    {tx.contactName || 'Unknown'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                    {formatCurrency(tx.amount, tx.currency)}
                  </span>
                </div>
                {tx.description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{tx.description}</p>
                )}

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <StateChip tone={confidenceTone(suggestion.confidence)}>
                      {CATEGORY_LABELS[suggestion.suggestedCategory!] || suggestion.suggestedCategory} · {Math.round(suggestion.confidence * 100)}%
                    </StateChip>
                    <span className="truncate text-xs text-muted-foreground">{suggestion.reasoning}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PillButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfirm(tx.id)}
                    >
                      Confirm
                    </PillButton>
                    <PillButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(tx.id)}
                      aria-label="Dismiss suggestion"
                    >
                      Dismiss
                    </PillButton>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmedIds.size > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-good">
          {confirmedIds.size} CLASSIFICATION{confirmedIds.size !== 1 ? 'S' : ''} CONFIRMED
        </p>
      )}
    </section>
  )
}
