'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Building2,
  Package,
  ClipboardList,
  CheckCircle2,
  Trophy,
} from 'lucide-react'
import { StateChip } from '@/components/studio'

export function SupplierAllSet() {
  const { completeOnboarding, state } = useSupplierOnboarding()
  const router = useRouter()

  const achievements = [
    'Learnt how the platform works',
  ]

  if (state.completedSteps.includes('supplier-company-identity') || state.profileCompleted) {
    achievements.push('Set up your company identity')
  }

  if (state.completedSteps.includes('supplier-company-details')) {
    achievements.push('Added your company details')
  }

  achievements.push('Understood data requests and evidence')

  const quickActions = [
    { label: 'View your Dashboard', icon: LayoutDashboard, href: '/supplier-portal' },
    { label: 'Edit your Profile', icon: Building2, href: '/supplier-portal/profile' },
    { label: 'Add a Product', icon: Package, href: '/supplier-portal/products' },
    { label: 'Check Requests', icon: ClipboardList, href: '/supplier-portal/requests' },
  ]

  const handleGoToDashboard = async () => {
    await completeOnboarding()
    router.push('/supplier-portal')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            You&apos;re all set.
          </h2>
          <p className="text-lg text-muted-foreground">
            Welcome to the alka<span className="font-bold">tera</span> supplier community.
          </p>
        </div>

        {/* Achievement badge */}
        <div className="mx-auto w-20 h-20 rounded-[6px] bg-card border border-border flex items-center justify-center">
          <Trophy className="w-10 h-10 text-studio-forest" />
        </div>
        <StateChip tone="good">Sustainability Partner</StateChip>

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
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-full w-full"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
