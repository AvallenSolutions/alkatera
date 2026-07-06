'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Dog,
  BookOpen,
  Leaf,
  CheckCircle2,
  Trophy,
} from 'lucide-react'
import { Eyebrow, StateChip } from '@/components/studio'

export function MemberCompletionStep() {
  const { completeOnboarding } = useOnboarding()
  const router = useRouter()

  const achievements = [
    'Joined your team on alkatera',
    'Personalised your experience',
    'Explored your organisation profile',
    'Learned about the platform features',
  ]

  const handleGoToDashboard = async () => {
    await completeOnboarding()
    router.push('/dashboard?guide=1')
  }

  const quickActions = [
    { label: 'Explore dashboard', icon: BarChart3, href: '/dashboard?guide=1' },
    { label: 'View products', icon: Leaf, href: '/products' },
    { label: 'Ask Rosa a question', icon: Dog, href: '/rosa' },
    { label: 'Knowledge bank', icon: BookOpen, href: '/knowledge-bank' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <Eyebrow tone="inherit" className="text-studio-forest">All set</Eyebrow>
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            You&apos;re all set.
          </h2>
          <p className="text-lg text-muted-foreground">
            Welcome to the team
          </p>
        </div>

        {/* Achievement badge */}
        <div className="mx-auto w-20 h-20 rounded-[6px] bg-card border border-border flex items-center justify-center">
          <Trophy className="w-10 h-10 text-studio-forest" />
        </div>
        <StateChip tone="good">Achievement unlocked: team player</StateChip>

        {/* What you accomplished */}
        <div className="bg-card border border-border rounded-[6px] p-4 space-y-2 text-left">
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
                className="flex items-center gap-2 p-3 rounded-[6px] border border-border bg-card hover:bg-secondary hover:border-studio-ink/25 transition-colors text-left"
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
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-full w-full"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
