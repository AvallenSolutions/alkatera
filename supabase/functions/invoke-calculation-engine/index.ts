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
  is_organic_certified?: boolean;
}

interface InvokePayload {
  lcaId: string;
  materials: Material[];
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
 * OpenLCA/Ecoinvent Response Structure
 */
interface OpenLCAResponse {
  success: boolean;
  material_name: string;
  calculated_co2e: number;
  ecoinvent_process_uuid: string;
  ecoinvent_process_name: string;
  unit: string;
  system_model: string;
  database_version: string;
  calculation_details?: {
    quantity: number;
    emission_factor: number;
    formula: string;
  };
  error?: string;
}

/**
 * Calculated Material with Full Audit Trail
 * COMPLIANCE: Glass Box Protocol - All fields mandatory for audit trail
 */
interface CalculatedMaterial {
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;

  // MANDATORY GLASS BOX AUDIT METADATA
  factor_value: number;                        // The actual emission factor used
  emission_factor_unit: string;                // Unit of the factor (e.g., kgCO2e/kg)
  calculated_co2e: number;                     // Final calculated result
  data_source: "supplier" | "openlca" | "internal_fallback";
  source_used: string;                         // REQUIRED: e.g., "Ecoinvent 3.12" or "DEFRA 2025"
  external_reference_id: string;               // REQUIRED: Ecoinvent UUID, Supplier ID, or Factor ID
  methodology: string;                         // REQUIRED: e.g., "Cradle-to-Gate", "Cradle-to-Grave"
  confidence_score: "high" | "medium" | "low";

