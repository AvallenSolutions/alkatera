// Send Subscription Email Edge Function
// This function sends email notifications for subscription events

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  escapeHtml,
  STUDIO,
  studioButton,
  studioCallout,
  studioFactTable,
  studioLayout,
  studioNotice,
  studioParagraph,
} from "../_shared/studio-email.ts";

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

/** The wordmark, for use inside HTML body copy. */
const WORDMARK = `alka<strong>tera</strong>`;

const DEFAULT_FOOTER = `This is a notification about your alka<strong>tera</strong> account.`;

/** Hidden inbox preview line; renders nowhere in the email body itself. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(text)}</div>`;
}

/** Inline text link in house style. */
function inlineLink(href: string, label: string): string {
  return `<a href="${href}" style="color:${STUDIO.forest};text-decoration:none;">${label}</a>`;
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
        html: studioLayout({
          eyebrow: "Plan upgraded",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`You've been upgraded to ${formatTierName(metadata.newTier)}.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Good news, your subscription has been upgraded${metadata.previousTier ? ` from ${formatTierName(metadata.previousTier)}` : ''} to <strong>${formatTierName(metadata.newTier)}</strong>.`)}
            ${studioNotice('good', `What's included now`, `Higher product and LCA limits, more team members and facilities, and the full ${formatTierName(metadata.newTier)} feature set.`)}
            ${studioButton(settingsUrl, `View your subscription`)}
          `,
        }),
      };

    case "plan_downgraded":
      return {
        subject: `Plan changed to ${formatTierName(metadata.newTier)} - alkatera`,
        html: studioLayout({
          eyebrow: "Plan changed",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Your plan is now ${formatTierName(metadata.newTier)}.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your subscription has changed${metadata.previousTier ? ` from ${formatTierName(metadata.previousTier)}` : ''} to <strong>${formatTierName(metadata.newTier)}</strong>. Your new plan limits are now in effect.`)}
            ${metadata.gracePeriod ? studioNotice('attention', `Grace period active`, `Your current usage exceeds your new plan limits. You have <strong>7 days</strong> to reduce it, or the oldest items will be automatically removed.`) : ''}
            ${studioButton(settingsUrl, `View your subscription`)}
          `,
        }),
      };

    case "grace_period_started": {
      const resource = formatResourceType(org.grace_period_resource_type || 'items');
      const endsOn = org.grace_period_end ? new Date(org.grace_period_end).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '7 days from now';
      return {
        subject: `Action required: reduce your ${resource} - alkatera`,
        html: studioLayout({
          eyebrow: "Action needed",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`You have 7 days to bring your ${resource.toLowerCase()} within your plan limits.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your recent plan change means your usage now exceeds your plan limits.`)}
            ${studioNotice('attention', `You have 7 days to take action`, `<strong>${resource}:</strong> ${metadata.currentUsage ?? 'N/A'} / ${metadata.newLimit ?? 'N/A'} (${metadata.excessCount || 0} over limit). Grace period ends ${endsOn}.`)}
            ${studioParagraph(`Please reduce your ${resource.toLowerCase()} to fit your plan. If no action is taken, the oldest items are automatically removed when the grace period ends.`)}
            ${studioButton(settingsUrl, `Manage your usage`)}
          `,
        }),
      };
    }

    case "grace_period_warning": {
      const resource = formatResourceType(org.grace_period_resource_type || 'items');
      return {
        subject: `3 days left: reduce your ${resource} - alkatera`,
        html: studioLayout({
          eyebrow: "3 days left",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`${metadata.itemsToDelete || 'Excess items'} will be removed in 3 days.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioNotice('danger', `Your grace period ends in 3 days`, `After that, ${metadata.itemsToDelete || 'excess items'} will be automatically removed. <strong>${resource}:</strong> ${metadata.currentUsage ?? 'N/A'} / ${metadata.newLimit ?? 'N/A'}.`)}
            ${studioParagraph(`To avoid losing data, remove the excess ${resource.toLowerCase()} before the grace period ends.`)}
            ${studioButton(settingsUrl, `Take action now`)}
          `,
        }),
      };
    }

    case "grace_period_expired":
      return {
        subject: `Items removed: grace period expired - alkatera`,
        html: studioLayout({
          eyebrow: "Grace period expired",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Some items were removed to fit your plan limits.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your grace period has expired and some items were automatically removed to bring your account within its plan limits.`)}
            ${studioNotice('danger', `${metadata.itemsDeleted || 0} ${formatResourceType(metadata.resourceType || 'items')} removed`, `The oldest items were selected. To recover data or raise your limits, upgrade your plan or contact support.`)}
            ${studioButton(settingsUrl, `View your account`)}
          `,
        }),
      };

    case "payment_failed":
      return {
        subject: `Payment failed - action required - alkatera`,
        html: studioLayout({
          eyebrow: "Payment failed",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Update your payment method within 7 days to keep your access.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`We couldn't process your subscription payment.`)}
            ${studioNotice('danger', `You have 7 days to update your payment method`, `Your account stays fully accessible during this grace period. If it isn't resolved${metadata.gracePeriodEnd ? ` by ${new Date(metadata.gracePeriodEnd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ' within 7 days'}, your account will be suspended.`)}
            ${studioParagraph(`Your data is always kept safe. If you think this is an error, please contact your bank or our support team.`)}
            ${studioButton(settingsUrl, `Update payment method`)}
          `,
        }),
      };

    case "payment_succeeded":
      return {
        subject: `Payment received - alkatera`,
        html: studioLayout({
          eyebrow: "Payment received",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Thanks, your payment went through.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Thank you, your payment has been processed successfully.`)}
            ${metadata.amount ? studioFactTable([[`Amount paid`, `&pound;${(metadata.amount / 100).toFixed(2)}`]]) : ''}
            ${metadata.wasReactivated ? studioParagraph(`Your subscription is reactivated and all features are available again.`) : ''}
            ${studioButton(settingsUrl, `View billing details`)}
          `,
        }),
      };

    case "payment_method_updated":
      return {
        subject: `Payment method updated - alkatera`,
        html: studioLayout({
          eyebrow: "Payment method updated",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Your new card is saved for future payments.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your payment method has been updated successfully.`)}
            ${metadata.cardLast4 ? studioFactTable([[`New card`, `Ending in &bull;&bull;&bull;&bull; ${metadata.cardLast4}`]]) : ''}
            ${studioParagraph(`Future payments will use this card.`)}
            ${studioButton(settingsUrl, `View billing details`)}
          `,
        }),
      };

    case "subscription_cancelled":
      return {
        subject: `Subscription cancelled - alkatera`,
        html: studioLayout({
          eyebrow: "Subscription cancelled",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`You've moved to the Seed (free) tier. Resubscribe anytime.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your ${WORDMARK} subscription has been cancelled and your account has moved to the Seed (free) tier. You still have the basics, though some advanced features are limited.`)}
            ${studioParagraph(`We're sorry to see you go. You can resubscribe whenever you're ready, and your data stays safe in the meantime.`)}
            ${studioButton(settingsUrl, `Resubscribe`)}
          `,
        }),
      };

    case "subscription_reactivated":
      return {
        subject: `Welcome back - subscription reactivated - alkatera`,
        html: studioLayout({
          eyebrow: "Welcome back",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`All your features and data are available again.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Good news, your ${WORDMARK} subscription has been reactivated.`)}
            ${studioParagraph(`All your features and data are available again. Thank you for continuing with ${WORDMARK}.`)}
            ${studioButton(`${siteUrl}/dashboard`, `Go to your dashboard`)}
          `,
        }),
      };

    case "subscription_suspended":
      return {
        subject: `Account suspended - action required - alkatera`,
        html: studioLayout({
          eyebrow: "Account suspended",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Update your payment method to restore access.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your ${WORDMARK} account has been suspended because a payment couldn't be processed and the 7-day grace period has passed.`)}
            ${studioNotice('danger', `Your data is safe`, `All your products, LCAs, reports and organisation data are intact. Update your payment method and access is restored immediately.`)}
            ${studioParagraph(`If you think this is an error, contact us at ${inlineLink('mailto:support@alkatera.com', 'support@alkatera.com')}.`)}
            ${studioButton(settingsUrl, `Update payment method`)}
          `,
        }),
      };

    case "annual_renewal_reminder":
      return {
        subject: `Upcoming annual renewal - alkatera`,
        html: studioLayout({
          eyebrow: "Renewal reminder",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`Your annual ${formatTierName(metadata.tier || 'seed')} plan renews soon.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`A friendly reminder that your annual ${WORDMARK} subscription will renew soon.`)}
            ${studioFactTable([
              [`Plan`, formatTierName(metadata.tier || 'seed')],
              [`Amount`, `&pound;${metadata.amount ? (metadata.amount / 100).toFixed(2) : 'N/A'}`],
              [`Renews`, metadata.renewalDate ? new Date(metadata.renewalDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'within 7 days'],
            ])}
            ${studioParagraph(`To change your plan or payment method before then, visit your billing settings.`)}
            ${studioButton(settingsUrl, `Manage subscription`)}
          `,
        }),
      };

    case "trial_started": {
      const trialEnd = metadata.trialEndsAt
        ? new Date(metadata.trialEndsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'in 30 days';
      return {
        subject: `Your free trial has started - alkatera`,
        html: studioLayout({
          eyebrow: "Trial started",
          footerNote: `Manage your trial anytime from ${inlineLink(settingsUrl, 'billing settings')}.`,
          content: `
            ${preheader(`30 days free. We never charge automatically. You choose if and when to continue.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Welcome to ${WORDMARK}. Your 30-day free trial is now live. Add a facility, build a product life cycle assessment and explore the platform.`)}
            ${studioCallout(`How your trial works`, `
              <p style="margin:0;">Your trial runs until <strong>${trialEnd}</strong>. We never charge your card automatically. To carry on after that, simply choose a plan, and because your card is already on file it's a single click.</p>
              <p style="margin:8px 0 0;">We'll remind you before your trial ends. Whatever you decide, your data is always kept safe.</p>
            `)}
            ${studioButton(`${siteUrl}/dashboard`, `Go to your dashboard`)}
          `,
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
        html: studioLayout({
          eyebrow: "Trial ending soon",
          footerNote: `No pressure either way, you're always in control.`,
          content: `
            ${preheader(`Choose a plan to keep going. We won't charge you automatically.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioNotice('attention', `Your free trial ends on ${trialEnd}`, `We won't charge you automatically. When the trial ends your account pauses to read-only until you choose a plan, and all your data stays safe.`)}
            ${studioParagraph(`Enjoying ${WORDMARK}? Choose a plan to keep everything you've built and unlock downloads and reports. Your card is already on file, so it's a single click.`)}
            ${studioButton(settingsUrl, `Choose your plan`)}
          `,
        }),
      };
    }

    case "trial_ended": {
      const trialEnd = metadata.trialEndsAt
        ? new Date(metadata.trialEndsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'today';
      return {
        subject: `Your free trial has ended - choose a plan to continue`,
        html: studioLayout({
          eyebrow: "Trial ended",
          footerNote: `Questions before you decide? Just reply to this email.`,
          content: `
            ${preheader(`Your data is safe. Choose a plan to pick up where you left off.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`Your 30-day free trial ended on <strong>${trialEnd}</strong>. We hope you enjoyed exploring ${WORDMARK}.`)}
            ${studioNotice('attention', `Your data is safe and waiting`, `Your account is now read-only. Everything you built during the trial, your facility, products and life cycle assessments, is kept exactly as you left it.`)}
            ${studioParagraph(`To pick up where you left off and unlock downloads and reports, choose a plan. Your card is already on file, so it's a single click, and we still won't charge anything until you confirm.`)}
            ${studioButton(`${siteUrl}/complete-subscription`, `Choose your plan`)}
          `,
        }),
      };
    }

    default:
      return {
        subject: `Subscription update - alkatera`,
        html: studioLayout({
          eyebrow: "Subscription update",
          footerNote: DEFAULT_FOOTER,
          content: `
            ${preheader(`An update about your alkatera account.`)}
            ${studioParagraph(`Hi ${safeName},`)}
            ${studioParagraph(`There's been an update to your ${WORDMARK} subscription.`)}
            ${studioButton(settingsUrl, `View details`)}
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
