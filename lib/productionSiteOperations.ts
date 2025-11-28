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

    if (!sitesData || sitesData.length === 0) {
      return {
        success: true,
        sites: [],
      };
    }

    // Calculate total production volume for share calculation
    const totalProductionVolume = sitesData.reduce(
      (sum, site) => sum + Number(site.production_volume || 0),
      0
    );

    const facilityIds = sitesData.map(site => site.facility_id);

    // Fetch facility names
    const { data: facilitiesData, error: facilitiesError } = await supabase
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds);

    if (facilitiesError) throw facilitiesError;

    const facilitiesMap = new Map(
      (facilitiesData || []).map(f => [f.id, f.name])
    );

    // Fetch latest facility intensities
    const { data: intensitiesData, error: intensitiesError } = await supabase
      .from("facility_emissions_aggregated")
      .select("facility_id, calculated_intensity, data_source_type")
      .in("facility_id", facilityIds)
      .order("reporting_period_start", { ascending: false });

    if (intensitiesError) throw intensitiesError;

    // Map facilities to their latest intensity
    const intensitiesMap = new Map<string, { intensity: number; dataSource: string }>();
    (intensitiesData || []).forEach(intensity => {
      if (!intensitiesMap.has(intensity.facility_id)) {
        intensitiesMap.set(intensity.facility_id, {
          intensity: Number(intensity.calculated_intensity || 0),
          dataSource: intensity.data_source_type === 'Primary' ? 'Verified' : 'Industry_Average'
        });
      }
    });

    const sites: ProductionSiteData[] = sitesData.map(site => {
      const productionVolume = Number(site.production_volume);
      const shareOfProduction = totalProductionVolume > 0
        ? (productionVolume / totalProductionVolume) * 100
        : 0;

      const facilityData = intensitiesMap.get(site.facility_id);
      const facilityIntensity = facilityData?.intensity || Number(site.facility_intensity || 0);

      // Ensure correct type for data_source
      let dataSource: 'Verified' | 'Industry_Average' = 'Industry_Average';
      if (facilityData?.dataSource === 'Verified') {
        dataSource = 'Verified';
      } else if (site.data_source === 'Verified') {
        dataSource = 'Verified';
      }

      return {
        id: site.id,
        facility_id: site.facility_id,
        facility_name: facilitiesMap.get(site.facility_id) || "Unknown Facility",
        production_volume: productionVolume,
        share_of_production: shareOfProduction,
        facility_intensity: facilityIntensity,
        attributable_emissions_per_unit: Number(site.attributable_emissions_per_unit || 0),
        data_source: dataSource,
      };
    });

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
    // Fetch the latest facility intensity
    const { data: intensityData, error: intensityError } = await supabase
      .from("facility_emissions_aggregated")
      .select("calculated_intensity, data_source_type")
      .eq("facility_id", facilityId)
      .order("reporting_period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intensityError) {
      console.error("Error fetching facility intensity:", intensityError);
    }

    const facilityIntensity = intensityData?.calculated_intensity || null;
    const dataSource = intensityData?.data_source_type === 'Primary' ? 'Verified' : 'Industry_Average';

    const { data, error } = await supabase
      .from("product_lca_production_sites")
      .insert({
        product_lca_id: lcaId,
        facility_id: facilityId,
        organization_id: organizationId,
        production_volume: productionVolume,
        facility_intensity: facilityIntensity,
        data_source: dataSource,
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
