import 'server-only';
import tls from 'node:tls';

/**
 * TLS certificate expiry inspection for the self-hosted OpenLCA gdt-servers.
 *
 * Why this exists: the OpenLCA search talks to two self-hosted servers behind
 * Let's Encrypt certs that auto-renew via certbot. When that renewal silently
 * breaks, the certs expire, Node's `fetch` rejects them, and live ecoinvent /
 * Agribalyse search fails — but looks like "no results" rather than an outage
 * (see app/api/ingredients/search/route.ts). This monitor reads the cert expiry
 * ahead of time so we get warned ~2 weeks before it happens.
 *
 * IMPORTANT: the inspection socket uses `rejectUnauthorized: false` ONLY so it
 * can still READ `notAfter` when the cert is already expired or otherwise
 * invalid. It is never used to send API requests — every real OpenLCA call goes
 * through `fetch` with full certificate verification (lib/openlca/client.ts).
 */

export interface CertExpiry {
  host: string;
  port: number;
  /** True if we successfully read the peer certificate. */
  ok: boolean;
  /** Certificate notAfter as ISO string, or null if it couldn't be read. */
  validTo: string | null;
  /** Whole days until expiry (negative once expired), or null on failure. */
  daysRemaining: number | null;
  /** True when the certificate has already expired. */
  expired: boolean;
  /** Populated when the inspection itself failed (timeout, DNS, refused). */
  error?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a server URL into { host, port }, defaulting to 443. */
export function parseHostPort(serverUrl: string): { host: string; port: number } {
  const u = new URL(serverUrl);
  return { host: u.hostname, port: u.port ? Number(u.port) : 443 };
}

/**
 * Open a TLS connection just long enough to read the peer certificate's expiry.
 * Resolves (never rejects) with a CertExpiry describing the result.
 */
export function checkCertExpiry(host: string, port = 443, timeoutMs = 10000): Promise<CertExpiry> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: CertExpiry) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* already closed */ }
      resolve(result);
    };

    const fail = (error: string): void =>
      finish({ host, port, ok: false, validTo: null, daysRemaining: null, expired: false, error });

    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          fail('No peer certificate returned');
          return;
        }
        // cert.valid_to is e.g. "Sep  6 10:20:27 2026 GMT" — Date parses it.
        const validToMs = new Date(cert.valid_to).getTime();
        if (Number.isNaN(validToMs)) {
          fail(`Unparseable certificate notAfter: "${cert.valid_to}"`);
          return;
        }
        const msRemaining = validToMs - Date.now();
        finish({
          host,
          port,
          ok: true,
          validTo: new Date(validToMs).toISOString(),
          daysRemaining: Math.floor(msRemaining / DAY_MS),
          expired: msRemaining <= 0,
        });
      }
    );

    socket.on('timeout', () => fail(`TLS connect timed out after ${timeoutMs}ms`));
    socket.on('error', (err: Error) => fail(err.message));
  });
}
