'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow } from '@/components/studio/eyebrow'
import { FactList } from '@/components/studio/fact-list'
import type { WorkingTone } from '@/components/studio/theme'
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
      <div>
        <Eyebrow className="mb-3 text-room-accent">The next 14 days</Eyebrow>
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  // A clear horizon is one quiet line, not a panel.
  if (events.length === 0) {
    return (
      <div>
        <Eyebrow className="mb-3 text-room-accent">The next 14 days</Eyebrow>
        <p className="border-b border-border pb-3 text-sm text-muted-foreground">
          Clear horizon. Nothing time-sensitive in the next two weeks.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Eyebrow className="mb-3 text-room-accent">The next 14 days</Eyebrow>
      <FactList
        items={events.map(e => ({
          id: e.id,
          title: e.title,
          hint: e.hint,
          chip: STATUS_CHIP[e.status],
          meta: e.whenLabel,
          href: e.href,
        }))}
      />
    </div>
  )
}

function relativeWhen(daysAway: number, dueDate: string): string {
  if (daysAway === 0) return 'Today'
  if (daysAway === 1) return 'Tomorrow'
  if (daysAway < 0) return `${Math.abs(daysAway)}d overdue`
  const d = new Date(dueDate)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Status is a word in a working tone; on-track events carry no chip. */
const STATUS_CHIP: Record<EventStatus, { tone: WorkingTone; label: string } | undefined> = {
  on_track: undefined,
  at_risk: { tone: 'attention', label: 'At risk' },
  overdue: { tone: 'stale', label: 'Overdue' },
  blocked: { tone: 'hold', label: 'Stalled' },
}
