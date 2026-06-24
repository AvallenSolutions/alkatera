'use client'

import { useEffect, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Pencil, Loader2 } from 'lucide-react'

type AccessLevel = 'read_only' | 'read_write'

const CAPABILITIES: Record<AccessLevel, string[]> = {
  read_write: [
    'View and edit sustainability data',
    'Create and manage LCA assessments',
    'Generate and publish reports',
    'View audit logs',
  ],
  read_only: [
    'View sustainability data and LCA assessments',
    'Generate reports',
    'Message the team with advice',
  ],
}

export function AdvisorCapabilitiesStep() {
  const { completeStep, previousStep } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { user } = useAuth()

  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const orgName = currentOrganization?.name || 'this organisation'

  useEffect(() => {
    let cancelled = false
    async function loadAccessLevel() {
      if (!currentOrganization?.id || !user?.id) {
        setIsLoading(false)
        return
      }
      const { data } = await supabase
        .from('advisor_organization_access')
        .select('access_level')
        .eq('organization_id', currentOrganization.id)
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (cancelled) return
      // Default to read_write to match the invite default if the lookup is empty.
      setAccessLevel((data?.access_level as AccessLevel) ?? 'read_write')
      setIsLoading(false)
    }
    loadAccessLevel()
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id, user?.id])

  const level: AccessLevel = accessLevel ?? 'read_write'
  const isReadOnly = level === 'read_only'
  const capabilities = CAPABILITIES[level]

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl">&#128274;</div>
          <h3 className="text-xl font-serif font-bold text-white">Your access</h3>
          <p className="text-sm text-white/50">
            What you can do inside {orgName}
          </p>
        </div>

        {/* Access level badge */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#ccff00]/5 border border-[#ccff00]/20">
          <div className="w-10 h-10 rounded-xl bg-[#ccff00]/10 flex items-center justify-center flex-shrink-0">
            {isReadOnly ? (
              <Eye className="w-5 h-5 text-[#ccff00]" />
            ) : (
              <Pencil className="w-5 h-5 text-[#ccff00]" />
            )}
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-mono">
              Access level
            </p>
            <p className="text-sm font-medium text-white">
              {isLoading ? (
                <span className="inline-flex items-center gap-2 text-white/50">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                </span>
              ) : isReadOnly ? (
                'Read-only advisor'
              ) : (
                'Read & write advisor'
              )}
            </p>
          </div>
        </div>

        {/* Capabilities list */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-3">
          <p className="text-sm font-medium text-white">You&apos;ll be able to:</p>
          {capabilities.map((item) => (
            <div key={item} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#ccff00] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-white/80">{item}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/30 text-center">
          You work directly in {orgName}&apos;s account. The organisation owner keeps
          control of billing, team members and overall settings.
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
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
    </div>
  )
}
