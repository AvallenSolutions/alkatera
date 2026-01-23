'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Calculator,
  Flame,
  Zap,
  BarChart3,
  Globe,
  Calendar,
  FileText,
  Lock,
  CheckCircle2,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { BusinessTravelCard } from '@/components/reports/BusinessTravelCard';
import { ServicesOverheadCard } from '@/components/reports/ServicesOverheadCard';
import { TeamCommutingCard } from '@/components/reports/TeamCommutingCard';
import { CapitalGoodsCard } from '@/components/reports/CapitalGoodsCard';
import { LogisticsDistributionCard } from '@/components/reports/LogisticsDistributionCard';
import { OperationalWasteCard } from '@/components/reports/OperationalWasteCard';
import { MarketingMaterialsCard } from '@/components/reports/MarketingMaterialsCard';
import { SpendImportCard } from '@/components/reports/SpendImportCard';
// New GHG Protocol Scope 3 category cards
import { UpstreamTransportCard } from '@/components/reports/UpstreamTransportCard';
import { DownstreamTransportCard } from '@/components/reports/DownstreamTransportCard';
import { UsePhaseCard } from '@/components/reports/UsePhaseCard';
import Link from 'next/link';

// Emission factors for auto-calculation from facility utility data
const EMISSION_FACTORS: Record<string, { factor: number; unit: string; scope: 'Scope 1' | 'Scope 2' }> = {
  // Scope 1 - Direct emissions
  diesel_stationary: { factor: 2.68787, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  diesel_mobile: { factor: 2.68787, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  petrol_mobile: { factor: 2.31, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  natural_gas: { factor: 0.18293, unit: 'kgCO2e/kWh', scope: 'Scope 1' },
  lpg: { factor: 1.55537, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  heavy_fuel_oil: { factor: 3.17740, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  biomass_solid: { factor: 0.01551, unit: 'kgCO2e/kg', scope: 'Scope 1' },
  refrigerant_leakage: { factor: 1430, unit: 'kgCO2e/kg', scope: 'Scope 1' }, // R134a GWP
  // Scope 2 - Indirect emissions from purchased energy
  electricity_grid: { factor: 0.207, unit: 'kgCO2e/kWh', scope: 'Scope 2' },
  heat_steam_purchased: { factor: 0.1662, unit: 'kgCO2e/kWh', scope: 'Scope 2' },
};

const UTILITY_TYPE_LABELS: Record<string, string> = {
  electricity_grid: 'Purchased Electricity',
  heat_steam_purchased: 'Purchased Heat / Steam',
  natural_gas: 'Natural Gas',
  lpg: 'LPG (Propane/Butane)',
  diesel_stationary: 'Diesel (Generators/Stationary)',
  heavy_fuel_oil: 'Heavy Fuel Oil',
  biomass_solid: 'Biogas / Biomass',
  refrigerant_leakage: 'Refrigerants (Leakage)',
  diesel_mobile: 'Company Fleet (Diesel)',
  petrol_mobile: 'Company Fleet (Petrol/Gasoline)',
};

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  created_at: string;
  updated_at: string;
}

interface OverheadEntry {
  id: string;
  category: string;
  description: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
  fte_count?: number;
  asset_type?: string;
  transport_mode?: string;
  distance_km?: number;
  weight_kg?: number;
  material_type?: string;
  disposal_method?: string;
}

// New interfaces for facility-based utility data
interface UtilityDataEntry {
  id: string;
  facility_id: string;
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  calculated_scope: string;
  facility?: {
    id: string;
    name: string;
    location: string | null;
  };
}

interface FacilityBreakdown {
  facility_id: string;
  facility_name: string;
  scope1_co2e: number;
  scope2_co2e: number;
  entries: UtilityDataEntry[];
}

interface SourceBreakdown {
  utility_type: string;
  label: string;
  scope: 'Scope 1' | 'Scope 2';
  total_quantity: number;
  unit: string;
  total_co2e: number;
}

const currentYear = new Date().getFullYear();
const availableYears = [currentYear, currentYear - 1, currentYear - 2];

export default function CompanyEmissionsPage() {
  const { currentOrganization } = useOrganization();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('footprint');

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [report, setReport] = useState<CorporateReport | null>(null);
  const [overheads, setOverheads] = useState<OverheadEntry[]>([]);
  const [scope1CO2e, setScope1CO2e] = useState(0);
  const [scope2CO2e, setScope2CO2e] = useState(0);
  const [productsCO2e, setProductsCO2e] = useState(0);
  const [fleetCO2e, setFleetCO2e] = useState(0);
  const [scope3Cat1CO2e, setScope3Cat1CO2e] = useState(0);
  const [scope3Cat1Breakdown, setScope3Cat1Breakdown] = useState<Array<{
    product_name: string;
    materials_tco2e: number;
    packaging_tco2e: number;
    production_volume: number;
  }>>([]);
  const [scope3Cat1DataQuality, setScope3Cat1DataQuality] = useState<string>('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scope3OverheadsCO2e, setScope3OverheadsCO2e] = useState(0);

  // New state for facility-based utility data
  const [utilityData, setUtilityData] = useState<UtilityDataEntry[]>([]);
  const [facilityBreakdown, setFacilityBreakdown] = useState<FacilityBreakdown[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);

  const fetchFacilities = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingFacilities(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, location')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching facilities:', error);
        toast.error('Failed to load facilities');
      } else {
        setFacilities(data || []);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      toast.error('Failed to load facilities');
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  // Fetch utility data from facilities and auto-calculate emissions
  const fetchUtilityDataAndCalculate = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingData(false);
      return;
    }

    try {
      setIsLoadingData(true);
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      // Fetch utility data from all facilities
      const { data, error } = await browserSupabase
        .from('utility_data_entries')
        .select(`
          id,
          facility_id,
          utility_type,
          quantity,
          unit,
          reporting_period_start,
          reporting_period_end,
          calculated_scope,
          facilities!inner (
            id,
            name,
            address_city
          )
        `)
        .eq('facilities.organization_id', currentOrganization.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd)
        .order('reporting_period_start', { ascending: false });

      if (error) {
        console.error('Error fetching utility data:', error);
        toast.error('Failed to load utility data');
        return;
      }

      const utilityEntries: UtilityDataEntry[] = (data || []).map((item: any) => ({
        id: item.id,
        facility_id: item.facility_id,
        utility_type: item.utility_type,
        quantity: item.quantity,
        unit: item.unit,
        reporting_period_start: item.reporting_period_start,
        reporting_period_end: item.reporting_period_end,
        calculated_scope: item.calculated_scope,
        facility: {
          id: item.facilities?.id,
          name: item.facilities?.name,
          location: item.facilities?.address_city,
        },
      }));

      setUtilityData(utilityEntries);

      // Calculate emissions and breakdowns
      let totalScope1 = 0;
      let totalScope2 = 0;

      // Group by facility
      const facilityMap = new Map<string, FacilityBreakdown>();
      // Group by source type
      const sourceMap = new Map<string, SourceBreakdown>();

      for (const entry of utilityEntries) {
        const emissionConfig = EMISSION_FACTORS[entry.utility_type];
        if (!emissionConfig) continue;

        // Calculate emissions for this entry
        let co2e = entry.quantity * emissionConfig.factor;

        // Handle unit conversion for natural gas (m³ to kWh)
        if (entry.utility_type === 'natural_gas' && entry.unit === 'm³') {
          // Convert cubic meters to kWh (approx 10.55 kWh per m³)
          co2e = entry.quantity * 10.55 * emissionConfig.factor;
        }

        // Update totals
        if (emissionConfig.scope === 'Scope 1') {
          totalScope1 += co2e;
        } else {
          totalScope2 += co2e;
        }

        // Update facility breakdown
        const facilityName = entry.facility?.name || 'Unknown Facility';
        const facilityId = entry.facility_id;
        if (!facilityMap.has(facilityId)) {
          facilityMap.set(facilityId, {
            facility_id: facilityId,
            facility_name: facilityName,
            scope1_co2e: 0,
            scope2_co2e: 0,
            entries: [],
          });
        }
        const facilityData = facilityMap.get(facilityId)!;
        facilityData.entries.push(entry);
        if (emissionConfig.scope === 'Scope 1') {
          facilityData.scope1_co2e += co2e;
        } else {
          facilityData.scope2_co2e += co2e;
        }

        // Update source breakdown
        if (!sourceMap.has(entry.utility_type)) {
          sourceMap.set(entry.utility_type, {
            utility_type: entry.utility_type,
            label: UTILITY_TYPE_LABELS[entry.utility_type] || entry.utility_type,
            scope: emissionConfig.scope,
            total_quantity: 0,
            unit: entry.unit,
            total_co2e: 0,
          });
        }
        const sourceData = sourceMap.get(entry.utility_type)!;
        sourceData.total_quantity += entry.quantity;
        sourceData.total_co2e += co2e;
      }

      setScope1CO2e(totalScope1);
      setScope2CO2e(totalScope2);
      setFacilityBreakdown(Array.from(facilityMap.values()).sort((a, b) =>
        (b.scope1_co2e + b.scope2_co2e) - (a.scope1_co2e + a.scope2_co2e)
      ));
      setSourceBreakdown(Array.from(sourceMap.values()).sort((a, b) => b.total_co2e - a.total_co2e));

    } catch (error) {
      console.error('Error fetching utility data:', error);
      toast.error('Failed to load utility data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchScope3Cat1FromLCAs = async () => {
    if (!currentOrganization?.id) return;

    console.log('🔍 [SCOPE 3 CAT 1] Starting fetch', {
      orgId: currentOrganization.id,
      selectedYear,
      yearStart: `${selectedYear}-01-01`,
      yearEnd: `${selectedYear}-12-31`
    });

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: productionLogs, error: productionError } = await browserSupabase
        .from('production_logs')
        .select('product_id, volume, unit, units_produced, date')
        .eq('organization_id', currentOrganization.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (productionError) throw productionError;

      console.log('🔍 [SCOPE 3 CAT 1] Production logs', {
        count: productionLogs?.length || 0,
        logs: productionLogs
      });

      if (!productionLogs || productionLogs.length === 0) {
        setScope3Cat1CO2e(0);
        setScope3Cat1Breakdown([]);
        setScope3Cat1DataQuality('No production data for selected year');
        return;
      }

      let totalEmissions = 0;
      const breakdown: Array<{
        product_name: string;
        materials_tco2e: number;
        packaging_tco2e: number;
        production_volume: number;
      }> = [];

      for (const log of productionLogs) {
        const { data: product } = await browserSupabase
          .from('products')
          .select('name')
          .eq('id', log.product_id)
          .maybeSingle();

        if (!product) continue;

        console.log('🔍 [SCOPE 3 CAT 1] Product found', {
          productId: log.product_id,
          product
        });

        const { data: lca, error: lcaError } = await browserSupabase
          .from('product_carbon_footprints')
          .select('id, total_ghg_emissions, status, per_unit_emissions_verified')
          .eq('product_id', log.product_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('🔍 [SCOPE 3 CAT 1] LCA data', {
          productId: log.product_id,
          hasLCA: !!lca,
          status: lca?.status,
          total_ghg_emissions: lca?.total_ghg_emissions,
          per_unit_verified: lca?.per_unit_emissions_verified,
          lcaError
        });

        if (lcaError || !lca || !lca.total_ghg_emissions || lca.total_ghg_emissions === 0) {
          console.warn('⚠️ [SCOPE 3 CAT 1] Skipping product - no valid LCA emissions', {
            productId: log.product_id,
            productName: product.name,
            reason: !lca ? 'No LCA found' : !lca.total_ghg_emissions ? 'total_ghg_emissions is null/0' : 'Unknown'
          });
          continue;
        }

        // CRITICAL: Use units_produced (number of bottles/cans) not bulk volume (hectolitres)
        // LCA emissions are per functional unit (per bottle/can)
        const unitsProduced = log.units_produced || 0;

        if (unitsProduced === 0) {
          console.warn('⚠️ [SCOPE 3 CAT 1] Skipping - units_produced is 0 or NULL', {
            productId: log.product_id,
            productName: product.name,
            log
          });
          continue;
        }

        // CRITICAL: Use total_ghg_emissions which includes ALL lifecycle stages
        // (materials, production, transport, end-of-life) - matches edge function
        const emissionsPerUnit = lca.total_ghg_emissions;
        const totalImpactKg = emissionsPerUnit * unitsProduced;
        const totalImpactTonnes = totalImpactKg / 1000;

        totalEmissions += totalImpactTonnes;

        // Fetch materials breakdown for UI display purposes only
        const { data: materials } = await browserSupabase
          .from('product_carbon_footprint_materials')
          .select('material_type, impact_climate')
          .eq('product_carbon_footprint_id', lca.id);

        let materialsPerUnit = 0;
        let packagingPerUnit = 0;

        if (materials) {
          materials.forEach((m: any) => {
            if (m.material_type === 'ingredient') {
              materialsPerUnit += m.impact_climate || 0;
            } else if (m.material_type === 'packaging') {
              packagingPerUnit += m.impact_climate || 0;
            }
          });
        }

        const totalMaterialsTonnes = (materialsPerUnit * unitsProduced) / 1000;
        const totalPackagingTonnes = (packagingPerUnit * unitsProduced) / 1000;

        console.log('✅ [SCOPE 3 CAT 1] Calculated impact (FULL LCA)', {
          product: product.name,
          unitsProduced,
          emissionsPerUnit_kgCO2e: emissionsPerUnit,
          totalImpactKg,
          totalImpactTonnes,
          runningTotal: totalEmissions,
          display_breakdown: {
            materialsPerUnit,
            packagingPerUnit,
            totalMaterialsTonnes,
            totalPackagingTonnes
          }
        });

        breakdown.push({
          product_name: product.name,
          materials_tco2e: totalMaterialsTonnes,
          packaging_tco2e: totalPackagingTonnes,
          production_volume: unitsProduced,
        });
      }

      setScope3Cat1CO2e(totalEmissions);
      setScope3Cat1Breakdown(breakdown);
      setScope3Cat1DataQuality('Tier 1: Primary LCA data from ecoinvent 3.10');

      console.log('✅ [SCOPE 3 CAT 1] Final result', {
        totalEmissions,
        breakdownCount: breakdown.length,
        breakdown
      });
    } catch (error: any) {
      console.error('Error fetching Scope 3 Cat 1 from LCAs:', error);
      setScope3Cat1CO2e(0);
      setScope3Cat1Breakdown([]);
      setScope3Cat1DataQuality('Error loading data');
    }
  };

  const fetchReportData = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoadingReport(true);
      const browserSupabase = getSupabaseBrowserClient();

      const { data: reportData, error: reportError } = await browserSupabase
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('year', selectedYear)
        .maybeSingle();

      if (reportError) throw reportError;

      if (!reportData) {
        const { data: newReport, error: createError } = await browserSupabase
          .from('corporate_reports')
          .insert({
            organization_id: currentOrganization.id,
            year: selectedYear,
            status: 'Draft',
            total_emissions: 0,
            breakdown_json: {},
          })
          .select()
          .single();

        if (createError) throw createError;
        setReport(newReport);
        setOverheads([]);
      } else {
        setReport(reportData);

        const { data: overheadData, error: overheadError } = await browserSupabase
          .from('corporate_overheads')
          .select('*')
          .eq('report_id', reportData.id)
          .order('created_at', { ascending: false });

        if (overheadError) throw overheadError;
        setOverheads(overheadData || []);
      }

      await fetchUtilityDataAndCalculate();
      await fetchProductsEmissions();
      await fetchFleetEmissions();
      await fetchScope3Cat1FromLCAs();
      await fetchScope3Overheads();
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load footprint data');
    } finally {
      setIsLoadingReport(false);
    }
  };


  const fetchProductsEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: productionData, error } = await browserSupabase
        .from('production_logs')
        .select('product_id, volume, unit, date')
        .eq('organization_id', currentOrganization.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (error) throw error;

      let total = 0;

      if (productionData) {
        for (const log of productionData) {
          const { data: product } = await browserSupabase
            .from('products')
            .select('unit_size_value, unit_size_unit')
            .eq('id', log.product_id)
            .maybeSingle();

          if (!product) continue;

          const { data: lca } = await browserSupabase
            .from('product_carbon_footprints')
            .select('total_ghg_emissions')
            .eq('product_id', log.product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lca && lca.total_ghg_emissions) {
            const volumeInLitres = log.unit === 'Hectolitre' ? log.volume * 100 : log.volume;

            let productSizeInLitres = product.unit_size_value || 1;
            if (product.unit_size_unit === 'ml') {
              productSizeInLitres = productSizeInLitres / 1000;
            }

            const numberOfUnits = volumeInLitres / productSizeInLitres;
            const totalImpact = lca.total_ghg_emissions * numberOfUnits;
            total += totalImpact;
          }
        }
      }

      setProductsCO2e(total);
    } catch (error: any) {
      console.error('Error fetching products emissions:', error);
      setProductsCO2e(0);
    }
  };

  const fetchFleetEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await browserSupabase
        .from('fleet_activities')
        .select('emissions_tco2e')
        .eq('organization_id', currentOrganization.id)
        .gte('activity_date', yearStart)
        .lte('activity_date', yearEnd);

      if (error) throw error;

      const total = data?.reduce((sum, item) => sum + (item.emissions_tco2e || 0), 0) || 0;
      setFleetCO2e(total);
    } catch (error: any) {
      console.error('Error fetching fleet emissions:', error);
    }
  };

  const fetchScope3Overheads = async () => {
    if (!currentOrganization?.id || !report?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();

      const { data, error } = await browserSupabase
        .from('corporate_overheads')
        .select('category, computed_co2e')
        .eq('report_id', report.id);

      if (error) throw error;

      const scope3Categories = [
        'business_travel',
        'purchased_services',
        'employee_commuting',
        'capital_goods',
        'operational_waste',
        'downstream_logistics',
      ];

      const total = data
        ?.filter(item => scope3Categories.includes(item.category))
        .reduce((sum, item) => sum + (item.computed_co2e || 0), 0) || 0;

      setScope3OverheadsCO2e(total);
    } catch (error: any) {
      console.error('Error fetching Scope 3 overheads:', error);
      setScope3OverheadsCO2e(0);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id && selectedYear) {
      fetchReportData();
    }
  }, [currentOrganization?.id, selectedYear]);


  const handleGenerateReport = async () => {
    if (!report || !currentOrganization?.id) return;

    setIsGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-ccf-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          year: selectedYear,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      await response.json();

      toast.success('Footprint calculated successfully!');
      await fetchReportData();
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const travelEntries = overheads.filter((o) => o.category === 'business_travel');
  const serviceEntries = overheads.filter((o) => o.category === 'purchased_services' && !o.material_type);
  const marketingEntries = overheads.filter((o) => o.category === 'purchased_services' && o.material_type);
  const commutingEntry = overheads.find((o) => o.category === 'employee_commuting');
  const fteCount = commutingEntry?.fte_count || 0;
  const capitalGoodsEntries = overheads.filter((o) => o.category === 'capital_goods') as any[];
  const logisticsEntries = overheads.filter((o) => o.category === 'downstream_logistics') as any[];
  const wasteEntries = overheads.filter((o) => o.category === 'operational_waste') as any[];
  // New GHG Protocol categories
  const upstreamTransportEntries = overheads.filter((o) => o.category === 'upstream_transport') as any[];
  const downstreamTransportEntries = overheads.filter((o) => o.category === 'downstream_transport') as any[];
  const usePhaseEntries = overheads.filter((o) => o.category === 'use_phase') as any[];

  // Calculate total Scope 3 overhead emissions (in kg) from all categories
  const scope3OverheadCategories = [
    'business_travel',
    'purchased_services',
    'employee_commuting',
    'capital_goods',
    'operational_waste',
    'downstream_logistics',
    // New GHG Protocol categories
    'upstream_transport',
    'downstream_transport',
    'use_phase',
  ];
  const calculatedScope3OverheadsCO2e = overheads
    .filter((o) => scope3OverheadCategories.includes(o.category))
    .reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Company Emissions
          </h1>
          <p className="text-muted-foreground mt-2">
            Build and track your organisation's annual carbon footprint
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {report?.status === 'Finalized' ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
              <Lock className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </div>

      {facilities.length === 0 && !isLoadingFacilities && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No facilities found. Please add facilities to your organisation before entering activity data.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="footprint" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Annual Footprint
          </TabsTrigger>
          <TabsTrigger value="scope1" className="gap-2">
            <Flame className="h-4 w-4" />
            Scope 1
          </TabsTrigger>
          <TabsTrigger value="scope2" className="gap-2">
            <Zap className="h-4 w-4" />
            Scope 2
          </TabsTrigger>
          <TabsTrigger value="scope3" className="gap-2">
            <Globe className="h-4 w-4" />
            Scope 3
          </TabsTrigger>
        </TabsList>

        <TabsContent value="footprint">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedYear} Company Footprint</CardTitle>
                    <CardDescription>
                      Overview of your organisation's greenhouse gas inventory for {selectedYear}
                    </CardDescription>
                  </div>
                  <Button onClick={handleGenerateReport} disabled={isGenerating || isLoadingReport}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Footprint
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      // CRITICAL: Always calculate LIVE total emissions from real-time data (in tonnes)
                      // Fleet emissions are included in scope1CO2e already, so no need to add separately
                      const totalLiveEmissionsTonnes =
                        (scope1CO2e / 1000) +       // Scope 1 in tonnes
                        (fleetCO2e) +                // Fleet already in tonnes
                        (scope2CO2e / 1000) +       // Scope 2 in tonnes
                        scope3Cat1CO2e +            // Scope 3 Cat 1 already in tonnes
                        (calculatedScope3OverheadsCO2e / 1000); // Scope 3 other categories in tonnes

                      const hasLiveData = totalLiveEmissionsTonnes > 0;

                      if (hasLiveData) {
                        return (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-2">Total Footprint</div>
                            <div className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                              {totalLiveEmissionsTonnes.toFixed(3)} tCO2e
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Last calculated: {report?.updated_at ? new Date(report.updated_at).toLocaleString('en-GB') : 'Just now'}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              No emissions data found for {selectedYear}. Add utility data at <Link href="/company/facilities" className="underline font-medium">facility level</Link> for Scope 1 & 2, and add Scope 3 data below.
                            </AlertDescription>
                          </Alert>
                        );
                      }
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-orange-200 dark:border-orange-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            <span className="font-medium">Scope 1</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {(() => {
                              // CRITICAL: Scope 1 = Operations + Fleet
                              // scope1CO2e is in kg, fleetCO2e is in tonnes
                              const totalScope1Tonnes = (scope1CO2e / 1000) + fleetCO2e;
                              return totalScope1Tonnes > 0
                                ? `${totalScope1Tonnes.toFixed(3)} tCO₂e`
                                : 'No data';
                            })()}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Direct emissions (fuel combustion, process, fugitive, fleet)</p>
                        </CardContent>
                      </Card>

                      <Card className="border-blue-200 dark:border-blue-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">Scope 2</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {scope2CO2e > 0
                              ? `${(scope2CO2e / 1000).toFixed(3)} tCO₂e`
                              : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Indirect emissions (purchased electricity, heat, steam)</p>
                        </CardContent>
                      </Card>

                      <Card className="border-green-200 dark:border-green-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Scope 3</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {(() => {
                              // Sum ALL Scope 3 categories:
                              // - scope3Cat1CO2e (Category 1 from LCAs) is in tonnes
                              // - calculatedScope3OverheadsCO2e (all other categories) is in kg
                              const totalTonnes = scope3Cat1CO2e + (calculatedScope3OverheadsCO2e / 1000);

                              if (totalTonnes > 0) {
                                return `${totalTonnes.toFixed(3)} tCO₂e`;
                              }

                              return 'No data';
                            })()}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Value chain emissions</p>
                          {(scope3Cat1CO2e > 0 || (report?.breakdown_json?.scope3?.products && report.breakdown_json.scope3.products > 0)) && (
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Includes Cat 1 from LCAs (Tier 1 data)
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">How your footprint is calculated</h4>
                        <p className="text-sm text-muted-foreground">
                          <strong>Scope 1 & 2:</strong> Auto-calculated from facility utility data (electricity, gas, diesel, etc.).
                          <Link href="/company/facilities" className="underline ml-1">Add utility data at facility level</Link>.
                          <br />
                          <strong>Scope 3:</strong> Add value chain data (travel, services, waste) in the Scope 3 tab below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scope1">
          <div className="space-y-6">
            {/* Total Scope 1 Summary */}
            <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Scope 1: Direct Emissions
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Auto-calculated from facility utility data (fuel combustion, mobile sources, fugitive emissions)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Auto-calculated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Total */}
                    <div className="text-center py-6 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="text-sm text-muted-foreground mb-2">Total Scope 1 Emissions ({selectedYear})</div>
                      <div className="text-4xl font-bold text-orange-900 dark:text-orange-100 mb-2">
                        {((scope1CO2e / 1000) + fleetCO2e) > 0
                          ? `${((scope1CO2e / 1000) + fleetCO2e).toFixed(3)} tCO2e`
                          : 'No data'}
                      </div>
                      {scope1CO2e > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Utilities: {(scope1CO2e / 1000).toFixed(3)} tCO2e | Fleet: {fleetCO2e.toFixed(3)} tCO2e
                        </div>
                      )}
                    </div>

                    {/* Link to add data */}
                    {sourceBreakdown.filter(s => s.scope === 'Scope 1').length === 0 && (
                      <Alert>
                        <Building2 className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                          <span>No Scope 1 utility data found for {selectedYear}. Add utility data at facility level.</span>
                          <Link href="/company/facilities">
                            <Button variant="outline" size="sm" className="ml-4">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Go to Facilities
                            </Button>
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Breakdown by Emission Source */}
            {sourceBreakdown.filter(s => s.scope === 'Scope 1').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by Emission Source</CardTitle>
                  <CardDescription>
                    Scope 1 emissions by fuel type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Emissions</TableHead>
                          <TableHead className="text-right">% of Scope 1</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourceBreakdown
                          .filter(s => s.scope === 'Scope 1')
                          .map((source) => (
                            <TableRow key={source.utility_type}>
                              <TableCell className="font-medium">{source.label}</TableCell>
                              <TableCell className="text-right">
                                {source.total_quantity.toLocaleString()} {source.unit}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {(source.total_co2e / 1000).toFixed(3)} tCO2e
                              </TableCell>
                              <TableCell className="text-right">
                                {scope1CO2e > 0
                                  ? `${((source.total_co2e / scope1CO2e) * 100).toFixed(1)}%`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Breakdown by Facility */}
            {facilityBreakdown.filter(f => f.scope1_co2e > 0).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by Facility</CardTitle>
                  <CardDescription>
                    Scope 1 emissions by facility location
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Facility</TableHead>
                          <TableHead className="text-right">Scope 1 Emissions</TableHead>
                          <TableHead className="text-right">% of Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facilityBreakdown
                          .filter(f => f.scope1_co2e > 0)
                          .map((facility) => (
                            <TableRow key={facility.facility_id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {facility.facility_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {(facility.scope1_co2e / 1000).toFixed(3)} tCO2e
                              </TableCell>
                              <TableCell className="text-right">
                                {scope1CO2e > 0
                                  ? `${((facility.scope1_co2e / scope1CO2e) * 100).toFixed(1)}%`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Link href={`/company/facilities/${facility.facility_id}`}>
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info about data entry */}
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <strong>Single Source of Truth:</strong> Scope 1 & 2 data is entered at facility level only.
                Go to <Link href="/company/facilities" className="underline font-medium">Company &gt; Facilities</Link> to add or edit utility consumption data.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        <TabsContent value="scope2">
          <div className="space-y-6">
            {/* Total Scope 2 Summary */}
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-500" />
                      Scope 2: Purchased Energy Emissions
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Auto-calculated from facility utility data (purchased electricity, heat, steam, cooling)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Auto-calculated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Total */}
                    <div className="text-center py-6 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-sm text-muted-foreground mb-2">Total Scope 2 Emissions ({selectedYear})</div>
                      <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                        {scope2CO2e > 0
                          ? `${(scope2CO2e / 1000).toFixed(3)} tCO2e`
                          : 'No data'}
                      </div>
                      {scope2CO2e > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Location-based method (UK grid average)
                        </div>
                      )}
                    </div>

                    {/* Link to add data */}
                    {sourceBreakdown.filter(s => s.scope === 'Scope 2').length === 0 && (
                      <Alert>
                        <Building2 className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                          <span>No Scope 2 utility data found for {selectedYear}. Add utility data at facility level.</span>
                          <Link href="/company/facilities">
                            <Button variant="outline" size="sm" className="ml-4">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Go to Facilities
                            </Button>
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Breakdown by Emission Source */}
            {sourceBreakdown.filter(s => s.scope === 'Scope 2').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by Energy Source</CardTitle>
                  <CardDescription>
                    Scope 2 emissions by purchased energy type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Emissions</TableHead>
                          <TableHead className="text-right">% of Scope 2</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourceBreakdown
                          .filter(s => s.scope === 'Scope 2')
                          .map((source) => (
                            <TableRow key={source.utility_type}>
                              <TableCell className="font-medium">{source.label}</TableCell>
                              <TableCell className="text-right">
                                {source.total_quantity.toLocaleString()} {source.unit}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {(source.total_co2e / 1000).toFixed(3)} tCO2e
                              </TableCell>
                              <TableCell className="text-right">
                                {scope2CO2e > 0
                                  ? `${((source.total_co2e / scope2CO2e) * 100).toFixed(1)}%`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Breakdown by Facility */}
            {facilityBreakdown.filter(f => f.scope2_co2e > 0).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by Facility</CardTitle>
                  <CardDescription>
                    Scope 2 emissions by facility location
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Facility</TableHead>
                          <TableHead className="text-right">Scope 2 Emissions</TableHead>
                          <TableHead className="text-right">% of Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facilityBreakdown
                          .filter(f => f.scope2_co2e > 0)
                          .map((facility) => (
                            <TableRow key={facility.facility_id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {facility.facility_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {(facility.scope2_co2e / 1000).toFixed(3)} tCO2e
                              </TableCell>
                              <TableCell className="text-right">
                                {scope2CO2e > 0
                                  ? `${((facility.scope2_co2e / scope2CO2e) * 100).toFixed(1)}%`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Link href={`/company/facilities/${facility.facility_id}`}>
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info about data entry */}
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <strong>Single Source of Truth:</strong> Scope 1 & 2 data is entered at facility level only.
                Go to <Link href="/company/facilities" className="underline font-medium">Company &gt; Facilities</Link> to add or edit utility consumption data.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        <TabsContent value="scope3">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scope 3: Value Chain Emissions</CardTitle>
                <CardDescription>
                  Track indirect emissions from your organisation's value chain for {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Scope 3 emissions typically represent the largest portion of a company's carbon footprint.
                    Add data for business travel, purchased services, employee commuting, and more.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* AI Accounts Import - Full Width */}
            {currentOrganization && report && (
              <SpendImportCard
                reportId={report.id}
                organizationId={currentOrganization.id}
                year={selectedYear}
                onUpdate={fetchReportData}
              />
            )}

            <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Category 1: Purchased Goods & Services
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Auto-calculated from Product Environmental Impacts
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Emissions from raw materials and packaging calculated from your product PEIs using ecoinvent database
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : scope3Cat1CO2e > 0 ? (
                  <div className="space-y-6">
                    <div className="text-center py-6 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="text-sm text-muted-foreground mb-2">Total Category 1 Emissions</div>
                      <div className="text-4xl font-bold text-green-900 dark:text-green-100 mb-2">
                        {scope3Cat1CO2e.toFixed(3)} tCO2e
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {scope3Cat1DataQuality}
                      </div>
                    </div>

                    <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-sm">
                        <div className="font-semibold text-green-900 dark:text-green-100 mb-1">
                          Tier 1 Primary Data Quality
                        </div>
                        <div className="text-green-800 dark:text-green-200">
                          This data is calculated from your product LCAs using ecoinvent factors -
                          <strong> far more accurate than spend-based estimates</strong> (plus/minus 12% vs plus/minus 50% uncertainty).
                        </div>
                      </AlertDescription>
                    </Alert>

                    {scope3Cat1Breakdown.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">Breakdown by Product:</h4>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                          {scope3Cat1Breakdown.map((product, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-green-100 dark:border-green-900/50"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{product.product_name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Production: {product.production_volume.toLocaleString()} units
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-semibold text-sm">
                                  {(product.materials_tco2e + product.packaging_tco2e).toFixed(3)} tCO2e
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Materials: {product.materials_tco2e.toFixed(2)} | Packaging: {product.packaging_tco2e.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground mb-4">
                      <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No Category 1 data available</p>
                      <p className="text-sm mt-2">
                        Complete product LCAs and record production volumes to automatically calculate
                        Category 1 emissions from your raw materials and packaging.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => window.location.href = '/products'}
                    >
                      Go to Product Environmental Impacts
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {isLoadingReport ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <BusinessTravelCard
                  reportId={report.id}
                  entries={travelEntries}
                  onUpdate={fetchReportData}
                />

                <MarketingMaterialsCard
                  reportId={report.id}
                  entries={marketingEntries}
                  onUpdate={fetchReportData}
                />

                <ServicesOverheadCard
                  reportId={report.id}
                  entries={serviceEntries}
                  onUpdate={fetchReportData}
                />

                <TeamCommutingCard
                  reportId={report.id}
                  initialFteCount={fteCount}
                  onUpdate={fetchReportData}
                />

                <CapitalGoodsCard
                  reportId={report.id}
                  entries={capitalGoodsEntries}
                  onUpdate={fetchReportData}
                />

                {currentOrganization && (
                  <LogisticsDistributionCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={selectedYear}
                    entries={logisticsEntries}
                    onUpdate={fetchReportData}
                  />
                )}

                <OperationalWasteCard
                  reportId={report.id}
                  entries={wasteEntries}
                  onUpdate={fetchReportData}
                />

                {/* New GHG Protocol Scope 3 category cards */}
                {currentOrganization && (
                  <UpstreamTransportCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={selectedYear}
                    entries={upstreamTransportEntries}
                    onUpdate={fetchReportData}
                  />
                )}

                {currentOrganization && (
                  <DownstreamTransportCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={selectedYear}
                    entries={downstreamTransportEntries}
                    onUpdate={fetchReportData}
                  />
                )}

                {currentOrganization && (
                  <UsePhaseCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={selectedYear}
                    entries={usePhaseEntries}
                    onUpdate={fetchReportData}
                  />
                )}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load Scope 3 data collection cards. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
