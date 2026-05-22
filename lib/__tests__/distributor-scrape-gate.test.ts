import { describe, it, expect } from 'vitest';
import { shouldSkipScrape } from '@/lib/distributor/scraping/should-skip-scrape';
import {
  SCRAPE_GATE_COMPLETENESS_THRESHOLD,
  SCRAPE_GATE_FRESHNESS_DAYS,
} from '@/lib/distributor/scraping/config';

interface FakeFixture {
  brandToDirectory: Map<string, string | null>;
  directoryCompleteness: Map<string, number | null>;
  /** ISO timestamp of the freshest non-superseded finding per directory id. */
  freshestFinding: Map<string, string | null>;
}

function fakeSupabase(fixture: FakeFixture): unknown {
  return {
    from(table: string) {
      let filters: Record<string, unknown> = {};
      let nextSelect: string | null = null;
      let nullCheck: { col: string; value: null } | null = null;
      let limit: number | null = null;
      const fluent: Record<string, unknown> = {
        select: (cols: string) => {
          nextSelect = cols;
          return fluent;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return fluent;
        },
        is: (col: string, val: unknown) => {
          if (val === null) nullCheck = { col, value: null };
          return fluent;
        },
        order: () => fluent,
        limit: (n: number) => {
          limit = n;
          return new Promise((resolve) => {
            resolve(respondList());
          });
        },
        maybeSingle: async () => respondSingle(),
      };

      function respondSingle() {
        if (table === 'brand_profiles' && filters.id) {
          const directoryId = fixture.brandToDirectory.get(filters.id as string);
          return {
            data: directoryId !== undefined ? { brand_directory_id: directoryId } : null,
            error: null,
          };
        }
        if (table === 'brand_directory' && filters.id) {
          const score = fixture.directoryCompleteness.get(filters.id as string);
          return {
            data: score !== undefined ? { completeness_score: score } : null,
            error: null,
          };
        }
        return { data: null, error: null };
      }

      function respondList() {
        if (
          table === 'scraped_brand_data' &&
          filters.brand_directory_id &&
          nullCheck?.col === 'superseded_by'
        ) {
          const ts = fixture.freshestFinding.get(filters.brand_directory_id as string) ?? null;
          if (ts === null) return { data: [], error: null };
          return { data: [{ scraped_at: ts }].slice(0, limit ?? 1), error: null };
        }
        return { data: [], error: null };
      }

      return fluent;
    },
  };
}

const DIRECTORY_AVALLEN = 'directory-avallen';
const BRAND_AVALLEN = 'brand-avallen';

function fixture(): FakeFixture {
  return {
    brandToDirectory: new Map([[BRAND_AVALLEN, DIRECTORY_AVALLEN]]),
    directoryCompleteness: new Map(),
    freshestFinding: new Map(),
  };
}

const recent = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const stale = () =>
  new Date(Date.now() - (SCRAPE_GATE_FRESHNESS_DAYS + 5) * 24 * 60 * 60 * 1000).toISOString();

describe('shouldSkipScrape', () => {
  it('skips when both completeness and freshness pass', async () => {
    const f = fixture();
    f.directoryCompleteness.set(DIRECTORY_AVALLEN, SCRAPE_GATE_COMPLETENESS_THRESHOLD + 5);
    f.freshestFinding.set(DIRECTORY_AVALLEN, recent());
    const supabase = fakeSupabase(f) as Parameters<typeof shouldSkipScrape>[0];
    const decision = await shouldSkipScrape(supabase, BRAND_AVALLEN);
    expect(decision.skip).toBe(true);
    expect(decision.reason).toBe('ok');
  });

  it('does not skip when completeness is below threshold', async () => {
    const f = fixture();
    f.directoryCompleteness.set(DIRECTORY_AVALLEN, SCRAPE_GATE_COMPLETENESS_THRESHOLD - 1);
    f.freshestFinding.set(DIRECTORY_AVALLEN, recent());
    const supabase = fakeSupabase(f) as Parameters<typeof shouldSkipScrape>[0];
    const decision = await shouldSkipScrape(supabase, BRAND_AVALLEN);
    expect(decision.skip).toBe(false);
    expect(decision.reason).toBe('completeness_low');
  });

  it('does not skip when data is older than the freshness window', async () => {
    const f = fixture();
    f.directoryCompleteness.set(DIRECTORY_AVALLEN, SCRAPE_GATE_COMPLETENESS_THRESHOLD + 5);
    f.freshestFinding.set(DIRECTORY_AVALLEN, stale());
    const supabase = fakeSupabase(f) as Parameters<typeof shouldSkipScrape>[0];
    const decision = await shouldSkipScrape(supabase, BRAND_AVALLEN);
    expect(decision.skip).toBe(false);
    expect(decision.reason).toBe('data_stale');
  });

  it('does not skip when no findings exist at all', async () => {
    const f = fixture();
    f.directoryCompleteness.set(DIRECTORY_AVALLEN, SCRAPE_GATE_COMPLETENESS_THRESHOLD + 5);
    // No freshestFinding entry => no rows.
    const supabase = fakeSupabase(f) as Parameters<typeof shouldSkipScrape>[0];
    const decision = await shouldSkipScrape(supabase, BRAND_AVALLEN);
    expect(decision.skip).toBe(false);
    expect(decision.reason).toBe('no_data');
  });

  it('handles brand_profiles without a directory link', async () => {
    const f = fixture();
    f.brandToDirectory.set(BRAND_AVALLEN, null);
    const supabase = fakeSupabase(f) as Parameters<typeof shouldSkipScrape>[0];
    const decision = await shouldSkipScrape(supabase, BRAND_AVALLEN);
    expect(decision.skip).toBe(false);
    expect(decision.reason).toBe('no_directory');
  });
});
