'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Package, Inbox, ArrowRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { COMPLIANCE_DEADLINES, expandDeadlines } from '@/lib/pulse/regulatory-deadlines'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'

type EventStatus = 'on_track' | 'at_risk' | 'overdue' | 'blocked'

interface TimelineEvent {
  id: string
  daysAway: number
  /** Calendar label: "Tue 12 May", "Today", "Tomorrow". */
  whenLabel: string
  kind: 'deadline' | 'queue' | 'lca' | 'milestone'
  title: string
  hint: string
  status: EventStatus
  href?: string
}

/**
 * Forward-looking 14-day timeline — what's coming up. Counterpart to the
 * Activity Pulse (which looks back 14 days). Shows:
 *
 *   - Regulatory deadlines (CSRD/EUDR/UK ETS/etc.) due in the next 14 days
 *   - Queue items the agent says could become time-sensitive (older than
 *     ~5 days = at risk; older than 7 = overdue)
 *   - LCAs marked in_progress that have stalled (haven't been updated in
 *     a week — flagged as at_risk)
 *
 * Each event has a status pill and a click-through. Skipped: ML-derived
 * milestones (out of scope here) and user-created reminders (no schema
 * yet). Easy to extend with new event sources via `eventBuilders` below.
 */
export function ForwardTimeline() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [stalledLcas, setStalledLcas] = useState<Array<{ id: string; product_id: string; product_name: string | null; updated_at: string }> | null>(null)
  const [oldQueueCount, setOldQueueCount] = useState<number | null>(null)

  const load = async () => {
    if (!orgId) return
    const since5d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [lcaRes, queueRes] = await Promise.all([
      supabase
        .from('product_carbon_footprints')
        .select('id, product_id, product_name, updated_at')
        .eq('organization_id', orgId)
        .in('status', ['draft', 'in_progress'])
        .lt('updated_at', since7d)
        .order('updated_at', { ascending: true })
        .limit(3),
      supabase
        .from('agent_exceptions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'open')
        .lt('created_at', since5d),
    ])
    setStalledLcas((lcaRes.data as any[]) || [])
    setOldQueueCount(queueRes.count || 0)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useRealtimeRefresh(['agent_exceptions', 'product_carbon_footprints'], load)

  const events = useMemo(() => {
    const out: TimelineEvent[] = []
    const now = new Date()

    // Regulatory deadlines, next 14 days.
    const upcoming = expandDeadlines(COMPLIANCE_DEADLINES, 12, now).filter(
      d => d.days_away >= 0 && d.days_away <= 14,
    )
    for (const d of upcoming) {
      out.push({
        id: `deadline-${d.title}-${d.due_date}`,
        daysAway: d.days_away,
        whenLabel: relativeWhen(d.days_away, d.due_date),
        kind: 'deadline',
        title: d.title,
        hint: d.regime_label,
        status:
          d.days_away <= 2 ? 'overdue' : d.days_away <= 7 ? 'at_risk' : 'on_track',
        href: d.action_href,
      })
    }

    // Stalled queue (open items > 5 days old).
    if ((oldQueueCount ?? 0) > 0) {
      out.push({
        id: 'queue-stalled',
        daysAway: 0,
        whenLabel: 'Now',
        kind: 'queue',
        title: `${oldQueueCount} queue ${oldQueueCount === 1 ? 'item is' : 'items are'} aging`,
        hint: 'Open for more than 5 days',
        status: (oldQueueCount ?? 0) >= 3 ? 'overdue' : 'at_risk',
        href: '/rosa/?view=queue',
      })
    }

    // Stalled LCAs.
    for (const lca of stalledLcas || []) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lca.updated_at).getTime()) / (24 * 60 * 60 * 1000),
      )
      out.push({
        id: `lca-${lca.id}`,
        daysAway: 0,
        whenLabel: `${daysSince}d untouched`,
        kind: 'lca',
        title: `${lca.product_name || 'A product'} LCA stalled`,
        hint: `Last updated ${daysSince} days ago`,
        status: daysSince > 21 ? 'overdue' : daysSince > 14 ? 'at_risk' : 'blocked',
        href: `/products/${lca.product_id}/compliance-wizard/`,
      })
    }

    // Sort: status urgency first (overdue → at_risk → on_track), then
    // by daysAway ascending so soonest things come first within a tone.
    const statusOrder: Record<EventStatus, number> = {
      overdue: 0,
      blocked: 1,
      at_risk: 2,
      on_track: 3,
    }
    out.sort((a, b) => {
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return a.daysAway - b.daysAway
    })

    return out.slice(0, 6)
  }, [stalledLcas, oldQueueCount])

  if (stalledLcas === null && oldQueueCount === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-16 w-full mb-2" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#ccff00]" />
          The next 14 days
        </h2>
        <p className="text-sm text-muted-foreground">
          Clear horizon. Nothing time-sensitive in the next two weeks.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#ccff00]" />
        The next 14 days
      </h2>
      <ol className="relative border-l border-border/60 ml-2 space-y-4">
        {events.map(e => (
          <TimelineRow key={e.id} event={e} />
        ))}
      </ol>
    </div>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const Icon =
    event.kind === 'deadline' ? CalendarClock :
    event.kind === 'queue' ? Inbox :
    event.kind === 'lca' ? Package :
    AlertCircle
  const tone = STATUS_TONE[event.status]

  const inner = (
    <div className="group">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 -ml-[1.625rem] mt-0.5 rounded-full border-2 p-1 bg-card',
            tone.dot,
          )}
        >
          <Icon className={cn('h-3 w-3', tone.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-muted-foreground tabular-nums">
              {event.whenLabel}
            </span>
            <StatusPill status={event.status} />
          </div>
          <p className="mt-1 text-sm font-medium leading-snug">{event.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{event.hint}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0 mt-1.5" />
      </div>
    </div>
  )

  return (
    <li>
      {event.href ? (
        <Link href={event.href} className="block hover:bg-muted/30 -mx-2 px-2 py-1 rounded-lg transition-colors">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}

function StatusPill({ status }: { status: EventStatus }) {
  const tone = STATUS_TONE[status]
  const label =
    status === 'on_track' ? 'On track' :
    status === 'at_risk' ? 'At risk' :
    status === 'overdue' ? 'Overdue' :
    'Stalled'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border',
        tone.pill,
      )}
    >
      {label}
    </span>
  )
}

function relativeWhen(daysAway: number, dueDate: string): string {
  if (daysAway === 0) return 'Today'
  if (daysAway === 1) return 'Tomorrow'
  if (daysAway < 0) return `${Math.abs(daysAway)}d overdue`
  const d = new Date(dueDate)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const STATUS_TONE: Record<
  EventStatus,
  { dot: string; icon: string; pill: string }
> = {
  on_track: {
    dot: 'border-emerald-500/60 bg-emerald-500/10',
    icon: 'text-emerald-300',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  at_risk: {
    dot: 'border-amber-500/60 bg-amber-500/10',
    icon: 'text-amber-300',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  overdue: {
    dot: 'border-red-500/60 bg-red-500/10',
    icon: 'text-red-300',
    pill: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  blocked: {
    dot: 'border-muted bg-muted/30',
    icon: 'text-muted-foreground',
    pill: 'border-border bg-muted/30 text-muted-foreground',
  },
}
