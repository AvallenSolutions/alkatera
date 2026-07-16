import 'server-only';
import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-org email-in address (data-revolution-plan.md Pillar 1).
 *
 * alka**tera** has one kSuite mailbox — intake@alkatera.com — and tells orgs
 * apart with plus-addressing: intake+{token}@alkatera.com. The token is a
 * short random string, not a slug, so a guessed org name can't be used to
 * fish for another org's inbox.
 *
 * Storage: `organizations.agent_inbox_address` is an existing, currently
 * unused text column with a unique partial index
 * (organizations_agent_inbox_idx) already sitting in the baseline schema —
 * the name and shape are exactly this concept, so it's reused rather than
 * adding a jsonb key or a migration. It stores the bare token (e.g.
 * '8f3ka2b9q1'), not the full address, so the domain/local-part can move
 * (env-configurable below) without a data migration.
 *
 * The sender allow-list (Pillar 1 step 5) lives in the sibling jsonb column
 * `organizations.feature_flags.email_intake_allowlist` — an array of
 * lower-cased email addresses the spoof guard (lib/intake/spoof-guard.ts)
 * treats as trusted in addition to organisation members.
 */

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 10;
const DEFAULT_DOMAIN = 'alkatera.com';
const MAX_ALLOCATE_ATTEMPTS = 5;

/** 10 lowercase alphanumerics, drawn from a CSPRNG (not Math.random). */
export function generateIntakeToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return token;
}

/**
 * Domain to build intake addresses on. Reads the host out of
 * EMAIL_INTAKE_ADDRESS (e.g. 'intake@alkatera.com' or just 'alkatera.com')
 * so the poller and the address builder always agree; falls back to
 * alkatera.com so the settings panel has something sensible to show before
 * the env var is ever set.
 */
export function intakeDomain(): string {
  const raw = process.env.EMAIL_INTAKE_ADDRESS?.trim();
  if (!raw) return DEFAULT_DOMAIN;
  const at = raw.lastIndexOf('@');
  const domain = (at >= 0 ? raw.slice(at + 1) : raw).trim();
  return domain || DEFAULT_DOMAIN;
}

/** Build the full plus-addressed intake address for a given token. */
export function intakeAddressForToken(token: string): string {
  return `intake+${token}@${intakeDomain()}`;
}

/**
 * Pull the token back out of a To/Delivered-To address. Case-insensitive;
 * tolerates a leading display name ("Org Intake <intake+xyz@alkatera.com>")
 * because callers typically pass the already-extracted bare address, but a
 * defensive regex still copes with the raw header form.
 */
export function parseIntakeToken(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = /intake\+([a-z0-9]+)@/i.exec(address.trim());
  return match ? match[1].toLowerCase() : null;
}

export interface OrgIntakeRow {
  id: string;
  agent_inbox_address: string | null;
}

/**
 * Ensure the org has a token, generating and persisting one lazily on first
 * use (settings-panel view or first inbound email, whichever comes first).
 * Retries on the rare unique-index collision; if a concurrent request wins
 * the race, re-reads and returns whatever token landed.
 */
export async function ensureIntakeToken(
  db: SupabaseClient,
  org: OrgIntakeRow
): Promise<string> {
  if (org.agent_inbox_address) return org.agent_inbox_address;

  for (let attempt = 0; attempt < MAX_ALLOCATE_ATTEMPTS; attempt++) {
    const token = generateIntakeToken();
    const { data, error } = await db
      .from('organizations')
      .update({ agent_inbox_address: token })
      .eq('id', org.id)
      .is('agent_inbox_address', null)
      .select('agent_inbox_address')
      .maybeSingle();

    if (!error && data?.agent_inbox_address) return data.agent_inbox_address;

    // Either a unique-index collision (retry with a fresh token) or another
    // request already set the column (the .is() filter matched nothing) —
    // either way, re-read the current value before trying again.
    const { data: current } = await db
      .from('organizations')
      .select('agent_inbox_address')
      .eq('id', org.id)
      .maybeSingle();
    if (current?.agent_inbox_address) return current.agent_inbox_address;
  }

  throw new Error('Could not allocate an intake address token');
}

/** The org's full intake address, generating the token on first call. */
export async function intakeAddressForOrg(
  db: SupabaseClient,
  org: OrgIntakeRow
): Promise<string> {
  const token = await ensureIntakeToken(db, org);
  return intakeAddressForToken(token);
}

export interface ResolvedIntakeOrg {
  id: string;
  name: string;
  feature_flags: Record<string, unknown> | null;
}

/**
 * Resolve an inbound To/Delivered-To address back to its organisation.
 * Returns null when the address doesn't carry a recognisable intake token,
 * or no org owns that token (a stale/guessed token) — callers should mark
 * the message seen and move on rather than treat this as an error.
 */
export async function orgForIntakeAddress(
  db: SupabaseClient,
  address: string
): Promise<ResolvedIntakeOrg | null> {
  const token = parseIntakeToken(address);
  if (!token) return null;

  const { data, error } = await db
    .from('organizations')
    .select('id, name, feature_flags')
    .ilike('agent_inbox_address', token)
    .maybeSingle();

  if (error || !data) return null;
  return data as ResolvedIntakeOrg;
}
