'use client'

import { useRouter } from 'next/navigation'
import { Eyebrow, StateChip } from '@/components/studio'
import type { WorkingTone } from '@/components/studio'
import { useRosaNudges, type RosaNudge } from '@/lib/rosa/useRosaNudges'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'

/**
 * "What I've spotted" at the top of the drawer's empty state. The 1-3 most
 * urgent things Rosa has found (anomalies, queue items aged past 48h,
 * deadlines within the week). Click to deep-link, or to seed a prompt
 * asking her about it. Hidden when there is nothing to surface.
 *
 * Hairline rows in the house rhythm: severity is a typographic working
 * tone, not a tinted icon box. The old rail used raw red-500/amber-500
 * tints, which are off-palette and were the loudest thing in the drawer.
 */
export function NudgeRail() {
  const { nudges, loading } = useRosaNudges()
  const { askRosa } = useRosaContext()
  const router = useRouter()

  if (loading || nudges.length === 0) return null

  return (
    <div>
      <Eyebrow tone="dim">What I&apos;ve spotted</Eyebrow>
      <ul className="mt-2 border-t border-studio-hairline">
        {nudges.map((n) => (
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
  const { tone, word } = severityState(nudge.severity)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 border-b border-studio-hairline py-2.5 text-left transition-colors duration-150 ease-studio hover:text-room-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-semibold leading-snug">
          {nudge.label}
        </span>
        {nudge.hint && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{nudge.hint}</span>
        )}
      </span>
      {word && (
        <StateChip tone={tone} className="mt-0.5 shrink-0">
          {word}
        </StateChip>
      )}
    </button>
  )
}

/** Severity as a word in a working tone. Low severity says nothing at all. */
function severityState(s: RosaNudge['severity']): { tone: WorkingTone; word: string | null } {
  if (s === 'high') return { tone: 'stale', word: 'Needs you' }
  if (s === 'medium') return { tone: 'attention', word: 'Soon' }
  return { tone: 'quiet', word: null }
}
