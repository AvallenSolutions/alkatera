'use client'

import { Eyebrow } from '@/components/studio/eyebrow'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { usePulseVerdict, VERDICT_TONE } from '@/components/pulse/usePulseVerdict'
import { useOverviewStats } from '@/components/pulse/useOverviewStats'
import { useAnnualEnvironmentalCost } from '@/components/pulse/financial/use-annual-cost'

/**
 * The day's numbers: the Today room's other two surfaces as doorway rows,
 * each with its number already read out. Most mornings these two lines are
 * all the checking the day needs; the rooms behind them are one click away
 * when a number looks wrong.
 *
 * Self-hiding: each row waits for real data, and the whole section stays
 * off the page until at least one row has something to say, so a new org
 * is never greeted by rows of zeros.
 */

/** "128" + "T CO2E", or "840" + "KG CO2E" below a tonne. */
function formatCo2e(kg: number): { value: string; unit: string } {
  if (kg >= 1000) {
    const t = kg / 1000
    return { value: t >= 10 ? Math.round(t).toLocaleString('en-GB') : t.toFixed(1), unit: 'T CO2E' }
  }
  return { value: Math.round(kg).toLocaleString('en-GB'), unit: 'KG CO2E' }
}

export function BriefNumbers() {
  const { loading, copy, verdict } = usePulseVerdict()
  const stats = useOverviewStats()
  const { totalGbp, figure } = useAnnualEnvironmentalCost()

  const items: FactRowItem[] = []

  // The pulse: the verdict word in its working tone, emissions standing
  // right. Waits until there is either a verdict on targets or an
  // emissions figure to stand behind it.
  const emissionsKg = stats?.emissionsKg ?? null
  const hasVerdict = verdict.state !== 'no_targets' && verdict.state !== 'insufficient_data'
  if (!loading && (hasVerdict || (emissionsKg !== null && emissionsKg > 0))) {
    const co2 = emissionsKg !== null && emissionsKg > 0 ? formatCo2e(emissionsKg) : null
    items.push({
      id: 'pulse',
      title: 'The pulse',
      hint: copy.sub,
      chip: { tone: VERDICT_TONE[verdict.state], label: copy.headline },
      value: co2?.value,
      unit: co2?.unit,
      href: '/pulse/',
    })
  }

  // The money: the trailing 12-month environmental cost.
  if (totalGbp !== null && totalGbp > 0 && figure) {
    items.push({
      id: 'money',
      title: 'The money',
      hint: 'What your impact costs, last 12 months',
      value: figure,
      href: '/pulse/financial/',
    })
  }

  if (items.length === 0) return null

  return (
    <section>
      <Eyebrow className="mb-3 text-room-accent">The day&apos;s numbers</Eyebrow>
      <FactList items={items} />
    </section>
  )
}
