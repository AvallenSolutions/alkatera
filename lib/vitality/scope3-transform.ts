/**
 * Scope 3 shaping for the vitality surfaces.
 *
 * Lifted out of app/(authenticated)/performance/page.tsx when the axis routes
 * arrived: /performance/ and /performance/[axis]/ must not each hold their own
 * copy of how a corporate footprint becomes the 15 GHG Protocol categories, or
 * the same organisation's climate page and climate row would eventually
 * disagree. Moved verbatim; no behaviour changed.
 */
import type {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

export interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: number;
}

export const SCOPE3_CATEGORY_DEFINITIONS = [
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

export function transformFootprintToScope3Categories(
  footprintData: any
): {
  categories: Scope3CategoryData[];
  productDetails: ProductEmissionDetail[];
  travelDetails: BusinessTravelDetail[];
  logisticsDetails: LogisticsDetail[];
  wasteDetails: WasteDetail[];
  totalScope3: number;
} {
  if (!footprintData?.breakdown?.scope3) {
    return {
      categories: [],
      productDetails: [],
      travelDetails: [],
      logisticsDetails: [],
      wasteDetails: [],
      totalScope3: 0,
    };
  }

  const scope3Data = footprintData.breakdown.scope3;

  // Map all available scope 3 category data from corporate emissions calculator
  // Categories not populated remain as 0 with 'missing' quality
  // GHG Protocol Category Mapping:
  // - Cat 1: Purchased goods & services (includes products, purchased_services, marketing_materials)
  // - Cat 8: Upstream leased assets (only for actual leased asset emissions, NOT purchased services)
  const cat1Value = (scope3Data.products || 0) + (scope3Data.purchased_services || 0) + (scope3Data.marketing_materials || scope3Data.marketing || 0) + (scope3Data.hospitality || 0);
  const cat1HasData = cat1Value > 0;

  const categoryMapping: Record<number, { value: number; dataQuality: 'primary' | 'secondary' | 'estimated' | 'missing' }> = {
    // Cat 1: Purchased Goods & Services (products + purchased services + marketing materials)
    1: { value: cat1Value, dataQuality: cat1HasData ? 'primary' : 'missing' },
    // Cat 2: Capital Goods
    2: { value: scope3Data.capital_goods || 0, dataQuality: scope3Data.capital_goods > 0 ? 'secondary' : 'missing' },
    // Cat 3: Fuel & Energy Related (WTT) - estimated as ~15% of fuel-related emissions
    3: { value: 0, dataQuality: 'missing' },
    // Cat 4: Upstream Transportation (from product LCA transport impacts)
    4: { value: scope3Data.upstream_transport || 0, dataQuality: scope3Data.upstream_transport > 0 ? 'secondary' : 'missing' },
    // Cat 5: Waste Generated in Operations
    5: { value: scope3Data.waste || scope3Data.operational_waste || 0, dataQuality: (scope3Data.waste || scope3Data.operational_waste) > 0 ? 'secondary' : 'missing' },
    // Cat 6: Business Travel
    6: { value: scope3Data.business_travel || 0, dataQuality: scope3Data.business_travel > 0 ? 'primary' : 'missing' },
    // Cat 7: Employee Commuting
    7: { value: scope3Data.employee_commuting || 0, dataQuality: scope3Data.employee_commuting > 0 ? 'secondary' : 'missing' },
    // Cat 8: Upstream Leased Assets - only for actual leased asset emissions (NOT purchased services)
    8: { value: 0, dataQuality: 'missing' },
    // Cat 9: Downstream Transportation (logistics spend + downstream transport)
    9: { value: (scope3Data.logistics || scope3Data.downstream_logistics || 0) + (scope3Data.downstream_transport || 0), dataQuality: (scope3Data.logistics || scope3Data.downstream_logistics || scope3Data.downstream_transport) > 0 ? 'secondary' : 'missing' },
    // Cat 10: Processing of Sold Products - typically not applicable for finished goods
    10: { value: 0, dataQuality: 'missing' },
    // Cat 11: Use of Sold Products (from product LCA use phase)
    11: { value: scope3Data.use_phase || 0, dataQuality: scope3Data.use_phase > 0 ? 'secondary' : 'missing' },
    // Cat 12: End-of-Life Treatment (would need separate calculation from product LCA)
    12: { value: 0, dataQuality: 'missing' },
    // Cat 13-15: Downstream Leased Assets, Franchises, Investments - typically not applicable
    13: { value: 0, dataQuality: 'missing' },
    14: { value: 0, dataQuality: 'missing' },
    15: { value: 0, dataQuality: 'missing' },
  };

  // Generate detailed entries for each category from the breakdown data
  const generateEntriesForCategory = (categoryNum: number): Array<{
    id: string;
    date: string;
    description: string;
    emissions: number;
    unit: string;
    source: string;
    dataQuality: 'primary' | 'secondary' | 'estimated';
    metadata?: Record<string, any>;
  }> => {
    const entries: Array<{
      id: string;
      date: string;
      description: string;
      emissions: number;
      unit: string;
      source: string;
      dataQuality: 'primary' | 'secondary' | 'estimated';
      metadata?: Record<string, any>;
    }> = [];
    const today = new Date().toISOString().split('T')[0];

    switch (categoryNum) {
      case 1: // Purchased Goods & Services
        if (scope3Data.products > 0) {
          entries.push({
            id: 'cat1-products',
            date: today,
            description: 'Product LCA Scope 3 Emissions',
            emissions: scope3Data.products,
            unit: 'kg CO₂e',
            source: 'Product Carbon Footprint Assessments',
            dataQuality: 'primary',
            metadata: { type: 'product_lca' },
          });
        }
        if (scope3Data.purchased_services > 0) {
          entries.push({
            id: 'cat1-services',
            date: today,
            description: 'Purchased Services',
            emissions: scope3Data.purchased_services,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
            metadata: { type: 'purchased_services' },
          });
        }
        if ((scope3Data.marketing_materials || scope3Data.marketing) > 0) {
          entries.push({
            id: 'cat1-marketing',
            date: today,
            description: 'Marketing Materials',
            emissions: scope3Data.marketing_materials || scope3Data.marketing,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
            metadata: { type: 'marketing_materials' },
          });
        }
        if (scope3Data.hospitality > 0) {
          entries.push({
            id: 'cat1-hospitality',
            date: today,
            description: 'Hospitality service (meals, drinks, rooms, waste)',
            emissions: scope3Data.hospitality,
            unit: 'kg CO₂e',
            source: 'Hospitality module',
            dataQuality: 'primary',
            metadata: { type: 'hospitality' },
          });
        }
        break;
      case 2: // Capital Goods
        if (scope3Data.capital_goods > 0) {
          entries.push({
            id: 'cat2-capital',
            date: today,
            description: 'Capital Goods Purchases',
            emissions: scope3Data.capital_goods,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 4: // Upstream Transportation
        if (scope3Data.upstream_transport > 0) {
          entries.push({
            id: 'cat4-upstream',
            date: today,
            description: 'Upstream Transportation',
            emissions: scope3Data.upstream_transport,
            unit: 'kg CO₂e',
            source: 'Product LCA Transport Impacts',
            dataQuality: 'secondary',
          });
        }
        break;
      case 5: // Waste
        if ((scope3Data.waste || scope3Data.operational_waste) > 0) {
          entries.push({
            id: 'cat5-waste',
            date: today,
            description: 'Operational Waste',
            emissions: scope3Data.waste || scope3Data.operational_waste,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 6: // Business Travel
        if (scope3Data.business_travel > 0) {
          entries.push({
            id: 'cat6-travel',
            date: today,
            description: 'Business Travel',
            emissions: scope3Data.business_travel,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads / Fleet Activities',
            dataQuality: 'primary',
          });
        }
        break;
      case 7: // Employee Commuting
        if (scope3Data.employee_commuting > 0) {
          entries.push({
            id: 'cat7-commuting',
            date: today,
            description: 'Employee Commuting',
            emissions: scope3Data.employee_commuting,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 9: // Downstream Transportation
        const cat9Total = (scope3Data.logistics || scope3Data.downstream_logistics || 0) + (scope3Data.downstream_transport || 0);
        if (cat9Total > 0) {
          if ((scope3Data.logistics || scope3Data.downstream_logistics) > 0) {
            entries.push({
              id: 'cat9-logistics',
              date: today,
              description: 'Downstream Logistics',
              emissions: scope3Data.logistics || scope3Data.downstream_logistics,
              unit: 'kg CO₂e',
              source: 'Corporate Overheads',
              dataQuality: 'secondary',
            });
          }
          if (scope3Data.downstream_transport > 0) {
            entries.push({
              id: 'cat9-transport',
              date: today,
              description: 'Downstream Transportation (Product LCA)',
              emissions: scope3Data.downstream_transport,
              unit: 'kg CO₂e',
              source: 'Product LCA Distribution Impacts',
              dataQuality: 'secondary',
            });
          }
        }
        break;
      case 11: // Use of Sold Products
        if (scope3Data.use_phase > 0) {
          entries.push({
            id: 'cat11-use',
            date: today,
            description: 'Use Phase Emissions',
            emissions: scope3Data.use_phase,
            unit: 'kg CO₂e',
            source: 'Product LCA Use Phase Impacts',
            dataQuality: 'secondary',
          });
        }
        break;
    }
    return entries;
  };

  const categories: Scope3CategoryData[] = SCOPE3_CATEGORY_DEFINITIONS.map(def => {
    const mapping = categoryMapping[def.category];
    const entries = generateEntriesForCategory(def.category);
    return {
      category: def.category,
      name: def.name,
      description: def.description,
      totalEmissions: mapping.value,
      entryCount: entries.length,
      dataQuality: mapping.dataQuality,
      entries,
    };
  });

  return {
    categories,
    productDetails: [],
    travelDetails: [],
    logisticsDetails: [],
    wasteDetails: [],
    totalScope3: scope3Data.total || 0,
  };
}
