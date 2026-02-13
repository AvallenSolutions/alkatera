'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Lock,
  Sparkles,
  ArrowRight,
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Package,
  Loader2,
  BarChart3,
  ArrowUpDown,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types mirroring the API response shapes
// ---------------------------------------------------------------------------

interface PackagingItemFee {
  product_material_id: number
  material_name: string
  material_code: string
  weight_per_unit_kg: number
  units_produced: number
  total_weight_kg: number
  ram_rating: 'red' | 'amber' | 'green' | null
  fee_rate_per_tonne: number
  fee_gbp: number
  is_drs_excluded: boolean
}

interface ProductFeeBreakdown {
  product_id: number
  product_name: string
  packaging_items: PackagingItemFee[]
  total_fee_gbp: number
  total_weight_kg: number
}

interface MaterialFeeBreakdown {
  material_code: string
  material_name: string
  weight_kg: number
  fee_rate_per_tonne: number
  fee_gbp: number
  drs_excluded_weight_kg: number
}

interface FeeCalculationResult {
  total_fee_gbp: number
  total_weight_kg: number
  total_drs_excluded_weight_kg: number
  by_material: MaterialFeeBreakdown[]
  by_product: ProductFeeBreakdown[]
}

interface FeeRate {
  fee_year: string
  material_code: string
  material_name: string
  flat_rate_per_tonne: number | null
  green_rate_per_tonne: number | null
  amber_rate_per_tonne: number | null
  red_rate_per_tonne: number | null
  is_modulated: boolean
}

