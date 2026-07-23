import type { TierKey } from '@/lib/stripe/pricing-tiers'

/**
 * Which plan to recommend on the arrival ritual's last screen, from what the
 * ritual already captured. Plain threshold logic against the same caps the tier
 * cards show — never a dark pattern, and the caller names the numbers it used.
 * Most arrivals (a few products, one site, a small team) land on Seed; a bigger
 * range or team steps up. Pure so the thresholds can be unit-tested.
 */

export interface RecommendationInputs {
  productCount: number
  teamSize?: string
  hasFacility?: boolean
}

export function recommendTier(inputs: RecommendationInputs): TierKey {
  const { productCount, teamSize } = inputs
  if (productCount > 30 || teamSize === '201-1000' || teamSize === '1000+') return 'canopy'
  if (productCount > 10 || teamSize === '51-200') return 'blossom'
  return 'seed'
}

/** A human phrase for the team-size bucket, or null when unknown. */
export function teamPhrase(size: string | undefined): string | null {
  switch (size) {
    case '1-10': return 'a small team'
    case '11-50': return 'a growing team'
    case '51-200': return 'a mid-sized team'
    case '201-1000': return 'a large team'
    case '1000+': return 'a large organisation'
    default: return null
  }
}

/**
 * The one-sentence reason shown next to the recommendation, e.g.
 * "You have 3 products, one site and a small team. Seed covers it with room to
 * grow." Names the real signals, so the pick reads as reasoning, not a nudge.
 */
export function buildRecommendationReason(inputs: RecommendationInputs & { tierName: string }): string {
  const { productCount, hasFacility, teamSize, tierName } = inputs
  const bits: string[] = []
  bits.push(productCount > 0 ? `${productCount} product${productCount === 1 ? '' : 's'}` : 'a fresh catalogue')
  if (hasFacility) bits.push('one site')
  const team = teamPhrase(teamSize)
  if (team) bits.push(team)
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]
  return `You have ${list}. ${tierName} covers it with room to grow.`
}
