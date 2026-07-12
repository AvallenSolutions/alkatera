/**
 * Shared recipe (meal / made-drink) service.
 *
 * A recipe is a `products` row (product_kind from the kind config) plus a
 * `hospitality_meal_meta` row (venue + portion count). Ingredients and impact
 * calculation are handled client-side via the shared LCA engine; these helpers
 * own creation, the read model and metadata mutations, parameterised by kind so
 * meals and drinks share one code path.
 */

import { perCoverImpact, MEAL_INGREDIENT_UNITS } from './meal-types'
import { cookingCo2e, isCookingMethod } from './cooking-energy'
import { sanitiseDietaryTags, sanitiseAllergens } from './dietary'
import { scoreRecipeNature } from './nature-score'
import { RECIPE_KIND_BY_PRODUCT_KIND, type RecipeKindConfig, type RecipeKind } from './recipe-kinds'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

/**
 * The org's country, used as the grid-factor region for cooking energy (which is
 * display-only). Falls back to 'GB' — getGridFactor tolerates unknown codes.
 */
export async function getOrgCountry(db: Db, organizationId: string): Promise<string> {
  const { data } = await db.from('organizations').select('country').eq('id', organizationId).maybeSingle()
  const c = String(data?.country ?? '').trim()
  return c || 'GB'
}

export async function listRecipes(
  db: Db,
  organizationId: string,
  cfg: RecipeKindConfig,
  venueFilter?: string | null,
): Promise<ServiceResult<unknown[]>> {
  const { data: products, error: prodErr } = await db
    .from('products')
    .select('id, name, created_at')
    .eq('organization_id', organizationId)
    .eq('product_kind', cfg.productKind)
    .order('created_at', { ascending: false })
  if (prodErr) return fail(500, prodErr.message)

  const ids = (products ?? []).map((p: any) => p.id)
  if (ids.length === 0) return ok([])

  const country = await getOrgCountry(db, organizationId)

  const { data: metas } = await db
    .from('hospitality_meal_meta')
    .select('product_id, venue_id, covers, quantities_status, prep_waste_pct, cooking_method, cooking_minutes')
    .in('product_id', ids)
  interface MetaShape {
    venue_id: string | null
    covers: number
    quantities_status: string
    prep_waste_pct: number
    cooking_method: string | null
    cooking_minutes: number | null
  }
  const metaByProduct = new Map<number, MetaShape>()
  for (const m of metas ?? []) {
    metaByProduct.set(m.product_id, {
      venue_id: m.venue_id ?? null,
      covers: Number(m.covers ?? 1),
      quantities_status: m.quantities_status ?? 'confirmed',
      prep_waste_pct: Number(m.prep_waste_pct ?? 0),
      cooking_method: m.cooking_method ?? null,
      cooking_minutes: m.cooking_minutes != null ? Number(m.cooking_minutes) : null,
    })
  }

  const venueIds = Array.from(new Set((metas ?? []).map((m: any) => m.venue_id).filter(Boolean)))
  const venueNames = new Map<string, string>()
  const venueStatuses = new Map<string, string>()
  if (venueIds.length > 0) {
    const { data: venues } = await db.from('hospitality_venues').select('id, name, status').in('id', venueIds)
    for (const v of venues ?? []) {
      venueNames.set(v.id, v.name)
      venueStatuses.set(v.id, v.status ?? 'active')
    }
  }

  const { data: pcfs } = await db
    .from('product_carbon_footprints')
    .select('product_id, aggregated_impacts, created_at')
    .in('product_id', ids)
    .order('created_at', { ascending: false })
  const latestImpact = new Map<number, Record<string, unknown>>()
  for (const pcf of pcfs ?? []) {
    if (!latestImpact.has(pcf.product_id) && pcf.aggregated_impacts) {
      latestImpact.set(pcf.product_id, pcf.aggregated_impacts)
    }
  }

  let recipes = (products ?? []).map((p: any) => {
    const meta = metaByProduct.get(p.id) ?? {
      venue_id: null,
      covers: 1,
      quantities_status: 'confirmed',
      prep_waste_pct: 0,
      cooking_method: null,
      cooking_minutes: null,
    }
    const cooking = cookingCo2e(meta.cooking_method, meta.cooking_minutes, country)
    return {
      id: p.id,
      name: p.name,
      venue_id: meta.venue_id,
      venue_name: meta.venue_id ? venueNames.get(meta.venue_id) ?? null : null,
      venue_status: meta.venue_id ? venueStatuses.get(meta.venue_id) ?? null : null,
      quantities_status: meta.quantities_status,
      covers: meta.covers,
      impact: perCoverImpact(latestImpact.get(p.id), meta.covers, {
        prepWastePct: meta.prep_waste_pct,
        cookingCo2eTotal: cooking?.co2e ?? 0,
      }),
    }
  })
  if (venueFilter) recipes = recipes.filter((r: any) => r.venue_id === venueFilter)
  return ok(recipes)
}

