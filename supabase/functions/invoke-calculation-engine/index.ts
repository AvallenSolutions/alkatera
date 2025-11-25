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
 * Emission Factor from Database
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
 * Calculated Material with Full Audit Trail
 */
interface CalculatedMaterial {
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  emission_factor_used: number;
  emission_factor_unit: string;
  calculated_co2e: number;
  data_source: "supplier" | "openlca" | "internal_library";
  source_reference: string;
  calculation_method: string;
  confidence_score: "high" | "medium" | "low";
  geographic_scope: string;
  year_of_publication: number;
  lca_stage: string;
  notes?: string;
}

/**
 * STEP 1: Check for Primary Supplier Data
 * Future enhancement: Query supplier_products table for specific emission values
 */
async function checkSupplierData(
  supabase: any,
  material: Material
): Promise<CalculatedMaterial | null> {
  if (material.data_source !== "supplier" || !material.supplier_product_id) {
    return null;
  }

  console.log(`[STEP 1] Checking supplier data for material: ${material.name}`);

  // PLACEHOLDER: This is where supplier-specific emission factors would be retrieved
  // For now, we return null to proceed to internal library lookup
  // Future implementation should query:
  // const { data: supplierProduct } = await supabase
  //   .from('supplier_products')
  //   .select('emission_factor, emission_factor_unit, source_documentation')
  //   .eq('id', material.supplier_product_id)
  //   .maybeSingle();

  console.log(
    `[STEP 1] No supplier-specific emission factor available yet. Falling back to internal library.`
  );
  return null;
}

/**
 * STEP 2: Query Internal Emissions Factors Library
 * This is the PRIMARY calculation path - queries public.emissions_factors table
 */
async function lookupInternalEmissionFactor(
  supabase: any,
  material: Material
): Promise<CalculatedMaterial | null> {
  if (!material.name) {
    throw new Error(
      `Material ${material.id} has no name. Cannot perform emission factor lookup.`
    );
  }

  console.log(`[STEP 2] Querying emissions_factors for material: ${material.name}`);

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
    console.error(`[STEP 2] Database query error:`, error);
    throw new Error(`Failed to query emissions factors: ${error.message}`);
  }

  if (!factors || factors.length === 0) {
    console.warn(
      `[STEP 2] No emission factor found for material: ${material.name} (origin: ${geographicScope})`
    );
    return null;
  }

  const selectedFactor: EmissionFactor = factors[0];
  console.log(
    `[STEP 2] Found emission factor: ${selectedFactor.name} = ${selectedFactor.value} ${selectedFactor.unit} (${selectedFactor.source} ${selectedFactor.year_of_publication})`
  );

  const calculatedCO2e = material.quantity * selectedFactor.value;

  return {
    material_id: material.id,
    material_name: material.name,
    quantity: material.quantity,
    unit: material.unit || "kg",
    emission_factor_used: selectedFactor.value,
    emission_factor_unit: selectedFactor.unit,
    calculated_co2e: calculatedCO2e,
    data_source: "internal_library",
    source_reference: `${selectedFactor.source} ${selectedFactor.year_of_publication}`,
    calculation_method: "Direct Multiplication (Quantity × Emission Factor)",
    confidence_score: selectedFactor.geographic_scope === geographicScope ? "high" : "medium",
    geographic_scope: selectedFactor.geographic_scope,
    year_of_publication: selectedFactor.year_of_publication,
    lca_stage: material.lca_sub_stage_id || "Unclassified",
    notes: factors.length > 1
      ? `${factors.length - 1} other factors available. Selected most recent.`
      : undefined,
  };
}

/**
 * STEP 3: Fallback to OpenLCA External Service (Optional)
 * Only used if Steps 1 and 2 both fail
 */
async function fallbackToOpenLCA(
  material: Material,
  openLcaApiUrl: string | undefined,
  openLcaApiKey: string | undefined
): Promise<CalculatedMaterial | null> {
  if (!openLcaApiUrl || !openLcaApiKey) {
    console.warn(
      `[STEP 3] OpenLCA API not configured. Cannot use fallback for: ${material.name}`
    );
    return null;
  }

  console.log(`[STEP 3] Attempting OpenLCA fallback for material: ${material.name}`);

  // This would call the external OpenLCA API
  // For now, we don't implement this to ensure Glass Box compliance
  console.warn(
    `[STEP 3] OpenLCA fallback not implemented. Use internal library instead.`
  );
  return null;
}

/**
 * MAIN CALCULATION ENGINE: Process All Materials with Data Hierarchy
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
}> {
  const calculatedMaterials: CalculatedMaterial[] = [];
  const missingFactors: string[] = [];

  for (const material of materials) {
    console.log(`\n=== Processing Material: ${material.name} ===`);

    let result: CalculatedMaterial | null = null;

    result = await checkSupplierData(supabase, material);

    if (!result) {
      result = await lookupInternalEmissionFactor(supabase, material);
    }

    if (!result) {
      result = await fallbackToOpenLCA(
        material,
        openLcaApiUrl,
        openLcaApiKey
      );
    }

    if (!result) {
      const errorMsg = `Missing emission factor for: ${material.name} (origin: ${material.origin_country || "unspecified"})`;
      console.error(`[ERROR] ${errorMsg}`);
      missingFactors.push(errorMsg);

      calculatedMaterials.push({
        material_id: material.id,
        material_name: material.name || "Unknown",
        quantity: material.quantity,
        unit: material.unit || "kg",
        emission_factor_used: 0,
        emission_factor_unit: "kgCO2e/kg",
        calculated_co2e: 0,
        data_source: "internal_library",
        source_reference: "ERROR: No emission factor found",
        calculation_method: "Failed",
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
  console.log(`Successfully Calculated: ${calculatedMaterials.length - missingFactors.length}`);
  console.log(`Missing Factors: ${missingFactors.length}`);
  console.log(`Total CO2e: ${totalCO2e.toFixed(2)} kg`);

  return {
    calculated_materials: calculatedMaterials,
    total_co2e: totalCO2e,
    missing_factors: missingFactors,
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
          calculation_method: "Glass Box Internal Library",
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

    console.log(
      `\n========================================`
    );
    console.log(`GLASS BOX CALCULATION ENGINE`);
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
        method: "Internal Emissions Factors Library (Glass Box)",
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
            calculation_method: "Glass Box Internal Library",
            data_sources_used: calculationResult.calculated_materials.map(
              (m) => m.data_source
            ),
          },
          calculation_duration_ms: calculationDuration,
        })
        .eq("id", logId);
    }

    console.log(`\n========================================`);
    console.log(`CALCULATION COMPLETE`);
    console.log(`Total CO2e: ${calculationResult.total_co2e.toFixed(2)} kg`);
    console.log(`Duration: ${calculationDuration}ms`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "LCA calculation completed successfully using Glass Box method",
        total_co2e: calculationResult.total_co2e,
        materials_calculated: calculationResult.calculated_materials.length,
        calculation_method: "Internal Emissions Factors Library",
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
        calculation_method: "Glass Box Internal Library",
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
