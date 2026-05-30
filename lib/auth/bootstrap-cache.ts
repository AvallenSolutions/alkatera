/**
 * In-memory hand-off for the get_user_bootstrap() RPC result.
 *
 * The bootstrap RPC is fired once in OrganizationProvider. Its subscription +
 * admin payload is stashed here so the two OTHER consumers — useSubscription
 * and the Sidebar — can read it instead of each firing their own RPC on first
 * load. Every consumer treats a miss as "fall back to my own query", so this is
 * a pure optimisation: never a source of truth, never load-bearing.
 *
 * Single-slot (not a Map) because exactly one user is logged in at a time, and
 * it's cleared on sign-out and org switch. Short TTL is a backstop so a stale
 * entry can never linger; org-scoped reads also check the orgId matches.
 */

import type { OrganizationUsage } from '@/hooks/useSubscription'

interface BootstrapSlot {
  orgId: string
  subscription: OrganizationUsage | null
  isAlkateraAdmin: boolean
  pendingApprovalCount: number
  expiresAt: number
}

// Backstop TTL. The cache is normally consumed within the same render pass that
// org context resolves, so this only guards against an entry never being read.
const TTL_MS = 30_000

let _slot: BootstrapSlot | null = null

/** Producer: called by OrganizationProvider after a successful bootstrap RPC. */
export function setBootstrapCache(
  orgId: string,
  data: {
    subscription: OrganizationUsage | null
    isAlkateraAdmin: boolean
    pendingApprovalCount: number
  },
): void {
  _slot = {
    orgId,
    subscription: data.subscription,
    isAlkateraAdmin: data.isAlkateraAdmin,
    pendingApprovalCount: data.pendingApprovalCount,
    expiresAt: Date.now() + TTL_MS,
  }
}

/** Consumer (useSubscription): the cached usage for this org, or null on miss. */
export function peekBootstrapSubscription(orgId: string): OrganizationUsage | null {
  if (!_slot || _slot.orgId !== orgId || Date.now() > _slot.expiresAt) return null
  return _slot.subscription
}

/** Consumer (Sidebar): the cached admin flags, or null on miss. */
export function peekBootstrapAdmin(): { isAlkateraAdmin: boolean; pendingApprovalCount: number } | null {
  if (!_slot || Date.now() > _slot.expiresAt) return null
  return {
    isAlkateraAdmin: _slot.isAlkateraAdmin,
    pendingApprovalCount: _slot.pendingApprovalCount,
  }
}

/** Clear on sign-out and org switch so reads go live again. */
export function clearBootstrapCache(): void {
  _slot = null
}
