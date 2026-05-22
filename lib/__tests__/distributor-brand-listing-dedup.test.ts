import { describe, it, expect, beforeEach } from 'vitest';
import { processSkuList } from '@/lib/distributor/sku-list-processor';

/**
 * Phase 4 acceptance: when the directory matcher resolves a new SKU
 * upload to a directory entry the distributor already lists, we must
 * UPDATE the existing brand_profiles row rather than INSERT a fresh
 * duplicate. The migration adds unique(distributor_org_id,
 * brand_directory_id) which would reject a duplicate insert at the DB
 * level, but the application should detect this case first so the
 * upload doesn't fail.
 *
 * These tests stub the supabase client + the directory matcher to
 * exercise both branches: existing-listing-update and new-listing-insert.
 */

const DISTRIBUTOR_ORG_ID = 'distributor-X';
const SKU_LIST_ID = 'sku-list-1';
const DIRECTORY_ID_AVALLEN = 'directory-avallen';

let inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
let updates: Array<{ table: string; rowId: string; patch: Record<string, unknown> }> = [];
let existingProfiles: Array<{
  id: string;
  distributor_org_id: string;
  brand_directory_id: string;
  website: string | null;
}> = [];

beforeEach(() => {
  inserts = [];
  updates = [];
  existingProfiles = [];
});

function fakeSupabase(): unknown {
  return {
    rpc: async (
      _name: string,
      params: { query_name?: string },
    ) => {
      // The matcher RPC always finds Avallen — that's the whole point of
      // these tests: the directory collapses both spellings onto the
      // canonical Avallen entry.
      if (params.query_name && /avallen/i.test(params.query_name)) {
        return {
          data: [
            {
              id: DIRECTORY_ID_AVALLEN,
              name: 'Avallen Spirits',
              normalized_name: 'avallenspirits',
              alkatera_org_id: null,
              similarity: 0.92,
              match_via: 'fuzzy' as const,
            },
          ],
          error: null,
        };
      }
      // Product matcher RPC: nothing in the test fixture, so always
      // return no candidate. The processor will fall back to inserting
      // a fresh product_directory row (handled by the from('product_directory')
      // branch below).
      return { data: [], error: null };
    },
    from(table: string) {
      const builder: Record<string, unknown> = {};
      let filters: Record<string, unknown> = {};
      let nextSelect: string | null = null;
      let updatePatch: Record<string, unknown> | null = null;
      let insertPatch: Record<string, unknown> | null = null;
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
          filters[col] = val;
          return fluent;
        },
        order: () => fluent,
        single: async () => respond(),
        maybeSingle: async () => respond(),
        update: (patch: Record<string, unknown>) => {
          updatePatch = patch;
          return fluent;
        },
        insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
          insertPatch = Array.isArray(row) ? row[0] : row;
          return fluent;
        },
        upsert: (row: Record<string, unknown>) => {
          // Older code path — should NOT be hit by Phase 4 processor.
          insertPatch = row;
          return fluent;
        },
      };

      async function respond() {
        if (table === 'brand_profiles' && updatePatch) {
          const id = filters.id as string;
          updates.push({ table, rowId: id, patch: updatePatch });
          const existing = existingProfiles.find((p) => p.id === id) ?? null;
          updatePatch = null;
          filters = {};
          nextSelect = null;
          return {
            data: existing
              ? { id: existing.id, website: existing.website }
              : null,
            error: existing ? null : { message: 'not_found' },
          };
        }
        if (table === 'brand_profiles' && insertPatch) {
          const row = {
            id: 'new-profile-' + (inserts.length + 1),
            website: (insertPatch as { website?: string | null }).website ?? null,
            distributor_org_id: insertPatch.distributor_org_id as string,
            brand_directory_id: insertPatch.brand_directory_id as string,
          };
          inserts.push({ table, row: insertPatch });
          existingProfiles.push(row);
          insertPatch = null;
          filters = {};
          nextSelect = null;
          return { data: { id: row.id, website: row.website }, error: null };
        }
        if (table === 'brand_profiles') {
          // SELECT path
          const match = existingProfiles.find(
            (p) =>
              p.distributor_org_id === filters.distributor_org_id &&
              p.brand_directory_id === filters.brand_directory_id,
          );
          filters = {};
          nextSelect = null;
          return { data: match ?? null, error: null };
        }
        if (table === 'brand_skus' && insertPatch) {
          inserts.push({ table, row: insertPatch });
          insertPatch = null;
          return { data: null, error: null };
        }
        if (table === 'brand_directory' && insertPatch) {
          // The matcher's create-fresh path. Tests below always hit the
          // "existing match" path so this should never run.
          throw new Error('test_should_not_create_directory_entry');
        }
        if (table === 'product_directory' && insertPatch) {
          // The product matcher's create-fresh path. This test fixture
          // doesn't exercise the product directory — every SKU just
          // gets a fresh canonical product silently so the brand-level
          // dedup assertions stay focused.
          const row = {
            id: 'product-new-' + (inserts.length + 1),
            name: (insertPatch as { name: string }).name,
          };
          inserts.push({ table, row: insertPatch });
          insertPatch = null;
          filters = {};
          nextSelect = null;
          return { data: row, error: null };
        }
        return { data: null, error: null };
      }

      return Object.assign(builder, fluent);
    },
  };
}

