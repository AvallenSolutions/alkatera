'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HospitalityMealListItem } from '@/lib/hospitality/meal-types'
import type { RecipeKindConfig } from '@/lib/hospitality/recipe-kinds'

export interface RecipeCreateInput {
  name: string
  venue_id?: string | null
  covers?: number
  portion_note?: string | null
}

interface UseHospitalityRecipesResult {
  recipes: HospitalityMealListItem[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createRecipe: (input: RecipeCreateInput) => Promise<{ id: number }>
  deleteRecipe: (id: number) => Promise<void>
  duplicateRecipe: (id: number) => Promise<{ id: number }>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/**
 * Client data hook for hospitality recipes (meals or made-drinks), keyed by the
 * kind config so meals and drinks reuse one hook. Cookie-authenticated.
 */
export function useHospitalityRecipes(cfg: RecipeKindConfig): UseHospitalityRecipesResult {
  const [recipes, setRecipes] = useState<HospitalityMealListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(cfg.apiBase, { credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res))
      const body = await res.json()
      setRecipes(body.recipes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to load ${cfg.labelPlural.toLowerCase()}`)
    } finally {
      setIsLoading(false)
    }
  }, [cfg.apiBase, cfg.labelPlural])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createRecipe = useCallback(
    async (input: RecipeCreateInput) => {
      const res = await fetch(cfg.apiBase, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await readError(res))
      const body = await res.json()
      await refresh()
      return body.recipe as { id: number }
    },
    [cfg.apiBase, refresh],
  )

  const deleteRecipe = useCallback(
    async (id: number) => {
      const res = await fetch(`${cfg.apiBase}/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res))
      setRecipes((prev) => prev.filter((r) => r.id !== id))
    },
    [cfg.apiBase],
  )

  const duplicateRecipe = useCallback(
    async (id: number) => {
      const res = await fetch(`${cfg.apiBase}/${id}/duplicate`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res))
      const body = await res.json()
      await refresh()
      return body.recipe as { id: number }
    },
    [cfg.apiBase, refresh],
  )

  return { recipes, isLoading, error, refresh, createRecipe, deleteRecipe, duplicateRecipe }
}
