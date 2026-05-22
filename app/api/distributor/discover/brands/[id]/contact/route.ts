import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDistributor } from '@/lib/distributor/auth';
import {
  EMAIL_FROM,
  renderDirectoryContactEmail,
} from '@/lib/distributor/outreach/email-templates';
import { hasRecentContact, logContact } from '@/lib/admin/telemetry/log';

const RATE_LIMIT_HOURS = 24 * 7;

/**
 * POST /api/distributor/discover/brands/[id]/contact
 * Body: { subject?: string, message: string }
 *
 * Lets a distributor send a one-shot enquiry to a brand they found in
 * the industry directory but don't yet list. Recipient resolution
 * (first hit wins):
 *
 *   1. If brand_directory.alkatera_org_id is set → the org's owner
 *      member email (via auth.admin.getUserById).
 *   2. The latest non-superseded `contact_email` finding in
 *      scraped_brand_data for the directory entry.
 *
 * The email is sent via Resend with the distributor's logged-in user
 * email set as reply-to so any response goes straight back to them.
 *
 * Discovery opt-out (brand-side switch) blocks contact too — if a
 * brand has hidden themselves from the directory they should also be
 * shielded from cold enquiries.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { subject?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const subject =
    typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : null;
  if (!message) {
    return NextResponse.json(
      { error: 'invalid_body', detail: 'message is required' },
      { status: 400 },
    );
  }
  if (message.length > 5000) {
    return NextResponse.json(
      { error: 'message_too_long', detail: 'max 5000 characters' },
      { status: 400 },
    );
  }

  // 1. Look up the directory entry, refuse if opted out of discovery.
  const { data: directoryRow } = await auth.supabase
    .from('brand_directory')
    .select('id, name, alkatera_org_id, discovery_opt_out')
    .eq('id', params.id)
    .maybeSingle();
  if (!directoryRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const directory = directoryRow as {
    id: string;
    name: string;
    alkatera_org_id: string | null;
    discovery_opt_out: boolean;
  };
  if (directory.discovery_opt_out) {
    return NextResponse.json({ error: 'not_discoverable' }, { status: 403 });
  }

  // 2. Rate-limit: one contact per (distributor, brand) per 7 days.
  //    Prevents accidental double-clicks AND spam-style bombardment.
  const recentlyContacted = await hasRecentContact(auth.supabase, {
    distributorOrgId: auth.organization.id,
    brandDirectoryId: directory.id,
    withinHours: RATE_LIMIT_HOURS,
  });
  if (recentlyContacted) {
    await logContact(auth.supabase, {
      distributorOrgId: auth.organization.id,
      senderUserId: auth.user.id,
      brandDirectoryId: directory.id,
      recipientEmailRedacted: null,
      subject: subject ?? null,
      message,
      status: 'blocked',
      errorMessage: 'rate_limited',
    });
    return NextResponse.json(
      {
        error: 'rate_limited',
        detail:
          "You've already contacted this brand in the last 7 days. Give them a moment to respond before sending again.",
      },
      { status: 429 },
    );
  }

  // 3. Resolve recipient email.
  const recipient = await resolveRecipientEmail(auth.supabase, directory);
  if (!recipient) {
    return NextResponse.json(
      {
        error: 'no_contact_channel',
        detail:
          "We don't have an email on file for this brand yet. Once they verify their alka**tera** profile or finding turns up a contact address, you'll be able to reach them.",
      },
      { status: 422 },
    );
  }

  // 3. Send via Resend. Reply-to is the distributor's user email so a
  //    reply lands in their inbox, not a shared alka**tera** inbox.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'mailer_not_configured', detail: 'RESEND_API_KEY missing' },
      { status: 500 },
    );
  }
  const senderEmail = auth.user.email ?? 'noreply@alkatera.com';
  const senderName =
    (auth.member as { display_name?: string | null }).display_name || senderEmail;
  const rendered = renderDirectoryContactEmail({
    brandName: directory.name,
    distributorName: auth.organization.name,
    senderName,
    senderEmail,
    subject: subject ?? '',
    message,
  });
  const resend = new Resend(apiKey);
  const redactedRecipient = redactEmail(recipient);
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [recipient],
      replyTo: senderEmail,
      subject: rendered.subject,
      html: rendered.html,
    });
    if (error) {
      await logContact(auth.supabase, {
        distributorOrgId: auth.organization.id,
        senderUserId: auth.user.id,
        brandDirectoryId: directory.id,
        recipientEmailRedacted: redactedRecipient,
        subject: subject ?? null,
        message,
        status: 'failed',
        errorMessage: error.message ?? 'resend_error',
      });
      return NextResponse.json(
        { error: 'send_failed', detail: error.message ?? 'resend_error' },
        { status: 502 },
      );
    }
    await logContact(auth.supabase, {
      distributorOrgId: auth.organization.id,
      senderUserId: auth.user.id,
      brandDirectoryId: directory.id,
      recipientEmailRedacted: redactedRecipient,
      subject: subject ?? null,
      message,
      status: 'sent',
      resendMessageId: data?.id ?? null,
    });
    return NextResponse.json({
      ok: true,
      message_id: data?.id ?? null,
      recipient_redacted: redactedRecipient,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    await logContact(auth.supabase, {
      distributorOrgId: auth.organization.id,
      senderUserId: auth.user.id,
      brandDirectoryId: directory.id,
      recipientEmailRedacted: redactedRecipient,
      subject: subject ?? null,
      message,
      status: 'failed',
      errorMessage: detail,
    });
    return NextResponse.json({ error: 'send_failed', detail }, { status: 502 });
  }
}

/**
 * Pick the email to contact. alka**tera**-linked brands win, because
 * we know that address belongs to a real user. Falls back to the
 * `contact_email` finding which may be a generic press inbox scraped
 * from the brand website.
 */
async function resolveRecipientEmail(
  supabase: SupabaseClient,
  directory: { alkatera_org_id: string | null; id: string },
): Promise<string | null> {
  if (directory.alkatera_org_id) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', directory.alkatera_org_id)
      // Prefer owner / admin if the schema uses those, but accept any member.
      .order('joined_at', { ascending: true });
    type MemberRow = { user_id: string; role: string | null };
    const ordered = ((members ?? []) as MemberRow[]).slice().sort((a, b) => {
      const rank = (r: string | null) =>
        r === 'owner' ? 0 : r === 'admin' ? 1 : r === 'member' ? 2 : 3;
      return rank(a.role) - rank(b.role);
    });
    for (const m of ordered) {
      try {
        const { data } = await (supabase.auth as unknown as {
          admin: {
            getUserById: (id: string) => Promise<{
              data: { user: { email?: string | null } | null };
            }>;
          };
        }).admin.getUserById(m.user_id);
        const email = data?.user?.email ?? null;
        if (email) return email;
      } catch {
        // try next member
      }
    }
  }

  const { data: finding } = await supabase
    .from('scraped_brand_data')
    .select('field_value, confidence, scraped_at')
    .eq('brand_directory_id', directory.id)
    .eq('field_key', 'contact_email')
    .is('superseded_by', null)
    .order('confidence', { ascending: false })
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const value = (finding as { field_value: string | null } | null)?.field_value;
  if (value && /.+@.+\..+/.test(value)) return value;
  return null;
}

function redactEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}
