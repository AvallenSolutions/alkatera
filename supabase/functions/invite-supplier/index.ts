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

    const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';
    const emailSubject = `Invitation to join ${product.name} supply chain on alkatera`;
    const supplierDisplayName = supplierName || 'Supplier';

    const emailHtml = `
      <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
        <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
          <img src="${logoUrl}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
          <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Supplier Invitation</h1>
        </div>
        <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
          Dear ${supplierDisplayName},
        </p>
        <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
          You have been invited to join the alka<strong style="color: #fff;">tera</strong> platform to provide verified product data for <strong style="color: #fff;">${materialName}</strong>.
        </p>
        ${personalMessage ? `<div style="margin: 20px 0; padding: 16px; border-left: 2px solid #ccff00; background: #111;"><p style="color: #ccc; font-size: 14px; line-height: 1.8; margin: 0;">${personalMessage}</p></div>` : ''}
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; width: 100px;">Product</td>
            <td style="padding: 10px 0; color: #fff; font-size: 14px;">${product.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Material</td>
            <td style="padding: 10px 0; color: #fff; font-size: 14px;">${materialName} (${materialType})</td>
          </tr>
        </table>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${invitationUrl}" style="display: inline-block; background: #ccff00; color: #000; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none;">Complete Your Profile</a>
        </div>
        <p style="color: #666; font-size: 12px; line-height: 1.6;">
          This invitation will expire in 30 days. If you have any questions, please contact <a href="mailto:hello@alkatera.com" style="color: #ccff00; text-decoration: none;">hello@alkatera.com</a>
        </p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
          The alka<strong>tera</strong> Team
        </div>
      </div>
    `;

    // Send invitation email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendApiKey) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "alkatera <sayhello@mail.alkatera.com>",
            to: [supplierEmail],
            cc: ["sayhello@mail.alkatera.com"],
            reply_to: "hello@alkatera.com",
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendResponse.ok) {
          const resendData = await resendResponse.json();
          console.log("Supplier invitation email sent successfully:", resendData);
          emailSent = true;
        } else {
          const errorText = await resendResponse.text();
          console.error("Resend API error:", resendResponse.status, errorText);
        }
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured — email not sent");
    }

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
        email_sent: emailSent,
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
