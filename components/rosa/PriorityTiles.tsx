'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw, X } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow } from '@/components/studio/eyebrow'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import type { WorkingTone } from '@/components/studio/theme'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { trackRosa } from '@/lib/rosa/track'
import { RichText } from '@/components/shared/Brand'

interface CuratedTile {
  id: string
  kind: string
  value: string
  unit: string | null
  title: string
  hint: string
  recommendation: string
  icon: string
  href: string | null
  tone: 'urgent' | 'warn' | 'info' | 'good'
  signal_basis: string[]
}

interface ReadinessSummary {
  next_layer: 'foundation' | 'recipes' | 'lcas' | 'targets'
  facility_data: string
  recipes_status: string
  why: string
}

interface CuratorResponse {
  tiles: CuratedTile[]
  source: 'cache' | 'curator' | 'fallback'
  generated_at: string
  signals_hash: string
  stale?: boolean
  readiness?: ReadinessSummary
}

const SNOOZE_HOURS = 24
const SNOOZE_KEY_PREFIX = 'rosa_priority_snooze_v1_'

function isSnoozed(kind: string): boolean {
  if (typeof window === 'undefined') return false
  const v = localStorage.getItem(SNOOZE_KEY_PREFIX + kind)
  if (!v) return false
  const at = Number(v)
  if (!Number.isFinite(at)) return false
  return Date.now() - at < SNOOZE_HOURS * 60 * 60 * 1000
}

function snoozeKindLocal(kind: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SNOOZE_KEY_PREFIX + kind, String(Date.now()))
}

function readSnoozedKinds(): string[] {
  if (typeof window === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(SNOOZE_KEY_PREFIX)) continue
    const kind = k.slice(SNOOZE_KEY_PREFIX.length)
    if (isSnoozed(kind)) out.push(kind)
  }
  return out
}

interface Props {
  onOpenQueue?: () => void
}

/**
 * Three big priority tiles at the top of /rosa/. Tiles are picked by
 * Claude given a per-org signal pack (see /api/rosa/priority-tiles), so
 * the surface adapts to what's actually most valuable for this user
 * instead of a hand-coded ranking.
 *
 * Behaviour:
 *  - First mount: hits the curator endpoint, which serves a cached pick
 *    if signals haven't moved or generates a fresh one.
 *  - Realtime watchers (queue, anomalies, footprints, targets, ESG)
 *    re-fetch with ?fresh=1 so a user sees the impact of their actions.
 *  - The ⟳ button forces regeneration; useful when a user wants Rosa to
 *    have another look without a data change to trigger it.
 *  - Tile dismissal is local (localStorage 24h snooze) and is forwarded
 *    to the curator on next refresh so Rosa skips dismissed kinds.
 */
