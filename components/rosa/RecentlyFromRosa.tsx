'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Mail, FileText, X, Clock3 } from 'lucide-react'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'

interface RecentItem {
  id: string
  kind: string
  title: string
  status: string
  source: string
  created_at: string
  reviewed_at: string | null
}

/**
 * "Recently from Rosa" — the last few things she did, written in her voice.
 * Composes from agent_exceptions (approved / rejected / deferred) and from
 * recently-completed ingest_jobs (so users see "I parsed your bill" even
 * before they review it).
 *
 * Limited to the last 7 days, max 6 items, so it stays glanceable.
 */
export function RecentlyFromRosa() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [items, setItems] = useState<RecentItem[] | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [reviewed, ingested] = await Promise.all([
      supabase
        .from('agent_exceptions')
        .select('id, kind, title, status, source, created_at, reviewed_at')
        .eq('organization_id', orgId)
        .in('status', ['approved', 'rejected', 'deferred'])
        .gte('reviewed_at', since)
        .order('reviewed_at', { ascending: false })
        .limit(6),
      supabase
        .from('ingest_jobs')
        .select('id, file_name, result_type, status, created_at')
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(4),
    ])
    const rows: RecentItem[] = []
    for (const r of reviewed.data || []) {
      rows.push({
        id: r.id,
        kind: r.kind,
        title: r.title,
        status: r.status,
        source: r.source,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
      })
    }
    for (const j of ingested.data || []) {
      rows.push({
        id: `j-${j.id}`,
        kind: j.result_type || 'document',
        title: j.file_name || 'document',
        status: 'parsed',
        source: 'upload',
        created_at: j.created_at,
        reviewed_at: null,
      })
    }
    rows.sort((a, b) => {
      const ta = new Date(a.reviewed_at || a.created_at).getTime()
      const tb = new Date(b.reviewed_at || b.created_at).getTime()
      return tb - ta
    })
    setItems(rows.slice(0, 6))
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    load().catch(() => setItems([]))
  }, [orgId, load])

  // Live: anything Rosa just parsed or anything the user just approved
  // should appear here without a refresh.
  useRealtimeRefresh(['agent_exceptions', 'ingest_jobs'], load)

  if (items === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          Recently from Rosa
        </h2>
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">
        Recently from Rosa
      </h2>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.id}>
            <RecentRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentRow({ item }: { item: RecentItem }) {
  const rosa = useRosaContext()
  const href = hrefForRecent(item)

  // Pending items (status='parsed', i.e. not yet reviewed) belong in the
  // queue — clicking opens the drawer's queue tab rather than navigating
  // away. Reviewed items deep-link to the relevant target page.
  const inner = (
    <div className="group flex items-start gap-3 py-1.5 -mx-1 px-1 rounded-md hover:bg-muted/40 transition-colors">
      <span className="flex-shrink-0 mt-0.5">
        <StatusIcon status={item.status} source={item.source} />
      </span>
      <span className="text-muted-foreground tabular-nums text-xs flex-shrink-0 mt-0.5">
        {fmtRelative(item.reviewed_at || item.created_at)}
      </span>
      <span className="flex-1 min-w-0 leading-snug text-sm">
        {phraseFor(item)}
      </span>
    </div>
  )

  if (item.status === 'parsed') {
    return (
      <button
        type="button"
        onClick={() => rosa.open()}
        className="block w-full text-left"
      >
        {inner}
      </button>
    )
  }

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

/**
 * Pick the most useful destination for a given activity item.
 *  - Approved utility/water/waste bill → the facility's data tab where
 *    the saved entries are visible.
 *  - Approved historical sustainability/LCA reports → reports listing.
 *  - Approved supplier impact → the supplier detail page.
 *  - Anything else with no specific target → null (renders inline only).
 */
function hrefForRecent(item: RecentItem): string | null {
  if (item.status !== 'approved') return null
  if (item.kind === 'utility_bill' || item.kind === 'water_bill' || item.kind === 'waste_bill') {
    return '/company/facilities/'
  }
  if (item.kind === 'historical_sustainability_report') {
    return '/reports/sustainability/'
  }
  if (item.kind === 'historical_lca_report') {
    return '/reports/lcas/'
  }
  if (item.kind === 'supplier_proxy' || item.kind === 'website_supplier') {
    return '/suppliers/'
  }
  // Onboarding-seeded items deep-link to the natural follow-up surface so
  // the user can act on what Rosa just did, rather than dead-ending on the
  // hub card.
  if (item.kind === 'onboarding_estimate') return '/products/'
  if (item.kind === 'propose_target') return '/pulse/targets/'
  if (item.kind === 'website_production_location') return '/company/facilities/'
  if (item.kind === 'website_certification') return '/settings/'
  // Ingest-job result types we now emit:
  if (item.kind === 'website_import') return '/products/'
  return null
}

function StatusIcon({ status, source }: { status: string; source: string }) {
  if (status === 'approved')
    return <Check className="h-4 w-4 text-emerald-400" />
  if (status === 'rejected')
    return <X className="h-4 w-4 text-red-400" />
  if (status === 'deferred')
    return <Clock3 className="h-4 w-4 text-amber-400" />
  if (source === 'email')
    return <Mail className="h-4 w-4 text-muted-foreground" />
  return <FileText className="h-4 w-4 text-muted-foreground" />
}

function phraseFor(item: RecentItem): string {
  if (item.status === 'approved') return `Approved · ${item.title}`
  if (item.status === 'rejected') return `Rejected · ${item.title}`
  if (item.status === 'deferred') return `Deferred · ${item.title}`
  if (item.status === 'parsed' && item.source === 'email')
    return `Parsed from email · ${item.title}`
  if (item.status === 'parsed') return `Parsed · ${item.title}`
  return item.title
}

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short' })
}
