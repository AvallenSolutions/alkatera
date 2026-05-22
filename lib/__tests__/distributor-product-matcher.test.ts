import { describe, it, expect, beforeEach } from 'vitest';
import {
  findProductMatch,
  resolveOrCreateProductEntry,
  resolveProductsToDirectory,
  productMatchKey,
} from '@/lib/distributor/directory/product-matcher';
import { normalizeProductName, normalizeGtin } from '@/lib/distributor/brand-normalizer';

const BRAND_AVALLEN = 'brand-avallen';
const PRODUCT_CALVADOS = 'product-calvados';

interface FakeProduct {
  id: string;
  brand_directory_id: string;
  name: string;
  normalized_name: string;
  gtin: string | null;
  alkatera_product_id: string | null;
}

interface FakeState {
  products: FakeProduct[];
  inserts: Array<Record<string, unknown>>;
}

function fakeSupabase(state: FakeState): unknown {
  return {
    rpc: async (
      name: string,
      params: {
        p_brand_directory_id?: string;
        p_query_name?: string;
        p_gtin?: string | null;
        p_similarity_threshold?: number;
      },
    ) => {
      if (name !== 'match_product_directory') return { data: [], error: null };
      const norm = normalizeProductName(params.p_query_name ?? '');
      const gtin = normalizeGtin(params.p_gtin ?? null);
      const threshold = params.p_similarity_threshold ?? 0.85;

      const candidates = state.products
        .filter((p) => p.brand_directory_id === params.p_brand_directory_id)
        .map((p) => {
          if (gtin && p.gtin && p.gtin === gtin) {
            return { row: p, similarity: 1.0, match_via: 'gtin' as const };
          }
          if (norm && p.normalized_name === norm) {
            return { row: p, similarity: 1.0, match_via: 'exact_name' as const };
          }
          if (norm) {
            // Stand-in for pg_trgm similarity: ratio of shared words to
            // the larger word count. Keeps "avallen calvados 70cl" vs
            // "avallen vermouth 50cl" comfortably below 0.85, and exact
            // matches at 1.0.
            const a = new Set(norm.split(' ').filter(Boolean));
            const b = new Set(p.normalized_name.split(' ').filter(Boolean));
            let shared = 0;
            for (const w of a) if (b.has(w)) shared += 1;
            const denom = Math.max(a.size, b.size, 1);
            const similarity = shared / denom;
            return { row: p, similarity, match_via: 'fuzzy' as const };
          }
          return null;
        })
        .filter((c): c is { row: FakeProduct; similarity: number; match_via: 'gtin' | 'exact_name' | 'fuzzy' } => c !== null)
        .filter((c) => c.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      return {
        data: candidates.map((c) => ({
          id: c.row.id,
          name: c.row.name,
          normalized_name: c.row.normalized_name,
          gtin: c.row.gtin,
          alkatera_product_id: c.row.alkatera_product_id,
          similarity: c.similarity,
          match_via: c.match_via,
        })),
        error: null,
      };
    },
    from(table: string) {
      let insertRow: Record<string, unknown> | null = null;
      const fluent: Record<string, unknown> = {
        select: () => fluent,
        insert: (row: Record<string, unknown>) => {
          insertRow = row;
          return fluent;
        },
        single: async () => {
          if (table !== 'product_directory' || !insertRow) {
            return { data: null, error: { message: 'unexpected_table' } };
          }
          const newRow: FakeProduct = {
            id: 'product-new-' + (state.inserts.length + 1),
            brand_directory_id: insertRow.brand_directory_id as string,
            name: insertRow.name as string,
            normalized_name: insertRow.normalized_name as string,
            gtin: (insertRow.gtin as string) ?? null,
            alkatera_product_id: null,
          };
          state.products.push(newRow);
          state.inserts.push(insertRow);
          return { data: { id: newRow.id, name: newRow.name }, error: null };
        },
      };
      return fluent;
    },
  };
}

describe('product matcher', () => {
  let state: FakeState;

  beforeEach(() => {
    state = {
      products: [
        {
          id: PRODUCT_CALVADOS,
          brand_directory_id: BRAND_AVALLEN,
          name: 'Avallen Calvados 70cl',
          normalized_name: 'avallen calvados 70cl',
          gtin: '5060538740019',
          alkatera_product_id: null,
        },
      ],
      inserts: [],
    };
  });

  describe('findProductMatch', () => {
    it('matches by exact GTIN regardless of name', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof findProductMatch>[0];
      const match = await findProductMatch(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'Totally Different Product Name',
        gtin: '5060538740019',
      });
      expect(match).not.toBeNull();
      expect(match?.productDirectoryId).toBe(PRODUCT_CALVADOS);
      expect(match?.matchVia).toBe('gtin');
      expect(match?.similarity).toBe(1.0);
    });

    it('strips formatting from GTIN before matching', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof findProductMatch>[0];
      const match = await findProductMatch(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'irrelevant',
        gtin: '5 060 538 740 019',
      });
      expect(match?.matchVia).toBe('gtin');
    });

    it('matches by exact normalised name when GTIN absent', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof findProductMatch>[0];
      const match = await findProductMatch(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'Avallen Calvados, 70cl',
      });
      expect(match?.matchVia).toBe('exact_name');
    });

    it('does not cross brand boundaries', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof findProductMatch>[0];
      const match = await findProductMatch(supabase, {
        brandDirectoryId: 'brand-other',
        displayName: 'Avallen Calvados 70cl',
        gtin: '5060538740019',
      });
      expect(match).toBeNull();
    });

    it('returns null below threshold', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof findProductMatch>[0];
      const match = await findProductMatch(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'unrelated whisky',
      });
      expect(match).toBeNull();
    });
  });

  describe('resolveOrCreateProductEntry', () => {
    it('returns the existing entry when matched', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof resolveOrCreateProductEntry>[0];
      const result = await resolveOrCreateProductEntry(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'Avallen Calvados 70cl',
        gtin: '5060538740019',
      });
      expect(result.created).toBe(false);
      expect(result.productDirectoryId).toBe(PRODUCT_CALVADOS);
      expect(state.inserts).toHaveLength(0);
    });

    it('creates a fresh entry when no match exists', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof resolveOrCreateProductEntry>[0];
      const result = await resolveOrCreateProductEntry(supabase, {
        brandDirectoryId: BRAND_AVALLEN,
        displayName: 'Avallen Vermouth 50cl',
        gtin: '5060538740033',
      });
      expect(result.created).toBe(true);
      expect(result.matchVia).toBe('created');
      expect(state.inserts).toHaveLength(1);
      expect(state.inserts[0].gtin).toBe('5060538740033');
    });

    it('rejects products with empty normalised name and no GTIN', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof resolveOrCreateProductEntry>[0];
      await expect(
        resolveOrCreateProductEntry(supabase, {
          brandDirectoryId: BRAND_AVALLEN,
          displayName: '   ',
        }),
      ).rejects.toThrow(/empty/i);
    });
  });

  describe('resolveProductsToDirectory', () => {
    it('collapses duplicates within the upload to one resolution', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof resolveProductsToDirectory>[0];
      const result = await resolveProductsToDirectory(
        supabase,
        [
          { brandDirectoryId: BRAND_AVALLEN, displayName: 'Avallen Calvados 70cl', gtin: '5060538740019' },
          { brandDirectoryId: BRAND_AVALLEN, displayName: 'Avallen Calvados 70cl', gtin: '5060538740019' },
          { brandDirectoryId: BRAND_AVALLEN, displayName: 'Avallen Calvados 70cl' },
        ],
        'distributor-X',
      );
      // Two unique keys: one with GTIN, one without. Both should hit
      // the same product_directory row, neither should create.
      expect(state.inserts).toHaveLength(0);
      expect(result.size).toBeGreaterThanOrEqual(1);
    });

    it('creates separate entries for products with different GTINs', async () => {
      const supabase = fakeSupabase(state) as Parameters<typeof resolveProductsToDirectory>[0];
      await resolveProductsToDirectory(
        supabase,
        [
          { brandDirectoryId: BRAND_AVALLEN, displayName: 'Avallen Vermouth 50cl', gtin: '5060538740033' },
          { brandDirectoryId: BRAND_AVALLEN, displayName: 'Avallen Vermouth 75cl', gtin: '5060538740040' },
        ],
        'distributor-X',
      );
      expect(state.inserts).toHaveLength(2);
    });
  });

  describe('productMatchKey', () => {
    it('treats blank GTIN and missing GTIN the same', () => {
      expect(productMatchKey(BRAND_AVALLEN, 'Avallen Calvados', '')).toBe(
        productMatchKey(BRAND_AVALLEN, 'Avallen Calvados', null),
      );
    });

    it('keys are brand-scoped', () => {
      expect(productMatchKey('brand-a', 'X', null)).not.toBe(
        productMatchKey('brand-b', 'X', null),
      );
    });
  });
});
