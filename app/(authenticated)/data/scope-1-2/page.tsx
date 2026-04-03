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
import { useReportingPeriod } from '@/hooks/useReportingPeriod';
import { BusinessTravelCard } from '@/components/reports/BusinessTravelCard';
import { ServicesOverheadCard } from '@/components/reports/ServicesOverheadCard';
import { TeamCommutingCard } from '@/components/reports/TeamCommutingCard';
import { CapitalGoodsCard } from '@/components/reports/CapitalGoodsCard';
import { LogisticsDistributionCard } from '@/components/reports/LogisticsDistributionCard';
import { OperationalWasteCard } from '@/components/reports/OperationalWasteCard';
import { MarketingMaterialsCard } from '@/components/reports/MarketingMaterialsCard';
import { SpendImportCard } from '@/components/reports/SpendImportCard';
import { XeroEnergyBaselineAlert } from '@/components/reports/XeroEnergyBaselineAlert';
import { ScopeDuplicateWarning } from '@/components/xero/ScopeDuplicateWarning';
import { useXeroTransactions } from '@/hooks/useXeroTransactions';
// New GHG Protocol Scope 3 category cards
import { UpstreamTransportCard } from '@/components/reports/UpstreamTransportCard';
import { DownstreamTransportCard } from '@/components/reports/DownstreamTransportCard';
import { UsePhaseCard } from '@/components/reports/UsePhaseCard';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';

