'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebsiteImportFlow } from '@/components/products/WebsiteImportFlow'
import { OnboardingUploadDialog } from './OnboardingUploadDialog'
import { BrewwImportDialog } from './BrewwImportDialog'
import { RosaIntro } from './RosaIntro'
import { trackOnboarding } from '@/lib/onboarding/telemetry'
import { toast } from 'sonner'
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
  const { completeStep, skipStep, state, updatePersonalization, onboardingFlow } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { user } = useAuth()

  const [openModal, setOpenModal] = useState<OnboardingModalKey | null>(null)
  // Hydrate from persisted state — covers the case where the user got
  // redirected somewhere mid-OAuth (e.g. popup blocked, or they closed the
  // popup and came back to the wizard). The popup happy-path re-marks via
  // postMessage instead, but this is the safety net.
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(
    () => new Set(state.personalization?.importedSources ?? []),
  )
  const [isStarting, setIsStarting] = useState<string | null>(null)
  const oauthPopupRef = useRef<Window | null>(null)
  // Map the lower-case provider slug from the popup message back to the tile
  // slug we mark as completed. Keeps the message contract simple while the
  // tile slug stays a directory key.
  const PROVIDER_TO_SLUG: Record<string, string> = { breww: 'breww', xero: 'xero' }
  // Open Breww's data-import picker once the OAuth popup closes successfully.
  // The tile only flips to "completed" after the import runs (or the user
  // explicitly skips), so the green tick reflects real synced data.
  const [showBrewwImport, setShowBrewwImport] = useState(false)

  const handlers = useMemo(() => {
    const all = getOnboardingHandlers()
    const beverageTypes = state.personalization?.beverageTypes
    return all.filter(h => !h.visibleFor || h.visibleFor({ beverageTypes }))
  }, [state.personalization?.beverageTypes])

  const websiteUrl = state.personalization?.websiteUrl ?? null

  // Persist completion to onboarding_state.personalization so the tick
  // survives an OAuth round-trip that unmounts this component. Uses the
  // functional setState form so concurrent calls (e.g. two popups completing
  // back-to-back) compose correctly instead of fighting stale closures.
  const persistCompleted = (slug: string) => {
    setCompletedSlugs(prev => {
      const next = new Set(prev)
      next.add(slug)
      updatePersonalization({ importedSources: Array.from(next) })
      return next
    })
  }

  const handleTileClick = async (handler: OnboardingHandler) => {
    if (!currentOrganization || !user) return
    setIsStarting(handler.slug)
    trackOnboarding({
      organizationId: currentOrganization.id,
      flow: onboardingFlow,
      step: 'fast-track-import',
      event: 'integration_started',
      meta: { slug: handler.slug, kind: handler.kind },
    })
    try {
      const action = await handler.onStart({ orgId: currentOrganization.id, userId: user.id })
      if (action.kind === 'popup') {
        // On mobile, popups are unreliable (Safari often blocks them or opens
        // them as a new tab anyway). Fall back to a full-page redirect with
        // the existing returnTo flow — the OAuth callback then lands the
        // user back on /dashboard where the wizard auto-pops at the saved
        // step. The persisted importedSources state means the green tick
        // survives the round-trip.
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        if (isMobile) {
          persistCompleted(handler.slug)
          // Rewrite the popup's returnTo to /dashboard so the user lands
          // back in the wizard rather than the bridge page (the bridge
          // page expects window.opener which won't exist on a top-level nav).
          const mobileHref = action.href.replace(
            /returnTo=[^&]+/,
            `returnTo=${encodeURIComponent('/dashboard')}`,
          )
          setTimeout(() => { window.location.href = mobileHref }, 350)
          return
        }
        // Desktop: keep the popup model so the wizard tab stays put.
        const w = 520
        const h = 720
        const left = window.screenX + (window.outerWidth - w) / 2
        const top = window.screenY + (window.outerHeight - h) / 2
        const popup = window.open(
          action.href,
          'alkatera-oauth',
          `width=${w},height=${h},left=${left},top=${top},popup=1`,
        )
        if (!popup) {
          toast.error('Popup was blocked. Please allow popups and try again.')
          return
        }
        oauthPopupRef.current = popup
        return
      }
      if (action.kind === 'oauth_redirect') {
        // Legacy path — kept for completeness but no current tile uses it.
        persistCompleted(handler.slug)
        setTimeout(() => { window.location.href = action.href }, 350)
        return
      }
      if (action.kind === 'external_link') {
        window.open(action.href, '_blank', 'noopener,noreferrer')
        persistCompleted(handler.slug)
        return
      }
      if (action.kind === 'modal') {
        setOpenModal(action.modalKey)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Couldn't start ${handler.label}`
      toast.error(message)
      trackOnboarding({
        organizationId: currentOrganization.id,
        flow: onboardingFlow,
        step: 'fast-track-import',
        event: 'integration_failed',
        meta: { slug: handler.slug, error: message },
      })
    } finally {
      setIsStarting(null)
    }
  }

  // Listen for the postMessage from /onboarding/oauth-complete so we can
  // mark the tile as completed without the wizard ever unmounting.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Same-origin only; the bridge page is served from our origin so any
      // cross-origin message is suspicious.
      if (event.origin !== window.location.origin) return
      const data = event.data as
        | { type?: string; provider?: string; status?: string; error?: string | null }
        | undefined
      if (!data || data.type !== 'alkatera-oauth') return
      const slug = data.provider ? PROVIDER_TO_SLUG[data.provider] : null
      if (!slug) return
      if (data.status === 'connected') {
        trackOnboarding({
          organizationId: currentOrganization?.id,
          flow: onboardingFlow,
          step: 'fast-track-import',
          event: 'integration_completed',
          meta: { slug, provider: data.provider },
        })
        if (data.provider === 'breww') {
          // Don't mark the tile complete yet — open the data-import picker
          // first so the user explicitly chooses what to bring across. The
          // tile flips on import success (or skip) inside the dialog.
          toast.success('Breww connected — choose what to import')
          setShowBrewwImport(true)
        } else {
          persistCompleted(slug)
          toast.success(`${data.provider} connected`)
        }
      } else {
        trackOnboarding({
          organizationId: currentOrganization?.id,
          flow: onboardingFlow,
          step: 'fast-track-import',
          event: 'integration_failed',
          meta: { slug, provider: data.provider, error: data.error },
        })
        toast.error(data.error || `${data.provider} connection failed`)
      }
      // Close the popup if it didn't already close itself (defensive).
      try { oauthPopupRef.current?.close() } catch { /* ignore */ }
      oauthPopupRef.current = null
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // persistCompleted uses functional setState so it doesn't need to be a
    // dep; bind once and forget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markCompleted = (slug: string) => {
    persistCompleted(slug)
    setOpenModal(null)
  }

  // Reverse a completion. For OAuth integrations this also calls the
  // provider's disconnect endpoint so the connection row is dropped — useful
  // when re-testing the flow or when the user wants to swap accounts. Staged
  // / synced data (products, SKU rows) is left in place; only the link to
  // the third-party account is removed, matching the Settings page behaviour.
  const handleReset = async (slug: string) => {
    if (!currentOrganization) return
    const label = handlers.find(h => h.slug === slug)?.label || slug
    if (!window.confirm(`Disconnect ${label}? You can reconnect any time.`)) return
    try {
      if (slug === 'breww') {
        await fetch(
          `/api/integrations/breww/disconnect?organizationId=${encodeURIComponent(currentOrganization.id)}`,
          { method: 'DELETE' },
        )
      } else if (slug === 'xero') {
        await fetch('/api/xero/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: currentOrganization.id }),
        })
      }
    } catch (err) {
      // Even if the API call fails, still clear local state so the user can
      // retry — the connection row will be reaped on next reconnect attempt.
      console.error('[onboarding] disconnect failed:', err)
    }
    setCompletedSlugs(prev => {
      const next = new Set(prev)
      next.delete(slug)
      updatePersonalization({ importedSources: Array.from(next) })
      return next
    })
    toast.success(`${label} disconnected`)
  }

  const hasCompletedAny = completedSlugs.size > 0

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
        <div className="w-full max-w-2xl space-y-6">
          <RosaIntro message="Anything you've already got in a system, I can read in the background. The more you bring in, the less you'll have to type." />
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
                <div
                  key={handler.slug}
                  role={isCompleted ? undefined : 'button'}
                  tabIndex={isCompleted || isWorking ? -1 : 0}
                  onClick={isCompleted || isWorking ? undefined : () => handleTileClick(handler)}
                  onKeyDown={isCompleted || isWorking ? undefined : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleTileClick(handler)
                    }
                  }}
                  className={cn(
                    'group relative flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]/60',
                    handler.recommended
                      ? 'bg-[#ccff00]/8 border-[#ccff00]/40'
                      : 'bg-white/5 border-white/10',
                    !isCompleted && !isWorking && (handler.recommended
                      ? 'hover:bg-[#ccff00]/12 hover:border-[#ccff00]/60 cursor-pointer'
                      : 'hover:bg-white/10 hover:border-white/20 cursor-pointer'),
                    isCompleted && 'opacity-90',
                    isWorking && 'opacity-50 cursor-wait',
                  )}
                >
                  {/* Disconnect / reset affordance — only on completed tiles.
                      Positioned absolutely so it doesn't fight the layout. */}
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleReset(handler.slug)
                      }}
                      aria-label={`Disconnect ${handler.label}`}
                      className="absolute top-2 right-2 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

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
                      <CheckCircle2 className="w-4 h-4 text-[#ccff00] mt-1 mr-6" />
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
                </div>
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

      {currentOrganization && user && (
        <>
          <WebsiteImportFlow
            open={openModal === 'url_import'}
            onClose={() => setOpenModal(null)}
            organizationId={currentOrganization.id}
            onSuccess={() => markCompleted('website-url')}
            darkMode
            initialUrl={websiteUrl ?? undefined}
          />
          <OnboardingUploadDialog
            open={openModal === 'csv_upload'}
            onClose={() => setOpenModal(null)}
            organizationId={currentOrganization.id}
            userId={user.id}
            kind="csv"
            onSuccess={() => markCompleted('csv-upload')}
          />
          <OnboardingUploadDialog
            open={openModal === 'utility_bill_upload'}
            onClose={() => setOpenModal(null)}
            organizationId={currentOrganization.id}
            userId={user.id}
            kind="utility_bill"
            onSuccess={() => markCompleted('utility-bill')}
          />
          <BrewwImportDialog
            open={showBrewwImport}
            onClose={() => {
              // Closing without importing still counts as "connected" for
              // the tile state — the OAuth half completed, the user just
              // deferred the data import. They can run it later from
              // Settings → Integrations.
              persistCompleted('breww')
              setShowBrewwImport(false)
            }}
            organizationId={currentOrganization.id}
            onSuccess={() => persistCompleted('breww')}
          />
        </>
      )}
    </>
  )
}
