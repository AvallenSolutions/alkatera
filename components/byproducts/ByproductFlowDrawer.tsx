'use client'

/**
 * Side drawer that opens when a byproduct card is clicked. Shows the full
 * flow history, lets the user log a new mass entry, and exposes a soft-delete
 * (status='ended') control. Edits to other fields can be added later; this
 * keeps the surface focused on the most common ops.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink } from 'lucide-react'
import { getDestinationMeta } from '@/lib/byproducts/destination-types'
import type { Byproduct } from './ByproductsGallery'

interface Flow {
  id: string
  reporting_period_start: string
  reporting_period_end: string
  mass_kg: number
  unit: string
  notes: string | null
  created_at: string
}

interface Props {
  byproduct: Byproduct | null
  onClose: () => void
  onChanged: () => void
}

export function ByproductFlowDrawer({ byproduct, onClose, onChanged }: Props) {
  const [flows, setFlows] = useState<Flow[] | null>(null)
  const [logging, setLogging] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [massKg, setMassKg] = useState('')
  const [notes, setNotes] = useState('')
  const [logError, setLogError] = useState<string | null>(null)

  const loadFlows = useCallback(async () => {
    if (!byproduct) return
    try {
      const res = await fetch(`/api/byproducts/${byproduct.id}/flows`, { credentials: 'include' })
      if (!res.ok) {
        setFlows([])
        return
      }
      const json = await res.json()
      setFlows(Array.isArray(json?.flows) ? json.flows : [])
    } catch {
      setFlows([])
    }
  }, [byproduct])

  useEffect(() => {
    if (byproduct) {
      setFlows(null)
      setLogging(false)
      setPeriodStart('')
      setPeriodEnd('')
      setMassKg('')
      setNotes('')
      setLogError(null)
      void loadFlows()
    }
  }, [byproduct, loadFlows])

  const submitFlow = async () => {
    if (!byproduct) return
    setLogError(null)
    const mass = Number(massKg)
    if (!Number.isFinite(mass) || mass <= 0) {
      setLogError('Mass must be a positive number.')
      return
    }
    if (!periodStart || !periodEnd) {
      setLogError('Pick a reporting period.')
      return
    }
    try {
      const res = await fetch(`/api/byproducts/${byproduct.id}/flows`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          mass_kg: mass,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setLogError(j?.error ?? 'Could not save the flow')
        return
      }
      setLogging(false)
      setMassKg('')
      setNotes('')
      setPeriodStart('')
      setPeriodEnd('')
      await loadFlows()
      onChanged()
    } catch (e: any) {
      setLogError(e?.message ?? 'Could not save the flow')
    }
  }

  const endPartnership = async () => {
    if (!byproduct) return
    const ok = window.confirm(
      'End this partnership? Past flows will be preserved as historical context.',
    )
    if (!ok) return
    try {
      const res = await fetch(`/api/byproducts/${byproduct.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        onChanged()
        onClose()
      }
    } catch {
      /* swallow */
    }
  }

  if (!byproduct) return null
  const meta = getDestinationMeta(byproduct.destination_type)

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[480px] sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl leading-none">{meta?.emoji ?? '📦'}</span>
            {byproduct.name}
          </SheetTitle>
          <SheetDescription>
            {meta?.label}
            {byproduct.partner_name ? ' · ' + byproduct.partner_name : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {byproduct.partner_url && (
            <a
              href={byproduct.partner_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs inline-flex items-center gap-1 text-blue-300 hover:underline"
            >
              {byproduct.partner_url}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {byproduct.description && (
            <p className="text-sm text-muted-foreground">{byproduct.description}</p>
          )}

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Flow history</h3>
              {!logging && byproduct.status !== 'ended' && (
                <Button size="sm" onClick={() => setLogging(true)}>
                  Log a flow
                </Button>
              )}
            </div>

            {logging && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="flow-start">From</Label>
                    <Input
                      id="flow-start"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="flow-end">To</Label>
                    <Input
                      id="flow-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flow-mass">Mass (kg)</Label>
                  <Input
                    id="flow-mass"
                    type="number"
                    inputMode="decimal"
                    placeholder="12000"
                    value={massKg}
                    onChange={(e) => setMassKg(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flow-notes">Notes (optional)</Label>
                  <Textarea
                    id="flow-notes"
                    rows={2}
                    placeholder=""
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                {logError && <p className="text-xs text-destructive">{logError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setLogging(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitFlow}>
                    Save flow
                  </Button>
                </div>
              </div>
            )}

            {flows === null ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : flows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No flows logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {flows.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-lg border border-border p-3 bg-card flex items-center justify-between"
                  >
                    <div className="text-xs">
                      <p className="font-medium">
                        {formatPeriod(f.reporting_period_start, f.reporting_period_end)}
                      </p>
                      {f.notes && (
                        <p className="text-muted-foreground mt-0.5 truncate max-w-[260px]">
                          {f.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums">{formatMass(f.mass_kg)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {byproduct.status !== 'ended' && (
            <div className="border-t pt-4">
              <Button variant="ghost" size="sm" onClick={endPartnership}>
                End this partnership
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">
                History stays in your circularity score so previous progress is preserved.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()
  if (sameMonth) {
    return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return `${s.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} → ${e.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
}

function formatMass(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg.toFixed(0)} kg`
}
