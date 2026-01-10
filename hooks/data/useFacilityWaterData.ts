'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface FacilityWaterEntry {
  id: string;
  facility_id: string;
  organization_id: string;
  reporting_year: number;
  reporting_month: number;
  reporting_period_start: string;
  reporting_period_end: string;
  total_consumption_m3: number;
  municipal_consumption_m3: number;
  groundwater_consumption_m3: number;
  surface_water_consumption_m3: number;
  rainwater_consumption_m3: number;
  recycled_consumption_m3: number;
  total_discharge_m3: number;
  net_consumption_m3: number;
  recycling_rate: number;
  production_volume: number | null;
  production_unit: string;
  water_intensity_m3_per_unit: number | null;
  data_quality: 'measured' | 'metered' | 'estimated' | 'proxy';
  aware_factor: number | null;
  scarcity_weighted_consumption_m3: number;
  risk_level: 'high' | 'medium' | 'low';
}

export interface FacilityWaterSummary {
  facility_id: string;
  organization_id: string;
  facility_name: string;
  city: string | null;
  country: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  total_consumption_m3: number;
  municipal_consumption_m3: number;
  groundwater_consumption_m3: number;
  surface_water_consumption_m3: number;
  rainwater_consumption_m3: number;
  recycled_consumption_m3: number;
  total_discharge_m3: number;
  net_consumption_m3: number;
  aware_factor: number;
  scarcity_weighted_consumption_m3: number;
  risk_level: 'high' | 'medium' | 'low';
  recycling_rate_percent: number;
  avg_water_intensity_m3_per_unit: number | null;
  data_points_count: number;
  measured_data_points: number;
  earliest_data: string | null;
  latest_data: string | null;
  products_linked?: string[];
  operational_water_intake_m3?: number;
  operational_water_discharge_m3?: number;
  operational_net_consumption_m3?: number;
  product_lca_water_m3?: number;
  has_operational_data?: boolean;
}

export interface CompanyWaterOverview {
  organization_id: string;
  total_consumption_m3: number;
  net_consumption_m3: number;
  scarcity_weighted_consumption_m3: number;
  municipal_consumption_m3: number;
  groundwater_consumption_m3: number;
  surface_water_consumption_m3: number;
  rainwater_consumption_m3: number;
  recycled_consumption_m3: number;
  total_discharge_m3: number;
  municipal_percent: number;
  groundwater_percent: number;
  surface_water_percent: number;
  recycled_percent: number;
  high_risk_facilities: number;
  medium_risk_facilities: number;
  low_risk_facilities: number;
  total_facilities: number;
  avg_aware_factor: number;
  avg_recycling_rate: number;
}

export interface WaterSourceBreakdown {
  source: string;
  value: number;
  percentage: number;
  color: string;
}

export interface WaterTimeSeries {
  period: string;
  year: number;
  month: number;
  consumption: number;
  discharge: number;
  netConsumption: number;
  scarcityWeighted: number;
}

