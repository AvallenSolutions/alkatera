'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Beer, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface PreviewRow {
  ingredient_name: string
  unit: string
  total_qty_12m: number
  qty_per_unit: number
  qty_per_hl: number
}

interface PreviewMeta {
  drink_name: string | null
  drink_external_id: string
  sku_name: string
  sku_volume_ml: number
  total_hl_12m: number
  ingredient_count: number
  period_start: string | null
  period_end: string | null
}

export function BrewwRecipeImportDialog({
  open,
  onOpenChange,
  organizationId,
  productId,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  productId: number | string
  onImported: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [meta, setMeta] = useState<PreviewMeta | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const fetchPreview = async () => {
      setLoading(true)
      setErrorMsg(null)
      setPreview(null)
      setMeta(null)
      try {
        const res = await fetch('/api/integrations/breww/import-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, productId, commit: false }),
        })
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setErrorMsg(body.error || 'Failed to compute recipe preview')
        } else {
          setPreview(body.preview ?? [])
          setMeta(body.meta ?? null)
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err.message || 'Failed to compute recipe preview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreview()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, productId])

  const handleCommit = async () => {
    setCommitting(true)
    try {
      const res = await fetch('/api/integrations/breww/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, productId, commit: true }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Import failed')
      const parts: string[] = []
      if (body.imported) parts.push(`${body.imported} ingredient${body.imported === 1 ? '' : 's'}`)
      if (body.packagingImported) parts.push(`container`)
      if (body.secondaryImported) parts.push(`${body.secondaryImported} secondary packaging`)
      toast.success(parts.length ? `Imported ${parts.join(', ')} from Breww` : 'Breww import complete')
      onImported()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    } finally {
      setCommitting(false)
    }
  }

  const formatQty = (n: number) => {
    if (n >= 1) return n.toFixed(3)
    if (n >= 0.001) return n.toFixed(4)
    return n.toExponential(2)
  }

  const canCommit = !!preview && preview.length > 0 && !loading && !committing

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!committing) onOpenChange(next) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
            Import recipe from Breww
          </DialogTitle>
          <DialogDescription>
            Pulls the ingredient recipe from Breww and scales it to the SKU&apos;s unit size. Existing Breww-derived rows on this product will be replaced.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing preview…
          </div>
        )}

        {errorMsg && !loading && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">Cannot compute preview</p>
              <p className="text-amber-800 dark:text-amber-200 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {!loading && !errorMsg && meta && preview && (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <InfoTile label="Parent drink" value={meta.drink_name ?? '—'} />
              <InfoTile label="Unit size" value={`${meta.sku_volume_ml.toFixed(0)} ml`} />
              <InfoTile label="Basis" value={`${meta.total_hl_12m.toFixed(1)} hL`} />
              <InfoTile
                label="Period"
                value={
                  meta.period_start && meta.period_end
                    ? `${fmtDate(meta.period_start)} – ${fmtDate(meta.period_end)}`
                    : 'Last 12 months'
                }
              />
            </div>

            {preview.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No ingredient data found for this drink in Breww.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ingredient</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Per unit</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Per hL</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total (12m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row) => (
                      <tr key={row.ingredient_name} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-medium">{row.ingredient_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(row.qty_per_unit)} {row.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">
                          {formatQty(row.qty_per_hl)} {row.unit}/hL
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">
                          {formatQty(row.total_qty_12m)} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
              Quantities are 12-month averages (total ingredient usage ÷ total production hL), scaled to the SKU&apos;s unit size. Emission factors need to be assigned to each row on the recipe page.
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={committing}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCommit} disabled={!canCommit}>
            {committing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Import {preview?.length ? `${preview.length} ingredient${preview.length === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5 truncate">{value}</div>
    </div>
  )
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  } catch {
    return iso
  }
}
