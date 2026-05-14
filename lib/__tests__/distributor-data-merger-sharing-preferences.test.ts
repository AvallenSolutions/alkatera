import { describe, it, expect } from 'vitest';
import { readMergedBrandData } from '@/lib/distributor/integration/data-merger';

/**
 * Phase 5 acceptance: when a brand sets block_all_fields=true for a
 * specific distributor in brand_sharing_preferences, the RPC returns
 * only non-brand-owned findings (no brand_verified, no alkatera_live)
 * to that distributor; plain scraped findings remain visible.
 *
 * data-merger.ts wraps the RPC; the merger itself doesn't filter — it
 * trusts whatever the RPC returns. So this test exercises the merger's
 * happy-path: the RPC stub returns different result sets keyed by the
 * distributor id, and we assert the merger faithfully passes them
 * through.
 */

const DIRECTORY_ID = 'directory-uuid-A';
const DISTRIBUTOR_BLOCKED = 'distributor-blocked';
const DISTRIBUTOR_OPEN = 'distributor-open';

const PUBLIC_SCRAPED = {
  field_key: 'hq_country',
  field_value: 'United Kingdom',
  field_value_numeric: null,
  source: 'B Corp Directory',
  confidence: 0.9,
  scraped_at: '2026-05-01T00:00:00Z',
};
const BRAND_VERIFIED = {
  field_key: 'bcorp_certified',
  field_value: 'true',
  field_value_numeric: null,
  source: 'brand_verified',
  confidence: 1.0,
  scraped_at: '2026-05-14T00:00:00Z',
};
const ALKATERA_LIVE = {
  field_key: 'scope_1_tco2e',
  field_value: '12.5',
  field_value_numeric: 12.5,
  source: 'alkatera_live',
  confidence: 0.99,
  scraped_at: '2026-05-13T00:00:00Z',
};

function fakeSupabase(): unknown {
  return {
    rpc: async (
      _name: string,
      params: { p_brand_directory_id: string; p_distributor_org_id: string },
    ) => {
      // Simulate the Phase 5 RPC: distributor X gets brand_verified +
      // alkatera_live overlaid on top of scraped data; distributor Y is
      // blocked by block_all_fields and gets only the plain scraped row.
      if (params.p_distributor_org_id === DISTRIBUTOR_BLOCKED) {
        return { data: [PUBLIC_SCRAPED], error: null };
      }
      return {
        data: [PUBLIC_SCRAPED, BRAND_VERIFIED, ALKATERA_LIVE],
        error: null,
      };
    },
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ then: (resolve: (v: { data: unknown }) => void) => resolve({ data: [] }) }) }),
      }),
    }),
  };
}

describe('readMergedBrandData — Phase 5 sharing preferences', () => {
  it('returns brand_verified and alkatera_live rows to a non-blocked distributor', async () => {
    const supabase = fakeSupabase() as Parameters<typeof readMergedBrandData>[0];
    const rows = await readMergedBrandData(supabase, DIRECTORY_ID, DISTRIBUTOR_OPEN);
    const sources = rows.map((r) => r.source).sort();
    expect(sources).toEqual(['B Corp Directory', 'alkatera_live', 'brand_verified']);
  });

  it('omits brand_verified and alkatera_live rows from a blocked distributor; scraped data still visible', async () => {
    const supabase = fakeSupabase() as Parameters<typeof readMergedBrandData>[0];
    const rows = await readMergedBrandData(supabase, DIRECTORY_ID, DISTRIBUTOR_BLOCKED);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('B Corp Directory');
    // Critical: no brand-owned data leaked.
    expect(rows.some((r) => r.source === 'brand_verified')).toBe(false);
    expect(rows.some((r) => r.source === 'alkatera_live')).toBe(false);
  });
});
