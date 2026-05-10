'use client'

import { useEffect, useState } from 'react'
import { VitalityHero } from '@/components/vitality/VitalityHero'
import { PriorityTiles } from './PriorityTiles'
import { ProgressTracker } from './ProgressTracker'
import { ProductSpotlight } from './ProductSpotlight'
import { RecentlyFromRosa } from './RecentlyFromRosa'
import { RecentConversations } from './RecentConversations'
import { QuickActions } from './QuickActions'
import { QuickPrompts } from './QuickPrompts'
import { ForwardTimeline } from './ForwardTimeline'
import { HubSetupWizard } from './HubSetupWizard'
import { useHubLayout } from '@/lib/rosa/useHubLayout'

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
 *   3. Activity pulse + Product spotlight (8/12 + 4/12) — visual rather
 *      than text-heavy. 14-day activity bars and product cards with images.
 *   4. Quick prompts + Quick actions (6/12 + 6/12) — discoverability for
 *      what to ask Rosa and how to feed her data.
 *   5. Recently from Rosa + Recent conversations (6/12 + 6/12) — your
 *      day with Rosa at a glance.
 *
 * Everything below the priority tiles is scrollable; everything from
 * the hero through the priority tiles fits above the fold on a 1080p
 * monitor.
 */
export function ForYouToday({ onOpenQueue, onSubmit }: Props) {
  const handleAsk = (prompt: string) => {
    if (onSubmit) onSubmit(prompt)
  }
  const { isVisible, isLoading, layout } = useHubLayout()

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

  // Hide entire two-column rows when both cards in the row are hidden, so
  // we don't leave a gap. When only one of the pair is hidden the other
  // simply takes its column without expanding.
  const showActivityRow = isVisible('activity_pulse') || isVisible('forward_timeline') || isVisible('product_spotlight')
  const showPromptsRow = isVisible('quick_prompts') || isVisible('quick_actions')
  const showRecentRow = isVisible('recently_from_rosa') || isVisible('recent_conversations')

  if (showWizardOnly) {
    return (
      <div className="space-y-6">
        <HubSetupWizard onDone={() => setSetupCompletedFlag(true)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VitalityHero />

      {isVisible('priority_tiles') && <PriorityTiles onOpenQueue={onOpenQueue} />}

      {/* items-start prevents the grid from forcing each column to the
          row's tallest height. Without this, the left column's stacked
          ProgressTracker + ForwardTimeline overflows into the grid below
          when the right column (ProductSpotlight) is shorter. */}
      {showActivityRow && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {(isVisible('activity_pulse') || isVisible('forward_timeline')) && (
            <div className="lg:col-span-8 space-y-5">
              {isVisible('activity_pulse') && <ProgressTracker />}
              {isVisible('forward_timeline') && <ForwardTimeline />}
            </div>
          )}
          {isVisible('product_spotlight') && (
            <div className="lg:col-span-4">
              <ProductSpotlight />
            </div>
          )}
        </div>
      )}

      {showPromptsRow && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {isVisible('quick_prompts') && (
            <div className="lg:col-span-7">
              <QuickPrompts onAsk={handleAsk} />
            </div>
          )}
          {isVisible('quick_actions') && (
            <div className="lg:col-span-5">
              <QuickActions onOpenQueue={onOpenQueue} />
            </div>
          )}
        </div>
      )}

      {showRecentRow && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {isVisible('recently_from_rosa') && (
            <div className="lg:col-span-6">
              <RecentlyFromRosa />
            </div>
          )}
          {isVisible('recent_conversations') && (
            <div className="lg:col-span-6">
              <RecentConversations />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
