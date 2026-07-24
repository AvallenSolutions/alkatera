'use client'

import dynamic from 'next/dynamic'
import { BriefNumbers } from './BriefNumbers'
import { PriorityTiles } from './PriorityTiles'
import { ProgressTracker } from './ProgressTracker'
import { ProductSpotlight } from './ProductSpotlight'
import { RecentlyFromRosa } from './RecentlyFromRosa'
import { RecentConversations } from './RecentConversations'
import { CircularPartnerships } from './CircularPartnerships'
import { NaturePositiveActions } from './NaturePositiveActions'
import { ForwardTimeline } from './ForwardTimeline'
// The resume banner self-gates to null once onboarding is complete (most
// users), so it stays deferred out of the first load.
const OnboardingResumeBanner = dynamic(() => import('./OnboardingResumeBanner').then((m) => m.OnboardingResumeBanner), { ssr: false })
import { SustainableAINote } from './SustainableAINote'
import { CertificationHealthWidget } from '@/components/certifications/CertificationHealthWidget'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/data/useProfile'
import { firstNameFor } from '@/lib/user-name'
import { Eyebrow } from '@/components/studio/eyebrow'
import { Statement } from '@/components/studio/statement'

interface Props {
  onOpenQueue?: () => void
  onSubmit?: (prompt: string) => void
}

/**
 * The Brief (/rosa/): the page users land on after login, read top to
 * bottom like a printed morning note. One column, no dashboard grid, no
 * customise system: Rosa curates what appears.
 *
 *   1. The statement: date eyebrow, greeting.
 *   2. What needs you today: the top priority as the surface's one forest
 *      block, the rest as quiet fact rows (PriorityTiles).
 *   3. The day's reading: the tracked number with Rosa's read, the next
 *      14 days, what Rosa did recently.
 *   4. The good work: products, circular partnerships and nature actions,
 *      as typographic rows. Hidden entirely when there is nothing to show.
 *   5. The margins: recent conversations, certification health, and the
 *      sustainable-AI footnote.
 *
 * Asking Rosa happens in the ink band and the drawer, not on the page.
 */
/** The brief's one sentence: a greeting by daypart, ending with a full stop. */
function useGreeting(): string {
  const { user } = useAuth()
  const { profile } = useProfile()
  // Same three-source fallback as the desk, so the two greetings can never
  // disagree about what to call someone (see lib/user-name.ts).
  const firstName = firstNameFor({
    metadataFullName: user?.user_metadata?.full_name as string | undefined,
    profileFullName: profile?.full_name,
    email: user?.email,
  })
  const h = new Date().getHours()
  const daypart = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return `${daypart}${firstName ? `, ${firstName}` : ''}.`
}

/** Mono date for the eyebrow: "SATURDAY · 5 JULY". */
function todayEyebrow(): string {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' })
  const day = now.getDate()
  const month = now.toLocaleDateString('en-GB', { month: 'long' })
  return `${weekday} · ${day} ${month}`.toUpperCase()
}

export function ForYouToday({ onOpenQueue }: Props) {
  const greeting = useGreeting()

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* Band, statement, paper: the brief opens with its one sentence. */}
      <Statement eyebrow={todayEyebrow()} headline={greeting} />

      <OnboardingResumeBanner />

      {/* What needs you today: the one forest block, then quiet rows. */}
      <PriorityTiles onOpenQueue={onOpenQueue} />

      {/* The day's numbers: Pulse and Financial as doorway rows. */}
      <BriefNumbers />

      {/* The day's reading: each block carries its own quiet eyebrow. */}
      <ProgressTracker />
      <ForwardTimeline />
      <RecentlyFromRosa />

      {/* The good work: hidden entirely when there is nothing to show. */}
      <section className="[&:has(>div:empty)]:hidden">
        <Eyebrow className="mb-3 text-room-accent">The good work</Eyebrow>
        <div className="space-y-6">
          <ProductSpotlight />
          <CircularPartnerships />
          <NaturePositiveActions />
        </div>
      </section>

      {/* The margins: quiet, at the foot of the page. */}
      <section className="[&:has(>div:empty)]:hidden">
        <Eyebrow className="mb-3 text-room-accent">Recent conversations</Eyebrow>
        <div>
          <RecentConversations />
        </div>
      </section>
      <CertificationHealthWidget />
      <SustainableAINote />
    </div>
  )
}