export async function createRecipe(
  db: Db,
  organizationId: string,
  userId: string,
  cfg: RecipeKindConfig,
  body: any,
): Promise<ServiceResult<{ id: number; name: string; venue_id: string | null; covers: number }>> {
  const name = String(body?.name ?? '').trim()
  if (!name) return fail(400, 'name required')

  const coversRaw = Number(body?.covers)
  const covers = Number.isFinite(coversRaw) && coversRaw > 0 ? coversRaw : 1
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

  const { data: product, error: prodErr } = await db
    .from('products')
    .insert({
      organization_id: organizationId,
      name,
      product_kind: cfg.productKind,
      product_category: cfg.productCategory,
      functional_unit: `1 ${cfg.batchWord} of ${name} (${covers} ${covers === 1 ? cfg.portionWord : cfg.portionWord + 's'})`,
      created_by: userId,
    })
    .select('id, name')
    .single()
  if (prodErr) return fail(500, prodErr.message)

  const { error: metaErr } = await db.from('hospitality_meal_meta').insert({
    organization_id: organizationId,
    product_id: product.id,
    venue_id,
    covers,
    portion_note: body?.portion_note ? String(body.portion_note) : null,
    created_by: userId,
  })
  if (metaErr) {
    await db.from('products').delete().eq('id', product.id)
    return fail(500, metaErr.message)
  }

  return ok({ id: product.id, name: product.name, venue_id, covers })
}

export async function getRecipe(
  db: Db,
  organizationId: string,
  cfg: RecipeKindConfig,
  id: string,
): Promise<ServiceResult<unknown>> {
  const { data: product, error: prodErr } = await db
    .from('products')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('product_kind', cfg.productKind)
    .maybeSingle()
  if (prodErr) return fail(500, prodErr.message)
  if (!product) return fail(404, `${cfg.label} not found`)

  const { data: meta } = await db
    .from('hospitality_meal_meta')
    .select('venue_id, covers, portion_note, quantities_status, prep_waste_pct, cooking_method, cooking_minutes, dietary_tags, allergens')
    .eq('product_id', product.id)
    .maybeSingle()

  const { data: ingredients } = await db
    .from('product_materials')
    .select('id, material_name, quantity, unit')
    .eq('product_id', product.id)
    .eq('material_type', 'ingredient')
    .order('id', { ascending: true })

  const { data: pcfs } = await db
    .from('product_carbon_footprints')
    .select('aggregated_impacts, created_at')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const covers = Number(meta?.covers ?? 1)
  const prepWastePct = Number(meta?.prep_waste_pct ?? 0)
  const cookingMethod = meta?.cooking_method ?? null
  const cookingMinutes = meta?.cooking_minutes != null ? Number(meta.cooking_minutes) : null
  const cooking = cookingCo2e(cookingMethod, cookingMinutes, await getOrgCountry(db, organizationId))

  return ok({
    id: product.id,
    name: product.name,
    venue_id: meta?.venue_id ?? null,
    covers,
    portion_note: meta?.portion_note ?? null,
    quantities_status: meta?.quantities_status ?? 'confirmed',
    prep_waste_pct: prepWastePct,
    cooking_method: cookingMethod,
    cooking_minutes: cookingMinutes,
    dietary_tags: Array.isArray(meta?.dietary_tags) ? meta!.dietary_tags : [],
    allergens: Array.isArray(meta?.allergens) ? meta!.allergens : [],
    nature_score: scoreRecipeNature((ingredients ?? []).map((m: any) => m.material_name)),
    ingredients: (ingredients ?? []).map((m: any) => ({
      id: m.id,
      material_name: m.material_name,
      quantity: Number(m.quantity),
      unit: m.unit,
    })),
    impact: perCoverImpact(pcfs?.[0]?.aggregated_impacts ?? null, covers, {
      prepWastePct,
      cookingCo2eTotal: cooking?.co2e ?? 0,
    }),
  })
}

