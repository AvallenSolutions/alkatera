'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/onboarding'
import type { AnnualProductionBucket } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, Sparkles } from 'lucide-react'
import { getBenchmarkForCategory } from '@/lib/industry-benchmarks'
import { cn } from '@/lib/utils'
import { BigNumber, Eyebrow, PillButton } from '@/components/studio'
import { RosaIntro } from './RosaIntro'

// Reuses the fast-track estimate step's calculation and save logic
// (products, volumes, benchmarks, per-product estimate PCFs) — see
// FastTrackEstimateStep.tsx, kept in step there for the older 8-step flow.
// This screen adds the peak-end close: once the estimate is saved, it
// flips to a "your forest has started" phase and finishes onboarding.

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

function unitSizeToLitres(value: number | null, unit: string | null): number {
  if (!value) return 0
  switch (unit) {
    case 'ml': return value / 1000
    case 'cl': return value / 100
    case 'l':  return value
    default:   return value / 1000
  }
}

function volumeToLitres(volume: number, unit: ProductionUnit, product: OrgProduct): number {
  switch (unit) {
    case 'Litres':      return volume
    case 'Hectolitres': return volume * 100
    case 'Units': {
      const litresPerUnit = unitSizeToLitres(product.unit_size_value, product.unit_size_unit)
      return litresPerUnit > 0 ? volume * litresPerUnit : volume
    }
  }
}

