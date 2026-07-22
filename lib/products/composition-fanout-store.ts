import { supabase } from '@/lib/supabaseClient';
import type { CompositionKind, FanoutStore, MaterialRow } from './composition-fanout';

/**
 * How each half of the composition maps onto the database: which column on
 * `products` links to it, and which material rows it owns.
 *
 * A liquid owns the ingredient rows; a pack format owns the packaging rows.
 * Holding both in one table means a fan-out can never touch the wrong half:
 * editing a shared pack rewrites packaging and leaves every product's recipe
 * alone, and the reverse.
 */
export const COMPOSITION_TABLES: Record<
  CompositionKind,
  { linkColumn: 'liquid_id' | 'pack_format_id'; materialType: 'ingredient' | 'packaging' }
> = {
  liquid: { linkColumn: 'liquid_id', materialType: 'ingredient' },
  pack: { linkColumn: 'pack_format_id', materialType: 'packaging' },
};

/**
 * The Supabase-backed `FanoutStore` for one half of the composition. Kept
 * apart from the rules in `composition-fanout` so those can be tested without
 * a live connection.
 */
export function createFanoutStore(kind: CompositionKind): FanoutStore {
  const { linkColumn, materialType } = COMPOSITION_TABLES[kind];

  return {
    async siblingsOf(compositionId, sourceProductId) {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq(linkColumn, compositionId)
        .neq('id', sourceProductId);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.id as number);
    },

    async replaceIngredients(productId, rows: MaterialRow[]) {
      // Delete-then-insert rather than the keep-ids upsert the editor uses for
      // its own product: the sibling's rows have no correspondence to the ones
      // on screen, so there are no ids to keep. Scoped to this composition's
      // material type, so a pack fan-out never touches a recipe.
      const { error: deleteError } = await supabase
        .from('product_materials')
        .delete()
        .eq('product_id', productId)
        .eq('material_type', materialType);
      if (deleteError) throw deleteError;

      if (rows.length === 0) return;

      const { error: insertError } = await supabase.from('product_materials').insert(rows);
      if (insertError) throw insertError;
    },

    async requestRecalc(productId) {
      const response = await fetch(`/api/products/${productId}/recalc`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Recalculation request failed with ${response.status}`);
      }
    },
  };
}

/** The liquid's fan-out store, used by the recipe editor's ingredient save. */
export const liquidFanoutStore: FanoutStore = createFanoutStore('liquid');

/** The pack format's, used by the packaging save. */
export const packFanoutStore: FanoutStore = createFanoutStore('pack');
