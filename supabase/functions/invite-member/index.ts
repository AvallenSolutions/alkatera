import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteMemberRequest {
  email: string;
  role: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = ['company_admin', 'company_user'];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const requestBody = await req.json();
    const { email, role }: InviteMemberRequest = requestBody;

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required and must be a string" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!role || !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({
          error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: orgIdData, error: orgIdError } = await adminClient.rpc(
      'get_current_organization_id'
    );

    if (orgIdError || !orgIdData) {
      console.error("Error getting organization ID:", orgIdError);
      return new Response(
        JSON.stringify({
          error: "You must be a member of an organization to invite others"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const organizationId = orgIdData;

    const { data: userRole } = await adminClient.rpc('get_my_organization_role', {
      org_id: organizationId
    });

    if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      return new Response(
        JSON.stringify({
          error: "Only organization owners and admins can invite members"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roleMapping: Record<string, string> = {
      'company_admin': 'admin',
      'company_user': 'member'
    };

    const mappedRole = roleMapping[role];

    const { data: roleData } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", mappedRole)
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Invalid role mapping" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          organization_id: organizationId,
          role_id: roleData.id,
          invited_by: user.id,
        },
        redirectTo: `${Deno.env.get("SITE_URL") || supabaseUrl}/dashboard`,
      }
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError);

      if (inviteError.message.includes("already") || inviteError.message.includes("exists")) {
        return new Response(
          JSON.stringify({
            error: "User already exists or is already a member of your organization"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: inviteError.message || "Failed to invite user"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation sent successfully",
        user: inviteData.user
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error in invite-member function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});