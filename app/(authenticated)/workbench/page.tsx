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
 * Beta rooms (the fields, hospitality) only appear for orgs holding the
 * flag — stricter than the More… menu, which leaks the labels.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface WorkbenchCounts {
  facilities: number
  vehicles: number
  vineyards: number
  orchards: number
  arableFields: number
  venues: number
  xeroConnected: boolean
  flags: { viticulture: boolean; orchard: boolean; arable: boolean; hospitality: boolean }
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
        hasData
          ? footprint!.status === 'Finalized'
            ? 'COMPLETE · OPEN THE EMISSIONS'
            : 'DRAFT · OPEN THE EMISSIONS'
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

  const fields: FactRowItem[] = []
  if (counts?.flags.viticulture) {
    fields.push({
      id: 'vineyards',
      title: 'The vineyards',
      hint: 'Growing data for the LCA engine',
      value: String(counts.vineyards),
      unit: counts.vineyards === 1 ? 'SITE' : 'SITES',
      href: '/vineyards/',
    })
  }
  if (counts?.flags.orchard) {
    fields.push({
      id: 'orchards',
      title: 'The orchards',
      hint: 'Growing data for the LCA engine',
      value: String(counts.orchards),
      unit: counts.orchards === 1 ? 'SITE' : 'SITES',
      href: '/orchards/',
    })
  }
  if (counts?.flags.arable) {
    fields.push({
      id: 'arable',
      title: 'The arable fields',
      hint: 'Growing data for the LCA engine',
      value: String(counts.arableFields),
      unit: counts.arableFields === 1 ? 'SITE' : 'SITES',
      href: '/arable-fields/',
    })
  }
  if (counts?.flags.hospitality) {
    fields.push({
      id: 'hospitality',
      title: 'The hospitality',
      hint: 'Venues, menus and meals, measured like products',
      value: String(counts.venues),
      unit: counts.venues === 1 ? 'VENUE' : 'VENUES',
      href: '/hospitality/',
    })
  }

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage; open paper at the page foot. */}
      <div className="relative z-[1] mx-auto max-w-4xl space-y-10 pb-48">
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
    </>
  )
}
