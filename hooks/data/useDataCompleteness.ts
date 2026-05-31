import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface DataCompleteness {
  overall_pct: number;
  products_pct: number;
  facilities_pct: number;
  suppliers_pct: number;
  missing_count: number;
}

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchDataCompleteness(orgId: string): Promise<DataCompleteness | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: row, error } = await supabase
    .from('data_completeness_view')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (row as DataCompleteness | null) ?? null;
}

export function useDataCompleteness() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<DataCompleteness | null>({
    queryKey: ['data-completeness', orgId],
    queryFn: () => fetchDataCompleteness(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return {
    data: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch completeness') : null,
    refetch,
  };
}
