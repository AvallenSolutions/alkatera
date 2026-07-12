'use client'

/**
 * The library landing (/library/): the room-landing pattern, teal.
 *
 * The desk's grammar inside the room: one statement, the room's one teal
 * poster (the shelf, the size of the reference you keep), then each surface
 * as a quiet fact row with its live count. Navigation stays flat: the band
 * tabs (Knowledge / Wiki) are the shortcuts, this page is the introduction.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount'

interface LibraryCounts {
  resources: number
  categories: number
  wikiPages: number
}

function useLibraryCounts(): LibraryCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<LibraryCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/library/counts?organization_id=${currentOrganization.id}`)
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

/** The room's poster: the size of the reference on the shelf. */
function ShelfPoster({ counts }: { counts: LibraryCounts | null }) {
  const has = counts !== null
  return (
    <PosterBlock
      eyebrow="THE SHELF"
      headline={
        has ? (
          <>
            {counts!.resources}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              {counts!.resources === 1 ? 'resource' : 'resources'}
            </span>
          </>
        ) : (
          'The reference you keep.'
        )
      }
      note={
        has
          ? `${counts!.wikiPages} WIKI PAGES · OPEN THE KNOWLEDGE BANK`
          : 'KNOWLEDGE · WIKI'
      }
      href="/knowledge-bank/"
      mark="arch"
    />
  )
}

export default function LibraryLandingPage() {
  const counts = useLibraryCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const rows: FactRowItem[] = [
    {
      id: 'knowledge',
      title: 'The knowledge bank',
      hint:
        counts && counts.categories > 0
          ? `Documents, videos and links across ${counts.categories} ${
              counts.categories === 1 ? 'category' : 'categories'
            }`
          : 'Documents, videos and links your team can reach for',
      value: fig(counts?.resources),
      unit: counts ? (counts.resources === 1 ? 'RESOURCE' : 'RESOURCES') : undefined,
      href: '/knowledge-bank/',
    },
    {
      id: 'wiki',
      title: 'The wiki',
      hint: 'Plain-language sustainability reference, drawn as a connected map',
      value: fig(counts?.wikiPages),
      unit: counts ? (counts.wikiPages === 1 ? 'PAGE' : 'PAGES') : undefined,
      href: '/wiki/',
    },
  ]

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage; open paper at the page foot. */}
      <div className="relative z-[1] mx-auto max-w-4xl space-y-10 pb-48">
      <Statement eyebrow="THE LIBRARY" headline="What you know." />

      <ShelfPoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
      </div>
    </>
  )
}
