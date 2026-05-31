import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface FootprintHistoryEntry {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchFootprintHistory(orgId: string): Promise<FootprintHistoryEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: rows, error } = await supabase
    .from('footprint_history_view')
    .select('*')
    .eq('organization_id', orgId)
    .order('year', { ascending: true });
  if (error) throw error;
  return (rows as FootprintHistoryEntry[]) ?? [];
}

export function useFootprintHistory() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<FootprintHistoryEntry[]>({
    queryKey: ['footprint-history', orgId],
    queryFn: () => fetchFootprintHistory(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch history') : null,
    refetch,
  };
}
