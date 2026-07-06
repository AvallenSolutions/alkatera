'use client'

/**
 * Gallery view of an organisation's nature-positive actions. Each card
 * shows the action type, partner, hectares, status, and a click-through
 * to the drawer where flow history can be reviewed and new entries logged.
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StateChip } from '@/components/studio/state-chip'
import type { WorkingTone } from '@/components/studio/theme'
import {
  getActionTypeMeta,
  type NatureActionType,
} from '@/lib/nature-actions/action-types'
import { NatureActionCreateDialog } from './NatureActionCreateDialog'
import { NatureActionDrawer } from './NatureActionDrawer'

export interface NatureAction {
  id: string
  name: string
  description: string | null
  action_type: NatureActionType
  hectares: number
  partner_name: string | null
  partner_url: string | null
  location: string | null
  contract_started: string | null
  status: 'planned' | 'in_progress' | 'established' | 'paused' | 'ended'
  visibility: 'private' | 'platform' | 'public'
  facility_id: string | null
  created_at: string
  updated_at: string | null
  latest_flow_ha?: number | null
}

const STATUS_COPY: Record<NatureAction['status'], { label: string; tone: WorkingTone }> = {
  planned: { label: 'Planned', tone: 'hold' },
  in_progress: { label: 'In progress', tone: 'good' },
  established: { label: 'Established', tone: 'good' },
  paused: { label: 'Paused', tone: 'attention' },
  ended: { label: 'Historical', tone: 'quiet' },
}

export function NatureActionsGallery() {
  const [actions, setActions] = useState<NatureAction[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [drawerAction, setDrawerAction] = useState<NatureAction | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/nature-actions?status=${statusFilter}`, { credentials: 'include' })
      if (!res.ok) {
        setActions([])
        return
      }
      const json = await res.json()
      const items = Array.isArray(json?.actions) ? (json.actions as NatureAction[]) : []
      const enriched = await Promise.all(
        items.map(async (a) => {
          try {
            const fr = await fetch(`/api/nature-actions/${a.id}/flows`, { credentials: 'include' })
            if (!fr.ok) return a
            const fj = await fr.json()
            const latest = fj?.flows?.[0]?.hectares_active ?? null
            return { ...a, latest_flow_ha: latest !== null ? Number(latest) : null }
          } catch {
            return a
          }
        }),
      )
      setActions(enriched)
    } catch {
      setActions([])
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const empty = actions !== null && actions.length === 0

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
          Add action
        </Button>
      </div>

      {actions === null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-[6px]" />
          ))}
        </div>
      )}

      {empty && (
        <div className="rounded-[6px] border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No nature-positive actions logged yet. Register a regenerative-ag, restoration, or
            habitat-creation partnership and the platform will start tracking it as part of your
            Nature score.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add your first action
          </Button>
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((a) => (
            <ActionCard key={a.id} action={a} onClick={() => setDrawerAction(a)} />
          ))}
        </div>
      )}

      <NatureActionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false)
          void load()
        }}
      />
      <NatureActionDrawer
        action={drawerAction}
        onClose={() => setDrawerAction(null)}
        onChanged={() => {
          void load()
        }}
      />
    </div>
  )
}

function ActionCard({ action, onClick }: { action: NatureAction; onClick: () => void }) {
  const meta = getActionTypeMeta(action.action_type)
  const statusCopy = STATUS_COPY[action.status]
  const ha = action.latest_flow_ha ?? action.hectares

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[6px] border border-border bg-card p-4 hover:bg-secondary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-studio-cobalt"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl leading-none">{meta?.emoji ?? '🌿'}</span>
          <div className="min-w-0">
            <p className="font-semibold truncate">{action.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {meta?.label ?? action.action_type}
            </p>
          </div>
        </div>
        <StateChip tone={statusCopy.tone}>{statusCopy.label}</StateChip>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        {action.partner_name && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Partner</span>
            <span className="font-medium truncate max-w-[160px]">
              {action.partner_url ? (
                <a
                  href={action.partner_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {action.partner_name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                action.partner_name
              )}
            </span>
          </div>
        )}
        {action.location && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Location</span>
            <span className="truncate max-w-[160px]">{action.location}</span>
          </div>
        )}
        {action.contract_started && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Since</span>
            <span className="tabular-nums">
              {new Date(action.contract_started).getFullYear()}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 mt-1.5">
          <span className="text-muted-foreground">Hectares</span>
          <span className="font-medium tabular-nums">{formatHa(ha)}</span>
        </div>
      </div>
    </button>
  )
}

function formatHa(ha: number): string {
  if (ha >= 100) return `${ha.toFixed(0)} ha`
  if (ha >= 10) return `${ha.toFixed(1)} ha`
  return `${ha.toFixed(2)} ha`
}
