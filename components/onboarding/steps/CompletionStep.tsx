'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Target,
  TrendingUp,
  Dog,
  CheckCircle2,
  Trophy,
} from 'lucide-react'

export function CompletionStep() {
  const { completeOnboarding, state } = useOnboarding()
  const router = useRouter()

  const achievements = [
    'Set up your company profile',
    'Personalised your experience',
  ]

  if (state.completedSteps.includes('first-product')) {
    achievements.push('Added your first product')
  }
  if (state.completedSteps.includes('facilities-setup')) {
    achievements.push('Tracked your facilities')
  }
  if (state.completedSteps.includes('core-metrics')) {
    achievements.push('Selected core sustainability metrics')
  }
  achievements.push('Unlocked advanced features')

  const handleGoToDashboard = async () => {
    await completeOnboarding()
    router.push('/dashboard?guide=1')
  }

  const quickActions = [
    { label: 'Explore your dashboard', icon: BarChart3, href: '/dashboard?guide=1' },
    { label: 'Set reduction targets', icon: Target, href: '/targets' },
    { label: 'Compare to industry', icon: TrendingUp, href: '/benchmarking' },
    { label: 'Ask Rosa a question', icon: Dog, href: '/rosa' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-display font-bold text-foreground">
            Setup complete.
          </h2>
          <p className="text-lg text-muted-foreground">
            You&apos;ve completed onboarding.
          </p>
        </div>

        {/* Achievement badge */}
        <div className="mx-auto w-20 h-20 rounded-[6px] border border-border bg-card flex items-center justify-center">
          <Trophy className="w-10 h-10 text-studio-forest" />
        </div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-forest">
          Achievement unlocked: Sustainability Champion
        </p>

        {/* What you accomplished */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-2 text-left">
          <p className="text-sm font-medium text-foreground mb-3">You&apos;ve successfully:</p>
          {achievements.map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-studio-good flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>

        {/* What's next */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">What&apos;s next?</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={async () => {
                  await completeOnboarding()
                  router.push(action.href)
                }}
                className="flex items-center gap-2 p-3 rounded-[6px] border border-border bg-card hover:bg-secondary hover:border-foreground/30 transition-all text-left"
              >
                <action.icon className="w-4 h-4 text-studio-forest flex-shrink-0" />
                <span className="text-xs text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleGoToDashboard}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-[6px] w-full"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
