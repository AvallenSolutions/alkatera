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
 * Uses service role, no user JWT required.
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
                <a href="${siteUrl}" style="color:#F2F1EA;text-decoration:none;">www.alkatera.com</a>
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
      <a href="${href}" style="display:inline-block;background-color:#205E40;color:#F2F1EA;padding:14px 32px;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function buildDay1Email(
  orgName: string,
  siteUrl: string,
  estimateTonnes: number | null,
): { subject: string; html: string } {
  const numberBlock = estimateTonnes != null
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="padding:24px;background-color:#F2F1EA;border:1px solid #D9D6CB;border-radius:8px;text-align:center;">
          <p style="margin:0;color:#205E40;font-size:40px;font-weight:700;letter-spacing:-0.02em;">~${estimateTonnes.toLocaleString()}</p>
          <p style="margin:6px 0 0 0;color:#6F6F68;font-size:13px;">tonnes CO2e a year, estimated from what we found</p>
        </td>
      </tr>
    </table>`
    : "";

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:24px;font-weight:600;">What we found in your house.</h2>
    <p style="margin:0 0 8px 0;color:#4a4a4a;font-size:16px;">We read what <strong>${escapeHtml(orgName)}</strong> already publishes and turned it into a first sustainability picture. Here is where you stand today.</p>
    ${numberBlock}
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">This is a starting point, not a verdict. Every real number you confirm from here makes it truer. Your desk shows you exactly where to start.</p>
    ${ctaButton(`${siteUrl}/desk/`, "Go to your desk")}
    <p style="margin:0;color:#888;font-size:14px;">Anything to add? Reply to this email, or ask Rosa inside the app.</p>
  `;

  return {
    subject: "What we found in your house",
    html: emailLayout(siteUrl, content),
  };
}

function buildDay3Email(
  orgName: string,
  siteUrl: string,
  counts: { facilities: number; products: number; suppliers: number }
): { subject: string; html: string } {
  // The single weakest room and its one action, in priority order. If nothing
  // is missing, a quiet well-done rather than a made-up task.
  let room: string;
  let action: string;
  let ctaHref: string;
  let ctaLabel: string;
  let subject: string;

  if (counts.facilities === 0) {
    room = "The workbench";
    action = "Place your production site. One address gives us your grid and your country's factors, and lights the whole room.";
    ctaHref = `${siteUrl}/company/facilities/`;
    ctaLabel = "Place your facility";
    subject = "One quiet room in your house";
  } else if (counts.products === 0) {
    room = "The cellar";
    action = "Add a product. Its recipe is where most of your footprint lives, so it moves your number more than anything else.";
    ctaHref = `${siteUrl}/products/`;
    ctaLabel = "Add a product";
    subject = "One quiet room in your house";
  } else if (counts.suppliers === 0) {
    room = "The network";
    action = "Add a supplier. Your supply chain carries the part of the footprint you cannot see from the inside.";
    ctaHref = `${siteUrl}/suppliers/`;
    ctaLabel = "Add a supplier";
    subject = "One quiet room in your house";
  } else {
    room = "";
    action = "Every room has something in it. The next move is to confirm a recipe or drop a real bill, so your estimate becomes a measurement.";
    ctaHref = `${siteUrl}/desk/`;
    ctaLabel = "Go to your desk";
    subject = "Your house is taking shape";
  }

  const heading = room
    ? `${room} is the quietest room in your house.`
    : "Your house is taking shape.";

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:24px;font-weight:600;">${heading}</h2>
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">A few days in with <strong>${escapeHtml(orgName)}</strong>. Here is the one thing worth doing next.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 18px;background-color:#F2F1EA;border:1px solid #D9D6CB;border-left:4px solid #205E40;border-radius:8px;">
          <p style="margin:0;color:#1a1a1a;font-size:15px;">${action}</p>
        </td>
      </tr>
    </table>
    ${ctaButton(ctaHref, ctaLabel)}
    <p style="margin:0;color:#888;font-size:14px;">Not sure where something goes? Ask Rosa. She will work it out.</p>
  `;

  return {
    subject,
    html: emailLayout(siteUrl, content),
  };
}

function buildDay7Email(
  orgName: string,
  siteUrl: string,
  confirmedPct: number | null,
): { subject: string; html: string } {
  const confirmedLine = confirmedPct != null
    ? `<strong>${confirmedPct}% of your footprint is confirmed</strong> so far. Every recipe you check and every real bill you drop moves that number up, and makes your reports stand on measurements rather than estimates.`
    : `Right now your number rests on industry benchmarks. Confirming a recipe or dropping a real utility bill turns it from an estimate into a measurement, which is what a buyer or an auditor will want to see.`;

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:24px;font-weight:600;">A week in. Here is your number, and how to make it truer.</h2>
    <p style="margin:0 0 20px 0;color:#4a4a4a;font-size:16px;">${escapeHtml(orgName)} has been on alka<strong>tera</strong> for a week. The house is furnished. The work now is turning estimates into evidence.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 18px;background-color:#F2F1EA;border:1px solid #D9D6CB;border-left:4px solid #205E40;border-radius:8px;">
          <p style="margin:0;color:#1a1a1a;font-size:15px;">${confirmedLine}</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${siteUrl}/desk/`, "Go to your desk")}
    <hr style="border:none;border-top:1px solid #D9D6CB;margin:30px 0;">
    <p style="margin:0;color:#888;font-size:14px;">Stuck on anything? Reply to this email, or ask Rosa. We would rather you asked than guessed.</p>
  `;

  return {
    subject: "A week in: your number, and how to make it truer",
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
          // The starter footprint estimate seeded at onboarding completion.
          const { data: est } = await adminClient
            .from("agent_exceptions")
            .select("payload")
            .eq("organization_id", owner.organization_id)
            .eq("kind", "onboarding_estimate")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const tonnes = est?.payload?.estimate_tonnes_co2e;
          emailData = buildDay1Email(
            owner.organization_name,
            siteUrl,
            typeof tonnes === "number" ? tonnes : null,
          );
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
          emailData = buildDay7Email(owner.organization_name, siteUrl, null);
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
