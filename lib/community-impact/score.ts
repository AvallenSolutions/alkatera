/**
 * Community Impact scoring — pure function lifted out of the API route
 * so it can also be called server-side from /api/vitality/composite without
 * relying on the persisted snapshot in `community_impact_scores`.
 *
 * Why pull it here: the snapshot table only refreshes when a user visits
 * the community-impact page (via the auto-calc-on-first-visit hook). When
 * an org adds donations or volunteer activities AFTER the initial visit,
 * the persisted snapshot goes stale and the composite reads zero. Computing
 * live from raw tables fixes that — snapshot becomes trend storage.
 *
 * Internal weighting (kept identical to the API route's prior behaviour):
 *   Giving 30%  ·  Local Impact 25%  ·  Volunteering 25%  ·  Engagement 20%
 */

export interface CommunityImpactData {
  donations: any[]
  volunteering: any[]
  localImpact: any | null
  engagements: any[]
  stories: any[]
}

export interface CommunityImpactScoreResult {
  overall_score: number
  giving_score: number
  local_impact_score: number
  volunteering_score: number
  engagement_score: number
  data_completeness: number
}

export function calculateCommunityImpactScore(
  data: CommunityImpactData,
): CommunityImpactScoreResult {
  let totalDataPoints = 0
  let providedDataPoints = 0

  // Giving (30%)
  let givingScore = 0
  let givingComponents = 0

  totalDataPoints++
  const cashDonations = data.donations.filter(d => d.donation_type === 'cash')
  const totalCashDonated = cashDonations.reduce(
    (sum, d) => sum + (d.donation_amount || 0),
    0,
  )
  if (cashDonations.length > 0) {
    givingScore += Math.min(
      100,
      cashDonations.length * 10 + Math.min(50, totalCashDonated / 1000),
    )
    givingComponents++
    providedDataPoints++
  }

  totalDataPoints++
  const otherDonations = data.donations.filter(d =>
    ['in_kind', 'time', 'pro_bono'].includes(d.donation_type),
  )
  if (otherDonations.length > 0) {
    givingScore += Math.min(100, otherDonations.length * 15)
    givingComponents++
    providedDataPoints++
  }

  totalDataPoints++
  const causes = new Set(
    data.donations.map(d => d.recipient_cause).filter(Boolean),
  )
  if (causes.size > 0) {
    givingScore += Math.min(100, causes.size * 20)
    givingComponents++
    providedDataPoints++
  }

  const finalGivingScore = givingComponents > 0 ? givingScore / givingComponents : 0

  // Local Impact (25%)
  let localImpactScore = 0
  let localImpactComponents = 0

  if (data.localImpact) {
    totalDataPoints++
    providedDataPoints++

    totalDataPoints++
    if (data.localImpact.total_employees && data.localImpact.local_employees) {
      const localEmploymentRate =
        (data.localImpact.local_employees / data.localImpact.total_employees) * 100
      localImpactScore += localEmploymentRate
      localImpactComponents++
      providedDataPoints++
    }

    totalDataPoints++
    if (
      data.localImpact.total_procurement_spend &&
      data.localImpact.local_procurement_spend
    ) {
      const localSourcingRate =
        (data.localImpact.local_procurement_spend /
          data.localImpact.total_procurement_spend) *
        100
      localImpactScore += localSourcingRate
      localImpactComponents++
      providedDataPoints++
    }

    totalDataPoints++
    if (data.localImpact.community_investment_total > 0) {
      localImpactScore += Math.min(
        100,
        data.localImpact.community_investment_total / 100,
      )
      localImpactComponents++
      providedDataPoints++
    }
  } else {
    totalDataPoints += 4
  }

  const finalLocalImpactScore =
    localImpactComponents > 0 ? localImpactScore / localImpactComponents : 0

  // Volunteering (25%)
  let volunteeringScore = 0
  let volunteeringComponents = 0

  totalDataPoints++
  const totalVolunteerHours = data.volunteering.reduce(
    (sum, v) => sum + (v.total_volunteer_hours || 0),
    0,
  )
  if (totalVolunteerHours > 0) {
    volunteeringScore += Math.min(100, (totalVolunteerHours / 100) * 100)
    volunteeringComponents++
    providedDataPoints++
  }

  totalDataPoints++
  const hasPaidVolunteerTime = data.volunteering.some(v => v.is_paid_time)
  if (hasPaidVolunteerTime) {
    volunteeringScore += 100
    volunteeringComponents++
    providedDataPoints++
  }

  totalDataPoints++
  const skillsBased = data.volunteering.filter(
    v => v.activity_type === 'skills_based',
  )
  if (skillsBased.length > 0) {
    volunteeringScore += Math.min(100, skillsBased.length * 25)
    volunteeringComponents++
    providedDataPoints++
  }

  const finalVolunteeringScore =
    volunteeringComponents > 0 ? volunteeringScore / volunteeringComponents : 0

  // Engagement (20%)
  let engagementScore = 0
  let engagementComponents = 0

  totalDataPoints++
  if (data.engagements.length > 0) {
    engagementScore += Math.min(100, data.engagements.length * 10)
    engagementComponents++
    providedDataPoints++
  }

  totalDataPoints++
  const publishedStories = data.stories.filter(s => s.is_published)
  if (publishedStories.length > 0) {
    engagementScore += Math.min(100, publishedStories.length * 20)
    engagementComponents++
    providedDataPoints++
  }

  const finalEngagementScore =
    engagementComponents > 0 ? engagementScore / engagementComponents : 0

  // Overall
  const overallScore =
    finalGivingScore * 0.3 +
    finalLocalImpactScore * 0.25 +
    finalVolunteeringScore * 0.25 +
    finalEngagementScore * 0.2

  const dataCompleteness =
    totalDataPoints > 0 ? (providedDataPoints / totalDataPoints) * 100 : 0

  return {
    overall_score: Math.round(overallScore * 10) / 10,
    giving_score: Math.round(finalGivingScore * 10) / 10,
    local_impact_score: Math.round(finalLocalImpactScore * 10) / 10,
    volunteering_score: Math.round(finalVolunteeringScore * 10) / 10,
    engagement_score: Math.round(finalEngagementScore * 10) / 10,
    data_completeness: Math.round(dataCompleteness * 10) / 10,
  }
}
