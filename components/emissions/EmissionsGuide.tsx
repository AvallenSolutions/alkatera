'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dog,
  Sparkles,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EMISSIONS_GUIDE_STEPS, type EmissionsGuideStep } from '@/lib/emissions-guide'
import { useOnboarding } from '@/lib/onboarding/OnboardingContext'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export interface EmissionsGuideProps {
  facilitiesCount: number
  scope1CO2e: number
  scope2CO2e: number
  scope3Cat1CO2e: number
  calculatedScope3OverheadsCO2e: number
  xeroScope3Kg: number
  hasReport: boolean
  onSwitchTab: (tab: string) => void
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
  onSwitchTab,
  onCalculate,
}: EmissionsGuideProps) {
  const router = useRouter()
  const { state, dismissEmissionsGuide, reopenEmissionsGuide } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const [expanded, setExpanded] = useState(true)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
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
  const progressPct = Math.round((completedCount / totalSteps) * 100)

  // Start collapsed if user has some progress already
  useEffect(() => {
    if (completedCount > 0 && completedCount < totalSteps) {
      setExpanded(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    dismissEmissionsGuide()
  }

  const handleReopen = () => {
    reopenEmissionsGuide()
  }

  const handleStepToggle = (stepId: string) => {
    if (expandedStep === stepId) {
      setExpandedStep(null)
    } else {
      setExpandedStep(stepId)
      // Mark educational steps as read
      if (stepId === 'understand-scopes') {
        setReadSteps(prev => new Set(Array.from(prev).concat(stepId)))
      }
    }
  }

  const handleAction = (step: EmissionsGuideStep) => {
    const { action } = step
    switch (action.type) {
      case 'link':
        router.push(action.href)
        break
      case 'tab':
        onSwitchTab(action.tab)
        break
      case 'callback':
        if (action.callbackKey === 'calculate') onCalculate()
        break
      case 'read':
        setReadSteps(prev => new Set(Array.from(prev).concat(step.id)))
        setExpandedStep(null)
        break
    }
  }

  // Collapsed dismiss state: show a minimal re-open button
  if (isDismissed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleReopen}
        className="mb-4"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Show Getting Started Guide
      </Button>
    )
  }

  return (
    <Card className="border-[#ccff00]/20 bg-card mb-6">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 text-left group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Dog className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Getting Started
                  {allComplete && (
                    <span className="text-xs text-emerald-500 font-normal">Complete!</span>
                  )}
                  <ChevronDown className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    !expanded && '-rotate-90'
                  )} />
                </h3>
                <p className="text-xs text-muted-foreground">
                  {completedCount} of {totalSteps} steps complete
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-3">
            <div className="w-24">
              <Progress value={progressPct} indicatorColor="lime" className="h-1.5" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-5">
            {allComplete ? (
              <div className="flex items-center gap-3 py-4 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">You&apos;ve mapped your full footprint</p>
                  <p className="text-xs text-muted-foreground">
                    Keep refining your data to improve accuracy. The data quality card below shows where to focus next.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {EMISSIONS_GUIDE_STEPS.map((step, index) => {
                  const isComplete = completionMap[step.id as keyof typeof completionMap]
                  const isOpen = expandedStep === step.id

                  return (
                    <div key={step.id}>
                      {/* Step row */}
                      <button
                        onClick={() => handleStepToggle(step.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          isOpen ? 'bg-muted' : 'hover:bg-muted/50',
                        )}
                      >
                        {/* Completion indicator */}
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-muted-foreground font-medium">{index + 1}</span>
                          </div>
                        )}

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            'text-sm font-medium',
                            isComplete && 'text-muted-foreground line-through'
                          )}>
                            {step.title}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                            {step.description}
                          </span>
                        </div>

                        {/* Icon */}
                        <step.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <ChevronRight className={cn(
                          'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                          isOpen && 'rotate-90'
                        )} />
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="ml-8 mr-3 mt-1 mb-2 pl-3 border-l-2 border-emerald-400/30">
                          <div className="flex items-start gap-2 mb-3">
                            <Dog className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {step.rosa}
                            </p>
                          </div>
                          {!isComplete && (
                            <Button
                              size="sm"
                              variant={step.action.type === 'read' ? 'outline' : 'default'}
                              onClick={() => handleAction(step)}
                            >
                              {step.action.label}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
