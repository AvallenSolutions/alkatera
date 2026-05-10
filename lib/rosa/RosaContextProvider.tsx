'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'

/**
 * A piece of page-level context the user is currently looking at, contributed
 * by a page (or any component) so Rosa can answer questions specific to it.
 *
 * Pattern:
 *   useRosaPageContext({
 *     id: 'recipe-editor',
 *     label: 'Recipe — Marlborough Sauv Blanc 750ml',
 *     priority: 8,
 *     data: { ingredientId, candidateFactors, /\* … *\/ },
 *   })
 *
 * Slices register on mount, update when their dependencies change, and
 * unregister on unmount. Slices with the same id replace each other (so a
 * single page can update its own slice as the user picks a different
 * ingredient without piling up stale data). Priority breaks ties when
 * summarising for Rosa — higher = more important.
 */
export interface RosaContextSlice {
  id: string
  label: string
  priority: number
  data: Record<string, unknown>
}

/**
 * A specific entity the user is asking Rosa about (an unmatched ingredient
 * row, an anomaly card, a queue item, etc.). Pinned via `selectEntity()`,
 * usually from an inline "Ask Rosa about this" button. The drawer
 * surfaces it as a high-priority slice so Rosa can reference it directly.
 */
export interface RosaSelectedEntity {
  type: string
  id: string
  label: string
  /** Free-form fields about this specific entity. */
  data?: Record<string, unknown>
}

interface RosaContextValue {
  // UI state
  isOpen: boolean
  isPinned: boolean
  width: number
  // Slices contributed by pages
  slices: RosaContextSlice[]
  // The specific row/entity the user clicked an "Ask Rosa" button for
  selectedEntity: RosaSelectedEntity | null
  // A prompt the drawer should pick up on next render (e.g. from a hub
  // chip or a deep-link `?prompt=`). The drawer consumes and clears it.
  pendingPrompt: string | null
  // A conversation id the drawer should hydrate on next render (e.g.
  // from a Recent Conversations card on the hub). The drawer's
  // useRosaConversation calls loadConversation() then clears.
  pendingConversationId: string | null
  // Methods
  open: () => void
  close: () => void
  toggle: () => void
  setPinned: (pinned: boolean) => void
  setWidth: (width: number) => void
  registerSlice: (slice: RosaContextSlice) => void
  unregisterSlice: (id: string) => void
  /** Pin a specific entity to the conversation (rendered as a slice). */
  selectEntity: (entity: RosaSelectedEntity) => void
  /** Clear the pinned entity (e.g. when the user starts a new chat). */
  clearEntity: () => void
  /** Open the drawer and seed it with a prompt to send. */
  askRosa: (prompt: string) => void
  /** Called by the drawer once it has consumed the pending prompt. */
  consumePendingPrompt: () => void
  /** Open the drawer and load a specific past conversation by id. */
  resumeConversation: (id: string) => void
  /** Called by the drawer once it has hydrated the requested conversation. */
  consumePendingConversationId: () => void
}

const STORAGE_KEY_PINNED = 'rosa_drawer_pinned'
const STORAGE_KEY_WIDTH = 'rosa_drawer_width'
const DEFAULT_WIDTH = 440
const MIN_WIDTH = 320
const MAX_WIDTH = 600

const RosaContext = createContext<RosaContextValue | null>(null)

