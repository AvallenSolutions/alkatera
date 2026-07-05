'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, Save, CheckCircle2, Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import { TargetSetter } from '@/components/transition-plan/TargetSetter'
import { MilestoneTimeline } from '@/components/transition-plan/MilestoneTimeline'
import { RisksOpportunitiesEditor } from '@/components/transition-plan/RisksOpportunitiesEditor'
import type { TransitionPlan, ReductionTarget, TransitionMilestone, RiskOpportunity } from '@/lib/transition-plan/types'

const STEPS = [
  { id: 'targets', label: 'Reduction Targets', description: 'Set your emission reduction goals per scope' },
  { id: 'milestones', label: 'Milestones', description: 'Define the key actions and timelines' },
  { id: 'risks', label: 'Risks & Opportunities', description: 'Review AI-generated climate risk assessment' },
]

interface OperationalEvent {
  id: string
  description: string
  event_date: string
}

function TransitionPlanSetupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useOrganization()

  const currentYear = new Date().getFullYear()
  const planYear = parseInt(searchParams.get('year') || String(currentYear), 10)

  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false)
  const [planId, setPlanId] = useState<string | null>(null)

  // Plan state
  const [baselineYear, setBaselineYear] = useState(planYear - 1)
  const [baselineEmissions, setBaselineEmissions] = useState<number | null>(null)
  const [targets, setTargets] = useState<ReductionTarget[]>([])
  const [milestones, setMilestones] = useState<TransitionMilestone[]>([])
  const [risks, setRisks] = useState<RiskOpportunity[]>([])
  const [sbtiAligned, setSbtiAligned] = useState(false)
  const [operationalEvents, setOperationalEvents] = useState<OperationalEvent[]>([])

  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = getSupabaseBrowserClient()

    // Load existing plan
    supabase
      .from('transition_plans')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .eq('plan_year', planYear)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const plan = data as TransitionPlan
          setPlanId(plan.id)
          setBaselineYear(plan.baseline_year)
          setBaselineEmissions(plan.baseline_emissions_tco2e)
          setTargets(plan.targets || [])
          setMilestones(plan.milestones || [])
          setRisks(plan.risks_and_opportunities || [])
          setSbtiAligned(plan.sbti_aligned)
        }
        setIsLoading(false)
      })

    // Load operational events for milestone linking
    supabase
      .from('operational_change_events')
      .select('id, description, event_date')
      .eq('organization_id', currentOrganization.id)
      .order('event_date', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setOperationalEvents(data as OperationalEvent[])
      })

    // Auto-fill baseline emissions from corporate_reports
    supabase
      .from('corporate_reports')
      .select('total_emissions')
      .eq('organization_id', currentOrganization.id)
      .eq('year', planYear - 1)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.total_emissions && !baselineEmissions) {
          setBaselineEmissions(data.total_emissions)
        }
      })
  }, [currentOrganization?.id, planYear])

  async function savePlan(opts: { generateRisks?: boolean } = {}) {
    if (!currentOrganization?.id) return
    setIsSaving(true)
    if (opts.generateRisks) setIsGeneratingRisks(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No session token')

      const res = await fetch('/api/transition-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId: currentOrganization.id,
          planYear,
          baselineYear,
          baselineEmissionsTco2e: baselineEmissions,
          targets,
          milestones,
          sbtiAligned,
          generateRisks: opts.generateRisks ?? false,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')

      const saved = json.plan as TransitionPlan
      setPlanId(saved.id)
      if (saved.risks_and_opportunities) {
        setRisks(saved.risks_and_opportunities)
      }
    } catch (err) {
      console.error('[TransitionPlanSetup] Save failed:', err)
    } finally {
      setIsSaving(false)
      setIsGeneratingRisks(false)
    }
  }

  async function saveRisks(updatedRisks: RiskOpportunity[]) {
    if (!planId) return
    setRisks(updatedRisks)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return

    await fetch('/api/transition-plan', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planId, risksAndOpportunities: updatedRisks }),
    })
  }

  async function regenerateRisks() {
    if (!planId || !currentOrganization?.id) return
    setIsGeneratingRisks(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) return

      const res = await fetch('/api/transition-plan', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          orgId: currentOrganization.id,
          planYear,
          regenerate: true,
        }),
      })

      const json = await res.json()
      if (json.plan?.risks_and_opportunities) {
        setRisks(json.plan.risks_and_opportunities)
      }
    } catch (err) {
      console.error('[TransitionPlanSetup] Regeneration failed:', err)
    } finally {
      setIsGeneratingRisks(false)
    }
  }

  async function handleNext() {
    // Save on each step transition
    await savePlan(step === STEPS.length - 2 ? { generateRisks: risks.length === 0 } : {})
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  async function handleFinish() {
    await savePlan()
    router.push('/reports/transition-plan')
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push('/reports/transition-plan')}
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-brick mb-2">
            THE EVIDENCE · TRANSITION PLAN
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The {planYear} transition plan.
          </h1>
          <p className="mt-2 font-mono text-[11px] text-studio-dim">
            {planId ? 'EDITING' : 'NEW PLAN'} · {planYear} PLAN YEAR
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 text-sm ${i === step ? 'text-stone-900 font-medium' : i < step ? 'text-stone-500 cursor-pointer hover:text-stone-700' : 'text-stone-300 cursor-default'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border ${
                i < step ? 'bg-studio-brick border-studio-brick text-studio-cream' :
                i === step ? 'bg-stone-900 border-stone-900 text-white' :
                'border-stone-200 text-stone-400'
              }`}>
                {i < step ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-stone-200" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step].label}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              {/* Baseline configuration */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5 block">
                    Baseline Year
                  </label>
                  <Input
                    type="number"
                    min={2000}
                    max={planYear - 1}
                    value={baselineYear}
                    onChange={e => setBaselineYear(parseInt(e.target.value) || baselineYear)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5 block">
                    Baseline Emissions (tCO2e)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Auto-filled from your data"
                    value={baselineEmissions ?? ''}
                    onChange={e => setBaselineEmissions(e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* SBTi alignment toggle */}
              <div className="flex items-start gap-3 pb-4 border-b border-stone-100">
                <input
                  type="checkbox"
                  id="sbti"
                  checked={sbtiAligned}
                  onChange={e => setSbtiAligned(e.target.checked)}
                  className="mt-0.5 accent-[#BF4B2A]"
                />
                <label htmlFor="sbti" className="cursor-pointer">
                  <span className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    SBTi aligned
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-brick">
                      Science Based Targets
                    </span>
                  </span>
                  <span className="text-xs text-stone-500 block mt-0.5">
                    Targets meet the SBTi Corporate Standard (minimum 50% absolute reduction per scope by 2030 for 1.5C alignment)
                  </span>
                </label>
              </div>

              <TargetSetter
                targets={targets}
                baselineEmissionsTco2e={baselineEmissions}
                onChange={setTargets}
              />
            </>
          )}

          {step === 1 && (
            <MilestoneTimeline
              milestones={milestones}
              operationalEvents={operationalEvents}
              onChange={setMilestones}
            />
          )}

          {step === 2 && (
            <>
              {risks.length === 0 && !isGeneratingRisks && (
                <div className="rounded-[6px] border border-border bg-card p-4 flex items-start gap-3 mb-4">
                  <Sparkles className="w-4 h-4 text-stone-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-stone-700">Generate your risk assessment</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Claude will analyse your emissions profile, targets, and milestones to identify 5-7 climate risks and opportunities. You can edit all suggestions before saving.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => savePlan({ generateRisks: true })}
                      disabled={isSaving}
                    >
                      <Sparkles className="w-3 h-3 mr-1.5" />
                      Generate Assessment
                    </Button>
                  </div>
                </div>
              )}
              <RisksOpportunitiesEditor
                items={risks}
                isGenerating={isGeneratingRisks}
                onChange={saveRisks}
                onRegenerate={regenerateRisks}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => Math.max(s - 1, 0))}
          disabled={step === 0 || isSaving}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Continue'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Finish'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function TransitionPlanSetupPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TransitionPlanSetupInner />
    </Suspense>
  )
}
