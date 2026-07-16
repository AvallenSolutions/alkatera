import { describe, expect, it } from 'vitest';
import {
  readAllowlist,
  withAllowlist,
  findOrgMemberUserIdByEmail,
  isAllowedIntakeSender,
} from '../spoof-guard';
import { createMockDb } from './mock-db';

describe('readAllowlist / withAllowlist', () => {
  it('reads an empty list when feature_flags has none', () => {
    expect(readAllowlist(null)).toEqual([]);
    expect(readAllowlist({})).toEqual([]);
    expect(readAllowlist({ email_intake_allowlist: 'not-an-array' })).toEqual([]);
  });

  it('lower-cases and filters the stored list', () => {
    expect(readAllowlist({ email_intake_allowlist: ['Ops@Supplier.com', 42, 'bookkeeper@firm.com'] })).toEqual([
      'ops@supplier.com',
      'bookkeeper@firm.com',
    ]);
  });

  it('merges the new list into feature_flags without dropping other keys', () => {
    const next = withAllowlist({ some_other_flag: true }, ['New@Person.com', 'new@person.com', '']);
    expect(next.some_other_flag).toBe(true);
    expect(next.email_intake_allowlist).toEqual(['new@person.com']);
  });
});

describe('findOrgMemberUserIdByEmail', () => {
  it('returns null for an empty sender', async () => {
    const db = createMockDb({});
    expect(await findOrgMemberUserIdByEmail(db as any, 'org-1', '')).toBeNull();
    expect(db.calls.length).toBe(0);
  });

  it('returns null when the org has no members', async () => {
    const db = createMockDb({ organization_members: [{ data: [], error: null }] });
    expect(await findOrgMemberUserIdByEmail(db as any, 'org-1', 'tim@alkatera.com')).toBeNull();
  });

  it('matches case-insensitively against member profile emails', async () => {
    const db = createMockDb({
      organization_members: [{ data: [{ user_id: 'u-1' }, { user_id: 'u-2' }], error: null }],
      profiles: [
        {
          data: [
            { id: 'u-1', email: 'tim@alkatera.com' },
            { id: 'u-2', email: 'other@alkatera.com' },
          ],
          error: null,
        },
      ],
    });
    const userId = await findOrgMemberUserIdByEmail(db as any, 'org-1', 'TIM@Alkatera.com');
    expect(userId).toBe('u-1');
  });

  it('returns null when no profile email matches', async () => {
    const db = createMockDb({
      organization_members: [{ data: [{ user_id: 'u-1' }], error: null }],
      profiles: [{ data: [{ id: 'u-1', email: 'tim@alkatera.com' }], error: null }],
    });
    const userId = await findOrgMemberUserIdByEmail(db as any, 'org-1', 'stranger@example.com');
    expect(userId).toBeNull();
  });
});

describe('isAllowedIntakeSender', () => {
  it('rejects an empty sender outright', async () => {
    const db = createMockDb({});
    expect(await isAllowedIntakeSender(db as any, 'org-1', '')).toBe(false);
  });

  it('allows an address on the confirmed allow-list without querying membership', async () => {
    const db = createMockDb({});
    const allowed = await isAllowedIntakeSender(db as any, 'org-1', 'bookkeeper@firm.com', {
      email_intake_allowlist: ['bookkeeper@firm.com'],
    });
    expect(allowed).toBe(true);
    expect(db.calls.length).toBe(0);
  });

  it('allows an organisation member not on the allow-list', async () => {
    const db = createMockDb({
      organization_members: [{ data: [{ user_id: 'u-1' }], error: null }],
      profiles: [{ data: [{ id: 'u-1', email: 'tim@alkatera.com' }], error: null }],
    });
    const allowed = await isAllowedIntakeSender(db as any, 'org-1', 'tim@alkatera.com', {});
    expect(allowed).toBe(true);
  });

  it('rejects a sender who is neither a member nor allow-listed', async () => {
    const db = createMockDb({
      organization_members: [{ data: [{ user_id: 'u-1' }], error: null }],
      profiles: [{ data: [{ id: 'u-1', email: 'tim@alkatera.com' }], error: null }],
    });
    const allowed = await isAllowedIntakeSender(db as any, 'org-1', 'spoofer@evil.com', {
      email_intake_allowlist: ['someone-else@example.com'],
    });
    expect(allowed).toBe(false);
  });
});
