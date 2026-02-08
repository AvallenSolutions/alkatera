import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Onboarding Email Drip
 *
 * Sends 3 automated emails to new organisation owners:
 *   Day 1  – Welcome + quick 3-step overview
 *   Day 3  – Check-in with personalised tips based on what they haven't done yet
 *   Day 7  – Value prop reminder + Rosa highlight
 *
 * Triggered via pg_cron, GitHub Actions cron, or manual invocation.
 * Uses service role — no user JWT required.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LOGO_URL =
  "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png";

type EmailType = "day_1_welcome" | "day_3_checkin" | "day_7_nudge";

interface OrgOwner {
  organization_id: string;
  organization_name: string;
  user_id: string;
  user_email: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Email templates
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailLayout(siteUrl: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);padding:30px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <img src="${LOGO_URL}" alt="alkatera" width="180" height="auto" style="display:block;margin:0 auto 12px auto;" />
              <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Sustainability, Distilled</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1a1a;padding:30px 40px;border-radius:0 0 12px 12px;text-align:center;">
              <p style="margin:0 0 10px 0;color:#888;font-size:14px;">alka<strong style="color:#888;">tera</strong> - Sustainability Platform</p>
              <p style="margin:0;color:#666;font-size:12px;">
                <a href="${siteUrl}" style="color:#ccff00;text-decoration:none;">www.alkatera.com</a>
              </p>
              <p style="margin:15px 0 0 0;color:#555;font-size:11px;">
                You're receiving this because you signed up for alkatera. If you'd prefer not to receive these, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
  <tr>
    <td align="center">
      <a href="${href}" style="display:inline-block;background-color:#ccff00;color:#0a0a0a;padding:14px 32px;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function buildDay1Email(orgName: string, siteUrl: string): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 20px 0;color:#1a1a1a;font-size:24px;font-weight:600;">Welcome to alkatera! 🌱</h2>
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">Thanks for setting up <strong>${escapeHtml(orgName)}</strong> on alka<strong>tera</strong>. You're now part of a growing community of drinks producers taking sustainability seriously.</p>
    <p style="margin:0 0 10px 0;color:#4a4a4a;font-size:16px;font-weight:600;">Here's how to get started in three easy steps:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;margin-bottom:8px;">
          <p style="margin:0;color:#1a1a1a;font-size:15px;"><strong style="color:#ccff00;font-size:18px;">1.</strong> <strong>Add a facility</strong> — Map your brewery, distillery, or warehouse so I can track your operational footprint.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;margin-bottom:8px;">
          <p style="margin:0;color:#1a1a1a;font-size:15px;"><strong style="color:#ccff00;font-size:18px;">2.</strong> <strong>Create your first product</strong> — Build a lifecycle assessment and see your carbon footprint in minutes.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;">
          <p style="margin:0;color:#1a1a1a;font-size:15px;"><strong style="color:#ccff00;font-size:18px;">3.</strong> <strong>Ask Rosa anything</strong> — Your AI sustainability companion is ready to help. Just type a question.</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${siteUrl}/dashboard`, "Go to Your Dashboard")}
    <p style="margin:0;color:#888;font-size:14px;">Need help? Just reply to this email or chat with Rosa inside the app.</p>
  `;

  return {
    subject: "Welcome to alkatera — here's what to do first",
    html: emailLayout(siteUrl, content),
  };
}

