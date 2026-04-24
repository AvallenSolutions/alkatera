'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  calculateTransportEmissions,
  getTransportModeWarning,
  formatTransportMode,
  type TransportMode,
} from '@/lib/utils/transport-emissions-calculator'
import {
  FREIGHT_CATEGORY_TO_MODE,
  FREIGHT_VEHICLE_OPTIONS,
} from '@/lib/xero/travel-emissions'
import {
  type XeroTransactionRow,
  type XeroTransactionView,
  toTransactionView,
  XERO_TX_SELECT_COLUMNS,
} from '@/lib/xero/types'
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper'
import { UpgradeTransactionPicker } from './UpgradeTransactionPicker'
import type { UpgradeFormCommonProps } from './upgrade-types'

interface FreightUpgradeFormProps extends UpgradeFormCommonProps {
  category: 'road_freight' | 'sea_freight' | 'air_freight'
}

const CATEGORY_LABELS: Record<string, string> = {
  road_freight: 'Road Freight',
  sea_freight: 'Sea Freight',
  air_freight: 'Air Freight',
}

export function FreightUpgradeForm({ category, onComplete, onCancel }: FreightUpgradeFormProps) {
  const { currentOrganization } = useOrganization()

  // Transaction data
  const [transactions, setTransactions] = useState<XeroTransactionView[]>([])
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Form fields
  const [weightKg, setWeightKg] = useState('')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'tonnes'>('kg')
  const [distanceKm, setDistanceKm] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>(FREIGHT_CATEGORY_TO_MODE[category] || 'truck')
  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Calculated emissions
  const [activityEmissions, setActivityEmissions] = useState(0)
  const [emissionFactor, setEmissionFactor] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [linkedTxIds, setLinkedTxIds] = useState<string[]>([])

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      const { data: txData } = await supabase
        .from('xero_transactions')
        .select(XERO_TX_SELECT_COLUMNS)
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')
        .order('transaction_date', { ascending: false })

      if (txData) {
        const rows = txData as unknown as XeroTransactionRow[]
        setTransactions(rows.map(toTransactionView))
        setSpendTotal(rows.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0))
        setSpendEmissions(rows.reduce((sum, t) => sum + Math.abs(t.spend_based_emissions_kg || 0), 0))

        // Pre-fill weight from extracted metadata
        for (const t of rows) {
          const meta = t.extracted_metadata as Record<string, unknown> | null
          if (meta?.weight) {
            const w = meta.weight as { value: number; unit: 'kg' | 'tonnes' }
            setWeightKg(w.value.toString())
            setWeightUnit(w.unit)
            break // Use first match
          }
        }
      }

      setIsLoading(false)
    }

    loadData()
  }, [currentOrganization?.id, category])

  // Recalculate emissions when inputs change
  useEffect(() => {
    async function recalculate() {
      const weight = parseFloat(weightKg) || 0
      const actualWeightKg = weightUnit === 'tonnes' ? weight * 1000 : weight
      const distance = parseFloat(distanceKm) || 0

      if (actualWeightKg <= 0 || distance <= 0) {
        setActivityEmissions(0)
        setEmissionFactor(0)
        return
      }

      setIsCalculating(true)
      try {
        const result = await calculateTransportEmissions({
          weightKg: actualWeightKg,
          distanceKm: distance,
          transportMode,
        })
        setActivityEmissions(result.emissions)
        setEmissionFactor(result.emissionFactor)
      } catch (err) {
        console.error('[FreightUpgrade] Calculation error:', err)
        setActivityEmissions(0)
        setEmissionFactor(0)
      } finally {
        setIsCalculating(false)
      }
    }

    recalculate()
  }, [weightKg, weightUnit, distanceKm, transportMode])

  const distanceNum = parseFloat(distanceKm) || 0
  const weightNum = parseFloat(weightKg) || 0
  const actualWeightKg = weightUnit === 'tonnes' ? weightNum * 1000 : weightNum
  const warning = getTransportModeWarning(transportMode, distanceNum)

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(spendTotal)

  const formatEmissions = useCallback((kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }, [])

  const vehicleOptions = FREIGHT_VEHICLE_OPTIONS[category] || []

  async function handleSave() {
    if (!currentOrganization?.id) return

    if (actualWeightKg <= 0) {
      toast.error('Please enter a valid weight')
      return
    }

    if (distanceNum <= 0) {
      toast.error('Please enter a valid distance')
      return
    }

    setIsSaving(true)
    try {
      const transactionIds = transactions.map(t => t.id)
      const transactionDates = transactions.map(t => t.date)
      const reportYear = deriveReportingYear(date, transactionDates)
      const reportId = await getOrCreateCorporateReport(supabase, currentOrganization.id, reportYear)

      const supplierNames = Array.from(new Set(transactions.map(t => t.supplierName).filter(Boolean)))
      const autoDescription = description
        || `${CATEGORY_LABELS[category]}: ${(actualWeightKg / 1000).toFixed(1)}t over ${distanceNum}km${supplierNames.length ? ` (${supplierNames.join(', ')})` : ''}`

      const { data: newEntry, error: insertError } = await supabase
        .from('corporate_overheads')
        .insert({
          report_id: reportId,
          category: 'upstream_transportation',
          transport_mode: transportMode,
          description: autoDescription,
          distance_km: distanceNum,
          entry_date: date,
          emission_factor: emissionFactor,
          computed_co2e: activityEmissions,
          spend_amount: spendTotal,
          currency: 'GBP',
          data_source: 'xero_upgrade',
          source_xero_transaction_ids: transactionIds,
          origin_location: originText || null,
          destination_location: destinationText || null,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Mark only the selected Xero transactions as upgraded + linked
      if (linkedTxIds.length > 0) {
        const { error: updateError } = await supabase
          .from('xero_transactions')
          .update({
            upgrade_status: 'upgraded',
            data_quality_tier: 2,
            upgraded_entry_id: newEntry.id,
            upgraded_entry_table: 'corporate_overheads',
            updated_at: new Date().toISOString(),
          })
          .in('id', linkedTxIds)

        if (updateError) throw updateError
      }

      toast.success(
        linkedTxIds.length > 0
          ? `${CATEGORY_LABELS[category]} data saved. Linked ${linkedTxIds.length} transaction${linkedTxIds.length === 1 ? '' : 's'}.`
          : `${CATEGORY_LABELS[category]} data saved. No Xero transactions linked.`
      )
      onComplete({
        entryId: newEntry.id,
        entryTable: 'corporate_overheads',
        xeroTransactionIds: linkedTxIds,
      })
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
            Upgrade: {CATEGORY_LABELS[category]}
          </CardTitle>
          <CardDescription>
            We found {formattedSpend} in {CATEGORY_LABELS[category].toLowerCase()} spend across {transactions.length} transactions.
            Enter shipment details for a more accurate calculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Transaction list */}
          {currentOrganization && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Xero transactions this entry covers
              </Label>
              <p className="text-xs text-muted-foreground">
                Only the transactions you select will be marked as upgraded.
              </p>
              <UpgradeTransactionPicker
                organizationId={currentOrganization.id}
                category={category}
                selected={linkedTxIds}
                onChange={setLinkedTxIds}
              />
            </div>
          )}

          {/* Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total weight shipped</Label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={weightUnit} onValueChange={v => setWeightUnit(v as 'kg' | 'tonnes')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="tonnes">tonnes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-2">
            <Label>Total distance (km)</Label>
            <Input
              type="number"
              placeholder="e.g. 350"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              min="0"
              step="any"
            />
          </div>

          {/* Transport mode */}
          <div className="space-y-2">
            <Label>Vehicle / mode type</Label>
            <Select value={transportMode} onValueChange={v => setTransportMode(v as TransportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicleOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plausibility warning */}
          {warning && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
            </div>
          )}

          {/* Origin / Destination (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origin (optional)</Label>
              <Input
                placeholder="e.g. Manchester warehouse"
                value={originText}
                onChange={e => setOriginText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Destination (optional)</Label>
              <Input
                placeholder="e.g. London distribution centre"
                value={destinationText}
                onChange={e => setDestinationText(e.target.value)}
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g. Monthly deliveries to distribution centres"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Before/After comparison */}
          {activityEmissions > 0 && (
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
                      Tier 2 ({(actualWeightKg / 1000).toFixed(1)}t × {distanceNum}km × {emissionFactor.toFixed(3)} kg/tkm)
                    </p>
                  </div>
                </div>
                {activityEmissions > 0 && spendEmissions > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Uncertainty reduced from ~70% to ~20% with activity-based data
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
              disabled={isSaving || isCalculating || actualWeightKg <= 0 || distanceNum <= 0}
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
