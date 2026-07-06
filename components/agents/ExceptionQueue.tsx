'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

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

const FACILITY_BILL_KINDS = new Set(['utility_bill', 'water_bill', 'waste_bill'])

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

function Row({
  exception,
  facilities,
  onChange,
}: {
  exception: AgentException
  facilities: Facility[]
  onChange: () => void
}) {
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

  const act = useCallback(
    async (action: 'approve' | 'reject' | 'defer') => {
      if (action === 'approve' && needsFacility && !facilityId) {
        toast.error('Pick a facility before approving.')
        return
      }
      if (action === 'approve' && needsFacility && (!periodStart || !periodEnd)) {
        toast.error('Set the bill period before approving.')
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
            periodStart: needsFacility ? periodStart : undefined,
            periodEnd: needsFacility ? periodEnd : undefined,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Action failed')
        toast.success(
          action === 'approve'
            ? `Approved · ${body?.applied_to?.saved ?? 1} entry written`
            : action === 'reject'
            ? 'Rejected'
            : 'Deferred',
        )
        onChange()
      } catch (err: any) {
        toast.error(err?.message || 'Action failed')
      } finally {
        setBusy(null)
      }
    },
    [exception.id, facilityId, needsFacility, onChange, periodEnd, periodStart],
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            </div>
          )}
          <PayloadPreview kind={exception.kind} payload={exception.payload} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => act('approve')}
              disabled={busy !== null}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Approve
            </Button>
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
