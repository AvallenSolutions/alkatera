'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { UpgradeTransactionPicker } from './UpgradeTransactionPicker'
import type { UpgradeFormCommonProps } from './upgrade-types'

// Maps our emission categories to utility_data_entries utility types
const CATEGORY_TO_UTILITY_TYPE: Record<string, { utilityType: string; unit: string; label: string; altUnit?: string; altLabel?: string }> = {
  grid_electricity:   { utilityType: 'electricity_grid', unit: 'kWh', label: 'Electricity consumption in kWh' },
  natural_gas:        { utilityType: 'natural_gas',      unit: 'kWh', label: 'Gas consumption in kWh', altUnit: 'm3', altLabel: 'Gas consumption in m\u00B3' },
  diesel_stationary:  { utilityType: 'diesel_stationary', unit: 'litres', label: 'Diesel consumption in litres' },
  diesel_mobile:      { utilityType: 'diesel_mobile',    unit: 'litres', label: 'Diesel consumption in litres' },
  petrol_mobile:      { utilityType: 'petrol_mobile',    unit: 'litres', label: 'Petrol consumption in litres' },
  lpg:                { utilityType: 'lpg',              unit: 'litres', label: 'LPG consumption in litres' },
  water:              { utilityType: 'water_supply',     unit: 'm3', label: 'Water consumption in m\u00B3' },
}

// Activity-based emission factors for the before/after comparison
const ACTIVITY_FACTORS: Record<string, number> = {
  grid_electricity: 0.207,    // kg CO2e per kWh (UK grid, DEFRA 2025)
  natural_gas: 0.183,         // kg CO2e per kWh
  diesel_stationary: 2.688,   // kg CO2e per litre
  diesel_mobile: 2.688,       // kg CO2e per litre
  petrol_mobile: 2.31,        // kg CO2e per litre
  lpg: 1.555,                 // kg CO2e per litre
  water: 0.149,               // kg CO2e per m³
}

interface Facility {
  id: string
  name: string
}

interface EnergyUpgradeFormProps extends UpgradeFormCommonProps {
  category: string
}

export function EnergyUpgradeForm({ category, onComplete, onCancel }: EnergyUpgradeFormProps) {
  const { currentOrganization } = useOrganization()
  const config = CATEGORY_TO_UTILITY_TYPE[category]

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(config?.unit || 'kWh')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [linkedTxIds, setLinkedTxIds] = useState<string[]>([])

  // Spend-based totals for comparison
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      // Fetch facilities
      const { data: facData } = await supabase
        .from('facilities')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name')

      setFacilities(facData || [])
      if (facData && facData.length === 1) {
        setFacilityId(facData[0].id)
      }

      // Fetch spend totals for this category
      const { data: txData } = await supabase
        .from('xero_transactions')
        .select('amount, spend_based_emissions_kg')
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

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Upgrade form not available for this category yet.
        </CardContent>
      </Card>
    )
  }

  // Calculate activity-based emissions for comparison
  const quantityNum = parseFloat(quantity) || 0
  const factor = ACTIVITY_FACTORS[category] || 0
  const activityEmissions = quantityNum * factor

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(spendTotal)

  async function handleSave() {
    if (!currentOrganization?.id || !facilityId || !quantity || !periodStart || !periodEnd) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSaving(true)
    try {
      // 1. Create utility data entry
      const { data: entry, error: insertError } = await supabase
        .from('utility_data_entries')
        .insert({
          facility_id: facilityId,
          utility_type: config.utilityType,
          quantity: parseFloat(quantity),
          unit: unit,
          data_quality: 'actual',
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // 2. Mark only the selected Xero transactions as upgraded + linked
      if (linkedTxIds.length > 0) {
        const { error: updateError } = await supabase
          .from('xero_transactions')
          .update({
            upgrade_status: 'upgraded',
            data_quality_tier: 2,
            upgraded_entry_id: entry.id,
            upgraded_entry_table: 'utility_data_entries',
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
        entryTable: 'utility_data_entries',
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

  const categoryLabels: Record<string, string> = {
    grid_electricity: 'Electricity',
    natural_gas: 'Natural Gas',
    diesel_stationary: 'Diesel (Stationary)',
    diesel_mobile: 'Diesel (Fleet)',
    petrol_mobile: 'Petrol (Fleet)',
    lpg: 'LPG',
    water: 'Water',
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
            Upgrade: {categoryLabels[category] || category}
          </CardTitle>
          <CardDescription>
            We found {formattedSpend} in spend for this category.
            Enter your actual consumption data for a more accurate calculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Facility selector */}
          <div className="space-y-2">
            <Label>Facility</Label>
            {facilities.length === 0 ? (
              <p className="text-sm text-red-500">
                No facilities found. Please add a facility in your organisation settings first.
              </p>
            ) : (
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select facility..." />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity + unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{config.label}</Label>
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
              {config.altUnit ? (
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={config.unit}>{config.unit}</SelectItem>
                    <SelectItem value={config.altUnit}>{config.altUnit}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={config.unit} disabled />
              )}
            </div>
          </div>

          {/* Reporting period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Period end</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Transactions this entry covers */}
          {currentOrganization && (
            <div className="space-y-2">
              <Label>Xero transactions this entry covers</Label>
              <p className="text-xs text-muted-foreground">
                Only the transactions you select will be marked as upgraded. Enter a period above and the matching months are pre-selected.
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

          {/* Before/After comparison */}
          {quantityNum > 0 && (
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Spend-based estimate</p>
                    <p className="text-lg font-semibold text-amber-600">
                      {spendEmissions >= 1000
                        ? `${(spendEmissions / 1000).toFixed(2)} tCO2e`
                        : `${Math.round(spendEmissions)} kg CO2e`}
                    </p>
                    <p className="text-xs text-muted-foreground">Tier 4 (lowest quality, ~70% uncertainty)</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Activity-based calculation</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      {activityEmissions >= 1000
                        ? `${(activityEmissions / 1000).toFixed(2)} tCO2e`
                        : `${Math.round(activityEmissions)} kg CO2e`}
                    </p>
                    <p className="text-xs text-muted-foreground">Tier 2 (high quality, ~15% uncertainty)</p>
                  </div>
                </div>
                {activityEmissions > 0 && spendEmissions > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Uncertainty reduced from ~70% to ~15% with activity-based data
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
              disabled={isSaving || !facilityId || !quantity || !periodStart || !periodEnd}
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
