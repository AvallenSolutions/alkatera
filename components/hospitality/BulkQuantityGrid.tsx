'use client'

/**
 * Bulk quantity grid: fill in real ingredient amounts for every imported recipe
 * in one place, instead of opening each dish. Imported recipes arrive with a
 * placeholder quantity of 1 per ingredient (see the menu-import commit route);
 * this screen lets the user correct them all and confirm in a single pass.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Sparkles, UtensilsCrossed, Wine, BedDouble } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { MEAL_INGREDIENT_UNITS } from '@/lib/hospitality/meal-types'
import { RECIPE_KINDS, type RecipeKind } from '@/lib/hospitality/recipe-kinds'

interface Ingredient {
  id: number
  material_name: string
  quantity: number
  unit: string
}
interface UnconfirmedRecipe {
  id: number
  name: string
  kind: RecipeKind
  covers: number
  quantities_status: 'unconfirmed' | 'estimated'
  ingredients: Ingredient[]
}

const KIND_ICON: Record<RecipeKind, typeof UtensilsCrossed> = {
  meal: UtensilsCrossed,
  drink: Wine,
  room_night: BedDouble,
}

export function BulkQuantityGrid() {
  const { toast } = useToast()
  const [recipes, setRecipes] = useState<UnconfirmedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [proposingId, setProposingId] = useState<number | null>(null)
  // Recipes whose current values came from AI and haven't been hand-edited since —
  // confirming these keeps an "estimated" provenance flag; a manual edit clears it.
  const [aiProposed, setAiProposed] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hospitality/recipes/unconfirmed', { credentials: 'include' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to load')
      const body = await res.json()
      const list: UnconfirmedRecipe[] = body.recipes ?? []
      setRecipes(list)
      // Expand the first recipe so the screen isn't a wall of collapsed rows.
      setOpen(list.length > 0 ? { [list[0].id]: true } : {})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setIngredient = (recipeId: number, index: number, patch: Partial<Ingredient>) => {
    // A manual edit means the values are no longer purely AI-proposed.
    setAiProposed((prev) => {
      if (!prev.has(recipeId)) return prev
      const next = new Set(prev)
      next.delete(recipeId)
      return next
    })
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? { ...r, ingredients: r.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)) }
          : r,
      ),
    )
  }

  const confirm = async (recipe: UnconfirmedRecipe) => {
    const status: 'confirmed' | 'estimated' = aiProposed.has(recipe.id) ? 'estimated' : 'confirmed'
    setSavingId(recipe.id)
    try {
      const res = await fetch(`/api/hospitality/recipes/${recipe.id}/quantities`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: recipe.ingredients, status }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save')
      toast({ title: 'Quantities saved', description: recipe.name })
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id))
    } catch (e: unknown) {
      toast({
        title: 'Could not save quantities',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const proposeQuantities = async (recipe: UnconfirmedRecipe) => {
    setProposingId(recipe.id)
    try {
      const res = await fetch('/api/hospitality/recipes/propose-quantities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipe.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not suggest quantities')
      const proposed: { material_name: string; quantity: number; unit: string }[] = body.ingredients ?? []
      // Match proposals back to the recipe's ingredient rows by name.
      setRecipes((prev) =>
        prev.map((r) => {
          if (r.id !== recipe.id) return r
          return {
            ...r,
            ingredients: r.ingredients.map((ing) => {
              const p = proposed.find((x) => x.material_name.toLowerCase() === ing.material_name.toLowerCase())
              return p ? { ...ing, quantity: p.quantity, unit: p.unit || ing.unit } : ing
            }),
          }
        }),
      )
      setAiProposed((prev) => new Set(prev).add(recipe.id))
      toast({ title: 'Suggested quantities added', description: 'Review them, then confirm.' })
    } catch (e: unknown) {
      toast({
        title: 'Could not suggest quantities',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setProposingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fill in quantities</h2>
        <p className="text-sm text-muted-foreground">
          Imported recipes start with a placeholder amount of 1 per ingredient. Set the real quantities
          here, then confirm each recipe so its footprint can be calculated.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="font-medium">Nothing left to confirm</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Every imported recipe has real quantities. New imports will appear here.
          </p>
          <Button asChild variant="outline">
            <Link href="/hospitality/menus">Back to menus</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => {
            const Icon = KIND_ICON[recipe.kind]
            const cfg = RECIPE_KINDS[recipe.kind]
            const isOpen = !!open[recipe.id]
            return (
              <div key={recipe.id} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [recipe.id]: !o[recipe.id] }))}
                  className="flex w-full items-center justify-between gap-2 p-4 text-left"
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{recipe.name}</span>
                    <Badge variant="outline" className="text-muted-foreground">
                      {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
                    </Badge>
                    {recipe.quantities_status === 'estimated' && (
                      <Badge variant="outline" className="text-muted-foreground">AI-estimated</Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {recipe.covers} {recipe.covers === 1 ? cfg.portionWord : `${cfg.portionWord}s`}
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t p-4">
                    {recipe.ingredients.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This recipe has no ingredients. Open it in the editor to add some.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="hidden grid-cols-[1fr,7rem,8rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                          <span>Ingredient</span>
                          <span>Quantity</span>
                          <span>Unit</span>
                        </div>
                        {recipe.ingredients.map((ing, i) => (
                          <div key={ing.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,7rem,8rem]">
                            <div className="flex items-center text-sm">{ing.material_name}</div>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={ing.quantity === 0 ? '' : String(ing.quantity)}
                              onChange={(e) => setIngredient(recipe.id, i, { quantity: Number(e.target.value) })}
                            />
                            <Select value={ing.unit} onValueChange={(v) => setIngredient(recipe.id, i, { unit: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MEAL_INGREDIENT_UNITS.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => confirm(recipe)} disabled={savingId === recipe.id}>
                        {savingId === recipe.id ? 'Saving…' : 'Confirm quantities'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => proposeQuantities(recipe)}
                        disabled={proposingId === recipe.id || recipe.ingredients.length === 0}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {proposingId === recipe.id ? 'Suggesting…' : 'Suggest amounts'}
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`${cfg.basePath}/${recipe.id}`}>Open in editor</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
