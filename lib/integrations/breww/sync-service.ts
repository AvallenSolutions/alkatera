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
  listSites,
  extractSite,
  batchDate,
  batchVolumeHl,
  type BrewwBatch,
  type BrewwDrink,
  type BrewwSite,
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
  sitesUpserted: number
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

export type SyncPhase =
  | 'fetching'
  | 'sites'
  | 'production'
  | 'ingredients'
  | 'stock_items'
  | 'containers'
  | 'skus'
  | 'sku_components'
  | 'packaging'
  | 'done'

export interface SyncOptions {
  onPhase?: (phase: SyncPhase, detail?: string) => void
}

export async function syncBreww(
  serviceClient: SupabaseClient,
  organizationId: string,
  apiKey: string,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const phase = (p: SyncPhase, detail?: string) => {
    try { options.onPhase?.(p, detail) } catch { /* swallow */ }
  }
  phase('fetching', 'Pulling data from Breww')
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
    sites,
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
    listSites(apiKey).catch((err) => {
      console.warn('[breww/sync] sites fetch failed:', err?.message ?? err)
      return [] as BrewwSite[]
    }),
  ])

  const drinkById = new Map<string, BrewwDrink>()
  for (const d of drinks) drinkById.set(String(d.id), d)

  const stockItemById = new Map<string, BrewwStockItem>()
  for (const s of stockItemsMaster) stockItemById.set(String(s.id), s)

  phase('sites', `${sites.length} sites`)
  const sitesUpserted = await syncSites(serviceClient, organizationId, sites)
  const siteById = new Map<string, BrewwSite>()
  for (const s of sites) siteById.set(String(s.id), s)

  phase('production', `${batches.length} batches`)
  const [runsUpserted, totalHl] = await syncProductionRuns(
    serviceClient, organizationId, batches, drinkById, siteById,
  )

  phase('ingredients', `${stockItemsUsed.length + ingredientBatchStockItems.length} usage records`)
  const ingredientsUpserted = await syncIngredientUsage(
    serviceClient, organizationId, batches, drinkById,
    stockItemsUsed, ingredientBatchStockItems, stockItemById,
  )

  phase('stock_items', `${stockItemsMaster.length} stock items`)
  const stockItemsUpserted = await syncStockItemsMaster(
    serviceClient, organizationId, stockItemsMaster,
  )

  phase('containers', `${containerTypes.length} container types`)
  const containerTypesUpserted = await syncContainerTypes(
    serviceClient, organizationId, containerTypes,
  )

  const containerById = new Map<string, BrewwContainerType>()
  for (const c of containerTypes) containerById.set(String(c.id), c)

  phase('skus', `${products.length} products`)
  const skusUpserted = await syncProductSkus(
    serviceClient, organizationId, products, drinkById, containerById,
  )

  phase('sku_components', 'packaging components')
  await syncSkuComponents(serviceClient, organizationId, products, stockItemById)

  phase('packaging', `${plannedPackagings.length} packaging runs`)
  const packagingRunsUpserted = await syncPackagingRuns(
    serviceClient, organizationId, plannedPackagings, siteById,
  )
  phase('done')

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
    sitesUpserted,
  }
}

// ─── Sites ────────────────────────────────────────────────────────────────────

async function syncSites(
  serviceClient: SupabaseClient,
  organizationId: string,
  sites: BrewwSite[],
): Promise<number> {
  let upserted = 0
  for (const s of sites) {
    const { error } = await serviceClient
      .from('breww_sites')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(s.id),
          name: s.name,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] site upsert warn:', error.message)
  }
  return upserted
}

// ─── Production runs ──────────────────────────────────────────────────────────

async function syncProductionRuns(
  serviceClient: SupabaseClient,
  organizationId: string,
  batches: BrewwBatch[],
  drinkById: Map<string, BrewwDrink>,
  siteById: Map<string, BrewwSite>,
): Promise<[number, number]> {
  if (batches.length > 0) {
    console.log('[breww/sync] SAMPLE /drink-batches[0] keys:', Object.keys(batches[0] as any))
  }
  const aggregates = new Map<
    string,
    {
      product_external_id: string
      product_name: string
      period_start: string
      period_end: string
      volume_hl: number
      batches_count: number
      site_external_id: string | null
      site_name: string | null
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
    const site = extractSite(b)
    const siteId = site?.id ?? null
    const siteName = site ? site.name ?? siteById.get(site.id)?.name ?? null : null
    const key = `${pid}|${bounds.start}|${siteId ?? '_'}`
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
        site_external_id: siteId,
        site_name: siteName,
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
          site_external_id: agg.site_external_id ?? '_none',
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,provider_slug,product_external_id,period_start,site_external_id' },
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
  if (containerTypes.length > 0) {
    console.log('[breww/sync] SAMPLE /container-types[0] keys:', Object.keys(containerTypes[0] as any))
    console.log('[breww/sync] SAMPLE /container-types[0] raw:', JSON.stringify(containerTypes[0], null, 2).slice(0, 2000))
  }
  let upserted = 0
  for (const ct of containerTypes) {
    const litres = ct.gross_capacity?.litre ?? null
    const kg = ct.default_weight?.kg ?? ct.default_net_weight?.kg ?? null
    const reuse = deriveReuse(ct)
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
          single_use: reuse.single_use,
          expected_trips: reuse.expected_trips,
          sub_type: ct.cask_sub_type ?? ct.smallpack_sub_type ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] container type upsert warn:', error.message)
  }
  return upserted
}

