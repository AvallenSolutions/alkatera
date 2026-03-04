import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateCorporateEmissions,
} from '@/lib/calculations/corporate-emissions';
import type {
  ImpactValuationInputs,
  NaturalCapitalInputs,
  HumanCapitalInputs,
  SocialCapitalInputs,
  GovernanceCapitalInputs,
  ProxyValues,
} from '@/lib/calculations/impact-valuation';

/**
 * Reads all required raw data from Supabase and assembles it into
 * ImpactValuationInputs for the calculation engine.
 *
 * Called only from the API route — never from client code.
 * If a query returns no rows or errors, the corresponding input is null.
 */
export async function assembleImpactValuationInputs(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<ImpactValuationInputs> {
  // Run all independent queries in parallel
  const [
    naturalInputs,
    humanInputs,
    socialInputs,
    governanceInputs,
    proxies,
  ] = await Promise.all([
    assembleNaturalCapital(supabase, organizationId, reportingYear),
    assembleHumanCapital(supabase, organizationId, reportingYear),
    assembleSocialCapital(supabase, organizationId, reportingYear),
    assembleGovernanceCapital(supabase, organizationId),
    assembleProxyValues(supabase),
  ]);

  return {
    natural: naturalInputs,
    human: humanInputs,
    social: socialInputs,
    governance: governanceInputs,
    proxies,
    reporting_year: reportingYear,
  };
}

// ─── Natural Capital ─────────────────────────────────────────────────────────

async function assembleNaturalCapital(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<NaturalCapitalInputs> {
  // Run sub-queries in parallel
  const [emissions, water, landUse, waste] = await Promise.all([
    getEmissionsTco2e(supabase, organizationId, reportingYear),
    getWaterConsumptionM3(supabase, organizationId, reportingYear),
    getLandUseHa(supabase, organizationId, reportingYear),
    getWasteToLandfillTonnes(supabase, organizationId, reportingYear),
  ]);

  return {
    total_emissions_tco2e: emissions,
    water_consumption_m3: water,
    land_use_ha: landUse,
    waste_to_landfill_tonnes: waste,
  };
}

async function getEmissionsTco2e(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const result = await calculateCorporateEmissions(supabase, organizationId, reportingYear);
    if (!result.hasData || result.breakdown.total === 0) {
      return null;
    }
    // Corporate emissions are in kg CO2e → convert to tonnes
    return result.breakdown.total / 1000;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get emissions:', err);
    return null;
  }
}

async function getWaterConsumptionM3(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    // Strategy: Try facility_water_data first (structured reporting with AWARE
    // scarcity weighting pre-calculated). If empty, fall back to
    // facility_activity_entries (transactional records) with manual AWARE lookup.
    // Both capture real operational water — not LCA-derived.

    // ── Primary: facility_water_data (has scarcity_weighted_consumption_m3) ──
    const { data: fwdData, error: fwdError } = await supabase
      .from('facility_water_data')
      .select('scarcity_weighted_consumption_m3')
      .eq('organization_id', organizationId)
      .eq('reporting_year', reportingYear);

    if (!fwdError && fwdData && fwdData.length > 0) {
      const total = fwdData.reduce(
        (sum, row) => sum + (Number(row.scarcity_weighted_consumption_m3) || 0),
        0
      );
      if (total > 0) return total;
    }

    // ── Fallback: facility_activity_entries + AWARE lookup ───────────────────
    const yearStart = `${reportingYear}-01-01`;
    const yearEnd = `${reportingYear}-12-31`;

    const { data: entries, error: entryError } = await supabase
      .from('facility_activity_entries')
      .select('facility_id, quantity')
      .eq('organization_id', organizationId)
      .eq('activity_category', 'water_intake')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_start', yearEnd);

    if (entryError) {
      console.warn('[impact-valuation] Failed to get water data:', entryError.message);
      return null;
    }

    if (!entries || entries.length === 0) {
      return null;
    }

    // Group water intake by facility
    const volumeByFacility = new Map<string, number>();
    for (const entry of entries) {
      const fid = String(entry.facility_id);
      const current = volumeByFacility.get(fid) || 0;
      volumeByFacility.set(fid, current + (Number(entry.quantity) || 0));
    }

    // Look up AWARE factors for each facility's country
    const facilityIds = Array.from(volumeByFacility.keys());
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id, location_country_code, address_country')
      .in('id', facilityIds);

    const countryCodes = new Set<string>();
    const facilityCountry = new Map<string, string>();
    if (facilities) {
      for (const f of facilities) {
        const cc = f.location_country_code || f.address_country || '';
        if (cc) {
          facilityCountry.set(f.id, cc);
          countryCodes.add(cc);
        }
      }
    }

    // Fetch AWARE factors by country code
    const awareByCountry = new Map<string, number>();
    if (countryCodes.size > 0) {
      const { data: awareRows } = await supabase
        .from('aware_factors')
        .select('country_code, aware_factor')
        .in('country_code', Array.from(countryCodes));

      if (awareRows) {
        for (const row of awareRows) {
          awareByCountry.set(row.country_code, Number(row.aware_factor) || 1);
        }
      }
    }

    // Sum: volume × AWARE factor per facility (m³ world-equivalent)
    let total = 0;
    for (const [facilityId, volume] of Array.from(volumeByFacility.entries())) {
      const cc = facilityCountry.get(facilityId) || '';
      const aware = awareByCountry.get(cc) ?? 1; // Default AWARE = 1 (world average)
      total += volume * aware;
    }

    return total > 0 ? total : null;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get water data:', err);
    return null;
  }
}