export function useFacilityWaterData() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [companyOverview, setCompanyOverview] = useState<CompanyWaterOverview | null>(null);
  const [facilitySummaries, setFacilitySummaries] = useState<FacilityWaterSummary[]>([]);
  const [waterTimeSeries, setWaterTimeSeries] = useState<WaterTimeSeries[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<WaterSourceBreakdown[]>([]);

  const supabase = getSupabaseBrowserClient();

  const fetchWaterData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overviewResult, summariesResult, timeSeriesResult] = await Promise.all([
        supabase
          .from('company_water_overview')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),

        supabase
          .from('facility_water_summary')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('total_consumption_m3', { ascending: false }),

        supabase
          .from('facility_water_data')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('reporting_year', { ascending: true })
          .order('reporting_month', { ascending: true })
      ]);

      if (overviewResult.error) throw overviewResult.error;
      if (summariesResult.error) throw summariesResult.error;
      if (timeSeriesResult.error) throw timeSeriesResult.error;

      setCompanyOverview(overviewResult.data);
      setFacilitySummaries(summariesResult.data || []);

      const timeSeriesData: WaterTimeSeries[] = [];
      const monthlyAggregates: Record<string, WaterTimeSeries> = {};

      (timeSeriesResult.data || []).forEach((entry: FacilityWaterEntry) => {
        const key = `${entry.reporting_year}-${String(entry.reporting_month).padStart(2, '0')}`;
        if (!monthlyAggregates[key]) {
          monthlyAggregates[key] = {
            period: key,
            year: entry.reporting_year,
            month: entry.reporting_month,
            consumption: 0,
            discharge: 0,
            netConsumption: 0,
            scarcityWeighted: 0
          };
        }
        monthlyAggregates[key].consumption += entry.total_consumption_m3;
        monthlyAggregates[key].discharge += entry.total_discharge_m3;
        monthlyAggregates[key].netConsumption += entry.net_consumption_m3;
        monthlyAggregates[key].scarcityWeighted += entry.scarcity_weighted_consumption_m3;
      });

      Object.values(monthlyAggregates)
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        })
        .forEach(item => timeSeriesData.push(item));

      setWaterTimeSeries(timeSeriesData);

      if (overviewResult.data) {
        const overview = overviewResult.data;
        const breakdown: WaterSourceBreakdown[] = [];

        if (overview.municipal_consumption_m3 > 0) {
          breakdown.push({
            source: 'Municipal',
            value: overview.municipal_consumption_m3,
            percentage: overview.municipal_percent,
            color: '#3b82f6'
          });
        }
        if (overview.groundwater_consumption_m3 > 0) {
          breakdown.push({
            source: 'Groundwater',
            value: overview.groundwater_consumption_m3,
            percentage: overview.groundwater_percent,
            color: '#22c55e'
          });
        }
        if (overview.surface_water_consumption_m3 > 0) {
          breakdown.push({
            source: 'Surface Water',
            value: overview.surface_water_consumption_m3,
            percentage: overview.surface_water_percent,
            color: '#06b6d4'
          });
        }
        if (overview.rainwater_consumption_m3 > 0) {
          breakdown.push({
            source: 'Rainwater',
            value: overview.rainwater_consumption_m3,
            percentage: (overview.rainwater_consumption_m3 / overview.total_consumption_m3) * 100,
            color: '#8b5cf6'
          });
        }
        if (overview.recycled_consumption_m3 > 0) {
          breakdown.push({
            source: 'Recycled',
            value: overview.recycled_consumption_m3,
            percentage: overview.recycled_percent,
            color: '#10b981'
          });
        }

        setSourceBreakdown(breakdown);
      }

    } catch (err) {
      console.error('Error fetching water data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch water data'));
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, supabase]);

  useEffect(() => {
    fetchWaterData();
  }, [fetchWaterData]);

  const getFacilityDetails = useCallback(async (facilityId: string) => {
    if (!currentOrganization?.id) return null;

    const { data, error } = await supabase
      .from('facility_water_data')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('organization_id', currentOrganization.id)
      .order('reporting_year', { ascending: false })
      .order('reporting_month', { ascending: false });

    if (error) {
      console.error('Error fetching facility details:', error);
      return null;
    }

    return data as FacilityWaterEntry[];
  }, [currentOrganization?.id, supabase]);

  const getAwareFactorForCountry = useCallback(async (countryCode: string) => {
    const { data, error } = await supabase
      .from('aware_factors')
      .select('*')
      .eq('country_code', countryCode)
      .maybeSingle();

    if (error) {
      console.error('Error fetching AWARE factor:', error);
      return null;
    }

    return data;
  }, [supabase]);

  const addWaterEntry = useCallback(async (entry: Partial<FacilityWaterEntry>) => {
    if (!currentOrganization?.id) return { data: null, error: new Error('No organisation selected') };

    const { data, error } = await supabase
      .from('facility_water_data')
      .insert({
        ...entry,
        organization_id: currentOrganization.id
      })
      .select()
      .single();

    if (!error) {
      fetchWaterData();
    }

    return { data, error };
  }, [currentOrganization?.id, supabase, fetchWaterData]);

  const updateWaterEntry = useCallback(async (id: string, updates: Partial<FacilityWaterEntry>) => {
    const { data, error } = await supabase
      .from('facility_water_data')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      fetchWaterData();
    }

    return { data, error };
  }, [supabase, fetchWaterData]);

  const deleteWaterEntry = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('facility_water_data')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchWaterData();
    }

    return { error };
  }, [supabase, fetchWaterData]);

  return {
    loading,
    error,
    companyOverview,
    facilitySummaries,
    waterTimeSeries,
    sourceBreakdown,
    refetch: fetchWaterData,
    getFacilityDetails,
    getAwareFactorForCountry,
    addWaterEntry,
    updateWaterEntry,
    deleteWaterEntry
  };
}
