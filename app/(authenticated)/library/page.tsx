'use client'

/**
 * The library landing (/library/): the room-landing pattern, teal.
 *
 * The desk's grammar inside the room: one statement, the room's one teal
 * poster (the shelf), then each surface as a quiet fact row with its live
 * count. Navigation stays flat: the band tabs are the shortcuts, this page
 * is the introduction.
 *
 * Since 24 July 2026 the shelf holds your own documents too: the evidence
 * library (shown as "your library", so it reads as yours rather than as a
 * second library) and the uploads inbox that fills it both moved in. Your
 * own documents lead, the reference we bring follows.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface LibraryCounts {
  resources: number
  categories: number
  wikiPages: number
  /** The org's own documents (the evidence library). */
  documents: number
  /** Documents that came in through the uploads inbox and still need a look. */
  uploadsPending: number
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

/** The room's poster: everything on the shelf, yours and ours together. */
function ShelfPoster({ counts }: { counts: LibraryCounts | null }) {
  const has = counts !== null
  const total = has ? counts!.documents + counts!.resources + counts!.wikiPages : 0
  return (
    <PosterBlock
      eyebrow="THE SHELF"
      headline={
        has ? (
          <>
            {total}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              {total === 1 ? 'item' : 'items'}
            </span>
          </>
        ) : (
          'Everything you keep.'
        )
      }
      note={
        has
          ? `${counts!.documents} ${counts!.documents === 1 ? 'DOCUMENT' : 'DOCUMENTS'} OF YOUR OWN · OPEN YOUR LIBRARY`
          : 'YOURS · KNOWLEDGE · WIKI'
      }
      href="/evidence-library/"
      mark="arch"
    />
  )
}

export default function LibraryLandingPage() {
  const counts = useLibraryCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const rows: FactRowItem[] = [
    {
      id: 'yours',
      title: 'Your library',
      hint: 'Every document you have gathered: certificates, invoices, spec sheets',
      value: fig(counts?.documents),
      unit: counts ? (counts.documents === 1 ? 'DOCUMENT' : 'DOCUMENTS') : undefined,
      href: '/evidence-library/',
    },
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
    {
      id: 'uploads',
      title: 'The uploads',
      hint: 'Drop anything in and we will read it and file it for you',
      value: counts && counts.uploadsPending > 0 ? String(counts.uploadsPending) : undefined,
      unit: counts && counts.uploadsPending > 0 ? 'AWAITING REVIEW' : undefined,
      chip:
        counts && counts.uploadsPending > 0
          ? { tone: 'attention', label: 'NEEDS A LOOK' }
          : undefined,
      href: '/uploads/',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <Statement eyebrow="THE LIBRARY" headline="What you know." />

      <RoomSetupPanel room="library" />

      <ShelfPoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
    </div>
  )
}
