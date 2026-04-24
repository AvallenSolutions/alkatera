'use client'

/**
 * Shared checklist of pending Xero transactions for an emission category.
 *
 * Upgrade forms render this and receive the selected transaction IDs so the
 * parent can link them to the activity entry it creates. Replaces the old
 * blanket "mark every pending tx as upgraded" behaviour.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Calendar } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'

interface PendingTx {
  id: string
  xero_contact_name: string | null
  description: string | null
  amount: number
  transaction_date: string
  currency: string | null
}

interface Props {
  organizationId: string
  category: string
  periodStart?: string
  periodEnd?: string
  selected: string[]
  onChange: (selected: string[]) => void
}

const currencyFmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })

function monthKey(iso: string): string {
  return iso.slice(0, 7) // YYYY-MM
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function UpgradeTransactionPicker({
  organizationId,
  category,
  periodStart,
  periodEnd,
  selected,
  onChange,
}: Props) {
  const [transactions, setTransactions] = useState<PendingTx[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoAppliedPeriod, setAutoAppliedPeriod] = useState<string>('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const { data } = await supabase
        .from('xero_transactions')
        .select('id, xero_contact_name, description, amount, transaction_date, currency')
        .eq('organization_id', organizationId)
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')
        .order('transaction_date', { ascending: false })
        .limit(500)

      setTransactions(data || [])
      setIsLoading(false)
    }
    load()
  }, [organizationId, category])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const total = transactions.length
  const selectedTotal = transactions
    .filter(t => selectedSet.has(t.id))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)

  // Auto-select transactions that fall inside the entered period range
  useEffect(() => {
    if (!periodStart || !periodEnd || transactions.length === 0) return
    const rangeKey = `${periodStart}..${periodEnd}`
    if (rangeKey === autoAppliedPeriod) return

    const inRange = transactions
      .filter(t => t.transaction_date >= periodStart && t.transaction_date <= periodEnd)
      .map(t => t.id)
    if (inRange.length > 0) {
      onChange(inRange)
      setAutoAppliedPeriod(rangeKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd, transactions])

  const byMonth = useMemo(() => {
    const map = new Map<string, PendingTx[]>()
    for (const t of transactions) {
      const k = monthKey(t.transaction_date)
      const arr = map.get(k) || []
      arr.push(t)
      map.set(k, arr)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [transactions])

  function toggle(id: string) {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(Array.from(next))
  }

  function toggleMonth(ids: string[]) {
    const allSelected = ids.every(id => selectedSet.has(id))
    const next = new Set(selectedSet)
    if (allSelected) {
      ids.forEach(id => next.delete(id))
    } else {
      ids.forEach(id => next.add(id))
    }
    onChange(Array.from(next))
  }

  function selectAll() {
    onChange(transactions.map(t => t.id))
  }

  function clearAll() {
    onChange([])
  }

  if (isLoading) {
    return (
      <div className="rounded-md border border-border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pending transactions...
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        No pending transactions in this category.
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{selected.length} of {total} selected</Badge>
          {selected.length > 0 && (
            <span className="text-muted-foreground">{currencyFmt.format(selectedTotal)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
            Select all
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {byMonth.map(([month, txs]) => {
          const monthSelected = txs.every(t => selectedSet.has(t.id))
          const monthTotal = txs.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
          return (
            <div key={month} className="py-1">
              <button
                onClick={() => toggleMonth(txs.map(t => t.id))}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors text-left"
              >
                <Checkbox
                  checked={monthSelected}
                  onCheckedChange={() => toggleMonth(txs.map(t => t.id))}
                />
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">{formatMonth(month)}</span>
                <span className="text-xs text-muted-foreground">({txs.length} · {currencyFmt.format(monthTotal)})</span>
              </button>
              <div className="pl-10 pr-3 space-y-0.5">
                {txs.map(t => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-muted/30 rounded px-1"
                  >
                    <Checkbox
                      checked={selectedSet.has(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                    />
                    <span className="text-muted-foreground tabular-nums w-20 shrink-0">
                      {t.transaction_date}
                    </span>
                    <span className="truncate flex-1">
                      <span className="font-medium">{t.xero_contact_name || '(no supplier)'}</span>
                      {t.description && <span className="text-muted-foreground"> · {t.description}</span>}
                    </span>
                    <span className="tabular-nums shrink-0">
                      {currencyFmt.format(Math.abs(t.amount))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
