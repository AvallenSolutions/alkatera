import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  generateIntakeToken,
  intakeDomain,
  intakeAddressForToken,
  parseIntakeToken,
  ensureIntakeToken,
  intakeAddressForOrg,
  orgForIntakeAddress,
} from '../email-address';
import { createMockDb } from './mock-db';

describe('generateIntakeToken', () => {
  it('produces 10 lowercase alphanumeric characters', () => {
    const token = generateIntakeToken();
    expect(token).toMatch(/^[a-z0-9]{10}$/);
  });

  it('is not deterministic across calls', () => {
    const a = generateIntakeToken();
    const b = generateIntakeToken();
    expect(a).not.toBe(b);
  });
});

describe('intakeDomain', () => {
  const original = process.env.EMAIL_INTAKE_ADDRESS;
  afterEach(() => {
    if (original === undefined) delete process.env.EMAIL_INTAKE_ADDRESS;
    else process.env.EMAIL_INTAKE_ADDRESS = original;
  });

  it('defaults to alkatera.com when unset', () => {
    delete process.env.EMAIL_INTAKE_ADDRESS;
    expect(intakeDomain()).toBe('alkatera.com');
  });

  it('reads the domain out of a full mailbox address', () => {
    process.env.EMAIL_INTAKE_ADDRESS = 'intake@alkatera.com';
    expect(intakeDomain()).toBe('alkatera.com');
  });

  it('accepts a bare domain too', () => {
    process.env.EMAIL_INTAKE_ADDRESS = 'mail.alkatera.com';
    expect(intakeDomain()).toBe('mail.alkatera.com');
  });
});

describe('intakeAddressForToken / parseIntakeToken', () => {
  it('round-trips a token through the built address', () => {
    const address = intakeAddressForToken('8f3ka2b9q1');
    expect(address).toBe('intake+8f3ka2b9q1@alkatera.com');
    expect(parseIntakeToken(address)).toBe('8f3ka2b9q1');
  });

  it('is case-insensitive and copes with a display name', () => {
    expect(parseIntakeToken('Org Intake <INTAKE+8F3ka2B9q1@alkatera.com>')).toBe('8f3ka2b9q1');
  });

  it('returns null for a non-intake address', () => {
    expect(parseIntakeToken('hello@alkatera.com')).toBeNull();
    expect(parseIntakeToken(null)).toBeNull();
    expect(parseIntakeToken(undefined)).toBeNull();
  });
});

describe('ensureIntakeToken', () => {
  it('returns the existing token without touching the db', async () => {
    const db = createMockDb({});
    const token = await ensureIntakeToken(db as any, { id: 'org-1', agent_inbox_address: 'existingtok' });
    expect(token).toBe('existingtok');
    expect(db.calls.length).toBe(0);
  });

  it('allocates and persists a token when none exists', async () => {
    const db = createMockDb({
      organizations: [{ data: { agent_inbox_address: 'newlyminted' }, error: null }],
    });
    const token = await ensureIntakeToken(db as any, { id: 'org-1', agent_inbox_address: null });
    expect(token).toBe('newlyminted');
    const updateCall = db.calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
  });

  it('falls back to re-reading the row when the update lands on a concurrent write', async () => {
    // First update attempt returns nothing (another request won the .is() race),
    // the follow-up read finds the token that request set.
    const db = createMockDb({
      organizations: [
        { data: null, error: null },
        { data: { agent_inbox_address: 'wonbyother' }, error: null },
      ],
    });
    const token = await ensureIntakeToken(db as any, { id: 'org-1', agent_inbox_address: null });
    expect(token).toBe('wonbyother');
  });
});

describe('intakeAddressForOrg', () => {
  it('builds the full address from an ensured token', async () => {
    const db = createMockDb({});
    const address = await intakeAddressForOrg(db as any, { id: 'org-1', agent_inbox_address: 'abc1234567' });
    expect(address).toBe('intake+abc1234567@alkatera.com');
  });
});

describe('orgForIntakeAddress', () => {
  it('returns null when the address carries no intake token', async () => {
    const db = createMockDb({});
    const org = await orgForIntakeAddress(db as any, 'someone@alkatera.com');
    expect(org).toBeNull();
    expect(db.calls.length).toBe(0);
  });

  it('returns null when no org owns the token', async () => {
    const db = createMockDb({ organizations: [{ data: null, error: null }] });
    const org = await orgForIntakeAddress(db as any, 'intake+ghost000@alkatera.com');
    expect(org).toBeNull();
  });

  it('resolves the org that owns the token', async () => {
    const db = createMockDb({
      organizations: [
        { data: { id: 'org-9', name: 'Avallen Spirits', feature_flags: {} }, error: null },
      ],
    });
    const org = await orgForIntakeAddress(db as any, 'intake+abc1234567@alkatera.com');
    expect(org).toEqual({ id: 'org-9', name: 'Avallen Spirits', feature_flags: {} });
  });
});
