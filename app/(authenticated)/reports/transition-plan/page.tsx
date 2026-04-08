'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingDown,
  Target,
  MapPin,
  ShieldAlert,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import type { TransitionPlan } from '@/lib/transition-plan/types'
import { SCOPE_LABELS, SCOPE_COLOURS } from '@/lib/transition-plan/types'

export default function TransitionPlanPage() {
  const { currentOrganization } = useOrganization()
  const [plan, setPlan] = useState<TransitionPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = getSupabaseBrowserClient()
    supabase
      .from('transition_plans')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .eq('plan_year', currentYear)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data as TransitionPlan | null)
        setIsLoading(false)
      })
  }, [currentOrganization?.id, currentYear])

  if (isLoading) return <PageLoader />

  const hasTargets = (plan?.targets?.length ?? 0) > 0
  const hasMilestones = (plan?.milestones?.length ?? 0) > 0
  const hasRisks = (plan?.risks_and_opportunities?.length ?? 0) > 0
  const isStarted = hasTargets || hasMilestones
  const isComplete = hasTargets && hasMilestones && hasRisks

  const setupHref = `/reports/transition-plan/setup?year=${currentYear}`

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Transition Plan</h1>
        <p className="text-sm text-stone-500 mt-1">
          Define your decarbonisation pathway with reduction targets, milestones, and a climate risk assessment.
          Your transition plan feeds directly into generated sustainability reports and satisfies CSRD and SBTi requirements.
        </p>
      </div>

      {/* Status banner */}
      {isComplete ? (
        <div className="rounded-xl border border-lime-300 bg-lime-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-lime-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-lime-800">{currentYear} transition plan complete</p>
            <p className="text-xs text-lime-600 mt-0.5">
              {plan!.targets.length} target{plan!.targets.length !== 1 ? 's' : ''}, {plan!.milestones.length} milestone{plan!.milestones.length !== 1 ? 's' : ''}, {plan!.risks_and_opportunities!.length} risks and opportunities.
              {plan!.sbti_aligned && ' SBTi aligned.'}
            </p>
          </div>
          <Link href={setupHref}>
            <Button variant="outline" size="sm" className="border-lime-300 text-lime-700 hover:bg-lime-100">Edit</Button>
          </Link>
        </div>
      ) : isStarted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Plan in progress</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {!hasTargets && 'Add reduction targets. '}
              {!hasMilestones && 'Add milestones. '}
              {!hasRisks && 'Generate risks and opportunities to complete.'}
            </p>
          </div>
          <Link href={setupHref}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">Continue</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-700">No transition plan for {currentYear}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              A transition plan demonstrates to investors, regulators, and customers that your sustainability
              commitments are backed by a credible pathway. Takes around 15 minutes.
            </p>
          </div>
          <Link href={setupHref}>
            <Button size="sm">Create Plan</Button>
          </Link>
        </div>
      )}

      {/* Summary cards */}
      {isStarted && plan && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Targets</div>
              <div className="text-3xl font-bold text-stone-900">{plan.targets.length}</div>
              <div className="text-xs text-stone-400 mt-1">reduction targets</div>
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Milestones</div>
              <div className="text-3xl font-bold text-stone-900">{plan.milestones.length}</div>
              <div className="text-xs text-stone-400 mt-1">
                {plan.milestones.filter(m => m.status === 'complete').length} complete
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">
                <div className="flex items-center gap-1.5">
                  Risks &amp; Opps
                  {plan.sbti_aligned && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-[#ccff00] text-stone-800 border-0">SBTi</Badge>
                  )}
                </div>
              </div>
              <div className="text-3xl font-bold text-stone-900">{plan.risks_and_opportunities?.length ?? 0}</div>
              <div className="text-xs text-stone-400 mt-1">identified</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Targets summary */}
      {hasTargets && plan && (
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reduction Targets</CardTitle>
            <CardDescription>Emission reduction commitments vs. {plan.baseline_year} baseline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.targets.map(target => (
                <div key={target.id} className="flex items-center gap-4">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: SCOPE_COLOURS[target.scope] }}
                  />
                  <div className="flex-1 text-sm text-stone-700">{SCOPE_LABELS[target.scope]}</div>
                  <div className="text-sm font-semibold" style={{ color: SCOPE_COLOURS[target.scope] }}>
                    -{target.reductionPct}% by {target.targetYear}
                  </div>
                  {target.reductionPct >= 50 && (
                    <Badge variant="outline" className="text-xs border-[#ccff00] text-stone-600 bg-[#ccff00]/10">
                      SBTi
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Why transition planning matters */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Why transition planning matters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              icon: Target,
              title: 'Investor confidence',
              desc: 'Investors increasingly require a credible decarbonisation pathway, not just a net zero pledge. A transition plan demonstrates that targets are backed by specific actions.',
            },
            {
              icon: TrendingDown,
              title: 'CSRD requirement',
              desc: 'The Corporate Sustainability Reporting Directive requires a transition plan for climate disclosures. Without one, CSRD reports are incomplete.',
            },
            {
              icon: MapPin,
              title: 'Report integration',
              desc: 'When a plan exists, every generated sustainability report includes a Transition Roadmap section and a Risks and Opportunities analysis.',
            },
            {
              icon: ShieldAlert,
              title: 'Risk management',
              desc: 'Identifying physical and transition climate risks before they materialise allows you to take protective action and demonstrate governance accountability.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <Icon className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-stone-700">{title}</p>
                <p className="text-xs text-stone-500">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
