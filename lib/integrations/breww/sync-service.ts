import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listDrinks,
  listRecentBatches,
  listAllStockItemsUsed,
  listContainerTypes,
  listStockItems,
  listIngredientBatchStockItemsUsed,
  listProducts,
  listPlannedPackagings,
  batchDate,
  batchVolumeHl,
  type BrewwBatch,
  type BrewwDrink,
  type BrewwStockItem,
  type BrewwStockItemUsed,
  type BrewwIngredientBatchStockItemUsed,
  type BrewwContainerType,
  type BrewwProduct,
  type BrewwPlannedPackaging,
} from './client'

// Breww sync service — one-shot pull of the last 12 months of data.
// Idempotent: upserts against unique constraints, so re-running is safe.

const PROVIDER_SLUG = 'breww'
const MONTHS_BACK = 12

export interface SyncResult {
  batchesFetched: number
  productsSeen: number
  skusUpserted: number
  runsUpserted: number
  totalHl: number
  ingredientsUpserted: number
  stockItemsUpserted: number
  containerTypesUpserted: number
  packagingRunsUpserted: number
}

function monthBounds(iso: string): { start: string; end: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
  return { start, end }
}

function windowBounds(monthsBack: number): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function syncBreww(
  serviceClient: SupabaseClient,
  organizationId: string,
  apiKey: string,
): Promise<SyncResult> {
  const sinceISO = (() => {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - MONTHS_BACK)
    return d.toISOString()
  })()

  const [
    drinks,
    batches,
    containerTypes,
    stockItemsUsed,
    stockItemsMaster,
    ingredientBatchStockItems,
    products,
    plannedPackagings,
  ] = await Promise.all([
    listDrinks(apiKey),
    listRecentBatches(apiKey, sinceISO),
    listContainerTypes(apiKey),
    listAllStockItemsUsed(apiKey).catch((err) => {
      console.warn('[breww/sync] stock-items-used fetch failed:', err?.message ?? err)
      return [] as BrewwStockItemUsed[]
    }),
    listStockItems(apiKey).catch((err) => {
      console.warn('[breww/sync] stock-items fetch failed:', err?.message ?? err)
      return [] as BrewwStockItem[]
    }),
    listIngredientBatchStockItemsUsed(apiKey).catch((err) => {
      console.warn('[breww/sync] ingredient-batch-stock-items-used fetch failed:', err?.message ?? err)
      return [] as BrewwIngredientBatchStockItemUsed[]
    }),
    listProducts(apiKey).catch((err) => {
      console.warn('[breww/sync] products fetch failed:', err?.message ?? err)
      return [] as BrewwProduct[]
    }),
    listPlannedPackagings(apiKey).catch((err) => {
      console.warn('[breww/sync] planned-packagings fetch failed:', err?.message ?? err)
      return [] as BrewwPlannedPackaging[]
    }),
  ])

  const drinkById = new Map<string, BrewwDrink>()
  for (const d of drinks) drinkById.set(String(d.id), d)

  const stockItemById = new Map<string, BrewwStockItem>()
  for (const s of stockItemsMaster) stockItemById.set(String(s.id), s)

  const [runsUpserted, totalHl] = await syncProductionRuns(
    serviceClient, organizationId, batches, drinkById,
  )

  const ingredientsUpserted = await syncIngredientUsage(
    serviceClient, organizationId, batches, drinkById,
    stockItemsUsed, ingredientBatchStockItems, stockItemById,
  )

  const stockItemsUpserted = await syncStockItemsMaster(
    serviceClient, organizationId, stockItemsMaster,
  )

  const containerTypesUpserted = await syncContainerTypes(
    serviceClient, organizationId, containerTypes,
  )

  const skusUpserted = await syncProductSkus(
    serviceClient, organizationId, products, drinkById,
  )

  const packagingRunsUpserted = await syncPackagingRuns(
    serviceClient, organizationId, plannedPackagings,
  )

  return {
    batchesFetched: batches.length,
    productsSeen: drinks.length,
    skusUpserted,
    runsUpserted,
    totalHl,
    ingredientsUpserted,
    stockItemsUpserted,
    containerTypesUpserted,
    packagingRunsUpserted,
  }
}

// ─── Production runs ──────────────────────────────────────────────────────────

