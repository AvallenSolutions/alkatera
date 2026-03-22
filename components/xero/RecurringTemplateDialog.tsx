'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import {
  findRecurringTransactions,
  calculateProRatedValues,
  type RecurringGroup,
} from '@/lib/xero/recurring-pattern'
import { getOrCreateCorporateReport } from '@/lib/xero/report-helper'

interface RecurringTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  category: string
  contactId?: string | null
  /** The base entry that was just saved - used as template */
  baseEntry: {
    /** The month key of the saved entry, e.g. "2026-01" */
    monthKey: string
    /** The quantity entered (kWh, nights, km, kg, etc.) */
    quantity: number
    /** The spend amount for the base month */
    spend: number
    /** The entry to copy fields from */
    templateFields: Record<string, unknown>
  }
  /** Called after batch save, with count of entries created */
  onComplete: (count: number) => void
}

export function RecurringTemplateDialog({
  open,
  onOpenChange,
  organizationId,
  category,
  contactId,
  baseEntry,
  onComplete,
}: RecurringTemplateDialogProps) {
  const [groups, setGroups] = useState<RecurringGroup[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!open) return
      setIsLoading(true)

      const allGroups = await findRecurringTransactions(supabase, organizationId, category, contactId)

      // Exclude the base month (already saved)
      const otherMonths = allGroups.filter(g => g.monthKey !== baseEntry.monthKey)

      // Calculate pro-rated values
      const withValues = calculateProRatedValues(baseEntry.quantity, baseEntry.spend, otherMonths)

      setGroups(withValues)
      // Pre-select all months
      setSelectedMonths(new Set(withValues.map(g => g.monthKey)))
      // Pre-fill editable quantities
      const quantities: Record<string, number> = {}
      for (const g of withValues) {
        quantities[g.monthKey] = g.proRatedQuantity
      }
      setEditedQuantities(quantities)
      setIsLoading(false)
    }

    load()
  }, [open, organizationId, category, contactId, baseEntry.monthKey, baseEntry.quantity, baseEntry.spend])

  function toggleMonth(monthKey: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  function updateQuantity(monthKey: string, value: string) {
    setEditedQuantities(prev => ({
      ...prev,
      [monthKey]: parseFloat(value) || 0,
    }))
  }

  async function handleApply() {
    const selectedGroups = groups.filter(g => selectedMonths.has(g.monthKey))
    if (selectedGroups.length === 0) {
      toast.error('Please select at least one month')
      return
    }

    setIsSaving(true)
    let created = 0

    try {
      for (const group of selectedGroups) {
        const quantity = editedQuantities[group.monthKey] || group.proRatedQuantity
        if (quantity <= 0) continue

        // Derive year from month key
        const year = parseInt(group.monthKey.split('-')[0])
        const reportId = await getOrCreateCorporateReport(supabase, organizationId, year)

        // Build entry from template fields
        const entry = {
          ...baseEntry.templateFields,
          report_id: reportId,
          entry_date: `${group.monthKey}-01`,
          spend_amount: group.spend,
          source_xero_transaction_ids: group.transactionIds,
          data_source: 'xero_upgrade',
        }

        // The quantity field name varies by category - update the relevant one
        // This is handled by the caller setting the right field in templateFields
        // We just need to scale the computed emissions proportionally
        const baseQuantity = baseEntry.quantity
        if (baseQuantity > 0) {
          const ratio = quantity / baseQuantity
          const baseCO2e = (baseEntry.templateFields.computed_co2e as number) || 0
          ;(entry as Record<string, unknown>).computed_co2e = Math.round(baseCO2e * ratio * 100) / 100
        }

        const { data: newEntry, error: insertError } = await supabase
          .from('corporate_overheads')
          .insert(entry)
          .select('id')
          .single()

        if (insertError) {
          console.error(`[RecurringTemplate] Insert failed for ${group.monthKey}:`, insertError)
          continue
        }

        // Mark transactions as upgraded
        const { error: updateError } = await supabase
          .from('xero_transactions')
          .update({
            upgrade_status: 'upgraded',
            data_quality_tier: 2,
            upgraded_entry_id: newEntry.id,
            upgraded_entry_table: 'corporate_overheads',
            updated_at: new Date().toISOString(),
          })
          .in('id', group.transactionIds)

        if (updateError) {
          console.error(`[RecurringTemplate] Update failed for ${group.monthKey}:`, updateError)
        }

        created++
      }

      toast.success(`Applied template to ${created} ${created === 1 ? 'month' : 'months'}`)
      onComplete(created)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to apply template')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Apply to Similar Months
          </DialogTitle>
          <DialogDescription>
            You entered data for {baseEntry.monthKey ? formatMonthFromKey(baseEntry.monthKey) : 'one month'}.
            Apply similar values to these other months based on their spend ratios.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No other months found with transactions for this category.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {groups.map(group => (
              <div
                key={group.monthKey}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedMonths.has(group.monthKey)
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-600'
                    : 'opacity-50'
                }`}
              >
                <Checkbox
                  checked={selectedMonths.has(group.monthKey)}
                  onCheckedChange={() => toggleMonth(group.monthKey)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{group.monthLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(group.spend)} ({group.transactionCount} tx)
                    </span>
                  </div>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    value={editedQuantities[group.monthKey] || ''}
                    onChange={e => updateQuantity(group.monthKey, e.target.value)}
                    className="h-8 text-xs text-right"
                    min="0"
                    step="any"
                    disabled={!selectedMonths.has(group.monthKey)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button
            onClick={handleApply}
            disabled={isSaving || selectedMonths.size === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Apply to {selectedMonths.size} {selectedMonths.size === 1 ? 'month' : 'months'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatMonthFromKey(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
