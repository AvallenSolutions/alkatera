import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OpenLcaProcess {
  id: string;
  name: string;
  category: string;
}

interface QueryRequest {
  searchTerm: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { searchTerm }: QueryRequest = await req.json();

    if (!searchTerm || searchTerm.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Search term must be at least 3 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    await supabase.rpc("cleanup_openlca_cache");

    const { data: cachedEntry, error: cacheError } = await supabase
      .from("openlca_process_cache")
      .select("results, created_at")
      .eq("search_term", normalizedSearchTerm)
      .maybeSingle();

    if (!cacheError && cachedEntry) {
      const cacheAge = new Date().getTime() - new Date(cachedEntry.created_at).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (cacheAge < twentyFourHours) {
        console.log(`Cache hit for: ${normalizedSearchTerm}`);
        return new Response(
          JSON.stringify({
            results: cachedEntry.results,
            cached: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log(`Cache miss for: ${normalizedSearchTerm}, querying OpenLCA API`);

    // Retrieve the OpenLCA API key from Supabase secrets
    const openLcaApiKey = Deno.env.get("OPENLCA_API_KEY");

    // TEMPORARY: Mock data mode (remove when OPENLCA_API_KEY is configured)
    if (!openLcaApiKey) {
      // Mock data structure matching OpenLCA API response format
      // These are static results used during development
      const mockResults: OpenLcaProcess[] = [
        {
          id: "a1b2-c3d4",
          name: "Apple, at farm gate",
          category: "Fruit/Agriculture",
        },
        {
          id: "e5f6-g7h8",
          name: "Glass bottle, 750ml, green",
          category: "Packaging/Containers",
        },
        {
          id: "i9j0-k1l2",
          name: "Transport, lorry >16t",
          category: "Logistics/Road",
        },
      ];

      const { error: insertError } = await supabase
        .from("openlca_process_cache")
        .insert({
          search_term: normalizedSearchTerm,
          results: mockResults,
        });

      if (insertError) {
        console.error("Failed to cache mock results:", insertError);
      }

      return new Response(
        JSON.stringify({
          results: mockResults,
          cached: false,
          mock: true,
          message: "Using mock data - OpenLCA API key not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // REAL API MODE: Query the OpenLCA database
    // This code executes when OPENLCA_API_KEY is configured in Supabase secrets
    console.log(`Querying OpenLCA API for: ${searchTerm}`);

    const openLcaResponse = await fetch(
      `https://api.openlca.org/search?q=${encodeURIComponent(searchTerm)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${openLcaApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!openLcaResponse.ok) {
      throw new Error(`OpenLCA API error: ${openLcaResponse.status} ${openLcaResponse.statusText}`);
    }

    const openLcaData = await openLcaResponse.json();

    const sanitizedResults: OpenLcaProcess[] = (openLcaData.processes || [])
      .slice(0, 20)
      .map((process: any) => ({
        id: process.id || process["@id"] || `unknown-${Date.now()}`,
        name: process.name || "Unnamed Process",
        category: process.category || process.categoryPath || "Uncategorised",
      }));

    const { error: insertError } = await supabase
      .from("openlca_process_cache")
      .insert({
        search_term: normalizedSearchTerm,
        results: sanitizedResults,
      });

    if (insertError) {
      console.error("Failed to cache results:", insertError);
    }

    return new Response(
      JSON.stringify({
        results: sanitizedResults,
        cached: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in query-openlca-processes:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
