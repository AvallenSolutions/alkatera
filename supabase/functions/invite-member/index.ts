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

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildInviteEmail(inviteLink: string, organizationName: string, roleName: string, siteUrl: string): string {
  const roleDisplay = roleName === 'admin' ? 'Admin' : 'Team Member';
  const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've Been Invited to alka​tera</title>
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
                  <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">You've Been Invited!</h2>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">You've been invited to join <strong>${escapeHtml(organizationName)}</strong> on alka<strong>tera</strong> as a <strong>${roleDisplay}</strong>.</p>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">alka<strong>tera</strong> is a sustainability platform that helps organisations measure, manage, and report on their environmental impact.</p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${inviteLink}" style="display: inline-block; background-color: #ccff00; color: #0a0a0a; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Accept Invitation</a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">This invitation link will expire in 7 days.</p>

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

    // Use userClient for RPC calls that need user context (JWT claims)
    const { data: orgIdData, error: orgIdError } = await userClient.rpc(
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

    // Use userClient for role check (needs user context)
    const { data: userRole } = await userClient.rpc('get_my_organization_role', {
      org_id: organizationId
    });

    // get_my_organization_role returns 'company_admin' or 'company_user'
    if (!userRole || userRole !== 'company_admin') {
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

    // Check if user already exists in auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (existingUser) {
      // Check if already a member of this org
      const { data: existingMember } = await adminClient
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", existingUser.id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({
            error: "This user is already a member of your organization"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await adminClient
      .from("team_invitations")
      .select("id, expires_at")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
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
          .from("team_invitations")
          .update({ status: 'expired' })
          .eq("id", existingInvite.id);
      }
    }

    // Get organization name for the email
    const { data: orgData } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const organizationName = orgData?.name || "your organization";

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

    // Create invitation in team_invitations table (NOT in auth.users)
    const { data: invitation, error: inviteError } = await adminClient
      .from("team_invitations")
      .insert({
        organization_id: organizationId,
        email: normalizedEmail,
        role_id: roleData.id,
        invited_by: user.id,
      })
      .select("invitation_token")
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
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

    // Build the invite link to our custom acceptance page
    const inviteLink = `${siteUrl}/team-invite/${invitation.invitation_token}`;

    // Send branded email via Resend
    const emailHtml = buildInviteEmail(inviteLink, organizationName, mappedRole, siteUrl);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alkatera <sayhello@mail.alkatera.com>',
        to: normalizedEmail,
        subject: `You've been invited to join ${organizationName} on alkatera`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', error);

      // Delete the invitation if email failed
      await adminClient
        .from("team_invitations")
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

    console.log('Invitation email sent successfully to:', normalizedEmail);

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
