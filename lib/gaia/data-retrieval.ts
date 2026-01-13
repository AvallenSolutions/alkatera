// Gaia Data Retrieval Layer
// Fetches organization data to provide context for AI responses

import { createClient } from '@supabase/supabase-js';
import type { GaiaOrganizationContext, GaiaDataSource } from '@/lib/types/gaia';

// Type for Supabase client passed from edge function
type SupabaseClient = ReturnType<typeof createClient>;

export interface DataRetrievalResult {
  context: GaiaOrganizationContext;
  dataSources: GaiaDataSource[];
  rawData: Record<string, unknown>;
}

/**
 * Fetch comprehensive organization context for Gaia
 */
export async function fetchOrganizationContext(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataRetrievalResult> {
  const dataSources: GaiaDataSource[] = [];
  const rawData: Record<string, unknown> = {};

  // Fetch organization basic info
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id, name, industry')
    .eq('id', organizationId)
    .single();

  const org = orgData as { id: string; name: string; industry?: string } | null;

  if (!org) {
    throw new Error('Organization not found');
  }

  const context: GaiaOrganizationContext = {
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
    },
  };

  // Fetch emissions summary
  const emissionsResult = await fetchEmissionsSummary(supabase, organizationId);
  if (emissionsResult) {
    context.emissions_summary = emissionsResult.summary;
    dataSources.push(...emissionsResult.sources);
    rawData.emissions = emissionsResult.data;
  }

  // Fetch facilities summary
  const facilitiesResult = await fetchFacilitiesSummary(supabase, organizationId);
  if (facilitiesResult) {
    context.facilities_summary = facilitiesResult.summary;
    dataSources.push(...facilitiesResult.sources);
    rawData.facilities = facilitiesResult.data;
  }

  // Fetch products summary
  const productsResult = await fetchProductsSummary(supabase, organizationId);
  if (productsResult) {
    context.products_summary = productsResult.summary;
    dataSources.push(...productsResult.sources);
    rawData.products = productsResult.data;
  }

  // Fetch fleet summary
  const fleetResult = await fetchFleetSummary(supabase, organizationId);
  if (fleetResult) {
    context.fleet_summary = fleetResult.summary;
    dataSources.push(...fleetResult.sources);
    rawData.fleet = fleetResult.data;
  }

  // Fetch vitality scores
  const vitalityResult = await fetchVitalityScores(supabase, organizationId);
  if (vitalityResult) {
    context.vitality_scores = vitalityResult.summary;
    dataSources.push(...vitalityResult.sources);
    rawData.vitality = vitalityResult.data;
  }

  return { context, dataSources, rawData };
}

/**
 * Fetch emissions data summary
 */