interface YearData {
  calculation: FeeCalculationResult
  fee_year: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEE_YEARS = [
  { id: '2025-26', label: '2025/26 (Flat)', isModulated: false },
  { id: '2026-27', label: '2026/27 (Modulated)', isModulated: true },
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGBP(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatWeight(kg: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kg)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n)
}

function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function ramBadgeClasses(rating: string | null): string {
  switch (rating) {
    case 'green':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'amber':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'red':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EPRCostEstimatorPage() {
  const { currentOrganization } = useOrganization()
  const { tierLevel, isLoading: tierLoading } = useSubscription()

  // Data state — cache both years
  const [yearDataCache, setYearDataCache] = useState<Record<string, YearData>>({})
  const [feeRatesCache, setFeeRatesCache] = useState<Record<string, FeeRate[]>>({})
  const [activeYear, setActiveYear] = useState<string>('2025-26')
  const [loading, setLoading] = useState(false)
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesOpen, setRatesOpen] = useState(false)

  // Derived state
  const currentData = yearDataCache[activeYear] ?? null
  const currentRates = feeRatesCache[activeYear] ?? null
  const activeYearDef = FEE_YEARS.find((y) => y.id === activeYear)!
  const otherYearId = activeYear === '2025-26' ? '2026-27' : '2025-26'
  const otherData = yearDataCache[otherYearId] ?? null
  const hasBothYears = !!yearDataCache['2025-26'] && !!yearDataCache['2026-27']

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchCalculation = useCallback(
    async (feeYear: string) => {
      if (!currentOrganization?.id) return
      if (yearDataCache[feeYear]) return // already cached

      setLoading(true)
      try {
        const res = await fetch('/api/epr/calculate-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            fee_year: feeYear,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to calculate fees')
        }

        const data: YearData = await res.json()
        setYearDataCache((prev) => ({ ...prev, [feeYear]: data }))
      } catch (err) {
        console.error('EPR calculate-fees error:', err)
        toast.error(
          err instanceof Error ? err.message : 'Failed to calculate fees'
        )
      } finally {
        setLoading(false)
      }
    },
    [currentOrganization?.id, yearDataCache]
  )

  const fetchFeeRates = useCallback(
    async (feeYear: string) => {
      if (feeRatesCache[feeYear]) return

      setRatesLoading(true)
      try {
        const res = await fetch(
          `/api/epr/fee-rates?feeYear=${encodeURIComponent(feeYear)}`
        )
        if (!res.ok) {
          throw new Error('Failed to fetch fee rates')
        }
        const data = await res.json()
        setFeeRatesCache((prev) => ({ ...prev, [feeYear]: data.fee_rates }))
      } catch (err) {
        console.error('EPR fee-rates error:', err)
        toast.error('Failed to load fee rates')
      } finally {
        setRatesLoading(false)
      }
    },
    [feeRatesCache]
  )

  // Fetch on mount + year change
  useEffect(() => {
    if (tierLevel >= 3 && currentOrganization?.id) {
      fetchCalculation(activeYear)
    }
  }, [activeYear, tierLevel, currentOrganization?.id, fetchCalculation])

  // Eagerly fetch the other year in the background
  useEffect(() => {
    if (tierLevel >= 3 && currentOrganization?.id && currentData) {
      fetchCalculation(otherYearId)
    }
  }, [tierLevel, currentOrganization?.id, currentData, otherYearId, fetchCalculation])

  // Fetch fee rates when collapsible opened
  useEffect(() => {
    if (ratesOpen && tierLevel >= 3) {
      fetchFeeRates(activeYear)
    }
  }, [ratesOpen, activeYear, tierLevel, fetchFeeRates])

  // Year-on-year change
  const yoyChange = useMemo(() => {
    if (!hasBothYears) return null
    const prev = yearDataCache['2025-26']!.calculation.total_fee_gbp
    const curr = yearDataCache['2026-27']!.calculation.total_fee_gbp
    return pctChange(prev, curr)
  }, [hasBothYears, yearDataCache])

  // -------------------------------------------------------------------------
  // Tier gate
  // -------------------------------------------------------------------------

  if (tierLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (tierLevel < 3) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16 max-w-lg mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 border border-border mb-4">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">EPR Cost Estimator</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          The Cost Estimator tool is available on the <span className="font-medium text-foreground">Canopy</span> plan.
          Upgrade to estimate your Extended Producer Responsibility waste management fees,
          compare flat and modulated years, and plan your packaging strategy.
        </p>
        <Link href="/settings/">
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Canopy
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cost Estimator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estimate your EPR waste management fees
        </p>
      </div>

      {/* Year selector */}
      <Tabs
        value={activeYear}
        onValueChange={(val) => setActiveYear(val)}
        className="w-full"
      >
        <TabsList>
          {FEE_YEARS.map((y) => (
            <TabsTrigger key={y.id} value={y.id}>
              {y.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {FEE_YEARS.map((y) => (
          <TabsContent key={y.id} value={y.id} className="space-y-6 mt-4">
            {/* Total Cost Banner */}
            <TotalCostBanner
              data={currentData}
              loading={loading}
              yearLabel={y.label}
              isModulated={y.isModulated}
              yoyChange={y.isModulated ? yoyChange : null}
            />

            {/* Product-level breakdown */}
            <ProductBreakdownTable
              data={currentData}
              loading={loading}
            />

            {/* Material Cost Summary */}
            <MaterialCostSummary
              data={currentData}
              loading={loading}
            />

            {/* Scenario Comparison */}
            {hasBothYears && (
              <ScenarioComparison
                year1={yearDataCache['2025-26']!}
                year2={yearDataCache['2026-27']!}
              />
            )}

            {/* Fee Rate Reference (collapsible) */}
            <FeeRateReference
              rates={currentRates}
              loading={ratesLoading}
              open={ratesOpen}
              onOpenChange={setRatesOpen}
              yearLabel={y.label}
              isModulated={y.isModulated}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

// ---------------------------------------------------------------------------
// Total Cost Banner
// ---------------------------------------------------------------------------

function TotalCostBanner({
  data,
  loading,
  yearLabel,
  isModulated,
  yoyChange,
}: {
  data: YearData | null
  loading: boolean
  yearLabel: string
  isModulated: boolean
  yoyChange: number | null
}) {
  if (loading || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Calculating fees...
                </span>
              </>
            ) : (
              <div className="space-y-2 w-full max-w-md">
                <Skeleton className="h-10 w-48 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = data.calculation.total_fee_gbp

  return (
    <Card className="border-[#ccff00]/20">
      <CardContent className="py-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">{yearLabel}</p>
          <p className="text-4xl font-bold tracking-tight">{formatGBP(total)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Total estimated EPR fee &middot;{' '}
            {formatWeight(data.calculation.total_weight_kg)} kg total packaging
          </p>
          {isModulated && yoyChange !== null && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {yoyChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-400" />
              ) : yoyChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-400" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={`text-sm font-medium ${
                  yoyChange > 0
                    ? 'text-red-400'
                    : yoyChange < 0
                    ? 'text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              >
                {yoyChange > 0 ? '+' : ''}
                {yoyChange.toFixed(1)}% vs 2025/26
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Product Breakdown Table
// ---------------------------------------------------------------------------

function ProductBreakdownTable({
  data,
  loading,
}: {
  data: YearData | null
  loading: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Breakdown</CardTitle>
          <CardDescription>Fee breakdown by product and packaging material</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.calculation.by_product.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Breakdown</CardTitle>
          <CardDescription>Fee breakdown by product and packaging material</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No packaging data found. Add packaging materials to your products to estimate fees.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Product Breakdown</CardTitle>
        <CardDescription>Fee breakdown by product and packaging material</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Weight/Unit (g)</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Total Weight (kg)</TableHead>
              <TableHead className="text-center">RAM Rating</TableHead>
              <TableHead className="text-right">Fee Rate (&pound;/t)</TableHead>
              <TableHead className="text-right">Estimated Fee</TableHead>
              <TableHead className="text-center">DRS Excluded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.calculation.by_product.map((product) =>
              product.packaging_items.map((item, itemIdx) => (
                <TableRow key={`${product.product_id}-${item.product_material_id}`}>
                  {/* Show product name only on the first row per product */}
                  {itemIdx === 0 ? (
                    <TableCell
                      className="font-medium align-top"
                      rowSpan={product.packaging_items.length}
                    >
                      {product.product_name}
                    </TableCell>
                  ) : null}
                  <TableCell>{item.material_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(Math.round(item.weight_per_unit_kg * 1000))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.units_produced)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWeight(item.total_weight_kg)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.ram_rating ? (
                      <Badge
                        variant="outline"
                        className={`capitalize ${ramBadgeClasses(item.ram_rating)}`}
                      >
                        {item.ram_rating}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGBP(item.fee_rate_per_tonne)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatGBP(item.fee_gbp)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.is_drs_excluded ? (
                      <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Material Cost Summary
// ---------------------------------------------------------------------------

function MaterialCostSummary({
  data,
  loading,
}: {
  data: YearData | null
  loading: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Material Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.calculation.by_material.length === 0) {
    return null
  }

  const totalFee = data.calculation.total_fee_gbp
  const materials = data.calculation.by_material.sort((a, b) => b.fee_gbp - a.fee_gbp)
  const maxFee = materials[0]?.fee_gbp || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Material Cost Summary</CardTitle>
        <CardDescription>Contribution of each material to your total fee</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {materials.map((mat) => {
            const pct = totalFee > 0 ? (mat.fee_gbp / totalFee) * 100 : 0
            const barWidth = maxFee > 0 ? (mat.fee_gbp / maxFee) * 100 : 0

            return (
              <div key={mat.material_code} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{mat.material_name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatWeight(mat.weight_kg)} kg</span>
                    <span className="font-medium text-foreground">
                      {formatGBP(mat.fee_gbp)}
                    </span>
                    <span className="text-xs w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: '#ccff00',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Scenario Comparison
// ---------------------------------------------------------------------------

function ScenarioComparison({
  year1,
  year2,
}: {
  year1: YearData
  year2: YearData
}) {
  const totalChange = pctChange(
    year1.calculation.total_fee_gbp,
    year2.calculation.total_fee_gbp
  )

  // Build a merged material comparison
  const allMaterialCodes = new Set<string>()
  year1.calculation.by_material.forEach((m) => allMaterialCodes.add(m.material_code))
  year2.calculation.by_material.forEach((m) => allMaterialCodes.add(m.material_code))

  const materialComparisons = Array.from(allMaterialCodes).map((code) => {
    const m1 = year1.calculation.by_material.find((m) => m.material_code === code)
    const m2 = year2.calculation.by_material.find((m) => m.material_code === code)
    return {
      code,
      name: m1?.material_name || m2?.material_name || code,
      fee1: m1?.fee_gbp ?? 0,
      fee2: m2?.fee_gbp ?? 0,
      weight1: m1?.weight_kg ?? 0,
      weight2: m2?.weight_kg ?? 0,
      change: pctChange(m1?.fee_gbp ?? 0, m2?.fee_gbp ?? 0),
    }
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Scenario Comparison</CardTitle>
            <CardDescription>
              Side-by-side comparison of 2025/26 (flat) vs 2026/27 (modulated)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">2025/26 (Flat)</p>
            <p className="text-xl font-bold tabular-nums">
              {formatGBP(year1.calculation.total_fee_gbp)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">2026/27 (Modulated)</p>
            <p className="text-xl font-bold tabular-nums">
              {formatGBP(year2.calculation.total_fee_gbp)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center flex flex-col items-center justify-center">
            <p className="text-xs text-muted-foreground mb-1">Change</p>
            {totalChange !== null ? (
              <div className="flex items-center gap-1.5">
                {totalChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-red-400" />
                ) : totalChange < 0 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={`text-xl font-bold ${
                    totalChange > 0
                      ? 'text-red-400'
                      : totalChange < 0
                      ? 'text-emerald-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {totalChange > 0 ? '+' : ''}
                  {totalChange.toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
        </div>

        {/* Per-material comparison */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">2025/26 Fee</TableHead>
                <TableHead className="text-right">2026/27 Fee</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialComparisons.map((mc) => (
                <TableRow key={mc.code}>
                  <TableCell className="font-medium">{mc.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGBP(mc.fee1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGBP(mc.fee2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {mc.change !== null ? (
                      <span
                        className={`text-sm font-medium ${
                          mc.change > 0
                            ? 'text-red-400'
                            : mc.change < 0
                            ? 'text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {mc.change > 0 ? '+' : ''}
                        {mc.change.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Fee Rate Reference (collapsible)
// ---------------------------------------------------------------------------

function FeeRateReference({
  rates,
  loading,
  open,
  onOpenChange,
  yearLabel,
  isModulated,
}: {
  rates: FeeRate[] | null
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  yearLabel: string
  isModulated: boolean
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Fee Rate Reference</CardTitle>
              </div>
              {open ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Official fee rates for {yearLabel}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !rates || rates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fee rates available for this year.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">
                        Flat Rate (&pound;/t)
                      </TableHead>
                      {isModulated && (
                        <>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                              Green (&pound;/t)
                            </span>
                          </TableHead>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                              Amber (&pound;/t)
                            </span>
                          </TableHead>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                              Red (&pound;/t)
                            </span>
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate.material_code}>
                        <TableCell className="font-medium">
                          {rate.material_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {rate.flat_rate_per_tonne != null
                            ? formatGBP(rate.flat_rate_per_tonne)
                            : '--'}
                        </TableCell>
                        {isModulated && (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {rate.green_rate_per_tonne != null
                                ? formatGBP(rate.green_rate_per_tonne)
                                : '--'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rate.amber_rate_per_tonne != null
                                ? formatGBP(rate.amber_rate_per_tonne)
                                : '--'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rate.red_rate_per_tonne != null
                                ? formatGBP(rate.red_rate_per_tonne)
                                : '--'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
