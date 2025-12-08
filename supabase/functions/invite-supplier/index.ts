import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteSupplierRequest {
  productId: number;
  materialId: string;
  materialName: string;
  materialType: 'ingredient' | 'packaging';
  supplierEmail: string;
  supplierName?: string;
  personalMessage?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const siteUrl = Deno.env.get("SITE_URL") || supabaseUrl;
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
    const {
      productId,
      materialId,
      materialName,
      materialType,
      supplierEmail,
      supplierName,
      personalMessage,
    }: InviteSupplierRequest = requestBody;

    if (!productId || !materialId || !materialName || !materialType || !supplierEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!emailRegex.test(supplierEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!['ingredient', 'packaging'].includes(materialType)) {
      return new Response(
        JSON.stringify({ error: "Material type must be either 'ingredient' or 'packaging'" }),
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
          error: "You must be a member of an organisation to invite suppliers"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const organizationId = orgIdData;

    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, name")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingInvitation } = await adminClient
      .from("supplier_invitations")
      .select("id, status")
      .eq("material_id", materialId)
      .eq("supplier_email", supplierEmail.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({
          error: "An invitation to this supplier for this material is already pending"
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invitation, error: invitationError } = await adminClient
      .from("supplier_invitations")
      .insert({
        organization_id: organizationId,
        product_id: productId,
        material_id: materialId,
        material_name: materialName,
        material_type: materialType,
        supplier_email: supplierEmail.toLowerCase(),
        supplier_name: supplierName || null,
        invited_by: user.id,
        personal_message: personalMessage || null,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      return new Response(
        JSON.stringify({
          error: invitationError.message || "Failed to create invitation"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const invitationUrl = `${siteUrl}/supplier-onboarding?token=${invitation.invitation_token}`;

    const emailSubject = `Invitation to join ${product.name} supply chain on Alkatera`;
    const emailBody = `
Dear ${supplierName || 'Supplier'},

You have been invited to join the Alkatera platform to provide verified product data for ${materialName}.

${personalMessage ? `\n${personalMessage}\n` : ''}
Product: ${product.name}
Material: ${materialName} (${materialType})

Please click the link below to complete your supplier profile and upload your product details:
${invitationUrl}

This invitation will expire in 30 days.

If you have any questions, please contact hello@alkatera.com

Best regards,
The Alkatera Team
    `.trim();

    console.log("=== SUPPLIER INVITATION EMAIL ===");
    console.log("To:", supplierEmail);
    console.log("CC:", "hello@alkatera.com");
    console.log("Subject:", emailSubject);
    console.log("Body:", emailBody);
    console.log("Invitation URL:", invitationUrl);
    console.log("==================================\n");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation created successfully",
        invitation: {
          id: invitation.id,
          supplier_email: invitation.supplier_email,
          invitation_url: invitationUrl,
          expires_at: invitation.expires_at,
        },
        note: "Email sending integration pending - invitation details logged to console"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error in invite-supplier function:", error);
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