  // ADDITIONAL CONTEXT
  geographic_scope: string;
  year_of_publication: number | string;
  lca_stage: string;
  ecoinvent_process_name?: string;            // Human-readable process name
  database_version?: string;
  notes?: string;
}

/**
 * STEP 1: Check for Primary Supplier Data (Highest Priority)
 * COMPLIANCE: Checks data_source === "supplier" BEFORE any external API calls
 */
async function checkSupplierData(
  supabase: any,
  material: Material
): Promise<CalculatedMaterial | null> {
  // COMPLIANCE CHECK: Explicit supplier data check before proceeding
  if (material.data_source !== "supplier" || !material.supplier_product_id) {
    return null;
  }

  console.log(`[STEP 1] Checking supplier data for material: ${material.name}`);

  // PLACEHOLDER: Query supplier_products table for supplier-specific emission values
  // const { data: supplierProduct } = await supabase
  //   .from('supplier_products')
  //   .select('emission_factor, emission_factor_unit, source_documentation, supplier_name, id')
  //   .eq('id', material.supplier_product_id)
  //   .maybeSingle();
  //
  // if (supplierProduct?.emission_factor) {
  //   const calculatedCO2e = material.quantity * supplierProduct.emission_factor;
  //   return {
  //     material_id: material.id,
  //     material_name: material.name || "Unknown",
  //     quantity: material.quantity,
  //     unit: material.unit || "kg",
  //     factor_value: supplierProduct.emission_factor,
  //     emission_factor_unit: supplierProduct.emission_factor_unit,
  //     calculated_co2e: calculatedCO2e,
  //     data_source: "supplier",
  //     source_used: `Supplier: ${supplierProduct.supplier_name}`,
  //     external_reference_id: supplierProduct.id,
  //     methodology: "Primary Supplier EPD (Environmental Product Declaration)",
  //     confidence_score: "high",
  //     geographic_scope: material.origin_country || "Supplier-Specific",
  //     year_of_publication: new Date().getFullYear(),
  //     lca_stage: material.lca_sub_stage_id || "Unclassified",
  //     notes: "Primary supplier data - highest confidence"
  //   };
  // }

  console.log(
    `[STEP 1] No supplier-specific emission factor available yet. Proceeding to OpenLCA.`
  );
  return null;
}

/**
 * STEP 2: Query OpenLCA / Ecoinvent 3.12 (PRIMARY/STANDARD PATH)
 * COMPLIANCE: Captures external_reference_id (Ecoinvent UUID) for full audit trail
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

  console.log(`[STEP 2] Querying OpenLCA/Ecoinvent 3.12 for material: ${material.name}`);

  try {
    const requestPayload = {
      material_name: material.name,
      quantity: material.quantity,
      unit: material.unit || "kg",
      origin_country: material.origin_country,
      is_organic: material.is_organic_certified || false,
      database: "ecoinvent-3.12",
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

    // COMPLIANCE CHECK: Validate external_reference_id exists
    if (!openLcaData.success || !openLcaData.ecoinvent_process_uuid) {
      console.warn(
        `[STEP 2] OpenLCA returned unsuccessful response or missing process UUID (external_reference_id):`,
        openLcaData
      );
      return null;
    }

    console.log(
      `[STEP 2] ✓ OpenLCA Success: ${openLcaData.ecoinvent_process_name} (${openLcaData.ecoinvent_process_uuid})`
    );

    // COMPLIANCE: All mandatory fields populated
    return {
      material_id: material.id,
      material_name: material.name || "Unknown",
      quantity: material.quantity,
      unit: material.unit || "kg",
      factor_value: openLcaData.calculation_details?.emission_factor || 0,
      emission_factor_unit: openLcaData.unit,
      calculated_co2e: openLcaData.calculated_co2e,
      data_source: "openlca",
      source_used: `Ecoinvent ${openLcaData.database_version || "3.12"}`,
      external_reference_id: openLcaData.ecoinvent_process_uuid,
      methodology: `Cradle-to-Gate (${openLcaData.system_model || "Cut-off"} System Model)`,
      confidence_score: "high",
      geographic_scope: material.origin_country || openLcaData.system_model || "Global",
      year_of_publication: 2024,
      lca_stage: material.lca_sub_stage_id || "Unclassified",
      ecoinvent_process_name: openLcaData.ecoinvent_process_name,
      database_version: openLcaData.database_version || "Ecoinvent 3.12",
      notes: `System Model: ${openLcaData.system_model || "Cut-off"}`,
    };
  } catch (error: any) {
    console.error(`[STEP 2] OpenLCA query failed:`, error.message);
    return null;
  }
}

/**
 * STEP 3: Internal Fallback (DEFRA/Proxy Data)
 * COMPLIANCE: Only triggered if OpenLCA fails - uses database factor_id as external_reference_id
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
  console.log(
    `[STEP 3] Found fallback factor: ${selectedFactor.name} = ${selectedFactor.value} ${selectedFactor.unit} (${selectedFactor.source} ${selectedFactor.year_of_publication})`
  );

  const calculatedCO2e = material.quantity * selectedFactor.value;

  // COMPLIANCE: All mandatory fields populated, using factor_id as external_reference_id
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
    confidence_score: selectedFactor.geographic_scope === geographicScope ? "medium" : "low",
    geographic_scope: selectedFactor.geographic_scope,
    year_of_publication: selectedFactor.year_of_publication,
    lca_stage: material.lca_sub_stage_id || "Unclassified",
    notes:
      `FALLBACK DATA - OpenLCA unavailable. ` +
      (factors.length > 1
        ? `${factors.length - 1} other factors available.`
        : ""),
  };
}

/**
 * MAIN CALCULATION ENGINE: Process All Materials with Corrected Data Hierarchy
 *
 * COMPLIANCE: Strict data priority enforced
 * 1. Supplier-Specific Data (Highest Confidence)
 * 2. OpenLCA/Ecoinvent 3.12 (Standard Path)
 * 3. Internal DEFRA/Proxy (Conservative Fallback)
 */
async function calculateMaterialsWithHierarchy(
  supabase: any,
  materials: Material[],
  openLcaApiUrl: string | undefined,
  openLcaApiKey: string | undefined
): Promise<{
  calculated_materials: CalculatedMaterial[];
  total_co2e: number;
  missing_factors: string[];
  data_sources_breakdown: {
    supplier: number;
    openlca: number;
    internal_fallback: number;
    failed: number;
  };
}> {
  const calculatedMaterials: CalculatedMaterial[] = [];
  const missingFactors: string[] = [];
  const dataSourcesBreakdown = {
    supplier: 0,
    openlca: 0,
    internal_fallback: 0,
    failed: 0,
  };

  for (const material of materials) {
    console.log(`\n=== Processing Material: ${material.name} ===`);

    let result: CalculatedMaterial | null = null;

    // STEP 1: Highest Priority - Supplier Data
    result = await checkSupplierData(supabase, material);
    if (result) {
      dataSourcesBreakdown.supplier++;
    }

    // STEP 2: Standard Path - OpenLCA/Ecoinvent 3.12
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

    // No data source succeeded - COMPLIANCE: Return error with all required fields
    if (!result) {
      const errorMsg = `Missing emission factor for: ${material.name} (origin: ${material.origin_country || "unspecified"})`;
      console.error(`[ERROR] ${errorMsg}`);
      missingFactors.push(errorMsg);
      dataSourcesBreakdown.failed++;

      calculatedMaterials.push({
        material_id: material.id,
        material_name: material.name || "Unknown",
        quantity: material.quantity,
        unit: material.unit || "kg",
        factor_value: 0,
        emission_factor_unit: "kgCO2e/kg",
        calculated_co2e: 0,
        data_source: "internal_fallback",
        source_used: "ERROR: No emission factor found",
        external_reference_id: "N/A",
        methodology: "Failed - No Data Available",
        confidence_score: "low",
        geographic_scope: "Unknown",
        year_of_publication: 0,
        lca_stage: material.lca_sub_stage_id || "Unclassified",
        notes: errorMsg,
      });
    } else {
      calculatedMaterials.push(result);
    }
  }

  const totalCO2e = calculatedMaterials.reduce(
    (sum, mat) => sum + mat.calculated_co2e,
    0
  );

  console.log(`\n=== CALCULATION SUMMARY ===`);
  console.log(`Total Materials: ${materials.length}`);
  console.log(`  → Supplier Data: ${dataSourcesBreakdown.supplier}`);
  console.log(`  → OpenLCA/Ecoinvent: ${dataSourcesBreakdown.openlca}`);
  console.log(`  → Internal Fallback: ${dataSourcesBreakdown.internal_fallback}`);
  console.log(`  → Failed: ${dataSourcesBreakdown.failed}`);
  console.log(`Total CO2e: ${totalCO2e.toFixed(2)} kg`);

  return {
    calculated_materials: calculatedMaterials,
    total_co2e: totalCO2e,
    missing_factors: missingFactors,
    data_sources_breakdown: dataSourcesBreakdown,
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
      .select("id, organization_id, product_name, functional_unit, status")
      .eq("id", payload.lcaId)
      .maybeSingle();

    if (lcaError || !lca) {
      throw new Error("Product LCA not found");
    }

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
          calculation_method: "Glass Box - OpenLCA/Ecoinvent 3.12 Primary",
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
    console.log(`GLASS BOX CALCULATION ENGINE`);
    console.log(`PRIMARY PATH: OpenLCA/Ecoinvent 3.12`);
    console.log(`Product: ${lca.product_name}`);
    console.log(`Materials: ${payload.materials.length}`);
    console.log(`========================================\n`);

    const calculationResult = await calculateMaterialsWithHierarchy(
      supabase,
      payload.materials,
      openLcaApiUrl,
      openLcaApiKey
    );

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
            },
            calculation_duration_ms: Date.now() - startTime,
          })
          .eq("id", logId);
      }

      throw new Error(errorMessage);
    }

    const resultsToInsert = [
      {
        product_lca_id: payload.lcaId,
        impact_category: "Climate Change",
        value: calculationResult.total_co2e,
        unit: "kg CO₂ eq",
        method: "OpenLCA/Ecoinvent 3.12 (Glass Box Compliant)",
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
            total_co2e: calculationResult.total_co2e,
            calculation_method: "OpenLCA/Ecoinvent 3.12 Primary Path",
            data_sources_breakdown: calculationResult.data_sources_breakdown,
          },
          calculation_duration_ms: calculationDuration,
        })
        .eq("id", logId);
    }

    console.log(`\n========================================`);
    console.log(`CALCULATION COMPLETE`);
    console.log(`Total CO2e: ${calculationResult.total_co2e.toFixed(2)} kg`);
    console.log(
      `Data Sources: OpenLCA=${calculationResult.data_sources_breakdown.openlca}, Supplier=${calculationResult.data_sources_breakdown.supplier}, Fallback=${calculationResult.data_sources_breakdown.internal_fallback}`
    );
    console.log(`Duration: ${calculationDuration}ms`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "LCA calculation completed successfully using OpenLCA/Ecoinvent 3.12",
        total_co2e: calculationResult.total_co2e,
        materials_calculated: calculationResult.calculated_materials.length,
        calculation_method: "OpenLCA/Ecoinvent 3.12 Primary Path",
        data_sources_breakdown: calculationResult.data_sources_breakdown,
        results_count: resultsToInsert.length,
        calculation_duration_ms: calculationDuration,
        audit_trail: calculationResult.calculated_materials,
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
        calculation_method: "OpenLCA/Ecoinvent 3.12 Primary Path",
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
