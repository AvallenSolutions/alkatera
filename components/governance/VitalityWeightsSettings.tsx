'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, Save, Leaf, Users, Scale } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { trackRosa } from '@/lib/rosa/track'
import {
  DEFAULT_VITALITY_WEIGHTS,
  type VitalityWeights,
} from '@/lib/vitality/composite'

const PILLAR_INFO = [
  {
    key: 'e' as const,
    label: 'Environmental',
    description: 'Climate, water, circularity, nature.',
    Icon: Leaf,
    toneClass: 'text-studio-forest',
  },
  {
    key: 's' as const,
    label: 'Social',
    description: 'Community impact, people & culture, supplier ESG.',
    Icon: Users,
    toneClass: 'text-studio-cobalt',
  },
  {
    key: 'g' as const,
    label: 'Governance',
    description: 'Policies, board, ethics, certifications.',
    Icon: Scale,
    toneClass: 'text-muted-foreground',
  },
]

interface Props {
  /** Optional: render in a tighter card without the page-style header. */
  compact?: boolean
}

/**
 * Three sliders for ESG weighting that keep their sum at 100. Editing
 * one slider re-distributes the remainder across the other two pro-rata.
 * Save writes to organizations.vitality_weights via /api/vitality/weights.
 */
export function VitalityWeightsSettings({ compact = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [weights, setWeights] = useState<VitalityWeights>(DEFAULT_VITALITY_WEIGHTS)
  const [original, setOriginal] = useState<VitalityWeights>(DEFAULT_VITALITY_WEIGHTS)

  useEffect(() => {
    let cancelled = false
    fetch('/api/vitality/weights', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(json => {
        if (cancelled) return
        const w = json.weights ?? DEFAULT_VITALITY_WEIGHTS
        setWeights(w)
        setOriginal(w)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setSliderValue = (changedKey: keyof VitalityWeights, newPctValue: number) => {
    const newPct = clampPct(newPctValue)
    const newFraction = newPct / 100

    // Distribute the remaining (1 - newFraction) across the other two pillars
    // in proportion to their current values. If both others are 0, split evenly.
    const others = (Object.keys(weights) as Array<keyof VitalityWeights>).filter(
      k => k !== changedKey,
    )
    const otherSum = others.reduce((sum, k) => sum + weights[k], 0)
    const remaining = 1 - newFraction
    const next: VitalityWeights = { ...weights, [changedKey]: newFraction }
    if (otherSum === 0) {
      const split = remaining / others.length
      for (const k of others) next[k] = split
    } else {
      for (const k of others) {
        next[k] = (weights[k] / otherSum) * remaining
      }
    }
    setWeights(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/vitality/weights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(weights),
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      setOriginal(weights)
      setSuccess('Weights saved. Refresh your /rosa/ hub to see the new score.')
      trackRosa('weights.adjusted', {
        e: Math.round(weights.e * 100),
        s: Math.round(weights.s * 100),
        g: Math.round(weights.g * 100),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/vitality/weights', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Reset failed (${res.status})`)
      setWeights(DEFAULT_VITALITY_WEIGHTS)
      setOriginal(DEFAULT_VITALITY_WEIGHTS)
      setSuccess('Reset to default (E 50% / S 25% / G 25%).')
      trackRosa('weights.reset', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const dirty =
    Math.abs(weights.e - original.e) > 0.005 ||
    Math.abs(weights.s - original.s) > 0.005 ||
    Math.abs(weights.g - original.g) > 0.005

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading current weights…</div>
  }

  return (
    <div className={cn('space-y-5', compact && 'space-y-3')}>
      {!compact ? (
        <div>
          <h2 className="text-base font-semibold">ESG composite weights</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Decide how the three pillars roll up into your composite vitality score. The
            sliders always total 100%; moving one re-distributes the rest. Saved per organisation.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {PILLAR_INFO.map(({ key, label, description, Icon, toneClass }) => {
          const pct = Math.round(weights[key] * 100)
          return (
            <div key={key} className="rounded-[6px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('h-4 w-4', toneClass)} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-2xl font-semibold tabular-nums leading-none">
                  {pct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{description}</p>
              <Slider
                value={[pct]}
                min={0}
                max={100}
                step={1}
                onValueChange={values => setSliderValue(key, values[0] ?? 0)}
                aria-label={`${label} weight`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={resetting || saving}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? 'Resetting…' : 'Reset to default'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save weights'}
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {success ? <p className="text-xs text-studio-good">{success}</p> : null}
    </div>
  )
}

function clampPct(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}
