import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// imapflow/mailparser are only ever imported here — never re-exported —
// so the browser bundle and the raw Netlify function bundler (the pnpm
// symlink issue documented in the root CLAUDE.md) never see them. This file
// only ever runs inside the Inngest webhook, itself a Next.js API route
// (app/api/inngest/route.ts) that webpack bundles normally, not a
// standalone zipped Netlify function.
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail, type Attachment } from 'mailparser';
import { inngest } from '../client';
import { orgForIntakeAddress, type ResolvedIntakeOrg } from '@/lib/intake/email-address';
import { isAllowedIntakeSender, findOrgMemberUserIdByEmail } from '@/lib/intake/spoof-guard';
import { enqueueIngestJob } from '@/lib/ingest/enqueue';

/**
 * Email-in intake poller (data-revolution-plan.md Pillar 1).
 *
 * alka**tera** has one kSuite mailbox, intake@alkatera.com, told orgs apart
 * with plus-addressing (intake+{token}@alkatera.com — see
 * lib/intake/email-address.ts). Every ten minutes the Netlify heartbeat
 * (netlify/functions/email-intake-poll.ts) sends 'email/intake.poll'; this
 * function connects over IMAP, reads UNSEEN messages from INBOX, and for
 * each one:
 *
 *   1. resolves the org from the To/Delivered-To plus-address (unknown
 *      token -> mark seen, log, move on — no error, someone probably typoed
 *      or an old token leaked);
 *   2. checks the sender against the spoof guard (an organisation member's
 *      email, or the org's confirmed allow-list) — a non-matching sender
 *      gets a rejected note on the Ask Queue (agent_exceptions, kind
 *      'email_rejected') and NO attachment is ever read or staged;
 *   3. stages each supported attachment (pdf/csv/xlsx/image, <=15MB) through
 *      exactly the path Smart Upload uses (lib/ingest/enqueue.ts) tagged
 *      channel: 'email_intake', so it shares the one classifier and the one
 *      ingest_document_profiles learning loop.
 *
 * Deliberately does NOT write agent_exceptions rows for staged attachments
 * itself — the Footprint Agent's existing sweep
 * (app/api/agents/footprint/run/route.ts) already turns any completed,
 * unqueued ingest_jobs row into an Ask Queue item idempotently, for every
 * channel. Duplicating that here would be a second, divergent copy of the
 * same logic, so this function just nudges that sweep (best-effort) once a
 * message stages at least one attachment.
 *
 * Every message is its own step.run with its own try/catch, so one
 * malformed or oversized email can never block the rest of the batch — and
 * every message is marked Seen exactly once its step finishes, success or
 * failure, so a permanently-broken email is never re-read forever.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

function readImapConfig(): ImapConfig | null {
  const host = process.env.EMAIL_INTAKE_HOST;
  const user = process.env.EMAIL_INTAKE_USER;
  const password = process.env.EMAIL_INTAKE_PASSWORD;
  if (!host || !user || !password) return null;
  const port = Number(process.env.EMAIL_INTAKE_PORT) || 993;
  const secure = process.env.EMAIL_INTAKE_SECURE !== 'false';
  return { host, port, secure, user, password };
}

/** Attachment kinds Smart Upload's classifier already knows how to read. */
const ALLOWED_ATTACHMENT_TYPES = /^(application\/pdf|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|image\/(png|jpe?g|webp|heic|heif))$/i;
const ALLOWED_ATTACHMENT_EXTENSIONS = /\.(pdf|csv|xlsx?|png|jpe?g|webp|heic|heif)$/i;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function isSupportedAttachment(att: Attachment): boolean {
  if (!att.content || att.content.length === 0) return false;
  if (att.content.length > MAX_ATTACHMENT_BYTES) return false;
  if (att.contentType && ALLOWED_ATTACHMENT_TYPES.test(att.contentType)) return true;
  if (att.filename && ALLOWED_ATTACHMENT_EXTENSIONS.test(att.filename)) return true;
  return false;
}

