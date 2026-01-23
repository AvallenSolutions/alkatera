'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

export interface Scope3CategoryData {
  category: number;
  name: string;
  description: string;
  totalEmissions: number;
  entryCount: number;
  dataQuality: 'primary' | 'secondary' | 'estimated' | 'missing';
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
  entries: Scope3Entry[];
}

export interface Scope3Entry {
  id: string;
  date: string;
  description: string;
  emissions: number;
  unit: string;
  quantity?: number;
  source: string;
  dataQuality: 'primary' | 'secondary' | 'estimated';
  metadata?: Record<string, any>;
}

export interface ProductEmissionDetail {
  productId: string;
  productName: string;
  sku?: string;
  unitsProduced: number;
  emissionsPerUnit: number;
  totalEmissions: number;
  materials: {
    name: string;
    quantity: number;
    unit: string;
    emissions: number;
    percentage: number;
  }[];
  packaging: {
    name: string;
    quantity: number;
    unit: string;
    emissions: number;
    percentage: number;
  }[];
}

export interface BusinessTravelDetail {
  id: string;
  date: string;
  transportMode: string;
  origin?: string;
  destination?: string;
  distance?: number;
  spend?: number;
  emissions: number;
  cabinClass?: string;
}

export interface CommutingDetail {
  id: string;
  fteCount: number;
  averageDistance: number;
  transportMode: string;
  workingDays: number;
  emissions: number;
}

export interface LogisticsDetail {
  id: string;
  date: string;
  transportMode: string;
  origin?: string;
  destination?: string;
  distance?: number;
  weight?: number;
  emissions: number;
}

export interface WasteDetail {
  id: string;
  date: string;
  wasteType: string;
  disposalMethod: string;
  quantity: number;
  unit: string;
  emissions: number;
}

