'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, AlertCircle, Beer, Package, ClipboardList, Factory, Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Catalogue of Breww data the syncer pulls. Each toggle maps 1:1 to a
 * `kinds` value accepted by /api/integrations/breww/sync — unchecking a
 * tile genuinely skips that phase server-side (see lib/integrations/breww/
 * sync-service.ts `want()` gates).
 */
interface DataType {
  key: 'sites' | 'products' | 'recipes' | 'production' | 'packaging'
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const DATA_TYPES: DataType[] = [
  { key: 'sites', label: 'Sites & facilities', description: "Each Breww site becomes a facility you can map energy and water to.", icon: Factory },
  { key: 'products', label: 'Products (SKUs)', description: 'Your saleable SKUs, ready to attach LCAs to.', icon: Beer },
  { key: 'recipes', label: 'Recipes & ingredients', description: 'Stock items you use in batches, populated as draft ingredients.', icon: ClipboardList },
  { key: 'production', label: 'Production volumes', description: '12 months of brews, kept in sync so per-unit footprints stay live.', icon: Boxes },
  { key: 'packaging', label: 'Packaging types', description: 'Container types Breww uses, mapped to packaging materials.', icon: Package },
]

interface ImportSummary {
  sitesUpserted?: number
  skusUpserted?: number
  ingredientsUpserted?: number
  stockItemsUpserted?: number
  containerTypesUpserted?: number
  packagingRunsUpserted?: number
  batchesFetched?: number
  productsSeen?: number
  totalHl?: number
  // Fields from the materialise step (Breww-as-source-of-truth):
  productsCreated?: number
  productsAlreadyLinked?: number
  droppedWebsiteDrafts?: number
  facilitiesCreated?: number
}

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
  /** Called once the import finishes successfully so the parent can mark
   *  the tile complete. Receives the import summary for storage. */
  onSuccess: (summary: ImportSummary) => void
}

