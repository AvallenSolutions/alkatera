/**
 * Hospitality rooms list + create. Thin wrapper over the shared recipe handlers.
 * A "room" is a room-night recipe whose ingredients are the purchased consumables
 * (linen/laundry, amenities, breakfast) per night.
 *
 * GET  /api/hospitality/rooms[?venue_id=]   — list rooms with per-night consumables impact.
 * POST /api/hospitality/rooms               — create a room-night (product + meta).
 */

import { recipeCollectionHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, POST } = recipeCollectionHandlers(RECIPE_KINDS.room_night)