export function PriorityTiles({ onOpenQueue }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [data, setData] = useState<CuratorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [snoozeTick, setSnoozeTick] = useState(0)

  const handleSnooze = useCallback((kind: string) => {
    snoozeKindLocal(kind)
    setSnoozeTick(t => t + 1)
    trackRosa('tile.snoozed', { kind })
  }, [])

  const load = useCallback(
    async (opts: { fresh?: boolean; auto?: boolean } = {}): Promise<CuratorResponse | null> => {
      if (!orgId) return null
      const params = new URLSearchParams()
      if (opts.fresh) params.set('fresh', '1')
      // Background upgrades (mount-if-stale / realtime ticks) are budget-capped
      // server-side; user-forced Re-pick omits auto so it bypasses the budget.
      if (opts.fresh && opts.auto) params.set('auto', '1')
      const snoozed = readSnoozedKinds()
      if (snoozed.length > 0) params.set('snoozed', snoozed.join(','))
      const url = `/api/rosa/priority-tiles${params.size > 0 ? `?${params.toString()}` : ''}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) return null
        const json = (await res.json()) as CuratorResponse
        setData(json)
        return json
      } catch {
        // Network failure — keep last good state. Fallback rendering will
        // show the existing tiles or skeleton until the next attempt.
        return null
      } finally {
        setLoading(false)
      }
    },
    [orgId],
  )

  // Background upgrade to a freshly-curated set, guarded so overlapping
  // triggers (mount-if-stale + a realtime tick) don't fire two Gemini calls.
  const upgradingRef = useRef(false)
  const maybeUpgrade = useCallback(async () => {
    if (upgradingRef.current) return
    upgradingRef.current = true
    try {
      await load({ fresh: true, auto: true })
    } finally {
      upgradingRef.current = false
    }
  }, [load])

  // Re-pick: user-forced fresh curation (bypasses the daily budget).
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ fresh: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  // Mount: render the instant cache/fallback, then upgrade in the background
  // only if the server flagged it stale (or returned an uncurated fallback).
  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    let cancelled = false
    void load().then(res => {
      if (cancelled) return
      if (res && (res.stale || res.source === 'fallback')) void maybeUpgrade()
    })
    return () => {
      cancelled = true
    }
  }, [orgId, load, maybeUpgrade])

  // After a document import (or any other client-side data change), upgrade to
  // a fresh curation so the tiles reflect the new state (budget-capped).
  useEffect(() => {
    const handler = () => void maybeUpgrade()
    window.addEventListener('rosa:data-updated', handler)
    return () => window.removeEventListener('rosa:data-updated', handler)
  }, [maybeUpgrade])

  // Live updates: a watched-table change means the signals moved, so upgrade
  // to a fresh curation. Debounced by RealtimeRefreshProvider so a write burst
  // coalesces into one call, and budget-capped — this replaces the previous
  // un-debounced force-fresh-on-every-event storm.
  useRealtimeRefresh(
    [
      'agent_exceptions',
      'product_carbon_footprints',
      'dashboard_anomalies',
      'sustainability_targets',
      'supplier_esg_assessments',
    ],
    () => {
      void maybeUpgrade()
    },
  )

  const tiles = useMemo<CuratedTile[]>(() => {
    if (!data) return []
    return data.tiles.filter(t => !isSnoozed(t.kind))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, snoozeTick])

  if (loading && tiles.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-4 text-room-accent">What needs you today</Eyebrow>
        <Skeleton className="h-36 rounded-[6px]" />
      </section>
    )
  }

  const header = (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <Eyebrow tone="inherit" className="text-room-accent">
        What needs you today
      </Eyebrow>
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
        {data?.source === 'fallback' && <span className="opacity-70">Fallback picks</span>}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] transition-colors duration-200 ease-studio hover:text-foreground disabled:opacity-50"
          aria-label="Ask Rosa to re-pick"
          title="Ask Rosa to re-pick these"
        >
          <RefreshCw className="h-3 w-3" />
          {refreshing ? 'Re-picking' : 'Re-pick'}
        </button>
      </div>
    </div>
  )

  if (tiles.length === 0) {
    return (
      <section>
        {header}
        <p className="border-b border-border pb-3 text-sm text-muted-foreground">
          You&apos;re all caught up. Drop a document or ask Rosa anything below.
        </p>
      </section>
    )
  }

  const [top, ...rest] = tiles
  const restItems: FactRowItem[] = rest.map(t => {
    const chip = TONE_CHIP[t.tone]
    return {
      id: t.id,
      title: <RichText>{t.title}</RichText>,
      hint: t.hint ? <RichText>{t.hint}</RichText> : undefined,
      chip: chip ?? undefined,
      value: t.value || undefined,
      unit: t.unit,
      href: t.kind === 'queue' ? undefined : (t.href ?? undefined),
      onClick:
        t.kind === 'queue' && onOpenQueue
          ? () => {
              trackTileClick(t)
              onOpenQueue()
            }
          : undefined,
      onNavigate: () => trackTileClick(t),
      trailing: <SnoozeButton kind={t.kind} onSnooze={handleSnooze} />,
    }
  })

  // The readiness note joins the list as one more row, unless a curated
  // tile already covers the same ground (then it would just be an echo).
  const readinessRow = readinessAsRow(data?.readiness, tiles)

  return (
    <section>
      {header}
      <PriorityPoster
        tile={top}
        onSnooze={handleSnooze}
        onOpenQueue={top.kind === 'queue' ? onOpenQueue : undefined}
      />
      {(restItems.length > 0 || readinessRow) && (
        <FactList items={readinessRow ? [...restItems, readinessRow] : restItems} className="mt-2" />
      )}
    </section>
  )
}

function trackTileClick(tile: CuratedTile) {
  trackRosa('tile.clicked', {
    tile_id: tile.id,
    kind: tile.kind,
    tone: tile.tone,
    signal_basis: tile.signal_basis,
  })
}

/**
 * Tone → typographic state chip. States are words in a working tone,
 * never coloured backgrounds. Info tiles carry no chip: quiet is quiet.
 */
const TONE_CHIP: Record<CuratedTile['tone'], { label: string; tone: WorkingTone } | null> = {
  urgent: { label: 'Urgent', tone: 'attention' },
  warn: { label: 'Review', tone: 'attention' },
  good: { label: 'On track', tone: 'good' },
  info: null,
}

function SnoozeButton({
  kind,
  onSnooze,
  poster = false,
}: {
  kind: string
  onSnooze: (kind: string) => void
  poster?: boolean
}) {
  return (
    <button
      type="button"
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        onSnooze(kind)
      }}
      aria-label="Snooze for 24 hours"
      title="Snooze for 24 hours"
      className={
        poster
          ? 'rounded-md p-1 text-studio-cream/70 opacity-0 transition-opacity duration-200 ease-studio hover:text-studio-cream group-hover:opacity-100'
          : 'shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-200 ease-studio hover:text-foreground group-hover:opacity-100'
      }
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

/**
 * Which curated-tile kinds already tell the readiness story? If one is on
 * the surface, the readiness row would be an echo, so it stays quiet.
 */
function readinessAsRow(
  readiness: ReadinessSummary | undefined,
  tiles: CuratedTile[],
): FactRowItem | null {
  if (!readiness) return null
  const foundationBroken = readiness.facility_data === 'missing'
  const recipesBroken =
    readiness.recipes_status === 'partial' || readiness.recipes_status === 'missing'
  if (!foundationBroken && !recipesBroken) return null

  const covered = (pattern: RegExp) =>
    tiles.some(t => pattern.test(t.kind) || pattern.test(t.title.toLowerCase()))

  if (foundationBroken && !covered(/facilit|utility|data.?gap|stale/i)) {
    return {
      id: 'readiness-foundation',
      title: 'Get your facility data flowing.',
      hint: 'No facility has had a utility, water, or waste entry in the last 60 days. One recent entry unlocks the LCA pipeline.',
      chip: { tone: 'attention', label: 'Attention' },
      href: '/company/facilities/',
    }
  }
  if (!foundationBroken && recipesBroken && !covered(/recipe|ingredient|match/i)) {
    return {
      id: 'readiness-recipes',
      title: 'Finish matching product ingredients.',
      hint: "Some ingredients still need an emission factor. Until they're matched the LCAs stay in draft.",
      chip: { tone: 'attention', label: 'Attention' },
      href: '/products',
    }
  }
  return null
}

/** The surface's one saturated block: the top priority in forest. */
function PriorityPoster({
  tile,
  onSnooze,
  onOpenQueue,
}: {
  tile: CuratedTile
  onSnooze: (kind: string) => void
  onOpenQueue?: () => void
}) {
  const inner = (
    // The surface's one saturated block: forest, cream text, the number first.
    <div className="group relative h-full overflow-hidden rounded-[6px] bg-studio-forest p-5 sm:p-6 text-studio-cream transition-all duration-200 ease-studio hover:-translate-y-0.5 hover:opacity-[0.96]">
      <div className="flex items-start justify-between mb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] opacity-80">
          Top priority
        </span>
        <div className="flex items-center gap-1">
          <SnoozeButton kind={tile.kind} onSnooze={onSnooze} poster />
          {(tile.href || onOpenQueue) && (
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-studio" />
          )}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[2.5rem] font-bold tabular-nums leading-none">
            {tile.value}
          </span>
          {tile.unit && (
            <span className="font-mono text-xs opacity-80">{tile.unit}</span>
          )}
        </div>
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.2em] opacity-70">
          <RichText>{tile.title}</RichText>
        </p>
        <p className="mt-2 text-xs leading-snug opacity-80 line-clamp-2">
          <RichText>{tile.hint}</RichText>
        </p>
        {tile.recommendation && (
          <p className="mt-3 pt-3 border-t border-studio-cream/25 text-xs italic leading-snug opacity-90">
            Rosa: <RichText>{tile.recommendation}</RichText>
          </p>
        )}
      </div>
    </div>
  )

  const handleClick = () => trackTileClick(tile)

  if (onOpenQueue) {
    return (
      <button
        onClick={() => {
          handleClick()
          onOpenQueue()
        }}
        className="block h-full w-full text-left"
      >
        {inner}
      </button>
    )
  }
  if (tile.href) {
    return (
      <Link href={tile.href} onClick={handleClick} className="block h-full">
        {inner}
      </Link>
    )
  }
  return inner
}
