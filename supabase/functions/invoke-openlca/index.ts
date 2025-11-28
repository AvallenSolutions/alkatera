import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DQIScores {
  reliability: number;
  temporal: number;
  geographical: number;
  technological: number;
  completeness: number;
}

interface PedigreeMatrix {
  reliability: number;
  completeness: number;
  temporalCorrelation: number;
  geographicalCorrelation: number;
  technologicalCorrelation: number;
}

interface LCAInput {
  label: string;
  value: number;
  unit: string;
  dqi: DQIScores;
  evidenceUrl?: string;
  stage: string;
  category: string;
}

interface OpenLCAExchange {
  "@type": string;
  amount: number;
  unit: {
    "@type": string;
    name: string;
  };
  flow: {
    "@type": string;
    name: string;
    category: string;
  };
  dqEntry?: string;
  pedigreeMatrix?: PedigreeMatrix;
}

interface OpenLCAProcess {
  "@context": string;
  "@type": string;
  name: string;
  processType: string;
  exchanges: OpenLCAExchange[];
}

interface InvokePayload {
  product_lca_id: string;
}

const IMPACT_CATEGORIES = [
  { name: "Climate Change", unit: "kg CO₂ eq" },
  { name: "Ozone Depletion", unit: "kg CFC-11 eq" },
  { name: "Human Toxicity", unit: "kg 1,4-DB eq" },
  { name: "Freshwater Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Terrestrial Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Eutrophication", unit: "kg PO₄³⁻ eq" },
];

function mapDqiToOpenLcaFormat(dqi: DQIScores): PedigreeMatrix {
  return {
    reliability: dqi.reliability,
    completeness: dqi.completeness,
    temporalCorrelation: dqi.temporal,
    geographicalCorrelation: dqi.geographical,
    technologicalCorrelation: dqi.technological,
  };
}

function buildDqEntryString(dqi: DQIScores): string {
  return `(${dqi.reliability};${dqi.completeness};${dqi.temporal};${dqi.geographical};${dqi.technological})`;
}

function transformToOpenLcaProcess(
  productName: string,
  functionalUnit: string,
  inputs: LCAInput[]
): OpenLCAProcess {
  const exchanges: OpenLCAExchange[] = inputs.map((input) => ({
    "@type": "Exchange",
    amount: input.value,
    unit: {
      "@type": "Unit",
      name: input.unit,
    },
    flow: {
      "@type": "Flow",
      name: input.label,
      category: input.stage,
    },
    dqEntry: buildDqEntryString(input.dqi),
    pedigreeMatrix: mapDqiToOpenLcaFormat(input.dqi),
  }));

  return {
    "@context": "http://greendelta.github.io/olca-schema",
    "@type": "Process",
    name: productName,
    processType: "UNIT_PROCESS",
    exchanges,
  };
}

