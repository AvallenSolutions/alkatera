'use client'

/**
 * The network landing (/network/): the room-landing pattern, ochre.
 *
 * The desk's grammar inside the room: one statement, the room's one ochre
 * poster (THE CHAIN, the supplier count and how much ESG we've gathered,
 * the room's product), then every surface as a quiet fact row with its live
 * count. Navigation stays flat: the band tabs are the shortcuts, this page
 * is the introduction.
 *
 * The room's rule: ochre takes INK text on every saturated block (on="ink").
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'
import { GiveDoor } from '@/components/studio/give-door'

interface NetworkCounts {
  suppliers: number
  pendingInvites: number
  esgSubmitted: number
  messagesUnread: number
  supportOpen: number
  supportStaffUnread: boolean
  expertsActive: boolean
  expertCreditLine: string | null
  responsibilityAttested: number
  responsibilityTotal: number
}

function useNetworkCounts(): NetworkCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<NetworkCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/network/counts?organization_id=${currentOrganization.id}`)
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

/** The room's poster: THE CHAIN, how many suppliers, how much ESG gathered. */
function ChainPoster({ counts }: { counts: NetworkCounts | null }) {
  const hasSuppliers = counts !== null && counts.suppliers > 0

  return (
    <PosterBlock
      eyebrow="THE CHAIN"
      on="ink"
      mark="square"
      href="/suppliers/"
      headline={
        hasSuppliers ? (
          <>
            {counts!.suppliers}
            <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
              {counts!.suppliers === 1 ? 'supplier' : 'suppliers'}
            </span>
          </>
        ) : (
          'No suppliers yet.'
        )
      }
      note={
        hasSuppliers
          ? `${counts!.esgSubmitted} ESG SUBMITTED · OPEN THE SUPPLIERS`
          : 'FIND OR INVITE YOUR FIRST SUPPLIER'
      }
    />
  )
}

export default function NetworkLandingPage() {
  const counts = useNetworkCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const rows: FactRowItem[] = [
    {
      id: 'suppliers',
      title: 'The suppliers',
      hint: 'The people who supply you, and where their ESG stands',
      value: fig(counts?.suppliers),
      unit: counts ? (counts.suppliers === 1 ? 'SUPPLIER' : 'SUPPLIERS') : undefined,
      chip:
        counts && counts.pendingInvites > 0
          ? {
              tone: 'attention',
              label: `${counts.pendingInvites} PENDING`,
            }
          : undefined,
      href: '/suppliers/',
    },
    {
      id: 'messages',
      title: 'Messages',
      hint: 'Conversations with the advisors you’ve invited',
      value: counts && counts.messagesUnread > 0 ? String(counts.messagesUnread) : undefined,
      unit: counts && counts.messagesUnread > 0 ? 'UNREAD' : undefined,
      href: '/settings/messages/',
    },
    {
      id: 'support',
      title: 'Support',
      hint: 'Your open tickets with the alkatera team',
      value: counts && counts.supportOpen > 0 ? String(counts.supportOpen) : undefined,
      unit: counts && counts.supportOpen > 0 ? 'OPEN' : undefined,
      chip: counts?.supportStaffUnread ? { tone: 'attention', label: 'NEW REPLY' } : undefined,
      href: '/settings/feedback/',
    },
    {
      id: 'experts',
      title: 'The experts',
      hint: counts?.expertCreditLine ?? 'Trusted partners we can introduce you to',
      meta: counts?.expertsActive ? 'ACTIVE' : undefined,
      href: '/expert-partners/',
    },
    {
      id: 'responsibility',
      title: 'Sourcing',
      hint: 'Your own responsible-sourcing attestations',
      chip:
        counts !== null
          ? {
              tone: counts.responsibilityAttested >= counts.responsibilityTotal ? 'good' : 'quiet',
              label: `${counts.responsibilityAttested} OF ${counts.responsibilityTotal}`,
            }
          : undefined,
      href: '/supplier-responsibility/',
    },
  ]

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage; open paper at the page foot. */}
      <div className="relative z-[1] mx-auto max-w-4xl space-y-10 pb-48">
      <Statement eyebrow="THE NETWORK" headline="The people you talk to." />

      <RoomSetupPanel room="network" />

      <GiveDoor hint="Supplier documents land here." />

      <ChainPoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
      </div>
    </>
  )
}
