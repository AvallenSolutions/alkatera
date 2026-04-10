'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Globe, ArrowRight, SkipForward } from 'lucide-react'
import { WebsiteImportFlow } from '@/components/products/WebsiteImportFlow'

export function FastTrackProductsStep() {
  const { completeStep, state } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const websiteUrl = state.personalization?.websiteUrl ?? null

  const [showImport, setShowImport] = useState(false)

  const handleImportSuccess = () => {
    setShowImport(false)
    setTimeout(() => completeStep(), 300)
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-serif font-bold text-white">Add your products</h3>
            <p className="text-sm text-white/50">
              We&apos;ll use your products to calculate a more accurate estimate.
            </p>
          </div>

          <div className="space-y-3">
            {/* Website import */}
            <button
              onClick={() => setShowImport(true)}
              className="w-full flex items-center gap-4 p-5 bg-[#ccff00]/10 border-2 border-[#ccff00]/40 hover:bg-[#ccff00]/20 hover:border-[#ccff00]/70 rounded-2xl text-left transition-all group"
            >
              <div className="h-12 w-12 rounded-xl bg-[#ccff00]/20 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-[#ccff00]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">
                    {websiteUrl ? `Import from ${websiteUrl.replace(/^https?:\/\//, '')}` : 'Import from your website'}
                  </p>
                  <span className="text-xs bg-[#ccff00]/20 text-[#ccff00] px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  {websiteUrl
                    ? 'We\'ll scan your site and find your products automatically.'
                    : 'Enter your URL and we\'ll find your products automatically.'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#ccff00]/50 group-hover:text-[#ccff00] transition-colors shrink-0" />
            </button>

            {/* Skip */}
            <button
              onClick={completeStep}
              className="w-full flex items-center gap-4 p-4 bg-white/3 border border-white/8 hover:bg-white/5 rounded-2xl text-left transition-all group"
            >
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <SkipForward className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white/60 text-sm">Skip for now</p>
                <p className="text-xs text-white/30 mt-0.5">
                  We&apos;ll use your drink type and volume to estimate your footprint.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {currentOrganization && (
        <WebsiteImportFlow
          open={showImport}
          onClose={() => setShowImport(false)}
          organizationId={currentOrganization.id}
          onSuccess={handleImportSuccess}
          darkMode
          initialUrl={websiteUrl ?? undefined}
        />
      )}
    </>
  )
}
