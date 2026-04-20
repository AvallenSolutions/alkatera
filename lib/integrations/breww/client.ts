import 'server-only'

// Breww REST client — stateless, all methods take apiKey explicitly.
// Caller pulls + decrypts from integration_connections.encrypted_config.
//
// Breww API: https://breww.com/api/schema/elements/
// Auth: Bearer token (API key from Settings → Breww Apps & API)
// Pagination: page_size up to 200, responses include { results, next, previous, count }
// Rate limits: 60 req/min, 5000/day

export const BREWW_API_BASE = process.env.BREWW_API_BASE || 'https://breww.com/api'

export interface BrewwSite {
  id: string | number
  name: string
}

export interface BrewwDrink {
  id: number
  name: string
}

export interface BrewwVolume {
  litre?: number | null
  us_gallon?: number | null
}

export interface BrewwWeight {
  kg?: number | null
  lb?: number | null
}

export interface BrewwBatch {
  id: number
  drink: BrewwDrink | null
  batch_code?: string | null
  status?: string | null
  abv?: number | null
  datetime_started?: string | null
  datetime_completed?: string | null
  planned_start_date?: string | null
  planned_volume?: BrewwVolume | null
  total_volume?: BrewwVolume | null
}

// /drink-batch-stock-items-used — top-level, filterable by drink_batch.
// `stock_received` is the nested allocation; the ingredient name lives under
// `stock_received.stock_item.name` in practice. Flagged optional to tolerate shape drift.
export interface BrewwStockItemUsed {
  id: number
  drink_batch?: { id: number } | null
  quantity: number
  stock_received?: {
    id?: number
    stock_item?: { id?: number; name?: string | null } | null
    name?: string | null
  } | null
}

export interface BrewwContainerType {
  id: number
  name: string
  type?: string | null
  gross_capacity?: BrewwVolume | null
  default_weight?: BrewwWeight | null
}

// /stock-items — master ingredient/material catalogue.
export interface BrewwStockItem {
  id: number
  name: string
  type?: string | null       // e.g. 'malt', 'hop', 'yeast', 'adjunct', 'packaging'
  sub_type?: string | null
  unit_stock_tracking_type?: string | null
  obsolete?: boolean | null
}

// /ingredient-batches — prepped ingredients (yeast props, dry-hop blends).
export interface BrewwIngredientBatch {
  id: number
  name?: string | null
  stock_item?: { id: number; name?: string | null } | null
  total_volume?: BrewwVolume | null
  total_weight?: BrewwWeight | null
  created_at?: string | null
}

// /ingredient-batch-stock-items-used — what went into an ingredient batch.
export interface BrewwIngredientBatchStockItemUsed {
  id: number
  ingredient_batch?: { id: number } | null
  drink_batch?: { id: number } | null
  quantity: number
  stock_received?: {
    id?: number
    stock_item?: { id?: number; name?: string | null } | null
    name?: string | null
  } | null
}

// /products — finished-goods SKU catalogue.
export interface BrewwProduct {
  id: number
  name: string
  sku?: string | null
  only_container_type?: { id: number; name?: string | null } | null
  liquid_volume_gross?: BrewwVolume | null
  liquid_volume_taxable?: BrewwVolume | null
  net_weight?: BrewwWeight | null
  weight?: BrewwWeight | null
  total_packaged_beer_quantity?: number | null
  component_drinks?: Array<{ drink?: { id: number; name?: string | null } | null; quantity?: number | null }> | null
  component_stock_items?: Array<{ stock_item?: { id: number; name?: string | null } | null; quantity?: number | null }> | null
  obsolete?: boolean | null
}

// /planned-packagings — batch → SKU plan & actual packaged counts.
export interface BrewwPlannedPackaging {
  id: number
  drink_batch?: { id: number } | null
  product?: { id: number; name?: string | null } | null
  quantity?: number | null
  quantity_packaged_so_far?: number | null
  volume?: BrewwVolume | null
  date?: string | null
  expected_release_date?: string | null
}

// /drink-batch-actions — actual packaging executions + losses.
export interface BrewwDrinkBatchAction {
  id: number
  drink_batch?: { id: number } | null
  action_type?: string | null
  container_type?: { id: number; name?: string | null } | null
  volume_successful?: BrewwVolume | null
  volume_lost?: BrewwVolume | null
  datetime?: string | null
}

class BrewwError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'BrewwError'
  }
}

interface BrewwPage<T> {
  results?: T[]
  data?: T[]
  next?: string | null
  previous?: string | null
  count?: number
}

