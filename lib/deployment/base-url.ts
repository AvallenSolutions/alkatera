import 'server-only';

/**
 * Platform-neutral resolution of "this app's own origin" and "which runtime
 * tier am I in". Centralising these means the Vercel migration (or any
 * future host) only has to get env vars right, not hunt down every scattered
 * `process.env.URL` / `process.env.DEPLOY_URL` / `process.env.NETLIFY` read —
 * all three are Netlify-only and silently undefined on Vercel.
 *
 * Preference order for the app's own base URL:
 *   1. `NEXT_PUBLIC_SITE_URL` — explicit, always wins when set.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` — Vercel sets these
 *      automatically per-deployment (no protocol prefix, so we add one).
 *   3. The inbound request's `host` header (with `x-forwarded-proto`, or
 *      `https` if that header is absent) — works on any host, including
 *      Netlify, for a route that has a `Request`/`NextRequest` to read.
 *   4. A hardcoded production fallback, for contexts with no request and no
 *      env var configured (e.g. a cron tick building a link for an email).
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function getAppBaseUrl(request?: Request | { headers: Headers } | null): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return trimTrailingSlash(siteUrl);

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return trimTrailingSlash(withProtocol(vercelUrl));

  const host = request?.headers?.get('host');
  if (host) {
    const proto = request?.headers?.get('x-forwarded-proto') || 'https';
    return trimTrailingSlash(`${proto}://${host}`);
  }

  return 'https://alkatera.com';
}

/**
 * True in a genuine production deployment: Vercel's production environment,
 * or (for hosts without `VERCEL_ENV`, e.g. Netlify) a `NODE_ENV=production`
 * build that isn't a Vercel preview. Replaces the old
 * `process.env.NODE_ENV !== 'production' && !process.env.NETLIFY` isDev
 * checks — those were written for a single host and treated every non-Netlify
 * environment as local dev, which is wrong on Vercel (preview deployments
 * build with `NODE_ENV=production` too).
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV === 'production') return true;
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview';
}

/** True on a Vercel preview deployment. */
export function isPreviewRuntime(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}
