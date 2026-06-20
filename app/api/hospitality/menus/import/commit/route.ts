/**
 * Menu import — commit step.
 *
 * POST /api/hospitality/menus/import/commit
 *   body: {
 *     create_menu: boolean,
 *     menu_name?: string,
 *     venue_id?: string | null,
 *     items: [{ name, kind: 'meal'|'drink', ingredients: string[] }]
 *   }
 *   → { created: number, skipped: string[], menu_id?: string }
 *
 * Batch-creates each meal/drink as a recipe (reusing createRecipe), seeds its
 * ingredient names into product_materials with a 0 quantity so they appear in
 * the recipe editor ready for the user to fill in, and — when create_menu is on
 * — assembles them into a new menu. Best-effort: a single bad row is skipped,
 * not fatal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { createRecipe } from '@/lib/hospitality/recipe-service'
import { createMenu, addMenuItem } from '@/lib/hospitality/menu-service'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'

export const runtime = 'nodejs'

const MAX_ITEMS = 200
const MAX_INGREDIENTS_PER_ITEM = 40

interface CommitItem {
  name: string
  kind: 'meal' | 'drink'
  ingredients?: unknown
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  const db = client as any

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawItems = Array.isArray(body?.items) ? (body.items as CommitItem[]) : []
  if (rawItems.length === 0) return NextResponse.json({ error: 'No items to import.' }, { status: 400 })
  if (rawItems.length > MAX_ITEMS) return NextResponse.json({ error: 'Too many items in one import.' }, { status: 400 })

  const venue_id = body?.venue_id ? String(body.venue_id) : null
  const createMenuFlag = body?.create_menu === true

  // Create each recipe + seed its ingredient names.
  const skipped: string[] = []
  const created: Array<{ id: number; kind: 'meal' | 'drink' }> = []

  for (const item of rawItems) {
    const name = String(item?.name ?? '').trim()
    const kind = item?.kind === 'drink' ? 'drink' : 'meal'
    if (!name) continue
    const cfg = RECIPE_KINDS[kind]

    const res = await createRecipe(db, organizationId, user.id, cfg, { name, venue_id, covers: 1 })
    if (!res.ok) {
      skipped.push(name)
      continue
    }
    const productId = res.data.id

    const ingredients = Array.isArray(item?.ingredients)
      ? Array.from(
          new Set(
            (item.ingredients as unknown[])
              .map((i) => String(i ?? '').replace(/\s+/g, ' ').trim())
              .filter((s) => s.length > 0),
          ),
        ).slice(0, MAX_INGREDIENTS_PER_ITEM)
      : []

    if (ingredients.length > 0) {
      // product_materials enforces quantity > 0, so we can't store a truly blank
      // amount. Seed a placeholder of 1 (ml for drinks, g for meals) that the
      // user adjusts in the recipe editor. Impact is never auto-calculated, so no
      // fabricated footprint is shown until they set real amounts and calculate.
      const unit = kind === 'drink' ? 'ml' : 'g'
      const { error: insErr } = await db.from('product_materials').insert(
        ingredients.map((material_name) => ({
          product_id: productId,
          material_name,
          quantity: 1,
          unit,
          material_type: 'ingredient',
        })),
      )
      if (insErr) {
        // The recipe itself is fine; just note the ingredient names were dropped.
        skipped.push(`${name} (ingredients)`)
      }
    }

    created.push({ id: productId, kind })
  }

  if (created.length === 0) {
    return NextResponse.json({ error: 'Nothing could be imported.', skipped }, { status: 422 })
  }

  // Optionally assemble the created recipes into a new menu.
  let menuId: string | undefined
  if (createMenuFlag) {
    const menuName = String(body?.menu_name ?? '').trim() || 'Imported menu'
    const menuRes = await createMenu(db, organizationId, user.id, { name: menuName, venue_id })
    if (menuRes.ok) {
      menuId = menuRes.data.id
      let sort = 0
      for (const rec of created) {
        await addMenuItem(db, organizationId, menuId, {
          item_kind: rec.kind === 'drink' ? 'made_drink' : 'meal',
          product_id: rec.id,
          sort_order: sort++,
        })
      }
    } else {
      // Recipes were still created; surface the menu failure softly.
      skipped.push(`menu: ${menuRes.error}`)
    }
  }

  return NextResponse.json({ created: created.length, skipped, menu_id: menuId })
}
