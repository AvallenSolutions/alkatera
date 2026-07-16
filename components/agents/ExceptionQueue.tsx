'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PillButton } from '@/components/studio/pill-button'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import {
  HANDOFF_CONFIG,
  isHandoffKind,
  buildDeepLink,
  getStashId,
  GROWING_ASSET_TYPES,
  type AssetPickerType,
} from '@/lib/intake/deep-links'

interface AgentException {
  id: string
  kind: string
  source: string
  source_ref: { ingestJobId?: string; fileName?: string; fromAddress?: string; subject?: string }
  payload: any
  suggested_facility_id: string | null
  confidence: number | null
  title: string
  summary: string | null
  status: string
  created_at: string
}

interface Facility {
  id: string
  name: string
}

// Bill kinds need a facility + a billing period. refrigerant_service also
// needs a facility (utility_data_entries is facility-scoped), but has no
// period — it's a single service date carried on the payload already.
const PERIOD_BILL_KINDS = new Set(['utility_bill', 'water_bill', 'waste_bill'])
const FACILITY_BILL_KINDS = new Set(['utility_bill', 'water_bill', 'waste_bill', 'refrigerant_service'])

function ConfidencePill({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const color =
    pct >= 80
      ? 'text-studio-good'
      : pct >= 60
      ? 'text-studio-attention'
      : 'text-studio-stale'
  return (
    <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${color}`}>
      {pct}% confidence
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const label =
    source === 'email'
      ? 'Email'
      : source === 'upload'
      ? 'Upload'
      : source === 'agent_run'
      ? 'Agent run'
      : source === 'xero_sync'
      ? 'Xero'
      : source === 'integration_sync'
      ? 'Integration'
      : 'Manual'
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
      {label}
    </span>
  )
}

interface AssetOption {
  id: string
  name: string
}

function Row({
  exception,
  facilities,
  onChange,
}: {
  exception: AgentException
  facilities: Facility[]
  onChange: () => void
}) {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'defer'>(null)
  const [facilityId, setFacilityId] = useState(exception.suggested_facility_id || '')
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const p = exception.payload?.utilityBill?.period_start ||
      exception.payload?.waterBill?.period_start ||
      exception.payload?.wasteBill?.period_start || ''
    return p || ''
  })
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const p = exception.payload?.utilityBill?.period_end ||
      exception.payload?.waterBill?.period_end ||
      exception.payload?.wasteBill?.period_end || ''
    return p || ''
  })

  const needsFacility = FACILITY_BILL_KINDS.has(exception.kind)
  const needsPeriod = PERIOD_BILL_KINDS.has(exception.kind)

  // Handoff kinds (bom, spray_diary, soil_carbon_evidence, hospitality_menu,
  // pos_sales_export, packaging_spec, bulk_xlsx, accounts_csv, website_import,
  // supplier_catalog_import) have no auto-write — approving them stamps the
  // decision and carries the file across to the page that finishes the job.
  const handoffConfig = HANDOFF_CONFIG[exception.kind]
  const isHandoff = isHandoffKind(exception.kind)
  const stashId = useMemo(() => getStashId(exception.kind, exception.payload), [exception.kind, exception.payload])
  const [assetType, setAssetType] = useState<AssetPickerType | ''>(
    handoffConfig?.assetPicker === 'product' ? 'products' : '',
  )
  const [assetId, setAssetId] = useState('')
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([])
  const [assetLoading, setAssetLoading] = useState(false)

  useEffect(() => {
    if (!expanded || !handoffConfig?.assetPicker || !assetType) return
    let cancelled = false
    setAssetLoading(true)
    setAssetOptions([])
    setAssetId('')
    const load = async () => {
      if (assetType === 'products') {
        if (!currentOrganization?.id) return
        const { data } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', currentOrganization.id)
          .order('name')
        if (!cancelled) setAssetOptions((data || []).map((p: any) => ({ id: String(p.id), name: p.name })))
        return
      }
      const meta = GROWING_ASSET_TYPES.find(a => a.type === assetType)
      if (!meta) return
      try {
        const res = await fetch(meta.apiPath)
        const body = await res.json().catch(() => ({}))
        if (!cancelled) setAssetOptions((body?.data || []).map((a: any) => ({ id: a.id, name: a.name })))
      } catch {
        if (!cancelled) setAssetOptions([])
      }
    }
    load().finally(() => { if (!cancelled) setAssetLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, assetType, handoffConfig?.assetPicker])

  const deepLinkUrl = useMemo(
    () => buildDeepLink(exception.kind, { stashId, assetType: assetType || undefined, assetId: assetId || undefined }),
    [exception.kind, stashId, assetType, assetId],
  )

  const act = useCallback(
    async (action: 'approve' | 'reject' | 'defer') => {
      if (action === 'approve' && needsFacility && !facilityId) {
        toast.error('Pick a facility before approving.')
        return
      }
      if (action === 'approve' && needsPeriod && (!periodStart || !periodEnd)) {
        toast.error('Set the bill period before approving.')
        return
      }
      if (action === 'approve' && handoffConfig?.assetPicker && !assetId) {
        toast.error('Pick which record this belongs to before approving.')
        return
      }
      setBusy(action)
      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(`/api/agents/exceptions/${exception.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            action,
            facilityId: needsFacility ? facilityId : undefined,
            periodStart: needsPeriod ? periodStart : undefined,
            periodEnd: needsPeriod ? periodEnd : undefined,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Action failed')
        toast.success(
          action === 'approve'
            ? isHandoff
              ? 'Approved · carrying the file across'
              : `Approved · ${body?.applied_to?.saved ?? 1} entry written`
            : action === 'reject'
            ? 'Rejected'
            : 'Deferred',
        )
        if (action === 'approve' && isHandoff && deepLinkUrl) {
          router.push(deepLinkUrl)
        }
        onChange()
      } catch (err: any) {
        toast.error(err?.message || 'Action failed')
      } finally {
        setBusy(null)
      }
    },
    [exception.id, facilityId, needsFacility, needsPeriod, handoffConfig, assetId, isHandoff, deepLinkUrl, router, onChange, periodEnd, periodStart],
  )

  return (
    <div className="rounded-[6px] border border-border bg-card">
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="mt-1 flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{exception.title}</span>
            <SourceBadge source={exception.source} />
            <ConfidencePill value={exception.confidence} />
          </div>
          {exception.summary && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {exception.summary}
            </p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date(exception.created_at).toLocaleString('en-GB')}
            {exception.source_ref?.fromAddress && ` · from ${exception.source_ref.fromAddress}`}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {needsFacility && (
            <div className={`grid grid-cols-1 gap-3 ${needsPeriod ? 'sm:grid-cols-3' : 'sm:max-w-xs'}`}>
              <div className="space-y-1">
                <Label className="text-xs">Facility</Label>
                <Select value={facilityId} onValueChange={setFacilityId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needsPeriod && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Period start</Label>
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={e => setPeriodStart(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Period end</Label>
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={e => setPeriodEnd(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <PayloadPreview kind={exception.kind} payload={exception.payload} />
          {isHandoff && handoffConfig && (
            <div className="rounded-md border border-dashed border-border bg-background/40 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">{handoffConfig.helperText}</p>
              {handoffConfig.assetPicker === 'growing' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={assetType} onValueChange={v => setAssetType(v as AssetPickerType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Vineyard, orchard or field?" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROWING_ASSET_TYPES.map(t => (
                        <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={assetId} onValueChange={setAssetId} disabled={!assetType || assetLoading}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={assetLoading ? 'Loading…' : 'Select record'} />
                    </SelectTrigger>
                    <SelectContent>
                      {assetOptions.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {handoffConfig.assetPicker === 'product' && (
                <Select value={assetId} onValueChange={setAssetId} disabled={assetLoading}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={assetLoading ? 'Loading…' : 'Select product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {isHandoff ? (
              <PillButton
                variant="ink"
                size="sm"
                onClick={() => act('approve')}
                disabled={busy !== null || (!!handoffConfig?.assetPicker && !assetId)}
              >
                {handoffConfig?.buttonLabel || 'Approve'}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </PillButton>
            ) : (
              <Button
                size="sm"
                onClick={() => act('approve')}
                disabled={busy !== null}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Approve
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => act('defer')} disabled={busy !== null}>
              <Clock3 className="mr-1 h-4 w-4" />
              Defer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => act('reject')}
              disabled={busy !== null}
              className="text-studio-stale hover:bg-secondary hover:text-studio-stale"
            >
              <XCircle className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PayloadPreview({ kind, payload }: { kind: string; payload: any }) {
  const entries = useMemo(() => {
    if (kind === 'utility_bill') return payload?.utilityBill?.entries || []
    if (kind === 'water_bill') return payload?.waterBill?.entries || []
    if (kind === 'waste_bill') return payload?.wasteBill?.entries || []
    return []
  }, [kind, payload])

  if (entries.length > 0) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Extracted entries
        </div>
        <ul className="space-y-1 text-sm">
          {entries.map((e: any, i: number) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{e.utility_type || e.activity_category}</span>
              <span className="font-mono">
                {Number(e.quantity || 0).toLocaleString()} {e.unit || ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Onboarding-seeded and website-crawl kinds carry small structured payloads
  // with a single field worth surfacing. Show it inline so the user knows
  // what they're approving without needing to deep-link to the source page.
  const inlineRows: Array<{ label: string; value: string }> = []
  if (kind === 'onboarding_estimate' && payload?.estimate_tonnes_co2e != null) {
    inlineRows.push({ label: 'Estimate', value: `~${Number(payload.estimate_tonnes_co2e).toLocaleString()} t CO₂e/yr` })
    if (payload.methodology) inlineRows.push({ label: 'Method', value: String(payload.methodology) })
  }
  if (kind === 'propose_target') {
    if (payload?.reduction_pct) inlineRows.push({ label: 'Reduction', value: `${payload.reduction_pct}%` })
    if (payload?.target_year) inlineRows.push({ label: 'By', value: String(payload.target_year) })
  }
  if (kind === 'request_data' && payload?.suggested) {
    inlineRows.push({ label: 'Suggested next step', value: String(payload.suggested).replace(/_/g, ' ') })
  }
  if (kind === 'website_supplier' && payload?.supplier_name) {
    inlineRows.push({ label: 'Supplier', value: String(payload.supplier_name) })
  }
  if (kind === 'website_production_location' && payload?.location) {
    inlineRows.push({ label: 'Location', value: String(payload.location) })
  }
  if (kind === 'website_certification' && payload?.certification) {
    inlineRows.push({ label: 'Certification', value: String(payload.certification) })
  }
  if (kind === 'refrigerant_service') {
    const r = payload?.refrigerantService || payload || {}
    if (r.refrigerant_type) inlineRows.push({ label: 'Refrigerant', value: String(r.refrigerant_type).toUpperCase() })
    if (r.quantity_kg != null) inlineRows.push({ label: 'Recharged', value: `${Number(r.quantity_kg).toLocaleString()} kg` })
    if (r.service_date) inlineRows.push({ label: 'Service date', value: String(r.service_date) })
  }
  if (kind === 'supplier_invoice') {
    const r = payload?.supplierInvoice || payload || {}
    if (r.supplier_name) inlineRows.push({ label: 'Supplier', value: String(r.supplier_name) })
    if (Array.isArray(r.line_items)) inlineRows.push({ label: 'Line items', value: String(r.line_items.length) })
  }
  if (kind === 'freight_invoice') {
    const r = payload?.freightInvoice || payload || {}
    if (r.carrier_name) inlineRows.push({ label: 'Carrier', value: String(r.carrier_name) })
    if (r.transport_mode) inlineRows.push({ label: 'Mode', value: String(r.transport_mode) })
  }
  if (kind === 'website_import' && payload?.product_count != null) {
    inlineRows.push({ label: 'Products found', value: String(payload.product_count) })
  }
  if (kind === 'supplier_catalog_import' && payload?.product_count != null) {
    inlineRows.push({ label: 'Products extracted', value: String(payload.product_count) })
  }

  // Migration engine v1 (lib/ingest/migrate-report.ts) — the four migration_*
  // kinds batch a list under payload.items, one exception per entity group
  // rather than per item, so the preview lists names instead of one field.
  if (kind.startsWith('migration_') && Array.isArray(payload?.items)) {
    const items: any[] = payload.items
    const label =
      kind === 'migration_facilities' ? 'Facilities' :
      kind === 'migration_products' ? 'Products' :
      kind === 'migration_targets' ? 'Targets' :
      'Certifications'
    const names = items
      .map((item) => item?.name || item?.product_name || item?.metric || null)
      .filter(Boolean)
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <ul className="space-y-1 text-sm">
          {names.map((name: string, i: number) => (
            <li key={i} className="text-foreground">{name}</li>
          ))}
        </ul>
        {payload?.sourceDocumentName && (
          <p className="mt-2 text-xs text-muted-foreground">From {payload.sourceDocumentName}</p>
        )}
      </div>
    )
  }

  if (inlineRows.length > 0) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <ul className="space-y-1 text-sm">
          {inlineRows.map((row, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
      <FileText className="mb-1 inline h-3 w-3" /> Raw payload. Open the source page to review.
    </div>
  )
}

export function ExceptionQueue() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [exceptions, setExceptions] = useState<AgentException[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined
      const [exRes, facRes] = await Promise.all([
        fetch('/api/agents/exceptions?status=open', { headers }),
        supabase.from('facilities').select('id, name').eq('organization_id', orgId).order('name'),
      ])
      const exBody = await exRes.json().catch(() => ({}))
      if (exRes.ok) setExceptions(exBody.exceptions || [])
      else toast.error(exBody?.error || 'Failed to load queue')
      if (!facRes.error) setFacilities(facRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const triggerRun = useCallback(async () => {
    if (!orgId) return
    setRunning(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const res = await fetch('/api/agents/footprint/run', {
        method: 'PUT',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Run failed')
      toast.success(
        body.exceptionsCreated
          ? `Agent picked up ${body.exceptionsCreated} new item(s)`
          : 'Agent run complete. No new items.',
      )
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Run failed')
    } finally {
      setRunning(false)
    }
  }, [load, orgId])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Exception queue
          {exceptions.length > 0 && (
            <span className="ml-2 font-mono text-sm font-bold text-studio-dim tabular-nums">
              {exceptions.length}
            </span>
          )}
        </h2>
        <Button variant="outline" size="sm" onClick={triggerRun} disabled={running}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Run agent now
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Loading queue…
        </div>
      ) : exceptions.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing waiting for review. The agent is up to date.
        </div>
      ) : (
        <div className="space-y-2">
          {exceptions.map(e => (
            <Row key={e.id} exception={e} facilities={facilities} onChange={load} />
          ))}
        </div>
      )}
    </div>
  )
}
