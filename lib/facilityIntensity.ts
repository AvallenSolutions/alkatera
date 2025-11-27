import { supabase } from './supabaseClient';

export interface FacilityIntensity {
  facilityId: string;
  facilityName: string;
  calculatedIntensity: number | null;
  volumeUnit: string | null;
  dataSourceType: 'Primary' | 'Secondary_Average';
  activityType: string | null;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  isEstimate: boolean;
}

/**
 * Fetches the most recent emission intensity for a given facility
 * Returns the calculated intensity (kg CO2e per unit of production)
 */
export async function getFacilityIntensity(
  facilityId: string,
  organizationId: string
): Promise<{
  success: boolean;
  intensity: FacilityIntensity | null;
  error?: string;
}> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        intensity: null,
        error: 'User not authenticated',
      };
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      return {
        success: false,
        intensity: null,
        error: 'User not authorized for this organization',
      };
    }

    // Fetch the most recent emissions record with intensity
    const { data: emissionsData, error: emissionsError } = await supabase
      .from('facility_emissions_aggregated')
      .select(`
        *,
        facilities!inner(id, name, organization_id)
      `)
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
      .not('calculated_intensity', 'is', null)
      .order('reporting_period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emissionsError) {
      return {
        success: false,
        intensity: null,
        error: `Failed to fetch facility intensity: ${emissionsError.message}`,
      };
    }

    if (!emissionsData) {
      return {
        success: true,
        intensity: null,
        error: 'No intensity data available for this facility',
      };
    }

    const facility = (emissionsData as any).facilities;

    return {
      success: true,
      intensity: {
        facilityId: emissionsData.facility_id,
        facilityName: facility.name,
        calculatedIntensity: emissionsData.calculated_intensity,
        volumeUnit: emissionsData.volume_unit,
        dataSourceType: emissionsData.data_source_type,
        activityType: emissionsData.facility_activity_type,
        reportingPeriodStart: emissionsData.reporting_period_start,
        reportingPeriodEnd: emissionsData.reporting_period_end,
        isEstimate: emissionsData.data_source_type === 'Secondary_Average',
      },
    };
  } catch (error) {
    console.error('[getFacilityIntensity] Error:', error);
    return {
      success: false,
      intensity: null,
      error: error instanceof Error ? error.message : 'Failed to fetch facility intensity',
    };
  }
}

/**
 * Calculates product manufacturing impact based on facility intensity
 */
export function calculateManufacturingImpact(
  facilityIntensity: number,
  productVolume: number,
  productVolumeUnit: string,
  facilityVolumeUnit: string
): number {
  // TODO: Add unit conversion logic if needed
  // For now, assume units match
  return facilityIntensity * productVolume;
}

/**
 * Lists all facilities with their most recent intensities for an organization
 */
export async function listFacilitiesWithIntensity(
  organizationId: string
): Promise<{
  success: boolean;
  facilities: FacilityIntensity[];
  error?: string;
}> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        facilities: [],
        error: 'User not authenticated',
      };
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      return {
        success: false,
        facilities: [],
        error: 'User not authorized for this organization',
      };
    }

    // Fetch all facilities for the organization
    const { data: facilitiesData, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');

    if (facilitiesError) {
      return {
        success: false,
        facilities: [],
        error: `Failed to fetch facilities: ${facilitiesError.message}`,
      };
    }

    // Fetch the most recent intensity for each facility
    const facilitiesWithIntensity = await Promise.all(
      (facilitiesData || []).map(async (facility) => {
        const { data: emissionsData } = await supabase
          .from('facility_emissions_aggregated')
          .select('*')
          .eq('facility_id', facility.id)
          .not('calculated_intensity', 'is', null)
          .order('reporting_period_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!emissionsData) {
          return null;
        }

        return {
          facilityId: facility.id,
          facilityName: facility.name,
          calculatedIntensity: emissionsData.calculated_intensity,
          volumeUnit: emissionsData.volume_unit,
          dataSourceType: emissionsData.data_source_type,
          activityType: emissionsData.facility_activity_type,
          reportingPeriodStart: emissionsData.reporting_period_start,
          reportingPeriodEnd: emissionsData.reporting_period_end,
          isEstimate: emissionsData.data_source_type === 'Secondary_Average',
        } as FacilityIntensity;
      })
    );

    return {
      success: true,
      facilities: facilitiesWithIntensity.filter((f): f is FacilityIntensity => f !== null),
    };
  } catch (error) {
    console.error('[listFacilitiesWithIntensity] Error:', error);
    return {
      success: false,
      facilities: [],
      error: error instanceof Error ? error.message : 'Failed to fetch facilities',
    };
  }
}
