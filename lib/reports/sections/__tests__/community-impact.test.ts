import { describe, it, expect } from 'vitest';
import {
  mapCommunityImpact,
  pickLocalImpactRow,
  type CommunityImpactRaw,
  type CommunityLocalImpactRow,
} from '../community-impact';

const emptyRaw = (): CommunityImpactRaw => ({
  donations: [],
  volunteering: [],
  localImpact: [],
  engagements: [],
  stories: [],
});

describe('mapCommunityImpact', () => {
  it('returns nulls (not zeros) for an empty org, with genuine zero scores', () => {
    const out = mapCommunityImpact(emptyRaw());
    expect(out.totalDonations).toBeNull();
    expect(out.donationCount).toBeNull();
    expect(out.totalVolunteerHours).toBeNull();
    expect(out.volunteerActivities).toBeNull();
    expect(out.localEmploymentRate).toBeNull();
    expect(out.localSourcingRate).toBeNull();
    expect(out.impactStories).toEqual([]);
    expect(out.overallScore).toBe(0);
    expect(out.dataCompleteness).toBe(0);
  });

  it('sums giving without double-counting cash amounts and estimated values', () => {
    const raw = emptyRaw();
    raw.donations = [
      { donation_type: 'cash', donation_amount: 1000, estimated_value: null, recipient_cause: 'education' },
      // In-kind with only an estimate.
      { donation_type: 'in_kind', donation_amount: null, estimated_value: 250, recipient_cause: 'health' },
      // In-kind where an amount was recorded takes the amount, not amount+estimate.
      { donation_type: 'pro_bono', donation_amount: 400, estimated_value: 999, recipient_cause: null },
    ];
    const out = mapCommunityImpact(raw);
    expect(out.totalDonations).toBe(1650);
    expect(out.donationCount).toBe(3);
  });

  it('applies the story renames: story_type→category, media_urls[0]→photo, and keeps drafts out', () => {
    const raw = emptyRaw();
    raw.stories = [
      {
        title: 'River clean-up',
        story_type: 'environment',
        summary: 'Fifty volunteers cleared the riverbank.',
        content: 'Long form...',
        media_urls: ['https://cdn.example/river.jpg', 'https://cdn.example/extra.jpg'],
        is_published: true,
      },
      {
        title: 'No photo story',
        story_type: 'education',
        summary: null,
        content: 'The summary falls back to the content field when missing.',
        media_urls: null,
        is_published: true,
      },
      {
        title: 'Draft story',
        story_type: 'health',
        summary: 'Not ready.',
        content: null,
        media_urls: null,
        is_published: false,
      },
    ];
    const out = mapCommunityImpact(raw);
    expect(out.impactStories).toHaveLength(2);
    expect(out.impactStories[0]).toEqual({
      title: 'River clean-up',
      category: 'environment',
      summary: 'Fifty volunteers cleared the riverbank.',
      photo: 'https://cdn.example/river.jpg',
    });
    expect(out.impactStories[1].photo).toBeUndefined();
    expect(out.impactStories[1].summary).toContain('falls back to the content');
    expect(out.impactStories.map((s) => s.title)).not.toContain('Draft story');
  });

  it('derives local rates as 0-100 percentages and leaves them null when unmeasured', () => {
    const raw = emptyRaw();
    raw.localImpact = [
      {
        reporting_quarter: null,
        total_employees: 40,
        local_employees: 30,
        total_procurement_spend: 200000,
        local_procurement_spend: 50000,
        community_investment_total: 1000,
        updated_at: '2025-11-01',
      },
    ];
    const out = mapCommunityImpact(raw);
    expect(out.localEmploymentRate).toBe(75);
    expect(out.localSourcingRate).toBe(25);

    const partial = emptyRaw();
    partial.localImpact = [
      {
        reporting_quarter: null,
        total_employees: 40,
        local_employees: null, // employment side unmeasured
        total_procurement_spend: null,
        local_procurement_spend: null,
        community_investment_total: 0,
        updated_at: null,
      },
    ];
    const outPartial = mapCommunityImpact(partial);
    expect(outPartial.localEmploymentRate).toBeNull();
    expect(outPartial.localSourcingRate).toBeNull();
  });

  it('totals volunteer hours and keeps scores 0-100', () => {
    const raw = emptyRaw();
    raw.volunteering = [
      { activity_type: 'skills_based', total_volunteer_hours: 30, is_paid_time: true },
      { activity_type: 'general', total_volunteer_hours: 12.5, is_paid_time: false },
    ];
    raw.donations = [
      { donation_type: 'cash', donation_amount: 5000, estimated_value: null, recipient_cause: 'community' },
    ];
    const out = mapCommunityImpact(raw);
    expect(out.totalVolunteerHours).toBe(42.5);
    expect(out.volunteerActivities).toBe(2);
    for (const v of [
      out.overallScore,
      out.givingScore,
      out.localImpactScore,
      out.volunteeringScore,
      out.engagementScore,
      out.dataCompleteness,
    ]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(out.givingScore).toBeGreaterThan(1); // 0-100, not 0-1
  });
});

describe('pickLocalImpactRow', () => {
  const row = (over: Partial<CommunityLocalImpactRow>): CommunityLocalImpactRow => ({
    reporting_quarter: null,
    total_employees: null,
    local_employees: null,
    total_procurement_spend: null,
    local_procurement_spend: null,
    community_investment_total: null,
    updated_at: null,
    ...over,
  });

  it('prefers the annual row over quarterly rows', () => {
    const annual = row({ reporting_quarter: null, updated_at: '2025-01-01' });
    const q4 = row({ reporting_quarter: 4, updated_at: '2025-12-01' });
    expect(pickLocalImpactRow([q4, annual])).toBe(annual);
  });

  it('falls back to the most recently updated quarter', () => {
    const q2 = row({ reporting_quarter: 2, updated_at: '2025-07-01' });
    const q3 = row({ reporting_quarter: 3, updated_at: '2025-10-01' });
    expect(pickLocalImpactRow([q2, q3])).toBe(q3);
    expect(pickLocalImpactRow([])).toBeNull();
  });
});