async function fetchEmissionsSummary(supabase: SupabaseClient, organizationId: string) {
  // Fetch fleet activities for Scope 1
  const { data: fleetData, count: fleetCount } = await supabase
    .from('fleet_activities')
    .select('total_emissions_kg', { count: 'exact' })
    .eq('organization_id', organizationId);
  const fleetActivities = fleetData as { total_emissions_kg: number | null }[] | null;

  // Fetch facility activities for Scope 1 & 2
  const { data: facilityData, count: facilityCount } = await supabase
    .from('facility_activity_entries')
    .select('emissions_kg_co2e, scope')
    .eq('organization_id', organizationId);
  const facilityActivities = facilityData as { emissions_kg_co2e: number | null; scope: number | null }[] | null;

  // Fetch corporate overheads for Scope 3
  const { data: overheadData, count: overheadCount } = await supabase
    .from('corporate_overheads')
    .select('total_emissions_kg')
    .eq('organization_id', organizationId);
  const overheads = overheadData as { total_emissions_kg: number | null }[] | null;

  // Calculate totals
  let scope1Total = 0;
  let scope2Total = 0;
  let scope3Total = 0;

  // Fleet activities are typically Scope 1
  if (fleetActivities) {
    scope1Total += fleetActivities.reduce((sum, a) => sum + (a.total_emissions_kg || 0), 0);
  }

  // Facility activities by scope
  if (facilityActivities) {
    facilityActivities.forEach((a) => {
      const emissions = a.emissions_kg_co2e || 0;
      if (a.scope === 1) scope1Total += emissions;
      else if (a.scope === 2) scope2Total += emissions;
      else if (a.scope === 3) scope3Total += emissions;
    });
  }

  // Corporate overheads are typically Scope 3
  if (overheads) {
    scope3Total += overheads.reduce((sum, o) => sum + (o.total_emissions_kg || 0), 0);
  }

  // Convert to tonnes
  const summary = {
    scope1_total: scope1Total / 1000,
    scope2_total: scope2Total / 1000,
    scope3_total: scope3Total / 1000,
    reporting_year: new Date().getFullYear(),
  };

  const sources: GaiaDataSource[] = [];
  if (fleetCount && fleetCount > 0) {
    sources.push({ table: 'fleet_activities', description: 'Fleet activity records', recordCount: fleetCount });
  }
  if (facilityCount && facilityCount > 0) {
    sources.push({ table: 'facility_activity_entries', description: 'Facility activity data', recordCount: facilityCount });
  }
  if (overheadCount && overheadCount > 0) {
    sources.push({ table: 'corporate_overheads', description: 'Corporate overhead costs', recordCount: overheadCount });
  }

  return {
    summary,
    sources,
    data: { fleetActivities, facilityActivities, overheads },
  };
}

/**
 * Fetch facilities summary
 */
async function fetchFacilitiesSummary(supabase: SupabaseClient, organizationId: string) {
  const { data: facilitiesData, count } = await supabase
    .from('facilities')
    .select('id, name, type', { count: 'exact' })
    .eq('organization_id', organizationId);

  const facilities = facilitiesData as { id: string; name: string; type: string | null }[] | null;

  if (!facilities || facilities.length === 0) {
    return null;
  }

  // Fetch water data
  const { data: waterResult } = await supabase
    .from('facility_water_data')
    .select('consumption_m3, facility_id')
    .in('facility_id', facilities.map((f) => f.id));

  const waterData = waterResult as { consumption_m3: number | null; facility_id: string }[] | null;

  const totalWater = waterData?.reduce((sum, w) => sum + (w.consumption_m3 || 0), 0) || 0;

  const summary = {
    count: count || 0,
    total_water_consumption: totalWater,
  };

  const sources: GaiaDataSource[] = [
    { table: 'facilities', description: 'Organization facilities', recordCount: count || 0 },
  ];

  if (waterData && waterData.length > 0) {
    sources.push({ table: 'facility_water_data', description: 'Facility water consumption', recordCount: waterData.length });
  }

  return {
    summary,
    sources,
    data: { facilities, waterData },
  };
}

/**
 * Fetch products summary
 */
async function fetchProductsSummary(supabase: SupabaseClient, organizationId: string) {
  const { data: productsData, count } = await supabase
    .from('products')
    .select('id, name, sku, has_lca', { count: 'exact' })
    .eq('organization_id', organizationId);

  const products = productsData as { id: string; name: string; sku: string | null; has_lca: boolean }[] | null;

  if (!products || products.length === 0) {
    return null;
  }

  const withLcaCount = products.filter((p) => p.has_lca).length;

  // Fetch LCA data for products with LCAs
  const productsWithLca = products.filter((p) => p.has_lca).map((p) => p.id);
  let lcaData = null;

  if (productsWithLca.length > 0) {
    const { data } = await supabase
      .from('product_lcas')
      .select('product_id, total_gwp_kg_co2e, functional_unit')
      .in('product_id', productsWithLca);
    lcaData = data;
  }

  const summary = {
    total_count: count || 0,
    with_lca_count: withLcaCount,
  };

  const sources: GaiaDataSource[] = [
    { table: 'products', description: 'Product catalog', recordCount: count || 0 },
  ];

  if (lcaData && lcaData.length > 0) {
    sources.push({ table: 'product_lcas', description: 'Product LCA calculations', recordCount: lcaData.length });
  }

  return {
    summary,
    sources,
    data: { products, lcaData },
  };
}

