import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EMAIL_FROM,
  renderInitialOutreachEmail,
  renderReminderEmail,
  renderSubmissionReceiptEmail,
  renderDistributorNotificationEmail,
  type InitialOutreachArgs,
  type SubmissionReceiptArgs,
  type DistributorNotificationArgs,
} from './email-templates';

export interface SendOutreachArgs extends InitialOutreachArgs {
  recipient: string;
  emailType: 'initial' | 'reminder';
  /** Reply-to lets brand replies route back to the distributor. */
  replyTo?: string | null;
}

export interface SendOutreachResult {
  ok: boolean;
  message_id?: string | null;
  error?: string;
}

let cachedClient: Resend | null = null;
function getResend(): Resend | null {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient = new Resend(key);
  return cachedClient;
}

/**
 * Send an outreach email (initial or reminder) and return whatever
 * Resend gave back. Caller is responsible for persisting the
 * outreach_emails audit row.
 */
export async function sendOutreachEmail(args: SendOutreachArgs): Promise<SendOutreachResult> {
  const client = getResend();
  if (!client) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  const rendered =
    args.emailType === 'initial' ? renderInitialOutreachEmail(args) : renderReminderEmail(args);

  try {
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: [args.recipient],
      replyTo: args.replyTo || 'hello@alkatera.com',
      subject: rendered.subject,
      html: rendered.html,
    });
    if (error) return { ok: false, error: error.message ?? 'resend_error' };
    return { ok: true, message_id: data?.id ?? null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function sendSubmissionReceipt(
  to: string,
  args: SubmissionReceiptArgs,
): Promise<SendOutreachResult> {
  const client = getResend();
  if (!client) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const rendered = renderSubmissionReceiptEmail(args);
  try {
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: rendered.subject,
      html: rendered.html,
    });
    if (error) return { ok: false, error: error.message ?? 'resend_error' };
    return { ok: true, message_id: data?.id ?? null };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendDistributorNotification(
  recipients: string[],
  args: DistributorNotificationArgs,
): Promise<SendOutreachResult> {
  if (recipients.length === 0) return { ok: false, error: 'no_recipients' };
  const client = getResend();
  if (!client) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const rendered = renderDistributorNotificationEmail(args);
  try {
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
    });
    if (error) return { ok: false, error: error.message ?? 'resend_error' };
    return { ok: true, message_id: data?.id ?? null };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resolve the email addresses of every owner of a distributor org.
 * Used to notify the distributor when a brand submits documents. Uses
 * the service-role auth admin API because we need to read auth.users.
 */
export async function getOwnerEmails(
  supabase: SupabaseClient,
  distributorOrgId: string,
): Promise<string[]> {
  const { data: members } = await supabase
    .from('distributor_members')
    .select('user_id')
    .eq('distributor_org_id', distributorOrgId)
    .eq('role', 'owner');
  if (!members || members.length === 0) return [];

  const emails: string[] = [];
  for (const member of members as Array<{ user_id: string }>) {
    try {
      const { data } = await (supabase.auth as unknown as {
        admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } }> };
      }).admin.getUserById(member.user_id);
      if (data?.user?.email) emails.push(data.user.email);
    } catch {
      // skip — service role may not be configured in dev
    }
  }
  return emails;
}
