import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface Scope3Breakdown {
  products: number;
  business_travel: number;
  purchased_services: number;
  employee_commuting: number;
  capital_goods: number;
  operational_waste: number;
  downstream_logistics: number;
  marketing_materials: number;
  total: number;
}

interface UseScope3EmissionsResult {
  scope3Emissions: Scope3Breakdown;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

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

  const fetchScope3Emissions = async () => {
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

      // Initialize breakdown
      const breakdown: Scope3Breakdown = {
        products: 0,
        business_travel: 0,
        purchased_services: 0,
        employee_commuting: 0,
        capital_goods: 0,
        operational_waste: 0,
        downstream_logistics: 0,
        marketing_materials: 0,
        total: 0,
      };

      // 1. Fetch products emissions (Category 1: Purchased Goods & Services)
      const { data: productionData, error: productionError } = await supabase
        .from("production_logs")
        .select("product_id, volume, unit, units_produced, date")
        .eq("organization_id", organizationId)
        .gte("date", yearStart)
        .lte("date", yearEnd);

      if (productionError) throw productionError;

      console.log('📦 [SCOPE 3 HOOK] Production logs fetched', {
        count: productionData?.length || 0,
        year,
      });

      if (productionData) {
        for (const log of productionData) {
          // CRITICAL: Use aggregated_impacts.breakdown.by_scope.scope3 instead of total_ghg_emissions
          // total_ghg_emissions includes owned facility Scope 1 & 2 which would cause double counting
          // breakdown.by_scope.scope3 contains only: materials + transport + contract mfg + end-of-life
          const { data: lca } = await supabase
            .from("product_lcas")
            .select("aggregated_impacts, status")
            .eq("product_id", log.product_id)
            .eq("status", "completed")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Extract Scope 3 emissions from the breakdown (excludes owned facility S1+S2)
          const scope3PerUnit = lca?.aggregated_impacts?.breakdown?.by_scope?.scope3 || 0;

          if (lca && scope3PerUnit > 0) {
            // CRITICAL: Use units_produced (number of bottles/cans) NOT volume (bulk hectolitres)
            // LCA emissions are per functional unit (per bottle/can)
            const unitsProduced = log.units_produced || 0;

            if (unitsProduced > 0) {
              const impactKg = scope3PerUnit * unitsProduced;
              breakdown.products += impactKg;

              console.log('✅ [SCOPE 3 HOOK] Product calculated (using scope3 breakdown)', {
                product_id: log.product_id,
                units_produced: unitsProduced,
                scope3_per_unit: scope3PerUnit,
                total_impact_kg: impactKg,
                running_total: breakdown.products,
              });
            } else {
              console.warn('⚠️ [SCOPE 3 HOOK] Skipping - units_produced is 0', {
                product_id: log.product_id,
                log,
              });
            }
          }
        }
      }

      // 2. Fetch corporate overhead entries (all other Scope 3 categories)
      // First, get the report ID for this year
      const { data: reportData } = await supabase
        .from("corporate_reports")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("year", year)
        .maybeSingle();

      if (reportData) {
        const { data: overheadData, error: overheadError } = await supabase
          .from("corporate_overheads")
          .select("category, computed_co2e, material_type")
          .eq("report_id", reportData.id);

        if (overheadError) throw overheadError;

        if (overheadData) {
          overheadData.forEach((entry) => {
            const co2e = entry.computed_co2e || 0;

            switch (entry.category) {
              case "business_travel":
                breakdown.business_travel += co2e;
                break;
              case "employee_commuting":
                breakdown.employee_commuting += co2e;
                break;
              case "capital_goods":
                breakdown.capital_goods += co2e;
                break;
              case "operational_waste":
                breakdown.operational_waste += co2e;
                break;
              case "downstream_logistics":
                breakdown.downstream_logistics += co2e;
                break;
              case "purchased_services":
                // Marketing materials have material_type, other services don't
                if (entry.material_type) {
                  breakdown.marketing_materials += co2e;
                } else {
                  breakdown.purchased_services += co2e;
                }
                break;
              default:
                // Add to purchased_services as fallback
                breakdown.purchased_services += co2e;
                break;
            }
          });
        }
      }

      // Calculate total
      breakdown.total =
        breakdown.products +
        breakdown.business_travel +
        breakdown.purchased_services +
        breakdown.employee_commuting +
        breakdown.capital_goods +
        breakdown.operational_waste +
        breakdown.downstream_logistics +
        breakdown.marketing_materials;

      console.log('📊 [SCOPE 3 HOOK] Final breakdown', {
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
  };

  useEffect(() => {
    fetchScope3Emissions();
  }, [organizationId, year]);

  return {
    scope3Emissions,
    isLoading,
    error,
    refetch: fetchScope3Emissions,
  };
}
