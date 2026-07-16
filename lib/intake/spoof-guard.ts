import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Spoof guard for email-in intake (data-revolution-plan.md Pillar 1).
 *
 * Anyone who learns an org's intake+{token}@alkatera.com address could try
 * to email it directly, so before an attachment is ever staged the sender
 * must be someone we trust for that org: a current organisation_members
 * email (joined through profiles, which is where the app already keeps
 * verified emails alongside auth.users — see lib/certifications/recalculate.ts
 * for the same join pattern), OR an address on the org's own allow-list
 * (organizations.feature_flags.email_intake_allowlist, managed from the
 * settings panel — e.g. a bookkeeper or supplier the org has confirmed).
 *
 * Comparison is always case-insensitive; email local parts are conventionally
 * case-insensitive in practice and IMAP headers are inconsistent about it.
 */

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/** Read the confirmed allow-list off an org's feature_flags jsonb. Never throws. */
export function readAllowlist(featureFlags: Record<string, unknown> | null | undefined): string[] {
  const raw = featureFlags?.email_intake_allowlist;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').map(normalise);
}

/** Write the allow-list back into a feature_flags patch (spread over the existing object). */
export function withAllowlist(
  featureFlags: Record<string, unknown> | null | undefined,
  allowlist: string[]
): Record<string, unknown> {
  return {
    ...(featureFlags ?? {}),
    email_intake_allowlist: Array.from(new Set(allowlist.map(normalise))).filter(Boolean),
  };
}

/**
 * The user_id of the organisation_members row whose profile email matches
 * `senderEmail`, or null if no member matches. Shared by the spoof guard
 * itself and by the poller's "who do we attribute this upload to" lookup
 * (lib/inngest/functions/email-intake.ts) so both do the one join, not two.
 */
export async function findOrgMemberUserIdByEmail(
  db: SupabaseClient,
  organizationId: string,
  senderEmail: string
): Promise<string | null> {
  if (!senderEmail) return null;
  const { data: members, error } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId);
  if (error || !members || members.length === 0) return null;

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, email')
    .in('id', userIds);
  if (profErr || !profiles) return null;

  const target = normalise(senderEmail);
  const match = profiles.find((p: { id: string; email: string }) => normalise(p.email) === target);
  return match?.id ?? null;
}

/**
 * True when `senderEmail` is trusted to submit documents for `organizationId`
 * — either a member of the org, or on its confirmed allow-list. Any lookup
 * failure fails closed (returns false); a spoof guard that fails open
 * defeats its own purpose.
 */
export async function isAllowedIntakeSender(
  db: SupabaseClient,
  organizationId: string,
  senderEmail: string,
  featureFlags?: Record<string, unknown> | null
): Promise<boolean> {
  if (!senderEmail) return false;

  const allowlist = readAllowlist(featureFlags);
  if (allowlist.includes(normalise(senderEmail))) return true;

  const memberUserId = await findOrgMemberUserIdByEmail(db, organizationId, senderEmail);
  return memberUserId !== null;
}