// Emission factors for auto-calculation from facility utility data
const EMISSION_FACTORS: Record<string, { factor: number; unit: string; scope: 'Scope 1' | 'Scope 2' }> = {
  // Scope 1 - Direct emissions
  diesel_stationary: { factor: 2.68787, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  diesel_mobile: { factor: 2.68787, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  petrol_mobile: { factor: 2.31, unit: 'kgCO2e/litre', scope: 'Scope 1' },
  natural_gas: { factor: 0.18293, unit: 'kgCO2e/kWh', scope: 'Scope 1' },
  natural_gas_m3: { factor: 0.18293 * 10.55, unit: 'kgCO2e/m³', scope: 'Scope 1' }, // 1 m³ ≈ 10.55 kWh
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
  natural_gas_m3: 'Natural Gas (by m³)',
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

export default function CompanyEmissionsPage() {
  const { currentOrganization } = useOrganization();
  const { selectableYears, getYearRange, currentLabelYear } = useReportingPeriod();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('footprint');

  const [selectedYear, setSelectedYear] = useState(currentLabelYear);

  // Derive date range from the selected year (FY-aware)
  const { yearStart: selectedYearStart, yearEnd: selectedYearEnd } = getYearRange(selectedYear);
  const [report, setReport] = useState<CorporateReport | null>(null);
  const [overheads, setOverheads] = useState<OverheadEntry[]>([]);
  const [scope1CO2e, setScope1CO2e] = useState(0);
  const [scope2CO2e, setScope2CO2e] = useState(0);
  const [productsCO2e, setProductsCO2e] = useState(0);
  const [fleetScope1CO2e, setFleetScope1CO2e] = useState(0);
  const [fleetScope2CO2e, setFleetScope2CO2e] = useState(0);
  const [fleetScope3CO2e, setFleetScope3CO2e] = useState(0);
  const [scope3Cat1CO2e, setScope3Cat1CO2e] = useState(0);
  const [scope3Cat1Breakdown, setScope3Cat1Breakdown] = useState<Array<{
    product_name: string;
    total_tco2e: number;
    materials_tco2e: number;
    packaging_tco2e: number;
    production_volume: number;
  }>>([]);
  const [scope3Cat1PendingProducts, setScope3Cat1PendingProducts] = useState<Array<{
    product_name: string;
    status: string;
  }>>([]);
  const [scope3Cat1DataQuality, setScope3Cat1DataQuality] = useState<string>('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scope3OverheadsCO2e, setScope3OverheadsCO2e] = useState(0);

  // Xero transaction data for display in scope cards
  const {
    xeroByCategory,
    scope1Entries: xeroScope1Entries,
    scope2Entries: xeroScope2Entries,
    totalScope1Kg: xeroScope1Kg,
    totalScope2Kg: xeroScope2Kg,
    totalScope3Kg: xeroScope3Kg,
  } = useXeroTransactions(currentOrganization?.id, selectedYearStart, selectedYearEnd);

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
      const yearStart = selectedYearStart;
      const yearEnd = selectedYearEnd;

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
        .lte('reporting_period_start', yearEnd)
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
      yearStart: selectedYearStart,
      yearEnd: selectedYearEnd
    });

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = selectedYearStart;
      const yearEnd = selectedYearEnd;

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
        // Fallback: use products with completed PEIs in the reporting year
        console.log('🔍 [SCOPE 3 CAT 1] No production logs found, falling back to completed PEIs');

        // Fetch all PEIs for the org to determine completed vs pending per product
        const { data: allPEIs, error: lcaFallbackError } = await browserSupabase
          .from('product_carbon_footprints')
          .select('id, product_id, aggregated_impacts, status, updated_at')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false });

        // Fetch all org products to identify those without completed PEIs
        const { data: allProducts } = await browserSupabase
          .from('products')
          .select('id, name')
          .eq('organization_id', currentOrganization.id);

        if (lcaFallbackError || !allPEIs || allPEIs.length === 0) {
          setScope3Cat1CO2e(0);
          setScope3Cat1Breakdown([]);
          setScope3Cat1PendingProducts([]);
          setScope3Cat1DataQuality('No production data or completed PEIs for selected year');
          return;
        }

        // Deduplicate: keep only latest PEI per product
        const latestByProduct = new Map<number, any>();
        for (const pei of allPEIs) {
          if (!latestByProduct.has(pei.product_id)) {
            latestByProduct.set(pei.product_id, pei);
          }
        }

        // Identify products with completed PEIs in reporting year vs those without
        const completedProductIds = new Set<number>();
        const pendingProducts: Array<{ product_name: string; status: string }> = [];

        for (const [productId, pei] of Array.from(latestByProduct.entries())) {
          const peiYear = pei.updated_at ? new Date(pei.updated_at).getFullYear() : null;
          const isCompletedInYear = pei.status === 'completed' && peiYear === selectedYear;

          if (isCompletedInYear) {
            completedProductIds.add(productId);
          } else {
            // Find product name
            const product = allProducts?.find((p: any) => p.id === productId);
            if (product) {
              const statusLabel = pei.status === 'completed'
                ? `Completed in ${peiYear} (not in reporting year ${selectedYear})`
                : pei.status === 'draft' ? 'PEI in draft' : `PEI ${pei.status}`;
              pendingProducts.push({
                product_name: (product as any).name,
                status: statusLabel,
              });
            }
          }
        }

        // Also find products with no PEI at all
        if (allProducts) {
          for (const product of allProducts as any[]) {
            if (!latestByProduct.has(product.id)) {
              pendingProducts.push({
                product_name: product.name,
                status: 'No PEI created',
              });
            }
          }
        }

        setScope3Cat1PendingProducts(pendingProducts);

        let totalEmissions = 0;
        const breakdown: Array<{
          product_name: string;
          total_tco2e: number;
          materials_tco2e: number;
          packaging_tco2e: number;
          production_volume: number;
        }> = [];

        for (const productId of Array.from(completedProductIds)) {
          const lca = latestByProduct.get(productId);
          const { data: productData } = await browserSupabase
            .from('products')
            .select('name')
            .eq('id', productId)
            .maybeSingle();

          if (!productData) continue;

          // Use scope3 from aggregated_impacts to avoid double-counting facility S1/S2
          const scope3PerUnit = lca.aggregated_impacts?.breakdown?.by_scope?.scope3 || 0;

          if (scope3PerUnit === 0) continue;

          // Get production volume from production sites
          const { data: prodSites } = await browserSupabase
            .from('product_carbon_footprint_production_sites')
            .select('production_volume')
            .eq('product_carbon_footprint_id', lca.id);

          // Also check contract manufacturer allocations
          const { data: cmAllocs } = await browserSupabase
            .from('contract_manufacturer_allocations')
            .select('client_production_volume')
            .eq('product_id', productId)
            .eq('organization_id', currentOrganization.id);

          // Use the max production volume found (represents total units produced)
          let unitsProduced = 0;
          if (prodSites && prodSites.length > 0) {
            unitsProduced = Math.max(...prodSites.map((s: any) => Number(s.production_volume || 0)));
          }
          if (cmAllocs && cmAllocs.length > 0) {
            const cmMax = Math.max(...cmAllocs.map((a: any) => Number(a.client_production_volume || 0)));
            unitsProduced = Math.max(unitsProduced, cmMax);
          }

          if (unitsProduced === 0) {
            // Last resort: check facility reporting sessions linked to this product
            const { data: assignments } = await browserSupabase
              .from('facility_product_assignments')
              .select('facility_id')
              .eq('product_id', productId)
              .eq('assignment_status', 'active');

            if (assignments && assignments.length > 0) {
              const { data: sessions } = await browserSupabase
                .from('facility_reporting_sessions')
                .select('total_production_volume')
                .in('facility_id', assignments.map((a: any) => a.facility_id))
                .order('reporting_period_end', { ascending: false })
                .limit(1);

              if (sessions && sessions.length > 0) {
                unitsProduced = Number(sessions[0].total_production_volume || 0);
              }
            }
          }

          if (unitsProduced === 0) {
            console.warn(`⚠️ [SCOPE 3 CAT 1] No production volume found for ${(productData as any).name}, using 1 unit`);
            unitsProduced = 1;
          }

          const totalImpactKg = scope3PerUnit * unitsProduced;
          const totalImpactTonnes = totalImpactKg / 1000;
          totalEmissions += totalImpactTonnes;

          // Get materials breakdown for display
          const { data: materials } = await browserSupabase
            .from('product_carbon_footprint_materials')
            .select('material_type, impact_climate')
            .eq('product_carbon_footprint_id', lca.id);

          let materialsPerUnit = 0;
          let packagingPerUnit = 0;
          if (materials) {
            (materials as any[]).forEach((m: any) => {
              if (m.material_type === 'ingredient') {
                materialsPerUnit += m.impact_climate || 0;
              } else if (m.material_type === 'packaging') {
                packagingPerUnit += m.impact_climate || 0;
              }
            });
          }

          breakdown.push({
            product_name: (productData as any).name,
            total_tco2e: totalImpactTonnes,
            materials_tco2e: (materialsPerUnit * unitsProduced) / 1000,
            packaging_tco2e: (packagingPerUnit * unitsProduced) / 1000,
            production_volume: unitsProduced,
          });

          console.log(`✅ [SCOPE 3 CAT 1] Fallback: ${(productData as any).name}: scope3/unit=${scope3PerUnit.toFixed(4)} × ${unitsProduced} units = ${totalImpactTonnes.toFixed(4)} tCO2e`);
        }

        setScope3Cat1CO2e(totalEmissions);
        setScope3Cat1Breakdown(breakdown);
        setScope3Cat1DataQuality(totalEmissions > 0 ? 'Tier 1: Primary LCA data (from completed product reports)' : 'No completed product PEIs found for selected year');
        return;
      }

      let totalEmissions = 0;
      const breakdown: Array<{
        product_name: string;
        total_tco2e: number;
        materials_tco2e: number;
        packaging_tco2e: number;
        production_volume: number;
      }> = [];

      for (const log of productionLogs as any[]) {
        const { data: productData } = await browserSupabase
          .from('products')
          .select('name')
          .eq('id', log.product_id)
          .maybeSingle();

        const product = productData as any;
        if (!product) continue;

        console.log('🔍 [SCOPE 3 CAT 1] Product found', {
          productId: log.product_id,
          product
        });

        const { data: lcaData, error: lcaError } = await browserSupabase
          .from('product_carbon_footprints')
          .select('id, aggregated_impacts, status, per_unit_emissions_verified, updated_at')
          .eq('product_id', log.product_id)
          .eq('status', 'completed')
          .gte('updated_at', yearStart)
          .lte('updated_at', `${selectedYearEnd}T23:59:59.999Z`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lca = lcaData as any;
        // Use scope3 from aggregated_impacts to avoid double-counting facility S1/S2
        const scope3PerUnit = lca?.aggregated_impacts?.breakdown?.by_scope?.scope3 || 0;
        // Single source of truth: climate_change_gwp100 from aggregated_impacts
        const totalGhgPerUnit = lca?.aggregated_impacts?.climate_change_gwp100 || 0;
        console.log('🔍 [SCOPE 3 CAT 1] LCA data', {
          productId: log.product_id,
          hasLCA: !!lca,
          status: lca?.status,
          climate_change_gwp100: totalGhgPerUnit,
          scope3_per_unit: scope3PerUnit,
          per_unit_verified: lca?.per_unit_emissions_verified,
          lcaError
        });

        if (lcaError || !lca || scope3PerUnit === 0) {
          console.warn('⚠️ [SCOPE 3 CAT 1] Skipping product - no valid Scope 3 emissions', {
            productId: log.product_id,
            productName: product.name,
            reason: !lca ? 'No LCA found' : scope3PerUnit === 0 ? 'scope3 is 0' : 'Unknown'
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

        // Use scope3 only (excludes facility S1/S2 already counted in company Scope 1 & 2)
        const emissionsPerUnit = scope3PerUnit;
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
          (materials as any[]).forEach((m: any) => {
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
          total_tco2e: totalImpactTonnes,
          materials_tco2e: totalMaterialsTonnes,
          packaging_tco2e: totalPackagingTonnes,
          production_volume: unitsProduced,
        });
      }

      // Identify products in production logs that don't have completed PEIs in the reporting year
      const includedProductIds = new Set(breakdown.map(b => b.product_name));
      const pendingProducts: Array<{ product_name: string; status: string }> = [];
      for (const log of productionLogs as any[]) {
        const { data: prod } = await browserSupabase
          .from('products')
          .select('name')
          .eq('id', log.product_id)
          .maybeSingle();
        if (prod && !includedProductIds.has((prod as any).name)) {
          // Check what PEI status this product has
          const { data: latestPEI } = await browserSupabase
            .from('product_carbon_footprints')
            .select('status, updated_at')
            .eq('product_id', log.product_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const pei = latestPEI as any;
          let statusLabel = 'No PEI created';
          if (pei) {
            if (pei.status === 'completed') {
              const peiYear = new Date(pei.updated_at).getFullYear();
              statusLabel = `Completed in ${peiYear} (not in reporting year ${selectedYear})`;
            } else {
              statusLabel = pei.status === 'draft' ? 'PEI in draft' : `PEI ${pei.status}`;
            }
          }
          // Only add once per product name
          if (!pendingProducts.some(p => p.product_name === (prod as any).name)) {
            pendingProducts.push({ product_name: (prod as any).name, status: statusLabel });
          }
        }
      }
      setScope3Cat1PendingProducts(pendingProducts);

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
        const { data: newReport, error: createError } = await (browserSupabase
          .from('corporate_reports') as any)
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
      const yearStart = selectedYearStart;
      const yearEnd = selectedYearEnd;

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
            .select('aggregated_impacts')
            .eq('product_id', log.product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Single source of truth: climate_change_gwp100 from aggregated_impacts
          const carbonFootprint = (lca?.aggregated_impacts as any)?.climate_change_gwp100 || 0;
          if (lca && carbonFootprint > 0) {
            const volumeInLitres = log.unit === 'Hectolitre' ? log.volume * 100 : log.volume;

            let productSizeInLitres = product.unit_size_value || 1;
            if (product.unit_size_unit === 'ml') {
              productSizeInLitres = productSizeInLitres / 1000;
            }

            const numberOfUnits = volumeInLitres / productSizeInLitres;
            const totalImpact = carbonFootprint * numberOfUnits;
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
      const yearStart = selectedYearStart;
      const yearEnd = selectedYearEnd;

      const { data, error } = await browserSupabase
        .from('fleet_activities')
        .select('emissions_tco2e, scope')
        .eq('organization_id', currentOrganization.id)
        .gte('activity_date', yearStart)
        .lte('activity_date', yearEnd);

      if (error) throw error;

      let s1 = 0, s2 = 0, s3 = 0;
      for (const item of data || []) {
        const val = item.emissions_tco2e || 0;
        if (item.scope === 'Scope 1') s1 += val;
        else if (item.scope === 'Scope 2') s2 += val;
        else if (item.scope === 'Scope 3 Cat 6') s3 += val;
      }
      setFleetScope1CO2e(s1);
      setFleetScope2CO2e(s2);
      setFleetScope3CO2e(s3);
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

  // Persist calculated emissions to corporate_reports for Rosa AI to read
  useEffect(() => {
    const persistEmissions = async () => {
      if (!report?.id || !currentOrganization?.id) return;

      // Calculate total emissions (matching the display logic)
      // Fleet values are in tCO2e, utility values are in kgCO2e
      const totalScope1Tonnes = (scope1CO2e / 1000) + fleetScope1CO2e + (xeroScope1Kg / 1000);
      const totalScope2Tonnes = (scope2CO2e / 1000) + fleetScope2CO2e + (xeroScope2Kg / 1000);
      const totalScope3Tonnes = scope3Cat1CO2e + (calculatedScope3OverheadsCO2e / 1000) + fleetScope3CO2e + (xeroScope3Kg / 1000);
      const totalEmissionsTonnes = totalScope1Tonnes + totalScope2Tonnes + totalScope3Tonnes;

      // Only persist if we have actual data
      if (totalEmissionsTonnes <= 0) return;

      const breakdownJson = {
        scope1: totalScope1Tonnes,            // in tonnes (utilities + fleet Scope 1)
        scope2: totalScope2Tonnes,            // in tonnes (utilities + fleet Scope 2)
        fleet: {
          scope1: fleetScope1CO2e,
          scope2: fleetScope2CO2e,
          scope3: fleetScope3CO2e,
        },
        scope3: {
          products: scope3Cat1CO2e,          // in tonnes
          products_breakdown: scope3Cat1Breakdown,
          overheads: calculatedScope3OverheadsCO2e / 1000, // in tonnes
          xero_baseline: xeroScope3Kg / 1000,           // in tonnes (spend-based)
          business_travel_fleet: fleetScope3CO2e,           // in tonnes (grey fleet)
          total: totalScope3Tonnes,
        },
        total: totalEmissionsTonnes,
        calculated_at: new Date().toISOString(),
      };

      try {
        const browserSupabase = getSupabaseBrowserClient();
        await browserSupabase
          .from('corporate_reports')
          .update({
            total_emissions: totalEmissionsTonnes,
            breakdown_json: breakdownJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', report.id);
      } catch (error) {
        console.error('Error persisting emissions to corporate_reports:', error);
      }
    };

    // Debounce to avoid too many updates
    const timeoutId = setTimeout(persistEmissions, 1000);
    return () => clearTimeout(timeoutId);
  }, [report?.id, currentOrganization?.id, scope1CO2e, scope2CO2e, fleetScope1CO2e, fleetScope2CO2e, fleetScope3CO2e, scope3Cat1CO2e, calculatedScope3OverheadsCO2e, xeroScope1Kg, xeroScope2Kg, xeroScope3Kg, scope3Cat1Breakdown]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Company Emissions
          </h1>
          <p className="text-muted-foreground mt-2">
            Build and track your organisation&apos;s annual carbon footprint
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
                {selectableYears.map((y) => (
                  <SelectItem key={y.year} value={y.year.toString()}>
                    {y.label}
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
          {isLoadingReport ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                // ── Compute all values once ────────────────────────
                const s1Utilities = scope1CO2e / 1000;
                const s1Fleet = fleetScope1CO2e;
                const s1Xero = xeroScope1Kg / 1000;
                const totalScope1 = s1Utilities + s1Fleet + s1Xero;

                const s2Utilities = scope2CO2e / 1000;
                const s2Fleet = fleetScope2CO2e;
                const s2Xero = xeroScope2Kg / 1000;
                const totalScope2 = s2Utilities + s2Fleet + s2Xero;

                const s3Products = scope3Cat1CO2e;
                const s3Activities = calculatedScope3OverheadsCO2e / 1000;
                const s3Xero = xeroScope3Kg / 1000;
                const s3Fleet = fleetScope3CO2e;
                const totalScope3 = s3Products + s3Activities + s3Xero + s3Fleet;

                const totalEmissions = totalScope1 + totalScope2 + totalScope3;
                const hasData = totalEmissions > 0;

                const pct = (v: number) => totalEmissions > 0 ? ((v / totalEmissions) * 100).toFixed(1) : '0';

                const SCOPE_COLORS = {
                  scope1: '#f97316',
                  scope2: '#3b82f6',
                  scope3: '#22c55e',
                };

                // Donut chart data
                const donutData = [
                  { name: 'Scope 1', value: totalScope1, color: SCOPE_COLORS.scope1 },
                  { name: 'Scope 2', value: totalScope2, color: SCOPE_COLORS.scope2 },
                  { name: 'Scope 3', value: totalScope3, color: SCOPE_COLORS.scope3 },
                ].filter(d => d.value > 0);

                // Source bar chart data
                const sourceData = [
                  { name: 'Facility fuels', value: s1Utilities, color: SCOPE_COLORS.scope1, scope: 'Scope 1' },
                  { name: 'Fleet (owned)', value: s1Fleet, color: SCOPE_COLORS.scope1, scope: 'Scope 1' },
                  { name: 'Spend data (S1)', value: s1Xero, color: SCOPE_COLORS.scope1, scope: 'Scope 1' },
                  { name: 'Purchased electricity', value: s2Utilities, color: SCOPE_COLORS.scope2, scope: 'Scope 2' },
                  { name: 'Fleet (electric)', value: s2Fleet, color: SCOPE_COLORS.scope2, scope: 'Scope 2' },
                  { name: 'Spend data (S2)', value: s2Xero, color: SCOPE_COLORS.scope2, scope: 'Scope 2' },
                  { name: 'Products (LCA)', value: s3Products, color: SCOPE_COLORS.scope3, scope: 'Scope 3' },
                  { name: 'Activities', value: s3Activities, color: SCOPE_COLORS.scope3, scope: 'Scope 3' },
                  { name: 'Spend data (S3)', value: s3Xero, color: SCOPE_COLORS.scope3, scope: 'Scope 3' },
                  { name: 'Fleet (grey)', value: s3Fleet, color: SCOPE_COLORS.scope3, scope: 'Scope 3' },
                ].filter(d => d.value > 0.001).sort((a, b) => b.value - a.value);

                // Data quality tiers (in tonnes)
                const tier1 = s3Products; // LCA supplier data
                const tier2 = s1Utilities + s2Utilities + s3Activities; // Activity data
                const tier4 = s1Xero + s2Xero + s3Xero; // Spend-based
                const tierTotal = tier1 + tier2 + tier4;

                if (!hasData) {
                  return (
                    <>
                      {/* Header with calculate button */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">{selectedYear} Company Footprint</h2>
                          <p className="text-sm text-muted-foreground">Overview of your organisation&apos;s greenhouse gas inventory</p>
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
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No emissions data found for {selectedYear}. Add utility data at <Link href="/company/facilities" className="underline font-medium">facility level</Link> for Scope 1 & 2, and add Scope 3 data below.
                        </AlertDescription>
                      </Alert>
                    </>
                  );
                }

                return (
                  <>
                    {/* ── Row 1: Hero + Donut ────────────────────────── */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{selectedYear} Company Footprint</h2>
                        <p className="text-sm text-muted-foreground">Overview of your organisation&apos;s greenhouse gas inventory</p>
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
                            Recalculate
                          </>
                        )}
                      </Button>
                    </div>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          {/* Left: Total number */}
                          <div className="flex-1 text-center md:text-left">
                            <div className="text-sm text-muted-foreground mb-1">Total Footprint</div>
                            <div className="text-5xl font-bold tracking-tight mb-2">
                              {totalEmissions.toFixed(2)}
                            </div>
                            <div className="text-lg text-muted-foreground">tonnes CO₂e</div>
                            {report?.updated_at && (
                              <div className="text-xs text-muted-foreground mt-3">
                                Last calculated: {new Date(report.updated_at).toLocaleString('en-GB')}
                              </div>
                            )}
                          </div>

                          {/* Right: Donut chart */}
                          <div className="w-64 h-64 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={donutData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={70}
                                  outerRadius={100}
                                  paddingAngle={2}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  {donutData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  formatter={(value: number) => [`${value.toFixed(3)} t`, '']}
                                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }}
                                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Centre label */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Scopes</div>
                                <div className="text-sm font-semibold">1 / 2 / 3</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Donut legend */}
                        <div className="flex justify-center gap-6 mt-4">
                          {donutData.map(d => (
                            <div key={d.name} className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground">{d.name}</span>
                              <span className="font-medium">{pct(d.value)}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Row 2: Enhanced Scope Cards ──────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Scope 1 */}
                      <Card className="border-orange-200 dark:border-orange-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Flame className="h-5 w-5 text-orange-500" />
                              <span className="font-medium">Scope 1</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pct(totalScope1)}%</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {totalScope1 > 0 ? `${totalScope1.toFixed(3)} tCO₂e` : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Direct emissions</p>
                          {/* Proportion bar */}
                          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct(totalScope1)}%` }} />
                          </div>
                          {/* Sub-breakdowns */}
                          {totalScope1 > 0 && (
                            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                              {s1Utilities > 0 && (
                                <div className="flex justify-between"><span>Facility fuels</span><span className="font-mono">{s1Utilities.toFixed(3)} t</span></div>
                              )}
                              {s1Fleet > 0 && (
                                <div className="flex justify-between"><span>Owned fleet</span><span className="font-mono">{s1Fleet.toFixed(3)} t</span></div>
                              )}
                              {s1Xero > 0 && (
                                <div className="flex justify-between"><span>Spend estimates</span><span className="font-mono">{s1Xero.toFixed(3)} t</span></div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Scope 2 */}
                      <Card className="border-blue-200 dark:border-blue-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Zap className="h-5 w-5 text-blue-500" />
                              <span className="font-medium">Scope 2</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pct(totalScope2)}%</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {totalScope2 > 0 ? `${totalScope2.toFixed(3)} tCO₂e` : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Purchased energy</p>
                          {/* Proportion bar */}
                          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct(totalScope2)}%` }} />
                          </div>
                          {/* Sub-breakdowns */}
                          {totalScope2 > 0 && (
                            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                              {s2Utilities > 0 && (
                                <div className="flex justify-between"><span>Electricity & heat</span><span className="font-mono">{s2Utilities.toFixed(3)} t</span></div>
                              )}
                              {s2Fleet > 0 && (
                                <div className="flex justify-between"><span>Electric fleet</span><span className="font-mono">{s2Fleet.toFixed(3)} t</span></div>
                              )}
                              {s2Xero > 0 && (
                                <div className="flex justify-between"><span>Spend estimates</span><span className="font-mono">{s2Xero.toFixed(3)} t</span></div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Scope 3 */}
                      <Card className="border-green-200 dark:border-green-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Globe className="h-5 w-5 text-green-500" />
                              <span className="font-medium">Scope 3</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pct(totalScope3)}%</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {totalScope3 > 0 ? `${totalScope3.toFixed(3)} tCO₂e` : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Value chain emissions</p>
                          {/* Proportion bar */}
                          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct(totalScope3)}%` }} />
                          </div>
                          {/* Sub-breakdowns */}
                          {totalScope3 > 0 && (
                            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                              {s3Products > 0 && (
                                <div className="flex justify-between">
                                  <span className="flex items-center gap-1">Products (LCA) <CheckCircle2 className="h-3 w-3 text-green-500" /></span>
                                  <span className="font-mono">{s3Products.toFixed(3)} t</span>
                                </div>
                              )}
                              {s3Activities > 0 && (
                                <div className="flex justify-between"><span>Activities</span><span className="font-mono">{s3Activities.toFixed(3)} t</span></div>
                              )}
                              {s3Xero > 0 && (
                                <div className="flex justify-between"><span>Spend estimates</span><span className="font-mono">{s3Xero.toFixed(3)} t</span></div>
                              )}
                              {s3Fleet > 0 && (
                                <div className="flex justify-between"><span>Grey fleet</span><span className="font-mono">{s3Fleet.toFixed(3)} t</span></div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* ── Row 3: Emissions by Source (bar chart) ───── */}
                    {sourceData.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Emissions by Source</CardTitle>
                          <CardDescription>All emission sources ranked by contribution (tonnes CO₂e)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={sourceData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toFixed(2)} t`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                                <RechartsTooltip
                                  formatter={(value: number) => [`${value.toFixed(3)} tCO₂e`, '']}
                                  labelFormatter={(label: string) => label}
                                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                  {sourceData.map((entry, index) => (
                                    <Cell key={`bar-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ── Row 4: Data Quality ───────────────────────── */}
                    {tierTotal > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Data Quality</CardTitle>
                          <CardDescription>Breakdown by GHG Protocol data tier</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {/* Stacked bar */}
                          <div className="flex h-4 rounded-full overflow-hidden mb-4">
                            {tier1 > 0 && (
                              <div className="bg-emerald-500 transition-all" style={{ width: `${(tier1 / tierTotal * 100)}%` }} title={`Tier 1: ${tier1.toFixed(3)} t`} />
                            )}
                            {tier2 > 0 && (
                              <div className="bg-blue-500 transition-all" style={{ width: `${(tier2 / tierTotal * 100)}%` }} title={`Tier 2: ${tier2.toFixed(3)} t`} />
                            )}
                            {tier4 > 0 && (
                              <div className="bg-red-400 transition-all" style={{ width: `${(tier4 / tierTotal * 100)}%` }} title={`Tier 4: ${tier4.toFixed(3)} t`} />
                            )}
                          </div>
                          {/* Legend */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {tier1 > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                                <div>
                                  <div className="font-medium">Tier 1 &middot; Supplier data</div>
                                  <div className="text-xs text-muted-foreground">{tier1.toFixed(3)} t ({(tier1 / tierTotal * 100).toFixed(0)}%)</div>
                                </div>
                              </div>
                            )}
                            {tier2 > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                                <div>
                                  <div className="font-medium">Tier 2 &middot; Activity data</div>
                                  <div className="text-xs text-muted-foreground">{tier2.toFixed(3)} t ({(tier2 / tierTotal * 100).toFixed(0)}%)</div>
                                </div>
                              </div>
                            )}
                            {tier4 > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                                <div>
                                  <div className="font-medium">Tier 4 &middot; Spend data</div>
                                  <div className="text-xs text-muted-foreground">{tier4.toFixed(3)} t ({(tier4 / tierTotal * 100).toFixed(0)}%)</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ── Row 5: How it's calculated ────────────────── */}
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
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
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
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
                        {((scope1CO2e / 1000) + fleetScope1CO2e + (xeroScope1Kg / 1000)) > 0
                          ? `${((scope1CO2e / 1000) + fleetScope1CO2e + (xeroScope1Kg / 1000)).toFixed(3)} tCO2e`
                          : 'No data'}
                      </div>
                      {(scope1CO2e > 0 || xeroScope1Kg > 0) && (
                        <div className="text-xs text-muted-foreground">
                          {scope1CO2e > 0 && `Utilities: ${(scope1CO2e / 1000).toFixed(3)} tCO2e`}
                          {scope1CO2e > 0 && fleetScope1CO2e > 0 && ' | '}
                          {fleetScope1CO2e > 0 && `Fleet: ${fleetScope1CO2e.toFixed(3)} tCO2e`}
                          {xeroScope1Kg > 0 && ` | Xero (spend-based): ${(xeroScope1Kg / 1000).toFixed(3)} tCO2e`}
                        </div>
                      )}
                    </div>

                    {/* Duplicate detection: Xero spend vs utility meter readings */}
                    <ScopeDuplicateWarning scope={1} yearStart={selectedYearStart} yearEnd={selectedYearEnd} />

                    {/* Xero energy baseline for Scope 1 */}
                    <XeroEnergyBaselineAlert entries={xeroScope1Entries} scope="Scope 1" />

                    {/* Link to add data */}
                    {sourceBreakdown.filter(s => s.scope === 'Scope 1').length === 0 && xeroScope1Entries.length === 0 && (
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
                        {(scope2CO2e + xeroScope2Kg) > 0
                          ? `${((scope2CO2e + xeroScope2Kg) / 1000).toFixed(3)} tCO2e`
                          : 'No data'}
                      </div>
                      {(scope2CO2e > 0 || xeroScope2Kg > 0) && (
                        <div className="text-xs text-muted-foreground">
                          {scope2CO2e > 0 && 'Location-based method (UK grid average)'}
                          {xeroScope2Kg > 0 && ` | Xero (spend-based): ${(xeroScope2Kg / 1000).toFixed(3)} tCO2e`}
                        </div>
                      )}
                    </div>

                    {/* Duplicate detection: Xero spend vs utility meter readings */}
                    <ScopeDuplicateWarning scope={2} yearStart={selectedYearStart} yearEnd={selectedYearEnd} />

                    {/* Xero energy baseline for Scope 2 */}
                    <XeroEnergyBaselineAlert entries={xeroScope2Entries} scope="Scope 2" />

                    {/* Link to add data */}
                    {sourceBreakdown.filter(s => s.scope === 'Scope 2').length === 0 && xeroScope2Entries.length === 0 && (
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
            {/* ── Summary Bar ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Scope 3</div>
                <div className="text-2xl font-bold font-mono">
                  {(() => {
                    const total = scope3Cat1CO2e + (calculatedScope3OverheadsCO2e / 1000) + (xeroScope3Kg / 1000) + fleetScope3CO2e;
                    return total > 0 ? `${total.toFixed(2)} t` : '—';
                  })()}
                </div>
                <div className="text-[10px] text-muted-foreground">CO2e for {selectedYear}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">From Products</div>
                <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                  {scope3Cat1CO2e > 0 ? `${scope3Cat1CO2e.toFixed(2)} t` : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">Cat 1: LCA-based (Tier 1)</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">From Activities</div>
                <div className="text-2xl font-bold font-mono">
                  {calculatedScope3OverheadsCO2e > 0 ? `${(calculatedScope3OverheadsCO2e / 1000).toFixed(2)} t` : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">Manual data entry</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">From Spend Data</div>
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {xeroScope3Kg > 0 ? `${(xeroScope3Kg / 1000).toFixed(2)} t` : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">Xero estimates (Tier 4)</div>
              </Card>
            </div>

            {isLoadingReport ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              /* ── Main Content: Categories + Sidebar ────────────── */
              <div className="flex flex-col xl:flex-row gap-6">
                {/* Left: Category Cards */}
                <div className="flex-1 min-w-0 space-y-6">

                  {/* ── Purchased Goods (Cat 1-2) ───────────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Purchased Goods (Cat 1-2)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      {/* Category 1: Products (compact version) */}
                      <Card className={scope3Cat1CO2e > 0 ? 'border-green-200 dark:border-green-900' : ''}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            Cat 1: Products
                            {scope3Cat1CO2e > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                Auto
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs">Raw materials and packaging from product LCAs</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {scope3Cat1CO2e > 0 ? (
                            <div>
                              <div className="text-2xl font-bold font-mono text-green-900 dark:text-green-100">
                                {scope3Cat1CO2e.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">tCO2e</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{scope3Cat1DataQuality}</div>
                              {scope3Cat1Breakdown.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  {scope3Cat1Breakdown.map((product, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                      <span className="truncate mr-2">{product.product_name}</span>
                                      <span className="font-mono shrink-0">{product.total_tco2e.toFixed(3)} t</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {scope3Cat1PendingProducts.length > 0 && (
                                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                  <AlertCircle className="h-3 w-3 inline mr-1" />
                                  {scope3Cat1PendingProducts.length} product{scope3Cat1PendingProducts.length !== 1 ? 's' : ''} excluded (incomplete LCA)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-xs text-muted-foreground mb-2">No product LCA data yet</p>
                              <Button variant="outline" size="sm" onClick={() => window.location.href = '/products'}>
                                Go to Products
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <CapitalGoodsCard
                        reportId={report.id}
                        entries={capitalGoodsEntries}
                        onUpdate={fetchReportData}
                      />

                      <MarketingMaterialsCard
                        reportId={report.id}
                        entries={marketingEntries}
                        onUpdate={fetchReportData}
                        xeroEntries={xeroByCategory.get('purchased_services_materials')}
                      />
                    </div>
                  </section>

                  {/* ── Travel & Commuting (Cat 6-7) ────────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Travel & Commuting (Cat 6-7)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      <BusinessTravelCard
                        reportId={report.id}
                        entries={travelEntries}
                        onUpdate={fetchReportData}
                        xeroEntries={xeroByCategory.get('business_travel')}
                      />

                      <TeamCommutingCard
                        reportId={report.id}
                        initialFteCount={fteCount}
                        onUpdate={fetchReportData}
                      />
                    </div>
                  </section>

                  {/* ── Purchased Services (Cat 8) ──────────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Purchased Services (Cat 8)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      <ServicesOverheadCard
                        reportId={report.id}
                        entries={serviceEntries}
                        onUpdate={fetchReportData}
                        xeroEntries={xeroByCategory.get('purchased_services')}
                      />
                    </div>
                  </section>

                  {/* ── Logistics & Transport (Cat 4, 9) ────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Logistics & Transport (Cat 4, 9)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      {currentOrganization && (
                        <LogisticsDistributionCard
                          reportId={report.id}
                          organizationId={currentOrganization.id}
                          year={selectedYear}
                          entries={logisticsEntries}
                          onUpdate={fetchReportData}
                          xeroEntries={xeroByCategory.get('downstream_logistics')}
                        />
                      )}

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
                    </div>
                  </section>

                  {/* ── Waste & Water (Cat 5) ───────────────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Waste & Water (Cat 5)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      <OperationalWasteCard
                        reportId={report.id}
                        entries={wasteEntries}
                        onUpdate={fetchReportData}
                        xeroEntries={xeroByCategory.get('operational_waste')}
                      />
                    </div>
                  </section>

                  {/* ── Product Use (Cat 11) ─────────────────────── */}
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Product Use Phase (Cat 11)
                    </h3>
                    <div className="columns-1 md:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
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
                  </section>
                </div>

                {/* Right: Import Sidebar */}
                <div className="xl:w-72 shrink-0 space-y-4">
                  <div className="xl:sticky xl:top-4 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Import Data
                    </h3>

                    {/* Xero link */}
                    <Card className="border-neon-lime/30 bg-neon-lime/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-neon-lime/20 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-neon-lime" fill="currentColor">
                              <path d="M4.205 12.02L8.087 7.98l.078-.082c.263-.27.563-.395.878-.395.482 0 .853.336.853.79 0 .232-.093.44-.263.62L6.74 12.02l2.893 3.106c.17.18.263.39.263.62 0 .453-.37.79-.853.79-.315 0-.615-.124-.878-.395l-.078-.082-3.882-4.04zm15.59 0L15.913 7.98l-.078-.082c-.263-.27-.563-.395-.878-.395-.482 0-.853.336-.853.79 0 .232.093.44.263.62l2.893 3.106-2.893 3.106c-.17.18-.263.39-.263.62 0 .453.37.79.853.79.315 0 .615-.124.878-.395l.078-.082 3.882-4.04z"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">Xero Integration</div>
                            <div className="text-xs text-muted-foreground">Classify suppliers by category</div>
                          </div>
                        </div>
                        <Link href="/data/xero-upgrades/">
                          <Button variant="outline" size="sm" className="w-full mt-3 text-xs">
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            Open Supplier Classification
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>

                    {/* Spend Import (CSV upload) */}
                    {currentOrganization && report && (
                      <SpendImportCard
                        reportId={report.id}
                        organizationId={currentOrganization.id}
                        year={selectedYear}
                        onUpdate={fetchReportData}
                      />
                    )}
                  </div>
                </div>
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
