import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface LcaSubStage {
  id: number;
  lca_stage_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface LcaLifeCycleStage {
  id: number;
  name: string;
  created_at: string;
  sub_stages: LcaSubStage[];
}

interface UseLcaStagesResult {
  stages: LcaLifeCycleStage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useLcaStages(): UseLcaStagesResult {
  const [stages, setStages] = useState<LcaLifeCycleStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: stagesData, error: stagesError } = await supabase
        .from('lca_life_cycle_stages')
        .select('*')
        .order('id');

      if (stagesError) {
        throw new Error(stagesError.message);
      }

      const { data: subStagesData, error: subStagesError } = await supabase
        .from('lca_sub_stages')
        .select('*')
        .order('lca_stage_id, id');

      if (subStagesError) {
        throw new Error(subStagesError.message);
      }

      const stagesWithSubStages: LcaLifeCycleStage[] = (stagesData || []).map((stage) => ({
        ...stage,
        sub_stages: (subStagesData || []).filter((subStage) => subStage.lca_stage_id === stage.id),
      }));

      setStages(stagesWithSubStages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch LCA stages';
      setError(new Error(errorMessage));
      console.error('Error fetching LCA stages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  return {
    stages,
    isLoading,
    error,
    refetch: fetchStages,
  };
}
