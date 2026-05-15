'use client'

import { useMemo, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  Globe,
  Building2,
  FileSpreadsheet,
  Receipt,
  Beer,
  Banknote,
  ArrowRight,
  SkipForward,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebsiteImportFlow } from '@/components/products/WebsiteImportFlow'
import {
  getOnboardingHandlers,
  type OnboardingHandler,
  type OnboardingHandlerIcon,
  type OnboardingModalKey,
} from '@/lib/integrations/onboarding-handlers'

const ICON_MAP: Record<OnboardingHandlerIcon, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  building2: Building2,
  'file-spreadsheet': FileSpreadsheet,
  receipt: Receipt,
  beer: Beer,
  banknote: Banknote,
}

export function FastTrackImportStep() {
  const { completeStep, skipStep, state } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { user } = useAuth()

  const [openModal, setOpenModal] = useState<OnboardingModalKey | null>(null)
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [isStarting, setIsStarting] = useState<string | null>(null)

  const handlers = useMemo(() => {
    const all = getOnboardingHandlers()
    const beverageTypes = state.personalization?.beverageTypes
    return all.filter(h => !h.visibleFor || h.visibleFor({ beverageTypes }))
  }, [state.personalization?.beverageTypes])

  const websiteUrl = state.personalization?.websiteUrl ?? null

  const handleTileClick = async (handler: OnboardingHandler) => {
    if (!currentOrganization || !user) return
    setIsStarting(handler.slug)
    try {
      const action = await handler.onStart({ orgId: currentOrganization.id, userId: user.id })
      if (action.kind === 'oauth_redirect') {
        window.location.href = action.href
        return
      }
      if (action.kind === 'external_link') {
        window.open(action.href, '_blank', 'noopener,noreferrer')
        markCompleted(handler.slug)
        return
      }
      if (action.kind === 'modal') {
        setOpenModal(action.modalKey)
      }
    } finally {
      setIsStarting(null)
    }
  }

  const markCompleted = (slug: string) => {
    setCompletedSlugs(prev => {
      const next = new Set(prev)
      next.add(slug)
      return next
    })
    setOpenModal(null)
  }

  const hasCompletedAny = completedSlugs.size > 0

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-full px-2.5 py-0.5">
              <Sparkles className="w-3 h-3" />
              <span>Recommended</span>
            </div>
            <h3 className="text-2xl font-serif font-bold text-white">Bring your data with you</h3>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              Connect a system or upload what you have. Rosa will read it in the background while you finish setting up.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {handlers.map((handler) => {
              const Icon = ICON_MAP[handler.icon] ?? Globe
              const isCompleted = completedSlugs.has(handler.slug)
              const isWorking = isStarting === handler.slug
              const isUrlImportWithSite = handler.slug === 'website-url' && websiteUrl
              return (
                <button
                  key={handler.slug}
                  onClick={() => handleTileClick(handler)}
                  disabled={isCompleted || isWorking}
                  className={cn(
                    'group flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all',
                    handler.recommended
                      ? 'bg-[#ccff00]/8 border-[#ccff00]/40 hover:bg-[#ccff00]/12 hover:border-[#ccff00]/60'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                    isCompleted && 'opacity-70',
                    isWorking && 'opacity-50 cursor-wait',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        handler.recommended ? 'bg-[#ccff00]/20' : 'bg-white/10',
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5',
                          handler.recommended ? 'text-[#ccff00]' : 'text-white/80',
                        )}
                      />
                    </div>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-[#ccff00] mt-1" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors mt-1" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-white">
                      {isUrlImportWithSite ? `Import from ${websiteUrl.replace(/^https?:\/\//, '')}` : handler.label}
                    </p>
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
                      {handler.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={skipStep}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors"
            >
              <SkipForward className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/60">Skip for now</span>
            </button>
            <button
              onClick={completeStep}
              disabled={!hasCompletedAny}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-all',
                hasCompletedAny
                  ? 'bg-[#ccff00] text-black hover:bg-[#ccff00]/90'
                  : 'bg-white/5 text-white/30 cursor-not-allowed',
              )}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-center text-white/30">
            You can connect more systems later from Settings.
          </p>
        </div>
      </div>

      {currentOrganization && (
        <WebsiteImportFlow
          open={openModal === 'url_import'}
          onClose={() => setOpenModal(null)}
          organizationId={currentOrganization.id}
          onSuccess={() => markCompleted('website-url')}
          darkMode
          initialUrl={websiteUrl ?? undefined}
        />
      )}
    </>
  )
}
