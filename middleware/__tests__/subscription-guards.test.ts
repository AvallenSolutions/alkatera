import { describe, it, expect, vi, beforeEach } from 'vitest';

// The guards read subscription_status via a service-role client created from a
// dynamic import of '@supabase/supabase-js'. Mock createClient to return a
// chainable that resolves to a configurable status.
let mockStatus: string | null = 'active';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mockStatus === null ? null : { subscription_status: mockStatus },
            error: mockStatus === null ? { message: 'not found' } : null,
          }),
        }),
      }),
    }),
  }),
}));

import { enforceExportAllowed, enforceWriteAccess } from '../subscription-check';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockStatus = 'active';
});

describe('enforceExportAllowed', () => {
  it('allows exports for active subscriptions', async () => {
    mockStatus = 'active';
    const res = await enforceExportAllowed('org-1');
    expect(res).toBeNull();
  });

  it('allows exports during the past_due grace period', async () => {
    mockStatus = 'past_due';
    const res = await enforceExportAllowed('org-1');
    expect(res).toBeNull();
  });

  it('blocks exports on trial with reason "trial"', async () => {
    mockStatus = 'trial';
    const res = await enforceExportAllowed('org-1');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.reason).toBe('trial');
    expect(body.upgrade_required).toBe(true);
  });

  it('blocks exports for cancelled (read-only) with reason "read_only"', async () => {
    mockStatus = 'cancelled';
    const res = await enforceExportAllowed('org-1');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.reason).toBe('read_only');
  });
});

describe('enforceWriteAccess', () => {
  it('allows writes for active subscriptions', async () => {
    mockStatus = 'active';
    expect(await enforceWriteAccess('org-1')).toBeNull();
  });

  it('allows writes during a trial (trial users can still build)', async () => {
    mockStatus = 'trial';
    expect(await enforceWriteAccess('org-1')).toBeNull();
  });

  it('blocks writes for cancelled (read-only) orgs', async () => {
    mockStatus = 'cancelled';
    const res = await enforceWriteAccess('org-1');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.reason).toBe('read_only');
  });
});