function validateEvidenceRequirements(inputs: LCAInput[]): {
  valid: boolean;
  missingEvidence: string[];
} {
  const missingEvidence: string[] = [];

  inputs.forEach((input) => {
    const needsEvidence = input.dqi.reliability === 1 || input.dqi.reliability === 2;
    if (needsEvidence && !input.evidenceUrl) {
      missingEvidence.push(input.label);
    }
  });

  return {
    valid: missingEvidence.length === 0,
    missingEvidence,
  };
}

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
    const executionEnvironment = Deno.env.get("EXECUTION_ENVIRONMENT") || "unknown";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const payload: InvokePayload = await req.json();

    if (!payload.product_lca_id) {
      throw new Error("Missing required field: product_lca_id");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.product_lca_id)) {
      throw new Error("Invalid UUID format for product_lca_id");
    }

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .select("id, organization_id, product_name, functional_unit, system_boundary, status")
      .eq("id", payload.product_lca_id)
      .single();

    if (lcaError || !lca) {
      throw new Error("Product LCA not found");
    }

    if (lca.status !== "draft") {
      throw new Error(`Cannot calculate LCA with status: ${lca.status}. Only draft LCAs can be calculated.`);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", lca.organization_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      throw new Error("User is not a member of the LCA's organization");
    }

    // Fetch materials from the normalized product_lca_materials table
    const { data: materials, error: materialsError } = await supabase
      .from("product_lca_materials")
      .select("*")
      .eq("product_lca_id", payload.product_lca_id);

    if (materialsError) {
      throw new Error(`Failed to fetch materials: ${materialsError.message}`);
    }

    if (!materials || materials.length === 0) {
      throw new Error("No materials found for this LCA. Please add ingredients and packaging first.");
    }

    // Transform product_lca_materials into LCAInput format
    const lcaInputs: LCAInput[] = materials.map((material: any) => ({
      label: material.material_name || material.name,
      value: parseFloat(material.quantity) || 0,
      unit: material.unit || material.unit_name || 'kg',
      dqi: {
        reliability: 3,
        temporal: 3,
        geographical: 3,
        technological: 3,
        completeness: 3,
      },
      evidenceUrl: material.evidence_url,
      stage: material.material_type === 'ingredient' ? 'A1-A3 Product Stage' : 'A4-A5 Packaging',
      category: material.packaging_category || 'raw_materials',
    }));

    if (lcaInputs.length === 0) {
      throw new Error("No valid materials found for calculation");
    }

    const openLcaPayload = transformToOpenLcaProcess(
      lca.product_name,
      lca.functional_unit,
      lcaInputs
    );

    const { data: calcLog, error: logError } = await supabase
      .from("product_lca_calculation_logs")
      .insert({
        product_lca_id: payload.product_lca_id,
        status: "pending",
        request_payload: openLcaPayload,
        environment: executionEnvironment,
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
      .eq("id", payload.product_lca_id);

    let apiResponse: any;
    let apiSuccess = false;

    if (!openLcaApiUrl || !openLcaApiKey) {
      console.log("OpenLCA API not configured. Using stored impact factors from materials.");

      // Calculate impacts using stored material impact factors
      let totalClimate = 0;
      let totalWater = 0;
      let totalLand = 0;
      let totalWaste = 0;
      const materialBreakdown: any[] = [];
      let hasMissingImpacts = false;

      for (const material of materials) {
        const quantity = parseFloat(material.quantity) || 0;

        // Check if material has impact factors stored
        if (material.impact_climate !== null && material.impact_climate !== undefined) {
          const materialClimate = quantity * (material.impact_climate || 0);
          const materialWater = quantity * (material.impact_water || 0);
          const materialLand = quantity * (material.impact_land || 0);
          const materialWaste = quantity * (material.impact_waste || 0);

          totalClimate += materialClimate;
          totalWater += materialWater;
          totalLand += materialLand;
          totalWaste += materialWaste;

          materialBreakdown.push({
            name: material.name,
            quantity: quantity,
            unit: material.unit,
            climate: materialClimate,
            water: materialWater,
            land: materialLand,
            waste: materialWaste,
            source: material.impact_source || 'secondary_modelled'
          });

          console.log(`Material: ${material.name} - Climate: ${materialClimate.toFixed(4)} kg CO2e`);
        } else {
          console.warn(`Material ${material.name} missing impact factors - skipping`);
          hasMissingImpacts = true;
          materialBreakdown.push({
            name: material.name,
            quantity: quantity,
            unit: material.unit,
            climate: 0,
            water: 0,
            land: 0,
            waste: 0,
            source: 'missing',
            warning: 'No impact data available'
          });
        }
      }

      if (hasMissingImpacts) {
        console.warn("Some materials are missing impact factors. Results may be incomplete.");
      }

      // Build multi-capital impact response
      apiResponse = {
        results: [
          {
            impactCategory: "Climate Change",
            value: totalClimate,
            unit: "kg CO₂ eq",
            method: "Hybrid (Stored Material Factors)",
          },
          {
            impactCategory: "Water Depletion",
            value: totalWater,
            unit: "L",
            method: "Hybrid (Stored Material Factors)",
          },
          {
            impactCategory: "Land Use",
            value: totalLand,
            unit: "m²",
            method: "Hybrid (Stored Material Factors)",
          },
          {
            impactCategory: "Waste Generation",
            value: totalWaste,
            unit: "kg",
            method: "Hybrid (Stored Material Factors)",
          },
        ],
        materialBreakdown: materialBreakdown,
        calculationMethod: "material_impact_factors",
        dataQuality: hasMissingImpacts ? "incomplete" : "complete",
      };
      apiSuccess = true;

      console.log(`Total Climate Impact: ${totalClimate.toFixed(4)} kg CO2e`);
      console.log(`Total Water Impact: ${totalWater.toFixed(4)} L`);
      console.log(`Total Land Impact: ${totalLand.toFixed(4)} m²`);
      console.log(`Total Waste Impact: ${totalWaste.toFixed(4)} kg`);
    } else {
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (openLcaApiKey && openLcaApiKey.trim() !== "") {
        requestHeaders["Authorization"] = `Bearer ${openLcaApiKey}`;
      }

      const apiResponseRaw = await fetch(openLcaApiUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(openLcaPayload),
      });

      if (!apiResponseRaw.ok) {
        const errorText = await apiResponseRaw.text();
        throw new Error(`OpenLCA API error (${apiResponseRaw.status}): ${errorText}`);
      }

      apiResponse = await apiResponseRaw.json();
      apiSuccess = true;
    }

    if (!apiResponse.results || !Array.isArray(apiResponse.results)) {
      throw new Error("Invalid response format from OpenLCA API");
    }

    const resultsToInsert = apiResponse.results.map((result: any) => ({
      product_lca_id: payload.product_lca_id,
      impact_category: result.impactCategory,
      value: result.value,
      unit: result.unit,
      method: result.method || "ReCiPe 2016 Midpoint (H)",
    }));

    const { error: resultsError } = await supabase
      .from("product_lca_results")
      .insert(resultsToInsert);

    if (resultsError) {
      throw new Error(`Failed to save results: ${resultsError.message}`);
    }

    // Build aggregated impacts for product_lcas table
    const aggregatedImpacts = {
      climate_change_gwp100: apiResponse.results.find((r: any) => r.impactCategory === "Climate Change")?.value || 0,
      water_consumption: apiResponse.results.find((r: any) => r.impactCategory === "Water Depletion")?.value || 0,
      land_use: apiResponse.results.find((r: any) => r.impactCategory === "Land Use")?.value || 0,
      waste_generation: apiResponse.results.find((r: any) => r.impactCategory === "Waste Generation")?.value || 0,
    };

    await supabase
      .from("product_lcas")
      .update({
        status: "completed",
        aggregated_impacts: aggregatedImpacts,
        csrd_compliant: apiResponse.dataQuality === "complete",
      })
      .eq("id", payload.product_lca_id);

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      // Build impact_metrics JSONB for multi-capital storage
      const impactMetrics = {
        climate_change_gwp100: apiResponse.results.find((r: any) => r.impactCategory === "Climate Change")?.value || 0,
        water_consumption: apiResponse.results.find((r: any) => r.impactCategory === "Water Depletion")?.value || 0,
        land_use: apiResponse.results.find((r: any) => r.impactCategory === "Land Use")?.value || 0,
        waste_generation: apiResponse.results.find((r: any) => r.impactCategory === "Waste Generation")?.value || 0,
        material_breakdown: apiResponse.materialBreakdown || [],
      };

      await supabase
        .from("product_lca_calculation_logs")
        .update({
          status: "success",
          response_data: apiResponse,
          impact_metrics: impactMetrics,
          impact_assessment_method: apiResponse.results[0]?.method || "Hybrid (Stored Material Factors)",
          calculation_duration_ms: calculationDuration,
          environment: executionEnvironment,
          csrd_compliant: apiResponse.dataQuality === "complete",
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "LCA calculation completed successfully",
        results_count: resultsToInsert.length,
        calculation_duration_ms: calculationDuration,
        environment: executionEnvironment,
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
    console.error("Error in invoke-openlca:", error);

    const calculationDuration = Date.now() - startTime;
    const executionEnvironment = Deno.env.get("EXECUTION_ENVIRONMENT") || "unknown";

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
            environment: executionEnvironment,
          })
          .eq("id", logId);

        const reqClone = req.clone();
        const payload: InvokePayload = await reqClone.json();
        if (payload.product_lca_id) {
          await supabase
            .from("product_lcas")
            .update({ status: "failed" })
            .eq("id", payload.product_lca_id);
        }
      } catch (logError) {
        console.error("Failed to update error log:", logError);
      }
    }

    const statusCode = error.message === "Unauthorized" ? 401 : 
                       error.message.includes("OpenLCA API") ? 502 : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        environment: executionEnvironment,
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