const SCOPE3_CATEGORIES = [
  { category: 1, name: 'Purchased Goods & Services', description: 'Upstream emissions from purchased goods and services' },
  { category: 2, name: 'Capital Goods', description: 'Upstream emissions from capital goods' },
  { category: 3, name: 'Fuel & Energy Related Activities', description: 'Not included in Scope 1 or 2' },
  { category: 4, name: 'Upstream Transportation', description: 'Transportation of purchased goods' },
  { category: 5, name: 'Waste Generated in Operations', description: 'Disposal of waste generated' },
  { category: 6, name: 'Business Travel', description: 'Employee business travel' },
  { category: 7, name: 'Employee Commuting', description: 'Employee travel to work' },
  { category: 8, name: 'Upstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 9, name: 'Downstream Transportation', description: 'Transportation of sold products' },
  { category: 10, name: 'Processing of Sold Products', description: 'Processing by third parties' },
  { category: 11, name: 'Use of Sold Products', description: 'End use of products' },
  { category: 12, name: 'End-of-Life Treatment', description: 'Disposal of sold products' },
  { category: 13, name: 'Downstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 14, name: 'Franchises', description: 'Emissions from franchises' },
  { category: 15, name: 'Investments', description: 'Emissions from investments' },
];

export function useScope3GranularData(organizationId: string | undefined, year: number) {
  const [categories, setCategories] = useState<Scope3CategoryData[]>([]);
  const [productDetails, setProductDetails] = useState<ProductEmissionDetail[]>([]);
  const [travelDetails, setTravelDetails] = useState<BusinessTravelDetail[]>([]);
  const [commutingDetails, setCommutingDetails] = useState<CommutingDetail[]>([]);
  const [logisticsDetails, setLogisticsDetails] = useState<LogisticsDetail[]>([]);
  const [wasteDetails, setWasteDetails] = useState<WasteDetail[]>([]);
  const [totalScope3, setTotalScope3] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGranularData = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const categoryData: Map<number, Scope3CategoryData> = new Map();
      SCOPE3_CATEGORIES.forEach(cat => {
        categoryData.set(cat.category, {
          category: cat.category,
          name: cat.name,
          description: cat.description,
          totalEmissions: 0,
          entryCount: 0,
          dataQuality: 'missing',
          entries: [],
        });
      });

      const { data: reportData } = await supabase
        .from('corporate_reports')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('year', year)
        .maybeSingle();

      const { data: productionLogs } = await supabase
        .from('production_logs')
        .select(`
          id,
          product_id,
          volume,
          unit,
          units_produced,
          date,
          products (
            id,
            name,
            sku
          )
        `)
        .eq('organization_id', organizationId)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      const productDetailsArr: ProductEmissionDetail[] = [];
      let cat1Total = 0;

      if (productionLogs && productionLogs.length > 0) {
        for (const log of productionLogs) {
          const { data: lca } = await supabase
            .from('product_carbon_footprints')
            .select('id, total_ghg_emissions, status')
            .eq('product_id', log.product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lca && lca.total_ghg_emissions > 0) {
            const unitsProduced = log.units_produced || 0;
            if (unitsProduced <= 0) continue;

            const totalEmissions = lca.total_ghg_emissions * unitsProduced;
            cat1Total += totalEmissions;

            const { data: materials } = await supabase
              .from('product_carbon_footprint_materials')
              .select('name, quantity, unit, impact_climate, material_type')
              .eq('product_carbon_footprint_id', lca.id);

            const ingredientsList: ProductEmissionDetail['materials'] = [];
            const packagingList: ProductEmissionDetail['packaging'] = [];

            if (materials) {
              materials.forEach(m => {
                const item = {
                  name: m.name || 'Unknown',
                  quantity: (m.quantity || 0) * unitsProduced,
                  unit: m.unit || 'kg',
                  emissions: (m.impact_climate || 0) * unitsProduced,
                  percentage: totalEmissions > 0 ? ((m.impact_climate || 0) * unitsProduced / totalEmissions) * 100 : 0,
                };
                if (m.material_type === 'packaging') {
                  packagingList.push(item);
                } else {
                  ingredientsList.push(item);
                }
              });
            }

            ingredientsList.sort((a, b) => b.emissions - a.emissions);
            packagingList.sort((a, b) => b.emissions - a.emissions);

            const productInfo = log.products as any;
            productDetailsArr.push({
              productId: log.product_id,
              productName: productInfo?.name || 'Unknown Product',
              sku: productInfo?.sku,
              unitsProduced,
              emissionsPerUnit: lca.total_ghg_emissions,
              totalEmissions,
              materials: ingredientsList,
              packaging: packagingList,
            });
          }
        }
      }

      const cat1 = categoryData.get(1)!;
      cat1.totalEmissions = cat1Total;
      cat1.entryCount = productDetailsArr.length;
      cat1.dataQuality = productDetailsArr.length > 0 ? 'primary' : 'missing';
      setProductDetails(productDetailsArr);

      if (reportData) {
        const { data: overheads } = await supabase
          .from('corporate_overheads')
          .select('*')
          .eq('report_id', reportData.id);

        if (overheads) {
          const travelArr: BusinessTravelDetail[] = [];
          const commutingArr: CommutingDetail[] = [];
          const logisticsArr: LogisticsDetail[] = [];
          const wasteArr: WasteDetail[] = [];

          overheads.forEach(entry => {
            const co2e = entry.computed_co2e || 0;

            switch (entry.category) {
              case 'capital_goods': {
                const cat2 = categoryData.get(2)!;
                cat2.totalEmissions += co2e;
                cat2.entryCount += 1;
                cat2.dataQuality = 'secondary';
                cat2.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || entry.asset_type || 'Capital goods',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.spend_amount,
                  source: 'Spend-based',
                  dataQuality: 'secondary',
                  metadata: { assetType: entry.asset_type, spend: entry.spend_amount },
                });
                break;
              }
              case 'operational_waste': {
                const cat5 = categoryData.get(5)!;
                cat5.totalEmissions += co2e;
                cat5.entryCount += 1;
                cat5.dataQuality = 'secondary';
                cat5.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || entry.disposal_method || 'Waste',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.weight_kg,
                  source: 'Weight-based',
                  dataQuality: 'secondary',
                  metadata: { disposalMethod: entry.disposal_method, weight: entry.weight_kg },
                });
                wasteArr.push({
                  id: entry.id,
                  date: entry.entry_date,
                  wasteType: entry.material_type || 'General',
                  disposalMethod: entry.disposal_method || 'Unknown',
                  quantity: entry.weight_kg || 0,
                  unit: 'kg',
                  emissions: co2e,
                });
                break;
              }
              case 'business_travel': {
                const cat6 = categoryData.get(6)!;
                cat6.totalEmissions += co2e;
                cat6.entryCount += 1;
                cat6.dataQuality = 'secondary';
                cat6.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || entry.transport_mode || 'Business travel',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.distance_km || entry.spend_amount,
                  source: entry.distance_km ? 'Distance-based' : 'Spend-based',
                  dataQuality: 'secondary',
                  metadata: {
                    transportMode: entry.transport_mode,
                    distance: entry.distance_km,
                    spend: entry.spend_amount,
                  },
                });
                travelArr.push({
                  id: entry.id,
                  date: entry.entry_date,
                  transportMode: entry.transport_mode || 'Unknown',
                  distance: entry.distance_km,
                  spend: entry.spend_amount,
                  emissions: co2e,
                  cabinClass: entry.cabin_class,
                });
                break;
              }
              case 'employee_commuting': {
                const cat7 = categoryData.get(7)!;
                cat7.totalEmissions += co2e;
                cat7.entryCount += 1;
                cat7.dataQuality = 'estimated';
                cat7.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || 'Employee commuting',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.fte_count,
                  source: 'FTE-based estimate',
                  dataQuality: 'estimated',
                  metadata: { fteCount: entry.fte_count, transportMode: entry.transport_mode },
                });
                commutingArr.push({
                  id: entry.id,
                  fteCount: entry.fte_count || 0,
                  averageDistance: entry.distance_km || 0,
                  transportMode: entry.transport_mode || 'Mixed',
                  workingDays: 230,
                  emissions: co2e,
                });
                break;
              }
              case 'downstream_logistics': {
                const cat9 = categoryData.get(9)!;
                cat9.totalEmissions += co2e;
                cat9.entryCount += 1;
                cat9.dataQuality = 'secondary';
                cat9.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || 'Distribution',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.weight_kg,
                  source: 'Activity-based',
                  dataQuality: 'secondary',
                  metadata: {
                    transportMode: entry.transport_mode,
                    distance: entry.distance_km,
                    weight: entry.weight_kg,
                  },
                });
                logisticsArr.push({
                  id: entry.id,
                  date: entry.entry_date,
                  transportMode: entry.transport_mode || 'Unknown',
                  distance: entry.distance_km,
                  weight: entry.weight_kg,
                  emissions: co2e,
                });
                break;
              }
              case 'purchased_services': {
                const cat1 = categoryData.get(1)!;
                cat1.totalEmissions += co2e;
                cat1.entryCount += 1;
                if (cat1.dataQuality === 'missing') cat1.dataQuality = 'secondary';
                cat1.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || (entry.material_type ? 'Marketing materials' : 'Purchased services'),
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.spend_amount,
                  source: 'Spend-based',
                  dataQuality: 'secondary',
                });
                break;
              }
              case 'upstream_transportation': {
                const cat4 = categoryData.get(4)!;
                cat4.totalEmissions += co2e;
                cat4.entryCount += 1;
                cat4.dataQuality = 'secondary';
                cat4.entries.push({
                  id: entry.id,
                  date: entry.entry_date,
                  description: entry.description || 'Upstream transportation',
                  emissions: co2e,
                  unit: 'kg CO₂e',
                  quantity: entry.weight_kg,
                  source: entry.distance_km ? 'Distance-based' : 'Spend-based',
                  dataQuality: 'secondary',
                  metadata: {
                    transportMode: entry.transport_mode,
                    distance: entry.distance_km,
                    weight: entry.weight_kg,
                  },
                });
                logisticsArr.push({
                  id: entry.id,
                  date: entry.entry_date,
                  transportMode: entry.transport_mode || 'Unknown',
                  distance: entry.distance_km,
                  weight: entry.weight_kg,
                  emissions: co2e,
                });
                break;
              }
            }
          });

          setTravelDetails(travelArr);
          setCommutingDetails(commutingArr);
          setLogisticsDetails(logisticsArr);
          setWasteDetails(wasteArr);
        }
      }

      const { data: fleetScope3 } = await supabase
        .from('fleet_activities')
        .select('id, emissions_tco2e, reporting_period_start, activity_type, vehicle_id')
        .eq('organization_id', organizationId)
        .eq('scope', 'Scope 3 Cat 6')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (fleetScope3 && fleetScope3.length > 0) {
        const cat6 = categoryData.get(6)!;
        fleetScope3.forEach(item => {
          const emissionsKg = (item.emissions_tco2e || 0) * 1000;
          cat6.totalEmissions += emissionsKg;
          cat6.entryCount += 1;
          cat6.entries.push({
            id: item.id,
            date: item.reporting_period_start,
            description: 'Grey fleet / employee vehicles',
            emissions: emissionsKg,
            unit: 'kg CO₂e',
            source: 'Activity-based',
            dataQuality: 'primary',
          });
        });
        if (cat6.dataQuality === 'missing') cat6.dataQuality = 'primary';
      }

      // =========================================================================
      // Categories from scope3-categories.ts (Cat 4, 9, 11)
      // =========================================================================
      try {
        const { calculateScope3Cat4, calculateScope3Cat9, calculateScope3Cat11 } =
          await import('@/lib/calculations/scope3-categories');

        const [cat4Result, cat9Result, cat11Result] = await Promise.all([
          calculateScope3Cat4(supabase, organizationId, yearStart, yearEnd),
          calculateScope3Cat9(supabase, organizationId, yearStart, yearEnd),
          calculateScope3Cat11(supabase, organizationId, yearStart, yearEnd),
        ]);

        // Cat 4: Upstream Transportation (add to existing if any overhead entries)
        if (cat4Result.totalKgCO2e > 0) {
          const cat4 = categoryData.get(4)!;
          cat4.totalEmissions += cat4Result.totalKgCO2e;
          cat4.entryCount += cat4Result.breakdown.length;
          cat4.dataQuality = cat4Result.dataQuality === 'primary' ? 'primary' : 'secondary';
          cat4Result.breakdown.forEach((emission, idx) => {
            cat4.entries.push({
              id: `cat4-calc-${idx}`,
              date: yearStart,
              description: `${emission.mode} transport: ${emission.weightTonnes.toFixed(1)}t × ${emission.distanceKm}km`,
              emissions: emission.emissionsKgCO2e,
              unit: 'kg CO₂e',
              source: emission.source,
              dataQuality: cat4Result.dataQuality === 'primary' ? 'primary' : 'secondary',
            });
          });
        }

        // Cat 9: Downstream Transportation (add to existing downstream_logistics if any)
        if (cat9Result.totalKgCO2e > 0) {
          const cat9 = categoryData.get(9)!;
          // Only add if no manual entries exist (to avoid double counting)
          if (cat9.totalEmissions === 0) {
            cat9.totalEmissions = cat9Result.totalKgCO2e;
            cat9.entryCount = cat9Result.breakdown.length;
            cat9.dataQuality = cat9Result.dataQuality === 'primary' ? 'primary' : 'estimated';
            cat9Result.breakdown.forEach((emission, idx) => {
              cat9.entries.push({
                id: `cat9-calc-${idx}`,
                date: yearStart,
                description: `Distribution: ${emission.weightTonnes.toFixed(1)}t × ${emission.distanceKm}km`,
                emissions: emission.emissionsKgCO2e,
                unit: 'kg CO₂e',
                source: emission.source,
                dataQuality: cat9Result.dataQuality === 'estimated' ? 'estimated' : 'secondary',
              });
            });
          }
        }

        // Cat 11: Use of Sold Products
        if (cat11Result.totalKgCO2e > 0) {
          const cat11 = categoryData.get(11)!;
          cat11.totalEmissions = cat11Result.totalKgCO2e;
          cat11.entryCount = cat11Result.breakdown.length;
          cat11.dataQuality = 'estimated';
          cat11Result.breakdown.forEach(emission => {
            cat11.entries.push({
              id: `cat11-${emission.productId}`,
              date: yearStart,
              description: `${emission.productName}: ${emission.useCategory}`,
              emissions: emission.emissionsKgCO2e,
              unit: 'kg CO₂e',
              source: emission.assumptionsUsed.join('; '),
              dataQuality: 'estimated',
            });
          });
        }
      } catch (err) {
        console.warn('[useScope3GranularData] Could not calculate Categories 4, 9, 11:', err);
      }

      // =========================================================================
      // Cat 12: End-of-Life Treatment (from product LCA data)
      // =========================================================================
      try {
        const { data: lcasWithEol } = await supabase
          .from('product_carbon_footprints')
          .select('id, product_name, aggregated_impacts')
          .eq('organization_id', organizationId)
          .eq('status', 'completed')
          .not('aggregated_impacts', 'is', null);

        let cat12Total = 0;
        const cat12Entries: Scope3Entry[] = [];

        lcasWithEol?.forEach(lca => {
          const eolEmissions = lca.aggregated_impacts?.breakdown?.by_lifecycle_stage?.end_of_life ||
                              lca.aggregated_impacts?.end_of_life_emissions || 0;
          if (eolEmissions > 0) {
            // Find production volume for this product
            const prodLog = productionLogs?.find(p => p.product_id === (lca as any).product_id);
            const unitsProduced = prodLog?.units_produced || 0;
            const totalEol = eolEmissions * unitsProduced;
            if (totalEol > 0) {
              cat12Total += totalEol;
              cat12Entries.push({
                id: `cat12-${lca.id}`,
                date: yearStart,
                description: `${lca.product_name}: End-of-life treatment`,
                emissions: totalEol,
                unit: 'kg CO₂e',
                source: 'Product LCA',
                dataQuality: 'secondary',
              });
            }
          }
        });

        if (cat12Total > 0) {
          const cat12 = categoryData.get(12)!;
          cat12.totalEmissions = cat12Total;
          cat12.entryCount = cat12Entries.length;
          cat12.dataQuality = 'secondary';
          cat12.entries = cat12Entries;
        }
      } catch (err) {
        console.warn('[useScope3GranularData] Could not calculate Category 12:', err);
      }

      // =========================================================================
      // Cat 3: Fuel & Energy Related Activities (Well-to-Tank emissions)
      // Calculated as ~15% of Scope 1+2 emissions (industry estimate for WTT)
      // =========================================================================
      try {
        const { data: utilityData } = await supabase
          .from('utility_data_entries')
          .select('quantity, utility_type')
          .eq('organization_id', organizationId)
          .gte('reporting_period_start', yearStart)
          .lte('reporting_period_end', yearEnd);

        if (utilityData && utilityData.length > 0) {
          // WTT factors (approximate % of direct emission factor)
          const wttFactors: Record<string, number> = {
            natural_gas: 0.15,
            electricity_grid: 0.12,
            diesel_stationary: 0.18,
            diesel_mobile: 0.18,
            petrol_mobile: 0.16,
          };

          let cat3Total = 0;
          utilityData.forEach((entry: any) => {
            const wttFactor = wttFactors[entry.utility_type] || 0.15;
            // Rough estimate: WTT is ~15% additional to direct emissions
            const directEmissionFactors: Record<string, number> = {
              natural_gas: 0.18293,
              electricity_grid: 0.207,
              diesel_stationary: 2.68787,
              diesel_mobile: 2.68787,
              petrol_mobile: 2.31,
            };
            const directFactor = directEmissionFactors[entry.utility_type] || 0;
            const directEmissions = entry.quantity * directFactor;
            cat3Total += directEmissions * wttFactor;
          });

          if (cat3Total > 0) {
            const cat3 = categoryData.get(3)!;
            cat3.totalEmissions = cat3Total;
            cat3.entryCount = 1;
            cat3.dataQuality = 'estimated';
            cat3.entries.push({
              id: 'cat3-wtt',
              date: yearStart,
              description: 'Well-to-tank emissions for fuel & energy',
              emissions: cat3Total,
              unit: 'kg CO₂e',
              source: 'Estimated from utility consumption (WTT ~15%)',
              dataQuality: 'estimated',
            });
          }
        }
      } catch (err) {
        console.warn('[useScope3GranularData] Could not calculate Category 3:', err);
      }

      let total = 0;
      categoryData.forEach(cat => {
        total += cat.totalEmissions;
      });
      setTotalScope3(total);

      const categoriesArr = Array.from(categoryData.values()).sort((a, b) => b.totalEmissions - a.totalEmissions);
      setCategories(categoriesArr);

    } catch (err: any) {
      console.error('Error fetching Scope 3 granular data:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, year]);

  useEffect(() => {
    fetchGranularData();
  }, [fetchGranularData]);

  return {
    categories,
    productDetails,
    travelDetails,
    commutingDetails,
    logisticsDetails,
    wasteDetails,
    totalScope3,
    isLoading,
    error,
    refetch: fetchGranularData,
  };
}