/** Every plausible recipient address on the message — To, Cc and the raw Delivered-To header. */
function recipientCandidates(parsed: ParsedMail): string[] {
  const out: string[] = [];
  const collect = (field: ParsedMail['to']) => {
    if (!field) return;
    const list = Array.isArray(field) ? field : [field];
    for (const addrObj of list) {
      for (const a of addrObj.value ?? []) {
        if (a.address) out.push(a.address);
      }
    }
  };
  collect(parsed.to);
  collect(parsed.cc);
  const deliveredTo = parsed.headers.get('delivered-to');
  if (typeof deliveredTo === 'string') out.push(deliveredTo);
  return out;
}

interface RawIntakeMessage {
  uid: number;
  source: Buffer;
}

/** Connect, list UNSEEN messages in INBOX, and pull their raw RFC822 source. Not wrapped in step.run — a retry of the whole invocation simply reconnects and re-reads, which is safe (IMAP UNSEEN read has no side effects). */
async function fetchUnseenMessages(config: ImapConfig): Promise<RawIntakeMessage[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });
  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    const uids = await client.search({ seen: false }, { uid: true });
    if (!uids || uids.length === 0) return [];
    const messages: RawIntakeMessage[] = [];
    for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
      if (msg.source) messages.push({ uid: msg.uid, source: Buffer.from(msg.source) });
    }
    return messages;
  } finally {
    await client.logout().catch(() => {});
  }
}

async function markSeen(config: ImapConfig, uid: number): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });
  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Who to attribute the ingest_jobs row to: the matched member if the sender is one, otherwise the org's owner (an allow-listed non-member still needs a real user_id on the row). */
async function resolveAttributionUserId(
  db: SupabaseClient,
  organizationId: string,
  senderEmail: string
): Promise<string | null> {
  const memberUserId = await findOrgMemberUserIdByEmail(db, organizationId, senderEmail);
  if (memberUserId) return memberUserId;

  const { data: owners } = await db
    .from('organization_members')
    .select('user_id, roles!inner(name)')
    .eq('organization_id', organizationId)
    .in('roles.name', ['owner', 'admin'])
    .limit(1);
  const ownerRow = (owners as Array<{ user_id: string }> | null)?.[0];
  if (ownerRow) return ownerRow.user_id;

  const { data: anyMember } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle();
  return (anyMember as { user_id: string } | null)?.user_id ?? null;
}

async function recordRejectedSender(
  db: SupabaseClient,
  org: ResolvedIntakeOrg,
  senderEmail: string,
  matchedAddress: string,
  parsed: ParsedMail
): Promise<void> {
  const { error } = await db.from('agent_exceptions').insert({
    organization_id: org.id,
    kind: 'email_rejected',
    source: 'email',
    source_ref: {
      fromAddress: senderEmail,
      toAddress: matchedAddress,
      messageId: parsed.messageId ?? null,
    },
    payload: {
      subject: parsed.subject ?? null,
      receivedAt: parsed.date ? parsed.date.toISOString() : null,
    },
    title: `Unrecognised sender: ${senderEmail}`,
    summary: `An email to your intake address from ${senderEmail} wasn't processed — that address isn't a member of your organisation or on the confirmed senders list. Add it in Settings if this is expected.`,
    status: 'open',
  });
  if (error) console.error('[email-intake] recordRejectedSender failed:', error.message);
}

type MessageOutcome =
  | { outcome: 'unknown_org' }
  | { outcome: 'rejected'; organizationId: string }
  | { outcome: 'no_attachments'; organizationId: string }
  | { outcome: 'staged'; organizationId: string; attachmentCount: number }
  | { outcome: 'error'; error: string };

