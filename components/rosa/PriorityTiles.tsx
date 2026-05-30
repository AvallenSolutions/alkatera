'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Inbox,
  CalendarClock,
  Package,
  AlertCircle,
  ArrowUpRight,
  X,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  ShieldCheck,
  Beaker,
  FileText,
  Factory,
  Leaf,
  PoundSterling,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizationContext'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { trackRosa } from '@/lib/rosa/track'
import { RichText } from '@/components/shared/Brand'

/**
 * Map of icon names (as emitted by the curator and validated server-side)
 * to lucide components. Anything not in this map falls back to Sparkles.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Inbox,
  CalendarClock,
  Package,
  AlertCircle,
  ArrowUpRight,
  Target,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  ShieldCheck,
  Beaker,
  FileText,
  Factory,
  Leaf,
  PoundSterling,
}

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (tiles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
        <p className="text-sm font-medium">You&apos;re all caught up.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drop a document or ask Rosa anything below to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {data?.source === 'fallback' && (
          <span className="text-muted-foreground/70">Showing fallback picks</span>
        )}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Ask Rosa to re-pick"
          title="Ask Rosa to re-pick these"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Re-pick</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiles.map(t => (
          <PriorityTile
            key={t.id}
            tile={t}
            onSnooze={handleSnooze}
            onOpenQueue={t.kind === 'queue' ? onOpenQueue : undefined}
          />
        ))}
      </div>
      {data?.readiness && <ReadinessBadge readiness={data.readiness} />}
    </div>
  )
}

function PriorityTile({
  tile,
  onSnooze,
  onOpenQueue,
}: {
  tile: CuratedTile
  onSnooze: (kind: string) => void
  onOpenQueue?: () => void
}) {
  const Icon: LucideIcon = ICON_MAP[tile.icon] ?? Sparkles
  const toneStyles = TONE_STYLES[tile.tone]

  const inner = (
    <div
      className={cn(
        'group relative h-full rounded-2xl border p-5 sm:p-6 overflow-hidden transition-all',
        'hover:shadow-lg hover:-translate-y-0.5',
        toneStyles.card,
      )}
    >
      <div
        aria-hidden="true"
        className={cn('absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl pointer-events-none', toneStyles.glow)}
      />
      <div className="relative flex items-start justify-between mb-4">
        <span className={cn('rounded-lg p-2', toneStyles.iconBg)}>
          <Icon className={cn('h-5 w-5', toneStyles.iconColor)} />
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onSnooze(tile.kind)
            }}
            aria-label="Snooze for 24 hours"
            title="Snooze for 24 hours"
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {(tile.href || onOpenQueue) && (
            <ArrowUpRight className={cn('h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity', toneStyles.iconColor)} />
          )}
        </div>
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-semibold tabular-nums leading-none', toneStyles.value)}>
            {tile.value}
          </span>
          {tile.unit && (
            <span className="text-sm text-muted-foreground">{tile.unit}</span>
          )}
        </div>
        <p className="mt-2 text-sm font-medium leading-snug">
          <RichText>{tile.title}</RichText>
        </p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          <RichText>{tile.hint}</RichText>
        </p>
        {tile.recommendation && (
          <p
            className={cn(
              'mt-3 pt-3 border-t border-border/50 text-xs italic leading-snug',
              toneStyles.recommendation,
            )}
          >
            <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
            Rosa: <RichText>{tile.recommendation}</RichText>
          </p>
        )}
      </div>
    </div>
  )

  const handleClick = () => {
    trackRosa('tile.clicked', {
      tile_id: tile.id,
      kind: tile.kind,
      tone: tile.tone,
      signal_basis: tile.signal_basis,
    })
  }

  if (onOpenQueue) {
    return (
      <button
        onClick={() => {
          handleClick()
          onOpenQueue()
        }}
        className="block w-full text-left"
      >
        {inner}
      </button>
    )
  }
  if (tile.href) {
    return (
      <Link href={tile.href} onClick={handleClick}>
        {inner}
      </Link>
    )
  }
  return inner
}

const TONE_STYLES: Record<CuratedTile['tone'], {
  card: string
  glow: string
  iconBg: string
  iconColor: string
  value: string
  recommendation: string
}> = {
  urgent: {
    card: 'border-[#ccff00]/40 bg-[#ccff00]/[0.04]',
    glow: 'bg-[#ccff00]/15',
    iconBg: 'bg-[#ccff00]/15',
    iconColor: 'text-[#ccff00]',
    value: 'text-[#ccff00]',
    recommendation: 'text-[#ccff00]/85',
  },
  warn: {
    card: 'border-amber-500/40 bg-amber-500/[0.04]',
    glow: 'bg-amber-500/15',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-300',
    value: 'text-amber-200',
    recommendation: 'text-amber-200/85',
  },
  info: {
    card: 'border-border bg-card',
    glow: 'bg-blue-500/10',
    iconBg: 'bg-muted',
    iconColor: 'text-foreground',
    value: 'text-foreground',
    recommendation: 'text-muted-foreground',
  },
  good: {
    card: 'border-emerald-500/40 bg-emerald-500/[0.04]',
    glow: 'bg-emerald-500/15',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-300',
    value: 'text-emerald-200',
    recommendation: 'text-emerald-200/85',
  },
}

function ReadinessBadge({ readiness }: { readiness: ReadinessSummary }) {
  // Only treat the org-level foundation as broken when ALL facilities are
  // stale (i.e. readiness === 'missing'). When some facilities are fresh
  // and some are stale, the user is clearly maintaining data; individual
  // stale facilities show up as their own priority tiles, so an alarming
  // banner here is redundant and noisy.
  const foundationBroken = readiness.facility_data === 'missing'
  const recipesBroken =
    readiness.recipes_status === 'partial' || readiness.recipes_status === 'missing'

  if (!foundationBroken && !recipesBroken) return null

  const { title, body, cta, href } = foundationBroken
    ? {
        title: 'Get your facility data flowing',
        body: 'No facility has had a utility, water, or waste entry in the last 60 days. Adding even one recent entry unlocks the LCA pipeline.',
        cta: 'Open facilities',
        href: '/company/facilities/',
      }
    : {
        title: 'Finish matching product ingredients',
        body: 'Some ingredients still need an emission factor. Until they\'re matched the LCAs stay in draft.',
        cta: 'Open products',
        href: '/products',
      }

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-card to-card px-4 py-3 hover:border-amber-500/50 hover:from-amber-500/[0.12] transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100 leading-snug">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <span className="self-center shrink-0 inline-flex items-center gap-1 text-xs font-medium text-amber-200 group-hover:text-amber-100">
          {cta}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}
