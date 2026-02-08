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
    // NEW: Previously missing GHG Protocol categories
    upstream_transport: 0,    // Category 4: Upstream Transportation
    downstream_transport: 0,  // Category 9: Downstream Transportation
    use_phase: 0,             // Category 11: Use of Sold Products
    // UI-friendly aliases
    logistics: 0,
    waste: 0,
    marketing: 0,
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
