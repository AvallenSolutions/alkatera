import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { calculateScope3, Scope3Breakdown } from "@/lib/calculations/corporate-emissions";

interface UseScope3EmissionsResult {
  scope3Emissions: Scope3Breakdown;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to calculate Scope 3 emissions for an organization
 *
 * Uses the shared corporate-emissions calculator to ensure consistency
 * across Dashboard, Company Vitality, and CCF Reports.
 */
export function useScope3Emissions(
  organizationId: string | undefined,
  year: number
): UseScope3EmissionsResult {
  const [scope3Emissions, setScope3Emissions] = useState<Scope3Breakdown>({
    products: 0,
    business_travel: 0,
    purchased_services: 0,
    employee_commuting: 0,
    capital_goods: 0,
    operational_waste: 0,
    downstream_logistics: 0,
    marketing_materials: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchScope3Emissions = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Use shared calculation service for consistency
      const breakdown = await calculateScope3(
        supabase,
        organizationId,
        year,
        yearStart,
        yearEnd
      );

      console.log('📊 [SCOPE 3 HOOK] Calculated emissions (via shared service)', {
        products: breakdown.products,
        business_travel: breakdown.business_travel,
        purchased_services: breakdown.purchased_services,
        employee_commuting: breakdown.employee_commuting,
        capital_goods: breakdown.capital_goods,
        operational_waste: breakdown.operational_waste,
        downstream_logistics: breakdown.downstream_logistics,
        marketing_materials: breakdown.marketing_materials,
        total: breakdown.total,
        totalInTonnes: breakdown.total / 1000,
      });

      setScope3Emissions(breakdown);
    } catch (err: any) {
      console.error("Error fetching Scope 3 emissions:", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, year]);

  useEffect(() => {
    fetchScope3Emissions();
  }, [fetchScope3Emissions]);

  return {
    scope3Emissions,
    isLoading,
    error,
    refetch: fetchScope3Emissions,
  };
}