// Decide whether a Breww container type is reusable and, if so, a sensible
// default trip count. Users can override the trip count per container later.
// Defaults: Firkin/Pin/Cask = 100, reusable Keg = 150, everything else = 1.
function deriveReuse(ct: BrewwContainerType): { single_use: boolean; expected_trips: number } {
  const type = (ct.type || '').toUpperCase()
  if (type === 'CASK' || ct.cask_sub_type) {
    return { single_use: false, expected_trips: 100 }
  }
  if (type === 'KEG') {
    if (ct.keg_single_use) return { single_use: true, expected_trips: 1 }
    return { single_use: false, expected_trips: 150 }
  }
  return { single_use: true, expected_trips: 1 }
}

// ─── Product SKUs ─────────────────────────────────────────────────────────────

async function syncProductSkus(
  serviceClient: SupabaseClient,
  organizationId: string,
  products: BrewwProduct[],
  drinkById: Map<string, BrewwDrink>,
  containerById: Map<string, BrewwContainerType>,
): Promise<number> {
  let upserted = 0
  for (const p of products) {
    const firstComponent = p.component_drinks?.[0] ?? null
    const primaryDrinkId = firstComponent?.drink_id != null ? String(firstComponent.drink_id) : null
    const primaryDrinkName =
      firstComponent?.drink_name ||
      (primaryDrinkId ? drinkById.get(primaryDrinkId)?.name ?? null : null)

    const containerId =
      p.only_container_type != null
        ? String(p.only_container_type)
        : firstComponent?.container_type_id != null
        ? String(firstComponent.container_type_id)
        : null
    const containerName =
      (containerId ? containerById.get(containerId)?.name ?? null : null) ||
      firstComponent?.container_type ||
      null

    const { error } = await serviceClient
      .from('breww_products_skus')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(p.id),
          name: p.name,
          sku: p.code ?? null,
          container_external_id: containerId,
          container_name: containerName,
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

// ─── SKU component stock items (secondary packaging) ─────────────────────────

async function syncSkuComponents(
  serviceClient: SupabaseClient,
  organizationId: string,
  products: BrewwProduct[],
  stockItemById: Map<string, BrewwStockItem>,
): Promise<number> {
  let upserted = 0
  for (const p of products) {
    const components = Array.isArray(p.component_stock_items) ? p.component_stock_items : []
    if (components.length === 0) continue
    for (const c of components) {
      const stockId = c?.stock_item_id ?? c?.stock_item?.id ?? null
      const embeddedName = c?.stock_item_name ?? c?.stock_item?.name ?? c?.name ?? null
      const name = embeddedName
        || (stockId != null ? stockItemById.get(String(stockId))?.name ?? null : null)
      if (!name) continue
      const quantity = Number(c?.quantity ?? c?.quantity_per_product ?? 0) || null
      const unit = c?.unit ?? c?.unit_name ?? null
      const { error } = await serviceClient
        .from('breww_sku_components')
        .upsert(
          {
            organization_id: organizationId,
            sku_external_id: String(p.id),
            stock_item_external_id: stockId != null ? String(stockId) : null,
            stock_item_name: name,
            quantity,
            unit,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,sku_external_id,stock_item_name' },
        )
      if (!error) upserted += 1
      else console.warn('[breww/sync] sku component upsert warn:', error.message)
    }
  }
  return upserted
}

// ─── Packaging runs ───────────────────────────────────────────────────────────

async function syncPackagingRuns(
  serviceClient: SupabaseClient,
  organizationId: string,
  plannedPackagings: BrewwPlannedPackaging[],
  siteById: Map<string, BrewwSite>,
): Promise<number> {
  let upserted = 0
  let failed = 0
  if (plannedPackagings.length > 0) {
    console.log('[breww/sync] SAMPLE /planned-packagings[0] keys:', Object.keys(plannedPackagings[0] as any))
    console.log('[breww/sync] SAMPLE /planned-packagings[0] raw:', JSON.stringify(plannedPackagings[0], null, 2).slice(0, 2000))
  }
  for (const pp of plannedPackagings) {
    const site = extractSite(pp)
    const siteName = site ? site.name ?? siteById.get(site.id)?.name ?? null : null
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
          site_external_id: site?.id ?? null,
          site_name: siteName,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else {
      failed += 1
      if (failed <= 3) console.warn('[breww/sync] packaging run upsert warn:', error.message)
    }
  }
  if (failed > 0) console.warn(`[breww/sync] packaging runs: ${upserted} ok, ${failed} failed`)
  return upserted
}
