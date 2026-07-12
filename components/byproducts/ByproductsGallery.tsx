'use client'

/**
 * Gallery view of an organisation's byproducts. Each card shows the
 * destination, partner, latest flow, and a click-through to the drawer
 * where flow history can be reviewed and new entries logged.
 *
 * Lives at /byproducts/. Reads from /api/byproducts and /api/byproducts/[id]/flows.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ArrowDown, ArrowUp, Minus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StateChip } from '@/components/studio/state-chip'
import type { WorkingTone } from '@/components/studio/theme'
import {
  BYPRODUCT_DESTINATION_TYPES,
  getDestinationMeta,
  type ByproductDestinationType,
} from '@/lib/byproducts/destination-types'
import { ByproductCreateDialog } from './ByproductCreateDialog'
import { ByproductFlowDrawer } from './ByproductFlowDrawer'

export interface Byproduct {
  id: string
  name: string
  description: string | null
  destination_type: ByproductDestinationType
  partner_name: string | null
  partner_url: string | null
  contract_started: string | null
  status: 'active' | 'paused' | 'ended'
  visibility: 'private' | 'platform' | 'public'
  facility_id: string | null
  created_at: string
  updated_at: string | null
  latest_flow_kg?: number | null
  prior_flow_kg?: number | null
}

const STATUS_COPY: Record<Byproduct['status'], { label: string; tone: WorkingTone }> = {
  active: { label: 'Active', tone: 'good' },
  paused: { label: 'Paused', tone: 'attention' },
  ended: { label: 'Historical', tone: 'quiet' },
}

export function ByproductsGallery() {
  const [byproducts, setByproducts] = useState<Byproduct[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [drawerByproduct, setDrawerByproduct] = useState<Byproduct | null>(null)

  const load = useCallback(async () => {
    try {
      const url = `/api/byproducts?status=${statusFilter}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        setByproducts([])
        return
      }
      const json = await res.json()
      const items = Array.isArray(json?.byproducts) ? (json.byproducts as Byproduct[]) : []
      // Pull latest two flows per byproduct in parallel for the trend arrows.
      const enriched = await Promise.all(
        items.map(async (bp) => {
          try {
            const fr = await fetch(`/api/byproducts/${bp.id}/flows`, { credentials: 'include' })
            if (!fr.ok) return bp
            const fj = await fr.json()
            const flows = Array.isArray(fj?.flows) ? fj.flows : []
            const latest = flows[0]?.mass_kg ?? null
            const prior = flows[1]?.mass_kg ?? null
            return {
              ...bp,
              latest_flow_kg: latest !== null ? Number(latest) : null,
              prior_flow_kg: prior !== null ? Number(prior) : null,
            } as Byproduct
          } catch {
            return bp
          }
        }),
      )
      setByproducts(enriched)
    } catch {
      setByproducts([])
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const empty = byproducts !== null && byproducts.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All (incl. historical)
          </Button>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add byproduct
        </Button>
      </div>

      {byproducts === null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-[6px]" />
          ))}
        </div>
      )}

      {empty && (
        <div className="border-t border-studio-hairline px-4 pt-10 pb-6 text-center">
          <p className="text-sm text-muted-foreground">
            No byproducts logged yet. Register a circular destination (animal feed, biogas, recaptured CO₂) and the platform will track it as part of your circularity score.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add your first byproduct
          </Button>
        </div>
      )}

      {byproducts && byproducts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {byproducts.map((bp) => (
            <ByproductCard key={bp.id} byproduct={bp} onClick={() => setDrawerByproduct(bp)} />
          ))}
        </div>
      )}

      <ByproductCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false)
          void load()
        }}
      />
      <ByproductFlowDrawer
        byproduct={drawerByproduct}
        onClose={() => setDrawerByproduct(null)}
        onChanged={() => {
          void load()
        }}
      />
    </div>
  )
}

function ByproductCard({ byproduct, onClick }: { byproduct: Byproduct; onClick: () => void }) {
  const meta = getDestinationMeta(byproduct.destination_type)
  const statusCopy = STATUS_COPY[byproduct.status]
  const trend = useMemo(() => {
    const latest = byproduct.latest_flow_kg
    const prior = byproduct.prior_flow_kg
    if (latest === null || latest === undefined || prior === null || prior === undefined) return null
    if (prior === 0) return null
    const pct = ((latest - prior) / prior) * 100
    return pct
  }, [byproduct.latest_flow_kg, byproduct.prior_flow_kg])

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[6px] border border-border bg-card p-4 hover:bg-secondary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-studio-cobalt"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl leading-none">{meta?.emoji ?? '📦'}</span>
          <div className="min-w-0">
            <p className="font-semibold truncate">{byproduct.name}</p>
            <p className="text-xs text-muted-foreground truncate">{meta?.label ?? byproduct.destination_type}</p>
          </div>
        </div>
        <StateChip tone={statusCopy.tone}>{statusCopy.label}</StateChip>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        {byproduct.partner_name && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Partner</span>
            <span className="font-medium truncate max-w-[160px]">
              {byproduct.partner_url ? (
                <a
                  href={byproduct.partner_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {byproduct.partner_name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                byproduct.partner_name
              )}
            </span>
          </div>
        )}
        {byproduct.contract_started && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Since</span>
            <span className="tabular-nums">
              {new Date(byproduct.contract_started).getFullYear()}
            </span>
          </div>
        )}
        {byproduct.latest_flow_kg !== null && byproduct.latest_flow_kg !== undefined && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Latest period</span>
            <span className="font-medium tabular-nums inline-flex items-center gap-1">
              {formatMass(byproduct.latest_flow_kg)}
              {trend !== null && trend !== undefined ? (
                <TrendIcon delta={trend} />
              ) : null}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 1) return <ArrowUp className="h-3 w-3 text-studio-good" aria-label={`+${delta.toFixed(0)}%`} />
  if (delta < -1) return <ArrowDown className="h-3 w-3 text-studio-attention" aria-label={`${delta.toFixed(0)}%`} />
  return <Minus className="h-3 w-3 text-muted-foreground" aria-label="flat" />
}

function formatMass(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg.toFixed(0)} kg`
}
