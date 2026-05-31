import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface EmissionsByCategoryEntry {
  category: string;
  co2e: number;
  percentage: number;
}

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchEmissionsByCategory(orgId: string): Promise<EmissionsByCategoryEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: rows, error } = await supabase
    .from('emissions_by_category_view')
    .select('*')
    .eq('organization_id', orgId)
    .order('co2e', { ascending: false });
  if (error) throw error;
  return (rows as EmissionsByCategoryEntry[]) ?? [];
}

export function useEmissionsByCategory() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<EmissionsByCategoryEntry[]>({
    queryKey: ['emissions-by-category', orgId],
    queryFn: () => fetchEmissionsByCategory(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch data') : null,
    refetch,
  };
}
