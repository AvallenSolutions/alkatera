import Stripe from 'stripe';

/**
 * Stripe Configuration and Helper Functions
 *
 * This module provides:
 * - Stripe client initialization
 * - Price ID mappings for subscription tiers
 * - Helper functions for tier/price conversions
 */

// ============================================================================
// Stripe Client Initialization
// ============================================================================

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// ============================================================================
// Subscription Tier Definitions
// ============================================================================

export type SubscriptionTier = 'seed' | 'blossom' | 'canopy';
export type BillingInterval = 'monthly' | 'annual';

export interface TierPricing {
  tier: SubscriptionTier;
  displayName: string;
  monthlyPriceId: string;
  annualPriceId: string;
  monthlyPrice: number; // in GBP
  annualPrice: number; // in GBP (10 months - 2 months free)
  description: string;
  features: string[];
  limits: {
    products: number;
    lcas: number;
    teamMembers: number;
    facilities: number;
    suppliers: number;
    reportsPerMonth: number;
  };
}

export const TIER_PRICING: Record<SubscriptionTier, TierPricing> = {
  seed: {
    tier: 'seed',
    displayName: 'Seed',
    monthlyPriceId: 'price_1SjQkLS6ESxgnZl2F62rcpVd',
    annualPriceId: 'price_1SmfD6S6ESxgnZl2D3ELCThW',
    monthlyPrice: 149,
    annualPrice: 1490, // 10 months (2 months free)
    description: 'Perfect for startups and small businesses beginning their sustainability journey',
    features: [
      'ReCiPe 2016 methodology',
      'GHG emissions module',
      'Live passport analytics',
      'Email support',
      'Automated verification',
    ],
    limits: {
      products: 5,
      lcas: 5,
      teamMembers: 1,
      facilities: 1,
      suppliers: 5,
      reportsPerMonth: 10,
    },
  },
  blossom: {
    tier: 'blossom',
    displayName: 'Blossom',
    monthlyPriceId: 'price_1SjQlgS6ESxgnZl2c9QYw7QI',
    annualPriceId: 'price_1SmfE0S6ESxgnZl2rW18ZxV7',
    monthlyPrice: 399,
    annualPrice: 3990, // 10 months (2 months free)
    description: 'For growing businesses ready to expand their environmental impact tracking',
    features: [
      'ReCiPe 2016 + EF 3.1 methodologies',
      'GHG + Water + Waste modules',
      'Monthly analytics reporting',
      'PEF compliance reports',
      'API access (5,000 calls/month)',
      'Email support',
    ],
    limits: {
      products: 20,
      lcas: 20,
      teamMembers: 5,
      facilities: 3,
      suppliers: 25,
      reportsPerMonth: 50,
    },
  },
  canopy: {
    tier: 'canopy',
    displayName: 'Canopy',
    monthlyPriceId: 'price_1SjQmXS6ESxgnZl2SWd2nHga',
    annualPriceId: 'price_1SmfEqS6ESxgnZl2FugLcZSr',
    monthlyPrice: 899,
    annualPrice: 8990, // 10 months (2 months free)
    description: 'Comprehensive sustainability management for established organisations',
    features: [
      'All methodologies (ReCiPe 2016, EF 3.1, EF 3.1 Single Score)',
      'All modules: GHG, Water, Waste, Biodiversity, B Corp',
      'Sandbox analytics environment',
      'Priority chat support',
      'Verified data certification',
      'Custom weighting sets',
      'White-label reports',
      'Unlimited API access',
    ],
    limits: {
      products: 50,
      lcas: 50,
      teamMembers: 10,
      facilities: 8,
      suppliers: 100,
      reportsPerMonth: 200,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  for (const [tier, pricing] of Object.entries(TIER_PRICING)) {
    if (pricing.monthlyPriceId === priceId || pricing.annualPriceId === priceId) {
      return tier as SubscriptionTier;
    }
  }
  // Default to seed if price ID not found
  return 'seed';
}

/**
 * Get price ID from tier and billing interval
 */
export function getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
  const pricing = TIER_PRICING[tier];
  return interval === 'annual' ? pricing.annualPriceId : pricing.monthlyPriceId;
}

/**
 * Get billing interval from price ID
 */
export function getBillingIntervalFromPriceId(priceId: string): BillingInterval {
  for (const pricing of Object.values(TIER_PRICING)) {
    if (pricing.annualPriceId === priceId) {
      return 'annual';
    }
    if (pricing.monthlyPriceId === priceId) {
      return 'monthly';
    }
  }
  return 'monthly'; // Default
}

/**
 * Get all available tiers with pricing info
 */
export function getAllTiers(): TierPricing[] {
  return Object.values(TIER_PRICING);
}

/**
 * Get pricing info for a specific tier
 */
export function getTierPricing(tier: SubscriptionTier): TierPricing {
  return TIER_PRICING[tier];
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate savings for annual billing
 */
export function calculateAnnualSavings(tier: SubscriptionTier): number {
  const pricing = TIER_PRICING[tier];
  const monthlyTotal = pricing.monthlyPrice * 12;
  const annualTotal = pricing.annualPrice;
  return monthlyTotal - annualTotal;
}
