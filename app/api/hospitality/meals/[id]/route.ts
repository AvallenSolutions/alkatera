/**
 * Hospitality meal detail + update + delete. Thin wrapper over shared handlers.
 *
 * GET    /api/hospitality/meals/[id]  — meal + ingredients + per-cover impact.
 * PATCH  /api/hospitality/meals/[id]  — update name / venue / covers / portion note.
 * DELETE /api/hospitality/meals/[id]  — delete the meal product.
 */

import { recipeItemHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = recipeItemHandlers(RECIPE_KINDS.meal)
