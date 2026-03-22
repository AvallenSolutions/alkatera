'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown, Hotel } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  calculateHotelCO2e,
  getHotelFactor,
  COUNTRY_REGION_OPTIONS,
  HOTEL_TYPE_OPTIONS,
  type CountryRegion,
  type HotelType,
} from '@/lib/xero/travel-emissions'
import {
  type XeroTransactionRow,
  type XeroTransactionView,
  toTransactionView,
  XERO_TX_SELECT_COLUMNS,
} from '@/lib/xero/types'
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper'

interface AccommodationUpgradeFormProps {
  onComplete: () => void
  onCancel: () => void
}

export function AccommodationUpgradeForm({ onComplete, onCancel }: AccommodationUpgradeFormProps) {
  const { currentOrganization } = useOrganization()

  // Transaction data
  const [transactions, setTransactions] = useState<XeroTransactionView[]>([])
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Form fields
  const [nights, setNights] = useState('')
  const [countryRegion, setCountryRegion] = useState<CountryRegion>('uk')
  const [hotelType, setHotelType] = useState<HotelType>('average')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [description, setDescription] = useState('')

  // Save state
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      const { data: txData } = await supabase
        .from('xero_transactions')
        .select(XERO_TX_SELECT_COLUMNS)
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', 'accommodation')
        .eq('upgrade_status', 'pending')
        .order('transaction_date', { ascending: false })

      if (txData) {
        const rows = txData as unknown as XeroTransactionRow[]
        setTransactions(rows.map(toTransactionView))
        setSpendTotal(rows.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0))
        setSpendEmissions(rows.reduce((sum, t) => sum + Math.abs(t.spend_based_emissions_kg || 0), 0))

        // Pre-fill night count from extracted metadata
        let totalNights = 0
        for (const t of rows) {
          const meta = t.extracted_metadata as Record<string, unknown> | null
          if (meta?.nightCount) {
            totalNights += meta.nightCount as number
          }
        }
        if (totalNights > 0) {
          setNights(totalNights.toString())
        }
      }

      setIsLoading(false)
    }

    loadData()
  }, [currentOrganization?.id])

  // Calculate activity-based emissions
  const nightsNum = parseInt(nights) || 0
  const activityEmissions = nightsNum > 0 ? calculateHotelCO2e(nightsNum, countryRegion, hotelType) : 0
  const factor = getHotelFactor(countryRegion, hotelType)

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(spendTotal)

  const formatEmissions = useCallback((kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }, [])

  async function handleSave() {
    if (!currentOrganization?.id) return

    if (nightsNum <= 0) {
      toast.error('Please enter the number of room nights')
      return
    }

    setIsSaving(true)
    try {
      const transactionIds = transactions.map(t => t.id)
      const transactionDates = transactions.map(t => t.date)
      const entryDate = dateFrom || transactions[0]?.date || new Date().toISOString().split('T')[0]
      const reportYear = deriveReportingYear(entryDate, transactionDates)
      const reportId = await getOrCreateCorporateReport(supabase, currentOrganization.id, reportYear)

      // Build corporate_overheads entry
      const supplierNames = Array.from(new Set(transactions.map(t => t.supplierName).filter(Boolean)))
      const autoDescription = description
        || `${nightsNum} night${nightsNum !== 1 ? 's' : ''} accommodation${supplierNames.length ? ` (${supplierNames.join(', ')})` : ''}`

      const { data: newEntry, error: insertError } = await supabase
        .from('corporate_overheads')
        .insert({
          report_id: reportId,
          category: 'business_travel',
          transport_mode: 'Hotel',
          description: autoDescription,
          entry_date: entryDate,
          emission_factor: factor,
          computed_co2e: activityEmissions,
          spend_amount: spendTotal,
          currency: 'GBP',
          data_source: 'xero_upgrade',
          source_xero_transaction_ids: transactionIds,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Mark Xero transactions as upgraded
      const { error: updateError } = await supabase
        .from('xero_transactions')
        .update({
          upgrade_status: 'upgraded',
          data_quality_tier: 2,
          upgraded_entry_id: newEntry.id,
          upgraded_entry_table: 'corporate_overheads',
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', 'accommodation')
        .eq('upgrade_status', 'pending')

      if (updateError) throw updateError

      toast.success('Accommodation data upgraded successfully')
      onComplete()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onCancel} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Action Centre
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Upgrade: Accommodation
          </CardTitle>
          <CardDescription>
            We found {formattedSpend} in hotel/accommodation spend across {transactions.length} transactions.
            Enter your room night details for a more accurate calculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Transaction list */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Transactions identified
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Hotel className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{tx.supplierName || 'Unknown'}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                    <span className="font-medium shrink-0">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Room nights */}
          <div className="space-y-2">
            <Label>Total room nights</Label>
            <Input
              type="number"
              placeholder="e.g. 12"
              value={nights}
              onChange={e => setNights(e.target.value)}
              min="1"
              step="1"
            />
          </div>

          {/* Country/Region */}
          <div className="space-y-2">
            <Label>Country / Region</Label>
            <Select value={countryRegion} onValueChange={v => setCountryRegion(v as CountryRegion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_REGION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hotel type */}
          <div className="space-y-2">
            <Label>Hotel type</Label>
            <RadioGroup value={hotelType} onValueChange={v => setHotelType(v as HotelType)}>
              {HOTEL_TYPE_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`hotel-${option.value}`} />
                  <Label
                    htmlFor={`hotel-${option.value}`}
                    className="font-normal cursor-pointer flex items-center gap-2"
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({factor.toFixed(1)} kg CO2e/night)
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period from (optional)</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Period to (optional)</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g. Business trips Q1 2026"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Before/After comparison */}
          {nightsNum > 0 && (
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Spend-based estimate</p>
                    <p className="text-lg font-semibold text-amber-600">
                      {formatEmissions(spendEmissions)}
                    </p>
                    <p className="text-xs text-muted-foreground">Tier 4 (lowest quality, ~70% uncertainty)</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Activity-based calculation</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      {formatEmissions(activityEmissions)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tier 2 ({nightsNum} nights × {factor.toFixed(1)} kg CO2e/night)
                    </p>
                  </div>
                </div>
                {activityEmissions > 0 && spendEmissions > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Uncertainty reduced from ~70% to ~25% with activity-based data
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || nightsNum <= 0}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
