// Which organisation the access token actually claims.
//
// The active organisation lives in `app_metadata`, baked into the JWT at mint
// time. That claim — not React state, not the stored user object — is what
// `get_current_organization_id()`, the RLS policies and `get_user_bootstrap`
// read. So after switching organisation there is exactly one question worth
// asking: did the claim move? This answers it.
//
// Decoding is deliberately trust-free: the token is only ever READ here, never
// verified, because the client is not the party that verifies it. This exists
// to catch a switch that failed to take, not to make a security decision.

/** The `current_organization_id` claim, or null if there isn't a usable one. */
export function organizationClaim(accessToken: string | null | undefined): string | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;

  const appMetadata = payload.app_metadata;
  if (appMetadata && typeof appMetadata === 'object') {
    const value = (appMetadata as Record<string, unknown>).current_organization_id;
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

/** Middle segment of a JWT as an object, or null if it is not readable. */
export function decodeJwtPayload(
  token: string | null | undefined
): Record<string, unknown> | null {
  if (!token) return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    // JWTs are base64URL; atob wants plain base64, and the padding is optional
    // in the former but not the latter.
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('binary');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
