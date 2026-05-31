import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface KpiSummary {
  // Carbon
  total_co2e: number | null;
  total_co2e_prev: number | null;
  // Water
  total_water_m3: number | null;
  // Waste
  total_waste_kg: number | null;
  diversion_rate: number | null;
  // Supplier engagement
  supplier_count: number | null;
  supplier_response_rate: number | null;
}

const EMPTY: KpiSummary = {
  total_co2e: null,
  total_co2e_prev: null,
  total_water_m3: null,
  total_waste_kg: null,
  diversion_rate: null,
  supplier_count: null,
  supplier_response_rate: null,
};

// Migrated to TanStack Query — see hooks/data/useProductSpotlight.ts for the recipe.
async function fetchKpiSummary(orgId: string): Promise<KpiSummary> {
  const supabase = getSupabaseBrowserClient();
  // Single source: the kpi_summary_view aggregates everything server-side
  const { data: row, error } = await supabase
    .from('kpi_summary_view')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (row as KpiSummary) ?? EMPTY;
}

export function useKpiSummary() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<KpiSummary>({
    queryKey: ['kpi-summary', orgId],
    queryFn: () => fetchKpiSummary(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Preserve the original shape: data is never null (defaults to EMPTY), error is string|null.
  return {
    data: data ?? EMPTY,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch KPIs') : null,
    refetch,
  };
}