function buildDay3Email(
  orgName: string,
  siteUrl: string,
  counts: { facilities: number; products: number; suppliers: number }
): { subject: string; html: string } {
  const tips: string[] = [];

  if (counts.facilities === 0) {
    tips.push(
      `<strong>Add your first facility</strong> — Facilities are the foundation of your Scope 1 &amp; 2 emissions. <a href="${siteUrl}/company/facilities" style="color:#ccff00;text-decoration:none;">Add one now →</a>`
    );
  }
  if (counts.products === 0) {
    tips.push(
      `<strong>Create your first product</strong> — Products are at the heart of your sustainability story. <a href="${siteUrl}/products/new" style="color:#ccff00;text-decoration:none;">Create one now →</a>`
    );
  }
  if (counts.suppliers === 0) {
    tips.push(
      `<strong>Add a supplier</strong> — Your supply chain contributes to Scope 3 emissions. <a href="${siteUrl}/suppliers" style="color:#ccff00;text-decoration:none;">Add one now →</a>`
    );
  }

  // If they've done everything, congratulate them
  if (tips.length === 0) {
    tips.push(
      `<strong>You're making great progress!</strong> Keep going by exploring your dashboard insights and asking Rosa for recommendations.`
    );
  }

  // Determine best CTA
  let ctaHref = `${siteUrl}/dashboard`;
  let ctaLabel = "Go to Your Dashboard";
  if (counts.facilities === 0) {
    ctaHref = `${siteUrl}/company/facilities`;
    ctaLabel = "Add Your First Facility";
  } else if (counts.products === 0) {
    ctaHref = `${siteUrl}/products/new`;
    ctaLabel = "Create Your First Product";
  } else if (counts.suppliers === 0) {
    ctaHref = `${siteUrl}/suppliers`;
    ctaLabel = "Add Your First Supplier";
  }

  const tipsHtml = tips
    .map(
      (tip) =>
        `<tr><td style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;"><p style="margin:0;color:#1a1a1a;font-size:15px;">${tip}</p></td></tr><tr><td style="height:8px;"></td></tr>`
    )
    .join("");

  const content = `
    <h2 style="margin:0 0 20px 0;color:#1a1a1a;font-size:24px;font-weight:600;">Checking in 👋</h2>
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">Hi there! It's been a couple of days since you set up <strong>${escapeHtml(orgName)}</strong> on alka<strong>tera</strong>. Need a hand getting started?</p>
    <p style="margin:0 0 10px 0;color:#4a4a4a;font-size:16px;font-weight:600;">Here's what I'd suggest next:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${tipsHtml}
    </table>
    ${ctaButton(ctaHref, ctaLabel)}
    <p style="margin:0;color:#888;font-size:14px;">Every step you take builds a clearer picture of your environmental impact. I'm here whenever you need me.</p>
  `;

  return {
    subject: "Checking in — need a hand getting started?",
    html: emailLayout(siteUrl, content),
  };
}

