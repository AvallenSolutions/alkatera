/**
 * Hospitality menu service.
 *
 * The key behaviour is in `computeItemImpacts`: per-item impact is read LIVE
 * from each referenced product's latest PCF on every request and divided by the
 * serving count. Nothing is snapshot onto the menu item, so updating a wine's
 * LCA (or recalculating a meal) immediately moves its menu figure — requirement
 * #3 (own-wine drinks pull live bottle impact).
 */

import { perCoverImpact } from './meal-types'
import {
  DEFAULT_SERVES_PER_BOTTLE,
  summariseMenu,
  type MenuItemKind,
  type MenuItemView,
} from './menu-types'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

const MENU_COLS = 'id, name, description, venue_id, status, is_public, public_slug'

const PRODUCT_KIND_FOR_ITEM: Record<MenuItemKind, string> = {
  meal: 'hospitality_meal',
  made_drink: 'hospitality_drink',
  own_product_drink: 'product',
}

/** Map product_id → latest aggregated_impacts JSON (most recent PCF). */
async function latestImpacts(db: Db, productIds: number[]): Promise<Map<number, Record<string, unknown>>> {
  const map = new Map<number, Record<string, unknown>>()
  if (productIds.length === 0) return map
  const { data } = await db
    .from('product_carbon_footprints')
    .select('product_id, aggregated_impacts, created_at')
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  for (const pcf of data ?? []) {
    if (!map.has(pcf.product_id) && pcf.aggregated_impacts) map.set(pcf.product_id, pcf.aggregated_impacts)
  }
  return map
}

/** Compute the live per-serving impact for each menu item row. */
async function computeItemImpacts(db: Db, rows: any[], productNames: Map<number, string>): Promise<MenuItemView[]> {
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)))
  const impacts = await latestImpacts(db, productIds)

  // Recipe items divide by covers; own-product drinks by serves_per_container.
  const recipeIds = rows.filter((r) => r.item_kind !== 'own_product_drink').map((r) => r.product_id)
  const covers = new Map<number, number>()
  if (recipeIds.length > 0) {
    const { data } = await db
      .from('hospitality_meal_meta')
      .select('product_id, covers')
      .in('product_id', recipeIds)
    for (const m of data ?? []) covers.set(m.product_id, Number(m.covers ?? 1))
  }
  const wineIds = rows.filter((r) => r.item_kind === 'own_product_drink').map((r) => r.product_id)
  const productServes = new Map<number, number | null>()
  if (wineIds.length > 0) {
    const { data } = await db.from('products').select('id, serves_per_container').in('id', wineIds)
    for (const p of data ?? []) productServes.set(p.id, p.serves_per_container != null ? Number(p.serves_per_container) : null)
  }

  return rows.map((r) => {
    let serves: number
    if (r.item_kind === 'own_product_drink') {
      serves = Number(r.serves_per_container) || productServes.get(r.product_id) || DEFAULT_SERVES_PER_BOTTLE
    } else {
      serves = covers.get(r.product_id) ?? 1
    }
    return {
      id: r.id,
      product_id: r.product_id,
      product_name: productNames.get(r.product_id) ?? `Product ${r.product_id}`,
      item_kind: r.item_kind as MenuItemKind,
      serves,
      internal_consumption: !!r.internal_consumption,
      sort_order: r.sort_order ?? 0,
      impact: perCoverImpact(impacts.get(r.product_id), serves),
    }
  })
}

