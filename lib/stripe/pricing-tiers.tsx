import { Flower2, TreeDeciduous } from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Shared marketing copy for the three paid tiers, shown on both
 * /complete-subscription (the legacy standalone page, kept for mid-flight
 * users and edge cases) and the arrival ritual's ArrivalPlanStep. One source
 * of truth so pricing/copy edits never drift between the two.
 *
 * This is display copy, not the source of truth for actual billing — the
 * server-side price IDs and tier limits live in lib/stripe-config.ts and the
 * subscription_tier_limits table respectively.
 */

export type TierKey = 'seed' | 'blossom' | 'canopy'

export interface PricingTier {
  name: string
  tierKey: TierKey
  monthly: { original: number; founder: number; saving: number }
  annual: { original: number; founder: number; saving: number }
  tagline: string
  icon: ComponentType<{ className?: string }>
  limits: string[]
  features: string[]
  highlight: boolean
}

const SeedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 10a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6s6-2.7 6-6a6 6 0 0 0-6-6z" />
    <path d="M12 2v8" />
    <path d="M8 6c2-2 6-2 8 0" />
  </svg>
)

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Seed',
    tierKey: 'seed',
    monthly: { original: 199, founder: 99, saving: 100 },
    annual: { original: 1990, founder: 990, saving: 1000 },
    tagline: 'For boutique brands establishing their sustainability foundations.',
    icon: SeedIcon,
    limits: ['10 Products', '10 LCA Calculations', '2 Team Members', '2 Facilities', '10 Suppliers', '10 Reports/mo'],
    features: [
      'Carbon Footprint (GHG) per product',
      'Product Passport',
      'Rosa AI Assistant (25/mo)',
      'Company Emissions (Current Year)',
      'Dashboard & Vitality Score',
      'Greenwash Guardian (Website only)',
      'Knowledge Bank (Read)',
    ],
    highlight: false,
  },
  {
    name: 'Blossom',
    tierKey: 'blossom',
    monthly: { original: 399, founder: 249, saving: 150 },
    annual: { original: 3990, founder: 2490, saving: 1500 },
    tagline: 'For scaling brands ready to turn impact into a strategic advantage.',
    icon: Flower2,
    limits: ['30 Products', '30 LCA Calculations', '5 Team Members', '3 Facilities', '50 Suppliers', '50 Reports/mo'],
    features: [
      'Everything in Seed, plus:',
      'Full Scope 3 Categories',
      'Water, Circularity, Land Use & Resource impacts',
      'People & Culture, Community Impact modules',
      'Vehicle Registry & Supply Chain Mapping',
      'B Corp & CDP tracking',
      'Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)',
      'Knowledge Bank (Upload & Manage)',
    ],
    highlight: true,
  },
  {
    name: 'Canopy',
    tierKey: 'canopy',
    monthly: { original: 899, founder: 599, saving: 300 },
    annual: { original: 8990, founder: 5990, saving: 3000 },
    tagline: 'Comprehensive ecosystem management for established organisations.',
    icon: TreeDeciduous,
    limits: ['100 Products', '100 LCA Calculations', '10 Team Members', '10 Facilities', '200 Suppliers', '200 Reports/mo'],
    features: [
      'Everything in Blossom, plus:',
      'Impact Valuation: Monetise Your Sustainability Impact',
      'Gap Analysis, Audit Packages & Verification Support',
      'All ESG modules including Governance & Ethics',
      'Year-over-Year Comparisons',
      'Advanced Data Quality Scoring & EF 3.1',
      'Unlimited Rosa AI & Greenwash Guardian',
    ],
    highlight: false,
  },
]
