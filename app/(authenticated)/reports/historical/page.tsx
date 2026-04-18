'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollText, Leaf, ArrowRight, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Simple listing surface for historical_imports. Purpose-built to make
// imported historical data feel real — users see what came across, click
// through to the raw extracted data, and can remove rows if needed.
// Dashboard / trend-widget integration is a deliberate follow-up.

interface HistoricalImportRow {
  id: string
  kind: 'sustainability_report' | 'lca_report'
  reporting_year: number | null
  source_document_name: string | null
  extracted_data: Record<string, any>
  created_at: string
}

export default function HistoricalImportsPage() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [rows, setRows] = useState<HistoricalImportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('historical_imports')
      .select('id, kind, reporting_year, source_document_name, extracted_data, created_at')
      .eq('organization_id', orgId)
      .order('reporting_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load historical imports')
      setLoading(false)
      return
    }
    setRows((data || []) as HistoricalImportRow[])
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from('historical_imports').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      toast.error('Delete failed')
      return
    }
    toast.success('Removed')
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const reports = rows.filter((r) => r.kind === 'sustainability_report')
  const lcas = rows.filter((r) => r.kind === 'lca_report')

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">Historical imports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Data carried over from prior sustainability reports and LCA studies. Stored for reference — use the{' '}
          <span className="font-medium">Upload</span> button in the header to add more.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">No historical imports yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drop a prior sustainability report or LCA PDF into the header&apos;s Upload dialog and we&apos;ll extract the headline metrics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <HistoricalSection
            title="Sustainability reports"
            icon={<ScrollText className="h-4 w-4" />}
            rows={reports}
            renderSummary={renderReportSummary}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
          <HistoricalSection
            title="Prior LCAs"
            icon={<Leaf className="h-4 w-4" />}
            rows={lcas}
            renderSummary={renderLcaSummary}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Next step</CardTitle>
          <CardDescription className="text-xs">
            Promoting an imported LCA to a full operational PCF — so it appears in your live LCA library with calculated methodology — is a follow-up we&apos;ll wire up next.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function HistoricalSection({
  title,
  icon,
  rows,
  renderSummary,
  onDelete,
  deletingId,
}: {
  title: string
  icon: React.ReactNode
  rows: HistoricalImportRow[]
  renderSummary: (r: HistoricalImportRow) => React.ReactNode
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nothing imported yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium truncate">
                  {r.source_document_name || `Import ${r.id.slice(0, 8)}`}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.reporting_year ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-xs">{r.reporting_year}</Badge>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-red-500"
                    disabled={deletingId === r.id}
                    onClick={() => onDelete(r.id)}
                    title="Remove"
                  >
                    {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {renderSummary(r)}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function renderReportSummary(r: HistoricalImportRow) {
  const d = r.extracted_data || {}
  const all: Array<[string, string | number | undefined]> = [
    ['Scope 1', d.scope1_tco2e ? `${d.scope1_tco2e} tCO₂e` : undefined],
    ['Scope 2', d.scope2_tco2e_market ? `${d.scope2_tco2e_market} tCO₂e` : undefined],
    ['Scope 3', d.scope3_tco2e ? `${d.scope3_tco2e} tCO₂e` : undefined],
    ['Water', d.water_m3 ? `${d.water_m3} m³` : undefined],
    ['Waste', d.waste_tonnes ? `${d.waste_tonnes} t` : undefined],
    ['Headcount', d.headcount],
  ]
  const items = all.filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== null && e[1] !== '')
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">No metrics captured.</p>
  }
  return (
    <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
      {items.map(([k, v]) => (
        <div key={k as string}>
          <span className="text-foreground font-medium">{v as string | number}</span>{' '}
          <span>{k}</span>
        </div>
      ))}
    </div>
  )
}

function renderLcaSummary(r: HistoricalImportRow) {
  const d = r.extracted_data || {}
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {d.functional_unit && <p>Unit: <span className="text-foreground">{d.functional_unit}</span></p>}
      {d.total_gwp_kgco2e !== undefined && <p>GWP: <span className="text-foreground font-medium">{d.total_gwp_kgco2e} kgCO₂e</span></p>}
      {d.system_boundary && <p>Boundary: <span className="text-foreground">{d.system_boundary}</span></p>}
      {d.methodology && <p>Methodology: <span className="text-foreground">{d.methodology}</span></p>}
    </div>
  )
}
