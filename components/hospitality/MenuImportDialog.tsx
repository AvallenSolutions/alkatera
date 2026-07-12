'use client'

/**
 * Bulk import meals/drinks (and optionally a menu) from a spreadsheet, PDF or
 * photo of a menu. Two steps: upload → review & edit → commit.
 *
 * Names only: we capture dish/drink names and any ingredient names the menu
 * lists, but never quantities. Imported recipes show no impact until the user
 * adds quantities per dish in the recipe editor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, Sparkles, Trash2, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'

const NO_VENUE = '__none__'

type ItemKind = 'meal' | 'drink'

interface ReviewRow {
  key: string
  name: string
  kind: ItemKind
  ingredients: string // comma-separated, edited as free text
}

let rowSeq = 0
function toRow(item: { name: string; kind: ItemKind; ingredients: string[] }): ReviewRow {
  rowSeq += 1
  return {
    key: `imp-${rowSeq}`,
    name: item.name,
    kind: item.kind,
    ingredients: item.ingredients.join(', '),
  }
}

export function MenuImportDialog({
  open,
  onOpenChange,
  onComplete,
  lockKind,
  initialStashId,
  onStashConsumed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (result: { created: number; menuId?: string }) => void
  /** When set, all items are forced to this kind and the menu toggle is hidden. */
  lockKind?: ItemKind
  /** When set, the dialog auto-loads this stashed file (from Smart Upload) on open. */
  initialStashId?: string | null
  /** Called once the stashed file has been consumed, so the parent can clear the URL param. */
  onStashConsumed?: () => void
}) {
  const { toast } = useToast()
  const { venues } = useHospitalityVenues()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stashLoadedRef = useRef<string | null>(null)

  const [phase, setPhase] = useState<'upload' | 'review'>('upload')
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [rows, setRows] = useState<ReviewRow[]>([])
  const [menuName, setMenuName] = useState('')
  const [createMenu, setCreateMenu] = useState(!lockKind)
  const [venueId, setVenueId] = useState<string>(NO_VENUE)
  const [committing, setCommitting] = useState(false)

  const reset = useCallback(() => {
    setPhase('upload')
    setExtracting(false)
    setError(null)
    setDragOver(false)
    setRows([])
    setMenuName('')
    setCreateMenu(!lockKind)
    setVenueId(NO_VENUE)
    setCommitting(false)
  }, [lockKind])

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const extract = useCallback(
    async (file: File) => {
      setExtracting(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/hospitality/menus/import', {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Could not read the menu.')
        const items = (body.items ?? []).map((it: any) =>
          toRow({
            name: String(it.name ?? ''),
            kind: lockKind ?? (it.kind === 'drink' ? 'drink' : 'meal'),
            ingredients: Array.isArray(it.ingredients) ? it.ingredients.map(String) : [],
          }),
        )
        if (items.length === 0) throw new Error('No meals or drinks found in that file.')
        setRows(items)
        setMenuName(String(body.menu_name ?? '').trim())
        setPhase('review')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not read the menu.')
      } finally {
        setExtracting(false)
      }
    },
    [lockKind],
  )

  // Smart Upload handoff: when opened with a stashed file, fetch and extract it.
  useEffect(() => {
    if (!open || !initialStashId) return
    if (stashLoadedRef.current === initialStashId) return
    stashLoadedRef.current = initialStashId
    let cancelled = false
    ;(async () => {
      setExtracting(true)
      setError(null)
      try {
        const meta = await fetch(`/api/ingest/stash?path=${encodeURIComponent(initialStashId)}`, { credentials: 'include' })
        const metaBody = await meta.json().catch(() => ({}))
        if (!meta.ok) throw new Error(metaBody?.error || 'Could not load the uploaded file.')
        const fileRes = await fetch(metaBody.signedUrl)
        const blob = await fileRes.blob()
        const file = new File([blob], metaBody.fileName || 'menu', { type: blob.type })
        if (!cancelled) await extract(file)
        // Best-effort cleanup of the stash entry.
        void fetch(`/api/ingest/stash?path=${encodeURIComponent(initialStashId)}`, { method: 'DELETE', credentials: 'include' })
        onStashConsumed?.()
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the uploaded file.')
        setExtracting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, initialStashId, extract, onStashConsumed])

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) extract(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) extract(file)
  }

  const updateRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  const commit = async () => {
    const items = rows
      .map((r) => ({
        name: r.name.trim(),
        kind: r.kind,
        ingredients: r.ingredients
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((r) => r.name.length > 0)
    if (items.length === 0) {
      setError('Add at least one item with a name.')
      return
    }
    setCommitting(true)
    setError(null)
    try {
      const res = await fetch('/api/hospitality/menus/import/commit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          create_menu: createMenu && !lockKind,
          menu_name: menuName.trim() || undefined,
          venue_id: venueId === NO_VENUE ? null : venueId,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not import.')
      const created = Number(body.created ?? 0)
      toast({
        title: `Imported ${created} ${created === 1 ? 'item' : 'items'}`,
        description: 'Open "Fill in quantities" to set real amounts, then calculate each footprint.',
      })
      handleOpenChange(false)
      onComplete({ created, menuId: body.menu_id })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not import.')
    } finally {
      setCommitting(false)
    }
  }

  const noun = lockKind ? `${lockKind}s` : 'menu'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from a {lockKind ? 'list' : 'menu'}</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet, PDF or photo of your {noun} and we&apos;ll create the{' '}
            {lockKind ? `${lockKind}s` : 'meals and drinks'} for you. You add quantities to each dish
            afterwards to calculate its impact.
          </DialogDescription>
        </DialogHeader>

        {phase === 'upload' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              disabled={extracting}
              className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              {extracting ? (
                <>
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                  <p className="font-medium">Reading your menu…</p>
                  <p className="text-sm text-muted-foreground">This usually takes a few seconds.</p>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Drop a file here or click to choose</p>
                  <p className="text-sm text-muted-foreground">PDF, photo (JPEG/PNG/WebP) or spreadsheet (XLSX/CSV)</p>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onPick}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Found {rows.length} {rows.length === 1 ? 'item' : 'items'}. Review and edit, then import.
            </div>

            <ScrollArea className="max-h-[40vh] pr-3">
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr,7rem,1fr,2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Ingredients (optional)</span>
                  <span />
                </div>
                {rows.map((row) => (
                  <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,7rem,1fr,2.5rem]">
                    <Input
                      value={row.name}
                      placeholder="Item name"
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                    />
                    {lockKind ? (
                      <div className="flex items-center px-2 text-sm capitalize text-muted-foreground">{row.kind}</div>
                    ) : (
                      <Select value={row.kind} onValueChange={(v) => updateRow(row.key, { kind: v as ItemKind })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meal">Meal</SelectItem>
                          <SelectItem value="drink">Drink</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={row.ingredients}
                      placeholder="e.g. Gin, Campari, vermouth"
                      onChange={(e) => updateRow(row.key, { ingredients: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeRow(row.key)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!lockKind && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="import-create-menu" className="text-sm font-medium">
                      Create a menu from these items
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Off to just add the meals and drinks without a menu.
                    </p>
                  </div>
                  <Switch id="import-create-menu" checked={createMenu} onCheckedChange={setCreateMenu} />
                </div>
                {createMenu && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="import-menu-name">Menu name</Label>
                      <Input
                        id="import-menu-name"
                        placeholder="Autumn dinner menu"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="import-venue">Venue (optional)</Label>
                      <Select value={venueId} onValueChange={setVenueId}>
                        <SelectTrigger id="import-venue">
                          <SelectValue placeholder="No venue" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_VENUE}>No venue</SelectItem>
                          {venues.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              We capture names only. Each ingredient is added with a placeholder amount to adjust. Open every dish
              afterwards to set real quantities, then calculate its footprint.
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {phase === 'review' && (
            <Button variant="ghost" onClick={reset} disabled={committing}>
              Choose a different file
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={committing}>
            Cancel
          </Button>
          {phase === 'review' && (
            <Button onClick={commit} disabled={committing || rows.length === 0}>
              {committing ? 'Importing…' : `Import ${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
