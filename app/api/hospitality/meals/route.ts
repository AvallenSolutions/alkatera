/**
 * Hospitality meals list + create. Thin wrapper over the shared recipe handlers.
 *
 * GET  /api/hospitality/meals[?venue_id=]   — list meals with per-cover impact.
 * POST /api/hospitality/meals               — create a meal (product + meta).
 */

import { recipeCollectionHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, POST } = recipeCollectionHandlers(RECIPE_KINDS.meal)
