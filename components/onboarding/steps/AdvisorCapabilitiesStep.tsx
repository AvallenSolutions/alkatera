'use client'

import { useEffect, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Pencil } from 'lucide-react'
import { Eyebrow, PillButton } from '@/components/studio'

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
          <Eyebrow tone="dim" className="justify-center flex">Access level</Eyebrow>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">Your access.</h3>
          <p className="text-sm text-muted-foreground">
            What you can do inside {orgName}
          </p>
        </div>

        {/* Access level panel */}
        <div className="flex items-center gap-3 p-4 rounded-[6px] bg-studio-cream border border-studio-hairline">
          <div className="w-10 h-10 rounded-[6px] bg-secondary flex items-center justify-center flex-shrink-0">
            {isReadOnly ? (
              <Eye className="w-5 h-5 text-studio-forest" />
            ) : (
              <Pencil className="w-5 h-5 text-studio-forest" />
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              Access level
            </p>
            <p className="text-sm font-medium text-foreground">
              {isLoading ? (
                <span className="text-muted-foreground">Checking&hellip;</span>
              ) : isReadOnly ? (
                'Read-only advisor'
              ) : (
                'Read & write advisor'
              )}
            </p>
          </div>
        </div>

        {/* Capabilities list */}
        <div className="bg-studio-cream border border-studio-hairline rounded-[6px] p-6 space-y-3">
          <p className="text-sm font-medium text-foreground">You&apos;ll be able to:</p>
          {capabilities.map((item) => (
            <div key={item} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-studio-good flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-studio-dim text-center">
          You work directly in {orgName}&apos;s account. The organisation owner keeps
          control of billing, team members and overall settings.
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <PillButton variant="ghost" size="md" onClick={previousStep}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </PillButton>
          <PillButton variant="ink" size="md" onClick={completeStep}>
            Continue
            <ArrowRight className="w-4 h-4" />
          </PillButton>
        </div>
      </div>
    </div>
  )
}