async function getWasteToLandfillTonnes(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const yearStart = `${reportingYear}-01-01`;
    const yearEnd = `${reportingYear}-12-31`;

    // First check whether the org has ANY waste data for this year.
    // If they do but none goes to landfill, we return 0 (not null) so the
    // UI shows "£0" instead of the misleading "No data" label.
    const { count: wasteCount, error: anyError } = await supabase
      .from('facility_activity_entries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('activity_category', ['waste_general', 'waste_hazardous'])
      .gte('activity_date', yearStart)
      .lte('activity_date', yearEnd);

    if (anyError) {
      console.warn('[impact-valuation] Failed to check waste data:', anyError.message);
      return null;
    }

    // No waste data at all → genuinely "no data"
    if (!wasteCount || wasteCount === 0) {
      return null;
    }

    // Now query specifically for landfill waste
    const { data, error } = await supabase
      .from('facility_activity_entries')
      .select('quantity')
      .eq('organization_id', organizationId)
      .in('activity_category', ['waste_general', 'waste_hazardous'])
      .eq('waste_treatment_method', 'landfill')
      .gte('activity_date', yearStart)
      .lte('activity_date', yearEnd);

    if (error) {
      console.warn('[impact-valuation] Failed to get waste data:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      // Org has waste data but nothing goes to landfill → return 0
      return 0;
    }

    // Waste quantities stored in kg → convert to tonnes
    const totalKg = data.reduce((sum, row) => sum + (row.quantity || 0), 0);
    return totalKg / 1000;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get waste data:', err);
    return null;
  }
}

async function getLandUseHa(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const yearStart = `${reportingYear}-01-01`;
    const yearEnd = `${reportingYear}-12-31`;

    // Use raw material-level impact_land from product_carbon_footprint_materials.
    // This reads every ingredient & packaging material entered (not the processed
    // aggregated_impacts LCA output) and scales by production volume.
    // impact_land on each material row = ecoinvent proxy × quantity (m²a crop eq
    // for that material entry, pre-calculated by resolve_hybrid_impacts()).

    // Step 1: Get all PCFs for this org (need IDs + product_id for volume lookup)
    const { data: pcfs, error: pcfError } = await supabase
      .from('product_carbon_footprints')
      .select('id, product_id, updated_at')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (pcfError) {
      console.warn('[impact-valuation] Failed to get PCF data:', pcfError.message);
      return null;
    }

    if (!pcfs || pcfs.length === 0) {
      return null;
    }

    // Deduplicate to latest PCF per product_id
    const latestByProduct = new Map<string, (typeof pcfs)[0]>();
    for (const pcf of pcfs) {
      const key = String(pcf.product_id);
      const existing = latestByProduct.get(key);
      if (!existing || new Date(pcf.updated_at) > new Date(existing.updated_at)) {
        latestByProduct.set(key, pcf);
      }
    }

    // Step 2: Get production logs for the year
    const { data: productionData } = await supabase
      .from('production_logs')
      .select('product_id, units_produced')
      .eq('organization_id', organizationId)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    const productionMap = new Map<string, number>();
    if (productionData) {
      for (const prod of productionData) {
        const units = Number(prod.units_produced || 0);
        if (units <= 0) continue;
        const key = String(prod.product_id);
        const current = productionMap.get(key) || 0;
        productionMap.set(key, current + units);
      }
    }

    // Include products that had production this year or PCFs updated this year
    const relevantProductIds = new Set<string>(Array.from(productionMap.keys()));
    for (const pcf of pcfs) {
      if (new Date(pcf.updated_at).getFullYear() === reportingYear) {
        relevantProductIds.add(String(pcf.product_id));
      }
    }

    const relevantPcfs = Array.from(relevantProductIds)
      .map(pid => latestByProduct.get(pid))
      .filter((pcf): pcf is NonNullable<typeof pcf> => !!pcf);

    if (relevantPcfs.length === 0) {
      return null;
    }

    // Step 3: Get raw material-level impact_land for all relevant PCFs
    const pcfIds = relevantPcfs.map(p => p.id);
    const { data: materials, error: matError } = await supabase
      .from('product_carbon_footprint_materials')
      .select('product_carbon_footprint_id, impact_land')
      .in('product_carbon_footprint_id', pcfIds)
      .not('impact_land', 'is', null);

    if (matError) {
      console.warn('[impact-valuation] Failed to get material land data:', matError.message);
      return null;
    }

    // Sum impact_land per PCF (gives land use per product unit in m²a)
    const landPerPcf = new Map<string, number>();
    if (materials) {
      for (const mat of materials) {
        const key = String(mat.product_carbon_footprint_id);
        const current = landPerPcf.get(key) || 0;
        landPerPcf.set(key, current + (Number(mat.impact_land) || 0));
      }
    }

    // Step 4: For PCFs without production logs, fetch fallback volumes in batch
    const pcfsNeedingFallback = relevantPcfs.filter(
      pcf => !(productionMap.get(String(pcf.product_id)) || 0)
    );

    const prodSitesMap = new Map<string, number>();
    const cmAllocsMap = new Map<string, number>();

    if (pcfsNeedingFallback.length > 0) {
      const fallbackPcfIds = pcfsNeedingFallback.map(p => p.id).filter(Boolean);
      const fallbackProductIds = pcfsNeedingFallback.map(p => p.product_id).filter(Boolean);

      const [prodSitesResult, cmAllocsResult] = await Promise.allSettled([
        fallbackPcfIds.length > 0
          ? supabase
              .from('product_carbon_footprint_production_sites')
              .select('product_carbon_footprint_id, production_volume')
              .in('product_carbon_footprint_id', fallbackPcfIds)
          : Promise.resolve({ data: [] as Array<{ product_carbon_footprint_id: string; production_volume: number }>, error: null }),
        fallbackProductIds.length > 0
          ? supabase
              .from('contract_manufacturer_allocations')
              .select('product_id, client_production_volume')
              .in('product_id', fallbackProductIds)
              .eq('organization_id', organizationId)
          : Promise.resolve({ data: [] as Array<{ product_id: string; client_production_volume: number }>, error: null }),
      ]);

      if (prodSitesResult.status === 'fulfilled') {
        const siteData = (prodSitesResult.value as { data: Array<{ product_carbon_footprint_id: string; production_volume: number }> | null }).data;
        if (siteData) {
          for (const site of siteData) {
            const key = String(site.product_carbon_footprint_id);
            const vol = Number(site.production_volume || 0);
            const current = prodSitesMap.get(key) || 0;
            if (vol > current) prodSitesMap.set(key, vol);
          }
        }
      }

      if (cmAllocsResult.status === 'fulfilled') {
        const allocData = (cmAllocsResult.value as { data: Array<{ product_id: string; client_production_volume: number }> | null }).data;
        if (allocData) {
          for (const alloc of allocData) {
            const key = String(alloc.product_id);
            const vol = Number(alloc.client_production_volume || 0);
            const current = cmAllocsMap.get(key) || 0;
            if (vol > current) cmAllocsMap.set(key, vol);
          }
        }
      }
    }

    // Step 5: Calculate total land use across all products
    let totalM2a = 0;
    let hasAnyLandData = false;

    for (const pcf of relevantPcfs) {
      const landPerUnit = landPerPcf.get(pcf.id) || 0;
      if (landPerUnit <= 0) continue;

      // Production volume priority chain: logs → prod sites → CM allocs → 1
      const productKey = String(pcf.product_id);
      let volume = productionMap.get(productKey) || 0;
      if (volume <= 0) {
        volume = prodSitesMap.get(pcf.id) || 0;
      }
      if (volume <= 0) {
        volume = cmAllocsMap.get(productKey) || 0;
      }
      if (volume <= 0) {
        volume = 1;
      }

      totalM2a += landPerUnit * volume;
      hasAnyLandData = true;
    }

    if (!hasAnyLandData) {
      return 0;
    }

    // Step 6: Convert m²a → hectares (÷ 10,000)
    return totalM2a / 10000;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get land use data:', err);
    return null;
  }
}

