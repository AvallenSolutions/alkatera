import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/utils/escape-html';
import { getSiteUrl, EMAIL_FROM } from '../outreach/email-templates';

let cachedClient: Resend | null = null;
function getResend(): Resend | null {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient = new Resend(key);
  return cachedClient;
}

const LOGO_URL = 'https://alkatera.com/logo.png';

export interface NewLinkEmailArgs {
  distributorName: string;
  alkateraOrgName: string;
  needsBrandConfirmation: boolean;
}

/**
 * Build the HTML for the email we send the alkatera org's owners when a
 * distributor links to their account. When the match was high-confidence
 * (auto-linked) the email is informational with an opt-out CTA; when it
 * was lower-confidence (manual / fuzzy), the email asks the brand to
 * confirm the link before tier upgrades take effect.
 */
function renderNewLinkEmail(args: NewLinkEmailArgs): { subject: string; html: string } {
  const safeDistributor = escapeHtml(args.distributorName);
  const safeBrand = escapeHtml(args.alkateraOrgName);
  const settingsUrl = `${getSiteUrl()}/dashboard/settings/distributors`;

  const subject = args.needsBrandConfirmation
    ? `${args.distributorName} would like to connect to your alkatera profile`
    : `${args.distributorName} has connected to your alkatera profile`;

  const introCopy = args.needsBrandConfirmation
    ? `<strong style="color: #1A1B1D;">${safeDistributor}</strong> has identified <strong style="color: #1A1B1D;">${safeBrand}</strong> in their distributor portfolio and would like to connect to your alkatera account. We have not shared your data yet — please confirm or reject the request from your account.`
    : `<strong style="color: #1A1B1D;">${safeDistributor}</strong> distributes your products and has connected to your alkatera profile. They can now see your verified sustainability data in real time.`;

  const ctaLabel = args.needsBrandConfirmation ? 'Review request' : 'Manage distributors';

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F2F1EA; color: #1A1B1D; padding: 40px; border: 1px solid #D9D6CB;">
      <div style="border-bottom: 1px solid #D9D6CB; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
        <img src="${LOGO_URL}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
        <h1 style="color: #205E40; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Distributor Connection</h1>
      </div>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">Hi ${safeBrand} team,</p>
      <p style="color: #1A1B1D; font-size: 14px; line-height: 1.8;">${introCopy}</p>
      <div style="margin: 32px 0; text-align: center;">
        <a href="${settingsUrl}" style="display: inline-block; background: #1A1B1D; color: #F2F1EA; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none;">${escapeHtml(ctaLabel)} →</a>
      </div>
      <p style="color: #6F6F68; font-size: 12px; line-height: 1.8;">
        You can revoke this connection at any time from <strong style="color: #1A1B1D;">Settings → Distributors</strong> in your alkatera dashboard. You also control which specific data fields are shared.
      </p>
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #D9D6CB; color: #6F6F68; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">
        Sent via alka<strong>tera</strong>
      </div>
    </div>
  `;
  return { subject, html };
}

/**
 * Send the new-link email to every owner of the alkatera org. Best-effort —
 * caller swallows failures so the link itself is the source of truth.
 */
export async function sendNewLinkEmailToBrand(
  supabase: SupabaseClient,
  alkateraOrgId: string,
  args: NewLinkEmailArgs,
): Promise<{ sent: number; error?: string }> {
  const client = getResend();
  if (!client) return { sent: 0, error: 'RESEND_API_KEY not configured' };

  const owners = await resolveOwnerEmails(supabase, alkateraOrgId);
  if (owners.length === 0) return { sent: 0, error: 'no_owners' };

  const rendered = renderNewLinkEmail(args);
  try {
    await client.emails.send({
      from: EMAIL_FROM,
      to: owners,
      subject: rendered.subject,
      html: rendered.html,
    });
    return { sent: owners.length };
  } catch (err: unknown) {
    return { sent: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resolve owner emails for an alkatera organization. Tries the
 * `organization_members` + `roles` join first (the canonical alkatera
 * model). Falls back to "all members" if no owner role exists for the
 * org — we'd rather email everyone than nobody.
 */
async function resolveOwnerEmails(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string[]> {
  // Step 1: pull member user ids — preferring owners, then admins, then any.
  let userIds: string[] = [];

  try {
    const { data: ownerRows } = await supabase
      .from('organization_members')
      .select('user_id, roles!inner(name)')
      .eq('organization_id', orgId)
      .eq('roles.name', 'owner');
    userIds = (ownerRows ?? []).map((r: { user_id: string }) => r.user_id);
  } catch {
    // org_members might not have the roles join in some schemas — fall through
  }

  if (userIds.length === 0) {
    const { data: allMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .limit(10);
    userIds = (allMembers ?? []).map((r: { user_id: string }) => r.user_id);
  }
  if (userIds.length === 0) return [];

  const emails: string[] = [];
  for (const id of userIds) {
    try {
      const { data } = await (
        supabase.auth as unknown as {
          admin: {
            getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } }>;
          };
        }
      ).admin.getUserById(id);
      if (data?.user?.email) emails.push(data.user.email);
    } catch {
      // service role may not be configured in dev — skip
    }
  }
  return emails;
}
