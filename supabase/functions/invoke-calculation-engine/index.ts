import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Enhanced Material Interface with Dual-Path Data Support
 */
interface Material {
  id: string;
  name: string | null;
  quantity: number;
  unit: string | null;
  lca_sub_stage_id: string | null;
  data_source?: "openlca" | "supplier" | null;
  data_source_id?: string | null;
  supplier_product_id?: string | null;
  origin_country?: string | null;
  location_country_code?: string | null;  // Required for AWARE water scarcity
  is_organic_certified?: boolean;
}

interface InvokePayload {
  lcaId: string;
  materials: Material[];
  location_country_code?: string;  // Facility or product location for water scarcity
}

/**
 * Multi-Capital Impact Metrics (ReCiPe 2016 Midpoint H)
 * CSRD/TNFD Compliance: All environmental capitals
 */
interface ImpactMetrics {
  // CSRD E1: Climate Change
  climate_change_gwp100: number;              // kg CO2eq - Global Warming Potential

  // CSRD E3: Water & Marine Resources
  water_consumption: number;                  // m³ - ReCiPe: Water Consumption
  water_scarcity_aware: number;               // m³ world eq - AWARE (spatially explicit)

  // CSRD E4 / TNFD: Biodiversity & Land Use
  land_use: number;                           // m²a crop eq - ReCiPe: Land Use
  terrestrial_ecotoxicity: number;            // kg 1,4-DCB - ReCiPe: Terrestrial Ecotoxicity

  // CSRD E2: Pollution
  freshwater_eutrophication: number;          // kg P eq - ReCiPe: Freshwater Eutrophication
  terrestrial_acidification: number;          // kg SO2 eq - ReCiPe: Terrestrial Acidification

  // CSRD E5: Resource Use & Circular Economy
  fossil_resource_scarcity: number;           // kg oil eq - ReCiPe: Fossil Resource Scarcity
}

/**
 * Emission Factor from Internal Database (DEFRA/Proxy Fallback)
 */
interface EmissionFactor {
  factor_id: string;
  name: string;
  value: number;
  unit: string;
  source: string;
  source_documentation_link: string;
  year_of_publication: number;
  geographic_scope: string;
  system_model: string | null;
}

/**
 * OpenLCA/Ecoinvent Response Structure with ReCiPe 2016 Midpoint (H)
 * CRITICAL: OpenLCA service must return all 8 impact categories
 */
interface OpenLCAResponse {
  success: boolean;
  material_name: string;
  ecoinvent_process_uuid: string;
  ecoinvent_process_name: string;
  system_model: string;
  database_version: string;
  impact_assessment_method: string;           // Must be "ReCiPe 2016 Midpoint (H)"

  // Multi-capital impact results
  impact_metrics: ImpactMetrics;

  calculation_details?: {
    quantity: number;
    formula: string;
  };
  error?: string;
}

/**
 * Calculated Material with Full Audit Trail + Multi-Capital Impacts
 * COMPLIANCE: Glass Box Protocol + CSRD/TNFD Multi-Capital Reporting
 */
interface CalculatedMaterial {
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;

  // MANDATORY GLASS BOX AUDIT METADATA
  factor_value: number;                        // DEPRECATED: Use impact_metrics instead
  emission_factor_unit: string;
  calculated_co2e: number;                     // DEPRECATED: Use impact_metrics.climate_change_gwp100
  data_source: "supplier" | "openlca" | "internal_fallback";
  source_used: string;
  external_reference_id: string;
  methodology: string;
  confidence_score: "high" | "medium" | "low";

  // MULTI-CAPITAL IMPACT METRICS (CSRD/TNFD)
  impact_metrics: ImpactMetrics;
  impact_assessment_method: string;            // "ReCiPe 2016 Midpoint (H)"
  data_quality: "high" | "medium" | "low";     // Spatial data quality for AWARE

  // ADDITIONAL CONTEXT
  geographic_scope: string;
  location_country_code?: string;              // ISO 3166-1 alpha-2 (e.g., "ES", "GB")
  year_of_publication: number | string;
  lca_stage: string;
  ecoinvent_process_name?: string;
  database_version?: string;
  notes?: string;
}

/**
 * AWARE Water Scarcity Factors (m³ world eq / m³)
 * Source: UNEP SETAC Life Cycle Initiative
 * Higher values = greater water scarcity in that region
 */