async function syncProductionRuns(
  serviceClient: SupabaseClient,
  organizationId: string,
  batches: BrewwBatch[],
  drinkById: Map<string, BrewwDrink>,
): Promise<[number, number]> {
  const aggregates = new Map<
    string,
    {
      product_external_id: string
      product_name: string
      period_start: string
      period_end: string
      volume_hl: number
      batches_count: number
    }
  >()

  for (const b of batches) {
    const iso = batchDate(b)
    if (!iso) continue
    const bounds = monthBounds(iso)
    if (!bounds) continue
    const pid = b.drink ? String(b.drink.id) : ''
    if (!pid) continue
    const name = b.drink?.name || drinkById.get(pid)?.name || `Product ${pid}`
    const key = `${pid}|${bounds.start}`
    const vol = batchVolumeHl(b)
    const cur = aggregates.get(key)
    if (cur) {
      cur.volume_hl += vol
      cur.batches_count += 1
    } else {
      aggregates.set(key, {
        product_external_id: pid,
        product_name: name,
        period_start: bounds.start,
        period_end: bounds.end,
        volume_hl: vol,
        batches_count: 1,
      })
    }
  }

  let upserted = 0
  let totalHl = 0
  for (const agg of Array.from(aggregates.values())) {
    totalHl += agg.volume_hl
    const { error } = await serviceClient
      .from('brewery_production_runs')
      .upsert(
        {
          organization_id: organizationId,
          provider_slug: PROVIDER_SLUG,
          ...agg,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,provider_slug,product_external_id,period_start' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] production run upsert warn:', error.message)
  }

  return [upserted, totalHl]
}

// ─── Ingredient usage ─────────────────────────────────────────────────────────

function resolveIngredientName(
  item: Pick<BrewwStockItemUsed, 'stock_received'>,
  stockItemById: Map<string, BrewwStockItem>,
): string | null {
  const sr = item.stock_received
  const embeddedName = sr?.stock_item?.name || sr?.name
  if (embeddedName) return embeddedName
  const sid = sr?.stock_item?.id
  if (sid != null) return stockItemById.get(String(sid))?.name ?? null
  return null
}

async function syncIngredientUsage(
  serviceClient: SupabaseClient,
  organizationId: string,
  batches: BrewwBatch[],
  drinkById: Map<string, BrewwDrink>,
  directStockItemsUsed: BrewwStockItemUsed[],
  ingredientBatchItems: BrewwIngredientBatchStockItemUsed[],
  stockItemById: Map<string, BrewwStockItem>,
): Promise<number> {
  const window = windowBounds(MONTHS_BACK)

  const batchToDrink = new Map<string, { id: string; name: string }>()
  for (const b of batches) {
    if (!b.drink) continue
    const name = b.drink.name || drinkById.get(String(b.drink.id))?.name || `Product ${b.drink.id}`
    batchToDrink.set(String(b.id), { id: String(b.drink.id), name })
  }

  const aggregates = new Map<
    string,
    {
      product_external_id: string
      product_name: string
      ingredient_name: string
      total_quantity: number
      unit: string
    }
  >()

  const pushAllocation = (
    drink: { id: string; name: string },
    name: string,
    qty: number,
    unit: string,
  ) => {
    const key = `${drink.id}|${name}`
    const cur = aggregates.get(key)
    if (cur) {
      cur.total_quantity += qty
    } else {
      aggregates.set(key, {
        product_external_id: drink.id,
        product_name: drink.name,
        ingredient_name: name,
        total_quantity: qty,
        unit,
      })
    }
  }

  // Direct drink-batch allocations.
  for (const item of directStockItemsUsed) {
    const batchId = item.drink_batch?.id ? String(item.drink_batch.id) : ''
    const drink = batchToDrink.get(batchId)
    if (!drink) continue
    const name = resolveIngredientName(item, stockItemById)
    if (!name) continue
    pushAllocation(drink, name, Number(item.quantity) || 0, 'kg')
  }

  // Ingredient-batch allocations: these belong to a drink batch via item.drink_batch.
  // (Breww records the parent drink batch on the ingredient-batch-level rows too.)
  for (const item of ingredientBatchItems) {
    const batchId = item.drink_batch?.id ? String(item.drink_batch.id) : ''
    const drink = batchToDrink.get(batchId)
    if (!drink) continue
    const name = resolveIngredientName(item, stockItemById)
    if (!name) continue
    pushAllocation(drink, name, Number(item.quantity) || 0, 'kg')
  }

  let upserted = 0
  for (const agg of Array.from(aggregates.values())) {
    const { error } = await serviceClient
      .from('breww_ingredient_usage')
      .upsert(
        {
          organization_id: organizationId,
          ...agg,
          period_start: window.start,
          period_end: window.end,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,product_external_id,ingredient_name,period_start' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] ingredient upsert warn:', error.message)
  }

  return upserted
}

// ─── Stock-item master ────────────────────────────────────────────────────────

async function syncStockItemsMaster(
  serviceClient: SupabaseClient,
  organizationId: string,
  stockItems: BrewwStockItem[],
): Promise<number> {
  let upserted = 0
  for (const s of stockItems) {
    const { error } = await serviceClient
      .from('breww_stock_items')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(s.id),
          name: s.name,
          type: s.type ?? null,
          sub_type: s.sub_type ?? null,
          unit: s.unit_stock_tracking_type ?? null,
          obsolete: !!s.obsolete,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] stock item upsert warn:', error.message)
  }
  return upserted
}

// ─── Container types ──────────────────────────────────────────────────────────

async function syncContainerTypes(
  serviceClient: SupabaseClient,
  organizationId: string,
  containerTypes: BrewwContainerType[],
): Promise<number> {
  let upserted = 0
  for (const ct of containerTypes) {
    const litres = ct.gross_capacity?.litre ?? null
    const kg = ct.default_weight?.kg ?? null
    const { error } = await serviceClient
      .from('breww_container_types')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(ct.id),
          name: ct.name,
          volume_ml: litres != null ? litres * 1000 : null,
          weight_g: kg != null ? kg * 1000 : null,
          material_type: ct.type ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] container type upsert warn:', error.message)
  }
  return upserted
}