export async function updateRecipe(
  db: Db,
  organizationId: string,
  cfg: RecipeKindConfig,
  id: string,
  body: any,
): Promise<ServiceResult<{ ok: true }>> {
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('product_kind', cfg.productKind)
    .maybeSingle()
  if (!product) return fail(404, `${cfg.label} not found`)

  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return fail(400, 'name cannot be empty')
    const { error } = await db.from('products').update({ name }).eq('id', product.id)
    if (error) return fail(500, error.message)
  }

  const metaUpdates: Record<string, unknown> = {}
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
    metaUpdates.venue_id = venue_id
  }
  if (body?.covers !== undefined) {
    const covers = Number(body.covers)
    if (!Number.isFinite(covers) || covers <= 0) return fail(400, 'covers must be greater than 0')
    metaUpdates.covers = covers
  }
  if (body?.portion_note !== undefined) {
    metaUpdates.portion_note = body.portion_note ? String(body.portion_note) : null
  }
  if (body?.quantities_status !== undefined) {
    const status = String(body.quantities_status)
    if (!['confirmed', 'unconfirmed', 'estimated'].includes(status)) {
      return fail(400, 'invalid quantities_status')
    }
    metaUpdates.quantities_status = status
  }
  if (body?.prep_waste_pct !== undefined) {
    const pct = Number(body.prep_waste_pct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return fail(400, 'prep_waste_pct must be between 0 and 100')
    metaUpdates.prep_waste_pct = pct
  }
  if (body?.cooking_method !== undefined) {
    const method = body.cooking_method == null || body.cooking_method === '' ? null : String(body.cooking_method)
    if (method !== null && !isCookingMethod(method)) return fail(400, 'invalid cooking_method')
    metaUpdates.cooking_method = method
  }
  if (body?.cooking_minutes !== undefined) {
    if (body.cooking_minutes == null || body.cooking_minutes === '') {
      metaUpdates.cooking_minutes = null
    } else {
      const mins = Number(body.cooking_minutes)
      if (!Number.isFinite(mins) || mins < 0) return fail(400, 'cooking_minutes must be 0 or more')
      metaUpdates.cooking_minutes = mins
    }
  }
  if (body?.dietary_tags !== undefined) metaUpdates.dietary_tags = sanitiseDietaryTags(body.dietary_tags)
  if (body?.allergens !== undefined) metaUpdates.allergens = sanitiseAllergens(body.allergens)
  if (Object.keys(metaUpdates).length > 0) {
    const { error } = await db
      .from('hospitality_meal_meta')
      .update(metaUpdates)
      .eq('product_id', product.id)
    if (error) return fail(500, error.message)
  }
  return ok({ ok: true })
}

export async function deleteRecipe(
  db: Db,
  organizationId: string,
  cfg: RecipeKindConfig,
  id: string,
): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db
    .from('products')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('product_kind', cfg.productKind)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}

