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
  | "subscription_reactivated"
  | "subscription_suspended"
  | "annual_renewal_reminder"
  | "trial_started"
  | "trial_ending_soon"
  | "trial_ended";

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

// alkatera brand assets for fully-branded emails (dark theme + neon lime #ccff00).
const BRAND_LOGO_URL =
  "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png";
const BRAND_LIME = "#ccff00";
const BRAND_BG = "#0a0d08";
const BRAND_PANEL = "#14181a";
const BRAND_BORDER = "#262b2e";

/**
 * Render a fully alkatera-branded email: dark canvas, logo lockup, neon-lime accents,
 * the alka**tera** wordmark, and a lime primary button. Table-based + inline styles so it
 * survives Outlook/Gmail. `accent` tints the heading rule (lime for good news, amber for
 * urgency); the primary button stays brand lime.
 */
function renderBrandedEmail(opts: {
  preheader: string;
  title: string;
  accent: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryHtml?: string;
}): string {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:${BRAND_BG};">
      <tr><td align="center" style="padding:32px 16px;background:${BRAND_BG};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
          <tr><td align="center" style="padding:4px 0 26px;">
            <img src="${BRAND_LOGO_URL}" width="150" alt="alkatera" style="display:block;width:150px;max-width:60%;height:auto;" />
          </td></tr>
          <tr><td style="background:${BRAND_PANEL};border:1px solid ${BRAND_BORDER};border-radius:16px;padding:34px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:25px;line-height:1.25;color:#ffffff;">
              <span style="display:inline-block;border-bottom:3px solid ${opts.accent};padding-bottom:5px;">${opts.title}</span>
            </h1>
            <div style="font-size:15px;line-height:1.7;color:#c7ccd1;">${opts.bodyHtml}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 2px;"><tr>
              <td style="border-radius:10px;background:${BRAND_LIME};">
                <a href="${opts.ctaHref}" style="display:inline-block;padding:14px 30px;font-size:14px;font-weight:bold;color:#0a0d08;text-decoration:none;border-radius:10px;">${opts.ctaLabel}</a>
              </td>
            </tr></table>
            ${opts.secondaryHtml || ''}
          </td></tr>
          <tr><td align="center" style="padding:26px 8px 4px;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0;font-size:13px;color:#8b9197;">alka<strong style="color:${BRAND_LIME};font-weight:bold;">tera</strong> &middot; Sustainability platform for the drinks industry</p>
            <p style="margin:9px 0 0;font-size:11px;color:#565b60;">You're receiving this because you started a free trial with alkatera.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
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
        subject: `Plan Upgraded to ${formatTierName(metadata.newTier)} - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "plan_downgraded":
      return {
        subject: `Plan Changed to ${formatTierName(metadata.newTier)} - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_started":
      return {
        subject: `Action Required: Reduce Your ${formatResourceType(org.grace_period_resource_type || 'items')} - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_warning":
      return {
        subject: `⚠️ 3 Days Left: Reduce Your ${formatResourceType(org.grace_period_resource_type || 'items')} - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "grace_period_expired":
      return {
        subject: `Items Removed: Grace Period Expired - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_failed":
      return {
        subject: `⚠️ Payment Failed - Action Required - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-danger">
              <h2 style="margin: 0;">Payment Failed</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>We were unable to process your subscription payment.</p>
              <div class="danger-box">
                <strong>You have 7 days to update your payment method</strong>
                <p style="margin: 8px 0 0 0;">Your account will remain fully accessible during this grace period. If payment is not resolved within 7 days${metadata.gracePeriodEnd ? ` (by ${new Date(metadata.gracePeriodEnd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })})` : ''}, your account will be suspended.</p>
              </div>
              <p>Your data will always be kept safe, but you won't be able to access the platform until payment is resolved.</p>
              <a href="${settingsUrl}" class="button">Update Payment Method</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">If you believe this is an error, please contact your bank or our support team.</p>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_succeeded":
      return {
        subject: `Payment Received - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "payment_method_updated":
      return {
        subject: `Payment Method Updated - alkatera`,
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
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "subscription_cancelled":
      return {
        subject: `Subscription Cancelled - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Subscription Cancelled</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your alkatera subscription has been cancelled.</p>
              <p>Your account has been downgraded to the Seed (free) tier. You still have access to basic features, but some advanced functionality may be limited.</p>
              <p>We're sorry to see you go! If you change your mind, you can upgrade again at any time.</p>
              <a href="${settingsUrl}" class="button">Resubscribe</a>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "subscription_reactivated":
      return {
        subject: `Welcome Back! Subscription Reactivated - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-success">
              <h2 style="margin: 0;">🎉 Welcome Back!</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Great news! Your alkatera subscription has been reactivated.</p>
              <p>All your features and data are available again. Thank you for continuing to use alkatera for your sustainability tracking.</p>
              <a href="${siteUrl}/dashboard" class="button">Go to Dashboard</a>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "subscription_suspended":
      return {
        subject: `Account Suspended - Action Required - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header header-danger">
              <h2 style="margin: 0;">Account Suspended</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>Your alkatera account has been suspended because your payment could not be processed and the 7-day grace period has expired.</p>
              <div class="danger-box">
                <strong>Your data is safe</strong>
                <p style="margin: 8px 0 0 0;">All your products, LCAs, reports and organisation data are kept intact. Once you update your payment method, access will be restored immediately.</p>
              </div>
              <a href="${settingsUrl}" class="button">Update Payment Method</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">If you believe this is an error, please contact our support team at support@alkatera.com.</p>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "annual_renewal_reminder":
      return {
        subject: `Upcoming Annual Renewal - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Annual Subscription Renewal</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>This is a friendly reminder that your annual alkatera subscription will renew soon.</p>
              <div class="info-box">
                <strong>Renewal Details</strong>
                <p style="margin: 8px 0 0 0;">
                  <strong>Plan:</strong> ${formatTierName(metadata.tier || 'seed')}<br/>
                  <strong>Amount:</strong> &pound;${metadata.amount ? (metadata.amount / 100).toFixed(2) : 'N/A'}<br/>
                  <strong>Renewal Date:</strong> ${metadata.renewalDate ? new Date(metadata.renewalDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Within 7 days'}
                </p>
              </div>
              <p>If you'd like to make any changes to your subscription or payment method before renewal, you can do so from your billing settings.</p>
              <a href="${settingsUrl}" class="button">Manage Subscription</a>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "trial_started": {
      const trialEnd = metadata.trialEndsAt
        ? new Date(metadata.trialEndsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'in 30 days';
      return {
        subject: `Your free trial has started - alkatera`,
        html: renderBrandedEmail({
          preheader: `30 days free. We never charge automatically - you choose if and when to continue.`,
          title: `Your free trial has started`,
          accent: BRAND_LIME,
          ctaLabel: `Go to your dashboard`,
          ctaHref: `${siteUrl}/dashboard`,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Welcome to alka<strong style="color:${BRAND_LIME};">tera</strong>. Your 30-day free trial is now live. Add a facility, build a product life cycle assessment and explore the platform.</p>
            <div style="background:#10160a;border-left:3px solid ${BRAND_LIME};border-radius:0 8px 8px 0;padding:14px 16px;margin:18px 0;">
              <p style="margin:0 0 6px;color:#eef7d8;font-weight:bold;">How your trial works</p>
              <p style="margin:0;color:#c7ccd1;">Your trial runs until <strong style="color:#ffffff;">${trialEnd}</strong>. We never charge your card automatically. To carry on after that, simply choose a plan, and because your card is already on file it's a single click.</p>
              <p style="margin:8px 0 0;color:#c7ccd1;">We'll remind you before your trial ends. Whatever you decide, your data is always kept safe.</p>
            </div>
          `,
          secondaryHtml: `<p style="margin:16px 0 0;font-size:13px;color:#8b9197;">Manage your trial anytime from <a href="${settingsUrl}" style="color:${BRAND_LIME};">billing settings</a>.</p>`,
        }),
      };
    }

    case "trial_ending_soon": {
      const days = metadata.daysRemaining ?? 3;
      const dayLabel = `${days} day${days === 1 ? '' : 's'}`;
      const trialEnd = metadata.trialEndsAt
        ? new Date(metadata.trialEndsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : `in ${dayLabel}`;
      return {
        subject: `Your free trial ends in ${dayLabel} - alkatera`,
        html: renderBrandedEmail({
          preheader: `Choose a plan to keep going. We won't charge you automatically.`,
          title: `Your free trial ends in ${dayLabel}`,
          accent: '#f59e0b',
          ctaLabel: `Choose your plan`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <div style="background:#1c1606;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 18px;">
              <p style="margin:0 0 6px;color:#fce9c0;font-weight:bold;">Your free trial ends on ${trialEnd}.</p>
              <p style="margin:0;color:#c7ccd1;">We won't charge you automatically. When the trial ends your account pauses to read-only until you choose a plan, and all your data stays safe.</p>
            </div>
            <p style="margin:0 0 14px;">Enjoying alka<strong style="color:${BRAND_LIME};">tera</strong>? Choose a plan to keep everything you've built and unlock downloads and reports. Your card is already on file, so it's a single click.</p>
          `,
          secondaryHtml: `<p style="margin:16px 0 0;font-size:13px;color:#8b9197;">No pressure either way, you're always in control.</p>`,
        }),
      };
    }

    case "trial_ended": {
      const trialEnd = metadata.trialEndsAt
        ? new Date(metadata.trialEndsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'today';
      return {
        subject: `Your free trial has ended - choose a plan to continue`,
        html: renderBrandedEmail({
          preheader: `Your data is safe. Choose a plan to pick up where you left off.`,
          title: `Your free trial has ended`,
          accent: '#f59e0b',
          ctaLabel: `Choose your plan`,
          ctaHref: `${siteUrl}/complete-subscription`,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your 30-day free trial ended on <strong style="color:#ffffff;">${trialEnd}</strong>. We hope you enjoyed exploring alka<strong style="color:${BRAND_LIME};">tera</strong>.</p>
            <div style="background:#1c1606;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 18px;">
              <p style="margin:0 0 6px;color:#fce9c0;font-weight:bold;">Your data is safe and waiting</p>
              <p style="margin:0;color:#c7ccd1;">Your account is now read-only. Everything you built during the trial, your facility, products and life cycle assessments, is kept exactly as you left it.</p>
            </div>
            <p style="margin:0 0 14px;">To pick up where you left off and unlock downloads and reports, choose a plan. Your card is already on file, so it's a single click, and we still won't charge anything until you confirm.</p>
          `,
          secondaryHtml: `<p style="margin:16px 0 0;font-size:13px;color:#8b9197;">Questions before you decide? Just reply to this email.</p>`,
        }),
      };
    }

    default:
      return {
        subject: `Subscription Update - alkatera`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Subscription Update</h2>
            </div>
            <div class="content">
              <p>Hi ${safeName},</p>
              <p>There's been an update to your alkatera subscription.</p>
              <a href="${settingsUrl}" class="button">View Details</a>
            </div>
            <div class="footer">
              <p>alka<strong>tera</strong> - Sustainability Platform</p>
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
      from: "alkatera <sayhello@mail.alkatera.com>",
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
