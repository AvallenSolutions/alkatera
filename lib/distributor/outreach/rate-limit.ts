/**
 * Tiny in-memory rate limiter for public endpoints. Mirrors the pattern
 * used by /api/supplier-invite/details/route.ts — per-IP fixed window.
 *
 * In-memory means this resets on every cold start and is per-instance.
 * That's fine for the modest abuse we expect on /brand-upload/[token]
 * routes (brand staff opening the link a handful of times). For higher
 * traffic we'd swap this for a Redis-backed limiter.
 */
const WINDOW_MS = 60 * 1000;
const LIMIT_PER_WINDOW = 20;

interface Counter {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Counter>();

export function consumeRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT_PER_WINDOW - 1 };
  }
  if (existing.count >= LIMIT_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  existing.count += 1;
  return { allowed: true, remaining: LIMIT_PER_WINDOW - existing.count };
}

export function rateLimitKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : 'unknown';
  return ip || 'unknown';
}