async function brewwFetch<T>(url: string, apiKey: string): Promise<BrewwPage<T> | T[]> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new BrewwError(res.status, `Breww ${url} failed (${res.status}): ${body.slice(0, 240)}`)
  }
  return (await res.json()) as BrewwPage<T> | T[]
}

/** Fetches all pages for a list endpoint, returning a flat array. */
async function brewwGetAll<T>(path: string, apiKey: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?'
  let url: string | null = `${BREWW_API_BASE}${path}${sep}page_size=200`
  const all: T[] = []

  while (url) {
    const data: BrewwPage<T> | T[] = await brewwFetch<T>(url, apiKey)
    if (Array.isArray(data)) {
      all.push(...data)
      break
    }
    const page = (data.results ?? data.data ?? []) as T[]
    all.push(...page)
    url = data.next ?? null
  }

  return all
}

/** Validates an API key. Returns site count on success. */
export async function pingBreww(apiKey: string): Promise<{ facilitiesCount: number }> {
  const sites = await brewwGetAll<BrewwSite>('/sites', apiKey)
  return { facilitiesCount: sites.length }
}

/** All drinks (beer products) for the account. */
export async function listDrinks(apiKey: string): Promise<BrewwDrink[]> {
  return brewwGetAll<BrewwDrink>('/drinks', apiKey)
}

/** Pick the most useful date on a batch (started → completed → planned). */
export function batchDate(b: BrewwBatch): string | null {
  return b.datetime_started || b.datetime_completed || b.planned_start_date || null
}

/** Convert a batch's best volume reading to hectolitres. */
export function batchVolumeHl(b: BrewwBatch): number {
  const litres = b.total_volume?.litre ?? b.planned_volume?.litre ?? 0
  return (litres || 0) / 100
}

// Breww's /drink-batches returns all statuses. We want In-progress (2) and
// Complete (3) — Planned batches have no allocations and would skew aggregates.
const ACTIVE_BATCH_STATUSES = new Set(['2', '3', 'In-progress', 'Complete'])

/** Drink batches since the given ISO date, across all pages. */
export async function listRecentBatches(apiKey: string, sinceISO: string): Promise<BrewwBatch[]> {
  const batches = await brewwGetAll<BrewwBatch>('/drink-batches', apiKey)
  const since = new Date(sinceISO).getTime()
  return batches.filter((b) => {
    if (b.status != null && !ACTIVE_BATCH_STATUSES.has(String(b.status))) return false
    const ts = batchDate(b)
    if (!ts) return true
    return new Date(ts).getTime() >= since
  })
}

/** All stock-item-used allocations. Top-level endpoint; filter by batch client-side. */
export async function listAllStockItemsUsed(apiKey: string): Promise<BrewwStockItemUsed[]> {
  return brewwGetAll<BrewwStockItemUsed>('/drink-batch-stock-items-used', apiKey)
}

/** All container types defined in the account. */
export async function listContainerTypes(apiKey: string): Promise<BrewwContainerType[]> {
  return brewwGetAll<BrewwContainerType>('/container-types', apiKey)
}

/** Stock-item catalogue (malt, hops, yeast, packaging, etc.). */
export async function listStockItems(apiKey: string): Promise<BrewwStockItem[]> {
  return brewwGetAll<BrewwStockItem>('/stock-items', apiKey)
}

/** Prepped ingredient batches (e.g. yeast propagation, dry-hop blends). */
export async function listIngredientBatches(apiKey: string): Promise<BrewwIngredientBatch[]> {
  return brewwGetAll<BrewwIngredientBatch>('/ingredient-batches', apiKey)
}

/** Raw materials consumed by ingredient batches. */
export async function listIngredientBatchStockItemsUsed(
  apiKey: string,
): Promise<BrewwIngredientBatchStockItemUsed[]> {
  return brewwGetAll<BrewwIngredientBatchStockItemUsed>(
    '/ingredient-batch-stock-items-used',
    apiKey,
  )
}

/** Finished-goods SKUs. */
export async function listProducts(apiKey: string): Promise<BrewwProduct[]> {
  return brewwGetAll<BrewwProduct>('/products', apiKey)
}

/** Planned (and partly-executed) packaging runs — batch → SKU plan. */
export async function listPlannedPackagings(apiKey: string): Promise<BrewwPlannedPackaging[]> {
  return brewwGetAll<BrewwPlannedPackaging>('/planned-packagings', apiKey)
}

/** Actual packaging actions with volume-successful / volume-lost. */
export async function listDrinkBatchActions(apiKey: string): Promise<BrewwDrinkBatchAction[]> {
  return brewwGetAll<BrewwDrinkBatchAction>('/drink-batch-actions', apiKey)
}

export { BrewwError }
