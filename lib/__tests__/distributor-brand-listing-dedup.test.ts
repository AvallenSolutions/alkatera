import { describe, it, expect, beforeEach } from 'vitest';
import { processSkuList } from '@/lib/distributor/sku-list-processor';

/**
 * Phase 4 acceptance: when the directory matcher resolves a new SKU upload to
 * a directory entry the distributor already lists, the upload must not create
 * a second listing for that brand.
 *
 * The processor used to do a SELECT then a per-brand INSERT or UPDATE, and
 * these tests asserted on which of the two ran. It now does one bulk
 * `.upsert(payload, { onConflict: 'distributor_org_id,brand_directory_id' })`,
 * which is a better implementation (it replaced ~1-2k round-trips on a real
 * catalogue) but it made the old assertions meaningless: the mock had no
 * `.in()`, so the tests threw rather than failed, and sat red.
 *
 * Rewritten against the bulk-upsert shape. The guarantee under test is
 * unchanged and is now asserted directly: one row per directory entry, keyed
 * on the unique constraint, with a curated website never clobbered by a CSV.
 */

const DISTRIBUTOR_ORG_ID = 'distributor-X';
const SKU_LIST_ID = 'sku-list-1';
const DIRECTORY_ID_AVALLEN = 'directory-avallen';

interface ProfileRow {
  id: string;
  distributor_org_id: string;
  brand_directory_id: string;
  name?: string;
  normalized_name?: string;
  website: string | null;
}

/** Every upsert the processor issued, in order. */
let upserts: Array<{
  table: string;
  payload: Record<string, unknown>[];
  options: Record<string, unknown> | undefined;
}> = [];
let inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
/** Stands in for the brand_profiles table, and survives across uploads. */
let existingProfiles: ProfileRow[] = [];

