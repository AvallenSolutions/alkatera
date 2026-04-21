'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { supabase } from '@/lib/supabaseClient'
import { Link2, CheckCircle2, ExternalLink } from 'lucide-react'

interface BrewwLinkBadgeProps {
  facilityId: string
}

interface LinkInfo {
  siteName: string
  lastSyncAt: string | null
}

// Small chip on the facility header when linked to a Breww site.
export function BrewwLinkBadge({ facilityId }: BrewwLinkBadgeProps) {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const { data: link } = await supabase
        .from('breww_facility_links')
        .select('breww_site_external_id')
        .eq('organization_id', orgId)
        .eq('alkatera_facility_id', facilityId)
        .maybeSingle()
      if (cancelled) return
      if (!link) {
        setInfo(null)
        setLoading(false)
        return
      }
      const [{ data: site }, { data: conn }] = await Promise.all([
        supabase
          .from('breww_sites')
          .select('name')
          .eq('organization_id', orgId)
          .eq('external_id', link.breww_site_external_id)
          .maybeSingle(),
        supabase
          .from('integration_connections')
          .select('last_sync_at')
          .eq('organization_id', orgId)
          .eq('provider_slug', 'breww')
          .maybeSingle(),
      ])
      if (cancelled) return
      setInfo({
        siteName: site?.name || link.breww_site_external_id,
        lastSyncAt: conn?.last_sync_at || null,
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [orgId, facilityId])

  if (loading || !info) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ccff00]/40 bg-[#ccff00]/10 px-2.5 py-1 text-xs font-medium text-[#8da300] dark:text-[#ccff00] hover:bg-[#ccff00]/20 transition-colors"
          title="Linked to Breww site"
        >
          <Link2 className="h-3 w-3" />
          Breww
          <span className="text-[10px] text-[#8da300]/70 dark:text-[#ccff00]/70 font-normal truncate max-w-[140px]">
            {info.siteName}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Linked to Breww site
          </div>
          <div className="font-medium text-sm">{info.siteName}</div>
          {info.lastSyncAt && (
            <div className="text-[11px] text-muted-foreground">
              Last synced {new Date(info.lastSyncAt).toLocaleString()}
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push('/settings/integrations/breww?tab=sites')}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#8da300] dark:text-[#ccff00] hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Manage in integrations
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
