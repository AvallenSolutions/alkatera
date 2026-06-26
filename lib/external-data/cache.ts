/**
 * Foundation A: in-memory reference-factor cache.
 *
 * The emission calculators (`getGridFactor`, `getSpendFactor`, the corporate
 * Scope 1/2 utility lookup) are SYNCHRONOUS and called from 15+ places, many
 * client-side. Making them async to hit the DB would ripple through every
 * calculator and its tests. Instead:
 *
 *   - `warmFactorCache(supabase)` is async and loads the current factor sets
 *     into a module-level Map. Call it once at a server entry point that does
 *     emissions maths (corporate-emissions, the spend routes).
 *   - `getCachedFactor(kind, key, geo)` is a SYNC read of that Map. On a cold
 *     cache (nothing warmed, or no set loaded) it returns undefined and the
 *     caller falls back to its built-in constant — so behaviour is byte-identical
 *     to before until a factor set is actually loaded.
 *
 * Warming never throws: any DB/error path leaves the cache empty (all fallbacks),
 * which keeps unit tests that don't mock `reference_factors` working unchanged.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FactorKind } from './types'

export interface CachedFactor {
  factor: number
  unit: string
  scope: string | null
  uncertainty: number | null
  /** Provenance string, e.g. 'DESNZ 2024 (OGL-3.0)'. */
  source: string
}

const TTL_MS = 15 * 60 * 1000

let CACHE: Map<string, CachedFactor> | null = null
let warmedAt = 0
let inflight: Promise<void> | null = null

function cacheKey(kind: FactorKind, lookupKey: string, geo: string | null | undefined): string {
  return `${kind}:${lookupKey.toUpperCase()}:${(geo ?? '*').toUpperCase()}`
}

/**
 * Read a current factor from the cache. Tries the geo-specific key first, then
 * the geo-agnostic ('*') key. Returns undefined on a cold cache or a miss, so
 * callers fall back to their built-in constants.
 */
export function getCachedFactor(
  kind: FactorKind,
  lookupKey: string,
  geo?: string | null,
): CachedFactor | undefined {
  if (!CACHE) return undefined
  return CACHE.get(cacheKey(kind, lookupKey, geo)) ?? CACHE.get(cacheKey(kind, lookupKey, '*'))
}

/** True once a non-empty cache has been warmed (useful for diagnostics). */
export function isFactorCacheWarm(): boolean {
  return CACHE !== null
}

/**
 * Warm the cache from the current factor sets (valid_to IS NULL). Cheap no-op if
 * warmed within the TTL. Concurrent callers share one in-flight load. Never
 * throws; on any error the cache is left as an empty Map (all fallbacks).
 */
export async function warmFactorCache(supabase: SupabaseClient): Promise<void> {
  if (CACHE && Date.now() - warmedAt < TTL_MS) return
  if (inflight) return inflight

  inflight = (async () => {
    const next = new Map<string, CachedFactor>()
    try {
      const { data, error } = await supabase
        .from('reference_factors')
        .select(
          'kind, lookup_key, scope, factor, unit, uncertainty, geographic_scope, ' +
            'factor_sets!inner(provider, version, licence, valid_to)',
        )
        .is('factor_sets.valid_to', null)

      if (!error && Array.isArray(data)) {
        for (const row of data as unknown as RawRow[]) {
          const set = Array.isArray(row.factor_sets) ? row.factor_sets[0] : row.factor_sets
          if (!set) continue
          const source = `${set.provider} ${set.version} (${set.licence})`
          next.set(cacheKey(row.kind, row.lookup_key, row.geographic_scope), {
            factor: Number(row.factor),
            unit: row.unit,
            scope: row.scope ?? null,
            uncertainty: row.uncertainty != null ? Number(row.uncertainty) : null,
            source,
          })
        }
      }
    } catch {
      // Leave `next` empty — every lookup falls back to its built-in constant.
    }
    CACHE = next
    warmedAt = Date.now()
    inflight = null
  })()

  return inflight
}

interface RawRow {
  kind: FactorKind
  lookup_key: string
  scope: string | null
  factor: number | string
  unit: string
  uncertainty: number | string | null
  geographic_scope: string | null
  factor_sets:
    | { provider: string; version: string; licence: string; valid_to: string | null }
    | { provider: string; version: string; licence: string; valid_to: string | null }[]
}

/** Test-only: clear the cache so the next `warmFactorCache` reloads. */
export function __resetFactorCache(): void {
  CACHE = null
  warmedAt = 0
  inflight = null
}