export function ArrivalEstimateStep() {
  const { completeStep, completeOnboarding, state, updatePersonalization } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const router = useRouter()

  const [phase, setPhase] = useState<'estimate' | 'forest'>('estimate')
  const [launching, setLaunching] = useState(false)
  const seedFiredRef = useRef(false)

  const beverageType = state.personalization?.beverageTypes?.[0] ?? null
  const beverageLabel = beverageType ? BEVERAGE_LABELS[beverageType] ?? 'Drinks' : 'Drinks'

  const [products, setProducts] = useState<OrgProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [productVolumes, setProductVolumes] = useState<Record<string, ProductVolume>>({})
  const [volumeBucket, setVolumeBucket] = useState<AnnualProductionBucket>(
    state.personalization?.annualProductionBucket ?? '<10k'
  )
  const [autofilledFromBreww, setAutofilledFromBreww] = useState<Set<string>>(new Set())

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

      const productIds = fetched.map(p => p.id)
      let brewwFill: Record<string, { volume: number; unit: ProductionUnit }> = {}
      const brewwAutofilled = new Set<string>()
      if (productIds.length > 0) {
        try {
          const { data: links } = await supabase
            .from('breww_product_links')
            .select('breww_sku_external_id, alkatera_product_id')
            .eq('organization_id', currentOrganization.id)
            .in('alkatera_product_id', productIds)
          const linkArr = (links ?? []) as Array<{ breww_sku_external_id: string; alkatera_product_id: string }>

          if (linkArr.length > 0) {
            const { data: skus } = await supabase
              .from('breww_products_skus')
              .select('external_id, primary_drink_external_id')
              .eq('organization_id', currentOrganization.id)
              .in('external_id', linkArr.map(l => l.breww_sku_external_id))
            const drinkBySku = new Map<string, string | null>(
              (skus ?? []).map((s: any) => [String(s.external_id), s.primary_drink_external_id ? String(s.primary_drink_external_id) : null]),
            )

            const since = new Date()
            since.setUTCMonth(since.getUTCMonth() - 12)
            const sinceDate = since.toISOString().slice(0, 10)
            const { data: runs } = await supabase
              .from('brewery_production_runs')
              .select('product_external_id, volume_hl, period_start')
              .eq('organization_id', currentOrganization.id)
              .eq('provider_slug', 'breww')
              .gte('period_start', sinceDate)
            const hlByDrink = new Map<string, number>()
            for (const r of (runs ?? []) as Array<{ product_external_id: string; volume_hl: number }>) {
              const cur = hlByDrink.get(String(r.product_external_id)) ?? 0
              hlByDrink.set(String(r.product_external_id), cur + (Number(r.volume_hl) || 0))
            }

            for (const link of linkArr) {
              const drinkId = drinkBySku.get(String(link.breww_sku_external_id))
              if (!drinkId) continue
              const hl = hlByDrink.get(drinkId)
              if (!hl || hl <= 0) continue
              brewwFill[link.alkatera_product_id] = { volume: hl, unit: 'Hectolitres' }
              brewwAutofilled.add(link.alkatera_product_id)
            }
          }
        } catch (err) {
          console.warn('[arrival-estimate] Breww autofill failed:', err)
        }
      }
      setAutofilledFromBreww(brewwAutofilled)

      const initial: Record<string, ProductVolume> = {}
      for (const p of fetched) {
        const breww = brewwFill[p.id]
        if (breww) {
          initial[p.id] = { volume: String(Math.round(breww.volume)), unit: breww.unit }
        } else {
          initial[p.id] = {
            volume: '',
            unit: p.unit_size_value ? 'Units' : 'Litres',
          }
        }
      }
      setProductVolumes(initial)
      setIsLoading(false)
    })()
  }, [currentOrganization])

  const hasProducts = products.length > 0

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
    return total > 0 ? total : VOLUME_MIDPOINTS['<10k']
  }, [hasProducts, products, productVolumes, volumeBucket])

  const anyVolumeEntered = useMemo(() => {
    if (!hasProducts) return true
    return products.some(p => {
      const v = parseFloat(productVolumes[p.id]?.volume ?? '')
      return !isNaN(v) && v > 0
    })
  }, [hasProducts, products, productVolumes])

  const baseBenchmark = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(products.map(p => p.product_category).filter(Boolean))
    ) as string[]
    return uniqueCategories.length > 0
      ? uniqueCategories.reduce((sum, cat) => sum + getBenchmarkForCategory(cat).kgCO2ePerLitre, 0) / uniqueCategories.length
      : getBenchmarkForCategory(beverageType ? BEVERAGE_TO_CATEGORY[beverageType] : null).kgCO2ePerLitre
  }, [products, beverageType])

  const estimateTonnes = (baseBenchmark * totalLitres) / 1000
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

    updatePersonalization({
      estimateTonnesCO2e: displayTonnes,
      ...(hasProducts ? {} : { annualProductionBucket: volumeBucket }),
    })

    if (hasProducts && currentOrganization) {
      const orgId = currentOrganization.id
      const referenceYear = new Date().getFullYear()
      const scopeSplit = { raw_materials: 0.57, processing: 0.18, packaging: 0.25 }

      for (const product of products) {
        const entry = productVolumes[product.id]
        const v = parseFloat(entry?.volume ?? '')
        if (isNaN(v) || v <= 0) continue

        const litres = volumeToLitres(v, entry.unit, product)
        const categoryBenchmark = getBenchmarkForCategory(product.product_category).kgCO2ePerLitre
        const totalKg = categoryBenchmark * litres
        const litresPerUnit = unitSizeToLitres(product.unit_size_value, product.unit_size_unit)
        const functionalUnit = litresPerUnit > 0
          ? `1 × ${product.unit_size_value}${product.unit_size_unit ?? ''} unit`
          : '1 litre'
        const totalPerUnit = litresPerUnit > 0 ? categoryBenchmark * litresPerUnit : categoryBenchmark

        await supabase
          .from('products')
          .update({ annual_production_volume: v, annual_production_unit: entry.unit })
          .eq('id', product.id)

        const { data: existing } = await supabase
          .from('product_carbon_footprints')
          .select('id')
          .eq('organization_id', orgId)
          .eq('product_id', product.id)
          .eq('status', 'estimate')
          .maybeSingle()

        const pcfPayload = {
          organization_id: orgId,
          product_id: product.id,
          product_name: product.name,
          status: 'estimate',
          is_draft: true,
          functional_unit: functionalUnit,
          system_boundary: 'cradle-to-gate (industry benchmark estimate)',
          reference_year: referenceYear,
          total_ghg_emissions: totalPerUnit,
          total_ghg_raw_materials: totalPerUnit * scopeSplit.raw_materials,
          total_ghg_processing: totalPerUnit * scopeSplit.processing,
          total_ghg_packaging: totalPerUnit * scopeSplit.packaging,
          ingredients_complete: false,
          packaging_complete: false,
          production_complete: false,
          aggregated_impacts: {
            methodology_note: `Industry-benchmark estimate. Source: ${getBenchmarkForCategory(product.product_category).sourceName} (${getBenchmarkForCategory(product.product_category).sourceYear}). Refine with real ingredient and production data.`,
            annual_production_litres: litres,
            annual_production_kg_co2e: totalKg,
            climate_change_gwp100: totalPerUnit,
            estimate_source: 'arrival_onboarding',
          },
        }

        if (existing?.id) {
          await supabase
            .from('product_carbon_footprints')
            .update({ ...pcfPayload, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('product_carbon_footprints').insert(pcfPayload)
        }
      }
    }

    setIsSaving(false)
    // Records this step as complete for telemetry/progress; there is no
    // next arrival step, so the wizard stays put and we flip the local
    // phase to the peak-end close below.
    completeStep()
    setPhase('forest')
  }

  // Fire the same server-side seed the older fast-track completion step
  // uses (persona, tracker, target, agent_exceptions) as soon as the forest
  // phase is reached, so Rosa's hub has day-one richness by the time the
  // user lands on it.
  useEffect(() => {
    if (phase !== 'forest' || seedFiredRef.current || !currentOrganization?.id) return
    seedFiredRef.current = true
    fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: currentOrganization.id }),
    }).catch((err) => {
      console.error('[arrival-estimate] seed call failed:', err)
    })
  }, [phase, currentOrganization?.id])

  const handleFinish = async () => {
    if (launching) return
    setLaunching(true)
    await completeOnboarding()
    router.push('/desk/')
  }

  if (phase === 'forest') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-700">
        <div className="w-full max-w-md space-y-6">
          <RosaIntro message="Lovely. I've got what I need to start. I'll show you what to look at first on your desk." />

          <div className="space-y-3">
            <Eyebrow tone="dim" className="justify-center flex">Your forest</Eyebrow>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Your forest has started.</h2>
          </div>

          <div className="inline-block rounded-[6px] border border-studio-hairline bg-studio-cream px-6 py-4">
            <BigNumber
              value={<span className="text-studio-forest">~{displayTonnes > 0 ? displayTonnes.toLocaleString() : '<1'}</span>}
              label="t CO₂e / year, estimated"
            />
          </div>

          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Every real number you add from here grows it further. Your desk will show you where to start.
          </p>

          <PillButton onClick={handleFinish} disabled={launching} variant="ink" size="md" className="px-6">
            {launching ? 'Loading…' : 'Go to your desk'}
            {!launching && <ArrowRight className="h-4 w-4" />}
          </PillButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md space-y-5">

        <RosaIntro message="Here's a starting estimate using industry benchmarks. The volumes you enter sharpen it; real LCAs later make it bottom-up accurate." />

        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">Your estimate</Eyebrow>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Your estimated footprint.</h2>
          <p className="text-sm text-muted-foreground">
            {hasProducts
              ? 'Tell us how much you produce each year and we will calculate your estimate.'
              : `Based on industry averages for ${beverageLabel.toLowerCase()} producers.`}
          </p>
        </div>

        {!isLoading && hasProducts && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Annual production per product</p>
            <div className="space-y-2">
              {products.map(product => {
                const entry = productVolumes[product.id] ?? { volume: '', unit: 'Litres' as ProductionUnit }
                const canUseUnits = !!product.unit_size_value
                return (
                  <div key={product.id} className="rounded-[6px] border border-studio-hairline bg-studio-cream p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={entry.volume}
                        onChange={e => setVolume(product.id, { volume: e.target.value })}
                        className="flex-1 min-w-0"
                      />
                      <Select
                        value={entry.unit}
                        onValueChange={val => setVolume(product.id, { unit: val as ProductionUnit })}
                      >
                        <SelectTrigger className="w-36 shrink-0">
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
                      <p className="text-xs text-studio-dim">
                        {product.unit_size_value}{product.unit_size_unit} per unit
                      </p>
                    )}
                    {autofilledFromBreww.has(product.id) && (
                      <p className="text-xs text-studio-forest flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Auto-filled from Breww, edit if needed
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!isLoading && !hasProducts && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Annual production volume</p>
            <div className="grid grid-cols-2 gap-2">
              {VOLUME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVolumeBucket(opt.value)}
                  className={cn(
                    'flex flex-col gap-0.5 p-3 rounded-[6px] border text-left transition-colors',
                    volumeBucket === opt.value
                      ? 'border-studio-forest bg-secondary'
                      : 'border-studio-hairline bg-studio-cream hover:bg-secondary hover:border-studio-ink/25'
                  )}
                >
                  <span className={cn('text-xs font-semibold', volumeBucket === opt.value ? 'text-studio-forest' : 'text-foreground')}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-6 text-center space-y-1">
          {isLoading ? (
            <div className="h-12 flex items-center justify-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Calculating&hellip;</span>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <BigNumber
                  size="display"
                  value={<span className="text-studio-forest">~{displayTonnes > 0 ? displayTonnes.toLocaleString() : '<1'}</span>}
                  label="tonnes CO₂e / year"
                />
              </div>
              <p className="text-xs text-studio-dim pt-2">
                Likely range: {low.toLocaleString()} &ndash; {high.toLocaleString()} t CO&#8322;e (&plusmn;30%)
              </p>
            </>
          )}
        </div>

        <PillButton onClick={handleContinue} disabled={isSaving} variant="ink" size="md" className="w-full">
          {isSaving ? 'Saving…' : (<>Continue<ArrowRight className="w-4 h-4" /></>)}
        </PillButton>

        {hasProducts && !anyVolumeEntered && (
          <p className="text-xs text-center text-studio-dim">
            Enter at least one volume above for a more accurate estimate, or continue to use an industry average.
          </p>
        )}

      </div>
    </div>
  )
}
