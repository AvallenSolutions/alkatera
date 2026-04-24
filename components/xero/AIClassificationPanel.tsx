'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Check, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS } from '@/lib/xero/category-labels'
import { classifyTransactionsChunked } from '@/lib/xero/classify-ai-client'

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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (unclassified.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Classification
            </CardTitle>
            <CardDescription>
              {unclassified.length} unclassified transactions. Use AI to suggest emission categories.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {suggestions.size > 0 && visibleTransactions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-700 dark:text-emerald-400"
                  onClick={handleConfirmAll}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Confirm All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissAll}
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss All
                </Button>
              </>
            )}
            <Button
              onClick={handleClassify}
              disabled={isClassifying || unclassified.length === 0}
              size="sm"
            >
              {isClassifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {suggestions.size > 0 ? 'Re-classify' : 'Classify with AI'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.size === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>Click &quot;Classify with AI&quot; to get suggestions for unclassified transactions.</p>
            <p className="text-xs mt-1">You must confirm each suggestion before it is applied.</p>
          </div>
        )}

        {suggestions.size > 0 && visibleTransactions.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Grouped supplier rows */}
            {supplierGroups.map(group => (
              <div
                key={`group-${group.contactName}`}
                className="p-3 rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/30 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {group.contactName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {group.transactions.length} transactions
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        group.confidence >= 0.8
                          ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                          : group.confidence >= 0.5
                            ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                            : 'border-red-300 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {CATEGORY_LABELS[group.category] || group.category}
                      <span className="ml-1 opacity-70">{Math.round(group.confidence * 100)}%</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">{group.reasoning}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-emerald-700 dark:text-emerald-400"
                      onClick={() => handleConfirmGroup(group)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Confirm All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDismissGroup(group)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Individual transaction rows */}
            {ungroupedTransactions.map(tx => {
              const suggestion = suggestions.get(tx.id)
              if (!suggestion) return null

              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {tx.contactName || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </div>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          suggestion.confidence >= 0.8
                            ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                            : suggestion.confidence >= 0.5
                              ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                              : 'border-red-300 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {CATEGORY_LABELS[suggestion.suggestedCategory!] || suggestion.suggestedCategory}
                        <span className="ml-1 opacity-70">{Math.round(suggestion.confidence * 100)}%</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">{suggestion.reasoning}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-emerald-700 dark:text-emerald-400"
                        onClick={() => handleConfirm(tx.id)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDismiss(tx.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {confirmedIds.size > 0 && (
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            {confirmedIds.size} classification{confirmedIds.size !== 1 ? 's' : ''} confirmed
          </div>
        )}
      </CardContent>
    </Card>
  )
}