// ─── Human Capital ───────────────────────────────────────────────────────────

async function assembleHumanCapital(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<HumanCapitalInputs> {
  try {
    // Query source tables directly (like volunteering/donations) rather than
    // depending on the intermediate people_culture_scores record existing.
    const [trainingResult, demographicsResult, pcScoreResult] = await Promise.all([
      // Training hours — read directly from source records
      supabase
        .from('people_training_records')
        .select('total_hours')
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportingYear),
      // Employee count — latest demographics record
      supabase
        .from('people_workforce_demographics')
        .select('total_employees')
        .eq('organization_id', organizationId)
        .order('reporting_period', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Wellbeing score + living wage gap — still from people_culture_scores
      supabase
        .from('people_culture_scores')
        .select('wellbeing_score, calculation_metadata')
        .eq('organization_id', organizationId)
        .order('calculation_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Training hours — sum all records for the reporting year
    let totalTrainingHours: number | null = null;
    if (!trainingResult.error && trainingResult.data && trainingResult.data.length > 0) {
      const sum = trainingResult.data.reduce(
        (acc, row) => acc + (row.total_hours || 0), 0
      );
      totalTrainingHours = sum > 0 ? sum : null;
    } else if (trainingResult.error) {
      console.warn('[impact-valuation] Failed to get training data:', trainingResult.error.message);
    }

    // Employee count
    let totalEmployees: number | null = null;
    if (!demographicsResult.error && demographicsResult.data?.total_employees) {
      totalEmployees = Number(demographicsResult.data.total_employees);
    } else if (demographicsResult.error) {
      console.warn('[impact-valuation] Failed to get demographics data:', demographicsResult.error.message);
    }

    // Wellbeing score + living wage gap from people_culture_scores (if calculated)
    let wellbeingScore: number | null = null;
    let livingWageGapTotal: number | null = null;
    if (!pcScoreResult.error && pcScoreResult.data) {
      wellbeingScore = pcScoreResult.data.wellbeing_score ?? null;
      const metadata = pcScoreResult.data.calculation_metadata as Record<string, unknown> | null;
      const dataSources = metadata?.data_sources as Record<string, unknown> | null;
      livingWageGapTotal = dataSources?.living_wage_gap_total
        ? Number(dataSources.living_wage_gap_total)
        : null;
    }

    return {
      living_wage_gap_annual_gbp: livingWageGapTotal,
      total_training_hours: totalTrainingHours,
      employee_count: totalEmployees,
      wellbeing_score: wellbeingScore,
    };
  } catch (err) {
    console.warn('[impact-valuation] Failed to get human capital data:', err);
    return {
      living_wage_gap_annual_gbp: null,
      total_training_hours: null,
      employee_count: null,
      wellbeing_score: null,
    };
  }
}

// ─── Social Capital ──────────────────────────────────────────────────────────

async function assembleSocialCapital(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<SocialCapitalInputs> {
  // Run sub-queries in parallel
  const [volunteering, giving, localSpend] = await Promise.all([
    getVolunteeringHours(supabase, organizationId, reportingYear),
    getCharitableGiving(supabase, organizationId, reportingYear),
    getLocalSupplySpend(supabase, organizationId, reportingYear),
  ]);

  return {
    volunteering_hours_total: volunteering,
    charitable_giving_total_gbp: giving,
    local_supply_spend_gbp: localSpend,
  };
}

async function getVolunteeringHours(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('community_volunteer_activities')
      .select('total_volunteer_hours')
      .eq('organization_id', organizationId)
      .gte('activity_date', `${reportingYear}-01-01`)
      .lte('activity_date', `${reportingYear}-12-31`);

    if (error) {
      console.warn('[impact-valuation] Failed to get volunteering data:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const total = data.reduce((sum, row) => sum + (row.total_volunteer_hours || 0), 0);
    return total > 0 ? total : null;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get volunteering data:', err);
    return null;
  }
}

async function getCharitableGiving(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('community_donations')
      .select('donation_amount, donation_type')
      .eq('organization_id', organizationId)
      .eq('reporting_year', reportingYear);

    if (error) {
      console.warn('[impact-valuation] Failed to get donation data:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Sum cash donations
    const total = data
      .filter((d) => d.donation_type === 'cash')
      .reduce((sum, d) => sum + (d.donation_amount || 0), 0);
    return total > 0 ? total : null;
  } catch (err) {
    console.warn('[impact-valuation] Failed to get donation data:', err);
    return null;
  }
}

async function getLocalSupplySpend(
  supabase: SupabaseClient,
  organizationId: string,
  reportingYear: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('community_local_impact')
      .select('local_procurement_spend')
      .eq('organization_id', organizationId)
      .eq('reporting_year', reportingYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[impact-valuation] Failed to get local impact data:', error.message);
      return null;
    }

    if (!data || !data.local_procurement_spend) {
      return null;
    }

    return Number(data.local_procurement_spend);
  } catch (err) {
    console.warn('[impact-valuation] Failed to get local impact data:', err);
    return null;
  }
}

// ─── Governance Capital ──────────────────────────────────────────────────────

async function assembleGovernanceCapital(
  supabase: SupabaseClient,
  organizationId: string
): Promise<GovernanceCapitalInputs> {
  try {
    const { data, error } = await supabase
      .from('governance_scores')
      .select('overall_score')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[impact-valuation] Failed to get governance score:', error.message);
      return { governance_score: null };
    }

    return {
      governance_score: data?.overall_score ?? null,
    };
  } catch (err) {
    console.warn('[impact-valuation] Failed to get governance score:', err);
    return { governance_score: null };
  }
}

// ─── Proxy Values ────────────────────────────────────────────────────────────

async function assembleProxyValues(supabase: SupabaseClient): Promise<ProxyValues> {
  const { data, error } = await supabase
    .from('impact_proxy_values')
    .select('metric_key, proxy_value')
    .eq('is_active', true)
    .eq('version', '1.0');

  if (error || !data || data.length === 0) {
    console.warn('[impact-valuation] Failed to load proxy values, using hardcoded defaults:', error?.message);
    // Hardcoded fallback — should never be needed if migration ran
    return {
      carbon_tonne: 259,
      water_m3: 0.9,
      land_ha: 183,
      waste_tonne: 102,
      living_wage_gap_gbp: 1,
      training_hour: 13,
      wellbeing_score_point: 420,
      volunteering_hour: 28,
      charitable_giving_gbp: 1,
      local_multiplier: 0.63,
      governance_score_point: 1250,
    };
  }

  const proxyMap: Record<string, number> = {};
  for (const row of data) {
    proxyMap[row.metric_key] = Number(row.proxy_value);
  }

  return {
    carbon_tonne: proxyMap.carbon_tonne ?? 259,
    water_m3: proxyMap.water_m3 ?? 0.9,
    land_ha: proxyMap.land_ha ?? 183,
    waste_tonne: proxyMap.waste_tonne ?? 102,
    living_wage_gap_gbp: proxyMap.living_wage_gap_gbp ?? 1,
    training_hour: proxyMap.training_hour ?? 13,
    wellbeing_score_point: proxyMap.wellbeing_score_point ?? 420,
    volunteering_hour: proxyMap.volunteering_hour ?? 28,
    charitable_giving_gbp: proxyMap.charitable_giving_gbp ?? 1,
    local_multiplier: proxyMap.local_multiplier ?? 0.63,
    governance_score_point: proxyMap.governance_score_point ?? 1250,
  };
}
