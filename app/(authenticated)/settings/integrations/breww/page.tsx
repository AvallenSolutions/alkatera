'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Package, Box, Beer, CheckCircle2, Link2, Link2Off, Plus, ExternalLink, Building2, FlaskConical,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { LinkPicker } from '@/components/settings/integrations/breww/LinkPicker'
import { SyncStatusStrip } from '@/components/settings/integrations/breww/SyncStatusStrip'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductionRun {
  id: string
  product_external_id: string
  product_name: string
  period_start: string
  period_end: string
  volume_hl: number
  batches_count: number
  synced_at: string
}

interface IngredientUsage {
  id: string
  product_external_id: string
  product_name: string
  ingredient_name: string
  total_quantity: number
  unit: string
  period_start: string
  period_end: string
  synced_at: string
}

interface PackagingRun {
  id: string
  external_id: string
  batch_external_id: string | null
  product_external_id: string | null
  product_name: string | null
  quantity_planned: number | null
  quantity_packaged: number | null
  volume_ml: number | null
  packaged_at: string | null
  synced_at: string
}

interface ContainerType {
  id: string
  external_id: string
  name: string
  volume_ml: number | null
  weight_g: number | null
  material_type: string | null
  synced_at: string
}

interface BrewwSku {
  id: string
  external_id: string
  name: string
  sku: string | null
  container_name: string | null
  liquid_volume_ml: number | null
  primary_drink_external_id: string | null
  primary_drink_name: string | null
  obsolete: boolean
}

interface ProductLink {
  id: string
  breww_sku_external_id: string
  alkatera_product_id: number
  linked_at: string
}

interface AlkateraProduct {
  id: number
  name: string
  sku: string | null
}

interface BrewwSite {
  id: string
  external_id: string
  name: string
}

interface FacilityLink {
  id: string
  breww_site_external_id: string
  alkatera_facility_id: string
  linked_at: string
}

interface AlkateraFacility {
  id: string
  name: string
}

interface IntegrationConnection {
  id: string
  status: 'active' | 'error' | 'disconnected'
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error' | null
  sync_error: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrewwDataPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [skus, setSkus] = useState<BrewwSku[]>([])
  const [links, setLinks] = useState<ProductLink[]>([])
  const [production, setProduction] = useState<ProductionRun[]>([])
  const [ingredients, setIngredients] = useState<IngredientUsage[]>([])
  const [containers, setContainers] = useState<ContainerType[]>([])
  const [packagingRuns, setPackagingRuns] = useState<PackagingRun[]>([])
  const [sites, setSites] = useState<BrewwSite[]>([])
  const [facilityLinks, setFacilityLinks] = useState<FacilityLink[]>([])
  const [facilities, setFacilities] = useState<AlkateraFacility[]>([])
  const [alkProducts, setAlkProducts] = useState<AlkateraProduct[]>([])
  const [connection, setConnection] = useState<IntegrationConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  const [linkSkuPicker, setLinkSkuPicker] = useState<BrewwSku | null>(null)
  const [linkSitePicker, setLinkSitePicker] = useState<BrewwSite | null>(null)
  const [createSkuTarget, setCreateSkuTarget] = useState<BrewwSku | null>(null)
  const [creatingSku, setCreatingSku] = useState(false)
  const [confirmUnlinkSku, setConfirmUnlinkSku] = useState<BrewwSku | null>(null)
  const [confirmUnlinkSite, setConfirmUnlinkSite] = useState<BrewwSite | null>(null)