// ─── Product SKUs ─────────────────────────────────────────────────────────────

async function syncProductSkus(
  serviceClient: SupabaseClient,
  organizationId: string,
  products: BrewwProduct[],
  drinkById: Map<string, BrewwDrink>,
): Promise<number> {
  let upserted = 0
  for (const p of products) {
    const primaryDrink = p.component_drinks?.[0]?.drink ?? null
    const primaryDrinkId = primaryDrink?.id != null ? String(primaryDrink.id) : null
    const primaryDrinkName =
      primaryDrink?.name || (primaryDrinkId ? drinkById.get(primaryDrinkId)?.name ?? null : null)
    const { error } = await serviceClient
      .from('breww_products_skus')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(p.id),
          name: p.name,
          sku: p.sku ?? null,
          container_external_id: p.only_container_type?.id != null ? String(p.only_container_type.id) : null,
          container_name: p.only_container_type?.name ?? null,
          liquid_volume_ml: p.liquid_volume_gross?.litre != null ? p.liquid_volume_gross.litre * 1000 : null,
          liquid_volume_taxable_ml: p.liquid_volume_taxable?.litre != null ? p.liquid_volume_taxable.litre * 1000 : null,
          net_weight_g: p.net_weight?.kg != null ? p.net_weight.kg * 1000 : null,
          gross_weight_g: p.weight?.kg != null ? p.weight.kg * 1000 : null,
          total_packaged_quantity: p.total_packaged_beer_quantity ?? null,
          primary_drink_external_id: primaryDrinkId,
          primary_drink_name: primaryDrinkName,
          obsolete: !!p.obsolete,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] product sku upsert warn:', error.message)
  }
  return upserted
}

// ─── Packaging runs ───────────────────────────────────────────────────────────

async function syncPackagingRuns(
  serviceClient: SupabaseClient,
  organizationId: string,
  plannedPackagings: BrewwPlannedPackaging[],
): Promise<number> {
  let upserted = 0
  for (const pp of plannedPackagings) {
    const { error } = await serviceClient
      .from('breww_packaging_runs')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(pp.id),
          batch_external_id: pp.drink_batch?.id != null ? String(pp.drink_batch.id) : null,
          product_external_id: pp.product?.id != null ? String(pp.product.id) : null,
          product_name: pp.product?.name ?? null,
          quantity_planned: pp.quantity ?? null,
          quantity_packaged: pp.quantity_packaged_so_far ?? null,
          volume_ml: pp.volume?.litre != null ? pp.volume.litre * 1000 : null,
          packaged_at: pp.date ?? pp.expected_release_date ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] packaging run upsert warn:', error.message)
  }
  return upserted
}
