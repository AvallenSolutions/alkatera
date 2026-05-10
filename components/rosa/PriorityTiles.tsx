'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
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

interface CuratorResponse {
  tiles: CuratedTile[]
  source: 'cache' | 'curator' | 'fallback'
  generated_at: string
  signals_hash: string
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
    async (opts: { fresh?: boolean } = {}) => {
      if (!orgId) return
      const params = new URLSearchParams()
      if (opts.fresh) params.set('fresh', '1')
      const snoozed = readSnoozedKinds()
      if (snoozed.length > 0) params.set('snoozed', snoozed.join(','))
      const url = `/api/rosa/priority-tiles${params.size > 0 ? `?${params.toString()}` : ''}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as CuratorResponse
        setData(json)
      } catch {
        // Network failure — keep last good state. Fallback rendering will
        // show the existing tiles or skeleton until the next attempt.
      } finally {
        setLoading(false)
      }
    },
    [orgId],
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ fresh: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    void load()
  }, [orgId, load])

  // Live updates: when any signal-relevant table changes, force a
  // regeneration so the user sees Rosa react to their action.
  useRealtimeRefresh(
    [
      'agent_exceptions',
      'product_carbon_footprints',
      'dashboard_anomalies',
      'sustainability_targets',
      'supplier_esg_assessments',
    ],
    () => {
      void load({ fresh: true })
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
        <p className="mt-2 text-sm font-medium leading-snug">{tile.title}</p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{tile.hint}</p>
        {tile.recommendation && (
          <p
            className={cn(
              'mt-3 pt-3 border-t border-border/50 text-xs italic leading-snug',
              toneStyles.recommendation,
            )}
          >
            <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
            Rosa: {tile.recommendation}
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
