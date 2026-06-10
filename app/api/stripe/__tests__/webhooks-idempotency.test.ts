/**
 * Stripe webhook idempotency + failure semantics.
 *
 * The route must (CODE_REVIEW_2026-06-10.md R1):
 *  1. return 500 when a handler fails, so Stripe retries (previously a
 *     transient DB error during checkout.session.completed returned 200 and
 *     the activation was permanently lost);
 *  2. mark the event processed in stripe_webhook_events only AFTER the
 *     handler succeeds;
 *  3. skip as duplicate only events whose previous delivery completed;
 *  4. re-process events whose previous delivery failed (processed = false).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

// ── Stripe mock: signature verification returns our fixture event ──────────
const FIXTURE_EVENT = {
  id: 'evt_test_1',
  type: 'customer.subscription.deleted',
  data: { object: { id: 'sub_1', metadata: {} } },
};

vi.mock('@/lib/stripe-config', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn(() => FIXTURE_EVENT) },
    subscriptions: { retrieve: vi.fn() },
  },
  getBillingIntervalFromPriceId: vi.fn(() => 'monthly'),
}));

// ── Supabase mock: in-memory stripe_webhook_events + spies ─────────────────
const eventsTable = new Map<string, { processed: boolean; error: string | null }>();
let handlerShouldFail = false;

function makeQueryStub(table: string) {
  if (table === 'stripe_webhook_events') {
    return {
      insert: vi.fn(async (row: { id: string; type: string }) => {
        if (eventsTable.has(row.id)) {
          return { error: { code: '23505', message: 'duplicate key' } };
        }
        eventsTable.set(row.id, { processed: false, error: null });
        return { error: null };
      }),
      update: vi.fn((patch: Record<string, unknown>) => ({
        eq: vi.fn(async (_col: string, id: string) => {
          const row = eventsTable.get(id);
          if (row) {
            if ('processed' in patch) row.processed = patch.processed as boolean;
            if ('error' in patch && patch.error) row.error = patch.error as string;
          }
          return { error: null };
        }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn((_col: string, id: string) => ({
          maybeSingle: vi.fn(async () => ({ data: eventsTable.get(id) ?? null })),
        })),
      })),
    };
  }
  // organizations lookup used by the subscription-deleted handler
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => {
          if (handlerShouldFail) throw new Error('transient DB failure');
          return { data: { id: 'org-1' }, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (handlerShouldFail) throw new Error('transient DB failure');
          return { data: { id: 'org-1' }, error: null };
        }),
      })),
    })),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    rpc: vi.fn(async () => ({ error: null })),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => makeQueryStub(table)),
    rpc: vi.fn(async () => {
      if (handlerShouldFail) throw new Error('transient DB failure');
      return { data: null, error: null };
    }),
  })),
}));

// Route import AFTER mocks
async function postEvent(): Promise<Response> {
  const { POST } = await import('../webhooks/route');
  const req = new NextRequest('https://example.com/api/stripe/webhooks', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'stripe-signature': 'sig_test' },
  });
  return POST(req);
}

describe('Stripe webhook idempotency', () => {
  beforeEach(() => {
    vi.resetModules();
    eventsTable.clear();
    handlerShouldFail = false;
  });

  it('processes a new event and marks it processed', async () => {
    const res = await postEvent();
    expect(res.status).toBe(200);
    expect(eventsTable.get('evt_test_1')?.processed).toBe(true);
  });

  it('returns 500 on handler failure and does NOT mark processed', async () => {
    handlerShouldFail = true;
    const res = await postEvent();
    expect(res.status).toBe(500);
    expect(eventsTable.get('evt_test_1')?.processed).toBe(false);
  });

  it('re-processes an event whose previous delivery failed', async () => {
    handlerShouldFail = true;
    await postEvent(); // first delivery fails → processed = false

    handlerShouldFail = false;
    const res = await postEvent(); // Stripe retry
    expect(res.status).toBe(200);
    expect(eventsTable.get('evt_test_1')?.processed).toBe(true);
  });

  it('skips a fully processed event as duplicate', async () => {
    await postEvent(); // processed
    const res = await postEvent(); // retry of completed event
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
  });
});
