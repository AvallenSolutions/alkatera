import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface ActivityStreamEntry {
  id: string;
  type: string;
  description: string;
  created_at: string;
  actor: string | null;
}

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchActivityStream(orgId: string, limit: number): Promise<ActivityStreamEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: rows, error } = await supabase
    .from('activity_stream_view')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (rows as ActivityStreamEntry[]) ?? [];
}

export function useActivityStream(limit = 10) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<ActivityStreamEntry[]>({
    queryKey: ['activity-stream', orgId, limit],
    queryFn: () => fetchActivityStream(orgId as string, limit),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch activity') : null,
    refetch,
  };
}
