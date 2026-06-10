/**
 * SSRF-hardened fetch for user-supplied URLs.
 *
 * Server-side fetches of URLs a user typed in must not be able to reach
 * internal services or cloud metadata (e.g. 169.254.169.254), including via
 * redirects: a clean public URL can 302 to an internal address, and
 * `redirect: 'follow'` will happily go there. safeFetch:
 *
 *   1. allows only http/https,
 *   2. blocks private/loopback/link-local hostnames AND any hostname whose
 *      DNS records resolve to a private address,
 *   3. follows redirects manually, re-validating EVERY hop.
 *
 * Use this for ALL server-side fetches of user-supplied URLs. Node runtime
 * only (uses dns/promises) — not for edge routes.
 */
import { lookup } from 'dns/promises';

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||      // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224                          // multicast + reserved
  );
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (/^localhost$/.test(h) || h.endsWith('.localhost')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || /^f[cde]/i.test(h)) return true; // ipv6 loopback / ULA / link-local
  return false;
}

export async function assertPublicUrl(rawUrl: string): Promise<void> {
  const u = new URL(rawUrl);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`SSRF: blocked protocol ${u.protocol}`);
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error(`SSRF: blocked host ${u.hostname}`);
  }
  // Resolve DNS and reject if any record points at a private/reserved IP. This
  // catches a public hostname deliberately pointing at an internal address.
  const addresses = await lookup(u.hostname, { all: true });
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new Error(`SSRF: host resolves to private IP ${address}`);
    }
    if (family === 6 && (address === '::1' || /^f[cde]/i.test(address))) {
      throw new Error(`SSRF: host resolves to private IPv6 ${address}`);
    }
  }
}

export async function safeFetch(rawUrl: string, init: RequestInit = {}, maxHops = 4): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current).href; // re-validated at top of next loop
      continue;
    }
    return res;
  }
  throw new Error('SSRF: too many redirects');
}
