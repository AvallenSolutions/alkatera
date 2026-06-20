'use client'

/**
 * Management surface for hospitality recipes (meals or made-drinks).
 * Lists recipes with per-portion impact and lets you create one (which then
 * opens the recipe editor to add ingredients and calculate). Generic over the
 * recipe kind so Meals and Drinks share one component.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UtensilsCrossed, Wine, Trash2, Leaf, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

  const Icon = cfg.kind === 'drink' ? Wine : UtensilsCrossed
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{cfg.labelPlural}</h2>
          <p className="text-sm text-muted-foreground">
            Build a recipe from ingredients and see its carbon, water and land impact per {portion}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New {lc}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No {cfg.labelPlural.toLowerCase()} yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first {lc}, then add ingredients to calculate its impact.
          </p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New {lc}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`${cfg.basePath}/${recipe.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push(`${cfg.basePath}/${recipe.id}`)
              }}
              className="group flex cursor-pointer flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{recipe.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDelete(recipe)
                  }}
                  aria-label={`Delete ${lc}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {recipe.venue_name && <Badge variant="secondary">{recipe.venue_name}</Badge>}
                <Badge variant="outline">
                  {recipe.covers} {recipe.covers === 1 ? portion : `${portion}s`}
                </Badge>
              </div>
              <div className="mt-3">
                {recipe.impact ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Leaf className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{fmt(recipe.impact.per_cover_co2e)} kg CO₂e</span>
                    <span className="text-muted-foreground">per {portion}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Not yet calculated</span>
                )}
              </div>
            </div>
          ))}
        </div>
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
