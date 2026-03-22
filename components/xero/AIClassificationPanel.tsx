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

    const { data } = await supabase
      .from('xero_transactions')
      .select('id, xero_contact_name, description, amount, transaction_date, currency')
      .eq('organization_id', currentOrganization.id)
      .is('emission_category', null)
      .eq('upgrade_status', 'not_applicable')
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
      const response = await fetch('/api/xero/classify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          transactions: unclassified.map(t => ({
            id: t.id,
            contactName: t.contactName,
            description: t.description,
            amount: t.amount,
          })),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Classification failed')
      }

      const { results } = await response.json() as { results: AISuggestion[] }
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
      toast.success('Classification confirmed')
    } catch {
      toast.error('Failed to confirm classification')
    }
  }

  const visibleTransactions = unclassified.filter(
    t => !confirmedIds.has(t.id) && !dismissedIds.has(t.id)
  )

  async function handleDismiss(txId: string) {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(txId)
      return next
    })
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

  function handleDismissAll() {
    const toDismiss = visibleTransactions.filter(t => suggestions.has(t.id))
    if (toDismiss.length === 0) return

    setDismissedIds(prev => {
      const next = new Set(prev)
      for (const t of toDismiss) {
        next.add(t.id)
      }
      return next
    })
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
            {visibleTransactions.map(tx => {
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
