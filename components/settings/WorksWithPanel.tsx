'use client'

/**
 * "What you work with" — the settings home of the arrival ritual's modules
 * answer (components/onboarding/steps/ArrivalModulesStep.tsx).
 *
 * Vineyards, orchards, arable fields and hospitality are not for every drinks
 * business, so the platform asks once and remembers. A business that takes on
 * a vineyard in year two changes the answer here.
 *
 * Declared need, not entitlement: ticking a box makes the module appear in the
 * workbench whatever the plan, and the Canopy tier is what opens it. The panel
 * says so rather than hiding the options, so the upsell is concrete.
 *
 * Self-contained: saves itself on toggle rather than joining the big settings
 * form's shared save, because it writes one column and nothing else depends
 * on it.
 */

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import {
  MODULE_LABEL,
  WORKS_WITH_MODULES,
  parseWorksWith,
  type WorksWithModule,
} from '@/lib/subscription/works-with'
import { Panel, Eyebrow, StateChip } from '@/components/studio'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const MODULE_HINT: Record<WorksWithModule, string> = {
  viticulture: 'You grow your own grapes.',
  orchards: 'You grow your own fruit.',
  arable_fields: 'You grow your own barley, wheat or other grain.',
  hospitality: 'You run a restaurant, bar, tasting room or rooms.',
}

export function WorksWithPanel() {
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const [selected, setSelected] = useState<WorksWithModule[]>([])
  const [unlocked, setUnlocked] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    fetch(`/api/organization/works-with?organizationId=${currentOrganization.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSelected(parseWorksWith(data.worksWith))
        setUnlocked(data.unlocked !== false)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id])

  const toggle = async (key: WorksWithModule, on: boolean) => {
    if (saving) return
    const next = on ? [...selected, key] : selected.filter((k) => k !== key)
    const previous = selected
    setSelected(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/organization/works-with', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization?.id, worksWith: next }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Could not save')
      // The room band reads works_with off the org in context.
      await refreshOrganizations()
    } catch (err) {
      setSelected(previous)
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Eyebrow tone="dim">What you work with</Eyebrow>
          {loaded && !unlocked && <StateChip tone="attention">Canopy</StateChip>}
        </div>
        <p className="text-sm text-studio-dim">
          {unlocked
            ? 'Growing and hospitality are only for the businesses that do them. Turn on what applies and it appears in your workbench.'
            : 'Turn on what applies and it appears in your workbench, ready for when you move to Canopy.'}
        </p>
      </div>

      <div className="space-y-3">
        {WORKS_WITH_MODULES.map((key) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor={`works-with-${key}`} className="font-medium">
                {MODULE_LABEL[key]}
              </Label>
              <p className="text-xs text-muted-foreground">{MODULE_HINT[key]}</p>
            </div>
            <Switch
              id={`works-with-${key}`}
              checked={selected.includes(key)}
              onCheckedChange={(on) => toggle(key, on)}
              disabled={!loaded || saving}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-studio-stale">{error}</p>}
    </Panel>
  )
}