  const initialTab = searchParams?.get('tab') || 'products'
  const [activeTab, setActiveTab] = useState(initialTab)

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [skuRes, linkRes, prodRes, ingRes, ctRes, pkgRes, siteRes, facLinkRes, prodsRes, facsRes, connRes] = await Promise.all([
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=skus`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=product_links`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=production`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=ingredients`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=containers`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=packaging_runs`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=sites`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=facility_links`),
        supabase.from('products').select('id, name, sku').eq('organization_id', orgId).order('name'),
        supabase.from('facilities').select('id, name').eq('organization_id', orgId).order('name'),
        supabase
          .from('integration_connections')
          .select('id, status, last_sync_at, sync_status, sync_error')
          .eq('organization_id', orgId)
          .eq('provider_slug', 'breww')
          .maybeSingle(),
      ])

      const [skuBody, linkBody, prodBody, ingBody, ctBody, pkgBody, siteBody, facLinkBody] = await Promise.all([
        skuRes.json(),
        linkRes.json(),
        prodRes.json(),
        ingRes.json(),
        ctRes.json(),
        pkgRes.json(),
        siteRes.json(),
        facLinkRes.json(),
      ])

      setSkus(skuBody.data ?? [])
      setLinks(linkBody.data ?? [])
      setProduction(prodBody.data ?? [])
      setIngredients(ingBody.data ?? [])
      setContainers(ctBody.data ?? [])
      setPackagingRuns(pkgBody.data ?? [])
      setSites(siteBody.data ?? [])
      setFacilityLinks(facLinkBody.data ?? [])
      setFacilities((facsRes.data ?? []) as AlkateraFacility[])
      setAlkProducts((prodsRes.data ?? []) as AlkateraProduct[])
      setConnection(connRes.data as IntegrationConnection | null)
    } catch (err) {
      console.error('[BrewwDataPage] fetch error:', err)
      toast.error('Could not load synced data')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const linksBySku = useMemo(() => {
    const map = new Map<string, ProductLink>()
    for (const link of links) map.set(link.breww_sku_external_id, link)
    return map
  }, [links])

  const productsById = useMemo(() => {
    const map = new Map<number, AlkateraProduct>()
    for (const p of alkProducts) map.set(Number(p.id), p)
    return map
  }, [alkProducts])

  const visibleSkus = useMemo(() => skus.filter((s) => !s.obsolete), [skus])
  const linkedSkuCount = useMemo(
    () => visibleSkus.filter((s) => linksBySku.has(s.external_id)).length,
    [visibleSkus, linksBySku],
  )
  const linkedSiteCount = facilityLinks.length

  // Monthly roll-ups merged into the Production tab.
  const monthlyBrewery = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const run of production) {
      if (!run.period_start) continue
      const month = run.period_start.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(run.volume_hl || 0))
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, hl]) => ({ month, hl }))
  }, [production])

  const monthlyBySku = useMemo(() => {
    const byKey = new Map<string, { productName: string; month: string; units: number; litres: number }>()
    for (const run of packagingRuns) {
      const qty = Number(run.quantity_packaged || 0)
      if (qty <= 0 || !run.packaged_at) continue
      const month = run.packaged_at.slice(0, 7)
      const today = new Date().toISOString().slice(0, 10)
      if (run.packaged_at > today) continue
      const name = run.product_name ?? run.product_external_id ?? '—'
      const key = `${name}||${month}`
      const prev = byKey.get(key) ?? { productName: name, month, units: 0, litres: 0 }
      prev.units += qty
      prev.litres += Number(run.volume_ml || 0) / 1000
      byKey.set(key, prev)
    }
    return Array.from(byKey.values()).sort(
      (a, b) => b.month.localeCompare(a.month) || a.productName.localeCompare(b.productName),
    )
  }, [packagingRuns])

  const skuTotals = useMemo(() => {
    const totals = new Map<string, { productName: string; units: number; litres: number; months: Set<string> }>()
    for (const row of monthlyBySku) {
      const prev = totals.get(row.productName) ?? { productName: row.productName, units: 0, litres: 0, months: new Set<string>() }
      prev.units += row.units
      prev.litres += row.litres
      prev.months.add(row.month)
      totals.set(row.productName, prev)
    }
    return Array.from(totals.values()).sort((a, b) => b.units - a.units)
  }, [monthlyBySku])

  const productionByProduct = useMemo(() => {
    return production.reduce<Record<string, { name: string; totalHl: number; months: number }>>(
      (acc, run) => {
        const key = run.product_external_id
        if (!acc[key]) acc[key] = { name: run.product_name, totalHl: 0, months: 0 }
        acc[key].totalHl += run.volume_hl
        acc[key].months += 1
        return acc
      },
      {},
    )
  }, [production])

  const [productionView, setProductionView] = useState<'totals' | 'byMonth' | 'bySku'>('totals')

  // ─── Action handlers ──────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!orgId) return
    setSyncing(true)
    try {
      const res = await fetch('/api/integrations/breww/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Sync failed')
      }
      const body = await res.json()
      const hl = body.totalHl?.toFixed?.(1) ?? '0'
      const s = body.skusUpserted ?? 0
      const ing = body.ingredientsUpserted ?? 0
      const ct = body.containerTypesUpserted ?? 0
      toast.success('Synced Breww data', {
        description: `${s} products · ${hl} hL · ${ing} ingredients · ${ct} packaging types`,
      })
      fetchData()
    } catch (err: any) {
      toast.error('Sync failed', { description: err.message || 'Please try again' })
    } finally {
      setSyncing(false)
    }
  }

  const handleRebuildPackaging = async () => {
    if (!orgId) return
    setRebuilding(true)
    try {
      const res = await fetch('/api/integrations/breww/rebuild-packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Rebuild failed')
      toast.success('Packaging rebuilt', {
        description: `${body.processed} product${body.processed === 1 ? '' : 's'} updated`,
      })
    } catch (err: any) {
      toast.error('Rebuild failed', { description: err.message || 'Please try again' })
    } finally {
      setRebuilding(false)
    }
  }

  const handleDisconnect = async () => {
    if (!orgId) return
    if (!window.confirm('Disconnect Breww? Your synced data and links stay intact.')) return
    try {
      const res = await fetch(`/api/integrations/breww/disconnect?organizationId=${orgId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Disconnect failed')
      toast.success('Breww disconnected')
      router.push('/settings?tab=integrations')
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed')
    }
  }

  const handleLinkSku = async (sku: BrewwSku, product: AlkateraProduct) => {
    if (!orgId) return
    const res = await fetch('/api/integrations/breww/link-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: orgId,
        brewwSkuExternalId: sku.external_id,
        alkateraProductId: product.id,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Link failed')
    }
    toast.success(`Linked ${sku.name} to ${product.name}`)
    fetchData()
  }

  const handleUnlinkSku = async (sku: BrewwSku) => {
    if (!orgId) return
    try {
      const res = await fetch(
        `/api/integrations/breww/link-product?organizationId=${orgId}&brewwSkuExternalId=${encodeURIComponent(sku.external_id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Unlink failed')
      toast.success(`Unlinked ${sku.name}`)
      setConfirmUnlinkSku(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Unlink failed')
    }
  }

  const handleCreateSku = async (sku: BrewwSku) => {
    if (!orgId) return
    setCreatingSku(true)
    try {
      const res = await fetch('/api/integrations/breww/create-product-from-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          brewwSkuExternalId: sku.external_id,
          productCategory: 'beer',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Create failed')
      }
      const body = await res.json()
      const parts: string[] = []
      if (body.ingredientsImported) parts.push(`${body.ingredientsImported} ingredient${body.ingredientsImported === 1 ? '' : 's'}`)
      if (body.packagingImported) parts.push(`${body.packagingImported} packaging row`)
      const extra = parts.length > 0 ? ` with ${parts.join(' and ')}` : ''
      toast.success(`Created "${sku.name}"${extra}`)
      setCreateSkuTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Create failed')
    } finally {
      setCreatingSku(false)
    }
  }

  const handleLinkSite = async (site: BrewwSite, facility: AlkateraFacility) => {
    if (!orgId) return
    const res = await fetch('/api/integrations/breww/facility-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: orgId,
        brewwSiteExternalId: site.external_id,
        alkateraFacilityId: facility.id,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Link failed')
    }
    toast.success(`Linked ${site.name} to ${facility.name}`)
    fetchData()
  }

  const handleUnlinkSite = async (site: BrewwSite) => {
    if (!orgId) return
    try {
      const res = await fetch(
        `/api/integrations/breww/facility-links?organizationId=${orgId}&brewwSiteExternalId=${encodeURIComponent(site.external_id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Unlink failed')
      toast.success(`Unlinked ${site.name}`)
      setConfirmUnlinkSite(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Unlink failed')
    }
  }

  const unlinkedSkus = visibleSkus.filter((s) => !linksBySku.has(s.external_id))
  const unlinkedSites = sites.filter(
    (s) => !facilityLinks.find((l) => l.breww_site_external_id === s.external_id),
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/settings?tab=integrations')}
          className="gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Integrations
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Breww synced data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Data pulled from your Breww account. Link each Breww SKU to an alka<strong>tera</strong> product so production, ingredients and packaging flow through automatically.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading synced data...</span>
        </div>
      ) : (
        <>
          {/* Sync status strip */}
          {connection && (
            <SyncStatusStrip
              status={connection.status}
              lastSyncAt={connection.last_sync_at}
              syncStatus={connection.sync_status}
              syncError={connection.sync_error}
              syncing={syncing || rebuilding}
              onSync={handleSync}
              onRebuildPackaging={handleRebuildPackaging}
              onDisconnect={handleDisconnect}
              counts={[
                {
                  label: 'SKUs linked',
                  current: linkedSkuCount,
                  total: visibleSkus.length,
                  onClick: visibleSkus.length > 0 ? () => setActiveTab('products') : undefined,
                },
                {
                  label: 'sites linked',
                  current: linkedSiteCount,
                  total: sites.length,
                  onClick: sites.length > 0 ? () => setActiveTab('sites') : undefined,
                },
                {
                  label: 'ingredients',
                  current: ingredients.length,
                  total: ingredients.length,
                  onClick: ingredients.length > 0 ? () => setActiveTab('reference') : undefined,
                },
              ]}
            />
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="products" className="gap-1.5">
                <Beer className="h-3.5 w-3.5" />
                Products
                {visibleSkus.length > 0 && (
                  <Badge variant={unlinkedSkus.length > 0 ? 'default' : 'secondary'} className="text-[10px] ml-1 px-1.5">
                    {unlinkedSkus.length > 0 ? `${unlinkedSkus.length}` : `${linkedSkuCount}/${visibleSkus.length}`}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sites" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Sites
                {sites.length > 0 && (
                  <Badge variant={unlinkedSites.length > 0 ? 'default' : 'secondary'} className="text-[10px] ml-1 px-1.5">
                    {unlinkedSites.length > 0 ? `${unlinkedSites.length}` : `${linkedSiteCount}/${sites.length}`}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="production" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Production
                {production.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
                    {Object.keys(productionByProduct).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reference" className="gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Reference
                {(ingredients.length > 0 || containers.length > 0) && (
                  <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
                    {ingredients.length + containers.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Products tab ─────────────────────────────────────────────── */}
            <TabsContent value="products" className="mt-4 space-y-3">
              {visibleSkus.length === 0 ? (
                <EmptyState
                  message="No Breww SKUs synced yet."
                  action={<Button size="sm" onClick={handleSync} disabled={syncing}>Run a sync</Button>}
                />
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Breww SKU</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Container</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Size</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleSkus.map((sku) => {
                          const link = linksBySku.get(sku.external_id)
                          const linkedProduct = link ? productsById.get(Number(link.alkatera_product_id)) : null
                          return (
                            <tr key={sku.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium">{sku.name}</div>
                                {sku.primary_drink_name && sku.primary_drink_name !== sku.name && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    Drink: {sku.primary_drink_name}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {sku.container_name ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-xs">
                                {sku.liquid_volume_ml ? `${Number(sku.liquid_volume_ml).toFixed(0)} ml` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {link ? (
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/products/${link.alkatera_product_id}`)}
                                      className="text-xs font-medium hover:underline text-left flex items-center gap-1"
                                    >
                                      {linkedProduct?.name ?? 'Linked product'}
                                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Not linked</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {link ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground hover:text-red-500 gap-1"
                                    onClick={() => setConfirmUnlinkSku(sku)}
                                  >
                                    <Link2Off className="h-3 w-3" />
                                    Unlink
                                  </Button>
                                ) : (
                                  <div className="flex gap-1.5 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => setLinkSkuPicker(sku)}
                                      disabled={alkProducts.length === 0}
                                    >
                                      <Link2 className="h-3 w-3" />
                                      Link
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => setCreateSkuTarget(sku)}
                                    >
                                      <Plus className="h-3 w-3" />
                                      Create
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Linking a SKU routes its production volumes, recipe ingredients and packaging specs to the selected alka<strong>tera</strong> product. You can still create a product from scratch and link it afterwards.
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── Sites tab ────────────────────────────────────────────────── */}
            <TabsContent value="sites" className="mt-4 space-y-3">
              {sites.length === 0 ? (
                <EmptyState
                  message="No Breww sites synced yet."
                  action={<Button size="sm" onClick={handleSync} disabled={syncing}>Run a sync</Button>}
                />
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Breww site</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                            alka<strong>tera</strong> facility
                          </th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sites.map((site) => {
                          const link = facilityLinks.find((l) => l.breww_site_external_id === site.external_id)
                          const linkedFacility = link ? facilities.find((f) => f.id === link.alkatera_facility_id) : null
                          return (
                            <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{site.name}</td>
                              <td className="px-4 py-3">
                                {link && linkedFacility ? (
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                    <span className="text-xs font-medium">{linkedFacility.name}</span>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Not linked</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {link ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground hover:text-red-500 gap-1"
                                    onClick={() => setConfirmUnlinkSite(site)}
                                  >
                                    <Link2Off className="h-3 w-3" />
                                    Unlink
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setLinkSitePicker(site)}
                                    disabled={facilities.length === 0}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    Link
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Each Breww site is a physical location where brewing or packaging happens. Link to an alka<strong>tera</strong> facility so brewing hL and packaged litres flow into the right facility&rsquo;s production history.
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── Production tab (merges old Production + Volumes) ─────────── */}
            <TabsContent value="production" className="mt-4 space-y-4">
              {Object.keys(productionByProduct).length === 0 && monthlyBrewery.length === 0 && skuTotals.length === 0 ? (
                <EmptyState
                  message="No production data synced yet."
                  action={<Button size="sm" onClick={handleSync} disabled={syncing}>Run a sync</Button>}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 rounded-lg border p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setProductionView('totals')}
                        className={`px-2.5 py-1 rounded ${productionView === 'totals' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        By product
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductionView('byMonth')}
                        className={`px-2.5 py-1 rounded ${productionView === 'byMonth' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        By month
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductionView('bySku')}
                        className={`px-2.5 py-1 rounded ${productionView === 'bySku' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        By SKU
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">12-month total</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {monthlyBrewery.reduce((s, r) => s + r.hl, 0).toFixed(1)} hL
                      </div>
                    </div>
                  </div>

                  {productionView === 'totals' && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total hL (12 months)</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Months of data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {Object.entries(productionByProduct).map(([id, row]) => (
                            <tr key={id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{row.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{row.totalHl.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{row.months}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {productionView === 'byMonth' && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Month</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Volume (hL)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {monthlyBrewery.length === 0 ? (
                            <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground text-xs">No monthly data yet</td></tr>
                          ) : monthlyBrewery.map((row) => (
                            <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 tabular-nums">{row.month}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.hl.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {productionView === 'bySku' && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">SKU</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Units packaged</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Litres</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Months</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {skuTotals.length === 0 ? (
                            <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">No packaged units yet. Planned-but-not-yet-packaged runs are excluded.</td></tr>
                          ) : skuTotals.map((row) => (
                            <tr key={row.productName} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium">{row.productName}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(row.units).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.litres.toFixed(0)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{row.months.size}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── Reference tab (read-only ingredients + containers) ───────── */}
            <TabsContent value="reference" className="mt-4 space-y-6">
              {ingredients.length === 0 && containers.length === 0 ? (
                <EmptyState
                  message="No reference data synced yet."
                  action={<Button size="sm" onClick={handleSync} disabled={syncing}>Run a sync</Button>}
                />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    These are the ingredients and containers Breww knows about. They flow into your products automatically when you link a SKU or import a recipe, so you don&apos;t usually need to act here directly.
                  </p>

                  {ingredients.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-medium">Ingredients</h2>
                        <Badge variant="secondary" className="text-[10px]">{ingredients.length}</Badge>
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ingredient</th>
                              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty (12 months)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {ingredients.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 text-muted-foreground text-xs">{row.product_name}</td>
                                <td className="px-4 py-3 font-medium">{row.ingredient_name}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-xs">
                                  {row.total_quantity.toFixed(2)} {row.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {containers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-medium">Container types</h2>
                        <Badge variant="secondary" className="text-[10px]">{containers.length}</Badge>
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Container</th>
                              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Volume (mL)</th>
                              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Weight (g)</th>
                              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Material</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {containers.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-medium">{row.name}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-xs">
                                  {row.volume_ml != null ? row.volume_ml.toFixed(0) : '—'}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-xs">
                                  {row.weight_g != null ? row.weight_g.toFixed(1) : '—'}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                                  {row.material_type ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── LinkPicker modals ───────────────────────────────────────────────── */}
      {linkSkuPicker && (
        <LinkPicker
          open={!!linkSkuPicker}
          title="Link to existing product"
          description={
            <>
              Connect <strong>{linkSkuPicker.name}</strong> to an existing alka<strong>tera</strong> product. Production, ingredient and packaging data will flow to that product.
            </>
          }
          sourceLabel="Breww SKU"
          sourceName={linkSkuPicker.name}
          sourceDetails={[
            { label: 'Container', value: linkSkuPicker.container_name },
            { label: 'Unit size', value: linkSkuPicker.liquid_volume_ml ? `${Number(linkSkuPicker.liquid_volume_ml).toFixed(0)} ml` : null },
            { label: 'Drink', value: linkSkuPicker.primary_drink_name },
          ]}
          entities={alkProducts.map((p) => ({
            id: String(p.id),
            name: p.name,
            secondary: p.sku || undefined,
            raw: p,
          })) as any}
          entityLabel="product"
          emptyHint="No alkatera products yet. Use Create instead to make one from this SKU."
          createLabel="Create a new product from this SKU instead"
          onCreate={() => setCreateSkuTarget(linkSkuPicker)}
          onPick={async (entity: any) => {
            try {
              await handleLinkSku(linkSkuPicker, entity.raw as AlkateraProduct)
            } catch (err: any) {
              toast.error(err.message || 'Link failed')
            }
          }}
          onClose={() => setLinkSkuPicker(null)}
        />
      )}

      {linkSitePicker && (
        <LinkPicker
          open={!!linkSitePicker}
          title="Link to existing facility"
          description={
            <>
              Connect <strong>{linkSitePicker.name}</strong> to one of your alka<strong>tera</strong> facilities so brewing hL and packaged litres can be imported to the right production history.
            </>
          }
          sourceLabel="Breww site"
          sourceName={linkSitePicker.name}
          entities={facilities.map((f) => ({
            id: f.id,
            name: f.name,
            raw: f,
          })) as any}
          entityLabel="facility"
          emptyHint="No alkatera facilities yet. Create a facility first."
          onPick={async (entity: any) => {
            try {
              await handleLinkSite(linkSitePicker, entity.raw as AlkateraFacility)
            } catch (err: any) {
              toast.error(err.message || 'Link failed')
            }
          }}
          onClose={() => setLinkSitePicker(null)}
        />
      )}

      {/* Create-from-SKU dialog */}
      {createSkuTarget && orgId && (
        <Dialog open={!!createSkuTarget} onOpenChange={(next) => { if (!creatingSku && !next) setCreateSkuTarget(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create new alka<strong>tera</strong> product</DialogTitle>
              <DialogDescription>
                Create a new product prefilled from this Breww SKU. You can edit the details afterwards on the product page.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{createSkuTarget.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Container</span>
                <span className="font-medium">{createSkuTarget.container_name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit size</span>
                <span className="font-medium tabular-nums">
                  {createSkuTarget.liquid_volume_ml ? `${Number(createSkuTarget.liquid_volume_ml).toFixed(0)} ml` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parent drink</span>
                <span className="font-medium">{createSkuTarget.primary_drink_name ?? '—'}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateSkuTarget(null)} disabled={creatingSku}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleCreateSku(createSkuTarget)} disabled={creatingSku}>
                {creatingSku && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Create &amp; link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Unlink confirmations */}
      <AlertDialog open={!!confirmUnlinkSku} onOpenChange={(next) => { if (!next) setConfirmUnlinkSku(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this SKU?</AlertDialogTitle>
            <AlertDialogDescription>
              Data already imported (recipes, production) stays on the linked product. Future syncs won&apos;t flow to this product until you link it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirmUnlinkSku) handleUnlinkSku(confirmUnlinkSku) }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmUnlinkSite} onOpenChange={(next) => { if (!next) setConfirmUnlinkSite(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this site?</AlertDialogTitle>
            <AlertDialogDescription>
              Imported production volumes stay on the facility. Future syncs won&apos;t update that facility until you link the site again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirmUnlinkSite) handleUnlinkSite(confirmUnlinkSite) }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed py-12 flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}