/**
 * Duplicate a recipe: copies the product, its meta (venue, covers, portion note,
 * prep waste, cooking method, quantities status) and its ingredient rows
 * including the resolved emission factors. The PCF is not copied — the duplicate
 * reads as "not yet calculated" until the user calculates it, which is honest.
 */
export async function duplicateRecipe(
  db: Db,
  organizationId: string,
  userId: string,
  cfg: RecipeKindConfig,
  id: string,
): Promise<ServiceResult<{ id: number }>> {
  const { data: source, error: srcErr } = await db
    .from('products')
    .select('id, name, product_category, functional_unit')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('product_kind', cfg.productKind)
    .maybeSingle()
  if (srcErr) return fail(500, srcErr.message)
  if (!source) return fail(404, `${cfg.label} not found`)

  const { data: meta } = await db
    .from('hospitality_meal_meta')
    .select('venue_id, covers, portion_note, prep_waste_pct, quantities_status, cooking_method, cooking_minutes, dietary_tags, allergens')
    .eq('product_id', source.id)
    .maybeSingle()

  const newName = `${source.name} (copy)`
  const { data: product, error: prodErr } = await db
    .from('products')
    .insert({
      organization_id: organizationId,
      name: newName,
      product_kind: cfg.productKind,
      product_category: source.product_category ?? cfg.productCategory,
      functional_unit: source.functional_unit ?? `1 ${cfg.batchWord} of ${newName}`,
      created_by: userId,
    })
    .select('id')
    .single()
  if (prodErr) return fail(500, prodErr.message)

  const { error: metaErr } = await db.from('hospitality_meal_meta').insert({
    organization_id: organizationId,
    product_id: product.id,
    venue_id: meta?.venue_id ?? null,
    covers: meta?.covers ?? 1,
    portion_note: meta?.portion_note ?? null,
    prep_waste_pct: meta?.prep_waste_pct ?? 0,
    quantities_status: meta?.quantities_status ?? 'confirmed',
    cooking_method: meta?.cooking_method ?? null,
    cooking_minutes: meta?.cooking_minutes ?? null,
    dietary_tags: Array.isArray(meta?.dietary_tags) ? meta!.dietary_tags : [],
    allergens: Array.isArray(meta?.allergens) ? meta!.allergens : [],
    created_by: userId,
  })
  if (metaErr) {
    await db.from('products').delete().eq('id', product.id)
    return fail(500, metaErr.message)
  }

  const { data: mats } = await db
    .from('product_materials')
    .select('material_name, quantity, unit, data_source, data_source_id, openlca_database, supplier_product_id, matched_source_name, cached_co2_factor')
    .eq('product_id', source.id)
    .eq('material_type', 'ingredient')
  if (mats && mats.length > 0) {
    const { error: matErr } = await db.from('product_materials').insert(
      mats.map((m: any) => ({
        product_id: product.id,
        material_type: 'ingredient',
        material_name: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
        data_source: m.data_source ?? null,
        data_source_id: m.data_source_id ?? null,
        openlca_database: m.openlca_database ?? null,
        supplier_product_id: m.supplier_product_id ?? null,
        matched_source_name: m.matched_source_name ?? null,
        cached_co2_factor: m.cached_co2_factor ?? null,
      })),
    )
    if (matErr) return fail(500, matErr.message)
  }

  return ok({ id: product.id })
}

export interface UnconfirmedRecipe {
  id: number
  name: string
  kind: RecipeKind
  covers: number
  quantities_status: string
  ingredients: { id: number; material_name: string; quantity: number; unit: string }[]
}

/**
 * Recipes across all kinds whose quantities are still placeholders (unconfirmed)
 * or AI-estimated — the work-list for the bulk quantity grid.
 */
