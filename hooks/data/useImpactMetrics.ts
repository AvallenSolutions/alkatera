import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface ImpactMetrics {
  trees_planted: number;
  water_saved_litres: number;
  carbon_offset_tonnes: number;
  renewable_energy_pct: number;
}

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchImpactMetrics(orgId: string): Promise<ImpactMetrics | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: row, error } = await supabase
    .from('impact_metrics_view')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (row as ImpactMetrics | null) ?? null;
}

export function useImpactMetrics() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<ImpactMetrics | null>({
    queryKey: ['impact-metrics', orgId],
    queryFn: () => fetchImpactMetrics(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Preserve the original shape: data is ImpactMetrics | null, error is string|null.
  return {
    data: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch metrics') : null,
    refetch,
  };
}
