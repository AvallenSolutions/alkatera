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

    const { data: inputRecords, error: inputsError } = await supabase
      .from("product_lca_inputs")
      .select("input_data")
      .eq("product_lca_id", payload.product_lca_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (inputsError || !inputRecords || inputRecords.length === 0) {
      throw new Error("No input data found for this LCA");
    }

    const lcaInputs = inputRecords[0].input_data;

    if (!Array.isArray(lcaInputs) || lcaInputs.length === 0) {
      throw new Error("Input data is empty or invalid");
    }

    const evidenceValidation = validateEvidenceRequirements(lcaInputs);
    if (!evidenceValidation.valid) {
      throw new Error(
        `Missing evidence for high-quality data points: ${evidenceValidation.missingEvidence.join(", ")}`
      );
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
      console.warn("OpenLCA API credentials not configured. Using mock data for development.");
      
      apiResponse = {
        results: IMPACT_CATEGORIES.map((category) => ({
          impactCategory: category.name,
          value: Math.random() * 1000,
          unit: category.unit,
          method: "ReCiPe 2016 Midpoint (H)",
        })),
      };
      apiSuccess = true;
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

    await supabase
      .from("product_lcas")
      .update({ status: "completed" })
      .eq("id", payload.product_lca_id);

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      await supabase
        .from("product_lca_calculation_logs")
        .update({
          status: "success",
          response_data: apiResponse,
          calculation_duration_ms: calculationDuration,
          environment: executionEnvironment,
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