beforeEach(() => {
  upserts = [];
  inserts = [];
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
      let filters: Record<string, unknown> = {};
      let inFilter: { col: string; values: unknown[] } | null = null;
      let insertPatch: Record<string, unknown> | null = null;
      let upsertPayload: Record<string, unknown>[] | null = null;
      let upsertOptions: Record<string, unknown> | undefined;

      const fluent: Record<string, unknown> = {
        select: () => fluent,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return fluent;
        },
        is: (col: string, val: unknown) => {
          filters[col] = val;
          return fluent;
        },
        in: (col: string, values: unknown[]) => {
          inFilter = { col, values };
          return fluent;
        },
        order: () => fluent,
        single: async () => respond(),
        maybeSingle: async () => respond(),
        insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
          insertPatch = Array.isArray(row) ? row[0] : row;
          return fluent;
        },
        upsert: (
          rows: Record<string, unknown> | Record<string, unknown>[],
          options?: Record<string, unknown>,
        ) => {
          upsertPayload = Array.isArray(rows) ? rows : [rows];
          upsertOptions = options;
          return fluent;
        },
        // The processor awaits the builder directly for the bulk calls
        // (no .single()), so it has to be thenable.
        then: (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) => respond().then(resolve, reject),
      };

      function reset() {
        filters = {};
        inFilter = null;
        insertPatch = null;
        upsertPayload = null;
        upsertOptions = undefined;
      }

      async function respond(): Promise<{ data: unknown; error: unknown }> {
        if (table === 'brand_profiles' && upsertPayload) {
          upserts.push({ table, payload: upsertPayload, options: upsertOptions });
          const returned: Array<{ id: string; brand_directory_id: string }> = [];
          for (const row of upsertPayload) {
            const dirId = row.brand_directory_id as string;
            const orgId = row.distributor_org_id as string;
            // Mirror the real unique(distributor_org_id, brand_directory_id):
            // a conflicting row updates in place instead of adding a second.
            const existing = existingProfiles.find(
              (p) => p.distributor_org_id === orgId && p.brand_directory_id === dirId,
            );
            if (existing) {
              Object.assign(existing, row);
              returned.push({ id: existing.id, brand_directory_id: dirId });
            } else {
              const created: ProfileRow = {
                ...(row as unknown as ProfileRow),
                id: 'profile-' + (existingProfiles.length + 1),
              };
              existingProfiles.push(created);
              returned.push({ id: created.id, brand_directory_id: dirId });
            }
          }
          reset();
          return { data: returned, error: null };
        }

        if (table === 'brand_profiles') {
          // The bulk existence check: select ... eq(org) in(brand_directory_id).
          const orgId = filters.distributor_org_id;
          const wanted = inFilter ? (inFilter as { values: unknown[] }).values : null;
          const matches = existingProfiles.filter(
            (p) =>
              p.distributor_org_id === orgId &&
              (wanted === null || wanted.includes(p.brand_directory_id)),
          );
          reset();
          return {
            data: matches.map((p) => ({
              id: p.id,
              brand_directory_id: p.brand_directory_id,
              website: p.website,
            })),
            error: null,
          };
        }

        if (table === 'brand_skus' && insertPatch) {
          inserts.push({ table, row: insertPatch });
          reset();
          return { data: null, error: null };
        }

        if (table === 'brand_directory' && insertPatch) {
          // The matcher's create-fresh path. These tests always hit the
          // "existing match" path, so this should never run.
          throw new Error('test_should_not_create_directory_entry');
        }

        if (table === 'product_directory' && insertPatch) {
          // The product matcher's create-fresh path. This fixture doesn't
          // exercise the product directory: every SKU just gets a fresh
          // canonical product so the brand-level assertions stay focused.
          const row = {
            id: 'product-new-' + (inserts.length + 1),
            name: (insertPatch as { name: string }).name,
          };
          inserts.push({ table, row: insertPatch });
          reset();
          return { data: row, error: null };
        }

        reset();
        return { data: null, error: null };
      }

      return fluent;
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

  it('creates a single brand_profiles listing on first upload', async () => {
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

    const profileUpserts = upserts.filter((u) => u.table === 'brand_profiles');
    expect(profileUpserts).toHaveLength(1);
    expect(profileUpserts[0].payload).toHaveLength(1);
    expect(profileUpserts[0].payload[0].brand_directory_id).toBe(DIRECTORY_ID_AVALLEN);
    expect(existingProfiles).toHaveLength(1);
  });

  it('keys the upsert on the unique constraint that prevents duplicates', async () => {
    // Without this onConflict target the upsert degrades to a plain insert
    // and the DB constraint rejects the second upload instead of merging it.
    const supabase = fakeSupabase() as Parameters<typeof processSkuList>[0]['supabase'];
    await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [{ brand: 'Avallen', product: 'Calvados' }],
      mapping: MAPPING,
    });

    const profileUpserts = upserts.filter((u) => u.table === 'brand_profiles');
    expect(profileUpserts[0].options).toMatchObject({
      onConflict: 'distributor_org_id,brand_directory_id',
    });
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

    // Reset the call logs but keep existingProfiles, so the listing the
    // first upload created is visible to the second one.
    inserts = [];
    upserts = [];

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

    // THE point of the test: the second upload must not add a second row
    // for the same directory entry. One upsert, one row in it, and the
    // table still holds exactly one listing afterwards.
    const profileUpserts = upserts.filter((u) => u.table === 'brand_profiles');
    expect(profileUpserts).toHaveLength(1);
    expect(profileUpserts[0].payload).toHaveLength(1);
    expect(profileUpserts[0].payload[0].brand_directory_id).toBe(DIRECTORY_ID_AVALLEN);
    expect(existingProfiles).toHaveLength(1);

    // The surviving listing carries the latest spelling. Normalised
    // collapses to "avallen" because the descriptor "Cognac" is stripped,
    // which is why the matcher treats the two uploads as one brand.
    expect(profileUpserts[0].payload[0].name).toBe('Avallen Cognac');
    expect(profileUpserts[0].payload[0].normalized_name).toBe('avallen');
  });

  it('collapses two spellings in the SAME upload into one payload row', async () => {
    // The cross-upload case is caught by the DB constraint via onConflict.
    // Within a single upload there is no constraint to lean on: the payload
    // is keyed by directory id, and if that keying breaks, one upsert call
    // carries two rows for the same brand and the DB rejects the batch.
    //
    // "Avallen Apple" is deliberate. "Avallen Cognac" would not exercise
    // this, because normalizeBrandName strips "cognac" as a descriptor so
    // both spellings land in the same bucket long before the payload is
    // built. "apple" is not a descriptor, so it survives normalisation and
    // the two rows only converge at the directory-id keying under test.
    const supabase = fakeSupabase() as Parameters<typeof processSkuList>[0]['supabase'];
    const result = await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [
        { brand: 'Avallen', product: 'Calvados' },
        { brand: 'Avallen Apple', product: 'Apple Brandy' },
      ],
      mapping: MAPPING,
    });
    expect(result.errors).toEqual([]);

    const profileUpserts = upserts.filter((u) => u.table === 'brand_profiles');
    expect(profileUpserts).toHaveLength(1);
    expect(profileUpserts[0].payload).toHaveLength(1);
    expect(profileUpserts[0].payload[0].brand_directory_id).toBe(DIRECTORY_ID_AVALLEN);
    expect(existingProfiles).toHaveLength(1);
  });

  it('never overwrites a curated website with a value from the CSV', async () => {
    // This is what the bulk existence check exists for: it reads the
    // websites already on file so the upsert payload can preserve them.
    const supabase = fakeSupabase() as Parameters<typeof processSkuList>[0]['supabase'];
    existingProfiles.push({
      id: 'profile-curated',
      distributor_org_id: DISTRIBUTOR_ORG_ID,
      brand_directory_id: DIRECTORY_ID_AVALLEN,
      website: 'https://www.avallenspirits.com',
    });

    await processSkuList({
      supabase,
      distributorOrgId: DISTRIBUTOR_ORG_ID,
      skuListId: SKU_LIST_ID,
      rows: [{ brand: 'Avallen', product: 'Calvados', site: 'https://spam.example.com' }],
      mapping: { ...MAPPING, website: 'site' },
    });

    const profileUpserts = upserts.filter((u) => u.table === 'brand_profiles');
    expect(profileUpserts[0].payload[0].website).toBe('https://www.avallenspirits.com');
    expect(existingProfiles).toHaveLength(1);
  });
});
