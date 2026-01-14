// Send Subscription Email Edge Function
// This function sends email notifications for subscription events

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type EmailEventType =
  | "plan_upgraded"
  | "plan_downgraded"
  | "grace_period_started"
  | "grace_period_warning"
  | "grace_period_expired"
  | "payment_failed"
  | "payment_succeeded"
  | "payment_method_updated"
  | "subscription_cancelled"
  | "subscription_reactivated";

interface EmailRequest {
  organizationId: string;
  eventType: EmailEventType;
  metadata?: Record<string, any>;
}

interface OrganizationData {
  id: string;
  name: string;
  billing_email: string;
  subscription_tier: string;
  grace_period_end?: string;
  grace_period_resource_type?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "https://alkatera.com";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured - emails will be skipped");
      return new Response(
        JSON.stringify({ success: true, message: "Email notifications disabled - no API key" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EmailRequest = await req.json();
    const { organizationId, eventType, metadata = {} } = body;

    if (!organizationId || !eventType) {
      throw new Error("organizationId and eventType are required");
    }

    // Use service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch organization data
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .select("id, name, billing_email, subscription_tier, grace_period_end, grace_period_resource_type")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      throw new Error("Organization not found");
    }

    if (!org.billing_email) {
      console.log("No billing email set for organization, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No billing email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const emailContent = buildEmailContent(org, eventType, metadata, siteUrl);

    // Send email via Resend
    const emailResult = await sendViaResend(resendApiKey, {
      to: org.billing_email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log(`Subscription email sent for ${eventType}:`, emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        emailId: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Subscription email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTierName(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatResourceType(type: string): string {
  const labels: Record<string, string> = {
    facilities: "Facilities",
    products: "Products",
    team_members: "Team Members",
    lcas: "LCAs",
    suppliers: "Suppliers",
  };
  return labels[type] || type;
}

function buildEmailContent(
  org: OrganizationData,
  eventType: EmailEventType,
  metadata: Record<string, any>,
  siteUrl: string
): { subject: string; html: string } {
  const settingsUrl = `${siteUrl}/settings?tab=billing`;
  const safeName = escapeHtml(org.name);

  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #10B981, #14B8A6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .header-warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
      .header-danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
      .header-success { background: linear-gradient(135deg, #22c55e, #16a34a); }
      .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
      .button { display: inline-block; background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0; }
      .button-warning { background: #f59e0b; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; }
      .badge-green { background: #d1fae5; color: #047857; }
      .badge-amber { background: #fef3c7; color: #b45309; }
      .badge-red { background: #fee2e2; color: #b91c1c; }
      .info-box { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
      .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
      .danger-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    </style>
  `;

  switch (eventType) {
    case "plan_upgraded":
      return {
        subject: `Plan Upgraded to ${formatTierName(metadata.newTier)} - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-success">
              <h2 style="margin: 0;">🎉 Plan Upgraded Successfully</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Great news! Your subscription has been upgraded.</p>
              <div style="display: flex; align-items: center; gap: 12px; margin: 20px 0;">
                <span class="badge badge-amber">${formatTierName(metadata.previousTier || 'seed')}</span>
                <span style="font-size: 20px;">→</span>
                <span class="badge badge-green">${formatTierName(metadata.newTier)}</span>
              </div>
              <p>You now have access to increased limits and new features. Here's what's new:</p>
              <ul>
                <li>Increased product and LCA limits</li>
                <li>More team members and facilities</li>
                <li>Enhanced reporting capabilities</li>
              </ul>
              <a href="${settingsUrl}" class="button">View Your Subscription</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "plan_downgraded":
      return {
        subject: `Plan Changed to ${formatTierName(metadata.newTier)} - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Plan Changed</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your subscription has been changed.</p>
              <div style="display: flex; align-items: center; gap: 12px; margin: 20px 0;">
                <span class="badge badge-green">${formatTierName(metadata.previousTier || 'canopy')}</span>
                <span style="font-size: 20px;">→</span>
                <span class="badge badge-amber">${formatTierName(metadata.newTier)}</span>
              </div>
              ${metadata.gracePeriod ? `
                <div class="warning-box">
                  <strong>⚠️ Grace Period Active</strong>
                  <p style="margin: 8px 0 0 0;">Your current usage exceeds your new plan limits. You have <strong>7 days</strong> to reduce your usage, or the oldest items will be automatically removed.</p>
                </div>
              ` : ''}
              <p>Your new plan limits are now in effect. Please review your subscription details.</p>
              <a href="${settingsUrl}" class="button">View Your Subscription</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_started":
      return {
        subject: `Action Required: Reduce Your ${formatResourceType(org.grace_period_resource_type || 'items')} - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-warning">
              <h2 style="margin: 0;">⚠️ Grace Period Started</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your recent plan change means your current usage exceeds your new plan limits.</p>
              <div class="warning-box">
                <strong>You have 7 days to take action</strong>
                <p style="margin: 8px 0 0 0;">
                  <strong>${formatResourceType(org.grace_period_resource_type || 'items')}:</strong>
                  ${metadata.currentUsage || 'N/A'} / ${metadata.newLimit || 'N/A'}
                  (${metadata.excessCount || 0} over limit)
                </p>
              </div>
              <p>Please reduce your ${formatResourceType(org.grace_period_resource_type || 'items').toLowerCase()} to fit within your plan limits. If no action is taken, the oldest items will be automatically removed after the grace period ends.</p>
              <p><strong>Grace period ends:</strong> ${org.grace_period_end ? new Date(org.grace_period_end).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '7 days from now'}</p>
              <a href="${settingsUrl}" class="button button-warning">Manage Your Usage</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_warning":
      return {
        subject: `⚠️ 3 Days Left: Reduce Your ${formatResourceType(org.grace_period_resource_type || 'items')} - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-warning">
              <h2 style="margin: 0;">⏰ Only 3 Days Left</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <div class="danger-box">
                <strong>Your grace period ends in 3 days!</strong>
                <p style="margin: 8px 0 0 0;">After this time, ${metadata.itemsToDelete || 'excess items'} will be automatically removed from your account.</p>
              </div>
              <p>
                <strong>${formatResourceType(org.grace_period_resource_type || 'items')}:</strong>
                ${metadata.currentUsage || 'N/A'} / ${metadata.newLimit || 'N/A'}
              </p>
              <p>To avoid losing data, please remove the excess ${formatResourceType(org.grace_period_resource_type || 'items').toLowerCase()} before the grace period ends.</p>
              <a href="${settingsUrl}" class="button button-warning">Take Action Now</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_expired":
      return {
        subject: `Items Removed: Grace Period Expired - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-danger">
              <h2 style="margin: 0;">Grace Period Expired</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your grace period has expired and the following items have been automatically removed to bring your account within your plan limits:</p>
              <div class="info-box">
                <strong>${metadata.itemsDeleted || 0} ${formatResourceType(metadata.resourceType || 'items')}</strong> removed
              </div>
              <p>The oldest items were selected for removal. If you need to recover any data or upgrade your plan, please contact our support team.</p>
              <a href="${settingsUrl}" class="button">View Your Account</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_failed":
      return {
        subject: `⚠️ Payment Failed - Action Required - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-danger">
              <h2 style="margin: 0;">Payment Failed</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>We were unable to process your payment. Your subscription has been temporarily suspended.</p>
              <div class="danger-box">
                <strong>Please update your payment method</strong>
                <p style="margin: 8px 0 0 0;">To continue using AlkaTera without interruption, please update your payment information.</p>
              </div>
              <a href="${settingsUrl}" class="button">Update Payment Method</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">If you believe this is an error, please contact your bank or our support team.</p>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_succeeded":
      return {
        subject: `Payment Received - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-success">
              <h2 style="margin: 0;">✓ Payment Successful</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Thank you! Your payment has been processed successfully.</p>
              ${metadata.amount ? `
                <div class="info-box">
                  <strong>Amount:</strong> £${(metadata.amount / 100).toFixed(2)}
                </div>
              ` : ''}
              ${metadata.wasReactivated ? `
                <p>Your subscription has been reactivated and all features are now available again.</p>
              ` : ''}
              <a href="${settingsUrl}" class="button">View Billing Details</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_method_updated":
      return {
        subject: `Payment Method Updated - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-success">
              <h2 style="margin: 0;">Payment Method Updated</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your payment method has been successfully updated.</p>
              ${metadata.cardLast4 ? `
                <div class="info-box">
                  <strong>New card ending in:</strong> •••• ${metadata.cardLast4}
                </div>
              ` : ''}
              <p>Your future payments will be charged to this payment method.</p>
              <a href="${settingsUrl}" class="button">View Billing Details</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "subscription_cancelled":
      return {
        subject: `Subscription Cancelled - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Subscription Cancelled</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your AlkaTera subscription has been cancelled.</p>
              <p>Your account has been downgraded to the Seed (free) tier. You still have access to basic features, but some advanced functionality may be limited.</p>
              <p>We're sorry to see you go! If you change your mind, you can upgrade again at any time.</p>
              <a href="${settingsUrl}" class="button">Resubscribe</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "subscription_reactivated":
      return {
        subject: `Welcome Back! Subscription Reactivated - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-success">
              <h2 style="margin: 0;">🎉 Welcome Back!</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Great news! Your AlkaTera subscription has been reactivated.</p>
              <p>All your features and data are available again. Thank you for continuing to use AlkaTera for your sustainability tracking.</p>
              <a href="${siteUrl}/dashboard" class="button">Go to Dashboard</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: `Subscription Update - AlkaTera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Subscription Update</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>There's been an update to your AlkaTera subscription.</p>
              <a href="${settingsUrl}" class="button">View Details</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };
  }
}

async function sendViaResend(
  apiKey: string,
  email: { to: string; subject: string; html: string }
): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AlkaTera <billing@alkatera.com>",
      to: email.to,
      subject: email.subject,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}
