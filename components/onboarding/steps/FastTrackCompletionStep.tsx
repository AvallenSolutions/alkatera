'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/onboarding'
import type { AnnualProductionBucket } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Zap, BarChart3, Package, Users, ArrowRight } from 'lucide-react'
import { getBenchmarkForCategory } from '@/lib/industry-benchmarks'
import { cn } from '@/lib/utils'

const BEVERAGE_TO_CATEGORY: Record<string, string> = {
  beer: 'Lager',
  cider: 'Cider',
  spirits: 'Gin',
  wine: 'Red Wine',
  rtd: 'Hard Seltzer',
  non_alcoholic: 'Still Soft Drink',
  other: 'Lager',
}

const VOLUME_MIDPOINTS: Record<AnnualProductionBucket, number> = {
  '<10k': 5000,
  '10k-100k': 50000,
  '100k-1M': 500000,
  '1M+': 2000000,
}

const IMPROVEMENT_CARDS = [
  {
    icon: BarChart3,
    title: 'Add your utility data',
    description: 'Log electricity, gas, and fuel to get precise Scope 1 and 2 emissions.',
    cta: 'Go to Data Hub',
    href: '/data-hub',
    impact: 'Improves accuracy by ~25%',
  },
  {
    icon: Package,
    title: 'Complete your product recipes',
    description: 'Add ingredients and packaging materials for accurate Scope 3 calculations.',
    cta: 'Go to Products',
    href: '/products',
    impact: 'Improves accuracy by ~50%',
  },
  {
    icon: Users,
    title: 'Invite your team',
    description: 'More people contributing data means a more complete and accurate picture.',
    cta: 'Go to Team',
    href: '/settings/team',
    impact: 'Fills gaps faster',
  },
]

export function FastTrackCompletionStep() {
  const { completeOnboarding, state } = useOnboarding()
  const router = useRouter()
  const [launching, setLaunching] = useState<string | null>(null)

  const beverageType = state.personalization?.beverageTypes?.[0] ?? null
  const volumeBucket = state.personalization?.annualProductionBucket ?? '<10k'
  const litres = VOLUME_MIDPOINTS[volumeBucket as AnnualProductionBucket]
  const category = beverageType ? BEVERAGE_TO_CATEGORY[beverageType] ?? null : null
  const benchmark = getBenchmarkForCategory(category)
  const estimateTonnes = Math.round((benchmark.kgCO2ePerLitre * litres) / 1000)

  const handleNavigate = async (href: string, label: string) => {
    if (launching) return
    setLaunching(label)
    // Brief moment so the user sees the confirmation before the wizard closes
    await new Promise(r => setTimeout(r, 600))
    // Navigate and complete in parallel — the wizard closes naturally after navigation
    completeOnboarding()
    router.push(href)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-700">
      <div className="w-full max-w-md space-y-6">
        {/* Success header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-[#ccff00]/20 border border-[#ccff00]/30 flex items-center justify-center animate-in zoom-in duration-500">
            <Zap className="w-10 h-10 text-[#ccff00]" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-white">
            You&apos;re ready to go
          </h3>
          <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-xl px-5 py-3 inline-block">
            <p className="text-sm text-white/60">Estimated footprint</p>
            <p className="text-3xl font-bold text-[#ccff00]">
              ~{estimateTonnes > 0 ? estimateTonnes.toLocaleString() : '<1'} t CO&#8322;e/yr
            </p>
          </div>
          <p className="text-sm text-white/50 max-w-xs mx-auto">
            Here are 3 ways to sharpen this number and unlock your full sustainability picture.
          </p>
        </div>

        {/* Improvement cards */}
        <div className="space-y-2">
          {IMPROVEMENT_CARDS.map((card, i) => {
            const isLaunching = launching === card.cta
            return (
              <button
                key={card.href}
                onClick={() => handleNavigate(card.href, card.cta)}
                disabled={!!launching}
                className={cn(
                  'w-full flex items-center gap-4 p-4 border rounded-xl text-left transition-all group',
                  isLaunching
                    ? 'bg-[#ccff00]/10 border-[#ccff00]/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                )}
              >
                <div className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  isLaunching ? 'bg-[#ccff00]/20' : 'bg-white/10'
                )}>
                  <card.icon className={cn('w-5 h-5 transition-colors', isLaunching ? 'text-[#ccff00]' : 'text-white/60')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-semibold transition-colors', isLaunching ? 'text-[#ccff00]' : 'text-white')}>{card.title}</p>
                    <span className="text-xs bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full shrink-0">
                      #{i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{card.description}</p>
                  <p className={cn('text-xs mt-1 transition-colors', isLaunching ? 'text-[#ccff00]/80' : 'text-[#ccff00]/60')}>{card.impact}</p>
                </div>
                <ArrowRight className={cn('w-4 h-4 transition-colors shrink-0', isLaunching ? 'text-[#ccff00]/60' : 'text-white/20 group-hover:text-white/60')} />
              </button>
            )
          })}
        </div>

        {/* Primary CTA */}
        <Button
          onClick={() => handleNavigate('/dashboard', 'Go to Dashboard')}
          disabled={!!launching}
          size="lg"
          className="w-full bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base rounded-xl"
        >
          {launching === 'Go to Dashboard' ? 'Loading...' : 'Go to Dashboard'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        <p className="text-xs text-white/30 text-center">
          Your estimate is saved. You can improve it any time from your dashboard.
        </p>
      </div>
    </div>
  )
}
