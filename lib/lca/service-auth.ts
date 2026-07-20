import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * True when a request carries the internal service secret rather than a user
 * JWT.
 *
 * A server-side LCA run has no session, so it authenticates to the internal
 * routes with CRON_SECRET presented in the same `Authorization: Bearer`
 * header the browser uses for its JWT. That keeps one header shape across
 * both callers, matching the existing cron-route convention.
 *
 * Returns false when CRON_SECRET is unset, so a half-configured environment
 * cannot accidentally leave these routes open.
 */
export function isServiceCall(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const presented = (request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  return presented.length > 0 && presented === secret;
}
