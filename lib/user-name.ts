/**
 * What do we call this person?
 *
 * The greeting on the desk ("Good morning, Tim.") used to read
 * `user_metadata.full_name` and nothing else, so anyone who signed up
 * without giving a name — or who was invited, or migrated — got a bare
 * "Good morning." forever. Three sources, best first:
 *
 *   1. auth user_metadata.full_name  (set at signup)
 *   2. profiles.full_name            (set later in Settings > Profile)
 *   3. the email local part          (tim@alkatera.com → "Tim")
 *
 * The email is a last resort and deliberately fussy: a role address like
 * hello@ or a long slug like avallensolutions@ is worse than no name at
 * all, so those are rejected and the greeting simply stays bare.
 */

/** Addresses that are a team, not a person. Never greet these by name. */
const ROLE_LOCAL_PARTS = new Set([
  'admin',
  'accounts',
  'contact',
  'hello',
  'help',
  'info',
  'mail',
  'me',
  'no-reply',
  'noreply',
  'office',
  'sales',
  'support',
  'team',
]);

/** Longer than this and it is a company slug, not a first name. */
const MAX_EMAIL_NAME_LENGTH = 12;

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * The first name from an email local part, or null when it does not look
 * like one. "tim.etherington-judge" → "Tim"; "avallensolutions" → null.
 */
function firstNameFromEmail(email: string | null | undefined): string | null {
  // Must actually be an address: without this, any stray string would be
  // read as a local part ("not-an-email" → "Not").
  const [local, domain] = (email ?? '').trim().toLowerCase().split('@');
  if (!local || !domain) return null;
  if (ROLE_LOCAL_PARTS.has(local)) return null;
  // Take the first segment of tim.smith / tim_smith / tim-smith, and drop
  // any trailing digits (tim2, tim1984).
  const first = local.split(/[._+-]/)[0].replace(/\d+$/, '');
  if (first.length < 2 || first.length > MAX_EMAIL_NAME_LENGTH) return null;
  // Anything left with a digit or a non-letter in it is a handle, not a name.
  if (!/^[a-z]+$/.test(first)) return null;
  return titleCase(first);
}

/**
 * The name to greet someone by, or null to greet them without one.
 * Pass whatever you have; every argument is optional.
 */
export function firstNameFor(sources: {
  metadataFullName?: string | null;
  profileFullName?: string | null;
  email?: string | null;
}): string | null {
  const full = sources.metadataFullName?.trim() || sources.profileFullName?.trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) return first;
  }
  return firstNameFromEmail(sources.email);
}
