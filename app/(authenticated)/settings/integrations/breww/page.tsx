'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Package, FlaskConical, Box } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

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

interface ContainerType {
  id: string
  external_id: string
  name: string
  volume_ml: number | null
  weight_g: number | null
  material_type: string | null
  synced_at: string
}

interface AlkateraProduct {
  id: string
  name: string
  sku: string | null
}

// ─── Import dialog ────────────────────────────────────────────────────────────

function ImportDialog({
  open,
  onClose,
  materialType,
  materialName,
  quantity,
  unit,
  organizationId,
  products,
}: {
  open: boolean
  onClose: (imported: boolean) => void
  materialType: 'ingredient' | 'packaging'
  materialName: string
  quantity?: number
  unit?: string
  organizationId: string
  products: AlkateraProduct[]
}) {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!selectedProductId) return
    setImporting(true)
    try {
      const res = await fetch('/api/integrations/breww/import-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          productId: selectedProductId,
          materialType,
          materialName,
          quantity: quantity ?? null,
          unit: unit ?? null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Import failed')
      }
      toast.success(`Added "${materialName}" to the selected product`)
      onClose(true)
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!importing) onClose(false) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Import to product</DialogTitle>
          <DialogDescription>
            Choose an alka<strong>tera</strong> product to add <strong>{materialName}</strong> to as a {materialType}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a product…" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.sku ? ` (${p.sku})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onClose(false)} disabled={importing}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImport} disabled={importing || !selectedProductId}>
              {importing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrewwDataPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [production, setProduction] = useState<ProductionRun[]>([])
  const [ingredients, setIngredients] = useState<IngredientUsage[]>([])
  const [containers, setContainers] = useState<ContainerType[]>([])
  const [alkProducts, setAlkProducts] = useState<AlkateraProduct[]>([])
  const [loading, setLoading] = useState(true)

  const [importDialog, setImportDialog] = useState<{
    open: boolean
    materialType: 'ingredient' | 'packaging'
    materialName: string
    quantity?: number
    unit?: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [prodRes, ingRes, ctRes, { data: prods }] = await Promise.all([
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=production`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=ingredients`),
        fetch(`/api/integrations/breww/data?organizationId=${orgId}&table=containers`),
        supabase
          .from('products')
          .select('id, name, sku')
          .eq('organization_id', orgId)
          .order('name'),
      ])

      const [prodBody, ingBody, ctBody] = await Promise.all([
        prodRes.json(),
        ingRes.json(),
        ctRes.json(),
      ])

      setProduction(prodBody.data ?? [])
      setIngredients(ingBody.data ?? [])
      setContainers(ctBody.data ?? [])
      setAlkProducts(prods ?? [])
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

  // Group production runs by product for the summary view.
  const productionByProduct = production.reduce<Record<string, { name: string; totalHl: number; months: number }>>(
    (acc, run) => {
      const key = run.product_external_id
      if (!acc[key]) acc[key] = { name: run.product_name, totalHl: 0, months: 0 }
      acc[key].totalHl += run.volume_hl
      acc[key].months += 1
      return acc
    },
    {},
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
          Data pulled from your Breww account. Use the import buttons to add ingredients and packaging to your alka<strong>tera</strong> products.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading synced data…</span>
        </div>
      ) : (
        <Tabs defaultValue="production">
          <TabsList>
            <TabsTrigger value="production" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Production
              {production.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">{Object.keys(productionByProduct).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Ingredients
              {ingredients.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">{ingredients.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="packaging" className="gap-1.5">
              <Box className="h-3.5 w-3.5" />
              Packaging
              {containers.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">{containers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Production ──────────────────────────────────────────────── */}
          <TabsContent value="production" className="mt-4">
            {Object.keys(productionByProduct).length === 0 ? (
              <EmptyState message="No production data synced yet. Run a sync from the Integrations page." />
            ) : (
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
          </TabsContent>

          {/* ── Ingredients ─────────────────────────────────────────────── */}
          <TabsContent value="ingredients" className="mt-4">
            {ingredients.length === 0 ? (
              <EmptyState message="No ingredient data synced yet. Run a sync from the Integrations page." />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ingredient</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty (12 months)</th>
                      <th className="px-4 py-2.5" />
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
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setImportDialog({
                                open: true,
                                materialType: 'ingredient',
                                materialName: row.ingredient_name,
                                quantity: row.total_quantity,
                                unit: row.unit,
                              })
                            }
                            disabled={alkProducts.length === 0}
                          >
                            Import to product
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Packaging ───────────────────────────────────────────────── */}
          <TabsContent value="packaging" className="mt-4">
            {containers.length === 0 ? (
              <EmptyState message="No container types synced yet. Run a sync from the Integrations page." />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Container</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Volume (mL)</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Weight (g)</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Material</th>
                      <th className="px-4 py-2.5" />
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
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setImportDialog({
                                open: true,
                                materialType: 'packaging',
                                materialName: row.name,
                                quantity: row.weight_g ?? undefined,
                                unit: row.weight_g != null ? 'g' : undefined,
                              })
                            }
                            disabled={alkProducts.length === 0}
                          >
                            Import to product
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {importDialog && orgId && (
        <ImportDialog
          open={importDialog.open}
          materialType={importDialog.materialType}
          materialName={importDialog.materialName}
          quantity={importDialog.quantity}
          unit={importDialog.unit}
          organizationId={orgId}
          products={alkProducts}
          onClose={(imported) => {
            setImportDialog(null)
            if (imported) fetchData()
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
