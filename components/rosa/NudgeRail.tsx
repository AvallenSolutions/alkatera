'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, AlertCircle, CalendarClock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRosaNudges, type RosaNudge } from '@/lib/rosa/useRosaNudges'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'

/**
 * "What's new" rail at the top of the drawer's empty state. Shows the
 * 1-3 most urgent things Rosa has spotted (anomalies, queue items aged
 * past 48h, deadlines in the next week). Click → either deep-link or
 * seed a Rosa prompt asking about that item.
 *
 * Hidden when there's nothing to surface.
 */
export function NudgeRail() {
  const { nudges, loading } = useRosaNudges()
  const { askRosa } = useRosaContext()
  const router = useRouter()

  if (loading || nudges.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        What I&apos;ve spotted
      </p>
      <ul className="space-y-1">
        {nudges.map(n => (
          <li key={n.id}>
            <NudgeRow
              nudge={n}
              onClick={() => {
                if (n.href) router.push(n.href)
                else if (n.prompt) askRosa(n.prompt)
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NudgeRow({ nudge, onClick }: { nudge: RosaNudge; onClick: () => void }) {
  const Icon =
    nudge.kind === 'queue' ? Inbox : nudge.kind === 'anomaly' ? AlertCircle : CalendarClock
  const tone = severityToneClasses(nudge.severity)
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left flex items-start gap-3 rounded-lg p-2',
        'hover:bg-muted transition-colors',
      )}
    >
      <span className={cn('flex-shrink-0 rounded-md p-1.5 mt-0.5', tone.iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', tone.icon)} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug truncate">{nudge.label}</p>
        {nudge.hint && (
          <p className="text-xs text-muted-foreground truncate">{nudge.hint}</p>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground flex-shrink-0 mt-1.5 transition-colors" />
    </button>
  )
}

function severityToneClasses(s: RosaNudge['severity']) {
  if (s === 'high') {
    return { iconBg: 'bg-red-500/15', icon: 'text-red-300' }
  }
  if (s === 'medium') {
    return { iconBg: 'bg-amber-500/15', icon: 'text-amber-300' }
  }
  return { iconBg: 'bg-muted', icon: 'text-muted-foreground' }
}