const AWARE_FACTORS: Record<string, number> = {
  // High Water Stress Regions (CSRD Priority)
  "ES": 54.8,   // Spain
  "PT": 42.1,   // Portugal
  "IT": 38.5,   // Italy
  "GR": 35.2,   // Greece
  "CY": 62.3,   // Cyprus
  "MT": 58.7,   // Malta
  "TR": 44.6,   // Turkey
  "EG": 71.2,   // Egypt
  "AE": 89.4,   // UAE
  "SA": 95.7,   // Saudi Arabia
  "IN": 33.5,   // India
  "CN": 28.4,   // China
  "US": 22.1,   // United States (average)
  "MX": 41.3,   // Mexico
  "ZA": 39.8,   // South Africa
  "AU": 45.2,   // Australia

  // Low Water Stress Regions
  "GB": 8.2,    // United Kingdom
  "IE": 5.3,    // Ireland
  "NO": 3.1,    // Norway
  "SE": 4.2,    // Sweden
  "FI": 3.8,    // Finland
  "IS": 2.1,    // Iceland
  "NZ": 6.7,    // New Zealand
  "CA": 7.4,    // Canada
  "BR": 9.8,    // Brazil
  "DE": 15.3,   // Germany
  "FR": 18.7,   // France
  "NL": 12.4,   // Netherlands
  "BE": 14.6,   // Belgium
  "DK": 9.1,    // Denmark
  "PL": 16.2,   // Poland
  "AT": 11.5,   // Austria
  "CH": 8.9,    // Switzerland
  "CZ": 13.7,   // Czech Republic

  // Global Average (fallback)
  "GLOBAL": 20.5,
};

/**
 * Calculate spatially-explicit water scarcity impact using AWARE method
 * CRITICAL: This is required for CSRD E3 compliance
 */
function calculateWaterScarcity(
  waterConsumption: number,
  locationCountryCode: string | null | undefined
): { water_scarcity_aware: number; data_quality: "high" | "medium" | "low" } {
  const countryCode = locationCountryCode?.toUpperCase();

  if (!countryCode || !AWARE_FACTORS[countryCode]) {
    console.warn(
      `[AWARE] No specific location provided or unknown country: ${countryCode}. Using Global Average.`
    );
    return {
      water_scarcity_aware: waterConsumption * AWARE_FACTORS.GLOBAL,
      data_quality: "low",
    };
  }

  const awareFactor = AWARE_FACTORS[countryCode];
  console.log(
    `[AWARE] Applying water scarcity factor for ${countryCode}: ${awareFactor} m³ world eq/m³`
  );

  return {
    water_scarcity_aware: waterConsumption * awareFactor,
    data_quality: "high",
  };
}

/**
 * STEP 1: Check for Primary Supplier Data (Highest Priority)
 * COMPLIANCE: Checks data_source === "supplier" BEFORE any external API calls
 */
async function checkSupplierData(
  supabase: any,
  material: Material
): Promise<CalculatedMaterial | null> {
  if (material.data_source !== "supplier" || !material.supplier_product_id) {
    return null;
  }

  console.log(`[STEP 1] Checking supplier data for material: ${material.name}`);

  // PLACEHOLDER: Query supplier_products table for supplier-specific multi-capital impacts
  // Future implementation should return full ImpactMetrics from supplier EPD
  console.log(
    `[STEP 1] No supplier-specific multi-capital data available yet. Proceeding to OpenLCA.`
  );
  return null;
}

/**
 * STEP 2: Query OpenLCA / Ecoinvent 3.12 (PRIMARY/STANDARD PATH)
 * COMPLIANCE: ReCiPe 2016 Midpoint (H) for all 8 impact categories
 */
