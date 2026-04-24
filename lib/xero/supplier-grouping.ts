import { normaliseName, tokenOverlapScore } from './supplier-matcher'

export const SUPPLIER_CLUSTER_THRESHOLD = 0.85

export interface SupplierMember {
  contactName: string
  transactionCount: number
  totalSpend: number
}

export interface SupplierCluster {
  /** Canonical display name (longest member by token count, breaks ties by length). */
  canonicalName: string
  /** Deterministic stable key — normalised form of canonicalName. */
  key: string
  members: SupplierMember[]
  aggregateSpend: number
  aggregateTransactionCount: number
}

/**
 * Cluster near-duplicate contact names using the normaliser + token overlap
 * from `supplier-matcher`. Greedy single-pass: iterate suppliers in descending
 * spend order, assign each to the first existing cluster whose centroid scores
 * above the threshold, otherwise start a new cluster.
 *
 * This is deterministic for a given input order. The caller should sort by
 * spend desc before calling for stable output.
 */
export function clusterSuppliers<T extends SupplierMember>(
  suppliers: T[],
  threshold: number = SUPPLIER_CLUSTER_THRESHOLD
): SupplierCluster[] {
  const sorted = [...suppliers].sort((a, b) => b.totalSpend - a.totalSpend)

  interface Bucket {
    centroid: string
    centroidNormalised: string
    members: SupplierMember[]
  }

  const buckets: Bucket[] = []

  for (const s of sorted) {
    const normalised = normaliseName(s.contactName)
    if (!normalised) {
      buckets.push({
        centroid: s.contactName,
        centroidNormalised: normalised,
        members: [s],
      })
      continue
    }

    let target: Bucket | null = null
    let bestScore = 0

    for (const b of buckets) {
      if (!b.centroidNormalised) continue
      const score = tokenOverlapScore(normalised, b.centroidNormalised)
      if (score >= threshold && score > bestScore) {
        target = b
        bestScore = score
      }
    }

    if (target) {
      target.members.push(s)
    } else {
      buckets.push({
        centroid: s.contactName,
        centroidNormalised: normalised,
        members: [s],
      })
    }
  }

  return buckets.map(b => {
    const canonical = pickCanonical(b.members.map(m => m.contactName)) || b.centroid
    return {
      canonicalName: canonical,
      key: normaliseName(canonical) || canonical.toLowerCase(),
      members: b.members,
      aggregateSpend: b.members.reduce((sum, m) => sum + m.totalSpend, 0),
      aggregateTransactionCount: b.members.reduce((sum, m) => sum + m.transactionCount, 0),
    }
  })
}

/**
 * Pick the most descriptive name from a list of variants: prefer the one
 * with the most tokens, tiebreak by raw length. Falls back to the first.
 */
function pickCanonical(names: string[]): string | null {
  if (names.length === 0) return null
  return [...names].sort((a, b) => {
    const ta = a.split(/\s+/).length
    const tb = b.split(/\s+/).length
    if (ta !== tb) return tb - ta
    return b.length - a.length
  })[0]
}
