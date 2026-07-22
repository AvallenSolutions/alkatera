import { describe, it, expect } from 'vitest';
import { organizationClaim, decodeJwtPayload } from '../organization-claim';

/** Build a token with the given payload. Signature is irrelevant: never verified here. */
function token(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${body}.signature`;
}

const ORG = '11111111-1111-1111-1111-111111111111';

describe('organizationClaim', () => {
  it('reads the organisation out of app_metadata', () => {
    expect(
      organizationClaim(token({ app_metadata: { current_organization_id: ORG } }))
    ).toBe(ORG);
  });

  it('ignores user_metadata, which is not what RLS reads', () => {
    // The whole point of the check is whether the AUTHORITATIVE claim moved.
    // Falling back to user_metadata would report success on the exact failure
    // this function exists to catch.
    expect(
      organizationClaim(token({ user_metadata: { current_organization_id: ORG } }))
    ).toBeNull();
  });

  it('returns null for a token with no organisation on it', () => {
    expect(organizationClaim(token({ app_metadata: {} }))).toBeNull();
    expect(organizationClaim(token({ sub: 'abc' }))).toBeNull();
  });

  it('returns null rather than throwing on anything unreadable', () => {
    expect(organizationClaim(null)).toBeNull();
    expect(organizationClaim(undefined)).toBeNull();
    expect(organizationClaim('')).toBeNull();
    expect(organizationClaim('not-a-jwt')).toBeNull();
    expect(organizationClaim('a.b')).toBeNull();
    expect(organizationClaim('header.@@@notbase64@@@.sig')).toBeNull();
  });

  it('ignores a non-string claim', () => {
    expect(
      organizationClaim(token({ app_metadata: { current_organization_id: 42 } }))
    ).toBeNull();
  });

  it('handles base64url payloads that need re-padding', () => {
    // Payload lengths that are not a multiple of 4 in base64 are the normal
    // case for real tokens, and atob rejects them without padding.
    for (const pad of ['a', 'ab', 'abc', 'abcd']) {
      const t = token({ pad, app_metadata: { current_organization_id: ORG } });
      expect(organizationClaim(t)).toBe(ORG);
    }
  });
});

describe('decodeJwtPayload', () => {
  it('returns the payload object', () => {
    expect(decodeJwtPayload(token({ sub: 'user-1' }))).toEqual({ sub: 'user-1' });
  });

  it('returns null when the payload is not an object', () => {
    const body = Buffer.from(JSON.stringify('a string')).toString('base64');
    expect(decodeJwtPayload(`h.${body}.s`)).toBeNull();
  });
});