export function RosaContextProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [width, setWidthState] = useState(DEFAULT_WIDTH)
  const [slices, setSlices] = useState<RosaContextSlice[]>([])
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<RosaSelectedEntity | null>(null)
  const pathname = usePathname()

  // Hydrate persisted preferences on mount. Done in an effect so SSR doesn't
  // mismatch — server renders with the defaults; client upgrades.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const pinned = localStorage.getItem(STORAGE_KEY_PINNED) === 'true'
      const w = Number(localStorage.getItem(STORAGE_KEY_WIDTH))
      if (pinned) {
        setIsPinned(true)
        setIsOpen(true) // pinned implies open
      }
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) {
        setWidthState(w)
      }
    } catch {
      // ignore
    }
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => {
    // Closing while pinned should also unpin — otherwise the next page
    // load reopens the drawer despite the user having dismissed it.
    setIsOpen(false)
    if (isPinned) {
      setIsPinned(false)
      try {
        localStorage.setItem(STORAGE_KEY_PINNED, 'false')
      } catch {
        // ignore
      }
    }
  }, [isPinned])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const setPinned = useCallback((pinned: boolean) => {
    setIsPinned(pinned)
    if (pinned) setIsOpen(true)
    try {
      localStorage.setItem(STORAGE_KEY_PINNED, pinned ? 'true' : 'false')
    } catch {
      // ignore
    }
  }, [])

  const setWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)))
    setWidthState(clamped)
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped))
    } catch {
      // ignore
    }
  }, [])

  const registerSlice = useCallback((slice: RosaContextSlice) => {
    setSlices(prev => {
      const next = prev.filter(s => s.id !== slice.id)
      next.push(slice)
      return next
    })
  }, [])

  const unregisterSlice = useCallback((id: string) => {
    setSlices(prev => prev.filter(s => s.id !== id))
  }, [])

  const askRosa = useCallback((prompt: string) => {
    setPendingPrompt(prompt)
    setIsOpen(true)
  }, [])

  const consumePendingPrompt = useCallback(() => {
    setPendingPrompt(null)
  }, [])

  const resumeConversation = useCallback((id: string) => {
    setPendingConversationId(id)
    setIsOpen(true)
  }, [])

  const consumePendingConversationId = useCallback(() => {
    setPendingConversationId(null)
  }, [])

  const selectEntity = useCallback((entity: RosaSelectedEntity) => {
    setSelectedEntity(entity)
  }, [])

  const clearEntity = useCallback(() => {
    setSelectedEntity(null)
  }, [])

  // The pinned entity gets surfaced to Rosa as a high-priority slice so
  // she can reference it directly ("the maple syrup row you clicked on").
  // Re-registers whenever it changes; cleans up when cleared.
  useEffect(() => {
    if (!selectedEntity) {
      setSlices(prev => prev.filter(s => s.id !== '__entity__'))
      return
    }
    const slice: RosaContextSlice = {
      id: '__entity__',
      label: selectedEntity.label,
      priority: 10,
      data: {
        type: selectedEntity.type,
        id: selectedEntity.id,
        ...(selectedEntity.data || {}),
      },
    }
    setSlices(prev => {
      const next = prev.filter(s => s.id !== '__entity__')
      next.push(slice)
      return next
    })
  }, [selectedEntity])

  // Auto-contributed default slice: every page gets a low-priority slice
  // describing the URL + a humanised page title derived from the route
  // segments. Pages can opt in to richer context via useRosaPageContext.
  useEffect(() => {
    if (!pathname) return
    const segments = pathname.split('/').filter(Boolean)
    const pageLabel = humanisePath(pathname, segments)
    const slice: RosaContextSlice = {
      id: '__route__',
      label: `On ${pageLabel}`,
      priority: 1,
      data: {
        path: pathname,
        segments,
      },
    }
    setSlices(prev => {
      const next = prev.filter(s => s.id !== '__route__')
      next.push(slice)
      return next
    })
    // No cleanup — the slice is replaced on every pathname change.
  }, [pathname])

  // Keyboard shortcut: ⌘ /  (or Ctrl /) toggles the drawer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape' && isOpen && !isPinned) {
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle, close, isOpen, isPinned])

  const value = useMemo<RosaContextValue>(
    () => ({
      isOpen,
      isPinned,
      width,
      slices,
      selectedEntity,
      pendingPrompt,
      pendingConversationId,
      open,
      close,
      toggle,
      setPinned,
      setWidth,
      registerSlice,
      unregisterSlice,
      selectEntity,
      clearEntity,
      askRosa,
      consumePendingPrompt,
      resumeConversation,
      consumePendingConversationId,
    }),
    [isOpen, isPinned, width, slices, selectedEntity, pendingPrompt, pendingConversationId, open, close, toggle, setPinned, setWidth, registerSlice, unregisterSlice, selectEntity, clearEntity, askRosa, consumePendingPrompt, resumeConversation, consumePendingConversationId],
  )

  return <RosaContext.Provider value={value}>{children}</RosaContext.Provider>
}

export function useRosaContext(): RosaContextValue {
  const ctx = useContext(RosaContext)
  if (!ctx) {
    throw new Error('useRosaContext must be used inside <RosaContextProvider />')
  }
  return ctx
}

/**
 * Page-level hook for contributing structured context to Rosa. Call this in
 * a component that knows what the user is currently doing on the page.
 *
 * Example (recipe editor):
 *   useRosaPageContext({
 *     id: 'recipe-editor',
 *     label: `Recipe — ${product.name}`,
 *     priority: 8,
 *     data: {
 *       productId: product.id,
 *       ingredients: ingredients.map(i => i.name),
 *       activeIngredient: selected ? { id: selected.id, name: selected.name } : null,
 *     },
 *   })
 *
 * Behaviour:
 *   - Registers on mount, unregisters on unmount.
 *   - Re-registers on every dependency change (so the data stays fresh).
 *   - Slices with the same `id` replace each other — one page = one slice.
 *
 * Important: only put values Rosa truly needs. Don't stream entire form
 * states or PII; pick what's relevant. The slice is sent to Rosa's system
 * prompt verbatim on every chat turn.
 */
export function useRosaPageContext(slice: RosaContextSlice | null) {
  const { registerSlice, unregisterSlice } = useRosaContext()
  const sliceRef = useRef<RosaContextSlice | null>(null)

  useEffect(() => {
    if (!slice) {
      if (sliceRef.current) {
        unregisterSlice(sliceRef.current.id)
        sliceRef.current = null
      }
      return
    }
    sliceRef.current = slice
    registerSlice(slice)
    return () => {
      if (sliceRef.current?.id === slice.id) {
        unregisterSlice(slice.id)
        sliceRef.current = null
      }
    }
    // We intentionally re-register on the entire slice object; pages should
    // memoise their slice or wrap construction in useMemo to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(slice)])
}

/**
 * Map a pathname to a humanised page name. "/products/abc/recipe" →
 * "Products — Recipe", "/data/scope-1-2/" → "Data — Scope 1 & 2", etc.
 *
 * Best effort. Pages that contribute their own slice with a richer label
 * will typically override this default.
 */
function humanisePath(pathname: string, segments: string[]): string {
  if (segments.length === 0) return 'Home'
  if (pathname === '/rosa/' || pathname === '/rosa') return 'Rosa'
  // Drop UUID-looking segments (route params)
  const visible = segments.filter(s => !looksLikeId(s))
  if (visible.length === 0) return 'Home'
  return visible
    .map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(' — ')
}

function looksLikeId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(segment) || /^\d+$/.test(segment)
}