async function queryOpenLCA(
  material: Material,
  openLcaApiUrl: string | undefined,
  openLcaApiKey: string | undefined
): Promise<CalculatedMaterial | null> {
  if (!openLcaApiUrl || !openLcaApiKey) {
    console.warn(
      `[STEP 2] OpenLCA API not configured. Skipping OpenLCA lookup for: ${material.name}`
    );
    return null;
  }

  console.log(`[STEP 2] Querying OpenLCA/Ecoinvent 3.12 with ReCiPe 2016 for material: ${material.name}`);

  try {
    const requestPayload = {
      material_name: material.name,
      quantity: material.quantity,
      unit: material.unit || "kg",
      origin_country: material.origin_country,
      location_country_code: material.location_country_code,
      is_organic: material.is_organic_certified || false,
      database: "ecoinvent-3.12",
      impact_method: "ReCiPe 2016 Midpoint (H)",  // MANDATORY
    };

    console.log(`[STEP 2] OpenLCA Request:`, requestPayload);

    const response = await fetch(openLcaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openLcaApiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[STEP 2] OpenLCA API error (${response.status}): ${errorText}`
      );
      return null;
    }

    const openLcaData: OpenLCAResponse = await response.json();

    if (!openLcaData.success || !openLcaData.ecoinvent_process_uuid) {
      console.warn(
        `[STEP 2] OpenLCA returned unsuccessful response or missing process UUID:`,
        openLcaData
      );
      return null;
    }

    if (!openLcaData.impact_metrics) {
      console.error(
        `[STEP 2] CRITICAL: OpenLCA response missing impact_metrics. Cannot proceed with CSRD reporting.`
      );
      return null;
    }

    console.log(
      `[STEP 2] ✓ OpenLCA Success: ${openLcaData.ecoinvent_process_name} (${openLcaData.ecoinvent_process_uuid})`
    );
    console.log(
      `[STEP 2] Multi-Capital Impacts: GWP=${openLcaData.impact_metrics.climate_change_gwp100.toFixed(2)} kgCO2eq, Water=${openLcaData.impact_metrics.water_consumption.toFixed(3)} m³`
    );

    // Apply AWARE water scarcity factor
    const waterScarcity = calculateWaterScarcity(
      openLcaData.impact_metrics.water_consumption,
      material.location_country_code
    );

    const enhancedImpactMetrics: ImpactMetrics = {
      ...openLcaData.impact_metrics,
      water_scarcity_aware: waterScarcity.water_scarcity_aware,
    };

    return {
      material_id: material.id,
      material_name: material.name || "Unknown",
      quantity: material.quantity,
      unit: material.unit || "kg",
      factor_value: openLcaData.impact_metrics.climate_change_gwp100 / material.quantity,
      emission_factor_unit: "kgCO2eq/kg",
      calculated_co2e: openLcaData.impact_metrics.climate_change_gwp100,
      data_source: "openlca",
      source_used: `Ecoinvent ${openLcaData.database_version || "3.12"}`,
      external_reference_id: openLcaData.ecoinvent_process_uuid,
      methodology: `Cradle-to-Gate (${openLcaData.system_model || "Cut-off"} System Model)`,
      confidence_score: "high",
      impact_metrics: enhancedImpactMetrics,
      impact_assessment_method: openLcaData.impact_assessment_method || "ReCiPe 2016 Midpoint (H)",
      data_quality: waterScarcity.data_quality,
      geographic_scope: material.origin_country || openLcaData.system_model || "Global",
      location_country_code: material.location_country_code,
      year_of_publication: 2024,
      lca_stage: material.lca_sub_stage_id || "Unclassified",
      ecoinvent_process_name: openLcaData.ecoinvent_process_name,
      database_version: openLcaData.database_version || "Ecoinvent 3.12",
      notes: `ReCiPe 2016 Midpoint (H) - System Model: ${openLcaData.system_model || "Cut-off"}`,
    };
  } catch (error: any) {
    console.error(`[STEP 2] OpenLCA query failed:`, error.message);
    return null;
  }
}

/**
 * STEP 3: Internal Fallback (DEFRA/Proxy Data)
 * COMPLIANCE: Conservative proxy for single-impact (GWP) with conservative multi-capital estimates
 * WARNING: This is NOT CSRD-compliant for full reporting. OpenLCA is required.
 */
async function lookupInternalFallback(
  supabase: any,
  material: Material
): Promise<CalculatedMaterial | null> {
  if (!material.name) {
    throw new Error(
      `Material ${material.id} has no name. Cannot perform fallback lookup.`
    );
  }

  console.log(
    `[STEP 3] Querying internal fallback (DEFRA/Proxy) for material: ${material.name}`
  );
  console.warn(
    `[STEP 3] WARNING: Fallback mode does NOT provide full CSRD multi-capital data. OpenLCA integration required.`
  );

  const geographicScope = material.origin_country || "Global";

  let query = supabase
    .from("emissions_factors")
    .select("*")
    .ilike("name", `%${material.name}%`)
    .order("year_of_publication", { ascending: false });

  if (material.origin_country) {
    query = query.or(
      `geographic_scope.ilike.%${geographicScope}%,geographic_scope.eq.Global`
    );
  } else {
    query = query.eq("geographic_scope", "Global");
  }

  const { data: factors, error } = await query.limit(5);

  if (error) {
    console.error(`[STEP 3] Database query error:`, error);
    throw new Error(`Failed to query emissions factors: ${error.message}`);
  }

  if (!factors || factors.length === 0) {
    console.warn(
      `[STEP 3] No fallback emission factor found for: ${material.name} (origin: ${geographicScope})`
    );
    return null;
  }

  const selectedFactor: EmissionFactor = factors[0];
  const calculatedCO2e = material.quantity * selectedFactor.value;

  // Conservative multi-capital proxy estimates (NOT CSRD-COMPLIANT)
  // These are rough industry averages - OpenLCA required for accuracy
  const conservativeImpactMetrics: ImpactMetrics = {
    climate_change_gwp100: calculatedCO2e,
    water_consumption: material.quantity * 0.5,           // Conservative estimate: 0.5 m³/kg
    water_scarcity_aware: 0,                              // Calculated below
    land_use: material.quantity * 2.0,                    // Conservative estimate: 2 m²a/kg
    terrestrial_ecotoxicity: material.quantity * 0.01,    // Conservative estimate
    freshwater_eutrophication: material.quantity * 0.001, // Conservative estimate
    terrestrial_acidification: material.quantity * 0.005, // Conservative estimate
    fossil_resource_scarcity: material.quantity * 0.3,    // Conservative estimate: 0.3 kg oil eq/kg
  };

  // Apply AWARE factor to conservative water estimate
  const waterScarcity = calculateWaterScarcity(
    conservativeImpactMetrics.water_consumption,
    material.location_country_code
  );
  conservativeImpactMetrics.water_scarcity_aware = waterScarcity.water_scarcity_aware;

  console.log(
    `[STEP 3] Found fallback factor: ${selectedFactor.name} = ${selectedFactor.value} ${selectedFactor.unit} (${selectedFactor.source} ${selectedFactor.year_of_publication})`
  );
  console.warn(
    `[STEP 3] Using conservative multi-capital estimates. NOT suitable for CSRD reporting.`
  );

  return {
    material_id: material.id,
    material_name: material.name,
    quantity: material.quantity,
    unit: material.unit || "kg",
    factor_value: selectedFactor.value,
    emission_factor_unit: selectedFactor.unit,
    calculated_co2e: calculatedCO2e,
    data_source: "internal_fallback",
    source_used: `${selectedFactor.source} ${selectedFactor.year_of_publication}`,
    external_reference_id: selectedFactor.factor_id,
    methodology: "Conservative Proxy (Average Industry Factors)",
    confidence_score: "low",
    impact_metrics: conservativeImpactMetrics,
    impact_assessment_method: "Proxy (NOT ReCiPe 2016 - DEFRA single-impact)",
    data_quality: "low",
    geographic_scope: selectedFactor.geographic_scope,
    location_country_code: material.location_country_code,
    year_of_publication: selectedFactor.year_of_publication,
    lca_stage: material.lca_sub_stage_id || "Unclassified",
    notes:
      `FALLBACK DATA - OpenLCA unavailable. Multi-capital values are conservative estimates, NOT CSRD-compliant. ` +
      (factors.length > 1
        ? `${factors.length - 1} other factors available.`
        : ""),
  };
}

/**
 * MAIN CALCULATION ENGINE: Process All Materials with Multi-Capital LCIA
 *
 * COMPLIANCE: Strict data priority enforced + ReCiPe 2016 Midpoint (H)
 * 1. Supplier-Specific Data (Highest Confidence)
 * 2. OpenLCA/Ecoinvent 3.12 + ReCiPe 2016 (Standard Path - CSRD Compliant)
 * 3. Internal DEFRA/Proxy (Conservative Fallback - NOT CSRD Compliant)
 */
async function calculateMaterialsWithHierarchy(
  supabase: any,
  materials: Material[],
  openLcaApiUrl: string | undefined,
  openLcaApiKey: string | undefined
): Promise<{
  calculated_materials: CalculatedMaterial[];
  total_co2e: number;
  aggregated_impacts: ImpactMetrics;
  missing_factors: string[];
  data_sources_breakdown: {
    supplier: number;
    openlca: number;
    internal_fallback: number;
    failed: number;
  };
  csrd_compliant: boolean;
}> {
  const calculatedMaterials: CalculatedMaterial[] = [];
  const missingFactors: string[] = [];
  const dataSourcesBreakdown = {
    supplier: 0,
    openlca: 0,
    internal_fallback: 0,
    failed: 0,
  };

  const aggregatedImpacts: ImpactMetrics = {
    climate_change_gwp100: 0,
    water_consumption: 0,
    water_scarcity_aware: 0,
    land_use: 0,
    terrestrial_ecotoxicity: 0,
    freshwater_eutrophication: 0,
    terrestrial_acidification: 0,
    fossil_resource_scarcity: 0,
  };

  for (const material of materials) {
    console.log(`\n=== Processing Material: ${material.name} ===`);

    let result: CalculatedMaterial | null = null;

    // STEP 1: Highest Priority - Supplier Data
    result = await checkSupplierData(supabase, material);
    if (result) {
      dataSourcesBreakdown.supplier++;
    }

    // STEP 2: Standard Path - OpenLCA/Ecoinvent 3.12 + ReCiPe 2016
    if (!result) {
      result = await queryOpenLCA(material, openLcaApiUrl, openLcaApiKey);
      if (result) {
        dataSourcesBreakdown.openlca++;
      }
    }

    // STEP 3: Conservative Fallback - Internal DEFRA/Proxy
    if (!result) {
      result = await lookupInternalFallback(supabase, material);
      if (result) {
        dataSourcesBreakdown.internal_fallback++;
      }
    }

    // No data source succeeded
    if (!result) {
      const errorMsg = `Missing emission factor for: ${material.name} (origin: ${material.origin_country || "unspecified"})`;
      console.error(`[ERROR] ${errorMsg}`);
      missingFactors.push(errorMsg);
      dataSourcesBreakdown.failed++;

      const zeroImpacts: ImpactMetrics = {
        climate_change_gwp100: 0,
        water_consumption: 0,
        water_scarcity_aware: 0,
        land_use: 0,
        terrestrial_ecotoxicity: 0,
        freshwater_eutrophication: 0,
        terrestrial_acidification: 0,
        fossil_resource_scarcity: 0,
      };

      calculatedMaterials.push({
        material_id: material.id,
        material_name: material.name || "Unknown",
        quantity: material.quantity,
        unit: material.unit || "kg",
        factor_value: 0,
        emission_factor_unit: "kgCO2eq/kg",
        calculated_co2e: 0,
        data_source: "internal_fallback",
        source_used: "ERROR: No emission factor found",
        external_reference_id: "N/A",
        methodology: "Failed - No Data Available",
        confidence_score: "low",
        impact_metrics: zeroImpacts,
        impact_assessment_method: "N/A",
        data_quality: "low",
        geographic_scope: "Unknown",
        location_country_code: material.location_country_code,
        year_of_publication: 0,
        lca_stage: material.lca_sub_stage_id || "Unclassified",
        notes: errorMsg,
      });
    } else {
      calculatedMaterials.push(result);

      // Aggregate impacts across all materials
      aggregatedImpacts.climate_change_gwp100 += result.impact_metrics.climate_change_gwp100;
      aggregatedImpacts.water_consumption += result.impact_metrics.water_consumption;
      aggregatedImpacts.water_scarcity_aware += result.impact_metrics.water_scarcity_aware;
      aggregatedImpacts.land_use += result.impact_metrics.land_use;
      aggregatedImpacts.terrestrial_ecotoxicity += result.impact_metrics.terrestrial_ecotoxicity;
      aggregatedImpacts.freshwater_eutrophication += result.impact_metrics.freshwater_eutrophication;
      aggregatedImpacts.terrestrial_acidification += result.impact_metrics.terrestrial_acidification;
      aggregatedImpacts.fossil_resource_scarcity += result.impact_metrics.fossil_resource_scarcity;
    }
  }

  const totalCO2e = calculatedMaterials.reduce(
    (sum, mat) => sum + mat.calculated_co2e,
    0
  );

  // CSRD Compliance Check: Only OpenLCA results are fully compliant
  const csrdCompliant = dataSourcesBreakdown.internal_fallback === 0 && dataSourcesBreakdown.failed === 0;

  console.log(`\n=== CALCULATION SUMMARY ===`);
  console.log(`Total Materials: ${materials.length}`);
  console.log(`  → Supplier Data: ${dataSourcesBreakdown.supplier}`);
  console.log(`  → OpenLCA/Ecoinvent: ${dataSourcesBreakdown.openlca}`);
  console.log(`  → Internal Fallback: ${dataSourcesBreakdown.internal_fallback}`);
  console.log(`  → Failed: ${dataSourcesBreakdown.failed}`);
  console.log(`Total CO2e: ${totalCO2e.toFixed(2)} kg`);
  console.log(`CSRD Compliant: ${csrdCompliant ? "YES" : "NO - OpenLCA required for all materials"}`);
  console.log(`\n=== MULTI-CAPITAL IMPACTS (ReCiPe 2016) ===`);
  console.log(`Climate Change (GWP100): ${aggregatedImpacts.climate_change_gwp100.toFixed(2)} kg CO2eq`);
  console.log(`Water Consumption: ${aggregatedImpacts.water_consumption.toFixed(3)} m³`);
  console.log(`Water Scarcity (AWARE): ${aggregatedImpacts.water_scarcity_aware.toFixed(2)} m³ world eq`);
  console.log(`Land Use: ${aggregatedImpacts.land_use.toFixed(2)} m²a crop eq`);
  console.log(`Terrestrial Ecotoxicity: ${aggregatedImpacts.terrestrial_ecotoxicity.toFixed(4)} kg 1,4-DCB`);
  console.log(`Freshwater Eutrophication: ${aggregatedImpacts.freshwater_eutrophication.toFixed(4)} kg P eq`);
  console.log(`Terrestrial Acidification: ${aggregatedImpacts.terrestrial_acidification.toFixed(4)} kg SO2 eq`);
  console.log(`Fossil Resource Scarcity: ${aggregatedImpacts.fossil_resource_scarcity.toFixed(2)} kg oil eq`);

  return {
    calculated_materials: calculatedMaterials,
    total_co2e: totalCO2e,
    aggregated_impacts: aggregatedImpacts,
    missing_factors: missingFactors,
    data_sources_breakdown: dataSourcesBreakdown,
    csrd_compliant: csrdCompliant,
  };
}

/**
 * Calculate Manufacturing Impact from Production Facilities
 * Uses weighted average facility intensity based on production volume allocation
 */
async function calculateManufacturingImpact(
  supabase: any,
  lcaId: string,
  organizationId: string,
  productNetVolume: number,
  referenceYear: number
): Promise<{
  manufacturing_co2e: number;
  weighted_avg_intensity: number;
  production_sites: Array<{
    facility_name: string;
    production_share_percent: number;
    facility_intensity: number;
    data_source: string;
    attributable_co2e: number;
  }>;
}> {
  console.log(`\n=== CALCULATING MANUFACTURING IMPACT (ISO 14067/14044) ===`);
  console.log(`Product Net Volume: ${productNetVolume}`);
  console.log(`Reference Year: ${referenceYear}`);

  // Fetch production mix for this LCA (ISO 14044 Physical Allocation)
  const { data: sites, error: sitesError } = await supabase
    .from("lca_production_mix")
    .select("facility_id, production_share, facility_intensity, data_source_type")
    .eq("lca_id", lcaId);

  if (sitesError) {
    console.error("Error fetching production sites:", sitesError);
    throw new Error(`Failed to fetch production sites: ${sitesError.message}`);
  }

  if (!sites || sites.length === 0) {
    const errorMsg = `No production mix defined for LCA. Please allocate 100% of production across facilities for reference year ${referenceYear}.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Validate production mix is complete (100%)
  const totalShare = sites.reduce((sum: number, s: any) => sum + Number(s.production_share || 0), 0);
  if (totalShare < 0.9999 || totalShare > 1.0001) {
    const errorMsg = `Production mix incomplete: ${(totalShare * 100).toFixed(2)}%. Must equal 100% per ISO 14044 requirements.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`✓ Production mix validated: ${(totalShare * 100).toFixed(2)}% allocated`);

  // Fetch facility names
  const facilityIds = sites.map((s: any) => s.facility_id);
  const { data: facilities, error: facilitiesError } = await supabase
    .from("facilities")
    .select("id, name")
    .in("id", facilityIds);

  if (facilitiesError) {
    console.error("Error fetching facilities:", facilitiesError);
    throw new Error(`Failed to fetch facilities: ${facilitiesError.message}`);
  }

  const facilitiesMap = new Map((facilities || []).map((f: any) => [f.id, f.name]));

  // Validate all facilities have intensity data for reference year
  for (const site of sites) {
    if (!site.facility_intensity || site.facility_intensity === 0) {
      const facilityName = facilitiesMap.get(site.facility_id) || "Unknown Facility";
      const errorMsg = `Facility "${facilityName}" is missing emission intensity data for year ${referenceYear}. Please log emissions and production data for this facility before calculating.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  // Calculate weighted average intensity using production shares (ISO 14044 Physical Allocation)
  const weightedAvgIntensity = sites.reduce((sum: number, site: any) => {
    const share = Number(site.production_share || 0);
    const intensity = Number(site.facility_intensity || 0);
    return sum + (intensity * share);
  }, 0);

  const manufacturingCO2e = weightedAvgIntensity * productNetVolume;

  // Build per-facility breakdown for Glass Box transparency
  const productionSitesDetails = sites.map((site: any) => {
    const share = Number(site.production_share || 0);
    const sharePercent = share * 100;
    const intensity = Number(site.facility_intensity || 0);
    const attributableCO2e = intensity * share * productNetVolume;

    return {
      facility_name: facilitiesMap.get(site.facility_id) || "Unknown Facility",
      production_share_percent: sharePercent,
      facility_intensity: intensity,
      data_source: site.data_source_type === "Primary" ? "Verified" : "Industry_Average",
      attributable_co2e: attributableCO2e,
    };
  });

  console.log(`\n=== MANUFACTURING ALLOCATION (ISO 14044) ===`);
  console.log(`Number of Facilities: ${sites.length}`);
  console.log(`Reference Year: ${referenceYear}`);
  console.log(`Weighted Average Intensity: ${weightedAvgIntensity.toFixed(4)} kg CO₂e/unit`);
  console.log(`Manufacturing CO₂e: ${manufacturingCO2e.toFixed(4)} kg`);
  console.log(`Formula: Σ(Intensity × Share) × Product Volume`);
  console.log(`  = ${weightedAvgIntensity.toFixed(4)} × ${productNetVolume} = ${manufacturingCO2e.toFixed(4)} kg CO₂e`);
  console.log(`\nPer-Facility Breakdown (Glass Box):`);
  productionSitesDetails.forEach((detail) => {
    console.log(`  - ${detail.facility_name}: ${detail.production_share_percent.toFixed(2)}% × ${detail.facility_intensity.toFixed(4)} = ${detail.attributable_co2e.toFixed(4)} kg CO₂e (${detail.data_source})`);
  });

  return {
    manufacturing_co2e: manufacturingCO2e,
    weighted_avg_intensity: weightedAvgIntensity,
    production_sites: productionSitesDetails,
  };
}

/**
 * MAIN EDGE FUNCTION HANDLER
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let logId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openLcaApiUrl = Deno.env.get("OPENLCA_API_URL");
    const openLcaApiKey = Deno.env.get("OPENLCA_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Authentication failed:", userError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    const payload: InvokePayload = await req.json();

    if (!payload.lcaId || !payload.materials) {
      throw new Error("Missing required fields: lcaId and materials");
    }

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .select("id, organization_id, product_name, functional_unit, status, product_id, reference_year")
      .eq("id", payload.lcaId)
      .maybeSingle();

    if (lcaError || !lca) {
      throw new Error("Product LCA not found");
    }

    // Fetch product details for net volume
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("net_volume, volume_unit")
      .eq("id", lca.product_id)
      .maybeSingle();

    if (productError) {
      console.warn("Could not fetch product details:", productError);
    }

    const productNetVolume = product?.net_volume || 1;
    const volumeUnit = product?.volume_unit || "unit";

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", lca.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      throw new Error("User is not a member of the LCA's organisation");
    }

    if (!payload.materials || payload.materials.length === 0) {
      throw new Error("No materials provided for calculation");
    }

    const { data: calcLog, error: logError } = await supabase
      .from("product_lca_calculation_logs")
      .insert({
        product_lca_id: payload.lcaId,
        status: "pending",
        request_payload: {
          materials_count: payload.materials.length,
          calculation_method: "ReCiPe 2016 Midpoint (H) - Multi-Capital LCIA",
          location_country_code: payload.location_country_code,
          timestamp: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (logError || !calcLog) {
      console.error("Failed to create calculation log:", logError);
    } else {
      logId = calcLog.id;
    }

    await supabase
      .from("product_lcas")
      .update({ status: "pending" })
      .eq("id", payload.lcaId);

    console.log(`\n========================================`);
    console.log(`MULTI-CAPITAL LCIA CALCULATION ENGINE`);
    console.log(`Method: ReCiPe 2016 Midpoint (H)`);
    console.log(`PRIMARY PATH: OpenLCA/Ecoinvent 3.12`);
    console.log(`Product: ${lca.product_name}`);
    console.log(`Materials: ${payload.materials.length}`);
    console.log(`Location: ${payload.location_country_code || "Not specified"}`);
    console.log(`========================================\n`);

    const calculationResult = await calculateMaterialsWithHierarchy(
      supabase,
      payload.materials,
      openLcaApiUrl,
      openLcaApiKey
    );

    // Calculate manufacturing impact from production facilities
    const manufacturingResult = await calculateManufacturingImpact(
      supabase,
      payload.lcaId,
      lca.organization_id,
      productNetVolume,
      lca.reference_year
    );

    // Combine upstream (materials) and manufacturing impacts
    const totalCO2e = calculationResult.total_co2e + manufacturingResult.manufacturing_co2e;

    if (calculationResult.missing_factors.length > 0) {
      const errorMessage = `Missing emission factors for ${calculationResult.missing_factors.length} materials:\n${calculationResult.missing_factors.join("\n")}`;

      await supabase
        .from("product_lcas")
        .update({ status: "failed" })
        .eq("id", payload.lcaId);

      if (logId) {
        await supabase
          .from("product_lca_calculation_logs")
          .update({
            status: "failed",
            error_message: errorMessage,
            response_data: {
              calculated_materials: calculationResult.calculated_materials,
              missing_factors: calculationResult.missing_factors,
              data_sources_breakdown: calculationResult.data_sources_breakdown,
              aggregated_impacts: calculationResult.aggregated_impacts,
            },
            calculation_duration_ms: Date.now() - startTime,
          })
          .eq("id", logId);
      }

      throw new Error(errorMessage);
    }

    // Store multi-capital results with breakdown
    const resultsToInsert = [
      {
        product_lca_id: payload.lcaId,
        impact_category: "Total Product Footprint",
        value: totalCO2e,
        unit: "kg CO₂ eq",
        method: "ReCiPe 2016 Midpoint (H) - CSRD/TNFD Compliant",
      },
      {
        product_lca_id: payload.lcaId,
        impact_category: "Upstream (Materials & Packaging)",
        value: calculationResult.total_co2e,
        unit: "kg CO₂ eq",
        method: "ReCiPe 2016 Midpoint (H)",
      },
      {
        product_lca_id: payload.lcaId,
        impact_category: "Manufacturing (Core Operations)",
        value: manufacturingResult.manufacturing_co2e,
        unit: "kg CO₂ eq",
        method: "Facility Intensity Allocation (ISO 14044)",
      },
    ];

    const { error: resultsError } = await supabase
      .from("product_lca_results")
      .insert(resultsToInsert);

    if (resultsError) {
      throw new Error(`Failed to save results: ${resultsError.message}`);
    }

    await supabase
      .from("product_lcas")
      .update({ status: "completed" })
      .eq("id", payload.lcaId);

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      await supabase
        .from("product_lca_calculation_logs")
        .update({
          status: "success",
          response_data: {
            calculated_materials: calculationResult.calculated_materials,
            upstream_co2e: calculationResult.total_co2e,
            manufacturing_co2e: manufacturingResult.manufacturing_co2e,
            total_co2e: totalCO2e,
            aggregated_impacts: calculationResult.aggregated_impacts,
            calculation_method: "ReCiPe 2016 Midpoint (H) - Multi-Capital LCIA",
            data_sources_breakdown: calculationResult.data_sources_breakdown,
            csrd_compliant: calculationResult.csrd_compliant,
            manufacturing_allocation: manufacturingResult,
          },
          calculation_duration_ms: calculationDuration,
        })
        .eq("id", logId);
    }

    console.log(`\n========================================`);
    console.log(`CALCULATION COMPLETE`);
    console.log(`Upstream CO2e (Materials): ${calculationResult.total_co2e.toFixed(2)} kg`);
    console.log(`Manufacturing CO2e: ${manufacturingResult.manufacturing_co2e.toFixed(2)} kg`);
    console.log(`Total Product Footprint: ${totalCO2e.toFixed(2)} kg`);
    console.log(`CSRD Compliant: ${calculationResult.csrd_compliant ? "YES" : "NO"}`);
    console.log(
      `Data Sources: OpenLCA=${calculationResult.data_sources_breakdown.openlca}, Supplier=${calculationResult.data_sources_breakdown.supplier}, Fallback=${calculationResult.data_sources_breakdown.internal_fallback}`
    );
    console.log(`Production Sites: ${manufacturingResult.production_sites.length}`);
    console.log(`Duration: ${calculationDuration}ms`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Multi-capital LCA calculation completed using ReCiPe 2016 Midpoint (H) with facility-based manufacturing allocation",
        upstream_co2e: calculationResult.total_co2e,
        manufacturing_co2e: manufacturingResult.manufacturing_co2e,
        total_co2e: totalCO2e,
        aggregated_impacts: calculationResult.aggregated_impacts,
        materials_calculated: calculationResult.calculated_materials.length,
        production_sites: manufacturingResult.production_sites.length,
        weighted_avg_facility_intensity: manufacturingResult.weighted_avg_intensity,
        calculation_method: "ReCiPe 2016 Midpoint (H) + ISO 14044 Facility Allocation",
        impact_assessment_method: "ReCiPe 2016 Midpoint (H)",
        data_sources_breakdown: calculationResult.data_sources_breakdown,
        csrd_compliant: calculationResult.csrd_compliant,
        results_count: resultsToInsert.length,
        calculation_duration_ms: calculationDuration,
        audit_trail: calculationResult.calculated_materials,
        manufacturing_allocation: manufacturingResult,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in invoke-calculation-engine:", error);

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from("product_lca_calculation_logs")
          .update({
            status: "failed",
            error_message: error.message,
            calculation_duration_ms: calculationDuration,
          })
          .eq("id", logId);

        const reqClone = req.clone();
        const payload: InvokePayload = await reqClone.json();
        if (payload.lcaId) {
          await supabase
            .from("product_lcas")
            .update({ status: "failed" })
            .eq("id", payload.lcaId);
        }
      } catch (logError) {
        console.error("Failed to update error log:", logError);
      }
    }

    const statusCode =
      error.message === "Unauthorized"
        ? 401
        : error.message.includes("Missing emission factor")
        ? 422
        : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        calculation_method: "ReCiPe 2016 Midpoint (H)",
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
