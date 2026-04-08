'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, CheckCircle2, Circle, Clock } from 'lucide-react'
import {
  type TransitionMilestone,
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_COLOURS,
} from '@/lib/transition-plan/types'

interface OperationalEvent {
  id: string
  description: string
  event_date: string
}

interface MilestoneTimelineProps {
  milestones: TransitionMilestone[]
  operationalEvents?: OperationalEvent[]
  onChange: (milestones: TransitionMilestone[]) => void
}

const STATUS_ICONS = {
  not_started: Circle,
  in_progress: Clock,
  complete: CheckCircle2,
}

function newMilestone(): TransitionMilestone {
  const nextYear = new Date().getFullYear() + 1
  return {
    id: crypto.randomUUID(),
    title: '',
    targetDate: `${nextYear}-12-31`,
    status: 'not_started',
  }
}

export function MilestoneTimeline({ milestones, operationalEvents = [], onChange }: MilestoneTimelineProps) {
  const sorted = [...milestones].sort((a, b) => a.targetDate.localeCompare(b.targetDate))

  function update(id: string, patch: Partial<TransitionMilestone>) {
    onChange(milestones.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function remove(id: string) {
    onChange(milestones.filter(m => m.id !== id))
  }

  function add() {
    onChange([...milestones, newMilestone()])
  }

  return (
    <div className="space-y-4">
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
          No milestones added. Define the key actions that will drive your decarbonisation.
        </p>
      )}

      {/* Timeline */}
      {sorted.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-5 bottom-5 w-px bg-border" />

          <div className="space-y-3">
            {sorted.map((milestone, _index) => {
              const StatusIcon = STATUS_ICONS[milestone.status]
              const statusColour = MILESTONE_STATUS_COLOURS[milestone.status]

              return (
                <div key={milestone.id} className="relative pl-11">
                  {/* Status dot */}
                  <div
                    className="absolute left-2 top-3 w-5 h-5 rounded-full flex items-center justify-center bg-card border-2 z-10"
                    style={{ borderColor: statusColour }}
                  >
                    <StatusIcon className="w-3 h-3" style={{ color: statusColour }} />
                  </div>

                  <div className="border border-border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {/* Title */}
                        <div className="sm:col-span-2">
                          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Milestone</label>
                          <Input
                            placeholder="e.g. Switch to 100% renewable electricity"
                            value={milestone.title}
                            onChange={e => update(milestone.id, { title: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>

                        {/* Target date */}
                        <div>
                          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Target Date</label>
                          <Input
                            type="date"
                            value={milestone.targetDate}
                            onChange={e => update(milestone.id, { targetDate: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(milestone.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors mt-1 flex-shrink-0"
                        aria-label="Remove milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {/* Status */}
                      <div>
                        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Status</label>
                        <Select
                          value={milestone.status}
                          onValueChange={v => update(milestone.id, { status: v as TransitionMilestone['status'] })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(MILESTONE_STATUS_LABELS) as [TransitionMilestone['status'], string][]).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expected emissions impact */}
                      <div>
                        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
                          Impact (tCO2e)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Optional"
                          value={milestone.emissionsImpactTco2e ?? ''}
                          onChange={e => update(milestone.id, {
                            emissionsImpactTco2e: e.target.value ? parseFloat(e.target.value) : undefined,
                          })}
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Link to operational event */}
                      {operationalEvents.length > 0 && (
                        <div className="col-span-2">
                          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
                            Link to logged action
                          </label>
                          <Select
                            value={milestone.linkedEventId ?? 'none'}
                            onValueChange={v => update(milestone.id, { linkedEventId: v === 'none' ? undefined : v })}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {operationalEvents.map(e => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.description.substring(0, 60)}{e.description.length > 60 ? '...' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <Input
                      placeholder="Notes (optional)"
                      value={milestone.notes ?? ''}
                      onChange={e => update(milestone.id, { notes: e.target.value || undefined })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full border-dashed">
        <Plus className="w-4 h-4 mr-2" />
        Add Milestone
      </Button>

      {/* Summary bar */}
      {sorted.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground pt-1">
          {(['not_started', 'in_progress', 'complete'] as TransitionMilestone['status'][]).map(s => {
            const count = sorted.filter(m => m.status === s).length
            if (count === 0) return null
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: MILESTONE_STATUS_COLOURS[s] }}
                />
                <span>{count} {MILESTONE_STATUS_LABELS[s]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
