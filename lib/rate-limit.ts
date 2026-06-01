import 'server-only'

/**
 * Durable rate limiting.
 *
 * Uses Upstash Redis (via its REST API, so no extra dependency / lockfile
 * change) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, so
 * limits hold across serverless instances. Falls back to a per-instance
 * in-memory counter when Upstash is not configured, so behaviour degrades
 * gracefully rather than breaking (security review 2026-05-29, MED-5/LOW-2).
 *
 * Fixed-window counter: INCR the key, set the window TTL on first hit.
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetMs: number
}

const memory = new Map<string, { count: number; resetAt: number }>()

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, limit, remaining: limit - 1, resetMs: windowMs }
  }
  entry.count += 1
  return {
    success: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetMs: entry.resetAt - now,
  }
}

async function upstashLimit(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Pipeline: INCR, set TTL only if not already set (NX), read TTL back.
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, String(windowMs), 'NX'],
      ['PTTL', key],
    ]),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)
  const data = (await res.json()) as Array<{ result: number }>
  const count = Number(data[0]?.result ?? 0)
  const ttl = Number(data[2]?.result ?? windowMs)
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetMs: ttl > 0 ? ttl : windowMs,
  }
}

/**
 * Returns whether the action under `key` is allowed. On any backend error it
 * fails OPEN (allows the request) so rate limiting never takes the app down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    try {
      return await upstashLimit(url, token, fullKey, limit, windowMs)
    } catch {
      // fall through to in-memory
    }
  }
  return memoryLimit(fullKey, limit, windowMs)
}
