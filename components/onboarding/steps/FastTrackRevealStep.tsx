'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { RosaIntro } from './RosaIntro'
import { BrandColourReveal } from '@/components/studio/brand-colour-reveal'
import { roomPaletteFromBrand } from '@/lib/studio/brand-palette'

/**
 * "Here you are." After the crawl, we hand back what we read from the
 * website (logo, products) and the moment of delight: alkatera repainted
 * in the brand's own colours. Everything shown here is a labelled draft;
 * the user confirms it into their account as they go.
 */
export function FastTrackRevealStep() {
  const { state, completeStep, skipStep } = useOnboarding()
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const [busy, setBusy] = useState(false)

  const p = state.personalization
  const brandName = currentOrganization?.name?.trim() || 'your brand'
  const logo = p.brandLogoUrl
  const products = p.scrapedProductNames ?? []

  const paint = async (hex: string) => {
    if (!currentOrganization) return
    setBusy(true)
    try {
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
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dim">
              {products.length} product{products.length === 1 ? '' : 's'} found · drafts to confirm
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {products.slice(0, 8).map((name, i) => (
                <span key={i} className="text-sm text-foreground">{name}</span>
              ))}
              {products.length > 8 ? (
                <span className="text-sm text-muted-foreground">and {products.length - 8} more</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We can paint your rooms in your brand colour. Nudge it until it feels right.
          </p>
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
            onClick={skipStep}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground"
          >
            Keep alkatera's colours
          </button>
        </div>
      </div>
    </div>
  )
}
