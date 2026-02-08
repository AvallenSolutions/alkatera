// Escalate Feedback Tickets Edge Function
// This function checks for old unresolved tickets and escalates their priority
// Should be triggered daily via scheduler (GitHub Actions, cron, etc.)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EscalationResult {
  escalated_count: number;
  escalated_tickets: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    // Call the escalation function
    const { data, error } = await adminClient.rpc("escalate_old_tickets");

    if (error) {
      console.error("Escalation error:", error);
      throw error;
    }

    const result = data?.[0] as EscalationResult | undefined;
    const escalatedCount = result?.escalated_count || 0;
    const escalatedTickets = result?.escalated_tickets || [];
    if (escalatedCount > 0) {
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Escalation complete. ${escalatedCount} tickets escalated.`,
        escalated_count: escalatedCount,
        escalated_tickets: escalatedTickets,
        timestamp: new Date().toISOString(),
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
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
