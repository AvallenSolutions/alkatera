import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * How an LCA calculation reaches the database and the internal API routes.
 *
 * The calculation was written to run in one place only: a signed-in browser
 * tab. It reached the database through the memoised browser client and
 * authenticated its internal API hops (OpenLCA, supplier resolve) by reading
 * the user's session. Running the same calculation on a server needs neither
 * of those, so both become injectable.
 *
 * The important part is what happens when a credential is MISSING. The
 * original code gated both API hops behind `if (session?.access_token)` and
 * skipped them silently when there was none. Server-side that meant the
 * supplier-verified and OpenLCA branches never ran, and the calculation
 * completed "successfully" using materially worse fallback factors than the
 * browser would have used for the same product. Same inputs, different
 * number, no warning. `resolveInternalCallAuth` therefore returns an explicit
 * failure the callers must handle and report, rather than a falsy token that
 * is easy to skip past.
 */
export interface ServiceCredential {
  /**
   * Shared secret the internal routes accept in place of a user JWT. Sent as
   * `Authorization: Bearer <secret>`, matching the house cron-route
   * convention, so routes need one extra check rather than a new scheme.
   */
  secret: string;
  /**
   * Absolute origin, e.g. "https://app.alkatera.com". Required off-browser:
   * fetch() in Node cannot resolve the relative paths the browser path uses.
   */
  baseUrl: string;
}

export interface CalculationContext {
  /**
   * Client to run every query through. Omit in the browser to keep the
   * historical behaviour (the memoised browser client, user RLS). Server runs
   * must inject a service-role client.
   */
  supabase?: SupabaseClient;
  /**
   * Credential for internal API hops. Omit in the browser to read the user's
   * session. Server runs must supply this or those hops will be reported as
   * unavailable rather than silently skipped.
   */
  service?: ServiceCredential;
}

export interface InternalCallAuthOk {
  ok: true;
  /** Turns an app-relative path into a fetchable URL for this context. */
  url: (path: string) => string;
  headers: Record<string, string>;
}

export type InternalCallAuth = InternalCallAuthOk | { ok: false; reason: string };

/**
 * Work out how to call an internal API route from wherever we are running.
 * Never returns a silently-unusable result: callers get either a usable pair
 * of (url, headers) or a reason they can surface to the user.
 */
export async function resolveInternalCallAuth(
  supabase: SupabaseClient,
  ctx?: CalculationContext,
): Promise<InternalCallAuth> {
  if (ctx?.service) {
    const base = ctx.service.baseUrl.replace(/\/$/, '');
    if (!base) {
      return { ok: false, reason: 'service credential supplied without a base URL' };
    }
    return {
      ok: true,
      url: (path) => `${base}${path}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.service.secret}`,
      },
    };
  }

  // Browser path: authenticate as the signed-in user.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      return {
        ok: true,
        url: (path) => path,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: `could not read the signed-in session (${err instanceof Error ? err.message : 'unknown error'})`,
    };
  }

  return {
    ok: false,
    reason: ctx?.supabase
      ? 'running off-browser without a service credential (set CRON_SECRET)'
      : 'no signed-in session',
  };
}

/**
 * True when this context is a server run. Used to decide whether to consult
 * `auth.getUser()`, which only means anything with a user session behind it.
 */
export function isServerContext(ctx?: CalculationContext): boolean {
  return Boolean(ctx?.supabase);
}
