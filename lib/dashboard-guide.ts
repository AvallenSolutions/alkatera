/**
 * Dashboard Guide Configuration
 *
 * Defines the steps for Rosa's post-onboarding dashboard tour.
 * Each step targets an element via [data-guide="..."] attribute
 * and includes Rosa's conversational narration.
 */

export interface GuideStep {
  /** The data-guide attribute value to target */
  targetSelector: string
  /** Rosa's conversational message for this step */
  rosa: string
  /** Where to position Rosa's card relative to the spotlight */
  popoverPosition: 'right' | 'below' | 'left' | 'center'
  /** Optional highlight animation on the target element */
  highlight?: 'pulse' | 'glow'
  /** Optional CTA buttons shown on the final step */
  actions?: Array<{ label: string; href: string; variant: 'primary' | 'ghost' }>
  /** Whether to skip this step on mobile (< 768px) */
  skipOnMobile?: boolean
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    targetSelector: 'sidebar-nav',
    rosa: "Welcome to your dashboard! Let me show you around. This is your navigation — everything lives here. Facilities, products, reports... I've organised it all for you.",
    popoverPosition: 'right',
    highlight: 'pulse',
    skipOnMobile: true,
  },
  {
    targetSelector: 'vitality-score',
    rosa: "This is your Vitality Score — think of it as your sustainability health check. It tracks four pillars: Climate, Water, Circularity, and Nature. Right now it's waiting for your data — watch it come alive as you add more!",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'kpi-cards',
    rosa: "These cards are your early warning system. Green means you're doing great, amber means there's room to improve, and red means something needs attention. I'll keep an eye on these for you.",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'priority-actions',
    rosa: "I analyse your data and surface the most impactful actions you should take next. Think of this as your sustainability to-do list — always prioritised, always up to date.",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'quick-actions',
    rosa: "Need to do something quickly? These shortcuts take you straight to the most common tasks — adding products, logging emissions, managing suppliers.",
    popoverPosition: 'left',
  },
  {
    targetSelector: 'rosa-link',
    rosa: "And this is where you'll find me! Click here anytime to ask me anything — 'what's my biggest emission source?', 'help me prepare for B Corp', or even just 'what should I do next?'",
    popoverPosition: 'right',
    highlight: 'glow',
    skipOnMobile: true,
  },
  {
    targetSelector: '',
    rosa: "You're all set! Your dashboard will fill with real insights as you add data. I'd recommend starting with a facility or your first product. I'll be right here if you need me.",
    popoverPosition: 'center',
    actions: [
      { label: 'Add a Facility', href: '/company/facilities', variant: 'primary' },
      { label: 'Explore on my own', href: '', variant: 'ghost' },
    ],
  },
]

/** Total number of guide steps (used for step indicator) */
export const TOTAL_GUIDE_STEPS = GUIDE_STEPS.length

/** Get steps filtered for current viewport */
export function getVisibleSteps(isMobile: boolean): GuideStep[] {
  if (!isMobile) return GUIDE_STEPS
  return GUIDE_STEPS.filter(step => !step.skipOnMobile)
}
