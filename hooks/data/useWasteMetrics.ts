import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface WasteStreamItem {
  id: string;
  facility_id: string;
  facility_name: string;
  waste_category: string;
  waste_treatment_method: string;
  hazard_classification: string;
  total_quantity_kg: number;
  avg_recovery_percentage: number;
  total_emissions_kg_co2e: number;
  entry_count: number;
  data_provenance: string;
  confidence_score: number;
}

export interface WasteByCategoryItem {
  category: string;
  category_display: string;
  total_kg: number;
  percentage: number;
  emissions_kg_co2e: number;
}

export interface WasteByTreatmentItem {
  treatment_method: string;
  treatment_display: string;
  total_kg: number;
  percentage: number;
  is_circular: boolean;
  circularity_score: number;
}

export interface WasteByFacilityItem {
  facility_id: string;
  facility_name: string;
  total_kg: number;
  percentage: number;
  diversion_rate: number;
  hazardous_kg: number;
  operational_control: 'owned' | 'third_party' | 'joint_venture' | null;
  is_in_scope: boolean;
}

export interface CircularityMetrics {
  total_products: number;
  avg_packaging_circularity: number;
  avg_mci: number;
  avg_recycled_content: number;
  avg_recyclability: number;
  reusable_materials_percentage: number;
  compostable_materials_percentage: number;
  total_materials_assessed: number;
}

export interface EndOfLifeScenario {
  product_id: number;
  product_name: string;
  material_name: string;
  recycling_percentage: number;
  landfill_percentage: number;
  incineration_percentage: number;
  composting_percentage: number;
  reuse_percentage: number;
  total_emissions_kg_co2e: number;
  avoided_emissions_kg_co2e: number;
}

export interface CircularityTarget {
  id: string;
  target_year: number;
  waste_diversion_target: number;
  recycled_content_target: number;
  circularity_score_target: number;
  packaging_recyclability_target: number;
  zero_waste_to_landfill_target: boolean;
}

export interface WasteMetrics {
  total_waste_kg: number;
  total_waste_emissions_kg_co2e: number;
  waste_diversion_rate: number;
  circularity_rate: number;
  hazardous_waste_kg: number;
  hazardous_waste_percentage: number;
  recycled_content_avg: number;
  avg_recyclability_score: number;
  waste_intensity_per_unit: number;
  material_circularity_indicator: number;
  waste_by_category: WasteByCategoryItem[];
  waste_by_treatment: WasteByTreatmentItem[];
  waste_by_facility: WasteByFacilityItem[];
  circularity_metrics: CircularityMetrics | null;
  end_of_life_scenarios: EndOfLifeScenario[];
  targets: CircularityTarget | null;
  waste_streams: WasteStreamItem[];
}

const WASTE_CATEGORY_LABELS: Record<string, string> = {
  food_waste: 'Food Waste',
  packaging_waste: 'Packaging Waste',
  process_waste: 'Process Waste',
  hazardous: 'Hazardous Waste',
  construction: 'Construction Waste',
  electronic: 'Electronic Waste',
  other: 'Other Waste',
};

const TREATMENT_METHOD_LABELS: Record<string, string> = {
  landfill: 'Landfill',
  recycling: 'Recycling',
  composting: 'Composting',
  incineration_with_recovery: 'Incineration (Energy Recovery)',
  incineration_without_recovery: 'Incineration (No Recovery)',
  anaerobic_digestion: 'Anaerobic Digestion',
  reuse: 'Reuse',
  other: 'Other',
};

const TREATMENT_CIRCULARITY_SCORES: Record<string, number> = {
  reuse: 100,
  recycling: 100,
  composting: 100,
  anaerobic_digestion: 100,
  incineration_with_recovery: 50,
  incineration_without_recovery: 0,
  landfill: 0,
  other: 0,
};

