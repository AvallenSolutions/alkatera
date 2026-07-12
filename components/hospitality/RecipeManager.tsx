'use client'

/**
 * Management surface for hospitality recipes (meals or made-drinks): studio
 * grammar. Lists recipes as quiet fact rows with per-portion impact and lets
 * you create one (which then opens the recipe editor to add ingredients and
 * calculate). Generic over the recipe kind so Meals and Drinks share one
 * component.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Statement } from '@/components/studio/statement'
import { BigNumber } from '@/components/studio/big-number'
import { PillButton } from '@/components/studio/pill-button'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { useToast } from '@/hooks/use-toast'
import { useHospitalityRecipes } from '@/hooks/data/useHospitalityRecipes'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'
import { MenuImportDialog } from '@/components/hospitality/MenuImportDialog'
import type { HospitalityMealListItem } from '@/lib/hospitality/meal-types'
import type { RecipeKindConfig } from '@/lib/hospitality/recipe-kinds'

const NO_VENUE = '__none__'

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits })
}

export function RecipeManager({ cfg }: { cfg: RecipeKindConfig }) {
  const router = useRouter()
  const { recipes, isLoading, error, refresh, createRecipe, deleteRecipe } = useHospitalityRecipes(cfg)
  const { venues } = useHospitalityVenues()
  const { toast } = useToast()

  const portion = cfg.portionWord
  const lc = cfg.label.toLowerCase()
  // Import only applies to meals and drinks (rooms reuse this component).
  const canImport = cfg.kind === 'meal' || cfg.kind === 'drink'

  const [importOpen, setImportOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [venueId, setVenueId] = useState<string>(NO_VENUE)
  const [covers, setCovers] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HospitalityMealListItem | null>(null)

  const openCreate = () => {
    setName('')
    setVenueId(NO_VENUE)
    setCovers(cfg.kind === 'drink' ? '1' : '1')
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) {
      setFormError(`Give the ${lc} a name.`)
      return
    }
    const coversNum = Number(covers)
    if (!Number.isFinite(coversNum) || coversNum <= 0) {
      setFormError(`${portion[0].toUpperCase()}${portion.slice(1)}s must be a number greater than 0.`)
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const recipe = await createRecipe({
        name: name.trim(),
        venue_id: venueId === NO_VENUE ? null : venueId,
        covers: coversNum,
      })
      setDialogOpen(false)
      router.push(`${cfg.basePath}/${recipe.id}`)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : `Could not create ${lc}`)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteRecipe(pendingDelete.id)
      toast({ title: `${cfg.label} removed`, description: pendingDelete.name })
    } catch (e: unknown) {
      toast({
        title: `Could not remove ${lc}`,
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setPendingDelete(null)
    }
  }

  const rows: FactRowItem[] = recipes.map((recipe) => {
    const portionCount = `${recipe.covers} ${recipe.covers === 1 ? portion : `${portion}s`}`
    return {
      id: String(recipe.id),
      title: recipe.name,
      hint: recipe.venue_name ? `${recipe.venue_name} · ${portionCount}` : portionCount,
      chip: recipe.impact
        ? undefined
        : { tone: 'attention' as const, label: 'Not calculated' },
      value: recipe.impact ? fmt(recipe.impact.per_cover_co2e) : undefined,
      unit: recipe.impact ? `KG CO₂E / ${portion.toUpperCase()}` : undefined,
      href: `${cfg.basePath}/${recipe.id}`,
      trailing: (
        <button
          type="button"
          aria-label={`Remove ${recipe.name}`}
          className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPendingDelete(recipe)
          }}
        >
          &times;
        </button>
      ),
    }
  })

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <Statement
          eyebrow={`THE WORKBENCH · ${cfg.labelPlural.toUpperCase()}`}
          headline={`The ${cfg.labelPlural.toLowerCase()}.`}
        >
          <BigNumber
            size="display"
            value={recipes.length}
            label={recipes.length === 1 ? cfg.label : cfg.labelPlural}
          />
          <div className="flex items-center gap-2">
            {canImport && (
              <PillButton variant="outline" onClick={() => setImportOpen(true)}>
                Import
              </PillButton>
            )}
            <PillButton variant="room" onClick={openCreate}>
              New {lc}
            </PillButton>
          </div>
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Build a recipe from ingredients and see its carbon, water and land impact per {portion}.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      {isLoading ? (
        <div className="space-y-3 border-t border-border pt-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[6px]" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            No {cfg.labelPlural.toLowerCase()} yet. Create your first {lc}, then add ingredients to
            calculate its impact.
          </p>
          <PillButton variant="room" className="mt-4" onClick={openCreate}>
            New {lc}
          </PillButton>
        </div>
      ) : (
        <FactList items={rows} className="border-t border-border" />
      )}

      {canImport && (
        <MenuImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          lockKind={cfg.kind as 'meal' | 'drink'}
          onComplete={() => refresh()}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New {lc}</DialogTitle>
            <DialogDescription>
              Name the {lc} and how many {portion}s the recipe makes. You&apos;ll add ingredients next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="recipe-name">{cfg.label} name</Label>
              <Input
                id="recipe-name"
                placeholder={cfg.kind === 'drink' ? 'Negroni' : 'Beef ragù with pappardelle'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="recipe-covers">{portion[0].toUpperCase()}{portion.slice(1)}s</Label>
                <Input
                  id="recipe-covers"
                  type="number"
                  min="1"
                  step="1"
                  value={covers}
                  onChange={(e) => setCovers(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recipe-venue">Venue (optional)</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger id="recipe-venue">
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
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create and add ingredients'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {lc}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.name}" and its recipe will be removed. This cannot be undone.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
