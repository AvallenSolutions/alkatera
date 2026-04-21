'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, SkipForward, Link2, Zap, Clock, FastForward } from 'lucide-react'
import { INTEGRATIONS, CATEGORY_LABEL, CATEGORY_ORDER, type IntegrationCategory, type IntegrationProvider } from '@/lib/integrations/directory'
import { useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { toast } from 'sonner'
import { BrewwQuickWin } from '@/components/onboarding/BrewwQuickWin'

// Onboarding step — "Connect your tools".
//
// Shows the full directory as a compact grid. Available providers (Xero, Breww
// in beta) have a Connect CTA that links to the real flow in settings; the
// rest log a "Request access" signal. Skip + Continue are always one tap.

export function ConnectToolsStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const [requestedSlugs, setRequestedSlugs] = useState<Set<string>>(new Set())

  const byCat: Record<IntegrationCategory, IntegrationProvider[]> = {
    accounting: [], brewery_management: [], winery_management: [], inventory: [], hr: [], expenses: [], utilities: [],
  }
  for (const p of INTEGRATIONS) byCat[p.category].push(p)

  const handleRequest = async (slug: string) => {
    if (!currentOrganization?.id || requestedSlugs.has(slug)) return
    try {
      const res = await fetch('/api/integrations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization.id, providerSlug: slug }),
      })
      if (!res.ok) throw new Error('Could not log request')
      setRequestedSlugs((prev) => new Set(prev).add(slug))
      toast.success('Noted — we prioritise by demand.')
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl space-y-5">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-bold text-white">Connect your existing tools</h3>
          <p className="text-sm text-white/60">
            Pull data straight from the platforms you already use — and skip up to 8 steps of manual entry.
          </p>
        </div>

        <div className="bg-[#ccff00]/5 backdrop-blur-md border border-[#ccff00]/20 rounded-xl p-3 flex items-center gap-3">
          <FastForward className="h-5 w-5 text-[#ccff00] flex-shrink-0" />
          <p className="text-xs text-white/80">
            <span className="font-medium text-white">80% of your data already exists elsewhere.</span>{' '}
            Connect what you have and we&apos;ll populate the platform for you. Nothing gets pushed back to these tools.
          </p>
        </div>

        <BrewwQuickWin />

        <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-4">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {byCat[cat].map((p) => (
                  <div
                    key={p.slug}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col gap-2 min-h-[90px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-white truncate">{p.name}</p>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        p.status === 'available' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'
                      }`}>
                        {p.status === 'available' ? 'Live' : 'Soon'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 line-clamp-2 flex-1">{p.description}</p>
                    {p.status === 'available' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 bg-white/5 border-[#ccff00]/40 hover:bg-[#ccff00]/10 text-white"
                        onClick={completeStep}
                      >
                        <Link2 className="h-3 w-3" />
                        Go to Connect
                      </Button>
                    ) : requestedSlugs.has(p.slug) ? (
                      <span className="text-[11px] text-emerald-300">Requested ✓</span>
                    ) : (
                      <button
                        className="text-[11px] text-white/60 hover:text-white underline text-left"
                        onClick={() => handleRequest(p.slug)}
                      >
                        Request access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip for now
            </Button>
            <Button
              onClick={completeStep}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-white/30 text-center">
          You can connect tools any time from Settings → Integrations.
        </p>
      </div>
    </div>
  )
}
