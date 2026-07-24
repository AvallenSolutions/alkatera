import { describe, it, expect } from 'vitest';
import { firstNameFor } from '../user-name';

describe('firstNameFor', () => {
  it('prefers the signup metadata name', () => {
    expect(
      firstNameFor({
        metadataFullName: 'Tim Etherington-Judge',
        profileFullName: 'Someone Else',
        email: 'other@alkatera.com',
      }),
    ).toBe('Tim');
  });

  it('falls back to the profile name when signup had none', () => {
    expect(
      firstNameFor({ metadataFullName: null, profileFullName: 'Local Dev', email: 'dev@local.test' }),
    ).toBe('Local');
  });

  it('treats a blank or whitespace name as absent', () => {
    expect(firstNameFor({ metadataFullName: '   ', profileFullName: 'Local Dev' })).toBe('Local');
  });

  it('falls back to the email local part — the case that was broken', () => {
    // tim@alkatera.com had no full_name in either place, so the desk
    // greeted him with nothing at all.
    expect(firstNameFor({ email: 'tim@alkatera.com' })).toBe('Tim');
  });

  it('reads a real name out of a dotted or hyphenated local part', () => {
    expect(firstNameFor({ email: 'tim.etherington-judge@alkatera.com' })).toBe('Tim');
    expect(firstNameFor({ email: 'john_smith@example.com' })).toBe('John');
    expect(firstNameFor({ email: 'anna+receipts@example.com' })).toBe('Anna');
  });

  it('drops trailing digits from a handle', () => {
    expect(firstNameFor({ email: 'tim2@example.com' })).toBe('Tim');
  });

  it('refuses a role address rather than greeting a mailbox by name', () => {
    for (const local of ['hello', 'info', 'support', 'admin', 'no-reply']) {
      expect(firstNameFor({ email: `${local}@example.com` })).toBeNull();
    }
  });

  it('refuses a company slug that is not a first name', () => {
    expect(firstNameFor({ email: 'avallensolutions@gmail.com' })).toBeNull();
    expect(firstNameFor({ email: 'a@example.com' })).toBeNull();
    expect(firstNameFor({ email: 'x1y2z3@example.com' })).toBeNull();
  });

  it('returns null when it has nothing to work with', () => {
    expect(firstNameFor({})).toBeNull();
    expect(firstNameFor({ metadataFullName: null, profileFullName: null, email: null })).toBeNull();
    expect(firstNameFor({ email: 'not-an-email' })).toBeNull();
  });
});
