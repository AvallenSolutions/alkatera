/**
 * Duplicate a room recipe. POST /api/hospitality/rooms/[id]/duplicate
 */
import { recipeDuplicateHandler } from '@/lib/hospitality/recipe-route-handlers'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

export const { POST } = recipeDuplicateHandler(RECIPE_KINDS.room_night)
