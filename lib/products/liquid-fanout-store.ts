import { supabase } from '@/lib/supabaseClient';
import type { FanoutStore, MaterialRow } from './liquid-fanout';

/**
 * The Supabase-backed fan-out store. Kept apart from the rules in
 * `liquid-fanout` so those can be tested without a live connection.
 */
export const supabaseFanoutStore: FanoutStore = {
  async siblingsOf(liquidId, sourceProductId) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('liquid_id', liquidId)
      .neq('id', sourceProductId);
    if (error) throw error;
    return (data ?? []).map((row: any) => row.id as number);
  },

  async replaceIngredients(productId, rows: MaterialRow[]) {
    // Delete-then-insert rather than the keep-ids upsert the editor uses for
    // its own product: the sibling's rows have no correspondence to the ones
    // on screen, so there are no ids to keep. Scoped to ingredients, so the
    // sibling's own packaging is untouched.
    const { error: deleteError } = await supabase
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .eq('material_type', 'ingredient');
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
