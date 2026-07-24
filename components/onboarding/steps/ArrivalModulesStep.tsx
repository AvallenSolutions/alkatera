'use client'

import { useMemo, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import {
  MODULE_LABEL,
  WORKS_WITH_MODULES,
  parseWorksWith,
  type WorksWithModule,
} from '@/lib/subscription/works-with'
import { Eyebrow, PillButton } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ArrowRight, Grape, TreeDeciduous, Wheat, UtensilsCrossed } from 'lucide-react'
import { RosaIntro } from './RosaIntro'

/**
 * Screen 6 of 8: "Do you work with any of these?" — vineyards, orchards,
 * arable fields, hospitality.
 *
 * Sits straight after "where you make it", because it is the same question
 * one step further out: do you grow or serve any of it yourself? Most drinks
 * businesses answer none, which is why the modules are not in the platform's
 * static room registry at all — an org that grows nothing never sees the
 * words again after this screen.
 *
 * Two things are deliberately kept apart. This screen records what the
 * business DOES (organizations.works_with); the Canopy tier is what OPENS
 * the module. So the cards say so plainly, which is the point: a grower on
 * Seed leaves this screen knowing exactly what Canopy buys them, and the
 * declared room shows up in their workbench wearing a CANOPY chip rather
 * than staying invisible.
 *
 * Multi-select, skippable, and changeable later in Settings > Organisation.
 */

const MODULE_ICON: Record<WorksWithModule, typeof Grape> = {
  viticulture: Grape,
  orchards: TreeDeciduous,
  arable_fields: Wheat,
  hospitality: UtensilsCrossed,
}

const MODULE_HINT: Record<WorksWithModule, string> = {
  viticulture: 'You grow your own grapes.',
  orchards: 'You grow your own fruit.',
  arable_fields: 'You grow your own barley, wheat or other grain.',
  hospitality: 'You run a restaurant, bar, tasting room or rooms.',
}

export function ArrivalModulesStep() {
  const { completeStep, skipStep, updatePersonalization, state } = useOnboarding()
  const { currentOrganization, refreshOrganizations } = useOrganization()

  // Prefer what the org already has (a user stepping back, or an org seeded
  // from the retired beta flags); fall back to this session's answer.
  const initial = useMemo(() => {
    const saved = parseWorksWith(currentOrganization?.works_with)
    if (saved.length > 0) return saved
    return state.personalization?.worksWith ?? []
    // Deliberately computed once: this is the initial value of an editable
    // selection, not a value that should track the org mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selected, setSelected] = useState<WorksWithModule[]>(initial)
  const [saving, setSaving] = useState(false)

  const toggle = (key: WorksWithModule) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  /** Save the answer, then advance. A failed write never blocks the ritual:
   *  the choice is already in onboarding_state, and Settings can fix it. */
  const save = async () => {
    if (saving) return
    setSaving(true)
    updatePersonalization({ worksWith: selected })

    try {
      const res = await fetch('/api/organization/works-with', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization?.id, worksWith: selected }),
      })
      // The rooms read works_with off the org in context, so refresh it here
      // or the workbench would not carry the new modules until a reload.
      if (res.ok) await refreshOrganizations()
    } catch (err) {
      console.warn('[arrival-modules] failed to save works_with:', err)
    }

    completeStep()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <RosaIntro message="Most drinks businesses skip this one. It only matters if you grow or serve some of it yourself." />

        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">
            What you work with
          </Eyebrow>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Do you do any of these yourself?
          </h2>
          <p className="text-xs text-muted-foreground">Choose as many as apply, or none.</p>
        </div>

        <div className="space-y-2">
          {WORKS_WITH_MODULES.map((key) => {
            const Icon = MODULE_ICON[key]
            const isOn = selected.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                disabled={saving}
                aria-pressed={isOn}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream p-4 text-left transition-colors',
                  'hover:border-studio-ink/25 hover:bg-secondary',
                  isOn && 'border-studio-forest bg-secondary',
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    isOn ? 'text-studio-forest' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-foreground">
                      {MODULE_LABEL[key]}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Canopy
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {MODULE_HINT[key]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          These live on the Canopy plan. Tell us now either way and we will put them in your
          workbench, ready for when you are.
        </p>

        <div className="flex flex-col items-center gap-3">
          <PillButton onClick={save} disabled={saving}>
            {saving ? 'Saving' : selected.length > 0 ? 'That is us' : 'None of these'}
            <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
          </PillButton>
          <button
            type="button"
            onClick={skipStep}
            disabled={saving}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground"
          >
            Skip this
          </button>
        </div>
      </div>
    </div>
  )
}
