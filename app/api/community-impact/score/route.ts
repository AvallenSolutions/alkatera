import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Get the most recent score
    const { data: score, error } = await supabase
      .from('community_impact_scores')
      .select('*')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching community impact score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get score history
    const { data: history } = await supabase
      .from('community_impact_scores')
      .select('overall_score, calculated_at')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(12);

    return NextResponse.json({
      current: score || null,
      history: history || [],
    });
  } catch (error) {
    console.error('Error in GET /api/community-impact/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const organizationId = body.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Fetch all community impact data for scoring
    const currentYear = new Date().getFullYear();
    const [
      { data: donations },
      { data: volunteering },
      { data: localImpact },
      { data: engagements },
      { data: stories },
    ] = await Promise.all([
      supabase.from('community_donations').select('*').eq('organization_id', organizationId),
      supabase.from('community_volunteer_activities').select('*').eq('organization_id', organizationId),
      supabase.from('community_local_impact').select('*').eq('organization_id', organizationId).eq('reporting_year', currentYear),
      supabase.from('community_engagements').select('*').eq('organization_id', organizationId),
      supabase.from('community_impact_stories').select('*').eq('organization_id', organizationId),
    ]);

    // Calculate scores
    const scores = calculateCommunityImpactScore({
      donations: donations || [],
      volunteering: volunteering || [],
      localImpact: localImpact?.[0] || null,
      engagements: engagements || [],
      stories: stories || [],
    });

    // Store the score
    const { data: savedScore, error } = await supabase
      .from('community_impact_scores')
      .insert({
        organization_id: organizationId,
        overall_score: scores.overall_score,
        giving_score: scores.giving_score,
        local_impact_score: scores.local_impact_score,
        volunteering_score: scores.volunteering_score,
        engagement_score: scores.engagement_score,
        data_completeness: scores.data_completeness,
        calculation_period_start: `${currentYear}-01-01`,
        calculation_period_end: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving community impact score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(savedScore, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community-impact/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface CommunityData {
  donations: any[];
  volunteering: any[];
  localImpact: any | null;
  engagements: any[];
  stories: any[];
}

function calculateCommunityImpactScore(data: CommunityData) {
  let totalDataPoints = 0;
  let providedDataPoints = 0;

  // =========================================
  // Giving Score (30% weight)
  // =========================================
  let givingScore = 0;
  let givingComponents = 0;

  // Cash donations
  totalDataPoints++;
  const cashDonations = data.donations.filter(d => d.donation_type === 'cash');
  const totalCashDonated = cashDonations.reduce((sum, d) => sum + (d.donation_amount || 0), 0);
  if (cashDonations.length > 0) {
    // Score based on donation amount - B Corp suggests 1% of revenue minimum
    // Here we'll score based on having any donations + diversity of recipients
    givingScore += Math.min(100, (cashDonations.length * 10) + Math.min(50, totalCashDonated / 1000));
    givingComponents++;
    providedDataPoints++;
  }

  // In-kind and time donations
  totalDataPoints++;
  const otherDonations = data.donations.filter(d => ['in_kind', 'time', 'pro_bono'].includes(d.donation_type));
  if (otherDonations.length > 0) {
    givingScore += Math.min(100, otherDonations.length * 15);
    givingComponents++;
    providedDataPoints++;
  }

  // Diversity of causes supported
  totalDataPoints++;
  const causes = new Set(data.donations.map(d => d.recipient_cause).filter(Boolean));
  if (causes.size > 0) {
    givingScore += Math.min(100, causes.size * 20);
    givingComponents++;
    providedDataPoints++;
  }

  const finalGivingScore = givingComponents > 0 ? givingScore / givingComponents : 0;

  // =========================================
  // Local Impact Score (25% weight)
  // =========================================
  let localImpactScore = 0;
  let localImpactComponents = 0;

  if (data.localImpact) {
    totalDataPoints++;
    providedDataPoints++;

    // Local employment rate
    totalDataPoints++;
    if (data.localImpact.total_employees && data.localImpact.local_employees) {
      const localEmploymentRate = (data.localImpact.local_employees / data.localImpact.total_employees) * 100;
      localImpactScore += localEmploymentRate; // Already 0-100
      localImpactComponents++;
      providedDataPoints++;
    }

    // Local sourcing rate
    totalDataPoints++;
    if (data.localImpact.total_procurement_spend && data.localImpact.local_procurement_spend) {
      const localSourcingRate = (data.localImpact.local_procurement_spend / data.localImpact.total_procurement_spend) * 100;
      localImpactScore += localSourcingRate;
      localImpactComponents++;
      providedDataPoints++;
    }

    // Community investment
    totalDataPoints++;
    if (data.localImpact.community_investment_total > 0) {
      localImpactScore += Math.min(100, data.localImpact.community_investment_total / 100); // Scale based on amount
      localImpactComponents++;
      providedDataPoints++;
    }
  } else {
    totalDataPoints += 4; // Count the data points we would have checked
  }

  const finalLocalImpactScore = localImpactComponents > 0 ? localImpactScore / localImpactComponents : 0;

  // =========================================
  // Volunteering Score (25% weight)
  // =========================================
  let volunteeringScore = 0;
  let volunteeringComponents = 0;

  // Total volunteer hours
  totalDataPoints++;
  const totalVolunteerHours = data.volunteering.reduce((sum, v) => sum + (v.total_volunteer_hours || 0), 0);
  if (totalVolunteerHours > 0) {
    // B Corp benchmark: 20+ hours per employee per year
    volunteeringScore += Math.min(100, (totalVolunteerHours / 100) * 100);
    volunteeringComponents++;
    providedDataPoints++;
  }

  // Paid volunteer time policy
  totalDataPoints++;
  const hasPaidVolunteerTime = data.volunteering.some(v => v.is_paid_time);
  if (hasPaidVolunteerTime) {
    volunteeringScore += 100;
    volunteeringComponents++;
    providedDataPoints++;
  }

  // Skills-based volunteering
  totalDataPoints++;
  const skillsBased = data.volunteering.filter(v => v.activity_type === 'skills_based');
  if (skillsBased.length > 0) {
    volunteeringScore += Math.min(100, skillsBased.length * 25);
    volunteeringComponents++;
    providedDataPoints++;
  }

  const finalVolunteeringScore = volunteeringComponents > 0 ? volunteeringScore / volunteeringComponents : 0;

  // =========================================
  // Engagement Score (20% weight)
  // =========================================
  let engagementScore = 0;
  let engagementComponents = 0;

  // Community engagements
  totalDataPoints++;
  if (data.engagements.length > 0) {
    engagementScore += Math.min(100, data.engagements.length * 10);
    engagementComponents++;
    providedDataPoints++;
  }

  // Published impact stories
  totalDataPoints++;
  const publishedStories = data.stories.filter(s => s.is_published);
  if (publishedStories.length > 0) {
    engagementScore += Math.min(100, publishedStories.length * 20);
    engagementComponents++;
    providedDataPoints++;
  }

  const finalEngagementScore = engagementComponents > 0 ? engagementScore / engagementComponents : 0;

  // =========================================
  // Overall Score
  // =========================================
  const overallScore =
    finalGivingScore * 0.30 +
    finalLocalImpactScore * 0.25 +
    finalVolunteeringScore * 0.25 +
    finalEngagementScore * 0.20;

  const dataCompleteness = totalDataPoints > 0 ? (providedDataPoints / totalDataPoints) * 100 : 0;

  return {
    overall_score: Math.round(overallScore * 10) / 10,
    giving_score: Math.round(finalGivingScore * 10) / 10,
    local_impact_score: Math.round(finalLocalImpactScore * 10) / 10,
    volunteering_score: Math.round(finalVolunteeringScore * 10) / 10,
    engagement_score: Math.round(finalEngagementScore * 10) / 10,
    data_completeness: Math.round(dataCompleteness * 10) / 10,
  };
}
