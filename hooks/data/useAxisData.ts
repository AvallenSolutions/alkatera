'use client';

import { useMemo } from 'react';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useFacilityWaterData } from '@/hooks/data/useFacilityWaterData';
import {
  transformFootprintToScope3Categories,
  type ScopeBreakdown,
} from '@/lib/vitality/scope3-transform';

/**
 * Everything the four environmental deep-dives need, assembled once.
 *
 * /performance/ and /performance/[axis]/ show the same numbers from the same
 * year, so they must not derive them twice. The prop lists below are long and
 * the fallbacks are load-bearing — `totalCO2` preferring the corporate
 * footprint over the product-LCA roll-up, `waterScarcityImpact` preferring
 * facility readings over LCA — and two copies of that logic would drift
 * quietly, giving the vitality row and the axis page different numbers for the
 * same axis. That is exactly the class of bug the redesign is removing.
 */
export function useAxisData(year: number) {
  const companyMetrics = useCompanyMetrics(year);
  const { footprint: footprintData, loading: footprintLoading, refetch: refetchFootprint } =
    useCompanyFootprint(year);
  const { metrics: wasteMetrics, loading: wasteLoading } = useWasteMetrics(year);
  const {
    companyOverview: waterCompanyOverview,
    facilitySummaries: waterFacilitySummaries,
    sourceBreakdown: waterSourceBreakdown,
    waterTimeSeries,
    loading: waterLoading,
  } = useFacilityWaterData(year);

  const {
    metrics,
    facilityWaterRisks,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    natureMetrics,
    loading,
    error,
    refetch,
  } = companyMetrics;

  const scope3 = useMemo(
    () => transformFootprintToScope3Categories(footprintData),
    [footprintData],
  );

  const scopeBreakdown: ScopeBreakdown | null = footprintData?.breakdown
    ? {
        scope1: footprintData.breakdown.scope1,
        scope2: footprintData.breakdown.scope2,
        scope3: footprintData.breakdown.scope3.total,
      }
    : null;

  const corporateTotalCO2 = footprintData?.total_emissions || 0;
  const productLcaTotalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;
  // The corporate footprint is the fuller picture when it exists; the product
  // roll-up is the fallback for orgs that have only done LCAs.
  const totalCO2 = corporateTotalCO2 > 0 ? corporateTotalCO2 : productLcaTotalCO2;

  const waterConsumption = metrics?.total_impacts.water_consumption || 0;
  const productLcaWaterScarcity = metrics?.total_impacts.water_scarcity_aware || 0;
  const landUse = metrics?.total_impacts.land_use || 0;

  // Facility readings beat the product LCA for the headline water figure.
  const facilityScarcityWeighted =
    waterCompanyOverview?.total_scarcity_weighted_m3 ||
    waterCompanyOverview?.scarcity_weighted_consumption_m3 ||
    0;
  const waterScarcityImpact =
    facilityScarcityWeighted > 0 ? facilityScarcityWeighted : productLcaWaterScarcity;

  const circularityRate =
    wasteMetrics?.waste_diversion_rate || metrics?.circularity_percentage || 0;

  return {
    // raw sources
    metrics,
    footprintData,
    wasteMetrics,
    natureMetrics,
    // carbon
    scopeBreakdown,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    scope3Categories: scope3.categories,
    scope3ProductDetails: scope3.productDetails,
    scope3TravelDetails: scope3.travelDetails,
    scope3LogisticsDetails: scope3.logisticsDetails,
    scope3WasteDetails: scope3.wasteDetails,
    scope3Total: scope3.totalScope3,
    corporateTotalCO2,
    productLcaTotalCO2,
    totalCO2,
    // water
    facilityWaterRisks,
    waterCompanyOverview,
    waterFacilitySummaries,
    waterSourceBreakdown,
    waterTimeSeries,
    waterConsumption,
    productLcaWaterScarcity,
    waterScarcityImpact,
    // circularity + nature
    circularityRate,
    landUse,
    // status
    loading,
    footprintLoading,
    wasteLoading,
    waterLoading,
    error,
    refetch,
    refetchFootprint,
  };
}