export function BrewwImportDialog({ open, onClose, organizationId, onSuccess }: Props) {
  const [selected, setSelected] = useState<Set<DataType['key']>>(
    new Set(DATA_TYPES.map(d => d.key)),
  )
  const [stage, setStage] = useState<'choose' | 'syncing' | 'done' | 'error'>('choose')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string>('')

  const toggle = (key: DataType['key']) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleClose = () => {
    // While syncing, ignore close attempts so the user doesn't accidentally
    // abandon the in-flight sync.
    if (stage === 'syncing') return
    setStage('choose')
    setSummary(null)
    setError('')
    onClose()
  }

  const handleImport = async () => {
    if (selected.size === 0) {
      setError('Pick at least one thing to import')
      return
    }
    setStage('syncing')
    setError('')
    try {
      // Step 1: pull from Breww into the staging tables. The `kinds` list
      // determines which phases the server runs.
      const syncRes = await fetch('/api/integrations/breww/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, kinds: Array.from(selected) }),
      })
      const syncBody = await syncRes.json().catch(() => ({}))
      if (!syncRes.ok) {
        throw new Error(syncBody?.error || 'Sync failed')
      }

      // Step 2: materialise the staged SKUs into real products and drop
      // anything the website-import step left behind. Breww becomes the
      // authoritative product list. Non-fatal if it stumbles — the sync
      // itself already succeeded.
      let materialise: {
        created?: number
        alreadyLinked?: number
        droppedWebsiteDrafts?: number
        facilitiesCreated?: number
        errors?: string[]
      } = {}
      try {
        const matRes = await fetch('/api/onboarding/breww/materialise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        })
        const matBody = await matRes.json().catch(() => ({}))
        if (matRes.ok) materialise = matBody
      } catch {
        // Swallow — the sync still succeeded; the user can re-run later.
      }

      const merged: ImportSummary = {
        ...(syncBody as ImportSummary),
        productsCreated: materialise.created,
        productsAlreadyLinked: materialise.alreadyLinked,
        droppedWebsiteDrafts: materialise.droppedWebsiteDrafts,
        facilitiesCreated: materialise.facilitiesCreated,
      }
      setSummary(merged)
      setStage('done')
      onSuccess(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      setStage('error')
    }
  }

  const summaryLines = (s: ImportSummary): string[] => {
    const lines: string[] = []
    if (s.sitesUpserted) lines.push(`${s.sitesUpserted} site${s.sitesUpserted === 1 ? '' : 's'}`)
    if (s.facilitiesCreated) {
      lines.push(`${s.facilitiesCreated} facilit${s.facilitiesCreated === 1 ? 'y' : 'ies'} added from Breww sites`)
    }
    if (s.productsCreated) {
      lines.push(`${s.productsCreated} product${s.productsCreated === 1 ? '' : 's'} created from Breww`)
    } else if (s.skusUpserted) {
      lines.push(`${s.skusUpserted} SKU${s.skusUpserted === 1 ? '' : 's'} synced`)
    }
    if (s.droppedWebsiteDrafts) {
      lines.push(`Replaced ${s.droppedWebsiteDrafts} draft product${s.droppedWebsiteDrafts === 1 ? '' : 's'} from your website (Breww wins)`)
    }
    if (s.ingredientsUpserted) lines.push(`${s.ingredientsUpserted} ingredient${s.ingredientsUpserted === 1 ? '' : 's'}`)
    if (s.containerTypesUpserted) lines.push(`${s.containerTypesUpserted} packaging type${s.containerTypesUpserted === 1 ? '' : 's'}`)
    if (s.batchesFetched) lines.push(`${s.batchesFetched} batch${s.batchesFetched === 1 ? '' : 'es'}`)
    if (s.totalHl) lines.push(`${Math.round(s.totalHl).toLocaleString()} hl produced`)
    return lines
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-[#ccff00]" />
            Import your Breww data
          </DialogTitle>
          <DialogDescription>
            {stage === 'choose' && "Choose what to bring across. Everything's selected by default."}
            {stage === 'syncing' && "Reading from Breww and adding to your account..."}
            {stage === 'done' && summary && "Done. Here's what landed."}
            {stage === 'error' && 'Sync failed'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'choose' && (
          <>
            <div className="space-y-2">
              {DATA_TYPES.map(dt => {
                const checked = selected.has(dt.key)
                const Icon = dt.icon
                return (
                  <button
                    key={dt.key}
                    onClick={() => toggle(dt.key)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                      checked
                        ? 'bg-[#ccff00]/10 border-[#ccff00]/40'
                        : 'bg-card border-border hover:bg-muted/40',
                    )}
                  >
                    <div className={cn(
                      'h-5 w-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      checked ? 'bg-[#ccff00] border-[#ccff00]' : 'bg-background border-border',
                    )}>
                      {checked && <CheckCircle2 className="h-3.5 w-3.5 text-black" />}
                    </div>
                    <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', checked ? 'text-[#ccff00]' : 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{dt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{dt.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {error && (
              <p className="text-xs text-red-300 mt-2">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Skip for now</Button>
              <Button
                onClick={handleImport}
                className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
                disabled={selected.size === 0}
              >
                Import {selected.size === DATA_TYPES.length ? 'all' : `${selected.size} of ${DATA_TYPES.length}`}
              </Button>
            </div>
          </>
        )}

        {stage === 'syncing' && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#ccff00]" />
            <p className="text-sm text-muted-foreground">
              This usually takes 10-30 seconds depending on how many batches you have.
            </p>
          </div>
        )}

        {stage === 'done' && summary && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div className="space-y-1">
              {summaryLines(summary).length > 0 ? (
                summaryLines(summary).map((line, i) => (
                  <p key={i} className="text-sm text-foreground">{line}</p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to import — your Breww account is empty.</p>
              )}
            </div>
            <Button onClick={handleClose} className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 mt-2">
              Continue onboarding
            </Button>
          </div>
        )}

        {stage === 'error' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm font-medium text-red-300 break-words">{error}</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => { setStage('choose'); setError('') }} className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90">
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
