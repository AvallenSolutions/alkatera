'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Target,
  TrendingUp,
  Bot,
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

  const handleGoToDashboard = () => {
    completeOnboarding()
    router.push('/dashboard')
  }

  const quickActions = [
    { label: 'Explore your dashboard', icon: BarChart3, href: '/dashboard' },
    { label: 'Set reduction targets', icon: Target, href: '/targets' },
    { label: 'Compare to industry', icon: TrendingUp, href: '/benchmarking' },
    { label: 'Ask Rosa a question', icon: Bot, href: '/rosa' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <div className="text-4xl">&#127881; &#127942; &#127881;</div>
          <h2 className="text-3xl font-serif font-bold text-white">
            Congratulations!
          </h2>
          <p className="text-lg text-white/60">
            You&apos;ve Completed Onboarding!
          </p>
        </div>

        {/* Achievement badge */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ccff00]/30 to-emerald-400/30 backdrop-blur-md flex items-center justify-center border border-[#ccff00]/30">
          <Trophy className="w-10 h-10 text-[#ccff00]" />
        </div>
        <p className="text-sm font-medium text-[#ccff00]">
          Achievement Unlocked: &quot;Sustainability Champion&quot;
        </p>

        {/* What you accomplished */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-2 text-left">
          <p className="text-sm font-medium text-white mb-3">You&apos;ve successfully:</p>
          {achievements.map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#ccff00] flex-shrink-0" />
              <span className="text-sm text-white">{item}</span>
            </div>
          ))}
        </div>

        {/* What's next */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">What&apos;s next?</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => {
                  completeOnboarding()
                  router.push(action.href)
                }}
                className="flex items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left"
              >
                <action.icon className="w-4 h-4 text-[#ccff00] flex-shrink-0" />
                <span className="text-xs text-white">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleGoToDashboard}
          className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base px-8 rounded-xl w-full"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
