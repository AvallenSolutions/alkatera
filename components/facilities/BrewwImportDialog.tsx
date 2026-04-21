"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, AlertCircle, Link2 } from "lucide-react"
import { toast } from "sonner"

interface MonthRow {
  month: string
  volume: number
  unit: string
  siteLabel: string
  skipped: boolean
  skippedReason?: string
}

interface PreviewResponse {
  hasLink: boolean
  linkedSiteIds: string[]
  brewingRows: MonthRow[]
  packagingRows: MonthRow[]
}

interface Props {
  open: boolean
  facilityId: string
  organizationId: string
  onClose: (imported: boolean) => void
}

export function BrewwImportDialog({ open, facilityId, organizationId, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [selected, setSelected] = useState<Record<string, Set<string>>>({ brewing: new Set(), packaging: new Set() })
  const [importing, setImporting] = useState(false)
  const [tab, setTab] = useState<"brewing" | "packaging">("brewing")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/integrations/breww/import-facility-volumes?organizationId=${organizationId}&facilityId=${facilityId}`,
      )
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load preview")
      const body = (await res.json()) as PreviewResponse
      setPreview(body)
      const preselect = (rows: MonthRow[]) =>
        new Set(rows.filter((r) => !r.skipped).map((r) => r.month))
      setSelected({ brewing: preselect(body.brewingRows), packaging: preselect(body.packagingRows) })
    } catch (err: any) {
      toast.error(err.message || "Failed to load Breww data")
    } finally {
      setLoading(false)
    }
  }, [facilityId, organizationId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleImport = async () => {
    if (!preview) return
    const months = Array.from(selected[tab])
    if (months.length === 0) {
      toast.error("Select at least one month")
      return
    }
    setImporting(true)
    try {
      const res = await fetch("/api/integrations/breww/import-facility-volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, facilityId, source: tab, months }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Import failed")
      if (body.errors?.length > 0) {
        toast.warning(`Imported ${body.inserted} with ${body.errors.length} errors`)
      } else {
        toast.success(`Imported ${body.inserted} month${body.inserted === 1 ? "" : "s"} from Breww`)
      }
      onClose(body.inserted > 0)
    } catch (err: any) {
      toast.error(err.message || "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const toggleMonth = (source: "brewing" | "packaging", month: string) => {
    setSelected((prev) => {
      const next = new Set(prev[source])
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return { ...prev, [source]: next }
    })
  }

  const renderRows = (rows: MonthRow[], source: "brewing" | "packaging") => {
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No {source === "brewing" ? "brewing" : "packaging"} data available for this facility.
        </div>
      )
    }
    return (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-2.5" />
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Month</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Volume</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Site</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.month} className={row.skipped ? "bg-muted/20 text-muted-foreground" : ""}>
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected[source].has(row.month)}
                    disabled={row.skipped}
                    onCheckedChange={() => toggleMonth(source, row.month)}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums">{row.month}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.volume.toLocaleString()} {row.unit === "Hectolitres" ? "hL" : "L"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.skipped ? (
                    <Badge variant="outline" className="text-[10px]">Already entered</Badge>
                  ) : (
                    <span className="text-muted-foreground">{row.siteLabel}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!importing && !next) onClose(false) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import production volume from Breww</DialogTitle>
          <DialogDescription>
            Brewing hL and packaged litres are shown separately. Months with a manual entry are skipped so your input is never overwritten.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !preview ? null : !preview.hasLink ? (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto" />
            <div>
              <div className="font-medium text-sm">No Breww site linked to this facility</div>
              <p className="text-xs text-muted-foreground mt-1">
                Showing combined data across all Breww sites. Link a specific site in Settings &rarr; Integrations &rarr; Breww &rarr; Sites to attribute volumes correctly when brewing and packaging happen at different sites.
              </p>
            </div>
          </div>
        ) : null}

        {!loading && preview && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "brewing" | "packaging")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="brewing">
                Brewing ({preview.brewingRows.filter((r) => !r.skipped).length} available)
              </TabsTrigger>
              <TabsTrigger value="packaging">
                Packaging ({preview.packagingRows.filter((r) => !r.skipped).length} available)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="brewing" className="mt-3">
              {renderRows(preview.brewingRows, "brewing")}
              <p className="text-[11px] text-muted-foreground mt-2">
                Brewing volume in hectolitres, summed from Breww drink-batches by period_start. Best for facilities where the actual brewing happens.
              </p>
            </TabsContent>
            <TabsContent value="packaging" className="mt-3">
              {renderRows(preview.packagingRows, "packaging")}
              <p className="text-[11px] text-muted-foreground mt-2">
                Packaged beer in litres, calculated from Breww planned-packaging runs. Best for canning/bottling facilities when they&rsquo;re separate from the brewery.
              </p>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onClose(false)} disabled={importing}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleImport} disabled={importing || loading || !preview}>
            {importing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Import selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
