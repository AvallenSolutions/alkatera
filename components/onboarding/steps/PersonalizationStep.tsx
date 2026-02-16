'use client'

import { useState, useMemo } from 'react'
import { useOnboarding, type UserRole, type BeverageType, type CompanySize, type PrimaryGoal } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'sustainability_manager', label: 'Sustainability Manager' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'founder_executive', label: 'Founder / Executive' },
  { value: 'production_manager', label: 'Production Manager' },
  { value: 'consultant_advisor', label: 'Consultant / Advisor' },
  { value: 'other', label: 'Other' },
]

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: 'beer', label: 'Beer' },
  { value: 'spirits', label: 'Spirits (whiskey, vodka, gin, etc)' },
  { value: 'wine', label: 'Wine' },
  { value: 'cider', label: 'Cider' },
  { value: 'non_alcoholic', label: 'Non-alcoholic beverages' },
  { value: 'rtd', label: 'RTD (Ready-to-drink cocktails)' },
  { value: 'other', label: 'Other' },
]

const SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
]

const GOAL_OPTIONS: { value: PrimaryGoal; label: string }[] = [
  { value: 'track_emissions', label: 'Track carbon emissions' },
  { value: 'reduce_impact', label: 'Reduce environmental impact' },
  { value: 'sustainability_reporting', label: 'Prepare for sustainability reporting' },
  { value: 'get_certified', label: 'Get certified (B Corp, ISO 14001, etc)' },
  { value: 'supply_chain', label: 'Improve supply chain sustainability' },
  { value: 'understand_footprint', label: 'Understand my footprint' },
  { value: 'learning', label: 'Just learning about sustainability' },
]

/** All possible sub-step IDs */
type SubStepId = 'role' | 'beverage' | 'size' | 'goals'

/** Owner sees all 4 questions; member sees only role + goals */
const OWNER_SUB_STEPS: SubStepId[] = ['role', 'beverage', 'size', 'goals']
const MEMBER_SUB_STEPS: SubStepId[] = ['role', 'goals']

export function PersonalizationStep() {
  const { state, updatePersonalization, completeStep, previousStep, onboardingFlow } = useOnboarding()

  const subSteps = useMemo(
    () => (onboardingFlow === 'member' ? MEMBER_SUB_STEPS : OWNER_SUB_STEPS),
    [onboardingFlow]
  )
  const totalSubSteps = subSteps.length

  const [subStepIndex, setSubStepIndex] = useState(0)
  const currentSubStep = subSteps[subStepIndex]

  const [role, setRole] = useState<UserRole | undefined>(state.personalization.role)
  const [roleOther, setRoleOther] = useState(state.personalization.roleOther || '')
  const [beverageTypes, setBeverageTypes] = useState<BeverageType[]>(state.personalization.beverageTypes || [])
  const [beverageTypeOther, setBeverageTypeOther] = useState(state.personalization.beverageTypeOther || '')
  const [companySize, setCompanySize] = useState<CompanySize | undefined>(state.personalization.companySize)
  const [primaryGoals, setPrimaryGoals] = useState<PrimaryGoal[]>(state.personalization.primaryGoals || [])

  const toggleBeverage = (val: BeverageType) => {
    setBeverageTypes(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  const toggleGoal = (val: PrimaryGoal) => {
    setPrimaryGoals(prev => {
      if (prev.includes(val)) return prev.filter(v => v !== val)
      if (prev.length >= 2) return prev // Max 2
      return [...prev, val]
    })
  }

  const canProceed = () => {
    switch (currentSubStep) {
      case 'role': return !!role
      case 'beverage': return beverageTypes.length > 0
      case 'size': return !!companySize
      case 'goals': return primaryGoals.length > 0
      default: return false
    }
  }

  const handleNext = () => {
    if (subStepIndex < totalSubSteps - 1) {
      setSubStepIndex(s => s + 1)
    } else {
      // Save all personalization and move to next onboarding step
      updatePersonalization({
        role,
        roleOther,
        beverageTypes,
        beverageTypeOther,
        companySize,
        primaryGoals,
      })
      completeStep()
    }
  }

  const handleBack = () => {
    if (subStepIndex > 0) {
      setSubStepIndex(s => s - 1)
    } else {
      previousStep()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-sm text-white/60">
            Let&apos;s personalise your experience
          </p>
          <p className="text-xs text-white/40">
            ({totalSubSteps} quick questions) &mdash; {subStepIndex + 1}/{totalSubSteps}
          </p>
          {/* Sub-step progress dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {subSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === subStepIndex
                    ? 'bg-[#ccff00] w-6'
                    : i < subStepIndex
                    ? 'bg-[#ccff00]/50 w-2'
                    : 'bg-white/15 w-2'
                )}
              />
            ))}
          </div>
        </div>

        {/* Question: Role */}
        {currentSubStep === 'role' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-300 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-serif font-bold text-white text-center">
              What&apos;s your role?
            </h3>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border transition-all',
                    role === opt.value
                      ? 'border-[#ccff00] bg-[#ccff00]/10 text-white'
                      : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {role === 'other' && (
                <Input
                  placeholder="Please specify..."
                  value={roleOther}
                  onChange={e => setRoleOther(e.target.value)}
                  className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
                />
              )}
            </div>
            <p className="text-xs text-white/30 text-center">
              We&apos;ll prioritise the features and data most relevant to you.
            </p>
          </div>
        )}

        {/* Question: Beverage type (owner only) */}
        {currentSubStep === 'beverage' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-300 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-serif font-bold text-white text-center">
              What do you produce?
            </h3>
            <p className="text-sm text-white/50 text-center">
              Select all that apply:
            </p>
            <div className="space-y-2">
              {BEVERAGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleBeverage(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border transition-all',
                    beverageTypes.includes(opt.value)
                      ? 'border-[#ccff00] bg-[#ccff00]/10 text-white'
                      : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {beverageTypes.includes('other') && (
                <Input
                  placeholder="Please specify..."
                  value={beverageTypeOther}
                  onChange={e => setBeverageTypeOther(e.target.value)}
                  className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
                />
              )}
            </div>
            <p className="text-xs text-white/30 text-center">
              Helps us show relevant benchmarks.
            </p>
          </div>
        )}

        {/* Question: Company size (owner only) */}
        {currentSubStep === 'size' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-300 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-serif font-bold text-white text-center">
              Company size?
            </h3>
            <div className="space-y-2">
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCompanySize(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border transition-all',
                    companySize === opt.value
                      ? 'border-[#ccff00] bg-[#ccff00]/10 text-white'
                      : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 text-center">
              Determines data complexity.
            </p>
          </div>
        )}

        {/* Question: Primary goal */}
        {currentSubStep === 'goals' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-300 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-serif font-bold text-white text-center">
              Your primary goal?
            </h3>
            <p className="text-sm text-white/50 text-center">
              Select up to 2:
            </p>
            <div className="space-y-2">
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleGoal(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border transition-all',
                    primaryGoals.includes(opt.value)
                      ? 'border-[#ccff00] bg-[#ccff00]/10 text-white'
                      : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80',
                    primaryGoals.length >= 2 && !primaryGoals.includes(opt.value)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  )}
                  disabled={primaryGoals.length >= 2 && !primaryGoals.includes(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 text-center">
              We&apos;ll prioritise your key features.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={handleBack} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            {subStepIndex === totalSubSteps - 1 ? 'Continue' : 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
