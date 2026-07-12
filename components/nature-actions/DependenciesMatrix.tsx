'use client'

/**
 * Matrix view of an org's ENCORE-aligned ecosystem-service dependencies.
 * One card per dependency, grouped by category. Each card has a
 * materiality dropdown + optional notes field. Drinks-material
 * dependencies are surfaced first.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { StateChip } from '@/components/studio/state-chip'
import { Eyebrow } from '@/components/studio/eyebrow'
import type { WorkingTone } from '@/components/studio/theme'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  NATURE_DEPENDENCIES,
  DRINKS_MATERIAL_DEPENDENCIES,
  type NatureDependencyType,
  type Materiality,
} from '@/lib/nature-context/dependency-types'

interface DeclaredDependency {
  dependency_type: NatureDependencyType
  materiality: Materiality
  notes: string | null
}

/** Materiality → working tone: states are typographic, never decoration. */
const MATERIALITY_TONE: Record<Materiality | 'undeclared', WorkingTone> = {
  undeclared: 'quiet',
  low: 'good',
  medium: 'attention',
  high: 'stale',
  critical: 'stale',
}

const CATEGORY_LABEL: Record<'provisioning' | 'regulating_maintenance' | 'cultural', string> = {
  provisioning: 'Provisioning services',
  regulating_maintenance: 'Regulating & maintenance services',
  cultural: 'Cultural services',
}

export function DependenciesMatrix() {
  const [declared, setDeclared] = useState<Map<NatureDependencyType, DeclaredDependency> | null>(null)
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({})
  const [savingType, setSavingType] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nature-dependencies', { credentials: 'include' })
      if (!res.ok) {
        setDeclared(new Map())
        return
      }
      const json = await res.json()
      const map = new Map<NatureDependencyType, DeclaredDependency>()
      for (const d of json?.dependencies ?? []) {
        map.set(d.dependency_type, d)
      }
      setDeclared(map)
    } catch {
      setDeclared(new Map())
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const upsert = useCallback(async (
    type: NatureDependencyType,
    materiality: Materiality,
    notes?: string,
  ) => {
    setSavingType(type)
    try {
      await fetch('/api/nature-dependencies', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependency_type: type, materiality, notes }),
      })
      await load()
    } finally {
      setSavingType(null)
    }
  }, [load])

  const remove = useCallback(async (type: NatureDependencyType) => {
    setSavingType(type)
    try {
      await fetch(`/api/nature-dependencies?type=${encodeURIComponent(type)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await load()
    } finally {
      setSavingType(null)
    }
  }, [load])

  const grouped = useMemo(() => {
    const sorted = [...NATURE_DEPENDENCIES].sort((a, b) => {
      // Drinks-material first, then by category, then by label
      if (a.drinks_material !== b.drinks_material) {
        return a.drinks_material ? -1 : 1
      }
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.label.localeCompare(b.label)
    })
    const groups: Record<string, typeof NATURE_DEPENDENCIES> = {
      provisioning: [],
      regulating_maintenance: [],
      cultural: [],
    }
    for (const d of sorted) groups[d.category].push(d)
    return groups
  }, [])

  if (declared === null) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 w-full animate-pulse rounded-[6px] bg-studio-cream" />
        ))}
      </div>
    )
  }

  const declaredCount = declared.size
  const materialDeclared = DRINKS_MATERIAL_DEPENDENCIES.filter(t => declared.has(t)).length
  const coveragePct = Math.round(
    (materialDeclared / DRINKS_MATERIAL_DEPENDENCIES.length) * 100,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-[6px] border border-studio-hairline bg-studio-cream p-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            Coverage of drinks-material dependencies
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{coveragePct}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{declaredCount} declared in total</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim tabular-nums">
            {materialDeclared} of {DRINKS_MATERIAL_DEPENDENCIES.length} sector-material
          </p>
        </div>
      </div>

      {(['provisioning', 'regulating_maintenance', 'cultural'] as const).map(category => {
        const items = grouped[category]
        if (items.length === 0) return null
        return (
          <div key={category}>
            <Eyebrow tone="dim" className="mb-2">
              {CATEGORY_LABEL[category]}
            </Eyebrow>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map(dep => {
                const current = declared.get(dep.value)
                const tone = current?.materiality
                  ? MATERIALITY_TONE[current.materiality]
                  : MATERIALITY_TONE.undeclared
                const noteValue = pendingNotes[dep.value] ?? current?.notes ?? ''
                return (
                  <div key={dep.value} className="rounded-[6px] border border-studio-hairline bg-studio-cream p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <p className="font-display text-sm font-semibold">{dep.label}</p>
                          {dep.drinks_material && (
                            <StateChip tone="quiet">Drinks-material</StateChip>
                          )}
                          <StateChip tone={tone}>
                            {current?.materiality ?? 'undeclared'}
                          </StateChip>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dep.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={current?.materiality ?? ''}
                        onValueChange={(v) =>
                          v ? upsert(dep.value, v as Materiality, current?.notes ?? undefined) : remove(dep.value)
                        }
                        disabled={savingType === dep.value}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Set materiality" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      {current?.materiality && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] h-8"
                          onClick={() => remove(dep.value)}
                          disabled={savingType === dep.value}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {current?.materiality &&
                      (current.materiality === 'high' || current.materiality === 'critical') && (
                        <Textarea
                          value={noteValue}
                          onChange={(e) =>
                            setPendingNotes(p => ({ ...p, [dep.value]: e.target.value }))
                          }
                          onBlur={() => {
                            if (noteValue !== (current.notes ?? '')) {
                              void upsert(dep.value, current.materiality, noteValue)
                            }
                          }}
                          placeholder="Why is this material? Notes increase your disclosure depth score."
                          rows={2}
                          className="text-xs"
                        />
                      )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
