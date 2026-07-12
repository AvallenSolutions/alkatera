'use client';

/**
 * The emissions surface (/data/scope-1-2/), recomposed the studio way.
 *
 * One scrolling paper, no internal tabs: statement (with the annual total
 * standing right), the setup rows while incomplete, THE FOOTPRINT (scope
 * split told once, with the by-source and by-facility tables folded in as
 * quiet disclosures), SCOPE 3 (the category cards re-cut quiet, no sticky
 * sidebar), THE TRENDS, and WHERE THESE NUMBERS COME FROM at the foot.
 *
 * This file owns all data behaviour: the queries, hooks and calculations
 * are unchanged from the pre-redesign page; the sections in
 * components/emissions/ are presentational.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { useReportingPeriod } from '@/hooks/useReportingPeriod';
import { useXeroTransactions } from '@/hooks/useXeroTransactions';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { resolveRefrigerantGwp } from '@/lib/ghg-constants';
import { EmissionsGuide } from '@/components/emissions/EmissionsGuide';
import { EmissionsStatement } from '@/components/emissions/EmissionsStatement';
import { FootprintSection } from '@/components/emissions/FootprintSection';
import { ScopeThreeSection } from '@/components/emissions/ScopeThreeSection';
import { TrendsSection } from '@/components/emissions/TrendsSection';
import { MethodSection } from '@/components/emissions/MethodSection';
import { FactRow } from '@/components/studio';
import type {
  CorporateReport,
  Facility,
  FacilityBreakdown,
  OverheadEntry,
  SourceBreakdown,
  TrendYear,
  UtilityDataEntry,
} from '@/components/emissions/types';

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
  refrigerant_leakage: { factor: 1430, unit: 'kgCO2e/kg', scope: 'Scope 1' }, // R134a GWP fallback; per-entry refrigerant_type overrides via REFRIGERANT_GWP
  co2_winemaking: { factor: 1.0, unit: 'kgCO2e/kg', scope: 'Scope 1' }, // 1 kg purchased CO2 = 1 kg CO2e (GHG Protocol process emission)
  // diesel_agricultural is handled in the vineyard growing profile (viticulture
  // machinery fuel); aviation_fuel in the fleet module — not as facility utilities.
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
  co2_winemaking: 'CO₂ (Winemaking, purchased)',
};

export default function CompanyEmissionsPage() {
  const { currentOrganization } = useOrganization();
  const { selectableYears, getYearRange, currentLabelYear } = useReportingPeriod();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [selectedYear, setSelectedYear] = useState(currentLabelYear);

  // Pulls the same SoT total that Company Vitality and the Rosa snapshot
  // both use, so the headline number on this page can never disagree with
  // those surfaces.
  const { footprint: sotFootprint } = useCompanyFootprint(selectedYear);

  // Tell Rosa where the user is in the company emissions surface so she
  // can answer "what's missing for scope 2 this year?" or "is this enough
  // for CSRD?" without the user having to spell out the period or scope.
  const rosaSlice = useMemo(() => {
    return {
      id: 'scope-1-2',
      label: `Company emissions · ${selectedYear}`,
      priority: 8,
      data: {
        page: 'scope-1-2',
        reporting_year: selectedYear,
        facility_count: facilities.length,
      },
    }
  }, [selectedYear, facilities.length])
  useRosaPageContext(rosaSlice)

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
  const [scope3Cat11CO2e, setScope3Cat11CO2e] = useState(0);
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

  // Xero transaction data for display in scope sections
  const {
    xeroByCategory,
    scope1Entries: xeroScope1Entries,
    scope2Entries: xeroScope2Entries,
    totalScope1Kg: xeroScope1Kg,
    totalScope2Kg: xeroScope2Kg,
    totalScope3Kg: xeroScope3Kg,
    suppressedCount: xeroSuppressedCount,
    suppressedKg: xeroSuppressedKg,
    suppressedByLcaCount: xeroSuppressedByLcaCount,
    suppressedByInventoryCount: xeroSuppressedByInventoryCount,
    inventoryLedgerKg: xeroInventoryLedgerKg,
  } = useXeroTransactions(currentOrganization?.id, selectedYearStart, selectedYearEnd);

  // Trend analytics state
  const [trendData, setTrendData] = useState<TrendYear[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

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
          refrigerant_type,
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
        refrigerant_type: item.refrigerant_type ?? null,
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

        // Per-refrigerant-type GWP. Legacy entries (no refrigerant_type)
        // fall back to R-134a (GWP 1430), identical to prior behaviour.
        if (entry.utility_type === 'refrigerant_leakage') {
          co2e = entry.quantity * resolveRefrigerantGwp(entry.refrigerant_type);
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
        let totalUsePhaseEmissions = 0;
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
          // Separate use-phase (Cat 11) from purchased goods (Cat 1)
          const usePhasePerUnit = lca.aggregated_impacts?.breakdown?.by_lifecycle_stage?.use_phase || 0;
          const cat1PerUnit = scope3PerUnit - usePhasePerUnit;

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

          const cat1ImpactKg = cat1PerUnit * unitsProduced;
          const cat1ImpactTonnes = cat1ImpactKg / 1000;
          totalEmissions += cat1ImpactTonnes;

          // Accumulate use-phase (Cat 11) separately
          const usePhaseKg = usePhasePerUnit * unitsProduced;
          totalUsePhaseEmissions += usePhaseKg / 1000;

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
            total_tco2e: cat1ImpactTonnes,
            materials_tco2e: (materialsPerUnit * unitsProduced) / 1000,
            packaging_tco2e: (packagingPerUnit * unitsProduced) / 1000,
            production_volume: unitsProduced,
          });

          console.log(`✅ [SCOPE 3 CAT 1] Fallback: ${(productData as any).name}: cat1/unit=${cat1PerUnit.toFixed(4)} × ${unitsProduced} units = ${cat1ImpactTonnes.toFixed(4)} tCO2e (use_phase: ${(usePhaseKg / 1000).toFixed(4)} t)`);
        }

        setScope3Cat1CO2e(totalEmissions);
        setScope3Cat11CO2e(totalUsePhaseEmissions);
        setScope3Cat1Breakdown(breakdown);
        setScope3Cat1DataQuality(totalEmissions > 0 ? 'Tier 1: Primary LCA data (from completed product reports)' : 'No completed product PEIs found for selected year');
        return;
      }

      let totalEmissions = 0;
      let totalUsePhaseEmissions = 0;
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
        // Separate use-phase (Cat 11) from purchased goods (Cat 1)
        const usePhasePerUnit = lca?.aggregated_impacts?.breakdown?.by_lifecycle_stage?.use_phase || 0;
        const cat1PerUnit = scope3PerUnit - usePhasePerUnit;
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

        // Use Cat 1 only (excludes use-phase Cat 11 and facility S1/S2)
        const emissionsPerUnit = cat1PerUnit;
        const totalImpactKg = emissionsPerUnit * unitsProduced;
        const totalImpactTonnes = totalImpactKg / 1000;

        totalEmissions += totalImpactTonnes;

        // Accumulate use-phase (Cat 11) separately
        const usePhaseKg = usePhasePerUnit * unitsProduced;
        totalUsePhaseEmissions += usePhaseKg / 1000;

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
      setScope3Cat11CO2e(totalUsePhaseEmissions);
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
      setScope3Cat11CO2e(0);
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

  const fetchTrendData = async () => {
    if (!currentOrganization?.id) return;
    setIsLoadingTrends(true);
    try {
      const browserSupabase = getSupabaseBrowserClient();
      const { data: allReports } = await browserSupabase
        .from('corporate_reports')
        .select('year')
        .eq('organization_id', currentOrganization.id)
        .order('year', { ascending: true });

      if (!allReports || allReports.length === 0) return;

      const results = await Promise.all(
        allReports.map(async (r) => {
          try {
            const result = await calculateCorporateEmissions(browserSupabase, currentOrganization.id, r.year);
            const bd = result.breakdown;
            return {
              year: r.year,
              scope1: bd.scope1 / 1000,
              scope2: bd.scope2 / 1000,
              scope3: bd.scope3.total / 1000,
              total: bd.total / 1000,
            };
          } catch {
            return { year: r.year, scope1: 0, scope2: 0, scope3: 0, total: 0 };
          }
        })
      );
      setTrendData(results.filter(r => r.total > 0));
    } catch {
      // silent — non-fatal
    } finally {
      setIsLoadingTrends(false);
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

  // The trends are a section on the one scrolling paper now (no tab to
  // lazily activate them), so they load with the page.
  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTrendData();
    }
  }, [currentOrganization?.id]);

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
    // use_phase excluded: Cat 11 is sourced from product LCA data, not manual overheads
  ];
  const calculatedScope3OverheadsCO2e = overheads
    .filter((o) => scope3OverheadCategories.includes(o.category))
    .reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  // Persist calculated emissions to corporate_reports for Rosa AI to read.
  // Totals now come from the SoT (`calculateCorporateEmissions` via the
  // `useCompanyFootprint` hook) so Rosa AI sees the same number the user
  // sees on this page, on Company Vitality, and on the Progress Tracker.
  useEffect(() => {
    const persistEmissions = async () => {
      if (!report?.id || !currentOrganization?.id) return;
      if (!sotFootprint?.breakdown) return;

      const sb = sotFootprint.breakdown;
      // SoT returns kg; corporate_reports stores tonnes.
      const totalScope1Tonnes = sb.scope1 / 1000;
      const totalScope2Tonnes = sb.scope2 / 1000;
      const totalScope3Tonnes = sb.scope3.total / 1000;
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
          products: scope3Cat1CO2e,          // in tonnes (Cat 1: purchased goods)
          use_phase: scope3Cat11CO2e,        // in tonnes (Cat 11: use of sold products)
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
  }, [report?.id, currentOrganization?.id, sotFootprint, fleetScope1CO2e, fleetScope2CO2e, fleetScope3CO2e, scope3Cat1CO2e, scope3Cat11CO2e, calculatedScope3OverheadsCO2e, xeroScope3Kg, scope3Cat1Breakdown]);

  // ── Per-source values for transparency (tonnes) ──────────────────────
  // These show "what's inside" each scope at the data-source level. They
  // are NOT the totals — totals come from the single-source-of-truth
  // `calculateCorporateEmissions` (via `useCompanyFootprint`) to stay
  // aligned with Company Vitality and the Rosa Progress Tracker.
  const s1Utilities = scope1CO2e / 1000;
  const s1Fleet = fleetScope1CO2e;
  const s1Xero = xeroScope1Kg / 1000;

  const s2Utilities = scope2CO2e / 1000;
  const s2Fleet = fleetScope2CO2e;
  const s2Xero = xeroScope2Kg / 1000;

  const s3Products = scope3Cat1CO2e;
  const s3UsePhase = scope3Cat11CO2e;
  const s3Activities = calculatedScope3OverheadsCO2e / 1000;
  const s3Xero = xeroScope3Kg / 1000;
  const s3Fleet = fleetScope3CO2e;

  // SoT scope totals (kg → tonnes). When the SoT hook is still loading,
  // fall back to the piecewise sum so the UI never shows zeros during
  // data fetch.
  const sotBreakdown = sotFootprint?.breakdown;
  const totalScope1 = sotBreakdown
    ? sotBreakdown.scope1 / 1000
    : s1Utilities + s1Fleet + s1Xero;
  const totalScope2 = sotBreakdown
    ? sotBreakdown.scope2 / 1000
    : s2Utilities + s2Fleet + s2Xero;
  const totalScope3 = sotBreakdown
    ? sotBreakdown.scope3.total / 1000
    : s3Products + s3UsePhase + s3Activities + s3Xero + s3Fleet;

  const totalEmissions = totalScope1 + totalScope2 + totalScope3;
  const hasData = totalEmissions > 0;

  // Data quality tiers (in tonnes)
  const tier1 = s3Products + s3UsePhase; // LCA supplier data
  const tier2 = s1Utilities + s2Utilities + s3Activities; // Activity data
  const tier4 = s1Xero + s2Xero + s3Xero; // Spend-based

  return (
    <div className="space-y-12">
      <EmissionsStatement
        selectedYear={selectedYear}
        selectableYears={selectableYears}
        onYearChange={setSelectedYear}
        reportStatus={report?.status}
        lastCalculatedAt={report?.updated_at}
        totalEmissions={totalEmissions}
        hasData={hasData}
        isGenerating={isGenerating}
        isLoading={isLoadingReport}
        onCalculate={handleGenerateReport}
      />

      {facilities.length === 0 && !isLoadingFacilities && (
        <p className="text-sm text-muted-foreground">
          No facilities yet.{' '}
          <Link
            href="/company/facilities"
            className="font-medium text-room-accent underline-offset-4 hover:underline"
          >
            Add your facilities
          </Link>{' '}
          before entering activity data.
        </p>
      )}

      <EmissionsGuide
        facilitiesCount={facilities.length}
        scope1CO2e={scope1CO2e}
        scope2CO2e={scope2CO2e}
        scope3Cat1CO2e={scope3Cat1CO2e}
        calculatedScope3OverheadsCO2e={calculatedScope3OverheadsCO2e}
        xeroScope3Kg={xeroScope3Kg}
        hasReport={!!report}
        onCalculate={handleGenerateReport}
      />

      <FootprintSection
        selectedYear={selectedYear}
        selectedYearStart={selectedYearStart}
        selectedYearEnd={selectedYearEnd}
        isLoading={isLoadingReport}
        hasData={hasData}
        totals={{
          scope1: totalScope1,
          scope2: totalScope2,
          scope3: totalScope3,
          total: totalEmissions,
        }}
        sources={{
          s1Utilities,
          s1Fleet,
          s1Xero,
          s2Utilities,
          s2Fleet,
          s2Xero,
          s3Products,
          s3UsePhase,
          s3Activities,
          s3Xero,
          s3Fleet,
        }}
        scope1CO2eKg={scope1CO2e}
        scope2CO2eKg={scope2CO2e}
        sourceBreakdown={sourceBreakdown}
        facilityBreakdown={facilityBreakdown}
        xeroScope1Entries={xeroScope1Entries}
        xeroScope2Entries={xeroScope2Entries}
      />

      <ScopeThreeSection
        report={report}
        organizationId={currentOrganization?.id}
        selectedYear={selectedYear}
        isLoading={isLoadingReport}
        onUpdate={fetchReportData}
        scope3Cat1CO2e={scope3Cat1CO2e}
        scope3Cat11CO2e={scope3Cat11CO2e}
        calculatedScope3OverheadsKg={calculatedScope3OverheadsCO2e}
        xeroScope3Kg={xeroScope3Kg}
        fleetScope3CO2e={fleetScope3CO2e}
        scope3Cat1Breakdown={scope3Cat1Breakdown}
        scope3Cat1PendingProducts={scope3Cat1PendingProducts}
        scope3Cat1DataQuality={scope3Cat1DataQuality}
        travelEntries={travelEntries}
        serviceEntries={serviceEntries}
        marketingEntries={marketingEntries}
        fteCount={fteCount}
        capitalGoodsEntries={capitalGoodsEntries}
        logisticsEntries={logisticsEntries}
        wasteEntries={wasteEntries}
        upstreamTransportEntries={upstreamTransportEntries}
        downstreamTransportEntries={downstreamTransportEntries}
        xeroByCategory={xeroByCategory}
        suppressedCount={xeroSuppressedCount}
        suppressedKg={xeroSuppressedKg}
        suppressedByLcaCount={xeroSuppressedByLcaCount}
        suppressedByInventoryCount={xeroSuppressedByInventoryCount}
        inventoryLedgerKg={xeroInventoryLedgerKg}
      />

      <TrendsSection trendData={trendData} isLoading={isLoadingTrends} />

      <MethodSection tier1={tier1} tier2={tier2} tier4={tier4} />

      {/* Delineation: the annual report builder */}
      <FactRow
        subject="Build the annual report"
        detail="the evidence, company footprint"
        meta="→"
        href="/reports/company-footprint/"
      />
    </div>
  );
}
