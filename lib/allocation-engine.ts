/**
 * Allocation Engine Logic
 *
 * Purpose: Calculate Scope 1 & 2 Emission Intensity (kgCO₂e per unit) for products
 *
 * Core Philosophy: "Model the Business"
 * Production logs act as the allocation key (denominator) for distributing
 * facility-level emissions across products.
 *
 * Logic Flow:
 *
 * 1. Identify Product & Facility
 *    - Get the facility_id associated with the product
 *
 * 2. Define Calculation Period
 *    - Determine time range (e.g., "Year To Date" or "Last 12 Months")
 *
 * 3. Fetch Numerator (Total Emissions)
 *    - Query utility_logs (or equivalent) for this facility_id within period
 *    - Sum computed CO₂e from all energy sources (Electricity, Gas, etc.)
 *    - Result = Total_Facility_Emissions_kg
 *
 * 4. Fetch Denominator (Total Volume) - CRITICAL
 *    - Query production_logs for this facility_id within period
 *    - Sum volume of ALL products produced at this facility
 *    - Normalize units (convert hectolitres to litres, etc.)
 *    - Result = Total_Facility_Output_Litres
 *
 * 5. Calculate Intensity Factor
 *    - Intensity_Factor = Total_Facility_Emissions_kg / Total_Facility_Output_Litres
 *    - This represents kgCO₂e per litre of production at this facility
 *
 * 6. Apply to Product
 *    - Product_Scope1_2_Impact = Intensity_Factor * Volume_Per_Unit_of_Product
 *    - Example: If a 750ml bottle is produced, multiply intensity by 0.75
 *
 * Key Database Functions:
 * - get_facility_production_volume(facility_id, start_date, end_date)
 *   Returns total production volume for allocation calculations
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface AllocationPeriod {
  start_date: string;
  end_date: string;
  label: string;
}

export interface FacilityEmissions {
  facility_id: string;
  total_emissions_kg: number;
  period: AllocationPeriod;
}

export interface FacilityProduction {
  facility_id: string;
  total_volume_litres: number;
  product_count: number;
  period: AllocationPeriod;
}

export interface ProductAllocation {
  product_id: number;
  facility_id: string;
  intensity_factor: number; // kgCO₂e per litre
  volume_per_unit: number; // litres per product unit
  scope1_2_impact: number; // kgCO₂e per product unit
  period: AllocationPeriod;
}

/**
 * Calculate emission intensity factor for a facility
 *
 * @param facilityId - UUID of the facility
 * @param startDate - Start of calculation period
 * @param endDate - End of calculation period
 * @returns Intensity factor (kgCO₂e per litre) or null if no data
 */
export async function calculateFacilityIntensity(
  facilityId: string,
  startDate: string,
  endDate: string
): Promise<number | null> {
  const supabase = getSupabaseBrowserClient();

  try {
    // Step 1: Get total facility emissions for the period
    // TODO: Query utility_logs or emissions data table
    // const { data: emissionsData } = await supabase
    //   .from('utility_logs')
    //   .select('computed_co2e')
    //   .eq('facility_id', facilityId)
    //   .gte('date', startDate)
    //   .lte('date', endDate);

    // const totalEmissions = emissionsData?.reduce((sum, log) => sum + (log.computed_co2e || 0), 0) || 0;

    // Step 2: Get total production volume using the helper function
    const { data: productionData, error } = await supabase
      .rpc('get_facility_production_volume', {
        p_facility_id: facilityId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

    if (error) throw error;

    if (!productionData || productionData.length === 0) {
      console.warn(`No production data found for facility ${facilityId}`);
      return null;
    }

    const { total_volume_litres } = productionData[0];

    if (!total_volume_litres || total_volume_litres === 0) {
      console.warn(`Zero production volume for facility ${facilityId}`);
      return null;
    }

    // Step 3: Calculate intensity factor
    // TODO: Use actual emissions data when available
    // const intensityFactor = totalEmissions / total_volume_litres;

    // For now, return a placeholder
    // return intensityFactor;

    return null;
  } catch (error) {
    console.error('Error calculating facility intensity:', error);
    return null;
  }
}

/**
 * Calculate product-level Scope 1 & 2 impact
 *
 * @param productId - ID of the product
 * @param facilityId - UUID of the facility where product is made
 * @param volumePerUnit - Volume of one product unit (in litres)
 * @param startDate - Start of calculation period
 * @param endDate - End of calculation period
 * @returns Product allocation data or null if calculation fails
 */
export async function calculateProductAllocation(
  productId: number,
  facilityId: string,
  volumePerUnit: number,
  startDate: string,
  endDate: string
): Promise<ProductAllocation | null> {
  try {
    const intensityFactor = await calculateFacilityIntensity(
      facilityId,
      startDate,
      endDate
    );

    if (intensityFactor === null) {
      return null;
    }

    const scope1_2_impact = intensityFactor * volumePerUnit;

    return {
      product_id: productId,
      facility_id: facilityId,
      intensity_factor: intensityFactor,
      volume_per_unit: volumePerUnit,
      scope1_2_impact,
      period: {
        start_date: startDate,
        end_date: endDate,
        label: `${startDate} to ${endDate}`,
      },
    };
  } catch (error) {
    console.error('Error calculating product allocation:', error);
    return null;
  }
}

/**
 * Get common calculation periods
 */
export function getCalculationPeriods(): AllocationPeriod[] {
  const now = new Date();
  const currentYear = now.getFullYear();

  return [
    {
      start_date: `${currentYear}-01-01`,
      end_date: now.toISOString().split('T')[0],
      label: 'Year to Date',
    },
    {
      start_date: new Date(now.setMonth(now.getMonth() - 12)).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      label: 'Last 12 Months',
    },
  ];
}
