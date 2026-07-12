'use client'

/**
 * Emissions -- getting set up.
 *
 * The old collapsible seven-step wizard card, restyled the studio way:
 * hairline fact rows under the statement (the PulseSetupChecklist
 * pattern). Steps still auto-complete from data presence, exactly as
 * before; the rows disappear once everything is done, and a previous
 * dismissal of the guide is still respected. No card, no icons, no dog.
 */

import { useState, useEffect, useMemo } from 'react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { EMISSIONS_GUIDE_STEPS } from '@/lib/emissions-guide'
import { useOnboarding } from '@/lib/onboarding/OnboardingContext'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

export interface EmissionsGuideProps {
  facilitiesCount: number
  scope1CO2e: number
  scope2CO2e: number
  scope3Cat1CO2e: number
  calculatedScope3OverheadsCO2e: number
  xeroScope3Kg: number
  hasReport: boolean
  onCalculate: () => void
}

export function EmissionsGuide({
  facilitiesCount,
  scope1CO2e,
  scope2CO2e,
  scope3Cat1CO2e,
  calculatedScope3OverheadsCO2e,
  xeroScope3Kg,
  hasReport,
  onCalculate,
}: EmissionsGuideProps) {
  const { state } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const [readSteps, setReadSteps] = useState<Set<string>>(new Set())
  const [hasSpendImports, setHasSpendImports] = useState(false)

  const isDismissed = state.emissionsGuideDismissed ?? false

  // Fetch spend import status
  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = getSupabaseBrowserClient()
    supabase
      .from('spend_import_batches')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrganization.id)
      .then(({ count }) => {
        if (count && count > 0) setHasSpendImports(true)
      })
  }, [currentOrganization?.id])

  // Auto-detect step completion from data
  const completionMap = useMemo(() => ({
    'understand-scopes': readSteps.has('understand-scopes'),
    'add-facilities': facilitiesCount > 0,
    'enter-utilities': scope1CO2e > 0 || scope2CO2e > 0,
    'map-products': scope3Cat1CO2e > 0,
    'log-scope3': calculatedScope3OverheadsCO2e > 0,
    'connect-accounts': xeroScope3Kg > 0 || hasSpendImports,
    'review-footprint': hasReport,
  }), [readSteps, facilitiesCount, scope1CO2e, scope2CO2e, scope3Cat1CO2e, calculatedScope3OverheadsCO2e, xeroScope3Kg, hasSpendImports, hasReport])

  const completedCount = Object.values(completionMap).filter(Boolean).length
  const totalSteps = EMISSIONS_GUIDE_STEPS.length
  const allComplete = completedCount === totalSteps

  if (isDismissed || allComplete) return null

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const items: FactRowItem[] = EMISSIONS_GUIDE_STEPS.map((step) => {
    const done = completionMap[step.id as keyof typeof completionMap]
    const base: FactRowItem = {
      id: step.id,
      title: step.title,
      hint: step.description,
      chip: done ? { tone: 'good' as const, label: 'Done' } : undefined,
      meta: done ? undefined : 'TO DO',
    }
    switch (step.action.type) {
      case 'link':
        return { ...base, href: step.action.href }
      case 'tab':
        // The tabs are gone: the Scope 3 work now lives further down this page.
        return { ...base, onClick: () => scrollTo('scope-3') }
      case 'callback':
        return { ...base, onClick: onCalculate }
      case 'read':
        return {
          ...base,
          onClick: () => {
            setReadSteps((prev) => new Set(Array.from(prev).concat(step.id)))
            scrollTo('method')
          },
        }
    }
  })

  return (
    <section>
      <Eyebrow tone="dim">Getting set up · {completedCount} of {totalSteps} done</Eyebrow>
      <p className="mt-1 text-xs text-muted-foreground">
        Work through these to build a complete footprint. Each step ticks itself off as your data
        arrives.
      </p>
      <FactList
        dense
        className="mt-2 border-t border-studio-hairline"
        items={items}
      />
    </section>
  )
}
