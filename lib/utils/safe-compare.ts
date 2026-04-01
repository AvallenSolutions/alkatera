import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use this for comparing secrets (e.g. CRON_SECRET, API keys).
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Compare anyway to avoid timing leak on length difference
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
