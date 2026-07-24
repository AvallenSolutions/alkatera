'use client'

/**
 * The cellar landing (/cellar/): the room-landing pattern, plum.
 *
 * The desk's grammar inside the room: one statement, the room's one plum
 * poster, then every surface as a quiet fact row with its live count.
 * Navigation stays flat: the band tabs are the shortcuts, this page is the
 * introduction.
 *
 * Since 24 July 2026 the cellar is composition alone: what a drink is made
 * of, each part owned once. The outcomes it used to carry (the LCAs, the
 * vitality score, the nature assessment) moved to the evidence room, so the
 * poster is now LCA coverage — how much of the range has a finished
 * footprint, which is both this room's product and its one honest nudge.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface CellarCounts {
  products: number
  liquids: number
  packs: number
  ingredients: number
  lcasCompleted: number
  lcasDraft: number
  year: number
}

function useCellarCounts(): CellarCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<CellarCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/cellar/counts?organization_id=${currentOrganization.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCounts(data)
      })
      .catch(() => {
        // Quiet: rows render without figures.
      })
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id])

  return counts
}

/**
 * The room's poster: how much of the range has a finished footprint. The
 * products count is the headline (it is what the room holds); the coverage
 * is the note, because it is the thing worth acting on.
 */
function CoveragePoster({ counts }: { counts: CellarCounts | null }) {
  const hasProducts = counts !== null && counts.products > 0

  const note = !hasProducts
    ? 'ADD YOUR FIRST PRODUCT'
    : counts!.lcasCompleted === 0
      ? 'NONE WITH A COMPLETE LCA YET'
      : `${counts!.lcasCompleted} WITH A COMPLETE LCA · OPEN THE PRODUCTS`

  return (
    <PosterBlock
      eyebrow="THE RANGE"
      headline={
        hasProducts ? (
          <>
            {counts!.products}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              {counts!.products === 1 ? 'product' : 'products'}
            </span>
          </>
        ) : (
          'Nothing in the cellar yet.'
        )
      }
      note={note}
      href="/products/"
      mark="diamond"
    />
  )
}

export default function CellarLandingPage() {
  const counts = useCellarCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const rows: FactRowItem[] = [
    {
      id: 'products',
      title: 'The products',
      hint: 'Everything you make: a liquid, a fill, a pack and a route',
      value: fig(counts?.products),
      unit: counts ? (counts.products === 1 ? 'PRODUCT' : 'PRODUCTS') : undefined,
      href: '/products/',
    },
    {
      id: 'liquids',
      title: 'The liquids',
      hint: 'What you make, once, however many ways you bottle it',
      value: fig(counts?.liquids),
      unit: counts ? (counts.liquids === 1 ? 'LIQUID' : 'LIQUIDS') : undefined,
      href: '/products/liquids/',
    },
    {
      id: 'packaging',
      title: 'The packaging',
      hint: 'Bottles, cans, cases and closures, shared across the range',
      value: fig(counts?.packs),
      unit: counts ? (counts.packs === 1 ? 'FORMAT' : 'FORMATS') : undefined,
      href: '/products/packs/',
    },
    {
      id: 'ingredients',
      title: 'The ingredients',
      hint: 'What you buy in, and the factor behind each one',
      value: fig(counts?.ingredients),
      unit: counts ? (counts.ingredients === 1 ? 'INGREDIENT' : 'INGREDIENTS') : undefined,
      href: '/products/ingredients/',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <Statement eyebrow="THE CELLAR" headline="What a drink is made of." />

      <RoomSetupPanel room="cellar" />


      <CoveragePoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
    </div>
  )
}