export function useWasteMetrics(year?: number) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<WasteMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWasteData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      const { data: wasteData, error: wasteError } = await supabase
        .from('facility_activity_entries')
        .select(`
          id,
          facility_id,
          quantity,
          waste_category,
          waste_treatment_method,
          hazard_classification,
          waste_recovery_percentage,
          calculated_emissions_kg_co2e,
          data_provenance,
          confidence_score,
          activity_date,
          facilities!inner(id, name, operational_control)
        `)
        .eq('organization_id', currentOrganization.id)
        .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
        .gte('activity_date', `${currentYear}-01-01`)
        .lte('activity_date', `${currentYear}-12-31`);

      if (wasteError) throw wasteError;

      const { data: circularityData, error: circularityError } = await supabase
        .from('circularity_metrics_summary')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (circularityError) throw circularityError;

      const { data: eolData, error: eolError } = await supabase
        .from('product_end_of_life_scenarios')
        .select(`
          *,
          products!inner(id, name)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_primary_scenario', true);

      if (eolError) throw eolError;

      const { data: targetsData, error: targetsError } = await supabase
        .from('circularity_targets')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('target_year', currentYear)
        .maybeSingle();

      if (targetsError) throw targetsError;

      const { data: productionData } = await supabase
        .from('production_logs')
        .select('quantity')
        .eq('organization_id', currentOrganization.id)
        .gte('production_date', `${currentYear}-01-01`)
        .lte('production_date', `${currentYear}-12-31`);

      const totalProduction = productionData?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 1;

      const wasteEntries = wasteData || [];
      const totalWasteKg = wasteEntries.reduce((sum, w) => sum + Number(w.quantity || 0), 0);
      const totalEmissions = wasteEntries.reduce((sum, w) => sum + Number(w.calculated_emissions_kg_co2e || 0), 0);

      const wasteByCategory: Record<string, { total_kg: number; emissions: number }> = {};
      const wasteByTreatment: Record<string, { total_kg: number; recovery_sum: number; count: number }> = {};
      const wasteByFacility: Record<string, {
        facility_name: string;
        total_kg: number;
        hazardous_kg: number;
        circular_kg: number;
        operational_control: 'owned' | 'third_party' | 'joint_venture' | null;
      }> = {};

      let hazardousWasteKg = 0;
      let circularWasteKg = 0;

      wasteEntries.forEach((entry) => {
        const category = entry.waste_category || 'other';
        const treatment = entry.waste_treatment_method || 'other';
        const facilityId = entry.facility_id;
        const facilityData = entry.facilities as any;
        const facilityName = facilityData?.name || 'Unknown Facility';
        const operationalControl = facilityData?.operational_control || null;
        const quantity = Number(entry.quantity || 0);
        const emissions = Number(entry.calculated_emissions_kg_co2e || 0);
        const recovery = Number(entry.waste_recovery_percentage || 0);
        const isHazardous = entry.hazard_classification === 'hazardous';
        const circularityScore = TREATMENT_CIRCULARITY_SCORES[treatment] || 0;

        if (!wasteByCategory[category]) {
          wasteByCategory[category] = { total_kg: 0, emissions: 0 };
        }
        wasteByCategory[category].total_kg += quantity;
        wasteByCategory[category].emissions += emissions;

        if (!wasteByTreatment[treatment]) {
          wasteByTreatment[treatment] = { total_kg: 0, recovery_sum: 0, count: 0 };
        }
        wasteByTreatment[treatment].total_kg += quantity;
        wasteByTreatment[treatment].recovery_sum += recovery;
        wasteByTreatment[treatment].count += 1;

        if (!wasteByFacility[facilityId]) {
          wasteByFacility[facilityId] = {
            facility_name: facilityName,
            total_kg: 0,
            hazardous_kg: 0,
            circular_kg: 0,
            operational_control: operationalControl,
          };
        }
        wasteByFacility[facilityId].total_kg += quantity;
        if (isHazardous) {
          wasteByFacility[facilityId].hazardous_kg += quantity;
          hazardousWasteKg += quantity;
        }
        if (circularityScore > 0) {
          wasteByFacility[facilityId].circular_kg += quantity * (circularityScore / 100);
          circularWasteKg += quantity * (circularityScore / 100);
        }
      });

      const wasteByCategoryArray: WasteByCategoryItem[] = Object.entries(wasteByCategory)
        .map(([category, data]) => ({
          category,
          category_display: WASTE_CATEGORY_LABELS[category] || category,
          total_kg: data.total_kg,
          percentage: totalWasteKg > 0 ? (data.total_kg / totalWasteKg) * 100 : 0,
          emissions_kg_co2e: data.emissions,
        }))
        .sort((a, b) => b.total_kg - a.total_kg);

      const wasteByTreatmentArray: WasteByTreatmentItem[] = Object.entries(wasteByTreatment)
        .map(([treatment, data]) => ({
          treatment_method: treatment,
          treatment_display: TREATMENT_METHOD_LABELS[treatment] || treatment,
          total_kg: data.total_kg,
          percentage: totalWasteKg > 0 ? (data.total_kg / totalWasteKg) * 100 : 0,
          is_circular: TREATMENT_CIRCULARITY_SCORES[treatment] >= 50,
          circularity_score: TREATMENT_CIRCULARITY_SCORES[treatment] || 0,
        }))
        .sort((a, b) => b.total_kg - a.total_kg);

      const wasteByFacilityArray: WasteByFacilityItem[] = Object.entries(wasteByFacility)
        .map(([facilityId, data]) => ({
          facility_id: facilityId,
          facility_name: data.facility_name,
          total_kg: data.total_kg,
          percentage: totalWasteKg > 0 ? (data.total_kg / totalWasteKg) * 100 : 0,
          diversion_rate: data.total_kg > 0 ? (data.circular_kg / data.total_kg) * 100 : 0,
          hazardous_kg: data.hazardous_kg,
          operational_control: data.operational_control,
          is_in_scope: data.operational_control === 'owned' || data.operational_control === 'joint_venture',
        }))
        .sort((a, b) => b.total_kg - a.total_kg);

      const diversionRate = totalWasteKg > 0 ? (circularWasteKg / totalWasteKg) * 100 : 0;

      const wasteStreams: WasteStreamItem[] = wasteEntries.map((entry) => ({
        id: entry.id,
        facility_id: entry.facility_id,
        facility_name: (entry.facilities as any)?.name || 'Unknown',
        waste_category: entry.waste_category || 'other',
        waste_treatment_method: entry.waste_treatment_method || 'other',
        hazard_classification: entry.hazard_classification || 'non_hazardous',
        total_quantity_kg: Number(entry.quantity || 0),
        avg_recovery_percentage: Number(entry.waste_recovery_percentage || 0),
        total_emissions_kg_co2e: Number(entry.calculated_emissions_kg_co2e || 0),
        entry_count: 1,
        data_provenance: entry.data_provenance || 'unknown',
        confidence_score: Number(entry.confidence_score || 0),
      }));

      const endOfLifeScenarios: EndOfLifeScenario[] = (eolData || []).map((scenario: any) => ({
        product_id: scenario.product_id,
        product_name: scenario.products?.name || 'Unknown Product',
        material_name: scenario.scenario_name || 'All Materials',
        recycling_percentage: Number(scenario.recycling_percentage || 0),
        landfill_percentage: Number(scenario.landfill_percentage || 0),
        incineration_percentage: Number(scenario.incineration_percentage || 0),
        composting_percentage: Number(scenario.composting_percentage || 0),
        reuse_percentage: Number(scenario.reuse_percentage || 0),
        total_emissions_kg_co2e: Number(scenario.total_emissions_kg_co2e || 0),
        avoided_emissions_kg_co2e: Number(scenario.avoided_emissions_kg_co2e || 0),
      }));

      const circularityMetrics: CircularityMetrics | null = circularityData ? {
        total_products: Number(circularityData.total_products || 0),
        avg_packaging_circularity: Number(circularityData.avg_packaging_circularity || 0),
        avg_mci: Number(circularityData.avg_mci || 0),
        avg_recycled_content: Number(circularityData.avg_recycled_content || 0),
        avg_recyclability: Number(circularityData.avg_recyclability || 0),
        reusable_materials_percentage: Number(circularityData.reusable_materials_percentage || 0),
        compostable_materials_percentage: Number(circularityData.compostable_materials_percentage || 0),
        total_materials_assessed: Number(circularityData.total_materials_assessed || 0),
      } : null;

      const targets: CircularityTarget | null = targetsData ? {
        id: targetsData.id,
        target_year: Number(targetsData.target_year),
        waste_diversion_target: Number(targetsData.waste_diversion_target || 0),
        recycled_content_target: Number(targetsData.recycled_content_target || 0),
        circularity_score_target: Number(targetsData.circularity_score_target || 0),
        packaging_recyclability_target: Number(targetsData.packaging_recyclability_target || 0),
        zero_waste_to_landfill_target: targetsData.zero_waste_to_landfill_target || false,
      } : null;

      setMetrics({
        total_waste_kg: totalWasteKg,
        total_waste_emissions_kg_co2e: totalEmissions,
        waste_diversion_rate: diversionRate,
        circularity_rate: diversionRate,
        hazardous_waste_kg: hazardousWasteKg,
        hazardous_waste_percentage: totalWasteKg > 0 ? (hazardousWasteKg / totalWasteKg) * 100 : 0,
        recycled_content_avg: circularityMetrics?.avg_recycled_content || 0,
        avg_recyclability_score: circularityMetrics?.avg_recyclability || 0,
        waste_intensity_per_unit: totalProduction > 0 ? totalWasteKg / totalProduction : 0,
        material_circularity_indicator: circularityMetrics?.avg_mci || 0,
        waste_by_category: wasteByCategoryArray,
        waste_by_treatment: wasteByTreatmentArray,
        waste_by_facility: wasteByFacilityArray,
        circularity_metrics: circularityMetrics,
        end_of_life_scenarios: endOfLifeScenarios,
        targets,
        waste_streams: wasteStreams,
      });

    } catch (err) {
      console.error('Error fetching waste metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch waste metrics');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchWasteData();
  }, [fetchWasteData]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchWasteData,
  };
}
