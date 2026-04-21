'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'

// Inline progress panel shown during onboarding when the org has already
// connected Breww. Nudges users to complete the high-value linking steps
// before moving on, deep-linking to the relevant tab.
export function BrewwQuickWin() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [state, setState] = useState<{
    connected: boolean
    linkedProducts: number
    totalSkus: number
    linkedSites: number
    totalSites: number
  } | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const [{ data: conn }, { data: skus }, { data: productLinks }, { data: sites }, { data: siteLinks }] = await Promise.all([
        supabase
          .from('integration_connections')
          .select('status')
          .eq('organization_id', orgId)
          .eq('provider_slug', 'breww')
          .maybeSingle(),
        supabase.from('breww_skus').select('external_id, obsolete').eq('organization_id', orgId),
        supabase.from('breww_product_links').select('id').eq('organization_id', orgId),
        supabase.from('breww_sites').select('external_id').eq('organization_id', orgId),
        supabase.from('breww_facility_links').select('id').eq('organization_id', orgId),
      ])
      if (cancelled) return
      const visibleSkus = (skus ?? []).filter((s) => !s.obsolete)
      setState({
        connected: conn?.status === 'active',
        totalSkus: visibleSkus.length,
        linkedProducts: productLinks?.length ?? 0,
        totalSites: sites?.length ?? 0,
        linkedSites: siteLinks?.length ?? 0,
      })
    })()
    return () => { cancelled = true }
  }, [orgId])

  if (!state || !state.connected) return null

  const item = (done: boolean, label: string, cta: string | null, onClick?: () => void) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-white/30 flex-shrink-0" />
        )}
        <span className={done ? 'text-white/70' : 'text-white'}>{label}</span>
      </div>
      {cta && onClick && !done && (
        <Button
          size="sm"
          variant="outline"
          onClick={onClick}
          className="h-7 text-xs gap-1 bg-white/5 border-[#ccff00]/40 hover:bg-[#ccff00]/10 text-white"
        >
          {cta}
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="bg-[#ccff00]/5 backdrop-blur-md border border-[#ccff00]/30 rounded-xl p-4 space-y-3">
      <p className="text-[11px] font-semibold tracking-widest text-[#ccff00] uppercase">
        Breww · quick wins
      </p>
      <div className="space-y-2">
        {item(true, 'Connected to Breww', null)}
        {item(
          state.linkedProducts > 0,
          state.linkedProducts > 0
            ? `Linked ${state.linkedProducts} of ${state.totalSkus} products`
            : `Link your products (${state.totalSkus} waiting)`,
          'Link now',
          () => router.push('/settings/integrations/breww?tab=products'),
        )}
        {item(
          state.linkedSites > 0,
          state.linkedSites > 0
            ? `Linked ${state.linkedSites} of ${state.totalSites} facilities`
            : `Link your facility (${state.totalSites} waiting)`,
          'Link now',
          () => router.push('/settings/integrations/breww?tab=sites'),
        )}
      </div>
    </div>
  )
}
