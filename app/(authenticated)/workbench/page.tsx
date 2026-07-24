'use client'

/**
 * The workbench landing (/workbench/): the room-landing pilot.
 *
 * The desk's grammar applied inside a room: one statement, the room's one
 * cobalt poster (this year's footprint, the room's product), then every
 * surface as a quiet fact row with its live count — including the "More…"
 * strays, so nothing in the room is undiscoverable. Navigation stays flat:
 * the band tabs are the shortcuts, this page is the introduction.
 *
 * The four modules (vineyards, orchards, arable fields, hospitality) appear
 * only for an org that declared them on the arrival ritual's modules step.
 * A declared module the org's tier does not yet open still shows, wearing a
 * CANOPY chip: that is the upsell, made concrete rather than hidden.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { MODULE_HREF, type WorksWithModule } from '@/lib/subscription/works-with'
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface WorkbenchCounts {
  facilities: number
  vehicles: number
  vineyards: number
  orchards: number
  arableFields: number
  venues: number
  xeroConnected: boolean
  /** What this business said it works with. Declared need, not entitlement. */
  worksWith: WorksWithModule[]
  /** Whether the org's tier (Canopy) actually opens those modules. */
  modulesUnlocked: boolean
}

function useWorkbenchCounts(): WorkbenchCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<WorkbenchCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/workbench/counts?organization_id=${currentOrganization.id}`)
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

/** "128" for whole tonnes, "3.4" under ten. */
function formatTonnes(t: number): string {
  return t >= 10 ? Math.round(t).toLocaleString('en-GB') : t.toFixed(1)
}

/** The room's poster: this year's footprint, or the way in when there is none. */
function FootprintPoster() {
  const year = new Date().getFullYear()
  const { footprint, loading } = useCompanyFootprint(year)

  if (loading) {
    return <div className="min-h-[9rem] animate-pulse rounded-[6px] bg-room/10" />
  }

  const hasData = footprint?.has_data && footprint.total_emissions > 0
  return (
    <PosterBlock
      eyebrow={`THE ${year} FOOTPRINT`}
      headline={
        hasData ? (
          <>
            {formatTonnes(footprint!.total_emissions)}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              t CO2e
            </span>
          </>
        ) : (
          'No footprint yet.'
        )
      }
      note={
        // The emissions surface moved to the evidence room on 24 July 2026.
        // The poster still points at it: this is what the workbench data
        // adds up to, and saying where it lives is the honest label.
        hasData
          ? footprint!.status === 'Finalized'
            ? 'COMPLETE · SEE IT IN THE EVIDENCE'
            : 'DRAFT · SEE IT IN THE EVIDENCE'
          : 'START WITH YOUR FACILITIES'
      }
      href={hasData ? '/data/scope-1-2/' : '/company/facilities/'}
      mark="triangle"
    />
  )
}

export default function WorkbenchLandingPage() {
  const counts = useWorkbenchCounts()

  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const bench: FactRowItem[] = [
    {
      id: 'facilities',
      title: 'The facilities',
      hint: 'Sites, utilities, water and waste: where the numbers start',
      value: fig(counts?.facilities),
      unit: counts ? (counts.facilities === 1 ? 'SITE' : 'SITES') : undefined,
      href: '/company/facilities/',
    },
    {
      id: 'spend',
      title: 'The spend',
      hint: counts?.xeroConnected
        ? 'Classify suppliers and upgrade spend-based numbers'
        : 'Connect your accounts to estimate emissions from spend',
      href: '/data/spend-data/',
    },
    {
      id: 'integrations',
      title: 'The integrations',
      hint: counts?.xeroConnected
        ? 'The systems already feeding you data, and what else you could connect'
        : 'Connect the systems you already use so the data arrives on its own',
      chip: counts?.xeroConnected ? { tone: 'good', label: 'CONNECTED' } : undefined,
      href: '/settings?tab=integrations',
    },
    {
      id: 'quality',
      title: 'Data quality',
      hint: 'How solid the numbers are, and what to upgrade first',
      href: '/data/quality/',
    },
    {
      id: 'inventory',
      title: 'The inventory ledger',
      hint: 'Link spend to stock so nothing counts twice',
      href: '/data/inventory-ledger/',
    },
    {
      id: 'fleet',
      title: 'The fleet',
      hint: 'Vehicles and the miles behind them',
      value: fig(counts?.vehicles),
      unit: counts ? (counts.vehicles === 1 ? 'VEHICLE' : 'VEHICLES') : undefined,
      href: '/company/fleet/',
    },
    {
      id: 'sources',
      title: 'The sources',
      hint: 'Every emission factor we use, and where it comes from',
      href: '/data/sources/',
    },
  ]

  // One row per declared module. The count and the hint differ per module;
  // the CANOPY chip is shared, and appears whenever the tier does not yet
  // open what the business said it does.
  const MODULE_ROWS: Record<
    WorksWithModule,
    { title: string; hint: string; count: (c: WorkbenchCounts) => number; unit: [string, string] }
  > = {
    viticulture: {
      title: 'The vineyards',
      hint: 'Growing data for the LCA engine',
      count: (c) => c.vineyards,
      unit: ['SITE', 'SITES'],
    },
    orchards: {
      title: 'The orchards',
      hint: 'Growing data for the LCA engine',
      count: (c) => c.orchards,
      unit: ['SITE', 'SITES'],
    },
    arable_fields: {
      title: 'The arable fields',
      hint: 'Growing data for the LCA engine',
      count: (c) => c.arableFields,
      unit: ['SITE', 'SITES'],
    },
    hospitality: {
      title: 'The hospitality',
      hint: 'Venues, menus and meals, measured like products',
      count: (c) => c.venues,
      unit: ['VENUE', 'VENUES'],
    },
  }

  const locked = counts !== null && !counts.modulesUnlocked
  const fields: FactRowItem[] = (counts?.worksWith ?? []).map((key) => {
    const row = MODULE_ROWS[key]
    const n = counts ? row.count(counts) : 0
    return {
      id: key,
      title: row.title,
      hint: locked ? `${row.hint}. Part of the Canopy plan.` : row.hint,
      value: locked ? undefined : String(n),
      unit: locked ? undefined : n === 1 ? row.unit[0] : row.unit[1],
      chip: locked ? { tone: 'attention' as const, label: 'CANOPY' } : undefined,
      href: locked ? '/settings?tab=billing' : MODULE_HREF[key],
    }
  })

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <Statement eyebrow="THE WORKBENCH" headline="The data going in." />

      <RoomSetupPanel room="workbench" />


      <FootprintPoster />

      <section>
        <FactList items={bench} />
      </section>

      {fields.length > 0 && (
        <section>
          <Eyebrow className="mb-3 text-room-accent">The fields and the floor</Eyebrow>
          <FactList items={fields} />
        </section>
      )}
    </div>
  )
}
