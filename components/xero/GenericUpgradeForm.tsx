'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { UpgradeTransactionPicker } from './UpgradeTransactionPicker'
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper'
import { GENERIC_UPGRADE_CONFIG, type GenericUpgradeCategory } from '@/lib/xero/generic-upgrade-config'
import type { UpgradeFormCommonProps } from './upgrade-types'

interface Props extends UpgradeFormCommonProps {
  category: GenericUpgradeCategory
  /** Optional pre-selected transaction ID (from per-row upgrade flow). */
  preselectedTransactionId?: string
}

export function GenericUpgradeForm({ category, preselectedTransactionId, onComplete, onCancel }: Props) {
  const { currentOrganization } = useOrganization()
  const config = GENERIC_UPGRADE_CONFIG[category]

  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(config.units[0].value)
  const [emissionFactor, setEmissionFactor] = useState(String(config.units[0].defaultFactor))
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [description, setDescription] = useState('')
  const [linkedTxIds, setLinkedTxIds] = useState<string[]>(preselectedTransactionId ? [preselectedTransactionId] : [])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      const { data: txData } = await supabase
        .from('xero_transactions')
        .select('amount, spend_based_emissions_kg, transaction_date')
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')

      if (txData) {
        setSpendTotal(txData.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0))
        setSpendEmissions(txData.reduce((sum, t) => sum + Math.abs(t.spend_based_emissions_kg || 0), 0))
      }

      setIsLoading(false)
    }
    loadData()
  }, [currentOrganization?.id, category])

  // Update default factor when unit changes
  useEffect(() => {
    const unitCfg = config.units.find(u => u.value === unit)
    if (unitCfg) setEmissionFactor(String(unitCfg.defaultFactor))
  }, [unit, config.units])

  const quantityNum = parseFloat(quantity) || 0
  const factorNum = parseFloat(emissionFactor) || 0
  const activityEmissions = quantityNum * factorNum

  const formatEmissions = (kg: number) =>
    kg >= 1000 ? `${(kg / 1000).toFixed(2)} tCO2e` : `${Math.round(kg)} kg CO2e`

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(spendTotal)

  async function handleSave() {
    if (!currentOrganization?.id) return
    if (!quantityNum || !periodStart || !periodEnd) {
      toast.error('Please enter quantity and reporting period')
      return
    }

    setIsSaving(true)
    try {
      const reportYear = deriveReportingYear(periodEnd, [periodStart, periodEnd])
      const reportId = await getOrCreateCorporateReport(supabase, currentOrganization.id, reportYear)

      const insertPayload: Record<string, unknown> = {
        report_id: reportId,
        category: config.overheadCategory,
        spend_amount: spendTotal,
        currency: 'GBP',
        emission_factor: factorNum,
        computed_co2e: activityEmissions,
        description: description || `${config.label}: ${quantityNum} ${unit}`,
        entry_date: periodStart,
        notes: `Unit: ${unit}. Reporting period ${periodStart} to ${periodEnd}.`,
      }

      if (config.materialType) insertPayload.material_type = config.materialType
      if (config.assetType) insertPayload.asset_type = config.assetType
      if (config.disposalMethod) insertPayload.disposal_method = config.disposalMethod
      if (linkedTxIds.length > 0) insertPayload.source_xero_transaction_ids = linkedTxIds

      const { data: entry, error: insertError } = await supabase
        .from('corporate_overheads')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insertError) throw insertError

      if (linkedTxIds.length > 0) {
        const { error: updateError } = await supabase
          .from('xero_transactions')
          .update({
            upgrade_status: 'upgraded',
            data_quality_tier: 2,
            upgraded_entry_id: entry.id,
            upgraded_entry_table: 'corporate_overheads',
            updated_at: new Date().toISOString(),
          })
          .in('id', linkedTxIds)

        if (updateError) throw updateError
      }

      toast.success(
        linkedTxIds.length > 0
          ? `Upgraded ${linkedTxIds.length} transaction${linkedTxIds.length === 1 ? '' : 's'} to activity-based data.`
          : 'Activity data saved. No Xero transactions linked.'
      )
      onComplete({
        entryId: entry.id,
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
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Upgrade: {config.label}
          </CardTitle>
          <CardDescription>
            {spendTotal > 0
              ? `We found ${formattedSpend} of ${config.label.toLowerCase()} spend. Enter activity data for a more accurate calculation.`
              : `Enter activity data to replace spend-based estimates for ${config.label.toLowerCase()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.guidance && (
            <div className="rounded-md bg-slate-50 dark:bg-slate-900/40 border border-border p-3 text-xs text-muted-foreground">
              {config.guidance}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                placeholder="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              {config.units.length === 1 ? (
                <Input value={config.units[0].label} disabled />
              ) : (
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {config.units.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Emission factor (kg CO2e per {unit})</Label>
            <Input
              type="number"
              value={emissionFactor}
              onChange={e => setEmissionFactor(e.target.value)}
              min="0"
              step="any"
            />
            <p className="text-xs text-muted-foreground">
              Default is a DEFRA / industry-average estimate. Replace with your supplier-specific factor if available.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period start</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period end</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="e.g. Q1 waste collection from main facility"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {currentOrganization && (
            <div className="space-y-2">
              <Label>Xero transactions this entry covers</Label>
              <p className="text-xs text-muted-foreground">
                Only selected transactions are marked as upgraded. Enter a period above to auto-select matching months.
              </p>
              <UpgradeTransactionPicker
                organizationId={currentOrganization.id}
                category={category}
                periodStart={periodStart}
                periodEnd={periodEnd}
                selected={linkedTxIds}
                onChange={setLinkedTxIds}
              />
            </div>
          )}

          {quantityNum > 0 && factorNum > 0 && (
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Spend-based estimate</p>
                    <p className="text-lg font-semibold text-amber-600">{formatEmissions(spendEmissions)}</p>
                    <p className="text-xs text-muted-foreground">Tier 4 (lowest quality, ~70% uncertainty)</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Activity-based calculation</p>
                    <p className="text-lg font-semibold text-emerald-600">{formatEmissions(activityEmissions)}</p>
                    <p className="text-xs text-muted-foreground">
                      Tier 2 ({quantityNum} {unit} × {factorNum} kg CO2e)
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !quantityNum || !periodStart || !periodEnd}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save &amp; Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
