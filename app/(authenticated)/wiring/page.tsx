'use client'

/**
 * The wiring landing (/wiring/): the room-landing pattern, ink.
 *
 * The desk's grammar inside the quietest room: one statement, the room's one
 * ink poster (THE PLAN: the subscription every org has), then each surface as
 * a quiet fact row with its live figure. This is where the rare and the
 * seasonal get their doors: EPR, the social families, the galleries.
 * Navigation stays flat: the band tabs are the shortcuts, this page is the
 * introduction.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Statement } from '@/components/studio/statement'
import { PosterBlock } from '@/components/studio/poster-block'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount'
import { RoomSetupPanel } from '@/components/studio/room-setup-panel'

interface WiringCounts {
  plan: { tier: string | null; status: string | null; renewsAt: string | null }
  members: number
  integrations: number
  eprObligation: string | null
  scores: { people: number | null; governance: number | null; community: number | null }
  byproducts: number
  natureActions: number
}

function useWiringCounts(): WiringCounts | null {
  const { currentOrganization } = useOrganization()
  const [counts, setCounts] = useState<WiringCounts | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/wiring/counts?organization_id=${currentOrganization.id}`)
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

/** "seed" → "Seed"; the tier names are lowercase in the DB. */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The plan's working tone: active is good, trial needs watching, ends are stale. */
function planChip(status: string | null): { tone: 'good' | 'attention' | 'stale'; label: string } | undefined {
  if (!status) return undefined
  if (status === 'active') return { tone: 'good', label: 'Active' }
  if (status === 'trial' || status === 'trialing') return { tone: 'attention', label: 'Trial' }
  if (status === 'past_due' || status === 'payment_required') return { tone: 'attention', label: 'Payment due' }
  if (status === 'cancelled' || status === 'canceled' || status === 'suspended')
    return { tone: 'stale', label: titleCase(status === 'canceled' ? 'cancelled' : status) }
  return { tone: 'attention', label: titleCase(status) }
}

/** The room's poster: the plan the whole house runs on. */
function PlanPoster({ counts }: { counts: WiringCounts | null }) {
  const plan = counts?.plan
  const hasTier = Boolean(plan?.tier)
  const renewal =
    plan?.renewsAt &&
    new Date(plan.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <PosterBlock
      eyebrow="THE PLAN"
      headline={hasTier ? titleCase(plan!.tier!) : 'The quiet machinery.'}
      note={
        hasTier
          ? [plan!.status ? plan!.status.toUpperCase() : null, renewal ? `RENEWS ${renewal.toUpperCase()}` : null]
              .filter(Boolean)
              .join(' · ') || 'OPEN THE SUBSCRIPTION'
          : 'SETTINGS · BILLING · COMPLIANCE'
      }
      href="/settings?tab=subscription"
      mark="ring"
    />
  )
}

/** "72 / 100" figures for the score rows, or a dim not-yet hint. */
function scoreRow(
  id: string,
  title: string,
  hint: string,
  href: string,
  score: number | null | undefined,
): FactRowItem {
  return {
    id,
    title,
    hint,
    href,
    value: score === null || score === undefined ? undefined : String(Math.round(score)),
    unit: score === null || score === undefined ? undefined : '/ 100',
  }
}

export default function WiringLandingPage() {
  const counts = useWiringCounts()
  const fig = (n: number | undefined) => (n === undefined ? undefined : String(n))

  const rows: FactRowItem[] = [
    {
      id: 'settings',
      title: 'The settings',
      hint: 'Profile, team, organisation and the rest of the machinery',
      value: fig(counts?.members),
      unit: counts ? (counts.members === 1 ? 'MEMBER' : 'MEMBERS') : undefined,
      href: '/settings/',
    },
    {
      id: 'billing',
      title: 'The billing',
      hint: 'The plan, the payment method, the invoices',
      chip: counts ? planChip(counts.plan.status) : undefined,
      href: '/settings?tab=billing',
    },
    {
      id: 'integrations',
      title: 'The integrations',
      hint: 'Xero, Breww, Unleashed and the data they carry in',
      value: fig(counts?.integrations),
      unit: counts ? 'CONNECTED' : undefined,
      href: '/settings?tab=integrations',
    },
    {
      id: 'epr',
      title: 'EPR',
      hint: 'UK packaging compliance: obligation, fees, submissions',
      meta: counts?.eprObligation ? counts.eprObligation.toUpperCase() : undefined,
      href: '/epr/',
    },
    scoreRow(
      'people',
      'People & culture',
      'Fair work, diversity, wellbeing and training',
      '/people-culture/',
      counts?.scores.people,
    ),
    scoreRow(
      'governance',
      'Governance',
      'Policies, the board, stakeholders and transparency',
      '/governance/',
      counts?.scores.governance,
    ),
    scoreRow(
      'community',
      'Community impact',
      'Giving, volunteering, local impact and the stories',
      '/community-impact/',
      counts?.scores.community,
    ),
    {
      id: 'byproducts',
      title: 'Byproducts',
      hint: 'What leaves the process and where it goes next',
      value: fig(counts?.byproducts),
      unit: counts ? 'RECORDED' : undefined,
      href: '/byproducts/',
    },
    {
      id: 'nature-actions',
      title: 'Nature actions',
      hint: 'The actions behind the nature assessment',
      value: fig(counts?.natureActions),
      unit: counts ? 'RECORDED' : undefined,
      href: '/nature-actions/',
    },
  ]

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage; open paper at the page foot. */}
      <div className="relative z-[1] mx-auto max-w-4xl space-y-10 pb-48">
      <Statement eyebrow="THE WIRING" headline="The quiet machinery." />

      <RoomSetupPanel room="wiring" />

      <PlanPoster counts={counts} />

      <section>
        <FactList items={rows} />
      </section>
      </div>
    </>
  )
}
