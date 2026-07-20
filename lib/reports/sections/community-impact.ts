/**
 * Community Impact report section fetcher.
 *
 * House pattern (lib/provenance/rollup.ts): `gatherCommunityImpact` does
 * ONLY I/O — no auth, the caller passes an already-scoped Supabase client —
 * and `mapCommunityImpact` is the pure, unit-testable half.
 *
 * YEAR POLICY: strict, except stories. Donations by reporting_year (set on
 * every write), volunteer activities by activity_date, local impact by
 * reporting_year, engagements by start_date — all within the report year.
 * Impact stories carry no year and are timeless by design, so the full
 * published set is available to any year's report.
 *
 * Computes LIVE from raw tables via lib/community-impact/score.ts — never
 * reads the community_impact_scores snapshot (that module exists precisely
 * because the snapshot goes stale). Renames per the report contract:
 * story_type→category, media_urls[0]→photo. All scores/rates 0-100; null
 * means not yet measured.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateCommunityImpactScore,
  // The scorer's input type name-collides with the renderer-facing payload
  // interface in ./types — alias it.
  type CommunityImpactData as CommunityImpactScoreInput,
} from '@/lib/community-impact/score';
import type { CommunityImpactData } from './types';

// ============================================================================
// Raw row shapes (only the columns the mapper reads)
// ============================================================================

export interface CommunityDonationRow {
  donation_type: string | null;
  donation_amount: number | null;
  estimated_value: number | null;
  recipient_cause: string | null;
}

export interface CommunityVolunteerRow {
  activity_type: string | null;
  total_volunteer_hours: number | null;
  is_paid_time: boolean | null;
}

export interface CommunityLocalImpactRow {
  reporting_quarter: number | null;
  total_employees: number | null;
  local_employees: number | null;
  total_procurement_spend: number | null;
  local_procurement_spend: number | null;
  community_investment_total: number | null;
  updated_at: string | null;
}

export interface CommunityEngagementRow {
  engagement_type: string | null;
  start_date: string | null;
}

export interface CommunityStoryRow {
  title: string | null;
  story_type: string | null;
  summary: string | null;
  content: string | null;
  media_urls: string[] | null;
  is_published: boolean | null;
}

export interface CommunityImpactRaw {
  donations: CommunityDonationRow[];
  volunteering: CommunityVolunteerRow[];
  /** All local-impact rows for the year (annual row and/or quarterly rows). */
  localImpact: CommunityLocalImpactRow[];
  engagements: CommunityEngagementRow[];
  /** Unfiltered by year (the stories exception). */
  stories: CommunityStoryRow[];
}

// ============================================================================
// Pure mapper
// ============================================================================

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The year can hold one annual row (reporting_quarter null) and/or quarterly
 * rows. Prefer the annual row; otherwise the most recently updated quarter.
 */
export function pickLocalImpactRow(
  rows: CommunityLocalImpactRow[],
): CommunityLocalImpactRow | null {
  if (rows.length === 0) return null;
  const annual = rows.filter((r) => r.reporting_quarter == null);
  const pool = annual.length > 0 ? annual : rows;
  return [...pool].sort((a, b) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
  )[0];
}

export function mapCommunityImpact(raw: CommunityImpactRaw): CommunityImpactData {
  const localImpact = pickLocalImpactRow(raw.localImpact);

  const score = calculateCommunityImpactScore({
    donations: raw.donations,
    volunteering: raw.volunteering,
    localImpact,
    engagements: raw.engagements,
    stories: raw.stories,
  } satisfies CommunityImpactScoreInput);

  // Total giving: cash rows contribute donation_amount; non-cash rows their
  // recorded amount or, failing that, the estimated value. Never both, so a
  // row cannot double-count.
  const totalDonations =
    raw.donations.length > 0
      ? round1(
          raw.donations.reduce((sum, d) => {
            if (d.donation_type === 'cash') return sum + (d.donation_amount || 0);
            return sum + (d.donation_amount ?? d.estimated_value ?? 0);
          }, 0),
        )
      : null;
  const donationCount = raw.donations.length > 0 ? raw.donations.length : null;

  const totalVolunteerHours =
    raw.volunteering.length > 0
      ? round1(
          raw.volunteering.reduce((sum, v) => sum + (v.total_volunteer_hours || 0), 0),
        )
      : null;
  const volunteerActivities =
    raw.volunteering.length > 0 ? raw.volunteering.length : null;

  // A published report only surfaces stories the org has marked published —
  // drafts stay out of the document (the scorer above still sees the full
  // set; it applies its own published filter internally).
  const impactStories = raw.stories
    .filter((s) => s.is_published === true)
    .map((s) => {
      const photo = s.media_urls?.[0];
      return {
        title: s.title ?? '',
        category: s.story_type ?? '',
        summary: s.summary ?? (s.content ? s.content.slice(0, 240) : ''),
        ...(photo ? { photo } : {}),
      };
    });

  const localEmploymentRate =
    localImpact &&
    localImpact.total_employees != null &&
    localImpact.total_employees > 0 &&
    localImpact.local_employees != null
      ? round1((localImpact.local_employees / localImpact.total_employees) * 100)
      : null;
  const localSourcingRate =
    localImpact &&
    localImpact.total_procurement_spend != null &&
    localImpact.total_procurement_spend > 0 &&
    localImpact.local_procurement_spend != null
      ? round1(
          (localImpact.local_procurement_spend / localImpact.total_procurement_spend) *
            100,
        )
      : null;

  return {
    overallScore: score.overall_score,
    givingScore: score.giving_score,
    localImpactScore: score.local_impact_score,
    volunteeringScore: score.volunteering_score,
    engagementScore: score.engagement_score,
    dataCompleteness: score.data_completeness,
    totalDonations,
    donationCount,
    totalVolunteerHours,
    volunteerActivities,
    impactStories,
    localEmploymentRate,
    localSourcingRate,
  };
}

// ============================================================================
// Gather (I/O only)
// ============================================================================

export async function gatherCommunityImpact(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<CommunityImpactData> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [donations, volunteering, localImpact, engagements, stories] =
    await Promise.all([
      supabase
        .from('community_donations')
        .select('donation_type, donation_amount, estimated_value, recipient_cause')
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('community_volunteer_activities')
        .select('activity_type, total_volunteer_hours, is_paid_time')
        .eq('organization_id', organizationId)
        .gte('activity_date', yearStart)
        .lte('activity_date', yearEnd),
      supabase
        .from('community_local_impact')
        .select(
          'reporting_quarter, total_employees, local_employees, total_procurement_spend, local_procurement_spend, community_investment_total, updated_at',
        )
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('community_engagements')
        .select('engagement_type, start_date')
        .eq('organization_id', organizationId)
        .gte('start_date', yearStart)
        .lte('start_date', yearEnd),
      // Stories are deliberately NOT year-filtered (they carry no year).
      supabase
        .from('community_impact_stories')
        .select('title, story_type, summary, content, media_urls, is_published')
        .eq('organization_id', organizationId),
    ]);

  for (const res of [donations, volunteering, localImpact, engagements, stories]) {
    if (res.error) throw new Error(`gatherCommunityImpact: ${res.error.message}`);
  }

  return mapCommunityImpact({
    donations: (donations.data ?? []) as CommunityDonationRow[],
    volunteering: (volunteering.data ?? []) as CommunityVolunteerRow[],
    localImpact: (localImpact.data ?? []) as CommunityLocalImpactRow[],
    engagements: (engagements.data ?? []) as CommunityEngagementRow[],
    stories: (stories.data ?? []) as CommunityStoryRow[],
  });
}
