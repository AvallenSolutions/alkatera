'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dog,
  ShieldCheck,
  TrendingDown,
  Calculator,
  Truck,
  Beaker,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { trackRosa } from '@/lib/rosa/track'
import {
  HUB_CARD_IDS,
  useHubLayout,
  type HubCardId,
  type HubCardLayout,
} from '@/lib/rosa/useHubLayout'

const STORAGE_KEY = 'rosa_hub_setup_completed_v1'

/**
 * Each focus area maps to one or more hub cards. priority_tiles is always on
 * (the always-useful "what needs me" surface) so the page never feels empty.
 */
interface FocusOption {
  id: string
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  cards: HubCardId[]
}

const ALWAYS_ON: HubCardId[] = ['priority_tiles']

const FOCUS_OPTIONS: FocusOption[] = [
  {
    id: 'compliance',
    label: 'Reporting & compliance',
    description: 'Deadlines, audits, regulatory exposure.',
    Icon: ShieldCheck,
    cards: ['forward_timeline'],
  },
  {
    id: 'footprint',
    label: 'Footprint & impact',
    description: 'Carbon, products, trends over time.',
    Icon: TrendingDown,
    cards: ['activity_pulse', 'product_spotlight'],
  },
  {
    id: 'finance',
    label: 'Cost & valuation',
    description: 'Spend, financial impact, board-ready numbers.',
    Icon: Calculator,
    cards: ['activity_pulse'],
  },
  {
    id: 'suppliers',
    label: 'Suppliers & data capture',
    description: 'Day-to-day data entry, supplier work.',
    Icon: Truck,
    cards: ['quick_actions'],
  },
  {
    id: 'lcas',
    label: 'LCAs & products',
    description: 'Product footprints, recipes, methodology.',
    Icon: Beaker,
    cards: ['product_spotlight', 'quick_actions'],
  },
  {
    id: 'rosa_chat',
    label: 'Working with Rosa',
    description: 'Recent conversations and Rosa’s own activity.',
    Icon: MessageSquare,
    cards: ['quick_prompts', 'recently_from_rosa', 'recent_conversations'],
  },
]

interface Props {
  /** Render in compact mode (no big intro), e.g. when re-running from settings. */
  compact?: boolean
  /** Called when the user finishes (saved or skipped) so the parent can hide. */
  onDone?: () => void
}

/**
 * One-question warm setup that Rosa runs on a user's first visit to /rosa/.
 * Their picks build a personalised hub layout and write a `focus_areas`
 * memory entry so Rosa's own context is informed by the same answer.
 *
 * Self-gating: returns null when (a) the localStorage flag is set OR (b) a
 * stored hub_layout already exists (the user has customised before). Pass
 * `compact` to render even when previously completed (used from settings).
 */
export function HubSetupWizard({ compact = false, onDone }: Props) {
  const { layout, setLayout, isLoading } = useHubLayout()

  const [completedFlag, setCompletedFlag] = useState<boolean | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setCompletedFlag(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  // Treat "any non-default layout" as already-customised so a returning user
  // who tweaked things in the settings dialog isn't asked again.
  const hasCustomLayout = useMemo(() => {
    if (isLoading) return null
    return layout.some(c => !c.visible)
  }, [layout, isLoading])

  const togglePick = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildLayoutFromPicks = (): HubCardLayout[] => {
    if (picked.size === 0) {
      // Nothing picked but they hit save — treat as "show me everything".
      return HUB_CARD_IDS.map(id => ({ id, visible: true }))
    }
    const visibleSet = new Set<HubCardId>(ALWAYS_ON)
    for (const optId of Array.from(picked)) {
      const opt = FOCUS_OPTIONS.find(o => o.id === optId)
      if (!opt) continue
      for (const c of opt.cards) visibleSet.add(c)
    }
    return HUB_CARD_IDS.map(id => ({ id, visible: visibleSet.has(id) }))
  }

  const dismiss = (markCompleted: boolean) => {
    if (typeof window !== 'undefined' && markCompleted) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setCompletedFlag(true)
    onDone?.()
  }

  const persistFocusAreas = async () => {
    if (picked.size === 0) return
    try {
      await fetch('/api/rosa/memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'focus_areas',
          value: JSON.stringify(Array.from(picked)),
          scope: 'user',
        }),
      })
    } catch {
      // Non-fatal: layout still saved. Rosa just won't know the focus areas.
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    await setLayout(HUB_CARD_IDS.map(id => ({ id, visible: true })))
    trackRosa('hub.setup_completed', { mode: 'show_all' })
    dismiss(true)
    setSaving(false)
  }

  const handleSavePicks = async () => {
    setSaving(true)
    await setLayout(buildLayoutFromPicks())
    await persistFocusAreas()
    trackRosa('hub.setup_completed', {
      mode: 'picks',
      focus_areas: Array.from(picked),
    })
    dismiss(true)
    setSaving(false)
  }

  const handleSkip = () => {
    trackRosa('hub.setup_completed', { mode: 'skipped' })
    dismiss(true)
  }

  // Gating: hide unless the user genuinely hasn't set up yet (or compact mode).
  if (!compact) {
    if (completedFlag === null || hasCustomLayout === null) return null
    if (completedFlag === true) return null
    if (hasCustomLayout === true) return null
  }

  return (
    <div className="relative overflow-hidden rounded-[6px] border border-border bg-card p-6 sm:p-8">
      {compact ? null : (
        <button
          onClick={handleSkip}
          aria-label="Skip setup"
          className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-[6px] border border-border bg-background p-2.5">
            <Dog className="h-6 w-6 text-studio-forest" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-semibold leading-tight">
              Let me set this up for you.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Pick what matters most to your role at alka<strong>tera</strong>. I&apos;ll
              show those things first. You can change this any time using the gear
              icon, and add or remove things as you go.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FOCUS_OPTIONS.map(({ id, label, description, Icon }) => {
            const isPicked = picked.has(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => togglePick(id)}
                disabled={saving}
                className={cn(
                  'group flex items-start gap-3 rounded-[6px] border p-3 text-left transition-colors duration-200 ease-studio',
                  isPicked
                    ? 'border-studio-forest bg-background'
                    : 'border-border bg-background hover:border-foreground/30',
                  'disabled:opacity-50',
                )}
                aria-pressed={isPicked}
              >
                <span
                  className={cn(
                    'flex-shrink-0 p-2 transition-colors duration-200 ease-studio',
                    isPicked
                      ? 'text-studio-forest'
                      : 'text-muted-foreground group-hover:text-studio-forest',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveAll}
            disabled={saving}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {saving && picked.size === 0 ? 'Saving…' : 'Show me everything'}
          </Button>
          <Button
            size="sm"
            onClick={handleSavePicks}
            disabled={saving || picked.size === 0}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving && picked.size > 0
              ? 'Building…'
              : picked.size === 0
                ? 'Pick at least one'
                : `Build my view (${picked.size})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
