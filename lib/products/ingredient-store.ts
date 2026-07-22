import { supabase } from '@/lib/supabaseClient';
import {
  escapeLikePattern,
  INGREDIENT_SELECT,
  type IngredientFacts,
  type IngredientStore,
} from './ingredient-records';

/**
 * The Supabase-backed `IngredientStore`. Kept apart from the pure logic in
 * `ingredient-records` so the find-or-create rules can be tested without a
 * live connection.
 */
export const supabaseIngredientStore: IngredientStore = {
  async findByName(organizationId, name) {
    // ilike with escaped wildcards, and limit(1) rather than maybeSingle():
    // maybeSingle throws when case-insensitive duplicates already exist, which
    // in the URL importer meant every subsequent import silently created yet
    // another duplicate.
    const { data, error } = await supabase
      .from('ingredients')
      .select(INGREDIENT_SELECT)
      .eq('organization_id', organizationId)
      .ilike('name', escapeLikePattern(name))
      .limit(1);

    if (error) {
      console.error('[ingredients] lookup failed:', error.message);
      throw error;
    }
    return (data?.[0] as any) ?? null;
  },

  async create(organizationId, name, facts) {
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ organization_id: organizationId, name, ...facts })
      .select('id')
      .single();

    if (error) {
      console.error('[ingredients] create failed:', error.message);
      throw error;
    }
    return data ?? null;
  },

  async update(id, facts: IngredientFacts) {
    const { error } = await supabase.from('ingredients').update(facts).eq('id', id);
    if (error) {
      console.error('[ingredients] update failed:', error.message);
      throw error;
    }
  },
};
