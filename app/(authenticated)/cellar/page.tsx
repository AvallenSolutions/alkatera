'use client'

/**
 * The cellar landing (/cellar/): the room-landing pattern, plum.
 *
 * The desk's grammar inside the room: one statement, the room's one plum
 * poster (the vitality score, the room's outcome number, which otherwise
 * lives only on the desk), then every surface as a quiet fact row with its
 * live count. Navigation stays flat: the band tabs are the shortcuts, this
 * page is the introduction.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface CellarCounts {
  products: number
  lcasCompleted: number
  lcasDraft: number
  natureStatus: string
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

interface Composite {
  score: number | null
  band: string
}

/** The vitality score for the poster, shared with the desk and Rosa. */
function useVitality(): Composite | null {
  const { currentOrganization } = useOrganization()
  const [v, setV] = useState<Composite | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/vitality/composite?organization_id=${currentOrganization.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.composite) return
        setV({ score: data.composite.composite ?? null, band: data.composite.band ?? 'AWAITING DATA' })
      })
      .catch(() => {
        // Quiet: the poster falls back to its no-score copy.
      })
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id])

  return v
}

/** The room's poster: this year's vitality score, the outcome number. */
function VitalityPoster() {
  const v = useVitality()
  const hasScore = v && v.score !== null

  return (
    <PosterBlock
      eyebrow="THE VITALITY"
      headline={
        hasScore ? (
          <>
            {v!.score}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              / 100
            </span>
          </>
        ) : (
          'Awaiting your first score.'
        )
      }
      note={hasScore ? `${v!.band} · OPEN THE VITALITY` : 'BUILD A PRODUCT TO BEGIN'}
      href={hasScore ? '/performance/' : '/products/'}
      mark="diamond"
    />
  )
}

/** "Not started" / "Draft" / "Complete" for the nature row. */
function natureLabel(status: string): string {
  if (status === 'complete') return 'Complete'
  if (status === 'draft') return 'In progress'
  return 'Not started'
}

export default function CellarLandingPage() {
  const counts = useCellarCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const lcaHint =
    counts === null
      ? 'Life cycle assessments, made in the wizard'
      : counts.lcasDraft > 0
        ? `${counts.lcasCompleted} complete, ${counts.lcasDraft} in progress`
        : `${counts.lcasCompleted} complete`

  const rows: FactRowItem[] = [
    {
      id: 'products',
      title: 'The products',
      hint: 'Everything you make, and the footprint behind it',
      value: fig(counts?.products),
      unit: counts ? (counts.products === 1 ? 'PRODUCT' : 'PRODUCTS') : undefined,
      href: '/products/',
    },
    {
      id: 'lcas',
      title: 'The LCAs',
      hint: lcaHint,
      value: fig(counts?.lcasCompleted),
      unit: counts ? 'COMPLETE' : undefined,
      href: '/reports/lcas/',
    },
    {
      id: 'vitality',
      title: 'The vitality',
      hint: 'How healthy the whole picture is, pillar by pillar',
      href: '/performance/',
    },
    {
      id: 'nature',
      title: 'The nature assessment',
      hint: counts ? `${counts.year} TNFD assessment` : 'This year’s TNFD assessment',
      chip: counts
        ? counts.natureStatus === 'complete'
          ? { tone: 'good', label: natureLabel(counts.natureStatus) }
          : counts.natureStatus === 'draft'
            ? { tone: 'attention', label: natureLabel(counts.natureStatus) }
            : undefined
        : undefined,
      meta: counts && counts.natureStatus === 'not_started' ? natureLabel(counts.natureStatus) : undefined,
      href: '/nature-assessment/',
    },
  ]

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage; open paper at the page foot. */}
      <div className="relative z-[1] mx-auto max-w-4xl space-y-10 pb-48">
      <Statement eyebrow="THE CELLAR" headline="The footprints being made." />

      <RoomSetupPanel room="cellar" />

      <VitalityPoster />

      <section>
        <FactList items={rows} />
      </section>
      </div>
    </>
  )
}
