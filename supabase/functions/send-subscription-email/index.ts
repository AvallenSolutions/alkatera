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
  footerNote?: string;
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
            <p style="margin:9px 0 0;font-size:11px;color:#565b60;">${opts.footerNote || 'This is a notification about your alkatera account.'}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

/** Dark-theme accent box used inside branded email bodies. */
function noticeBox(tone: 'lime' | 'amber' | 'danger', title: string, body: string): string {
  const c =
    tone === 'amber'
      ? { bg: '#1c1606', border: '#f59e0b', title: '#fce9c0' }
      : tone === 'danger'
      ? { bg: '#1f0d0d', border: '#ef4444', title: '#f7c4c4' }
      : { bg: '#10160a', border: BRAND_LIME, title: '#eef7d8' };
  return `<div style="background:${c.bg};border-left:3px solid ${c.border};border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 16px;">${
    title ? `<p style="margin:0 0 6px;color:${c.title};font-weight:bold;">${title}</p>` : ''
  }<p style="margin:0;color:#c7ccd1;">${body}</p></div>`;
}

function buildEmailContent(
  org: OrganizationData,
  eventType: EmailEventType,
  metadata: Record<string, any>,
  siteUrl: string
): { subject: string; html: string } {
  const settingsUrl = `${siteUrl}/settings?tab=billing`;
  const safeName = escapeHtml(org.name);

  switch (eventType) {
    case "plan_upgraded":
      return {
        subject: `Plan upgraded to ${formatTierName(metadata.newTier)} - alkatera`,
        html: renderBrandedEmail({
          preheader: `You've been upgraded to ${formatTierName(metadata.newTier)}.`,
          title: `Plan upgraded to ${formatTierName(metadata.newTier)}`,
          accent: BRAND_LIME,
          ctaLabel: `View your subscription`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Good news, your subscription has been upgraded${metadata.previousTier ? ` from ${formatTierName(metadata.previousTier)}` : ''} to <strong style="color:#ffffff;">${formatTierName(metadata.newTier)}</strong>.</p>
            ${noticeBox('lime', `What's included now`, `Higher product and LCA limits, more team members and facilities, and the full ${formatTierName(metadata.newTier)} feature set.`)}
          `,
        }),
      };

    case "plan_downgraded":
      return {
        subject: `Plan changed to ${formatTierName(metadata.newTier)} - alkatera`,
        html: renderBrandedEmail({
          preheader: `Your plan is now ${formatTierName(metadata.newTier)}.`,
          title: `Your plan has changed`,
          accent: '#f59e0b',
          ctaLabel: `View your subscription`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your subscription has changed${metadata.previousTier ? ` from ${formatTierName(metadata.previousTier)}` : ''} to <strong style="color:#ffffff;">${formatTierName(metadata.newTier)}</strong>. Your new plan limits are now in effect.</p>
            ${metadata.gracePeriod ? noticeBox('amber', `Grace period active`, `Your current usage exceeds your new plan limits. You have <strong style="color:#ffffff;">7 days</strong> to reduce it, or the oldest items will be automatically removed.`) : ''}
          `,
        }),
      };

    case "grace_period_started": {
      const resource = formatResourceType(org.grace_period_resource_type || 'items');
      const endsOn = org.grace_period_end ? new Date(org.grace_period_end).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '7 days from now';
      return {
        subject: `Action required: reduce your ${resource} - alkatera`,
        html: renderBrandedEmail({
          preheader: `You have 7 days to bring your ${resource.toLowerCase()} within your plan limits.`,
          title: `Action needed on your ${resource.toLowerCase()}`,
          accent: '#f59e0b',
          ctaLabel: `Manage your usage`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your recent plan change means your usage now exceeds your plan limits.</p>
            ${noticeBox('amber', `You have 7 days to take action`, `<strong style="color:#ffffff;">${resource}:</strong> ${metadata.currentUsage ?? 'N/A'} / ${metadata.newLimit ?? 'N/A'} (${metadata.excessCount || 0} over limit). Grace period ends ${endsOn}.`)}
            <p style="margin:0;">Please reduce your ${resource.toLowerCase()} to fit your plan. If no action is taken, the oldest items are automatically removed when the grace period ends.</p>
          `,
        }),
      };
    }

    case "grace_period_warning": {
      const resource = formatResourceType(org.grace_period_resource_type || 'items');
      return {
        subject: `3 days left: reduce your ${resource} - alkatera`,
        html: renderBrandedEmail({
          preheader: `${metadata.itemsToDelete || 'Excess items'} will be removed in 3 days.`,
          title: `Only 3 days left`,
          accent: '#ef4444',
          ctaLabel: `Take action now`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            ${noticeBox('danger', `Your grace period ends in 3 days`, `After that, ${metadata.itemsToDelete || 'excess items'} will be automatically removed. <strong style="color:#ffffff;">${resource}:</strong> ${metadata.currentUsage ?? 'N/A'} / ${metadata.newLimit ?? 'N/A'}.`)}
            <p style="margin:0;">To avoid losing data, remove the excess ${resource.toLowerCase()} before the grace period ends.</p>
          `,
        }),
      };
    }

    case "grace_period_expired":
      return {
        subject: `Items removed: grace period expired - alkatera`,
        html: renderBrandedEmail({
          preheader: `Some items were removed to fit your plan limits.`,
          title: `Grace period expired`,
          accent: '#ef4444',
          ctaLabel: `View your account`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your grace period has expired and some items were automatically removed to bring your account within its plan limits.</p>
            ${noticeBox('danger', `${metadata.itemsDeleted || 0} ${formatResourceType(metadata.resourceType || 'items')} removed`, `The oldest items were selected. To recover data or raise your limits, upgrade your plan or contact support.`)}
          `,
        }),
      };

    case "payment_failed":
      return {
        subject: `Payment failed - action required - alkatera`,
        html: renderBrandedEmail({
          preheader: `Update your payment method within 7 days to keep your access.`,
          title: `Payment failed`,
          accent: '#ef4444',
          ctaLabel: `Update payment method`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">We couldn't process your subscription payment.</p>
            ${noticeBox('danger', `You have 7 days to update your payment method`, `Your account stays fully accessible during this grace period. If it isn't resolved${metadata.gracePeriodEnd ? ` by ${new Date(metadata.gracePeriodEnd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ' within 7 days'}, your account will be suspended.`)}
            <p style="margin:0;">Your data is always kept safe. If you think this is an error, please contact your bank or our support team.</p>
          `,
        }),
      };

    case "payment_succeeded":
      return {
        subject: `Payment received - alkatera`,
        html: renderBrandedEmail({
          preheader: `Thanks, your payment went through.`,
          title: `Payment received`,
          accent: BRAND_LIME,
          ctaLabel: `View billing details`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Thank you, your payment has been processed successfully.</p>
            ${metadata.amount ? noticeBox('lime', `Amount paid`, `&pound;${(metadata.amount / 100).toFixed(2)}`) : ''}
            ${metadata.wasReactivated ? `<p style="margin:0;">Your subscription is reactivated and all features are available again.</p>` : ''}
          `,
        }),
      };

    case "payment_method_updated":
      return {
        subject: `Payment method updated - alkatera`,
        html: renderBrandedEmail({
          preheader: `Your new card is saved for future payments.`,
          title: `Payment method updated`,
          accent: BRAND_LIME,
          ctaLabel: `View billing details`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your payment method has been updated successfully.</p>
            ${metadata.cardLast4 ? noticeBox('lime', `New card`, `Ending in &bull;&bull;&bull;&bull; ${metadata.cardLast4}`) : ''}
            <p style="margin:0;">Future payments will use this card.</p>
          `,
        }),
      };

    case "subscription_cancelled":
      return {
        subject: `Subscription cancelled - alkatera`,
        html: renderBrandedEmail({
          preheader: `You've moved to the Seed (free) tier. Resubscribe anytime.`,
          title: `Subscription cancelled`,
          accent: '#f59e0b',
          ctaLabel: `Resubscribe`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your alka<strong style="color:${BRAND_LIME};">tera</strong> subscription has been cancelled and your account has moved to the Seed (free) tier. You still have the basics, though some advanced features are limited.</p>
            <p style="margin:0;">We're sorry to see you go. You can resubscribe whenever you're ready, and your data stays safe in the meantime.</p>
          `,
        }),
      };

    case "subscription_reactivated":
      return {
        subject: `Welcome back - subscription reactivated - alkatera`,
        html: renderBrandedEmail({
          preheader: `All your features and data are available again.`,
          title: `Welcome back`,
          accent: BRAND_LIME,
          ctaLabel: `Go to your dashboard`,
          ctaHref: `${siteUrl}/dashboard`,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Good news, your alka<strong style="color:${BRAND_LIME};">tera</strong> subscription has been reactivated.</p>
            <p style="margin:0;">All your features and data are available again. Thank you for continuing with alkatera.</p>
          `,
        }),
      };

    case "subscription_suspended":
      return {
        subject: `Account suspended - action required - alkatera`,
        html: renderBrandedEmail({
          preheader: `Update your payment method to restore access.`,
          title: `Account suspended`,
          accent: '#ef4444',
          ctaLabel: `Update payment method`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">Your alka<strong style="color:${BRAND_LIME};">tera</strong> account has been suspended because a payment couldn't be processed and the 7-day grace period has passed.</p>
            ${noticeBox('danger', `Your data is safe`, `All your products, LCAs, reports and organisation data are intact. Update your payment method and access is restored immediately.`)}
            <p style="margin:0;">If you think this is an error, contact us at support@alkatera.com.</p>
          `,
        }),
      };

    case "annual_renewal_reminder":
      return {
        subject: `Upcoming annual renewal - alkatera`,
        html: renderBrandedEmail({
          preheader: `Your annual ${formatTierName(metadata.tier || 'seed')} plan renews soon.`,
          title: `Your annual plan renews soon`,
          accent: '#f59e0b',
          ctaLabel: `Manage subscription`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0 0 14px;">A friendly reminder that your annual alka<strong style="color:${BRAND_LIME};">tera</strong> subscription will renew soon.</p>
            ${noticeBox('lime', `Renewal details`, `<strong style="color:#ffffff;">Plan:</strong> ${formatTierName(metadata.tier || 'seed')}<br/><strong style="color:#ffffff;">Amount:</strong> &pound;${metadata.amount ? (metadata.amount / 100).toFixed(2) : 'N/A'}<br/><strong style="color:#ffffff;">Renews:</strong> ${metadata.renewalDate ? new Date(metadata.renewalDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'within 7 days'}`)}
            <p style="margin:0;">To change your plan or payment method before then, visit your billing settings.</p>
          `,
        }),
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
        subject: `Subscription update - alkatera`,
        html: renderBrandedEmail({
          preheader: `An update about your alkatera account.`,
          title: `Subscription update`,
          accent: BRAND_LIME,
          ctaLabel: `View details`,
          ctaHref: settingsUrl,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hi ${safeName},</p>
            <p style="margin:0;">There's been an update to your alka<strong style="color:${BRAND_LIME};">tera</strong> subscription.</p>
          `,
        }),
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