/**
 * Fetch fleet summary
 */
async function fetchFleetSummary(supabase: SupabaseClient, organizationId: string) {
  const { data: vehiclesData, count: vehicleCount } = await supabase
    .from('fleet_vehicles')
    .select('id, registration, vehicle_type', { count: 'exact' })
    .eq('organization_id', organizationId);

  const vehicles = vehiclesData as { id: string; registration: string; vehicle_type: string | null }[] | null;

  const { data: activitiesData, count: activityCount } = await supabase
    .from('fleet_activities')
    .select('distance_km, total_emissions_kg')
    .eq('organization_id', organizationId);

  const activities = activitiesData as { distance_km: number | null; total_emissions_kg: number | null }[] | null;

  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  const totalDistance = activities?.reduce((sum, a) => sum + (a.distance_km || 0), 0) || 0;
  const totalEmissions = activities?.reduce((sum, a) => sum + (a.total_emissions_kg || 0), 0) || 0;

  const summary = {
    vehicle_count: vehicleCount || 0,
    total_distance_km: totalDistance,
    total_emissions: totalEmissions / 1000, // Convert to tonnes
  };

  const sources: GaiaDataSource[] = [
    { table: 'fleet_vehicles', description: 'Fleet vehicle records', recordCount: vehicleCount || 0 },
  ];

  if (activityCount && activityCount > 0) {
    sources.push({ table: 'fleet_activities', description: 'Fleet activity logs', recordCount: activityCount });
  }

  return {
    summary,
    sources,
    data: { vehicles, activities },
  };
}

/**
 * Fetch vitality scores
 */
