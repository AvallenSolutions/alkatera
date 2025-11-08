import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteMemberRequest {
  organization_id: string;
  invitee_email: string;
  role: 'company_admin' | 'company_user';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
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

    const { organization_id, invitee_email, role }: InviteMemberRequest = await req.json();

    if (!organization_id || !invitee_email || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: currentUserMembership } = await supabase
      .from("organization_members")
      .select("role_id, roles(name)")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (!currentUserMembership) {
      return new Response(
        JSON.stringify({ error: "You are not a member of this organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userRole = (currentUserMembership as any).roles?.name;
    if (userRole !== 'owner' && userRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: "You must be an admin to invite members" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: inviteeProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", invitee_email.toLowerCase())
      .single();

    if (!inviteeProfile) {
      return new Response(
        JSON.stringify({ error: "User not found. Please ask them to create an account first." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", inviteeProfile.id)
      .single();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: "User is already a member of this organization" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roleMapping = {
      'company_admin': 'admin',
      'company_user': 'member'
    };

    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleMapping[role])
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Invalid role specified" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: memberData, error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organization_id,
        user_id: inviteeProfile.id,
        role_id: roleData.id,
        invited_by: user.id,
      })
      .select(`
        id,
        organization_id,
        user_id,
        role_id,
        profiles (email, full_name),
        roles (name)
      `)
      .single();

    if (memberError) {
      console.error("Error creating organization member:", memberError);
      return new Response(
        JSON.stringify({ error: "Failed to add member to organization" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ member: memberData }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});