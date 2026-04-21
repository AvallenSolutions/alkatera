'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Link2, Link2Off, CheckCircle2, ExternalLink, Download } from 'lucide-react'

interface BrewwLinkBadgeProps {
  productId: string | number
  onChanged?: () => void
  // Optional: triggers the recipe import dialog on the recipe page.
  onOpenRecipeImport?: () => void
}

interface LinkInfo {
  skuName: string
  skuExternalId: string
  lastSyncAt: string | null
}

// Small chip shown in the product header when the product is linked to a
// Breww SKU. Click expands a popover with sync status and quick actions.
export function BrewwLinkBadge({ productId, onChanged, onOpenRecipeImport }: BrewwLinkBadgeProps) {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const { data: link } = await supabase
        .from('breww_product_links')
        .select('breww_sku_external_id')
        .eq('organization_id', orgId)
        .eq('alkatera_product_id', Number(productId))
        .maybeSingle()
      if (cancelled) return
      if (!link) {
        setInfo(null)
        setLoading(false)
        return
      }
      const [{ data: sku }, { data: conn }] = await Promise.all([
        supabase
          .from('breww_skus')
          .select('name')
          .eq('organization_id', orgId)
          .eq('external_id', link.breww_sku_external_id)
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
        skuName: sku?.name || link.breww_sku_external_id,
        skuExternalId: link.breww_sku_external_id,
        lastSyncAt: conn?.last_sync_at || null,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, productId])

  const handleUnlink = async () => {
    if (!orgId || !info) return
    try {
      const res = await fetch(
        `/api/integrations/breww/link-product?organizationId=${orgId}&brewwSkuExternalId=${encodeURIComponent(info.skuExternalId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Unlink failed')
      toast.success('Unlinked from Breww')
      setConfirmUnlink(false)
      setInfo(null)
      onChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Unlink failed')
    }
  }

  if (loading || !info) return null

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ccff00]/40 bg-[#ccff00]/10 px-2.5 py-1 text-xs font-medium text-[#8da300] dark:text-[#ccff00] hover:bg-[#ccff00]/20 transition-colors"
            title="Linked to Breww"
          >
            <Link2 className="h-3 w-3" />
            Breww
            <span className="text-[10px] text-[#8da300]/70 dark:text-[#ccff00]/70 font-normal truncate max-w-[140px]">
              {info.skuName}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Linked to Breww SKU
            </div>
            <div className="font-medium text-sm">{info.skuName}</div>
            {info.lastSyncAt && (
              <div className="text-[11px] text-muted-foreground">
                Last synced {new Date(info.lastSyncAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="p-2 space-y-0.5">
            {onOpenRecipeImport && (
              <button
                type="button"
                onClick={() => onOpenRecipeImport()}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                Import latest recipe
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/settings/integrations/breww')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              View in integrations
            </button>
            <button
              type="button"
              onClick={() => setConfirmUnlink(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left text-red-600"
            >
              <Link2Off className="h-3.5 w-3.5" />
              Unlink from Breww
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink from Breww?</AlertDialogTitle>
            <AlertDialogDescription>
              Data already imported (recipe, packaging, production) stays on this product. Future Breww syncs won&apos;t update this product until you link it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleUnlink() }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
