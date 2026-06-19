/**
 * Shared recipe (meal / made-drink) service.
 *
 * A recipe is a `products` row (product_kind from the kind config) plus a
 * `hospitality_meal_meta` row (venue + portion count). Ingredients and impact
 * calculation are handled client-side via the shared LCA engine; these helpers
 * own creation, the read model and metadata mutations, parameterised by kind so
 * meals and drinks share one code path.
 */

import { perCoverImpact } from './meal-types'
import type { RecipeKindConfig } from './recipe-kinds'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

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

  const { data: metas } = await db
    .from('hospitality_meal_meta')
    .select('product_id, venue_id, covers')
    .in('product_id', ids)
  const metaByProduct = new Map<number, { venue_id: string | null; covers: number }>()
  for (const m of metas ?? []) {
    metaByProduct.set(m.product_id, { venue_id: m.venue_id ?? null, covers: Number(m.covers ?? 1) })
  }

  const venueIds = Array.from(new Set((metas ?? []).map((m: any) => m.venue_id).filter(Boolean)))
  const venueNames = new Map<string, string>()
  if (venueIds.length > 0) {
    const { data: venues } = await db.from('hospitality_venues').select('id, name').in('id', venueIds)
    for (const v of venues ?? []) venueNames.set(v.id, v.name)
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
    const meta = metaByProduct.get(p.id) ?? { venue_id: null, covers: 1 }
    return {
      id: p.id,
      name: p.name,
      venue_id: meta.venue_id,
      venue_name: meta.venue_id ? venueNames.get(meta.venue_id) ?? null : null,
      covers: meta.covers,
      impact: perCoverImpact(latestImpact.get(p.id), meta.covers),
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
    .select('venue_id, covers, portion_note')
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

  return ok({
    id: product.id,
    name: product.name,
    venue_id: meta?.venue_id ?? null,
    covers,
    portion_note: meta?.portion_note ?? null,
    ingredients: (ingredients ?? []).map((m: any) => ({
      id: m.id,
      material_name: m.material_name,
      quantity: Number(m.quantity),
      unit: m.unit,
    })),
    impact: perCoverImpact(pcfs?.[0]?.aggregated_impacts ?? null, covers),
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
