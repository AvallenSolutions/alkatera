'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown, Plane, Train } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import {
  calculateDistance,
  extractCityName,
  extractAirportCode,
  type Location,
} from '@/lib/services/geocoding-service'
import {
  fetchTravelEmissionFactors,
  findFlightFactor,
  findRailFactor,
  calculateFlightCO2e,
  calculateRailCO2e,
  detectTravelClass,
  CABIN_CLASS_OPTIONS,
  type EmissionFactor,
  type TravelClass,
  type CabinClass,
} from '@/lib/xero/travel-emissions'
import {
  type XeroTransactionRow,
  type XeroTransactionView,
  toTransactionView,
  XERO_TX_SELECT_COLUMNS,
} from '@/lib/xero/types'
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper'

interface TravelUpgradeFormProps {
  category: 'air_travel' | 'rail_travel'
  onComplete: () => void
  onCancel: () => void
}

export function TravelUpgradeForm({ category, onComplete, onCancel }: TravelUpgradeFormProps) {
  const { currentOrganization } = useOrganization()
  const isFlightMode = category === 'air_travel'

  // Transaction data
  const [transactions, setTransactions] = useState<XeroTransactionView[]>([])
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Emission factors
  const [emissionFactors, setEmissionFactors] = useState<EmissionFactor[]>([])

  // Entry mode
  const [entryMode, setEntryMode] = useState<'summary' | 'individual'>('summary')

  // Form fields
  const [originLocation, setOriginLocation] = useState<Location | null>(null)
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null)
  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [distance, setDistance] = useState('')
  const [travelClass, setTravelClass] = useState<TravelClass>('Short-haul')
  const [cabinClass, setCabinClass] = useState<CabinClass>('Economy')
  const [passengers, setPassengers] = useState('1')
  const [isReturn, setIsReturn] = useState(false)
  const [useManualDistance, setUseManualDistance] = useState(!isFlightMode)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Save state
  const [isSaving, setIsSaving] = useState(false)

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      // Fetch pending transactions for this category
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
      }

      // Fetch emission factors
      const factors = await fetchTravelEmissionFactors()
      setEmissionFactors(factors)

      // Pre-fill from extracted metadata (use first transaction with airport codes)
      if (isFlightMode && txData) {
        const rows = txData as unknown as XeroTransactionRow[]
        const txWithAirports = rows.find(
          t => t.extracted_metadata && (t.extracted_metadata as Record<string, unknown>).airportCodes
        )
        if (txWithAirports?.extracted_metadata) {
          const meta = txWithAirports.extracted_metadata as Record<string, unknown>
          const codes = meta.airportCodes as [string, string] | undefined
          if (codes) {
            // Set as text - user can refine via LocationAutocomplete
            setOriginText(codes[0])
            setDestinationText(codes[1])
            setDescription(`${codes[0]} to ${codes[1]}`)
            // Switch to manual distance mode since we only have codes, not coordinates
            setUseManualDistance(true)
          }
        }
      }

      setIsLoading(false)
    }

    loadData()
  }, [currentOrganization?.id, category])

  // Auto-calculate distance when both locations selected (flights)
  useEffect(() => {
    if (originLocation && destinationLocation && !useManualDistance) {
      try {
        const dist = calculateDistance(
          { lat: originLocation.lat, lon: originLocation.lon },
          { lat: destinationLocation.lat, lon: destinationLocation.lon }
        )
        setDistance(dist.toString())

        // Auto-detect travel class from distance
        setTravelClass(detectTravelClass(dist))

        // Auto-fill description
        const fromCity = extractCityName(originLocation.displayName)
        const toCity = extractCityName(destinationLocation.displayName)
        const fromCode = extractAirportCode(originLocation.displayName)
        const toCode = extractAirportCode(destinationLocation.displayName)
        if (fromCode && toCode) {
          setDescription(`${fromCity} (${fromCode}) to ${toCity} (${toCode})`)
        } else {
          setDescription(`${fromCity} to ${toCity}`)
        }
      } catch (error) {
        console.error('Error calculating distance:', error)
      }
    }
  }, [originLocation, destinationLocation, useManualDistance])

  // Calculate activity-based emissions
  const distanceNum = parseFloat(distance) || 0
  const passengerNum = parseInt(passengers) || 1

  let activityEmissions = 0
  let matchedFactor: EmissionFactor | undefined

  if (isFlightMode) {
    matchedFactor = findFlightFactor(emissionFactors, travelClass, cabinClass)
    if (matchedFactor && distanceNum > 0) {
      activityEmissions = calculateFlightCO2e(matchedFactor, distanceNum, passengerNum, isReturn)
    }
  } else {
    matchedFactor = findRailFactor(emissionFactors)
    if (matchedFactor && distanceNum > 0) {
      activityEmissions = calculateRailCO2e(matchedFactor, distanceNum, passengerNum, isReturn)
    }
  }

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

    if (distanceNum <= 0) {
      toast.error('Please enter a valid distance')
      return
    }

    if (isFlightMode && !matchedFactor) {
      toast.error('Could not find emission factor for this flight configuration')
      return
    }

    if (!isFlightMode && !matchedFactor) {
      toast.error('Could not find rail emission factor')
      return
    }

    setIsSaving(true)
    try {
      const transactionIds = transactions.map(t => t.id)
      const transactionDates = transactions.map(t => t.date)
      const reportYear = deriveReportingYear(date, transactionDates)
      const reportId = await getOrCreateCorporateReport(supabase, currentOrganization.id, reportYear)

      // Build corporate_overheads entry
      const entry: Record<string, unknown> = {
        report_id: reportId,
        category: 'business_travel',
        description: description || `${isFlightMode ? 'Flight' : 'Rail'}: ${transactions.length} transactions from Xero`,
        transport_mode: isFlightMode ? travelClass : 'National',
        distance_km: distanceNum,
        passenger_count: passengerNum,
        is_return_trip: isReturn,
        entry_date: date,
        emission_factor: matchedFactor!.value,
        computed_co2e: activityEmissions,
        spend_amount: spendTotal,
        currency: 'GBP',
        data_source: 'xero_upgrade',
        source_xero_transaction_ids: transactionIds,
      }

      // Add flight-specific fields
      if (isFlightMode) {
        entry.cabin_class = cabinClass
        if (originLocation) {
          entry.origin_location = originLocation.displayName
          entry.origin_coordinates = { lat: originLocation.lat, lng: originLocation.lon }
        }
        if (destinationLocation) {
          entry.destination_location = destinationLocation.displayName
          entry.destination_coordinates = { lat: destinationLocation.lat, lng: destinationLocation.lon }
        }
        entry.calculated_distance_km = originLocation && destinationLocation ? distanceNum : null
        entry.distance_source = useManualDistance ? 'manual' : 'auto'
      } else {
        // Rail
        if (originText) entry.origin_location = originText
        if (destinationText) entry.destination_location = destinationText
        entry.distance_source = 'manual'
      }

      const { data: newEntry, error: insertError } = await supabase
        .from('corporate_overheads')
        .insert(entry)
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
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')

      if (updateError) throw updateError

      toast.success(`${isFlightMode ? 'Flight' : 'Rail'} data upgraded successfully`)
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

  const Icon = isFlightMode ? Plane : Train

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
            Upgrade: {isFlightMode ? 'Air Travel' : 'Rail Travel'}
          </CardTitle>
          <CardDescription>
            We found {formattedSpend} in {isFlightMode ? 'airline' : 'rail'} spend across {transactions.length} transactions.
            Add your {isFlightMode ? 'flight' : 'journey'} details for a more accurate calculation.
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
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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

          {/* Entry mode */}
          {transactions.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Entry mode:</Label>
              <div className="flex gap-1">
                <Button
                  variant={entryMode === 'summary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('summary')}
                >
                  Summary
                </Button>
                <Button
                  variant={entryMode === 'individual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('individual')}
                  disabled
                >
                  Individual
                  <Badge variant="outline" className="ml-1 text-xs">Soon</Badge>
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Provide one set of typical details covering all {transactions.length} transactions
              </span>
            </div>
          )}

          {/* Origin / Destination */}
          {isFlightMode && !useManualDistance ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From (airport or city)</Label>
                  <LocationAutocomplete
                    value={originLocation}
                    onSelect={setOriginLocation}
                    placeholder="Search origin..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>To (airport or city)</Label>
                  <LocationAutocomplete
                    value={destinationLocation}
                    onSelect={setDestinationLocation}
                    placeholder="Search destination..."
                  />
                </div>
              </div>

              {originLocation && destinationLocation && distanceNum > 0 && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="text-sm font-medium text-green-900 dark:text-green-100">
                    📍 {extractCityName(originLocation.displayName)} → {extractCityName(destinationLocation.displayName)}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    ✈️ {Math.round(distanceNum)} km ({travelClass.toLowerCase()})
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUseManualDistance(true)}
                className="text-xs"
              >
                Enter distance manually instead
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isFlightMode ? 'From' : 'Origin station'}</Label>
                  <Input
                    placeholder={isFlightMode ? 'e.g. London Heathrow' : 'e.g. London King\'s Cross'}
                    value={originText}
                    onChange={e => setOriginText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isFlightMode ? 'To' : 'Destination station'}</Label>
                  <Input
                    placeholder={isFlightMode ? 'e.g. New York JFK' : 'e.g. Edinburgh Waverley'}
                    value={destinationText}
                    onChange={e => setDestinationText(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 650"
                  value={distance}
                  onChange={e => {
                    setDistance(e.target.value)
                    if (isFlightMode) {
                      const d = parseFloat(e.target.value) || 0
                      setTravelClass(detectTravelClass(d))
                    }
                  }}
                  min="0"
                  step="any"
                />
              </div>
              {isFlightMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseManualDistance(false)}
                  className="text-xs"
                >
                  Use location search instead
                </Button>
              )}
            </>
          )}

          {/* Flight-specific: travel class + cabin class */}
          {isFlightMode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Flight type</Label>
                  <Select value={travelClass} onValueChange={v => setTravelClass(v as TravelClass)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Domestic">Domestic (within UK)</SelectItem>
                      <SelectItem value="Short-haul">Short-haul International</SelectItem>
                      <SelectItem value="Long-haul">Long-haul International</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cabin class</Label>
                <RadioGroup value={cabinClass} onValueChange={v => setCabinClass(v as CabinClass)}>
                  {CABIN_CLASS_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`cabin-${option.value}`} />
                      <Label
                        htmlFor={`cabin-${option.value}`}
                        className="font-normal cursor-pointer flex items-center gap-2"
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">({option.description})</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </>
          )}

          {/* Rail: simpler date field */}
          {!isFlightMode && (
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          )}

          {/* Passengers + return trip */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Passengers</Label>
              <Input
                type="number"
                min="1"
                value={passengers}
                onChange={e => setPassengers(e.target.value)}
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="return-trip"
                  checked={isReturn}
                  onCheckedChange={checked => setIsReturn(checked as boolean)}
                />
                <Label htmlFor="return-trip" className="text-sm font-normal cursor-pointer">
                  Return trip (doubles the distance)
                </Label>
              </div>
            </div>
          </div>

          {/* Description */}
          {!description && (
            <div className="space-y-2">
              <Label>Trip description (optional)</Label>
              <Input
                placeholder={isFlightMode ? 'e.g. London to New York business trip' : 'e.g. London to Edinburgh meeting'}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          )}

          {/* Before/After comparison */}
          {distanceNum > 0 && activityEmissions > 0 && (
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

                {/* Cabin class comparison (flights only) */}
                {isFlightMode && distanceNum > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Compare cabin classes:</p>
                    <div className="space-y-1">
                      {CABIN_CLASS_OPTIONS.map(option => {
                        const f = findFlightFactor(emissionFactors, travelClass, option.value)
                        if (!f) return null
                        const emissions = calculateFlightCO2e(f, distanceNum, passengerNum, isReturn)
                        const isSelected = option.value === cabinClass
                        const diff = activityEmissions > 0 ? ((emissions - activityEmissions) / activityEmissions) * 100 : 0
                        return (
                          <div
                            key={option.value}
                            className={`text-xs flex justify-between ${
                              isSelected ? 'font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            <span>{option.icon} {option.label}:</span>
                            <span>
                              {formatEmissions(emissions)}
                              {!isSelected && diff !== 0 && (
                                <span className="ml-1">
                                  ({diff > 0 ? '+' : ''}{diff.toFixed(0)}%)
                                </span>
                              )}
                              {isSelected && <span className="ml-1">← Selected</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
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
              disabled={isSaving || distanceNum <= 0 || !matchedFactor}
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
