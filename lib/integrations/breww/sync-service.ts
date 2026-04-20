import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listDrinks,
  listRecentBatches,
  listAllStockItemsUsed,
  listContainerTypes,
  batchDate,
  batchVolumeHl,
  type BrewwBatch,
  type BrewwDrink,
  type BrewwStockItemUsed,
  type BrewwContainerType,
} from './client'

// Breww sync service — one-shot pull of the last 12 months of data.
// Idempotent: upserts against unique constraints, so re-running is safe.

const PROVIDER_SLUG = 'breww'
const MONTHS_BACK = 12

export interface SyncResult {
  batchesFetched: number
  productsSeen: number
  runsUpserted: number
  totalHl: number
  ingredientsUpserted: number
  containerTypesUpserted: number
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

  const [drinks, batches, containerTypes, stockItems] = await Promise.all([
    listDrinks(apiKey),
    listRecentBatches(apiKey, sinceISO),
    listContainerTypes(apiKey),
    listAllStockItemsUsed(apiKey).catch((err) => {
      console.warn('[breww/sync] stock-items-used fetch failed:', err?.message ?? err)
      return [] as BrewwStockItemUsed[]
    }),
  ])

  const drinkById = new Map<string, BrewwDrink>()
  for (const d of drinks) drinkById.set(String(d.id), d)

  const [runsUpserted, totalHl] = await syncProductionRuns(
    serviceClient, organizationId, batches, drinkById,
  )

  const ingredientsUpserted = await syncIngredientUsage(
    serviceClient, organizationId, batches, drinkById, stockItems,
  )

  const containerTypesUpserted = await syncContainerTypes(
    serviceClient, organizationId, containerTypes,
  )

  return {
    batchesFetched: batches.length,
    productsSeen: drinks.length,
    runsUpserted,
    totalHl,
    ingredientsUpserted,
    containerTypesUpserted,
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

function ingredientNameOf(item: BrewwStockItemUsed): string | null {
  return (
    item.stock_received?.stock_item?.name ||
    item.stock_received?.name ||
    null
  )
}

async function syncIngredientUsage(
  serviceClient: SupabaseClient,
  organizationId: string,
  batches: BrewwBatch[],
  drinkById: Map<string, BrewwDrink>,
  stockItems: BrewwStockItemUsed[],
): Promise<number> {
  if (stockItems.length === 0) return 0
  const window = windowBounds(MONTHS_BACK)

  // Map batch id → drink info so we can aggregate per product.
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

  for (const item of stockItems) {
    const batchId = item.drink_batch?.id ? String(item.drink_batch.id) : ''
    const drink = batchToDrink.get(batchId)
    if (!drink) continue
    const name = ingredientNameOf(item)
    if (!name) continue
    const key = `${drink.id}|${name}`
    const cur = aggregates.get(key)
    const qty = Number(item.quantity) || 0
    if (cur) {
      cur.total_quantity += qty
    } else {
      aggregates.set(key, {
        product_external_id: drink.id,
        product_name: drink.name,
        ingredient_name: name,
        total_quantity: qty,
        // Breww quantities are SI (kg for solids, litres for liquids). Default to kg;
        // a future enhancement can read unit hints off stock_received.stock_item.
        unit: 'kg',
      })
    }
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