const MAPPING = {
  brand_name: 'brand',
  product_name: 'product',
  sku_code: null,
  category: null,
  country_of_origin: null,
  listing_status: null,
  website: null,
};

describe('processSkuList — Phase 4 dedup-on-write', () => {
  // The duplicate-prone case is two different normalised names that
  // both fuzzy-match the same canonical directory entry. (Names that
  // normalise to the same string already collide on the older
  // (distributor_org_id, normalized_name) upsert path — Phase 4 isn't
  // about those.) Use "Avallen" then "Avallen Cognac": different
  // normalised values, both resolve to the canonical Avallen directory
  // entry via the stubbed matcher.

  it('inserts a new brand_profiles listing on first upload', async () => {
    const supabase = fakeSupabase() as Parameters<typeof processSkuList>[0]['supabase'];
    const result = await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [{ brand: 'Avallen', product: 'Calvados' }],
      mapping: MAPPING,
    });
    expect(result.errors).toEqual([]);
    expect(result.brand_count).toBe(1);
    const profileInserts = inserts.filter((i) => i.table === 'brand_profiles');
    expect(profileInserts).toHaveLength(1);
    expect(profileInserts[0].row.brand_directory_id).toBe(DIRECTORY_ID_AVALLEN);
    expect(updates).toEqual([]);
  });

  it('updates the existing listing when a second upload resolves to the same directory entry', async () => {
    // First upload — establishes the listing.
    const supabase = fakeSupabase() as Parameters<typeof processSkuList>[0]['supabase'];
    await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [{ brand: 'Avallen', product: 'Calvados' }],
      mapping: MAPPING,
    });

    // Reset insert/update logs but keep existingProfiles so the
    // pre-existing listing is visible to the second upload.
    inserts = [];
    updates = [];

    // Second upload — different normalised name ("avallen cognac" vs
    // "avallen"), same canonical brand via fuzzy match.
    const result = await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [{ brand: 'Avallen Cognac', product: 'Apple Brandy' }],
      mapping: MAPPING,
    });
    expect(result.errors).toEqual([]);
    expect(result.brand_count).toBe(1);
    // No fresh brand_profiles INSERT — that would violate the new
    // unique(distributor_org_id, brand_directory_id) constraint.
    const profileInserts = inserts.filter((i) => i.table === 'brand_profiles');
    expect(profileInserts).toHaveLength(0);
    // Instead, the existing listing was updated with the latest spelling.
    expect(updates).toHaveLength(1);
    expect(updates[0].patch.name).toBe('Avallen Cognac');
    expect(updates[0].patch.normalized_name).toBe('avallen cognac');
  });
});
