/**
 * Hospitality made-drinks list + create. Thin wrapper over shared handlers.
 *
 * GET  /api/hospitality/drinks[?venue_id=]   — list made-drinks with per-serve impact.
 * POST /api/hospitality/drinks               — create a made-drink (product + meta).
 */

import { recipeCollectionHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, POST } = recipeCollectionHandlers(RECIPE_KINDS.drink)
