// Send Feedback Email Edge Function
// This function sends email notifications for feedback ticket events

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  escapeHtml,
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

interface EmailRequest {
  ticketId: string;
  eventType: "ticket_created" | "ticket_updated" | "admin_reply" | "user_reply" | "escalated";
  messageId?: string;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  creator_email: string;
  creator_name: string;
  organization_name: string;
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
    const { ticketId, eventType, messageId } = body;

    if (!ticketId || !eventType) {
      throw new Error("ticketId and eventType are required");
    }

    // Use service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch ticket data
    const { data: ticket, error: ticketError } = await adminClient
      .from("feedback_tickets_with_users")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket not found");
    }

    // Check user notification preferences
    const { data: prefs } = await adminClient
      .from("notification_preferences")
      .select("*")
      .eq("user_id", ticket.created_by)
      .single();

    // Default to sending emails if no preferences set
    const shouldSend = checkShouldSendEmail(eventType, prefs);
    if (!shouldSend) {
      return new Response(
        JSON.stringify({ success: true, message: "Email skipped - user preferences" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch message if needed
    let message: any = null;
    if (messageId) {
      const { data: msgData } = await adminClient
        .from("feedback_messages")
        .select("*, sender:sender_id(full_name, email)")
        .eq("id", messageId)
        .single();
      message = msgData;
    }

    // Build email content
    const emailContent = buildEmailContent(ticket, eventType, message, siteUrl);

    // Send email via Resend
    const emailResult = await sendViaResend(resendApiKey, {
      to: ticket.creator_email,
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
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function checkShouldSendEmail(eventType: string, prefs: any): boolean {
  if (!prefs) return true; // Default to sending if no preferences

  switch (eventType) {
    case "ticket_created":
      return prefs.email_on_ticket_created !== false;
    case "ticket_updated":
      return prefs.email_on_ticket_updated !== false;
    case "admin_reply":
      return prefs.email_on_admin_reply !== false;
    case "escalated":
      return prefs.email_on_escalation !== false;
    default:
      return true;
  }
}

function buildEmailContent(
  ticket: TicketData,
  eventType: string,
  message: any,
  siteUrl: string
): { subject: string; html: string } {
  const ticketUrl = `${siteUrl}/feedback/tickets/${ticket.id}`;
  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    feature: "Feature Request",
    improvement: "Improvement",
    other: "Other",
  };

  // Escape user-provided content to prevent XSS
  const safeTitle = escapeHtml(ticket.title);
  const safeDescription = escapeHtml(ticket.description);
  const safeCategory = escapeHtml(ticket.category);
  const safeMessageContent = message?.message ? escapeHtml(message.message) : '';
  const categoryDisplay = categoryLabels[ticket.category] || safeCategory;

  switch (eventType) {
    case "ticket_created":
      return {
        subject: `Ticket Created: ${safeTitle}`,
        html: studioLayout({
          eyebrow: "Product Feedback",
          content: `
            ${studioParagraph(`Your ticket has been created.`)}
            ${studioFactTable([
              ["Ticket", `<strong>${safeTitle}</strong>`],
              ["Category", categoryDisplay],
            ])}
            ${studioCallout("What you told us", safeDescription)}
            ${studioParagraph(`We'll review your ticket and get back to you as soon as possible.`)}
            ${studioButton(ticketUrl, "View Ticket")}
          `,
        }),
      };

    case "ticket_updated":
      return {
        subject: `Ticket Updated: ${safeTitle}`,
        html: studioLayout({
          eyebrow: "Product Feedback",
          content: `
            ${studioParagraph(`Your feedback ticket has been updated by our team.`)}
            ${studioFactTable([
              ["Ticket", `<strong>${safeTitle}</strong>`],
            ])}
            ${studioNotice(
              ticket.status === 'resolved' ? 'good' : 'attention',
              `Status: ${escapeHtml(ticket.status.replace('_', ' ').toUpperCase())}`,
              ticket.status === 'resolved'
                ? `This ticket has been marked as resolved. If anything still isn't right, just reply and we'll pick it back up.`
                : `Our team has moved this ticket along. Open it to see the latest.`,
            )}
            ${studioButton(ticketUrl, "View Ticket")}
          `,
        }),
      };

    case "admin_reply":
      return {
        subject: `New Reply: ${safeTitle}`,
        html: studioLayout({
          eyebrow: "Product Feedback",
          content: `
            ${studioParagraph(`The alka<strong>tera</strong> support team has replied to your ticket.`)}
            ${studioFactTable([
              ["Ticket", `<strong>${safeTitle}</strong>`],
            ])}
            ${safeMessageContent ? studioCallout("Their reply", safeMessageContent) : ''}
            ${studioButton(ticketUrl, "View Conversation")}
          `,
        }),
      };

    case "escalated":
      return {
        subject: `Ticket Escalated: ${safeTitle}`,
        html: studioLayout({
          eyebrow: "Product Feedback",
          content: `
            ${studioParagraph(`Your ticket has been escalated to ensure it gets the attention it needs.`)}
            ${studioFactTable([
              ["Ticket", `<strong>${safeTitle}</strong>`],
            ])}
            ${studioNotice(
              'attention',
              `Priority: ${escapeHtml(ticket.priority.toUpperCase())}`,
              `This ticket now carries a higher priority with our team.`,
            )}
            ${studioButton(ticketUrl, "View Ticket")}
          `,
        }),
      };

    default:
      return {
        subject: `Ticket Updated: ${safeTitle}`,
        html: studioLayout({
          eyebrow: "Product Feedback",
          content: `
            ${studioParagraph(`There's an update on your ticket.`)}
            ${studioFactTable([
              ["Ticket", `<strong>${safeTitle}</strong>`],
            ])}
            ${studioButton(ticketUrl, "View Ticket")}
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
