'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { AnnualProductionBucket } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, TrendingDown, Loader2 } from 'lucide-react'
import { getBenchmarkForCategory } from '@/lib/industry-benchmarks'
import { cn } from '@/lib/utils'

const BEVERAGE_TO_CATEGORY: Record<string, string> = {
  beer: 'Lager',
  cider: 'Cider',
  spirits: 'Gin',
  wine: 'Red Wine',
  rtd: 'Hard Seltzer',
  non_alcoholic: 'Still Soft Drink',
  other: 'Lager',
}

const BEVERAGE_LABELS: Record<string, string> = {
  beer: 'Beer',
  cider: 'Cider',
  spirits: 'Spirits',
  wine: 'Wine',
  rtd: 'RTD',
  non_alcoholic: 'Non-Alcoholic',
  other: 'Drinks',
}

// Fallback bucket selector when no products were imported
const VOLUME_OPTIONS: { value: AnnualProductionBucket; label: string; sublabel: string }[] = [
  { value: '<10k',     label: 'Under 10,000 L',    sublabel: 'Micro / craft' },
  { value: '10k-100k', label: '10,000–100,000 L',  sublabel: 'Small producer' },
  { value: '100k-1M',  label: '100,000 L–1M L',    sublabel: 'Regional brand' },
  { value: '1M+',      label: 'Over 1 million L',  sublabel: 'Large producer' },
]

const VOLUME_MIDPOINTS: Record<AnnualProductionBucket, number> = {
  '<10k': 5000,
  '10k-100k': 50000,
  '100k-1M': 500000,
  '1M+': 2000000,
}

type ProductionUnit = 'Units' | 'Litres' | 'Hectolitres'

interface OrgProduct {
  id: string
  name: string
  product_category: string | null
  unit_size_value: number | null
  unit_size_unit: string | null
}

interface ProductVolume {
  volume: string
  unit: ProductionUnit
}

const SCOPE_ROWS = [
  { label: 'Scope 3: ingredients and raw materials', pct: 57, color: 'bg-[#ccff00]' },
  { label: 'Scope 1+2: energy and operations', pct: 18, color: 'bg-blue-400' },
  { label: 'Scope 3: packaging', pct: 25, color: 'bg-orange-400' },
]

/** Convert a product's unit_size to litres */
function unitSizeToLitres(value: number | null, unit: string | null): number {
  if (!value) return 0
  switch (unit) {
    case 'ml': return value / 1000
    case 'cl': return value / 100
    case 'l':  return value
    default:   return value / 1000 // assume ml if unknown
  }
}

/** Convert a volume entry to litres, given the product's unit size */
function volumeToLitres(volume: number, unit: ProductionUnit, product: OrgProduct): number {
  switch (unit) {
    case 'Litres':      return volume
    case 'Hectolitres': return volume * 100
    case 'Units': {
      const litresPerUnit = unitSizeToLitres(product.unit_size_value, product.unit_size_unit)
      return litresPerUnit > 0 ? volume * litresPerUnit : volume // fallback: treat as litres
    }
  }
}

