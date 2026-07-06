'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { VitalityHero } from '@/components/vitality/VitalityHero'
import { PriorityTiles } from './PriorityTiles'
import { ProgressTracker } from './ProgressTracker'
import { ProductSpotlight } from './ProductSpotlight'
import { RecentlyFromRosa } from './RecentlyFromRosa'
import { RecentConversations } from './RecentConversations'
import { CircularPartnerships } from './CircularPartnerships'
import { NaturePositiveActions } from './NaturePositiveActions'
import { QuickActions } from './QuickActions'
import { QuickPrompts } from './QuickPrompts'
import { ForwardTimeline } from './ForwardTimeline'
// Round 2 (auto-research /rosa): the setup wizard only renders on first visit
// (showWizardOnly early-return); returning users never see it, so defer it.
const HubSetupWizard = dynamic(() => import('./HubSetupWizard').then((m) => m.HubSetupWizard), { ssr: false })
// Round 4 (auto-research /rosa): banner self-gates to null once onboarding is
// complete (most users), so defer it out of first load.
const OnboardingResumeBanner = dynamic(() => import('./OnboardingResumeBanner').then((m) => m.OnboardingResumeBanner), { ssr: false })
import { SustainableAINote } from './SustainableAINote'
import { CertificationHealthWidget } from '@/components/certifications/CertificationHealthWidget'
import { useHubLayout } from '@/lib/rosa/useHubLayout'
import { useAuth } from '@/hooks/useAuth'
import { Statement } from '@/components/studio/statement'

interface Props {
  onOpenQueue?: () => void
  onSubmit?: (prompt: string) => void
}

/**
 * /rosa/ hub — the page users land on after login.
 *
 * Visual hierarchy, top to bottom:
 *   1. Hero greeting (full width) — personalised to the user's first name,
 *      with today's date, a one-line summary of what's waiting, and a
 *      stylised dog avatar.
 *   2. Three priority tiles (3-up) — biggest numbers in the room: items
 *      waiting, next deadline, products without LCAs. Click-throughs.
 *   3. Two parallel columns (8/12 + 4/12) that flow independently:
 *      - Primary column: ProgressTracker, ForwardTimeline, QuickPrompts,
 *        RecentlyFromRosa.
 *      - Sidebar column: ProductSpotlight, QuickActions, RecentConversations.
 *      Each column stacks its visible cards with `space-y-5` and collapses
 *      cleanly if every card inside is hidden or returns null.
 *
 * Everything below the priority tiles is scrollable; everything from
 * the hero through the priority tiles fits above the fold on a 1080p
 * monitor.
 */
/** The brief's one sentence: a greeting by daypart, ending with a full stop. */
function useGreeting(): string {
  const { user } = useAuth()
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
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

export function ForYouToday({ onOpenQueue, onSubmit }: Props) {
  const handleAsk = (prompt: string) => {
    if (onSubmit) onSubmit(prompt)
  }
  const { isVisible, isLoading, layout } = useHubLayout()
  const greeting = useGreeting()

  // Decide whether the first-visit setup wizard should take over the page.
  // Mirrors HubSetupWizard's own gating so the page doesn't show both the
  // wizard and the (about-to-be-customised) hub at the same time.
  const [setupCompletedFlag, setSetupCompletedFlag] = useState<boolean | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setSetupCompletedFlag(localStorage.getItem('rosa_hub_setup_completed_v1') === 'true')
  }, [])
  const hasCustomLayout = isLoading ? null : layout.some(c => !c.visible)
  const showWizardOnly =
    setupCompletedFlag === false && hasCustomLayout === false

  if (showWizardOnly) {
    return (
      <div className="space-y-6">
        <HubSetupWizard onDone={() => setSetupCompletedFlag(true)} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Band, statement, paper: the brief opens with its one sentence. */}
      <Statement eyebrow={todayEyebrow()} headline={greeting} />

      <SustainableAINote />
      <OnboardingResumeBanner />
      {/* The vitality panel lives on the desk now (Tim, 6 July). */}
      <CertificationHealthWidget />

      {isVisible('priority_tiles') && <PriorityTiles onOpenQueue={onOpenQueue} />}

      {/* Two parallel columns. items-start keeps them independent so the
          taller column doesn't stretch the shorter one. [&:empty]:hidden
          collapses a column whose every card returned null or was hidden,
          so the other column doesn't get a phantom partner taking grid
          space. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5 [&:empty]:hidden">
          {isVisible('activity_pulse') && <ProgressTracker />}
          {isVisible('forward_timeline') && <ForwardTimeline />}
          {isVisible('quick_prompts') && <QuickPrompts onAsk={handleAsk} />}
          {isVisible('recently_from_rosa') && <RecentlyFromRosa />}
        </div>
        <div className="lg:col-span-4 space-y-5 [&:empty]:hidden">
          {isVisible('product_spotlight') && <ProductSpotlight />}
          {isVisible('quick_actions') && <QuickActions onOpenQueue={onOpenQueue} />}
          {isVisible('recent_conversations') && <RecentConversations />}
        </div>
      </div>

      {isVisible('circular_partnerships') && <CircularPartnerships />}
      {isVisible('nature_positive_actions') && <NaturePositiveActions />}
    </div>
  )
}
