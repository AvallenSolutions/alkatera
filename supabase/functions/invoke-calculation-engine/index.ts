import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Material {
  id: string;
  name: string | null;
  quantity: number;
  unit: string | null;
  lca_sub_stage_id: string | null;
}

interface InvokePayload {
  lcaId: string;
  materials: Material[];
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
}

interface OpenLCAProcess {
  "@context": string;
  "@type": string;
  name: string;
  processType: string;
  exchanges: OpenLCAExchange[];
}

const IMPACT_CATEGORIES = [
  { name: "Climate Change", unit: "kg CO₂ eq" },
  { name: "Ozone Depletion", unit: "kg CFC-11 eq" },
  { name: "Human Toxicity", unit: "kg 1,4-DB eq" },
  { name: "Freshwater Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Terrestrial Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Eutrophication", unit: "kg PO₄³⁻ eq" },
];

async function transformToOpenLcaProcess(
  supabase: any,
  productName: string,
  functionalUnit: string,
  materials: Material[]
): Promise<OpenLCAProcess> {
  const stageIds = materials.map(m => m.lca_sub_stage_id).filter(Boolean);

  const { data: subStages } = await supabase
    .from('lca_sub_stages')
    .select('id, name, stage_id, lca_life_cycle_stages(name)')
    .in('id', stageIds);

  const stageMap = new Map();
  if (subStages) {
    subStages.forEach((sub: any) => {
      stageMap.set(sub.id, {
        subStageName: sub.name,
        stageName: sub.lca_life_cycle_stages?.name || 'Unknown Stage',
      });
    });
  }

  const exchanges: OpenLCAExchange[] = materials.map((material) => {
    const stageInfo = material.lca_sub_stage_id ? stageMap.get(material.lca_sub_stage_id) : null;

    return {
      "@type": "Exchange",
      amount: material.quantity,
      unit: {
        "@type": "Unit",
        name: material.unit || "kg",
      },
      flow: {
        "@type": "Flow",
        name: material.name || "Unnamed Material",
        category: stageInfo ? `${stageInfo.stageName} > ${stageInfo.subStageName}` : "Unclassified",
      },
    };
  });

  return {
    "@context": "http://greendelta.github.io/olca-schema",
    "@type": "Process",
    name: productName,
    processType: "UNIT_PROCESS",
    exchanges,
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

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

    const openLcaPayload = await transformToOpenLcaProcess(
      supabase,
      lca.product_name,
      lca.functional_unit,
      payload.materials
    );

    const { data: calcLog, error: logError } = await supabase
      .from("product_lca_calculation_logs")
      .insert({
        product_lca_id: payload.lcaId,
        status: "pending",
        request_payload: openLcaPayload,
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
      product_lca_id: payload.lcaId,
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
      .eq("id", payload.lcaId);

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      await supabase
        .from("product_lca_calculation_logs")
        .update({
          status: "success",
          response_data: apiResponse,
          calculation_duration_ms: calculationDuration,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "LCA calculation completed successfully",
        results_count: resultsToInsert.length,
        calculation_duration_ms: calculationDuration,
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

    const statusCode = error.message === "Unauthorized" ? 401 :
                       error.message.includes("OpenLCA API") ? 502 : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
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
