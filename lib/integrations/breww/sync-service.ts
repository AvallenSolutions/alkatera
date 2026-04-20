import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listDrinks,
  listRecentBatches,
  listBatchIngredientsUsed,
  listContainerTypes,
  type BrewwBatch,
  type BrewwDrink,
} from './client'

// Breww sync service — one-shot pull of the last 12 months of data.
// Non-incremental by design: all tables have unique constraints and we upsert,
// so running sync twice is idempotent.
//
// Three tables populated:
//   brewery_production_runs    — monthly volume per product
//   breww_ingredient_usage     — 12-month ingredient totals per product
//   breww_container_types      — packaging container master data

const PROVIDER_SLUG = 'breww'
const MONTHS_BACK = 12
// Max concurrent ingredient-usage fetches. Breww allows 60 req/min.
const INGREDIENT_CONCURRENCY = 5

export interface SyncResult {
  batchesFetched: number
  productsSeen: number
  runsUpserted: number
  totalHl: number
  ingredientsUpserted: number
  containerTypesUpserted: number
}

function batchVolumeHl(b: BrewwBatch): number {
  if (typeof b.volume_hl === 'number' && Number.isFinite(b.volume_hl)) return b.volume_hl
  if (typeof b.volume_l === 'number' && Number.isFinite(b.volume_l)) return b.volume_l / 100
  return 0
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

/** Run all Breww-related syncs and return counts. */
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

  // Fetch drinks, batches, and container types in parallel.
  const [drinks, batches, containerTypes] = await Promise.all([
    listDrinks(apiKey),
    listRecentBatches(apiKey, sinceISO),
    listContainerTypes(apiKey),
  ])

  const drinkById = new Map<string, BrewwDrink>()
  for (const d of drinks) drinkById.set(String(d.id), d)

  const [runsUpserted, totalHl] = await syncProductionRuns(
    serviceClient, organizationId, batches, drinkById,
  )

  const ingredientsUpserted = await syncIngredientUsage(
    serviceClient, organizationId, apiKey, batches, drinkById,
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
  type Key = string
  const aggregates = new Map<
    Key,
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
    const iso = b.brewed_at || b.packaged_at
    if (!iso) continue
    const bounds = monthBounds(iso)
    if (!bounds) continue
    const pid = String(b.drink_id ?? b.product_id ?? '')
    if (!pid) continue
    const drink = drinkById.get(pid)
    const name = b.product_name || drink?.name || `Product ${pid}`
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

async function syncIngredientUsage(
  serviceClient: SupabaseClient,
  organizationId: string,
  apiKey: string,
  batches: BrewwBatch[],
  drinkById: Map<string, BrewwDrink>,
): Promise<number> {
  const window = windowBounds(MONTHS_BACK)

  // Aggregate: (product_external_id, ingredient_name) → { total_quantity, unit }
  type IngKey = string
  const aggregates = new Map<
    IngKey,
    {
      product_external_id: string
      product_name: string
      ingredient_name: string
      total_quantity: number
      unit: string
    }
  >()

  // Fetch stock-items-used for all batches with controlled concurrency.
  const batchChunks: BrewwBatch[][] = []
  for (let i = 0; i < batches.length; i += INGREDIENT_CONCURRENCY) {
    batchChunks.push(batches.slice(i, i + INGREDIENT_CONCURRENCY))
  }

  for (const chunk of batchChunks) {
    const results = await Promise.allSettled(
      chunk.map((b) => listBatchIngredientsUsed(apiKey, b.id)),
    )
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i]
      const result = results[i]
      if (result.status === 'rejected') {
        console.warn(`[breww/sync] ingredient fetch failed for batch ${b.id}:`, result.reason)
        continue
      }
      const pid = String(b.drink_id ?? b.product_id ?? '')
      if (!pid) continue
      const drink = drinkById.get(pid)
      const productName = b.product_name || drink?.name || `Product ${pid}`

      for (const item of result.value) {
        const key = `${pid}|${item.stock_item_name}`
        const cur = aggregates.get(key)
        if (cur) {
          cur.total_quantity += item.quantity
        } else {
          aggregates.set(key, {
            product_external_id: pid,
            product_name: productName,
            ingredient_name: item.stock_item_name,
            total_quantity: item.quantity,
            unit: item.unit || 'kg',
          })
        }
      }
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
  containerTypes: Awaited<ReturnType<typeof listContainerTypes>>,
): Promise<number> {
  let upserted = 0
  for (const ct of containerTypes) {
    const { error } = await serviceClient
      .from('breww_container_types')
      .upsert(
        {
          organization_id: organizationId,
          external_id: String(ct.id),
          name: ct.name,
          volume_ml: ct.volume_ml ?? null,
          weight_g: ct.weight_g ?? null,
          material_type: ct.material_type ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,external_id' },
      )
    if (!error) upserted += 1
    else console.warn('[breww/sync] container type upsert warn:', error.message)
  }
  return upserted
}
