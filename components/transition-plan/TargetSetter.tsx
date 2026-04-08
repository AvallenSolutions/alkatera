'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import {
  type ReductionTarget,
  SCOPE_LABELS,
  SCOPE_COLOURS,
} from '@/lib/transition-plan/types'

interface TargetSetterProps {
  targets: ReductionTarget[]
  baselineEmissionsTco2e: number | null
  onChange: (targets: ReductionTarget[]) => void
}

function newTarget(): ReductionTarget {
  return {
    id: crypto.randomUUID(),
    scope: 'total',
    targetYear: new Date().getFullYear() + 10,
    reductionPct: 50,
  }
}

export function TargetSetter({ targets, baselineEmissionsTco2e, onChange }: TargetSetterProps) {
  function update(id: string, patch: Partial<ReductionTarget>) {
    onChange(targets.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  function remove(id: string) {
    onChange(targets.filter(t => t.id !== id))
  }

  function add() {
    onChange([...targets, newTarget()])
  }

  return (
    <div className="space-y-4">
      {targets.length === 0 && (
        <p className="text-sm text-stone-500 text-center py-6 border border-dashed border-stone-200 rounded-lg">
          No targets set. Add a reduction target to get started.
        </p>
      )}

      {targets.map(target => {
        const colour = SCOPE_COLOURS[target.scope]
        const absoluteTarget = baselineEmissionsTco2e
          ? baselineEmissionsTco2e * (1 - target.reductionPct / 100)
          : null

        return (
          <div key={target.id} className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-start gap-3">
              {/* Colour dot */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-2"
                style={{ background: colour }}
              />

              <div className="flex-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Scope */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1 block">Scope</label>
                  <Select
                    value={target.scope}
                    onValueChange={v => update(target.id, { scope: v as ReductionTarget['scope'] })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SCOPE_LABELS) as [ReductionTarget['scope'], string][]).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target year */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1 block">Target Year</label>
                  <Input
                    type="number"
                    min={new Date().getFullYear()}
                    max={2100}
                    value={target.targetYear}
                    onChange={e => update(target.id, { targetYear: parseInt(e.target.value) || target.targetYear })}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Reduction % */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1 block">
                    Reduction %
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={target.reductionPct}
                      onChange={e => update(target.id, { reductionPct: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) })}
                      className="h-9 text-sm"
                    />
                    <span className="text-stone-400 text-sm flex-shrink-0">%</span>
                  </div>
                </div>

                {/* Absolute target (derived or manual) */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1 block">
                    Absolute (tCO2e)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder={absoluteTarget !== null ? absoluteTarget.toFixed(0) : 'Optional'}
                    value={target.absoluteTargetTco2e ?? ''}
                    onChange={e => update(target.id, {
                      absoluteTargetTco2e: e.target.value ? parseFloat(e.target.value) : undefined,
                    })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => remove(target.id)}
                className="text-stone-300 hover:text-red-400 transition-colors mt-1 flex-shrink-0"
                aria-label="Remove target"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar visualisation */}
            {baselineEmissionsTco2e && baselineEmissionsTco2e > 0 && (
              <div className="ml-6">
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Baseline: {baselineEmissionsTco2e.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e</span>
                  <span>Target: {((baselineEmissionsTco2e * (1 - target.reductionPct / 100))).toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e by {target.targetYear}</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${100 - target.reductionPct}%`,
                      background: colour,
                    }}
                  />
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {target.reductionPct}% reduction — {target.reductionPct >= 50 ? 'SBTi-compatible trajectory' : 'Below SBTi 1.5°C minimum (50%)'}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="ml-6">
              <Input
                placeholder="Notes (optional)"
                value={target.notes ?? ''}
                onChange={e => update(target.id, { notes: e.target.value || undefined })}
                className="h-8 text-xs text-stone-500"
              />
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full border-dashed">
        <Plus className="w-4 h-4 mr-2" />
        Add Reduction Target
      </Button>
    </div>
  )
}
