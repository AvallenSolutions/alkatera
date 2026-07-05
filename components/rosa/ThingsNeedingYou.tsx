'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, AlertCircle, CalendarClock, Inbox, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BriefingResponse {
  insight: { headline: string; generated_at: string } | null
  anomalies: { open_count: number; top_severity: 'low' | 'medium' | 'high' | null }
  next_deadline: {
    title: string
    regime_label: string
    due_date: string
    days_away: number
    action_href: string
  } | null
  next_gap: { step: string; why: string; href: string } | null
}

type ThingKind = 'queue' | 'deadline' | 'anomaly' | 'gap' | 'insight'

interface Thing {
  kind: ThingKind
  priority: number  // lower = more urgent, used for sort
  title: string
  hint: string
  href: string
  icon: typeof AlertCircle
}

/**
 * The list of "3 things needing you today" on Rosa's home canvas.
 *
 * Pulls from three sources and ranks them:
 *   1. Open exceptions in the agent queue (count → CTA to /rosa/?view=queue)
 *   2. The four briefing data points from /api/rosa/briefing (deadline,
 *      anomaly, data gap, latest insight)
 *
 * Rendered in Rosa's voice — first-person where possible, plain English.
 * No semantic colour cards; just rows that share the rest of the canvas's
 * visual language.
 */
export function ThingsNeedingYou({ onOpenQueue }: { onOpenQueue?: () => void }) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [briefing, setBriefing] = useState<BriefingResponse | null>(null)
  const [openExceptions, setOpenExceptions] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [briefingRes, exceptionRes] = await Promise.all([
        fetch('/api/rosa/briefing').then(r => (r.ok ? r.json() : null)).catch(() => null),
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'open'),
      ])
      if (cancelled) return
      setBriefing(briefingRes)
      setOpenExceptions(exceptionRes.count || 0)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [orgId])

  const things: Thing[] = useMemo(() => {
    const out: Thing[] = []

    if (openExceptions && openExceptions > 0) {
      out.push({
        kind: 'queue',
        priority: 0,
        title: `Approve ${openExceptions} ${openExceptions === 1 ? 'item' : 'items'} I parsed`,
        hint: 'Review and confirm so I can write them to your footprint.',
        href: '/rosa/?view=queue',
        icon: Inbox,
      })
    }

    if (briefing?.next_deadline) {
      const d = briefing.next_deadline
      const urgency =
        d.days_away <= 7 ? 'this week' : d.days_away <= 14 ? 'next two weeks' : `in ${d.days_away} days`
      out.push({
        kind: 'deadline',
        priority: d.days_away <= 7 ? 1 : 2,
        title: d.title,
        hint: `${d.regime_label} · ${urgency}`,
        href: d.action_href,
        icon: CalendarClock,
      })
    }

    if (briefing?.anomalies && briefing.anomalies.open_count > 0) {
      const sev = briefing.anomalies.top_severity
      out.push({
        kind: 'anomaly',
        priority: sev === 'high' ? 1 : sev === 'medium' ? 3 : 4,
        title: `${briefing.anomalies.open_count} ${briefing.anomalies.open_count === 1 ? 'anomaly' : 'anomalies'} I noticed`,
        hint: `${sev ? `top severity ${sev}` : 'review when you can'}`,
        href: '/pulse/',
        icon: AlertCircle,
      })
    }

    if (briefing?.next_gap) {
      out.push({
        kind: 'gap',
        priority: 5,
        title: briefing.next_gap.step,
        hint: briefing.next_gap.why,
        href: briefing.next_gap.href,
        icon: TrendingUp,
      })
    }

    if (briefing?.insight) {
      out.push({
        kind: 'insight',
        priority: 6,
        title: briefing.insight.headline,
        hint: 'Latest insight',
        href: '/pulse/',
        icon: TrendingUp,
      })
    }

    return out.sort((a, b) => a.priority - b.priority).slice(0, 3)
  }, [briefing, openExceptions])

  if (loading) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          What needs you today
        </h2>
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    )
  }

  if (things.length === 0) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          What needs you today
        </h2>
        <p className="text-sm">
          You&apos;re all caught up. Drop a document or ask me anything below.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">
        What needs you today
      </h2>
      <ul className="divide-y divide-border">
        {things.map((thing, i) => (
          <li key={`${thing.kind}-${i}`}>
            <ThingRow thing={thing} index={i + 1} onOpenQueue={onOpenQueue} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ThingRow({
  thing,
  index,
  onOpenQueue,
}: {
  thing: Thing
  index: number
  onOpenQueue?: () => void
}) {
  const Icon = thing.icon
  const isQueue = thing.kind === 'queue'

  const inner = (
    <div className="flex items-start gap-3 py-3 group">
      <span
        className={cn(
          'flex-shrink-0 rounded-md p-1.5 transition-colors',
          'bg-muted text-muted-foreground group-hover:text-studio-forest',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          <span className="text-muted-foreground tabular-nums mr-2">{index}.</span>
          {thing.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{thing.hint}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
    </div>
  )

  if (isQueue && onOpenQueue) {
    return (
      <button onClick={onOpenQueue} className="block w-full text-left">
        {inner}
      </button>
    )
  }

  return <Link href={thing.href}>{inner}</Link>
}
