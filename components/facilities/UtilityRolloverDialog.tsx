'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useReportingPeriod } from '@/hooks/useReportingPeriod'
import { UTILITY_TYPES } from '@/lib/constants/utility-types'

interface RolloverEntry {
  id: string
  utility_type: string
  quantity: number
  unit: string
  reporting_period_start: string
  reporting_period_end: string
  activity_date: string | null
  notes: string | null
  // editable quantity override
  newQuantity: string
}

interface UtilityRolloverDialogProps {
  open: boolean
  onClose: () => void
  facilityId: string
  organizationId: string
  onDataSaved: () => void
}

function shiftDateByYears(date: string, years: number): string {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().split('T')[0]
}

export function UtilityRolloverDialog({
  open,
  onClose,
  facilityId,
  organizationId,
  onDataSaved,
}: UtilityRolloverDialogProps) {
  const { currentLabelYear, getYearRange, getYearLabel } = useReportingPeriod()
  const fromYear = currentLabelYear - 1
  const toYear = currentLabelYear

  const fromLabel = getYearLabel(fromYear)
  const toLabel = getYearLabel(toYear)

  const [entries, setEntries] = useState<RolloverEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchPreviousYearData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchPreviousYearData = async () => {
    setIsLoading(true)
    try {
      const { yearStart, yearEnd } = getYearRange(fromYear)

      // Try utility_data_entries first
      const { data: utilityData, error } = await supabase
        .from('utility_data_entries')
        .select('id, utility_type, quantity, unit, reporting_period_start, reporting_period_end, activity_date, notes')
        .eq('facility_id', facilityId)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd)
        .order('reporting_period_start', { ascending: true })

      if (error) throw error

      if (utilityData && utilityData.length > 0) {
        setEntries(utilityData.map(e => ({ ...e, newQuantity: String(e.quantity) })))
        return
      }

      // Fallback: query activity_data for Scope 1 & 2 entries
      const { data: activityData, error: actError } = await supabase
        .from('activity_data')
        .select('id, fuel_type, quantity, unit, reporting_period_start, reporting_period_end, activity_date')
        .eq('facility_id', facilityId)
        .in('category', ['Scope 1', 'Scope 2'])
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd)
        .order('reporting_period_start', { ascending: true })

      if (actError) throw actError

      // Map activity_data rows to RolloverEntry shape.
      // fuel_type in activity_data may be either the fuelType value (e.g. 'grid_electricity')
      // or the utility_type value (e.g. 'electricity_grid') — try both.
      const validUtilityValues = new Set(UTILITY_TYPES.map(u => u.value))
      const fuelTypeToUtilityValue: Record<string, string> = {}
      for (const u of UTILITY_TYPES) {
        fuelTypeToUtilityValue[u.fuelType] = u.value
      }

      const mapped: RolloverEntry[] = []
      for (const e of activityData ?? []) {
        const resolvedType =
          fuelTypeToUtilityValue[e.fuel_type] ??
          (validUtilityValues.has(e.fuel_type) ? e.fuel_type : null)
        if (!resolvedType) continue
        mapped.push({
          id: e.id,
          utility_type: resolvedType,
          quantity: e.quantity,
          unit: e.unit,
          reporting_period_start: e.reporting_period_start,
          reporting_period_end: e.reporting_period_end,
          activity_date: e.activity_date ?? null,
          notes: null,
          newQuantity: String(e.quantity),
        })
      }

      setEntries(mapped)
    } catch (err: any) {
      toast.error('Failed to load previous year data')
    } finally {
      setIsLoading(false)
    }
  }

  const updateQuantity = (id: string, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, newQuantity: value } : e))
  }

  const handleConfirm = async () => {
    const valid = entries.filter(e => parseFloat(e.newQuantity) > 0)
    if (valid.length === 0) { toast.error('No entries to copy'); return }

    setIsSaving(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error('Not authenticated')

      for (const entry of valid) {
        const qty = parseFloat(entry.newQuantity)
        const newStart = shiftDateByYears(entry.reporting_period_start, toYear - fromYear)
        const newEnd = shiftDateByYears(entry.reporting_period_end, toYear - fromYear)
        const newActivityDate = entry.activity_date
          ? shiftDateByYears(entry.activity_date, toYear - fromYear)
          : null

        const utilityInfo = UTILITY_TYPES.find(u => u.value === entry.utility_type)

        const { error: insertError } = await supabase.from('utility_data_entries').insert({
          facility_id: facilityId,
          utility_type: entry.utility_type,
          quantity: qty,
          unit: entry.unit,
          reporting_period_start: newStart,
          reporting_period_end: newEnd,
          activity_date: newActivityDate,
          data_quality: 'estimated',
          calculated_scope: '',
          notes: entry.notes,
          created_by: userData.user.id,
        })
        if (insertError) throw insertError

        // Dual-write for legacy compatibility
        const category = utilityInfo?.scope === '1' ? 'Scope 1' : 'Scope 2'
        await supabase.from('activity_data').insert({
          organization_id: organizationId,
          facility_id: facilityId,
          user_id: userData.user.id,
          name: `${utilityInfo?.label || entry.utility_type} - ${newStart} to ${newEnd}`,
          category,
          quantity: qty,
          unit: entry.unit,
          fuel_type: utilityInfo?.fuelType || entry.utility_type,
          activity_date: newEnd,
          reporting_period_start: newStart,
          reporting_period_end: newEnd,
        })
      }

      // Trigger emissions calculation
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-scope1-2-calculations`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_id: organizationId }),
          })
        }
      } catch { /* non-blocking */ }

      toast.success(`${valid.length} ${valid.length === 1 ? 'entry' : 'entries'} copied to ${toLabel}`)
      onDataSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy entries')
    } finally {
      setIsSaving(false)
    }
  }

  const utilityLabel = (type: string) => UTILITY_TYPES.find(u => u.value === type)?.label ?? type

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    if (s.getMonth() === e.getMonth()) {
      return s.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    }
    return `${s.toLocaleDateString('en-GB', { month: 'short' })} – ${e.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !isSaving) onClose() }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Copy from {fromLabel}</DialogTitle>
          <DialogDescription>
            Review last year&apos;s utility data below. Quantities are editable — adjust anything that&apos;s changed before copying to {toLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading {fromLabel} data...</span>
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">No data found for {fromLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add utility entries for {fromLabel} first, then you can roll them over next year.
                </p>
              </div>
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'} found in {fromLabel}. Copied entries will be marked as <strong>estimated</strong> — update them with actual readings when available.
                </span>
              </div>

              <div className="space-y-2">
                {entries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{utilityLabel(entry.utility_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPeriod(entry.reporting_period_start, entry.reporting_period_end)}
                        {' → '}
                        {formatPeriod(
                          shiftDateByYears(entry.reporting_period_start, toYear - fromYear),
                          shiftDateByYears(entry.reporting_period_end, toYear - fromYear)
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.newQuantity}
                        onChange={e => updateQuantity(entry.id, e.target.value)}
                        className="w-24 h-8 text-sm text-right"
                        disabled={isSaving}
                      />
                      <span className="text-xs text-muted-foreground w-8">{entry.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!isLoading && entries.length > 0 && (
          <div className="flex gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Copying...</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" />Copy {entries.length} {entries.length === 1 ? 'entry' : 'entries'} to {toLabel}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
