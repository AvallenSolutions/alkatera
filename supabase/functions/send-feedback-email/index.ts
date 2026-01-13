// Send Feedback Email Edge Function
// This function sends email notifications for feedback ticket events

import { createClient } from "npm:@supabase/supabase-js@2";

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
      console.log(`Email skipped - user preferences disabled for ${eventType}`);
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

    console.log(`Email sent for ${eventType}:`, emailResult);

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

  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #10B981, #14B8A6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
      .button { display: inline-block; background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
      .badge-blue { background: #dbeafe; color: #1d4ed8; }
      .badge-amber { background: #fef3c7; color: #b45309; }
      .badge-green { background: #d1fae5; color: #047857; }
      blockquote { border-left: 4px solid #10B981; padding-left: 16px; margin: 16px 0; color: #4b5563; }
    </style>
  `;

  switch (eventType) {
    case "ticket_created":
      return {
        subject: `Ticket Created: ${ticket.title}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Your ticket has been created</h2>
            </div>
            <div class="content">
              <h3>${ticket.title}</h3>
              <p><span class="badge badge-blue">${categoryLabels[ticket.category] || ticket.category}</span></p>
              <p>${ticket.description}</p>
              <p>We'll review your ticket and get back to you as soon as possible.</p>
              <a href="${ticketUrl}" class="button">View Ticket</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "ticket_updated":
      return {
        subject: `Ticket Updated: ${ticket.title}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Your ticket has been updated</h2>
            </div>
            <div class="content">
              <h3>${ticket.title}</h3>
              <p>
                <span class="badge badge-${ticket.status === 'resolved' ? 'green' : 'amber'}">
                  Status: ${ticket.status.replace('_', ' ').toUpperCase()}
                </span>
              </p>
              <p>Your feedback ticket has been updated by our team.</p>
              <a href="${ticketUrl}" class="button">View Ticket</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "admin_reply":
      return {
        subject: `New Reply: ${ticket.title}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">You have a new reply</h2>
            </div>
            <div class="content">
              <h3>${ticket.title}</h3>
              <p>The AlkaTera support team has replied to your ticket:</p>
              ${message ? `<blockquote>${message.message}</blockquote>` : ''}
              <a href="${ticketUrl}" class="button">View Conversation</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    case "escalated":
      return {
        subject: `Ticket Escalated: ${ticket.title}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
              <h2 style="margin: 0;">Ticket Priority Escalated</h2>
            </div>
            <div class="content">
              <h3>${ticket.title}</h3>
              <p>
                <span class="badge badge-amber">Priority: ${ticket.priority.toUpperCase()}</span>
              </p>
              <p>Your ticket has been escalated to ensure it gets the attention it needs.</p>
              <a href="${ticketUrl}" class="button">View Ticket</a>
            </div>
            <div class="footer">
              <p>AlkaTera - Sustainability Platform</p>
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: `Ticket Updated: ${ticket.title}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Ticket Update</h2>
            </div>
            <div class="content">
              <h3>${ticket.title}</h3>
              <p>There's an update on your ticket.</p>
              <a href="${ticketUrl}" class="button">View Ticket</a>
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
      from: "AlkaTera <notifications@alkatera.com>",
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
