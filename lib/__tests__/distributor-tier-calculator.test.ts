import { describe, it, expect } from 'vitest';
import { calculateAlkateraTier } from '@/lib/distributor/integration/tier-calculator';

describe('calculateAlkateraTier', () => {
  it('returns 1 for an untouched brand', () => {
    expect(
      calculateAlkateraTier({
        has_submission: false,
        is_linked: false,
        link_confirmed: false,
        alkatera_full_account: false,
      }),
    ).toBe(1);
  });

  it('returns 2 when the brand has submitted documents but no link exists', () => {
    expect(
      calculateAlkateraTier({
        has_submission: true,
        is_linked: false,
        link_confirmed: false,
        alkatera_full_account: false,
      }),
    ).toBe(2);
  });

  it('returns 2 when an alkatera link exists but the brand has not confirmed', () => {
    expect(
      calculateAlkateraTier({
        has_submission: false,
        is_linked: true,
        link_confirmed: false,
        alkatera_full_account: false,
      }),
    ).toBe(2);
  });

  it('returns 3 when a confirmed link exists on a standard plan', () => {
    expect(
      calculateAlkateraTier({
        has_submission: false,
        is_linked: true,
        link_confirmed: true,
        alkatera_full_account: false,
      }),
    ).toBe(3);
  });

  it('returns 4 when a confirmed link exists on a full account', () => {
    expect(
      calculateAlkateraTier({
        has_submission: false,
        is_linked: true,
        link_confirmed: true,
        alkatera_full_account: true,
      }),
    ).toBe(4);
  });

  it('confirmed link beats submitted-only state', () => {
    expect(
      calculateAlkateraTier({
        has_submission: true,
        is_linked: true,
        link_confirmed: true,
        alkatera_full_account: false,
      }),
    ).toBe(3);
  });

  it('full-account flag is ignored when the link is not confirmed', () => {
    expect(
      calculateAlkateraTier({
        has_submission: false,
        is_linked: true,
        link_confirmed: false,
        alkatera_full_account: true,
      }),
    ).toBe(2);
  });
});