export async function listMenus(db: Db, organizationId: string): Promise<ServiceResult<unknown[]>> {
  const { data: menus, error } = await db
    .from('hospitality_menus')
    .select('id, name, venue_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) return fail(500, error.message)
  const ids = (menus ?? []).map((m: any) => m.id)
  if (ids.length === 0) return ok([])

  const { data: items } = await db
    .from('hospitality_menu_items')
    .select('id, menu_id, product_id, item_kind, serves_per_container, sort_order, internal_consumption')
    .in('menu_id', ids)
  const itemsByMenu = new Map<string, any[]>()
  for (const it of items ?? []) {
    if (!itemsByMenu.has(it.menu_id)) itemsByMenu.set(it.menu_id, [])
    itemsByMenu.get(it.menu_id)!.push(it)
  }

  // Resolve product names + impacts across all items at once.
  const allItems = items ?? []
  const productNames = await productNameMap(db, allItems.map((i: any) => i.product_id))
  const venueNames = await venueNameMap(db, (menus ?? []).map((m: any) => m.venue_id))

  const computedByMenu = new Map<string, MenuItemView[]>()
  for (const [menuId, rows] of Array.from(itemsByMenu.entries())) {
    computedByMenu.set(menuId, await computeItemImpacts(db, rows, productNames))
  }

  const result = (menus ?? []).map((m: any) => {
    const views = computedByMenu.get(m.id) ?? []
    const agg = summariseMenu(views)
    return {
      id: m.id,
      name: m.name,
      venue_id: m.venue_id ?? null,
      venue_name: m.venue_id ? venueNames.get(m.venue_id) ?? null : null,
      item_count: agg.item_count,
      avg_co2e: agg.priced_count > 0 ? agg.avg_co2e : null,
    }
  })
  return ok(result)
}

export async function createMenu(db: Db, organizationId: string, userId: string, body: any): Promise<ServiceResult<{ id: string }>> {
  const name = String(body?.name ?? '').trim()
  if (!name) return fail(400, 'name required')
  const venue_id = body?.venue_id ? String(body.venue_id) : null
  if (venue_id) {
    const { data: venue } = await db
      .from('hospitality_venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!venue) return fail(400, 'invalid venue_id')
  }
  const { data, error } = await db
    .from('hospitality_menus')
    .insert({
      organization_id: organizationId,
      name,
      description: body?.description ? String(body.description) : null,
      venue_id,
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function getMenu(db: Db, organizationId: string, menuId: string): Promise<ServiceResult<unknown>> {
  const { data: menu, error } = await db
    .from('hospitality_menus')
    .select(MENU_COLS)
    .eq('id', menuId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) return fail(500, error.message)
  if (!menu) return fail(404, 'Menu not found')

  const { data: itemRows } = await db
    .from('hospitality_menu_items')
    .select('id, product_id, item_kind, serves_per_container, sort_order, internal_consumption')
    .eq('menu_id', menuId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const productNames = await productNameMap(db, (itemRows ?? []).map((i: any) => i.product_id))
  const items = await computeItemImpacts(db, itemRows ?? [], productNames)
  const venueNames = await venueNameMap(db, [menu.venue_id])

  return ok({
    id: menu.id,
    name: menu.name,
    description: menu.description ?? null,
    venue_id: menu.venue_id ?? null,
    venue_name: menu.venue_id ? venueNames.get(menu.venue_id) ?? null : null,
    is_public: !!menu.is_public,
    public_slug: menu.public_slug ?? null,
    items,
    aggregate: summariseMenu(items),
  })
}

export async function updateMenu(db: Db, organizationId: string, menuId: string, body: any): Promise<ServiceResult<{ ok: true }>> {
  const updates: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return fail(400, 'name cannot be empty')
    updates.name = name
  }
  if (body?.description !== undefined) updates.description = body.description ? String(body.description) : null
  if (body?.venue_id !== undefined) {
    const venue_id = body.venue_id ? String(body.venue_id) : null
    if (venue_id) {
      const { data: venue } = await db
        .from('hospitality_venues')
        .select('id')
        .eq('id', venue_id)
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (!venue) return fail(400, 'invalid venue_id')
    }
    updates.venue_id = venue_id
  }
  if (Object.keys(updates).length === 0) return fail(400, 'no updatable fields provided')
  const { data, error } = await db
    .from('hospitality_menus')
    .update(updates)
    .eq('id', menuId)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle()
  if (error) return fail(500, error.message)
  if (!data) return fail(404, 'Menu not found')
  return ok({ ok: true })
}

export async function deleteMenu(db: Db, organizationId: string, menuId: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db.from('hospitality_menus').delete().eq('id', menuId).eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}

export async function addMenuItem(db: Db, organizationId: string, menuId: string, body: any): Promise<ServiceResult<{ id: string }>> {
  // Menu must belong to the org.
  const { data: menu } = await db
    .from('hospitality_menus')
    .select('id')
    .eq('id', menuId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!menu) return fail(404, 'Menu not found')

  const item_kind = String(body?.item_kind ?? '') as MenuItemKind
  if (!(item_kind in PRODUCT_KIND_FOR_ITEM)) return fail(400, 'invalid item_kind')
  const product_id = Number(body?.product_id)
  if (!Number.isFinite(product_id)) return fail(400, 'product_id required')

  // Product must belong to the org and match the item kind.
  const { data: product } = await db
    .from('products')
    .select('id, product_kind')
    .eq('id', product_id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!product) return fail(400, 'product not found for this organisation')
  if (product.product_kind !== PRODUCT_KIND_FOR_ITEM[item_kind]) {
    return fail(400, `product is not a ${item_kind.replace('_', ' ')}`)
  }

  let serves_per_container: number | null = null
  if (item_kind === 'own_product_drink' && body?.serves_per_container != null) {
    const s = Number(body.serves_per_container)
    if (!Number.isFinite(s) || s <= 0) return fail(400, 'serves_per_container must be greater than 0')
    serves_per_container = s
  }

  const { data, error } = await db
    .from('hospitality_menu_items')
    .insert({
      organization_id: organizationId,
      menu_id: menuId,
      product_id,
      item_kind,
      serves_per_container,
      // Own-product drinks are tagged internal: the wine is already counted in
      // the company's production figures, so it must not be re-added (Phase 5).
      internal_consumption: item_kind === 'own_product_drink',
      sort_order: Number(body?.sort_order) || 0,
    })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function removeMenuItem(db: Db, organizationId: string, itemId: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db
    .from('hospitality_menu_items')
    .delete()
    .eq('id', itemId)
    .eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}

/** Org wine/spirit products (product_kind='product') with live per-bottle impact — the own-wine picker for #3. */
export async function listWines(db: Db, organizationId: string): Promise<ServiceResult<unknown[]>> {
  const { data: products, error } = await db
    .from('products')
    .select('id, name, serves_per_container')
    .eq('organization_id', organizationId)
    .eq('product_kind', 'product')
    .order('name', { ascending: true })
  if (error) return fail(500, error.message)
  const ids = (products ?? []).map((p: any) => p.id)
  const impacts = await latestImpacts(db, ids)
  const result = (products ?? []).map((p: any) => {
    const agg = impacts.get(p.id)
    return {
      id: p.id,
      name: p.name,
      serves_per_container: p.serves_per_container != null ? Number(p.serves_per_container) : null,
      per_bottle_co2e: agg ? Number(agg.climate_change_gwp100 ?? 0) : null,
    }
  })
  return ok(result)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Publish or unpublish a menu; generates a stable public_slug on first publish. */
export async function publishMenu(
  db: Db,
  organizationId: string,
  menuId: string,
  isPublic: boolean,
): Promise<ServiceResult<{ is_public: boolean; public_slug: string | null }>> {
  const { data: menu } = await db
    .from('hospitality_menus')
    .select('id, name, public_slug')
    .eq('id', menuId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!menu) return fail(404, 'Menu not found')

  const updates: Record<string, unknown> = { is_public: isPublic }
  let slug: string | null = menu.public_slug ?? null
  if (isPublic && !slug) {
    // base + short random suffix; retry on the unique constraint a few times.
    const base = slugify(menu.name) || 'menu'
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`
      const { error } = await db
        .from('hospitality_menus')
        .update({ is_public: true, public_slug: candidate })
        .eq('id', menuId)
        .eq('organization_id', organizationId)
      if (!error) {
        slug = candidate
        return ok({ is_public: true, public_slug: slug })
      }
      if (!String(error.message).includes('public_slug')) return fail(500, error.message)
    }
    return fail(500, 'Could not allocate a public link, please retry')
  }

  const { error } = await db
    .from('hospitality_menus')
    .update(updates)
    .eq('id', menuId)
    .eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ is_public: isPublic, public_slug: slug })
}

/** Public (no-auth) read of a published menu by slug. Caller uses a service-role client. */
export async function getPublicMenu(db: Db, slug: string): Promise<ServiceResult<unknown>> {
  const { data: menu, error } = await db
    .from('hospitality_menus')
    .select('id, name, description, venue_id')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .maybeSingle()
  if (error) return fail(500, error.message)
  if (!menu) return fail(404, 'Menu not found')

  const { data: itemRows } = await db
    .from('hospitality_menu_items')
    .select('id, product_id, item_kind, serves_per_container, sort_order, internal_consumption')
    .eq('menu_id', menu.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const productNames = await productNameMap(db, (itemRows ?? []).map((i: any) => i.product_id))
  const items = await computeItemImpacts(db, itemRows ?? [], productNames)
  const venueNames = await venueNameMap(db, [menu.venue_id])

  // Public-safe shape: name + per-serving carbon only (no internal flags / ids).
  return ok({
    name: menu.name,
    description: menu.description ?? null,
    venue_name: menu.venue_id ? venueNames.get(menu.venue_id) ?? null : null,
    items: items.map((i) => ({
      name: i.product_name,
      item_kind: i.item_kind,
      co2e: i.impact?.per_cover_co2e ?? null,
    })),
  })
}

// ── helpers ────────────────────────────────────────────────────────────────
async function productNameMap(db: Db, productIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const ids = Array.from(new Set(productIds))
  if (ids.length === 0) return map
  const { data } = await db.from('products').select('id, name').in('id', ids)
  for (const p of data ?? []) map.set(p.id, p.name)
  return map
}

async function venueNameMap(db: Db, venueIds: (string | null)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = Array.from(new Set(venueIds.filter(Boolean))) as string[]
  if (ids.length === 0) return map
  const { data } = await db.from('hospitality_venues').select('id, name').in('id', ids)
  for (const v of data ?? []) map.set(v.id, v.name)
  return map
}
