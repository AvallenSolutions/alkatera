'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Card slots on the /rosa/ hub. Hero is always-on. */
export const HUB_CARD_IDS = [
  'priority_tiles',
  'activity_pulse',
  'forward_timeline',
  'product_spotlight',
  'quick_prompts',
  'quick_actions',
  'recently_from_rosa',
  'recent_conversations',
  'circular_partnerships',
  'nature_positive_actions',
] as const

export type HubCardId = (typeof HUB_CARD_IDS)[number]

export interface HubCardLayout {
  id: HubCardId
  visible: boolean
}

const DEFAULT_LAYOUT: HubCardLayout[] = HUB_CARD_IDS.map(id => ({ id, visible: true }))

interface StoredPayload {
  v: 1
  cards: HubCardLayout[]
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<StoredPayload>
  return p.v === 1 && Array.isArray(p.cards)
}

/**
 * Reconcile a stored layout with the canonical card set so newly-added
 * cards default to visible and removed cards are dropped silently.
 */
function reconcile(stored: HubCardLayout[]): HubCardLayout[] {
  const byId = new Map(stored.map(c => [c.id, c]))
  return HUB_CARD_IDS.map(id => byId.get(id) ?? { id, visible: true })
}

// Module-level store. Every useHubLayout() call subscribes to the same
// snapshot, so toggling in the settings dialog updates ForYouToday's
// renderer in the same React commit.
let snapshot: HubCardLayout[] = DEFAULT_LAYOUT
let isLoadingSnapshot = true
let hasFetched = false
const subscribers = new Set<() => void>()

function getSnapshot(): HubCardLayout[] {
  return snapshot
}

function getServerSnapshot(): HubCardLayout[] {
  return DEFAULT_LAYOUT
}

function setSnapshot(next: HubCardLayout[]) {
  snapshot = next
  for (const fn of Array.from(subscribers)) fn()
}

function setLoadingSnapshot(next: boolean) {
  if (isLoadingSnapshot === next) return
  isLoadingSnapshot = next
  for (const fn of Array.from(subscribers)) fn()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

async function fetchInitial(): Promise<void> {
  if (hasFetched) return
  hasFetched = true
  try {
    const res = await fetch('/api/rosa/memory?key=hub_layout', { credentials: 'include' })
    if (res.ok) {
      const json = await res.json()
      const entry = (json?.entries ?? []).find(
        (e: { key?: string }) => e.key === 'hub_layout',
      )
      if (entry?.value) {
        try {
          const parsed = JSON.parse(entry.value)
          if (isStoredPayload(parsed)) {
            setSnapshot(reconcile(parsed.cards))
          }
        } catch {
          // Bad payload; defaults already in place.
        }
      }
    }
  } catch {
    // Network failure; defaults already in place.
  } finally {
    setLoadingSnapshot(false)
  }
}

async function persist(next: HubCardLayout[]): Promise<void> {
  const payload: StoredPayload = { v: 1, cards: next }
  await fetch('/api/rosa/memory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key: 'hub_layout',
      value: JSON.stringify(payload),
      scope: 'user',
    }),
  })
}

/**
 * Reads + writes the user's hub layout preferences via /api/rosa/memory
 * (key='hub_layout'). Defaults to all cards visible. Updates are
 * optimistic; failures revert.
 *
 * State lives at module scope so every consumer (settings dialog +
 * ForYouToday renderer) sees the same snapshot.
 */
export function useHubLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const isLoading = useSyncExternalStore(
    subscribe,
    () => isLoadingSnapshot,
    () => true,
  )

  useEffect(() => {
    if (!hasFetched) void fetchInitial()
  }, [])

  const setLayout = useCallback(async (next: HubCardLayout[]) => {
    const reconciled = reconcile(next)
    const previous = snapshot
    setSnapshot(reconciled)
    try {
      await persist(reconciled)
    } catch {
      setSnapshot(previous)
    }
  }, [])

  const toggleCard = useCallback((id: HubCardId) => {
    const next = snapshot.map(c => (c.id === id ? { ...c, visible: !c.visible } : c))
    void setLayout(next)
  }, [setLayout])

  const reset = useCallback(async () => {
    const previous = snapshot
    setSnapshot(DEFAULT_LAYOUT)
    try {
      await fetch('/api/rosa/memory?key=hub_layout', {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch {
      setSnapshot(previous)
    }
  }, [])

  const isVisible = useCallback(
    (id: HubCardId) => layout.find(c => c.id === id)?.visible ?? true,
    [layout],
  )

  return { layout, setLayout, toggleCard, reset, isVisible, isLoading }
}

export const HUB_CARD_LABELS: Record<HubCardId, string> = {
  priority_tiles: 'Priority tiles',
  // Card id stays 'activity_pulse' for backward compat with stored layouts;
  // the surface itself is now the Progress Tracker.
  activity_pulse: 'Progress tracker',
  forward_timeline: 'Forward timeline (next 14 days)',
  product_spotlight: 'Product spotlight',
  quick_prompts: 'Try asking Rosa',
  quick_actions: 'Quick actions',
  recently_from_rosa: 'Recently from Rosa',
  recent_conversations: 'Recent conversations',
  circular_partnerships: 'Circular partnerships',
  nature_positive_actions: 'Nature-positive actions',
}
