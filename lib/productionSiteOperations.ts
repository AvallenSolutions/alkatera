import { supabase } from "./supabaseClient";

export interface ProductionSiteData {
  id: string;
  facility_id: string;
  facility_name: string;
  production_volume: number;
  share_of_production: number;
  facility_intensity: number;
  attributable_emissions_per_unit: number;
  data_source: 'Verified' | 'Industry_Average';
}

export interface AddProductionSiteParams {
  lcaId: string;
  facilityId: string;
  organizationId: string;
  productionVolume: number;
}

export interface GetProductionSitesResult {
  success: boolean;
  sites: ProductionSiteData[];
  error?: string;
}

export interface AddProductionSiteResult {
  success: boolean;
  siteId?: string;
  error?: string;
}

export interface RemoveProductionSiteResult {
  success: boolean;
  error?: string;
}

export interface ProductionSummary {
  weightedAverageIntensity: number;
  totalProductionVolume: number;
  manufacturingImpactPerUnit: number;
  siteCount: number;
}

export async function getProductionSites(
  lcaId: string,
  organizationId: string
): Promise<GetProductionSitesResult> {
  try {
    const { data: sitesData, error: sitesError } = await supabase
      .from("product_lca_production_sites")
      .select(`
        id,
        facility_id,
        production_volume,
        share_of_production,
        facility_intensity,
        attributable_emissions_per_unit,
        data_source
      `)
      .eq("product_lca_id", lcaId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (sitesError) throw sitesError;

    const facilityIds = (sitesData || []).map(site => site.facility_id);

    const { data: facilitiesData, error: facilitiesError } = await supabase
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds);

    if (facilitiesError) throw facilitiesError;

    const facilitiesMap = new Map(
      (facilitiesData || []).map(f => [f.id, f.name])
    );

    const sites: ProductionSiteData[] = (sitesData || []).map(site => ({
      id: site.id,
      facility_id: site.facility_id,
      facility_name: facilitiesMap.get(site.facility_id) || "Unknown Facility",
      production_volume: Number(site.production_volume),
      share_of_production: Number(site.share_of_production || 0),
      facility_intensity: Number(site.facility_intensity || 0),
      attributable_emissions_per_unit: Number(site.attributable_emissions_per_unit || 0),
      data_source: site.data_source as 'Verified' | 'Industry_Average',
    }));

    return {
      success: true,
      sites,
    };
  } catch (error: any) {
    console.error("Error fetching production sites:", error);
    return {
      success: false,
      sites: [],
      error: error.message || "Failed to fetch production sites",
    };
  }
}

export async function addProductionSite({
  lcaId,
  facilityId,
  organizationId,
  productionVolume,
}: AddProductionSiteParams): Promise<AddProductionSiteResult> {
  try {
    const { data, error } = await supabase
      .from("product_lca_production_sites")
      .insert({
        product_lca_id: lcaId,
        facility_id: facilityId,
        organization_id: organizationId,
        production_volume: productionVolume,
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      success: true,
      siteId: data.id,
    };
  } catch (error: any) {
    console.error("Error adding production site:", error);
    return {
      success: false,
      error: error.message || "Failed to add production site",
    };
  }
}

export async function removeProductionSite(
  siteId: string,
  organizationId: string
): Promise<RemoveProductionSiteResult> {
  try {
    const { error } = await supabase
      .from("product_lca_production_sites")
      .delete()
      .eq("id", siteId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error removing production site:", error);
    return {
      success: false,
      error: error.message || "Failed to remove production site",
    };
  }
}

export function calculateProductionSummary(
  sites: ProductionSiteData[],
  productNetVolume: number
): ProductionSummary {
  if (sites.length === 0) {
    return {
      weightedAverageIntensity: 0,
      totalProductionVolume: 0,
      manufacturingImpactPerUnit: 0,
      siteCount: 0,
    };
  }

  const totalProductionVolume = sites.reduce(
    (sum, site) => sum + site.production_volume,
    0
  );

  const weightedAverageIntensity = sites.reduce((sum, site) => {
    const weight = site.production_volume / totalProductionVolume;
    return sum + (site.facility_intensity * weight);
  }, 0);

  const manufacturingImpactPerUnit = weightedAverageIntensity * productNetVolume;

  return {
    weightedAverageIntensity,
    totalProductionVolume,
    manufacturingImpactPerUnit,
    siteCount: sites.length,
  };
}

export async function markProductionComplete(
  lcaId: string,
  organizationId: string,
  isComplete: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("product_lcas")
      .update({
        production_complete: isComplete,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lcaId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error updating production completion status:", error);
    return {
      success: false,
      error: error.message || "Failed to update completion status",
    };
  }
}