async function fetchVitalityScores(supabase: SupabaseClient, organizationId: string) {
  const { data: scoresData } = await supabase
    .from('organization_vitality_scores')
    .select('*')
    .eq('organization_id', organizationId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  const scores = scoresData as {
    overall_score: number | null;
    climate_score: number | null;
    water_score: number | null;
    circularity_score: number | null;
    nature_score: number | null;
  } | null;

  if (!scores) {
    return null;
  }

  const summary = {
    overall_score: scores.overall_score,
    climate_score: scores.climate_score,
    water_score: scores.water_score,
    circularity_score: scores.circularity_score,
    nature_score: scores.nature_score,
  };

  const sources: GaiaDataSource[] = [
    { table: 'organization_vitality_scores', description: 'Vitality performance scores', recordCount: 1 },
  ];

  return {
    summary,
    sources,
    data: scores,
  };
}

/**
 * Format context for Gemini prompt
 */
export function formatContextForPrompt(result: DataRetrievalResult): string {
  const { context } = result;
  const lines: string[] = [];

  lines.push(`Organization: ${context.organization.name}`);
  if (context.organization.industry) {
    lines.push(`Industry: ${context.organization.industry}`);
  }
  lines.push('');

  if (context.emissions_summary) {
    const e = context.emissions_summary;
    lines.push('### Emissions Summary');
    lines.push(`- Scope 1 (Direct): ${e.scope1_total?.toFixed(2) || 'No data'} tCO2e`);
    lines.push(`- Scope 2 (Indirect - Energy): ${e.scope2_total?.toFixed(2) || 'No data'} tCO2e`);
    lines.push(`- Scope 3 (Value Chain): ${e.scope3_total?.toFixed(2) || 'No data'} tCO2e`);
    lines.push(`- Total: ${((e.scope1_total || 0) + (e.scope2_total || 0) + (e.scope3_total || 0)).toFixed(2)} tCO2e`);
    lines.push('');
  }

  if (context.facilities_summary) {
    const f = context.facilities_summary;
    lines.push('### Facilities Summary');
    lines.push(`- Number of Facilities: ${f.count}`);
    if (f.total_water_consumption) {
      lines.push(`- Total Water Consumption: ${f.total_water_consumption.toLocaleString()} m³`);
    }
    lines.push('');
  }

  if (context.products_summary) {
    const p = context.products_summary;
    lines.push('### Products Summary');
    lines.push(`- Total Products: ${p.total_count}`);
    lines.push(`- Products with LCA: ${p.with_lca_count} (${Math.round((p.with_lca_count / p.total_count) * 100)}%)`);
    lines.push('');
  }

  if (context.fleet_summary) {
    const f = context.fleet_summary;
    lines.push('### Fleet Summary');
    lines.push(`- Number of Vehicles: ${f.vehicle_count}`);
    if (f.total_distance_km) {
      lines.push(`- Total Distance: ${f.total_distance_km.toLocaleString()} km`);
    }
    if (f.total_emissions) {
      lines.push(`- Total Fleet Emissions: ${f.total_emissions.toFixed(2)} tCO2e`);
    }
    lines.push('');
  }

  if (context.vitality_scores) {
    const v = context.vitality_scores;
    lines.push('### Vitality Scores');
    if (v.overall_score !== undefined) lines.push(`- Overall Score: ${v.overall_score}/100`);
    if (v.climate_score !== undefined) lines.push(`- Climate Score: ${v.climate_score}/100`);
    if (v.water_score !== undefined) lines.push(`- Water Score: ${v.water_score}/100`);
    if (v.circularity_score !== undefined) lines.push(`- Circularity Score: ${v.circularity_score}/100`);
    if (v.nature_score !== undefined) lines.push(`- Nature Score: ${v.nature_score}/100`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Fetch detailed data based on query intent
 * This function can be expanded to fetch more specific data based on detected intent
 */
export async function fetchDetailedData(
  supabase: SupabaseClient,
  organizationId: string,
  intent: string
): Promise<{ data: unknown; sources: GaiaDataSource[] }> {
  const sources: GaiaDataSource[] = [];
  let data: unknown = null;

  // Intent-based data fetching
  if (intent.includes('product') || intent.includes('lca')) {
    const { data: products, count } = await supabase
      .from('products')
      .select(`
        id, name, sku, description, has_lca,
        product_lcas (
          total_gwp_kg_co2e,
          functional_unit,
          life_cycle_stage_breakdown
        )
      `)
      .eq('organization_id', organizationId);

    data = products;
    if (count) {
      sources.push({ table: 'products', description: 'Product catalog with LCA data', recordCount: count });
    }
  }

  if (intent.includes('facility') || intent.includes('water') || intent.includes('energy')) {
    const { data: facilities, count } = await supabase
      .from('facilities')
      .select(`
        id, name, type, address, country,
        facility_water_data (
          consumption_m3,
          period_start,
          period_end
        ),
        facility_activity_entries (
          activity_type,
          quantity,
          unit,
          emissions_kg_co2e
        )
      `)
      .eq('organization_id', organizationId);

    data = facilities;
    if (count) {
      sources.push({ table: 'facilities', description: 'Facility data with water and activity records', recordCount: count });
    }
  }

  if (intent.includes('fleet') || intent.includes('vehicle') || intent.includes('travel')) {
    const { data: fleetData, count } = await supabase
      .from('fleet_activities')
      .select(`
        id,
        activity_date,
        distance_km,
        fuel_used_litres,
        total_emissions_kg,
        fleet_vehicles (
          registration,
          vehicle_type,
          fuel_type
        )
      `)
      .eq('organization_id', organizationId)
      .order('activity_date', { ascending: false })
      .limit(100);

    data = fleetData;
    if (count) {
      sources.push({ table: 'fleet_activities', description: 'Fleet activity records', recordCount: count });
    }
  }

  if (intent.includes('supplier') || intent.includes('scope 3') || intent.includes('value chain')) {
    const { data: suppliers, count } = await supabase
      .from('suppliers')
      .select(`
        id, name, category, engagement_status, data_quality_score,
        supplier_engagements (
          engagement_date,
          response_status,
          emissions_data_provided
        )
      `)
      .eq('organization_id', organizationId);

    data = suppliers;
    if (count) {
      sources.push({ table: 'suppliers', description: 'Supplier engagement data', recordCount: count });
    }
  }

  return { data, sources };
}
