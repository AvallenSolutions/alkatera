'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Plus, Search } from 'lucide-react'

export interface LinkPickerEntity {
  id: string
  name: string
  secondary?: string
}

interface LinkPickerProps<T extends LinkPickerEntity> {
  open: boolean
  title: string
  description?: React.ReactNode
  sourceLabel: string
  sourceName: string
  sourceDetails?: { label: string; value: string | null | undefined }[]
  entities: T[]
  entityLabel: string
  emptyHint?: string
  createLabel?: string
  onCreate?: () => void
  onPick: (entity: T) => Promise<void> | void
  onClose: () => void
}

// Reusable "pick from a list of alkatera entities" modal.
// Used by the Breww data page for SKU to product and site to facility linking
// so both flows look and feel the same.
export function LinkPicker<T extends LinkPickerEntity>({
  open,
  title,
  description,
  sourceLabel,
  sourceName,
  sourceDetails,
  entities,
  entityLabel,
  emptyHint,
  createLabel,
  onCreate,
  onPick,
  onClose,
}: LinkPickerProps<T>) {
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSaving(false)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entities
    return entities.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      (e.secondary && e.secondary.toLowerCase().includes(q))
    )
  }, [query, entities])

  const handlePick = async (entity: T) => {
    if (saving) return
    setSaving(true)
    try {
      await onPick(entity)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving && !next) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Source entity summary */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {sourceLabel}
          </div>
          <div className="font-medium mt-0.5">{sourceName}</div>
          {sourceDetails && sourceDetails.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs">
              {sourceDetails.map((d) =>
                d.value ? (
                  <div key={d.label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-medium truncate">{d.value}</span>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search your ${entityLabel}s...`}
            className="h-9 pl-8 text-sm"
            disabled={saving}
          />
        </div>

        {/* Results list */}
        <div className="rounded-lg border max-h-[260px] overflow-y-auto">
          {entities.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {emptyHint || `No ${entityLabel}s yet.`}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No {entityLabel}s match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handlePick(e)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 disabled:opacity-50 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      {e.secondary && (
                        <div className="text-[11px] text-muted-foreground truncate">{e.secondary}</div>
                      )}
                    </div>
                    <Check className="h-3.5 w-3.5 text-muted-foreground opacity-0 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Create fallback */}
        {onCreate && createLabel && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (saving) return
              onCreate()
              onClose()
            }}
            className="flex items-center gap-2 text-xs text-[#8da300] dark:text-[#ccff00] hover:underline disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {createLabel}
          </button>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pr-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Linking...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Quick badge helper for "already linked" summaries elsewhere.
export function LinkedBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 gap-1 text-[10px]">
      <Check className="h-3 w-3" />
      {label}
    </Badge>
  )
}
