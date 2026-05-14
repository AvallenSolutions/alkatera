import { describe, it, expect } from 'vitest';
import {
  pickActivePerField,
  readMergedBrandData,
  type MergedFieldRow,
} from '@/lib/distributor/integration/data-merger';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

/**
 * Phase 3 acceptance: a brand_verified finding written against one
 * brand_directory entry must be visible to every distributor that
 * lists that brand. The data-merger is the read path; if it queries
 * by brand_directory_id rather than the per-distributor listing id,
 * cross-listing visibility falls out for free.
 *
 * These tests stub a SupabaseClient and assert two distributors with
 * different listing ids — but the same canonical directory id — both
 * see the brand-verified value.
 */

interface FakeQuery {
  rpc: ReturnType<typeof rpcStub>;
  fromBuilder: (rows: unknown[]) => unknown;
}

function rpcStub(rows: unknown[]) {
  return async () => ({ data: rows, error: null });
}

function fakeSupabase(opts: {
  rpcRows?: Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source: string;
    confidence: number;
    scraped_at: string;
  }>;
  rpcError?: { message: string } | null;
  fallbackRows?: Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
    scraped_at: string;
  }>;
}): unknown {
  return {
    rpc: async (
      _name: string,
      params: { p_brand_directory_id: string; p_distributor_org_id: string },
    ) => {
      // Echo the directory id into a sentinel so tests can assert it.
      capturedRpcCalls.push(params);
      if (opts.rpcError) return { data: null, error: opts.rpcError };
      return { data: opts.rpcRows ?? [], error: null };
    },
    from: (_table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        async then(resolve: (value: { data: unknown }) => void) {
          resolve({ data: opts.fallbackRows ?? [] });
        },
      } as unknown as { then: (...args: unknown[]) => void };
      return builder;
    },
  };
}

let capturedRpcCalls: Array<{ p_brand_directory_id: string; p_distributor_org_id: string }> = [];

describe('readMergedBrandData (Phase 3 cross-listing)', () => {
  it('queries the RPC with brand_directory_id, not brand_profile_id', async () => {
    capturedRpcCalls = [];
    const supabase = fakeSupabase({
      rpcRows: [
        {
          field_key: 'bcorp_certified',
          field_value: 'true',
          field_value_numeric: null,
          source: 'brand_verified',
          confidence: 1.0,
          scraped_at: '2026-05-14T00:00:00Z',
        },
      ],
    }) as Parameters<typeof readMergedBrandData>[0];

    await readMergedBrandData(supabase, 'directory-uuid-A', 'distributor-X');
    expect(capturedRpcCalls).toEqual([
      { p_brand_directory_id: 'directory-uuid-A', p_distributor_org_id: 'distributor-X' },
    ]);
  });

  it('returns the same brand_verified value for two distributors of the same directory', async () => {
    const verifiedRow = {
      field_key: 'bcorp_certified',
      field_value: 'true',
      field_value_numeric: null,
      source: 'brand_verified',
      confidence: 1.0,
      scraped_at: '2026-05-14T00:00:00Z',
    };
    const supabase = fakeSupabase({ rpcRows: [verifiedRow] }) as Parameters<typeof readMergedBrandData>[0];

    const aRows = await readMergedBrandData(supabase, 'directory-uuid-A', 'distributor-X');
    const bRows = await readMergedBrandData(supabase, 'directory-uuid-A', 'distributor-Y');

    // Identical rows for both distributors — the RPC is keyed by
    // directory id, so per-distributor scoping doesn't filter the
    // canonical findings (only the alkatera_live overlay, which is
    // gated server-side via brand_distributor_links).
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    expect(aRows[0]).toEqual({
      field_key: 'bcorp_certified',
      field_value: 'true',
      field_value_numeric: null,
      source: 'brand_verified',
      confidence: 1,
      scraped_at: '2026-05-14T00:00:00Z',
    });
    expect(aRows[0]).toEqual(bRows[0]);
  });

  it('falls back to a directory-keyed scraped_brand_data read when the RPC is missing', async () => {
    const supabase = fakeSupabase({
      rpcError: { message: 'function get_brand_data_for_distributor does not exist' },
      fallbackRows: [
        {
          field_key: 'hq_country',
          field_value: 'United Kingdom',
          field_value_numeric: null,
          source_name: 'B Corp Directory',
          confidence: 0.9,
          scraped_at: '2026-05-14T00:00:00Z',
        },
      ],
    }) as Parameters<typeof readMergedBrandData>[0];

    const rows = await readMergedBrandData(supabase, 'directory-uuid-A', 'distributor-X');
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('B Corp Directory');
  });
});

describe('pickActivePerField precedence', () => {
  it('brand_verified beats alkatera_live and beats higher-confidence scraped', () => {
    const rows: MergedFieldRow[] = [
      {
        field_key: 'bcorp_certified' as FieldKey,
        field_value: 'true',
        field_value_numeric: null,
        source: 'B Corp Directory',
        confidence: 0.95,
        scraped_at: '2026-05-01T00:00:00Z',
      },
      {
        field_key: 'bcorp_certified' as FieldKey,
        field_value: 'true',
        field_value_numeric: null,
        source: 'alkatera_live',
        confidence: 0.99,
        scraped_at: '2026-05-10T00:00:00Z',
      },
      {
        field_key: 'bcorp_certified' as FieldKey,
        field_value: 'false',
        field_value_numeric: null,
        source: 'brand_verified',
        confidence: 1.0,
        scraped_at: '2026-05-14T00:00:00Z',
      },
    ];
    const winner = pickActivePerField(rows).get('bcorp_certified' as FieldKey);
    expect(winner?.source).toBe('brand_verified');
    expect(winner?.field_value).toBe('false');
  });
});
