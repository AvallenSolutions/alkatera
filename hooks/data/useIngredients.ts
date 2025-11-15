import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { IngredientWithSubStage } from '@/lib/types/lca';

interface UseIngredientsResult {
  ingredients: IngredientWithSubStage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useIngredients(organizationId: string | undefined): UseIngredientsResult {
  const [ingredients, setIngredients] = useState<IngredientWithSubStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIngredients = async () => {
    if (!organizationId) {
      setIngredients([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ingredients')
        .select(`
          id,
          organization_id,
          name,
          description,
          lca_sub_stage_id,
          created_at,
          updated_at,
          lca_sub_stages!lca_sub_stage_id(
            id,
            name,
            description
          )
        `)
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const transformedData: IngredientWithSubStage[] = (data || []).map((item: any) => ({
        id: item.id,
        organization_id: item.organization_id,
        name: item.name,
        description: item.description,
        lca_sub_stage_id: item.lca_sub_stage_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        lca_sub_stages: item.lca_sub_stages ? {
          id: item.lca_sub_stages.id,
          name: item.lca_sub_stages.name,
          description: item.lca_sub_stages.description,
        } : null,
      }));

      setIngredients(transformedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ingredients';
      setError(new Error(errorMessage));
      console.error('Error fetching ingredients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, [organizationId]);

  return {
    ingredients,
    isLoading,
    error,
    refetch: fetchIngredients,
  };
}
