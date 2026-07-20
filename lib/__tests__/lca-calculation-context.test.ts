import { describe, it, expect, vi } from 'vitest';
import {
  resolveInternalCallAuth,
  isServerContext,
  type CalculationContext,
} from '@/lib/lca/calculation-context';

/** A Supabase stand-in that only needs to answer auth.getSession(). */
function clientWithSession(token: string | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: token ? { session: { access_token: token } } : { session: null },
      }),
    },
  } as any;
}

describe('resolveInternalCallAuth — browser path', () => {
  it('authenticates with the signed-in user and keeps relative URLs', async () => {
    const auth = await resolveInternalCallAuth(clientWithSession('user-jwt'));
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    expect(auth.headers.Authorization).toBe('Bearer user-jwt');
    // Relative paths are correct in a browser and must not be rewritten.
    expect(auth.url('/api/openlca/calculate')).toBe('/api/openlca/calculate');
  });

  it('reports no session rather than returning an unusable token', async () => {
    // The original code treated this as falsy and skipped the whole branch.
    const auth = await resolveInternalCallAuth(clientWithSession(null));
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.reason).toContain('no signed-in session');
  });

  it('reports a thrown session lookup instead of pretending it is fine', async () => {
    const client = {
      auth: { getSession: vi.fn().mockRejectedValue(new Error('network down')) },
    } as any;
    const auth = await resolveInternalCallAuth(client);
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.reason).toContain('network down');
  });
});

describe('resolveInternalCallAuth — server path', () => {
  const ctx: CalculationContext = {
    supabase: {} as any,
    service: { secret: 'shhh', baseUrl: 'https://app.example.com' },
  };

  it('authenticates with the service secret and makes URLs absolute', async () => {
    // Node cannot fetch a relative path; a server run that did would throw
    // inside a try/catch and silently lose the branch.
    const auth = await resolveInternalCallAuth(clientWithSession(null), ctx);
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    expect(auth.headers.Authorization).toBe('Bearer shhh');
    expect(auth.url('/api/openlca/calculate')).toBe('https://app.example.com/api/openlca/calculate');
  });

  it('does not double up the slash when the base URL has a trailing one', async () => {
    const auth = await resolveInternalCallAuth(clientWithSession(null), {
      ...ctx,
      service: { secret: 'shhh', baseUrl: 'https://app.example.com/' },
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    expect(auth.url('/api/x')).toBe('https://app.example.com/api/x');
  });

  it('never consults the session when a service credential is present', async () => {
    const client = clientWithSession('user-jwt');
    await resolveInternalCallAuth(client, ctx);
    expect(client.auth.getSession).not.toHaveBeenCalled();
  });

  it('refuses a service credential with no base URL', async () => {
    const auth = await resolveInternalCallAuth(clientWithSession(null), {
      supabase: {} as any,
      service: { secret: 'shhh', baseUrl: '' },
    });
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.reason).toContain('base URL');
  });

  it('names the missing credential when running off-browser without one', async () => {
    // The regression this whole design exists to prevent: an injected client
    // with no service credential used to mean "skip OpenLCA and the supplier
    // lookup, report success, return a quietly worse number".
    const auth = await resolveInternalCallAuth(clientWithSession(null), {
      supabase: {} as any,
    });
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.reason).toContain('CRON_SECRET');
  });
});

describe('isServerContext', () => {
  it('is true only when a client has been injected', () => {
    expect(isServerContext(undefined)).toBe(false);
    expect(isServerContext({})).toBe(false);
    expect(isServerContext({ supabase: {} as any })).toBe(true);
  });
});
