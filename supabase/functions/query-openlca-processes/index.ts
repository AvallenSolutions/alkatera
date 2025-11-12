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

/**
 * Environment-Aware OpenLCA Proxy
 *
 * This Edge Function acts as a secure proxy to the OpenLCA database.
 * It supports two execution modes:
 *
 * 1. LOCAL MODE (Development):
 *    - Proxies requests to http://localhost:8080 (OpenLCA desktop IPC server)
 *    - Requires developer to have OpenLCA desktop app running with IPC enabled
 *
 * 2. PRODUCTION MODE (Deployed):
 *    - Proxies requests to containerized OpenLCA headless server
 *    - URL configured via PRODUCTION_OPENLCA_URL environment variable
 *
 * The function determines mode via ENV_MODE environment variable.
 */

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

    // Authentication: Verify user is authenticated
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

    // Parse request payload
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

    // Cleanup old cache entries (older than 24 hours)
    await supabase.rpc("cleanup_openlca_cache");

    // Check cache for existing results
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

    console.log(`Cache miss for: ${normalizedSearchTerm}, querying OpenLCA`);

    // ========================================================================
    // ENVIRONMENT-AWARE PROXY LOGIC
    // ========================================================================

    // Determine execution environment
    const envMode = Deno.env.get("ENV_MODE") || "local";
    let openLcaHost: string;

    if (envMode === "local") {
      // LOCAL MODE: Proxy to local OpenLCA desktop IPC server
      // Use Docker's special DNS for accessing host machine from within container
      openLcaHost = "http://host.docker.internal:8080";
      console.log(`[LOCAL MODE] Proxying to OpenLCA desktop at ${openLcaHost}`);
    } else if (envMode === "production") {
      // PRODUCTION MODE: Proxy to containerized headless server
      const productionUrl = Deno.env.get("PRODUCTION_OPENLCA_URL");
      if (!productionUrl) {
        throw new Error("PRODUCTION_OPENLCA_URL not configured");
      }
      openLcaHost = productionUrl;
      console.log(`[PRODUCTION MODE] Proxying to headless server at ${openLcaHost}`);
    } else {
      throw new Error(`Invalid ENV_MODE: ${envMode}. Must be 'local' or 'production'`);
    }

    // ========================================================================
    // PROXY REQUEST TO OPENLCA
    // ========================================================================

    // Construct the search endpoint URL
    // OpenLCA IPC server search endpoint: GET /search?q=<term>
    const openLcaUrl = `${openLcaHost}/search?q=${encodeURIComponent(searchTerm)}`;

    console.log(`Fetching from OpenLCA: ${openLcaUrl}`);

    let openLcaResponse: Response;

    try {
      openLcaResponse = await fetch(openLcaUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        // Timeout for local connections
        signal: AbortSignal.timeout(envMode === "local" ? 5000 : 30000),
      });
    } catch (fetchError: any) {
      // Handle connection errors (e.g., OpenLCA not running locally)
      console.error(`Failed to connect to OpenLCA at ${openLcaHost}:`, fetchError);

      if (envMode === "local") {
        return new Response(
          JSON.stringify({
            error: "Cannot connect to local OpenLCA server",
            details: "Please ensure OpenLCA desktop app is running with IPC server enabled on port 8080",
            hint: "Start OpenLCA → Tools → Developer Tools → Start IPC Server",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        throw new Error(`OpenLCA production server unavailable: ${fetchError.message}`);
      }
    }

    if (!openLcaResponse.ok) {
      console.error(`OpenLCA returned error: ${openLcaResponse.status} ${openLcaResponse.statusText}`);
      throw new Error(`OpenLCA API error: ${openLcaResponse.status} ${openLcaResponse.statusText}`);
    }

    // Parse OpenLCA response
    const openLcaData = await openLcaResponse.json();

    // ========================================================================
    // SANITIZE AND TRANSFORM RESPONSE
    // ========================================================================

    // OpenLCA IPC server returns array of process objects
    // Expected structure: [{ "@id": "...", "name": "...", "categoryPath": "..." }]
    const sanitizedResults: OpenLcaProcess[] = (openLcaData || [])
      .slice(0, 50)  // Limit to 50 results
      .map((process: any) => ({
        id: process["@id"] || process.id || `unknown-${Date.now()}`,
        name: process.name || "Unnamed Process",
        category: process.categoryPath || process.category || "Uncategorised",
      }));

    console.log(`Retrieved ${sanitizedResults.length} processes from OpenLCA`);

    // ========================================================================
    // CACHE THE RESULTS
    // ========================================================================

    const { error: insertError } = await supabase
      .from("openlca_process_cache")
      .insert({
        search_term: normalizedSearchTerm,
        results: sanitizedResults,
      });

    if (insertError) {
      console.error("Failed to cache results:", insertError);
      // Non-fatal: continue without caching
    }

    // ========================================================================
    // RETURN RESPONSE TO CLIENT
    // ========================================================================

    return new Response(
      JSON.stringify({
        results: sanitizedResults,
        cached: false,
        environment: envMode,
        host: openLcaHost,
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
