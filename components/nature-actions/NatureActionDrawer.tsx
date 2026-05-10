'use client'

/**
 * Side drawer for a nature-positive action: hectares-active history,
 * log new flow, end the partnership (soft-delete).
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
import { getActionTypeMeta } from '@/lib/nature-actions/action-types'
import type { NatureAction } from './NatureActionsGallery'

interface Flow {
  id: string
  reporting_period_start: string
  reporting_period_end: string
  hectares_active: number
  notes: string | null
  created_at: string
}

interface Props {
  action: NatureAction | null
  onClose: () => void
  onChanged: () => void
}

export function NatureActionDrawer({ action, onClose, onChanged }: Props) {
  const [flows, setFlows] = useState<Flow[] | null>(null)
  const [logging, setLogging] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [hectaresActive, setHectaresActive] = useState('')
  const [notes, setNotes] = useState('')
  const [logError, setLogError] = useState<string | null>(null)

  const loadFlows = useCallback(async () => {
    if (!action) return
    try {
      const res = await fetch(`/api/nature-actions/${action.id}/flows`, { credentials: 'include' })
      if (!res.ok) {
        setFlows([])
        return
      }
      const json = await res.json()
      setFlows(Array.isArray(json?.flows) ? json.flows : [])
    } catch {
      setFlows([])
    }
  }, [action])

  useEffect(() => {
    if (action) {
      setFlows(null)
      setLogging(false)
      setPeriodStart('')
      setPeriodEnd('')
      setHectaresActive('')
      setNotes('')
      setLogError(null)
      void loadFlows()
    }
  }, [action, loadFlows])

  const submitFlow = async () => {
    if (!action) return
    setLogError(null)
    const ha = Number(hectaresActive)
    if (!Number.isFinite(ha) || ha < 0) {
      setLogError('Hectares must be a non-negative number.')
      return
    }
    if (!periodStart || !periodEnd) {
      setLogError('Pick a reporting period.')
      return
    }
    try {
      const res = await fetch(`/api/nature-actions/${action.id}/flows`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          hectares_active: ha,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setLogError(j?.error ?? 'Could not save')
        return
      }
      setLogging(false)
      setHectaresActive('')
      setNotes('')
      setPeriodStart('')
      setPeriodEnd('')
      await loadFlows()
      onChanged()
    } catch (e: any) {
      setLogError(e?.message ?? 'Could not save')
    }
  }

  const endPartnership = async () => {
    if (!action) return
    const ok = window.confirm(
      'End this action? Hectares logged will be preserved as historical context.',
    )
    if (!ok) return
    try {
      const res = await fetch(`/api/nature-actions/${action.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        onChanged()
        onClose()
      }
    } catch {}
  }

  if (!action) return null
  const meta = getActionTypeMeta(action.action_type)

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[480px] sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl leading-none">{meta?.emoji ?? '🌿'}</span>
            {action.name}
          </SheetTitle>
          <SheetDescription>
            {meta?.label}
            {action.partner_name ? ' · ' + action.partner_name : ''}
            {action.location ? ' · ' + action.location : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {action.partner_url && (
            <a
              href={action.partner_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs inline-flex items-center gap-1 text-blue-300 hover:underline"
            >
              {action.partner_url}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {action.description && (
            <p className="text-sm text-muted-foreground">{action.description}</p>
          )}

          <div className="rounded-lg border border-border p-3 bg-card flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Declared hectares</span>
            <span className="font-semibold tabular-nums">{action.hectares.toFixed(2)} ha</span>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Activity log</h3>
              {!logging && action.status !== 'ended' && (
                <Button size="sm" onClick={() => setLogging(true)}>
                  Log activity
                </Button>
              )}
            </div>

            {logging && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="naf-start">From</Label>
                    <Input
                      id="naf-start"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="naf-end">To</Label>
                    <Input
                      id="naf-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="naf-ha">Hectares actively delivering</Label>
                  <Input
                    id="naf-ha"
                    type="number"
                    inputMode="decimal"
                    placeholder="50"
                    value={hectaresActive}
                    onChange={(e) => setHectaresActive(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="naf-notes">Notes (optional)</Label>
                  <Textarea
                    id="naf-notes"
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
                    Save
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
              <p className="text-xs text-muted-foreground">No activity logged yet.</p>
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
                    <span className="font-semibold tabular-nums">{f.hectares_active.toFixed(2)} ha</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {action.status !== 'ended' && (
            <div className="border-t pt-4">
              <Button variant="ghost" size="sm" onClick={endPartnership}>
                End this action
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">
                History stays in your Nature score so previous progress is preserved.
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
