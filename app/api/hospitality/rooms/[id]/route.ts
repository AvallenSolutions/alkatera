/**
 * Hospitality room detail + update + delete. Thin wrapper over shared handlers.
 *
 * GET    /api/hospitality/rooms/[id]  — room + consumables ingredients + per-night impact.
 * PATCH  /api/hospitality/rooms/[id]  — update name / venue / nights / portion note.
 * DELETE /api/hospitality/rooms/[id]  — delete the room-night product.
 */

import { recipeItemHandlers } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = recipeItemHandlers(RECIPE_KINDS.room_night)
