/**
 * Hospitality made-drink detail + update + delete. Thin wrapper over shared handlers.
 *
 * GET    /api/hospitality/drinks/[id]  — drink + ingredients + per-serve impact.
 * PATCH  /api/hospitality/drinks/[id]  — update name / venue / serves / portion note.
 * DELETE /api/hospitality/drinks/[id]  — delete the made-drink product.
 */

import { recipeItemHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = recipeItemHandlers(RECIPE_KINDS.drink)
