'use client'

/**
 * The evidence landing (/evidence/): the room-landing pattern, brick.
 *
 * The desk's grammar inside the room: one statement, the room's one brick
 * poster (THE PROOF — how many reports and certifications you can show, the
 * room's product), then every surface as a quiet fact row with its live
 * count. Navigation stays flat: the band tabs are the shortcuts, this page
 * is the introduction, and it is where the footprint, guardian, library and
 * historical surfaces (not all on the band) become discoverable.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import type { WorkingTone } from '@/components/studio/theme'

interface EvidenceCounts {
  reportsGenerated: number
  certificationsActive: number
  targetsActive: number
  guardianChecks: number
  guardianLastRisk: string | null
  libraryDocuments: number
  historicalImports: number
  footprintYear: number | null
  footprintStatus: string | null
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

/** The room's poster: THE PROOF — reports and certifications you can show. */
function ProofPoster({ counts }: { counts: EvidenceCounts | null }) {
  const hasReports = counts !== null && counts.reportsGenerated > 0

  return (
    <PosterBlock
      eyebrow="THE PROOF"
      mark="quarter"
      href="/reports/sustainability/"
      headline={
        hasReports ? (
          <>
            {counts!.reportsGenerated}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              {counts!.reportsGenerated === 1 ? 'report' : 'reports'}
            </span>
          </>
        ) : (
          'No reports yet.'
        )
      }
      note={
        hasReports
          ? `${counts!.certificationsActive} ${counts!.certificationsActive === 1 ? 'CERTIFICATION' : 'CERTIFICATIONS'} · OPEN THE REPORTS`
          : 'GENERATE YOUR FIRST REPORT'
      }
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
      id: 'library',
      title: 'The library',
      hint: 'Every document you have gathered as evidence',
      value: counts && counts.libraryDocuments > 0 ? String(counts.libraryDocuments) : undefined,
      unit: counts && counts.libraryDocuments > 0 ? 'DOCS' : undefined,
      href: '/evidence-library/',
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
    <div className="mx-auto max-w-4xl space-y-10">
      <Statement eyebrow="THE EVIDENCE" headline="What you can prove." />

      <ProofPoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
    </div>
  )
}