export function FastTrackEstimateStep() {
  const { completeStep, state, updatePersonalization } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const beverageType = state.personalization?.beverageTypes?.[0] ?? null
  const beverageLabel = beverageType ? BEVERAGE_LABELS[beverageType] ?? 'Drinks' : 'Drinks'

  const [products, setProducts] = useState<OrgProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Per-product volume inputs (keyed by product id)
  const [productVolumes, setProductVolumes] = useState<Record<string, ProductVolume>>({})

  // Fallback bucket (used when no products)
  const [volumeBucket, setVolumeBucket] = useState<AnnualProductionBucket>(
    state.personalization?.annualProductionBucket ?? '<10k'
  )

  useEffect(() => {
    if (!currentOrganization) return
    ;(async () => {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('products')
        .select('id, name, product_category, unit_size_value, unit_size_unit')
        .eq('organization_id', currentOrganization.id)
        .eq('is_draft', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })

      const fetched = data ?? []
      setProducts(fetched)

      // Initialise volume state — default to 'Units' if product has a unit size, else 'Litres'
      const initial: Record<string, ProductVolume> = {}
      for (const p of fetched) {
        initial[p.id] = {
          volume: '',
          unit: p.unit_size_value ? 'Units' : 'Litres',
        }
      }
      setProductVolumes(initial)
      setIsLoading(false)
    })()
  }, [currentOrganization])

  const hasProducts = products.length > 0

  // Total litres across all products with a valid volume entered
  const totalLitres = useMemo(() => {
    if (!hasProducts) return VOLUME_MIDPOINTS[volumeBucket]
    let total = 0
    for (const product of products) {
      const entry = productVolumes[product.id]
      if (!entry) continue
      const v = parseFloat(entry.volume)
      if (!isNaN(v) && v > 0) {
        total += volumeToLitres(v, entry.unit, product)
      }
    }
    // If nothing entered yet, use a sensible default so the estimate shows something
    return total > 0 ? total : VOLUME_MIDPOINTS['<10k']
  }, [hasProducts, products, productVolumes, volumeBucket])

  const anyVolumeEntered = useMemo(() => {
    if (!hasProducts) return true
    return products.some(p => {
      const v = parseFloat(productVolumes[p.id]?.volume ?? '')
      return !isNaN(v) && v > 0
    })
  }, [hasProducts, products, productVolumes])

  // Blended base benchmark across unique product categories (or drink-type fallback)
  const baseBenchmark = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(products.map(p => p.product_category).filter(Boolean))
    ) as string[]
    return uniqueCategories.length > 0
      ? uniqueCategories.reduce((sum, cat) => sum + getBenchmarkForCategory(cat).kgCO2ePerLitre, 0) / uniqueCategories.length
      : getBenchmarkForCategory(beverageType ? BEVERAGE_TO_CATEGORY[beverageType] : null).kgCO2ePerLitre
  }, [products, beverageType])

  const industryBenchmark = getBenchmarkForCategory(beverageType ? BEVERAGE_TO_CATEGORY[beverageType] : null)

  const estimateTonnes = (baseBenchmark * totalLitres) / 1000
  const industryTonnes = (industryBenchmark.kgCO2ePerLitre * totalLitres) / 1000
  const displayTonnes = Math.round(estimateTonnes)
  const low = Math.round(estimateTonnes * 0.7)
  const high = Math.round(estimateTonnes * 1.3)

  const setVolume = (productId: string, field: Partial<ProductVolume>) => {
    setProductVolumes(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...field },
    }))
  }

  const handleContinue = async () => {
    setIsSaving(true)

    // Save per-product volumes to the products table
    if (hasProducts) {
      for (const product of products) {
        const entry = productVolumes[product.id]
        const v = parseFloat(entry?.volume ?? '')
        if (!isNaN(v) && v > 0) {
          await supabase
            .from('products')
            .update({
              annual_production_volume: v,
              annual_production_unit: entry.unit,
            })
            .eq('id', product.id)
        }
      }
    } else {
      updatePersonalization({ annualProductionBucket: volumeBucket })
    }

    setIsSaving(false)
    completeStep()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🌍</div>
          <h3 className="text-2xl font-serif font-bold text-white">Your estimated footprint</h3>
          <p className="text-sm text-white/50">
            {hasProducts
              ? 'Tell us how much you produce each year and we\'ll calculate your estimate.'
              : `Based on industry averages for ${beverageLabel.toLowerCase()} producers.`}
          </p>
        </div>

        {/* Per-product volume inputs */}
        {!isLoading && hasProducts && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/70">Annual production per product</p>
            <div className="space-y-2">
              {products.map(product => {
                const entry = productVolumes[product.id] ?? { volume: '', unit: 'Litres' as ProductionUnit }
                const canUseUnits = !!product.unit_size_value
                return (
                  <div key={product.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium text-white/70 truncate">{product.name}</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={entry.volume}
                        onChange={e => setVolume(product.id, { volume: e.target.value })}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50 flex-1 min-w-0"
                      />
                      <Select
                        value={entry.unit}
                        onValueChange={val => setVolume(product.id, { unit: val as ProductionUnit })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white w-36 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {canUseUnits && <SelectItem value="Units">Units</SelectItem>}
                          <SelectItem value="Litres">Litres</SelectItem>
                          <SelectItem value="Hectolitres">Hectolitres</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {entry.unit === 'Units' && canUseUnits && (
                      <p className="text-xs text-white/30">
                        {product.unit_size_value}{product.unit_size_unit} per unit
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Fallback bucket selector when no products */}
        {!isLoading && !hasProducts && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/70">Annual production volume</p>
            <div className="grid grid-cols-2 gap-2">
              {VOLUME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVolumeBucket(opt.value)}
                  className={cn(
                    'flex flex-col gap-0.5 p-3 rounded-xl border text-left transition-all',
                    volumeBucket === opt.value
                      ? 'bg-[#ccff00]/15 border-[#ccff00]/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  )}
                >
                  <span className={cn('text-xs font-semibold', volumeBucket === opt.value ? 'text-[#ccff00]' : 'text-white')}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-white/40">{opt.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main estimate */}
        <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-2xl p-6 text-center space-y-1">
          {isLoading ? (
            <div className="h-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#ccff00]/30 border-t-[#ccff00] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-5xl font-bold text-[#ccff00]">
                ~{displayTonnes > 0 ? displayTonnes.toLocaleString() : '<1'}
              </p>
              <p className="text-sm text-white/60">tonnes CO&#8322;e / year</p>
              <p className="text-xs text-white/30 mt-2">
                Likely range: {low.toLocaleString()} &ndash; {high.toLocaleString()} t CO&#8322;e (&plusmn;30%)
              </p>
            </>
          )}
        </div>

        {/* Scope breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wide">Typical emissions breakdown</p>
          {SCOPE_ROWS.map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">{row.label}</span>
                <span className="text-white font-medium">{row.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', row.color)} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Industry comparison */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3">
          <TrendingDown className="w-5 h-5 text-white/40 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-white">
              Typical {beverageLabel.toLowerCase()} brand your size:{' '}
              <span className="font-semibold text-white">~{Math.round(industryTonnes).toLocaleString()} t CO&#8322;e</span>
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Industry average: {industryBenchmark.kgCO2ePerLitre} kg CO&#8322;e/L ({industryBenchmark.sourceName}, {industryBenchmark.sourceYear})
            </p>
          </div>
        </div>

        <Button
          onClick={handleContinue}
          disabled={isSaving}
          className="w-full bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <>See how to improve this <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

        {hasProducts && !anyVolumeEntered && (
          <p className="text-xs text-center text-white/30">
            Enter at least one volume above for a more accurate estimate, or continue to use an industry average.
          </p>
        )}

      </div>
    </div>
  )
}
