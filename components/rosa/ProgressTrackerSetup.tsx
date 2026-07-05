'use client'

import { useState } from 'react'
import {
  Activity,
  Beaker,
  MessageSquare,
  Sparkles,
  Target,
  TrendingDown,
  Truck,
  X,
  Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { trackRosa } from '@/lib/rosa/track'
import {
  PROGRESS_TRACKERS,
  type ProgressTrackerId,
} from '@/lib/rosa/progress-tracker-types'

interface Option {
  id: ProgressTrackerId
  Icon: React.ComponentType<{ className?: string }>
}

const OPTIONS: Option[] = [
  { id: 'total_emissions', Icon: TrendingDown },
  { id: 'water_use', Icon: Droplets },
  { id: 'lca_coverage', Icon: Beaker },
  { id: 'supplier_esg_signal', Icon: Truck },
  { id: 'target_progress', Icon: Target },
  { id: 'custom_rosa', Icon: Sparkles },
]

interface Props {
  /** Called after a tracker has been picked and saved. */
  onPicked: () => void
  /** Optional: when reopening from settings, allow cancel back to the chart. */
  onCancel?: () => void
}

/**
 * Empty / change state for the Progress Tracker card. Lets the user
 * pick from the v1 trackers directly, or open Rosa to converse.
 */
export function ProgressTrackerSetup({ onPicked, onCancel }: Props) {
  const { askRosa } = useRosaContext() as { askRosa?: (prompt: string) => void }
  const [saving, setSaving] = useState<ProgressTrackerId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = async (id: ProgressTrackerId) => {
    setSaving(id)
    setError(null)
    try {
      const res = await fetch('/api/rosa/progress-tracker', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tracker_id: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      trackRosa('tracker.changed', { tracker_id: id, source: 'chip' })
      onPicked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice')
      setSaving(null)
    }
  }

  const handleAskRosa = () => {
    askRosa?.(
      'What is the most valuable thing for me to track on my Rosa hub? Look at my data and propose one tracker via propose_set_progress_tracker. Explain why you picked it.',
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full',
      )}
    >
      {onCancel ? (
        <button
          onClick={onCancel}
          aria-label="Close setup"
          className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="relative">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 rounded-lg bg-secondary p-2">
            <Activity className="h-4 w-4 text-studio-forest" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-tight">
              Pick something to track
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
              I&apos;ll watch this number for you over 12 weeks and tell you what the
              trend means. You can change this any time.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {OPTIONS.map(({ id, Icon }) => {
            const def = PROGRESS_TRACKERS[id]
            const isSaving = saving === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handlePick(id)}
                disabled={saving !== null}
                className={cn(
                  'group flex items-start gap-3 rounded-[6px] border border-border bg-background/40 p-3 text-left transition',
                  'hover:border-studio-forest/40 hover:bg-secondary',
                  'disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-background/40',
                )}
              >
                <span className="flex-shrink-0 rounded-lg bg-muted/40 p-1.5 text-foreground group-hover:text-studio-forest">
                  {isSaving ? (
                    <Icon className="h-4 w-4 text-studio-forest" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{def.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                    {def.tagline}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Not sure?
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAskRosa}
            disabled={saving !== null}
            className="gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5 text-studio-forest" />
            Ask Rosa to suggest
          </Button>
        </div>

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