export async function listUnconfirmedRecipes(
  db: Db,
  organizationId: string,
): Promise<ServiceResult<UnconfirmedRecipe[]>> {
  const { data: metas, error } = await db
    .from('hospitality_meal_meta')
    .select('product_id, covers, quantities_status')
    .eq('organization_id', organizationId)
    .in('quantities_status', ['unconfirmed', 'estimated'])
  if (error) return fail(500, error.message)
  const ids = (metas ?? []).map((m: any) => m.product_id)
  if (ids.length === 0) return ok([])

  const { data: products } = await db
    .from('products')
    .select('id, name, product_kind')
    .in('id', ids)
    .eq('organization_id', organizationId)
  const productById = new Map<number, { name: string; product_kind: string }>()
  for (const p of products ?? []) productById.set(p.id, { name: p.name, product_kind: p.product_kind })

  const { data: mats } = await db
    .from('product_materials')
    .select('id, product_id, material_name, quantity, unit')
    .in('product_id', ids)
    .eq('material_type', 'ingredient')
    .order('id', { ascending: true })
  const matsByProduct = new Map<number, any[]>()
  for (const m of mats ?? []) {
    if (!matsByProduct.has(m.product_id)) matsByProduct.set(m.product_id, [])
    matsByProduct.get(m.product_id)!.push(m)
  }

  const result: UnconfirmedRecipe[] = []
  for (const meta of metas ?? []) {
    const product = productById.get(meta.product_id)
    if (!product) continue
    const kind = RECIPE_KIND_BY_PRODUCT_KIND[product.product_kind]
    if (!kind) continue
    result.push({
      id: meta.product_id,
      name: product.name,
      kind,
      covers: Number(meta.covers ?? 1),
      quantities_status: meta.quantities_status,
      ingredients: (matsByProduct.get(meta.product_id) ?? []).map((m: any) => ({
        id: m.id,
        material_name: m.material_name,
        quantity: Number(m.quantity),
        unit: m.unit,
      })),
    })
  }
  return ok(result)
}

const INGREDIENT_UNIT_VALUES = new Set(MEAL_INGREDIENT_UNITS.map((u) => u.value))

/**
 * Replace a recipe's ingredient quantities in one server-side write (mirrors the
 * client-side delete-and-reinsert in RecipeEditor.persist) and set the quantities
 * status. Used by the bulk quantity grid so the whole menu can be confirmed
 * without opening each dish. Factor columns are not touched here — the editor's
 * Calculate re-matches factors from the names.
 */
export async function setRecipeQuantities(
  db: Db,
  organizationId: string,
  productId: number,
  ingredients: { material_name?: string; quantity: number; unit: string }[],
  status: 'confirmed' | 'estimated',
): Promise<ServiceResult<{ ok: true }>> {
  const { data: meta } = await db
    .from('hospitality_meal_meta')
    .select('product_id')
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!meta) return fail(404, 'Recipe not found')

  const clean = ingredients
    .map((i) => ({
      material_name: String(i.material_name ?? '').trim(),
      quantity: Number(i.quantity),
      unit: String(i.unit ?? '').trim(),
    }))
    .filter((i) => i.material_name.length > 0)
  for (const i of clean) {
    if (!Number.isFinite(i.quantity) || i.quantity <= 0) return fail(400, 'Every ingredient needs a quantity greater than 0')
    if (!INGREDIENT_UNIT_VALUES.has(i.unit)) return fail(400, `Invalid unit "${i.unit}"`)
  }

  const { error: delErr } = await db
    .from('product_materials')
    .delete()
    .eq('product_id', productId)
    .eq('material_type', 'ingredient')
  if (delErr) return fail(500, delErr.message)

  if (clean.length > 0) {
    const { error: insErr } = await db.from('product_materials').insert(
      clean.map((i) => ({
        product_id: productId,
        material_name: i.material_name,
        quantity: i.quantity,
        unit: i.unit,
        material_type: 'ingredient',
      })),
    )
    if (insErr) return fail(500, insErr.message)
  }

  const { error: metaErr } = await db
    .from('hospitality_meal_meta')
    .update({ quantities_status: status })
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
  if (metaErr) return fail(500, metaErr.message)
  return ok({ ok: true })
}
