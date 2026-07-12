'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { useOnboarding } from '@/lib/onboarding'
import type { ScrapedProductDraft } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { RosaIntro } from './RosaIntro'
import { BrandColourReveal } from '@/components/studio/brand-colour-reveal'
import { roomPaletteFromBrand } from '@/lib/studio/brand-palette'

/**
 * "Here you are." After the crawl, we hand back what we read from the
 * website (logo, products) and the moment of delight: alkatera repainted
 * in the brand's own colours. Everything shown here is a labelled draft;
 * the user confirms it into their account as they go.
 *
 * The arrival flow has no import step, so this step is also where the
 * scraped products become real: whichever ones stay ticked are inserted as
 * is_draft products (the same shape the old FastTrackImportStep used) when
 * the user advances, by either the paint or the keep-colours path.
 */
export function FastTrackRevealStep() {
  const { state, completeStep, skipStep } = useOnboarding()
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const [busy, setBusy] = useState(false)
  const [draftNote, setDraftNote] = useState<string | null>(null)
  // Guard against double materialisation if both advance paths somehow run
  // (e.g. a rage-click on paint then skip). The name dedupe below also makes
  // a re-run harmless; this just avoids the redundant round trip.
  const materialisedRef = useRef(false)

  const p = state.personalization
  const brandName = currentOrganization?.name?.trim() || 'your brand'
  const logo = p.brandLogoUrl

  // Prefer the full drafts; fall back to bare names for onboarding state
  // saved before scrapedProducts existed.
  const products: ScrapedProductDraft[] = useMemo(() => {
    if (p.scrapedProducts?.length) return p.scrapedProducts
    return (p.scrapedProductNames ?? []).map(name => ({ name }))
  }, [p.scrapedProducts, p.scrapedProductNames])

  // All pre-ticked; the user unticks anything they don't want kept.
  const [unticked, setUnticked] = useState<Set<number>>(new Set())
  const toggleProduct = (i: number) => {
    setUnticked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }
  const tickedCount = products.length - unticked.size

  /**
   * Insert the ticked products as is_draft rows, mirroring the old
   * FastTrackImportStep/FastTrackProductsStep shape. Skips any name the org
   * already has (case-insensitive), so back/forward navigation or a re-run
   * never duplicates. Never throws: a failure logs, shows a quiet note, and
   * the ritual continues.
   */
  const materialiseDrafts = async (): Promise<void> => {
    if (!currentOrganization || materialisedRef.current) return
    const ticked = products.filter((_, i) => !unticked.has(i)).filter(d => d.name.trim())
    if (ticked.length === 0) { materialisedRef.current = true; return }
    try {
      const { data: existing, error: readError } = await supabase
        .from('products')
        .select('name')
        .eq('organization_id', currentOrganization.id)
      if (readError) throw readError
      const existingNames = new Set(
        (existing ?? []).map((r: { name: string }) => r.name.trim().toLowerCase()),
      )
      const seen = new Set<string>()
      const rows = ticked
        .filter(d => {
          const key = d.name.trim().toLowerCase()
          if (existingNames.has(key) || seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(d => ({
          organization_id: currentOrganization.id,
          name: d.name.trim(),
          product_category: d.category ?? null,
          unit_size_value: d.unitSizeValue ?? null,
          unit_size_unit: d.unitSizeUnit ?? null,
          is_draft: true,
        }))
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('products').insert(rows)
        if (insertError) throw insertError
      }
      materialisedRef.current = true
    } catch (err) {
      console.warn('[fast-track-reveal] could not save product drafts:', err)
      setDraftNote("The drafts didn't save. You can add products any time from the cellar.")
      // Let the note register before the step advances.
      await new Promise(r => setTimeout(r, 1400))
    }
  }

  const paint = async (hex: string) => {
    if (!currentOrganization) return
    setBusy(true)
    try {
      await materialiseDrafts()
      await supabase
        .from('organizations')
        .update({ brand_colour: hex, room_palette: roomPaletteFromBrand(hex) })
        .eq('id', currentOrganization.id)
      await refreshOrganizations()
    } catch (err) {
      console.warn('[fast-track-reveal] could not save brand colour:', err)
    } finally {
      setBusy(false)
      completeStep()
    }
  }

  const keepColours = async () => {
    setBusy(true)
    try {
      await materialiseDrafts()
    } finally {
      setBusy(false)
      skipStep()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-6 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <RosaIntro message="I read your website. Here is what I found, and a little surprise: I can dress alkatera in your own colours." />

        <div className="space-y-3 text-center">
          {logo ? (
            <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[6px] border border-border bg-card">
              <Image src={logo} alt={brandName} width={56} height={56} className="h-auto w-auto max-h-12 object-contain" unoptimized />
            </div>
          ) : null}
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">Here you are</div>
            <h3 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">{brandName}.</h3>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="rounded-[6px] border border-border bg-card p-4">
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dim">
              {products.length} product{products.length === 1 ? '' : 's'} found · drafts to confirm
            </div>
            <div className="divide-y divide-border">
              {products.map((prod, i) => {
                const ticked = !unticked.has(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleProduct(i)}
                    aria-pressed={ticked}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left transition-opacity duration-150 ease-studio hover:opacity-80"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
                        ticked ? 'border-studio-forest bg-studio-forest' : 'border-border bg-transparent',
                      )}
                    >
                      {ticked && <Check className="h-3 w-3 text-studio-cream" strokeWidth={3} />}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate text-sm', ticked ? 'text-foreground' : 'text-studio-dim')}>
                      {prod.name}
                    </span>
                    {prod.unitSizeValue && prod.unitSizeUnit ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-studio-dim">
                        {prod.unitSizeValue}{prod.unitSizeUnit}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {tickedCount > 0
                ? 'These will be waiting in your cellar as drafts.'
                : 'None ticked, so nothing will be added.'}
            </p>
            {draftNote && <p className="mt-1 text-xs text-studio-stale">{draftNote}</p>}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              We can paint your rooms in your brand colour. Nudge it until it feels right.
            </p>
            {p.brandColour && /^#[0-9A-Fa-f]{6}$/.test(p.brandColour) && (
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-studio-forest">
                From your website.
              </span>
            )}
          </div>
          <BrandColourReveal
            initialColour={p.brandColour}
            onApply={paint}
            busy={busy}
            applyLabel="Paint my house"
          />
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={keepColours}
            disabled={busy}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
          >
            Keep alkatera's colours
          </button>
        </div>
      </div>
    </div>
  )
}
