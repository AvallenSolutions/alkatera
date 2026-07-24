'use client'

/**
 * The evidence landing (/evidence/): the room-landing pattern, brick.
 *
 * The desk's grammar inside the room: one statement, the room's one brick
 * poster, then every surface as a quiet fact row with its live count.
 * Navigation stays flat: the band tabs are the shortcuts, this page is the
 * introduction, and it is where the surfaces behind "More…" become
 * discoverable.
 *
 * Since 24 July 2026 this is the room of proof AND the numbers behind it:
 * the completed LCAs, the vitality score and the corporate emissions moved
 * in from the cellar and the workbench. The vitality score is the hero
 * poster — the one number that answers "how are we doing?", which is what
 * anyone walking into this room came to find out.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import type { WorkingTone } from '@/components/studio/theme'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface EvidenceCounts {
  reportsGenerated: number
  certificationsActive: number
  targetsActive: number
  guardianChecks: number
  guardianLastRisk: string | null
  historicalImports: number
  footprintYear: number | null
  footprintStatus: string | null
  lcasCompleted: number
  natureStatus: string
  year: number
}

function useEvidenceCounts(): EvidenceCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<EvidenceCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/evidence/counts?organization_id=${currentOrganization.id}`)
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

/** The vitality score, shared with the desk and Rosa so they cannot disagree. */
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

/** The room's hero: the vitality score, the one number that answers "how are we doing?". */
function VitalityPoster() {
  const v = useVitality()
  const hasScore = v !== null && v.score !== null

  return (
    <PosterBlock
      eyebrow="THE VITALITY"
      mark="quarter"
      href={hasScore ? '/performance/' : '/products/'}
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
    />
  )
}

/** guardian risk → working tone for the row chip. */
function riskTone(risk: string | null): WorkingTone | null {
  if (risk === 'high') return 'stale'
  if (risk === 'medium') return 'attention'
  if (risk === 'low') return 'good'
  return null
}

export default function EvidenceLandingPage() {
  const counts = useEvidenceCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const risk = counts ? riskTone(counts.guardianLastRisk) : null
  const footprintFinal = counts?.footprintStatus === 'finalized' || counts?.footprintStatus === 'Finalized'

  const rows: FactRowItem[] = [
    {
      id: 'reports',
      title: 'The reports',
      hint: 'Sustainability reports you have generated',
      value: counts && counts.reportsGenerated > 0 ? String(counts.reportsGenerated) : undefined,
      unit: counts && counts.reportsGenerated > 0 ? 'GENERATED' : undefined,
      href: '/reports/sustainability/',
    },
    {
      // Completed work only. A half-finished LCA is resumed from the product
      // it belongs to, over in the cellar, not from this list.
      id: 'lcas',
      title: 'The LCAs',
      hint: 'The product footprints you have finished and can show',
      value: counts && counts.lcasCompleted > 0 ? String(counts.lcasCompleted) : undefined,
      unit: counts && counts.lcasCompleted > 0 ? 'COMPLETE' : undefined,
      href: '/reports/lcas/',
    },
    {
      id: 'vitality',
      title: 'The vitality',
      hint: 'How healthy the whole picture is, pillar by pillar',
      href: '/performance/',
    },
    {
      id: 'emissions',
      title: 'The emissions',
      hint: 'Scope 1, 2 and 3 for the whole company, year by year',
      href: '/data/scope-1-2/',
    },
    {
      id: 'footprint',
      title: 'The company footprint',
      hint: 'Your annual corporate carbon footprint report',
      value: counts?.footprintYear ? String(counts.footprintYear) : undefined,
      chip: counts?.footprintYear
        ? footprintFinal
          ? { tone: 'good', label: 'FINAL' }
          : { tone: 'attention', label: 'DRAFT' }
        : undefined,
      href: '/reports/company-footprint/',
    },
    {
      id: 'certifications',
      title: 'Certifications',
      hint: 'The standards you are working towards',
      value: counts && counts.certificationsActive > 0 ? String(counts.certificationsActive) : undefined,
      unit: counts && counts.certificationsActive > 0 ? 'ACTIVE' : undefined,
      href: '/certifications/',
    },
    {
      id: 'targets',
      title: 'Targets',
      hint: 'Your reduction targets and the actions behind them',
      value: counts && counts.targetsActive > 0 ? String(counts.targetsActive) : undefined,
      unit: counts && counts.targetsActive > 0 ? 'ACTIVE' : undefined,
      href: '/pulse/targets/',
    },
    {
      id: 'guardian',
      title: 'The guardian',
      hint: 'Check a claim against greenwashing rules before you publish',
      value: counts && counts.guardianChecks > 0 ? String(counts.guardianChecks) : undefined,
      unit: counts && counts.guardianChecks > 0 ? 'CHECKS' : undefined,
      chip: risk ? { tone: risk, label: `${counts!.guardianLastRisk!.toUpperCase()} RISK` } : undefined,
      href: '/greenwash-guardian/',
    },
    {
      // The TNFD assessment: an outcome you prove with, so it sits here
      // rather than in the cellar where it used to live.
      id: 'nature',
      title: 'The nature assessment',
      hint: counts ? `${counts.year} TNFD assessment` : 'This year’s TNFD assessment',
      chip: counts
        ? counts.natureStatus === 'complete'
          ? { tone: 'good', label: 'Complete' }
          : counts.natureStatus === 'draft'
            ? { tone: 'attention', label: 'In progress' }
            : undefined
        : undefined,
      meta: counts && counts.natureStatus === 'not_started' ? 'Not started' : undefined,
      href: '/nature-assessment/',
    },
    {
      id: 'historical',
      title: 'Historical imports',
      hint: 'Prior reports and LCAs you have brought in',
      value: counts && counts.historicalImports > 0 ? String(counts.historicalImports) : undefined,
      href: '/reports/historical/',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <Statement eyebrow="THE EVIDENCE" headline="What you can prove." />

      <RoomSetupPanel room="evidence" />


      <VitalityPoster />

      <section>
        <FactList items={rows} />
      </section>
    </div>
  )
}