async function processMessage(db: SupabaseClient, raw: RawIntakeMessage): Promise<MessageOutcome> {
  const parsed = await simpleParser(raw.source);

  const candidates = recipientCandidates(parsed);
  let org: ResolvedIntakeOrg | null = null;
  let matchedAddress = '';
  for (const candidate of candidates) {
    const resolved = await orgForIntakeAddress(db, candidate);
    if (resolved) {
      org = resolved;
      matchedAddress = candidate;
      break;
    }
  }

  if (!org) {
    console.log('[email-intake] no org matched for recipients:', candidates.join(', '));
    return { outcome: 'unknown_org' };
  }

  const senderEmail = parsed.from?.value?.[0]?.address ?? '';
  const allowed = senderEmail
    ? await isAllowedIntakeSender(db, org.id, senderEmail, org.feature_flags)
    : false;

  if (!allowed) {
    await recordRejectedSender(db, org, senderEmail || '(no From address)', matchedAddress, parsed);
    return { outcome: 'rejected', organizationId: org.id };
  }

  const supported = (parsed.attachments || []).filter(isSupportedAttachment);
  if (supported.length === 0) {
    return { outcome: 'no_attachments', organizationId: org.id };
  }

  const userId = await resolveAttributionUserId(db, org.id, senderEmail);
  if (!userId) {
    console.error(`[email-intake] org ${org.id} has no members to attribute the upload to; skipping attachments`);
    return { outcome: 'no_attachments', organizationId: org.id };
  }

  let staged = 0;
  for (const att of supported) {
    try {
      await enqueueIngestJob({
        serviceClient: db,
        organizationId: org.id,
        userId,
        file: {
          bytes: new Uint8Array(att.content),
          name: att.filename || 'email-attachment',
          mime: att.contentType || '',
          size: att.content.length,
        },
        channel: 'email_intake',
      });
      staged += 1;
    } catch (err: any) {
      console.error(`[email-intake] failed to enqueue attachment for org ${org.id}:`, err?.message);
    }
  }

  return { outcome: staged > 0 ? 'staged' : 'no_attachments', organizationId: org.id, attachmentCount: staged };
}

/** Best-effort nudge to the existing Footprint Agent sweep so today's asks show up promptly instead of waiting for its own schedule. Never throws past this function — a failed nudge just means the sweep's own cadence (once wired) or the next poll picks it up. */
async function triggerFootprintSweep(): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.URL || process.env.DEPLOY_URL;
  if (!cronSecret || !baseUrl) return;
  try {
    await fetch(`${baseUrl}/api/agents/footprint/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
  } catch (err: any) {
    console.error('[email-intake] footprint sweep nudge failed:', err?.message);
  }
}

export const emailIntakePoll = inngest.createFunction(
  {
    id: 'email-intake-poll',
    name: 'Email-in: poll the intake mailbox',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'email/intake.poll' }],
  },
  async ({ step }) => {
    const config = readImapConfig();
    if (!config) {
      console.warn('[email-intake] no-op: EMAIL_INTAKE_HOST/USER/PASSWORD not configured');
      return { ok: false, reason: 'not configured' };
    }

    const db = service();

    const messages = await fetchUnseenMessages(config).catch((err: unknown) => {
      console.error('[email-intake] IMAP fetch failed:', (err as Error)?.message);
      return [] as RawIntakeMessage[];
    });

    if (messages.length === 0) {
      return { ok: true, processed: 0 };
    }

    let rejected = 0;
    let staged = 0;
    let unknownOrg = 0;
    let errored = 0;
    const affectedOrgs = new Set<string>();

    for (const msg of messages) {
      const outcome = await step.run(`message-${msg.uid}`, async () => {
        let result: MessageOutcome;
        try {
          result = await processMessage(db, msg);
        } catch (err: any) {
          console.error(`[email-intake] message uid ${msg.uid} failed:`, err?.message);
          result = { outcome: 'error', error: err?.message || 'unknown error' };
        }
        // Mark Seen inside the step so a retry of this exact step (not the
        // whole invocation) doesn't re-flag it — and so a message is never
        // left UNSEEN forever just because processing threw.
        await markSeen(config, msg.uid).catch((err: unknown) =>
          console.error(`[email-intake] markSeen failed for uid ${msg.uid}:`, (err as Error)?.message)
        );
        return result;
      });

      switch (outcome.outcome) {
        case 'unknown_org':
          unknownOrg += 1;
          break;
        case 'rejected':
          rejected += 1;
          affectedOrgs.add(outcome.organizationId);
          break;
        case 'staged':
          staged += outcome.attachmentCount;
          affectedOrgs.add(outcome.organizationId);
          break;
        case 'no_attachments':
          affectedOrgs.add(outcome.organizationId);
          break;
        case 'error':
          errored += 1;
          break;
      }
    }

    if (staged > 0) {
      await step.run('nudge-footprint-sweep', () => triggerFootprintSweep());
    }

    return {
      ok: true,
      processed: messages.length,
      staged,
      rejected,
      unknownOrg,
      errored,
      orgs: affectedOrgs.size,
    };
  }
);
