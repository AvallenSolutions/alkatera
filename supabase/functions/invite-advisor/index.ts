import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteAdvisorRequest {
  email: string;
  accessNotes?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildAdvisorInviteEmail(inviteLink: string, organizationName: string, accessNotes: string | null, siteUrl: string): string {
  const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Advisor Invitation - alkatera</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                  <img src="${logoUrl}" alt="alkatera" width="180" height="auto" style="display: block; margin: 0 auto 12px auto;" />
                  <p style="margin: 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Sustainability, Distilled</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
                  <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Advisor Invitation</h2>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">You've been invited to become an advisor for <strong>${escapeHtml(organizationName)}</strong> on alka<strong>tera</strong>.</p>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">As an advisor, you'll have read-only access to their sustainability data to help them measure, manage, and improve their environmental impact.</p>

                  ${accessNotes ? `
                  <div style="margin: 20px 0; padding: 16px; border-left: 4px solid #ccff00; background-color: #f9f9f9; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px; font-style: italic;">"${escapeHtml(accessNotes)}"</p>
                    <p style="margin: 8px 0 0 0; color: #888; font-size: 12px;">— Message from the organisation</p>
                  </div>
                  ` : ''}

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${inviteLink}" style="display: inline-block; background-color: #ccff00; color: #0a0a0a; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Accept Invitation</a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">This invitation link will expire in 30 days.</p>

                  <!-- Divider -->
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

                  <p style="margin: 0; color: #888; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 12px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 6px;">${inviteLink}</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a1a; padding: 30px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #888; font-size: 14px;">alka<strong style="color: #888;">tera</strong> - Sustainability Platform</p>
                  <p style="margin: 0; color: #666; font-size: 12px;">
                    <a href="${siteUrl}" style="color: #ccff00; text-decoration: none;">www.alkatera.com</a>
                  </p>
                  <p style="margin: 15px 0 0 0; color: #555; font-size: 11px;">
                    If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const authHeader = req.headers.get("Authorization");
    const siteUrl = (Deno.env.get("SITE_URL") || "https://alkatera.com").replace(/\/$/, "");

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

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
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
    const { email, accessNotes }: InviteAdvisorRequest = requestBody;

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required and must be a string" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
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

    // Get the user's current organization ID
    const { data: orgIdData, error: orgIdError } = await userClient.rpc(
      'get_current_organization_id'
    );

    if (orgIdError || !orgIdData) {
      console.error("Error getting organization ID:", orgIdError);
      return new Response(
        JSON.stringify({
          error: "You must be a member of an organization to invite advisors"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const organizationId = orgIdData;

    // Check if user has admin privileges
    const { data: userRole } = await userClient.rpc('get_my_organization_role', {
      org_id: organizationId
    });

    if (!userRole || userRole !== 'company_admin') {
      return new Response(
        JSON.stringify({
          error: "Only organization owners and admins can invite advisors"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await adminClient
      .from("advisor_invitations")
      .select("id, expires_at, status")
      .eq("organization_id", organizationId)
      .eq("advisor_email", normalizedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      // Check if expired
      if (new Date(existingInvite.expires_at) > new Date()) {
        return new Response(
          JSON.stringify({
            error: "An invitation has already been sent to this email address"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Mark old invitation as expired
        await adminClient
          .from("advisor_invitations")
          .update({ status: 'expired' })
          .eq("id", existingInvite.id);
      }
    }

    // Check if advisor already has active access
    const { data: existingAccess } = await adminClient
      .from("advisor_organization_access")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single();

    // Get the user ID for this email if they exist
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (existingUser && existingAccess) {
      // Check if this specific user already has access
      const { data: userAccess } = await adminClient
        .from("advisor_organization_access")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("advisor_user_id", existingUser.id)
        .eq("is_active", true)
        .single();

      if (userAccess) {
        return new Response(
          JSON.stringify({
            error: "This user already has advisor access to your organization"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get organization name for the email
    const { data: orgData } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const organizationName = orgData?.name || "your organization";

    // Create the invitation
    const { data: invitation, error: inviteError } = await adminClient
      .from("advisor_invitations")
      .insert({
        organization_id: organizationId,
        advisor_email: normalizedEmail,
        invited_by: user.id,
        access_notes: accessNotes?.trim() || null,
      })
      .select("invitation_token")
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      if (inviteError.code === '23505') {
        return new Response(
          JSON.stringify({
            error: "An invitation has already been sent to this email address"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          error: "Failed to create invitation"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build the invite link
    const inviteLink = `${siteUrl}/advisor-invite/${invitation.invitation_token}`;

    // Send branded email via Resend
    const emailHtml = buildAdvisorInviteEmail(inviteLink, organizationName, accessNotes?.trim() || null, siteUrl);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alkatera <sayhello@mail.alkatera.com>',
        to: normalizedEmail,
        subject: `You've been invited to advise ${organizationName} on alkatera`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', error);

      // Delete the invitation if email failed
      await adminClient
        .from("advisor_invitations")
        .delete()
        .eq("invitation_token", invitation.invitation_token);

      return new Response(
        JSON.stringify({
          error: "Failed to send invitation email"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Advisor invitation email sent successfully to:', normalizedEmail);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error in invite-advisor function:", error);
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