function buildDay7Email(orgName: string, siteUrl: string): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 20px 0;color:#1a1a1a;font-size:24px;font-weight:600;">One week in 🎉</h2>
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">It's been a week since <strong>${escapeHtml(orgName)}</strong> joined alka<strong>tera</strong>. Here's a reminder of what you can unlock:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px;background-color:#f9fafb;border-radius:8px;border-left:4px solid #ccff00;">
          <p style="margin:0 0 8px 0;color:#1a1a1a;font-size:16px;font-weight:600;">🌱 Rosa, your AI sustainability companion</p>
          <p style="margin:0;color:#4a4a4a;font-size:14px;">Ask Rosa anything about your data, and she'll uncover insights, spot trends, and suggest practical next steps — all in natural language.</p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#f9fafb;border-radius:8px;border-left:4px solid #ccff00;">
          <p style="margin:0 0 8px 0;color:#1a1a1a;font-size:16px;font-weight:600;">📊 Vitality Score</p>
          <p style="margin:0;color:#4a4a4a;font-size:14px;">Your single sustainability score across climate, water, circularity, and nature — benchmarked against your industry.</p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#f9fafb;border-radius:8px;border-left:4px solid #ccff00;">
          <p style="margin:0 0 8px 0;color:#1a1a1a;font-size:16px;font-weight:600;">📦 Product Lifecycle Assessments</p>
          <p style="margin:0;color:#4a4a4a;font-size:14px;">Build full LCAs for your products and understand impact from raw ingredients through to packaging and distribution.</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${siteUrl}/rosa`, "Chat with Rosa")}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:30px 0;">
    <p style="margin:0;color:#888;font-size:14px;">If you're stuck or have questions, reply to this email or reach out to our support team. We're here to help you succeed.</p>
  `;

  return {
    subject: "One week in — unlock the full power of alkatera",
    html: emailLayout(siteUrl, content),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = (Deno.env.get("SITE_URL") || "https://alkatera.com").replace(/\/$/, "");

    if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Find organisations created within the last 8 days ────────────
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentOrgs, error: orgsError } = await adminClient
      .from("organizations")
      .select("id, name, created_at, owner_id")
      .gte("created_at", eightDaysAgo);

    if (orgsError) {
      console.error("Error fetching recent orgs:", orgsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch organisations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recentOrgs || recentOrgs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recent organisations to process", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Resolve owner emails ─────────────────────────────────────────
    const orgOwners: OrgOwner[] = [];

    for (const org of recentOrgs) {
      if (!org.owner_id) continue;

      const { data: userData } = await adminClient.auth.admin.getUserById(org.owner_id);
      if (userData?.user?.email) {
        orgOwners.push({
          organization_id: org.id,
          organization_name: org.name || "your organisation",
          user_id: org.owner_id,
          user_email: userData.user.email,
          created_at: org.created_at,
        });
      }
    }

    // ── 3. Process each owner ───────────────────────────────────────────
    let totalSent = 0;
    const results: Array<{ org: string; email: string; type: EmailType; status: string }> = [];

    for (const owner of orgOwners) {
      const orgAgeHours =
        (Date.now() - new Date(owner.created_at).getTime()) / (1000 * 60 * 60);

      // Determine which email(s) are due
      const dueEmails: EmailType[] = [];
      if (orgAgeHours >= 0 && orgAgeHours <= 36) dueEmails.push("day_1_welcome");
      if (orgAgeHours >= 48 && orgAgeHours <= 108) dueEmails.push("day_3_checkin");
      if (orgAgeHours >= 144 && orgAgeHours <= 204) dueEmails.push("day_7_nudge");

      if (dueEmails.length === 0) continue;

      // Check which emails have already been sent
      const { data: sentEmails } = await adminClient
        .from("onboarding_email_log")
        .select("email_type")
        .eq("organization_id", owner.organization_id)
        .eq("user_id", owner.user_id);

      const alreadySent = new Set((sentEmails || []).map((e: { email_type: string }) => e.email_type));

      for (const emailType of dueEmails) {
        if (alreadySent.has(emailType)) {
          results.push({ org: owner.organization_name, email: owner.user_email, type: emailType, status: "already_sent" });
          continue;
        }

        // Build the email
        let emailData: { subject: string; html: string };

        if (emailType === "day_1_welcome") {
          emailData = buildDay1Email(owner.organization_name, siteUrl);
        } else if (emailType === "day_3_checkin") {
          // Fetch counts for personalised tips
          const [fac, prod, sup] = await Promise.all([
            adminClient.from("facilities").select("id", { count: "exact", head: true }).eq("organization_id", owner.organization_id),
            adminClient.from("products").select("id", { count: "exact", head: true }).eq("organization_id", owner.organization_id),
            adminClient.from("organization_suppliers").select("id", { count: "exact", head: true }).eq("organization_id", owner.organization_id),
          ]);
          emailData = buildDay3Email(owner.organization_name, siteUrl, {
            facilities: fac.count ?? 0,
            products: prod.count ?? 0,
            suppliers: sup.count ?? 0,
          });
        } else {
          emailData = buildDay7Email(owner.organization_name, siteUrl);
        }

        // Send via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "alkatera <sayhello@mail.alkatera.com>",
            to: owner.user_email,
            subject: emailData.subject,
            html: emailData.html,
          }),
        });

        if (!resendResponse.ok) {
          const errText = await resendResponse.text();
          console.error(`Failed to send ${emailType} to ${owner.user_email}:`, errText);
          results.push({ org: owner.organization_name, email: owner.user_email, type: emailType, status: "failed" });
          continue;
        }

        // Log successful send
        await adminClient.from("onboarding_email_log").insert({
          organization_id: owner.organization_id,
          user_id: owner.user_id,
          email_type: emailType,
        });

        totalSent++;
        results.push({ org: owner.organization_name, email: owner.user_email, type: emailType, status: "sent" });
      }
    }

    return new Response(
      JSON.stringify({ message: "Onboarding drip complete", sent: totalSent, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in send-onboarding-drip:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
