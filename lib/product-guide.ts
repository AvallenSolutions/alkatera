/**
 * Product Page Guide Configuration
 *
 * Defines the steps for Rosa's guided tour of the product detail page.
 * Each step targets an element via [data-guide="..."] attribute
 * and includes Rosa's conversational narration.
 */

export interface ProductGuideStep {
  /** The data-guide attribute value to target */
  targetSelector: string
  /** Rosa's conversational message for this step */
  rosa: string
  /** Where to position Rosa's card relative to the spotlight */
  popoverPosition: 'right' | 'below' | 'left' | 'center'
  /** Optional highlight animation on the target element */
  highlight?: 'pulse' | 'glow'
  /** Optional CTA buttons shown on the final step */
  actions?: Array<{ label: string; action: string; variant: 'primary' | 'ghost' }>
  /** Whether to skip this step on mobile (< 768px) */
  skipOnMobile?: boolean
}

export const PRODUCT_GUIDE_STEPS: ProductGuideStep[] = [
  {
    targetSelector: 'product-header',
    rosa: "This is your product dashboard — the command centre for everything about this product. You can see its name, category, and status at a glance. Hit 'Edit' to update any details.",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'product-calculate-btn',
    rosa: "This is the big one! Once you've added your ingredients and packaging, hit this button to calculate your product's carbon footprint. I'll run a full life cycle assessment using verified databases.",
    popoverPosition: 'below',
    highlight: 'glow',
  },
  {
    targetSelector: 'product-tabs',
    rosa: "Your product data is organised into tabs. Overview shows your impact results, Specification has your recipe, Facilities links to your production sites, Passport creates a public-facing report, and Settings lets you manage the product.",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'product-overview',
    rosa: "The Overview tab is where your environmental impact comes to life. Once you've run a calculation, you'll see your carbon footprint, water usage, circularity score, and more — all visualised beautifully.",
    popoverPosition: 'below',
  },
  {
    targetSelector: 'product-specification',
    rosa: "The Specification tab is where you build your product's recipe. Add ingredients with their origins and quantities, then add your packaging — bottles, labels, closures, everything. This data feeds directly into your LCA.",
    popoverPosition: 'below',
    skipOnMobile: true,
  },
  {
    targetSelector: 'product-passport-tab',
    rosa: "The Passport tab lets you create a beautiful, public-facing environmental report for this product. Share it with retailers, consumers, or add a QR code to your packaging. It's your transparency story.",
    popoverPosition: 'below',
    skipOnMobile: true,
  },
  {
    targetSelector: '',
    rosa: "You're ready to go! Start by adding your ingredients and packaging, then calculate your footprint. I'll be here to help at every step. Let's make this product's sustainability story shine!",
    popoverPosition: 'center',
    actions: [
      { label: 'Add Ingredients', action: 'open-ingredients', variant: 'primary' },
      { label: 'Explore on my own', action: 'close', variant: 'ghost' },
    ],
  },
]

/** Total number of guide steps (used for step indicator) */
export const TOTAL_PRODUCT_GUIDE_STEPS = PRODUCT_GUIDE_STEPS.length

/** Get steps filtered for current viewport */
export function getVisibleProductSteps(isMobile: boolean): ProductGuideStep[] {
  if (!isMobile) return PRODUCT_GUIDE_STEPS
  return PRODUCT_GUIDE_STEPS.filter(step => !step.skipOnMobile)
}
