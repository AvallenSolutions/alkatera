/**
 * Lightweight per-user in-process rate limiter.
 *
 * Not distributed — resets on cold start, which is fine for serverless
 * where each Lambda instance has its own process. The purpose is to
 * prevent a single user from accidentally hammering expensive endpoints
 * (Claude vision calls in particular) rather than defending against
 * coordinated abuse.
 */

interface Bucket {
  timestamps: number[]
}

const _buckets = new Map<string, Bucket>()

/**
 * Returns true if the caller is within the allowed rate.
 * Internally prunes entries older than windowMs.
 *
 * @param key      Unique key (e.g. `userId:route`)
 * @param limit    Max calls allowed in the window
 * @param windowMs Window size in milliseconds (default: 60 000 = 1 min)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const cutoff = now - windowMs

  let bucket = _buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    _buckets.set(key, bucket)
  }

  // Prune expired entries
  bucket.timestamps = bucket.timestamps.filter(t => t > cutoff)

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + windowMs - now,
    }
  }

  bucket.timestamps.push(now)
  return {
    allowed: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterMs: 0,
  }
}
