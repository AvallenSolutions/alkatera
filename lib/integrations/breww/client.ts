import 'server-only'

// Breww REST client — stateless, all methods take an OAuth access token.
// Caller resolves it via lib/integrations/breww/get-access-token.ts which
// transparently refreshes the cached token in integration_connections.
//
// Breww API: https://breww.com/api/schema/elements/
// Auth: OAuth2 Bearer token (public app, see lib/integrations/breww/oauth.ts)
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
  // Site where brewing happened. Breww's shape varies across endpoints;
  // tolerate bare id, nested object, or legacy `brewery` alias.
  site?: number | string | { id?: number | string; name?: string | null } | null
  site_id?: number | string | null
  brewery?: number | string | { id?: number | string; name?: string | null } | null
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
  default_net_weight?: BrewwWeight | null
  // KEG-type containers can be marked as single-use (disposable plastic kegs).
  // Absent/false = reusable. CASK sub_types (firkin, pin) are always reusable.
  keg_single_use?: boolean | null
  cask_sub_type?: string | null
  smallpack_sub_type?: string | null
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
// Real shape (confirmed via sample response):
// - `only_container_type` is a bare numeric id (not an object). Look up the
//   name via `breww_container_types`.
// - `component_drinks[].drink_id` and `drink_name` live at the top level of
//   each entry (no nested `drink` object).
// - There is no `sku` field; the Breww short code is `code`.
export interface BrewwProduct {
  id: number
  name: string
  code?: string | null
  only_container_type?: number | null
  only_drink_type?: number | null
  liquid_volume_gross?: BrewwVolume | null
  liquid_volume_taxable?: BrewwVolume | null
  net_weight?: BrewwWeight | null
  weight?: BrewwWeight | null
  total_packaged_beer_quantity?: number | null
  component_drinks?: Array<{
    drink_id?: string | number | null
    drink_name?: string | null
    container_type?: string | null
    container_type_id?: number | null
    quantity_in_product?: number | null
  }> | null
  component_stock_items?: Array<any> | null
  obsolete?: boolean | null
  type?: number | null
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
  // Site where packaging happened. Shape varies; probe defensively.
  site?: number | string | { id?: number | string; name?: string | null } | null
  site_id?: number | string | null
  packaging_site?: number | string | { id?: number | string; name?: string | null } | null
}

// Helper: extract (id, name) from any of the site fields we've seen on Breww.
export function extractSite(obj: any): { id: string; name: string | null } | null {
  const raw =
    obj?.site ??
    obj?.site_id ??
    obj?.packaging_site ??
    obj?.brewery ??
    null
  if (raw == null) return null
  if (typeof raw === 'number' || typeof raw === 'string') {
    return { id: String(raw), name: null }
  }
  if (typeof raw === 'object' && raw.id != null) {
    return { id: String(raw.id), name: raw.name ?? null }
  }
  return null
}

/** List Breww sites. */
export async function listSites(accessToken: string): Promise<BrewwSite[]> {
  return brewwGetAll<BrewwSite>('/sites', accessToken)
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

async function brewwFetch<T>(url: string, accessToken: string): Promise<BrewwPage<T> | T[]> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
async function brewwGetAll<T>(path: string, accessToken: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?'
  let url: string | null = `${BREWW_API_BASE}${path}${sep}page_size=200`
  const all: T[] = []

  while (url) {
    const data: BrewwPage<T> | T[] = await brewwFetch<T>(url, accessToken)
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
export async function pingBreww(accessToken: string): Promise<{ facilitiesCount: number }> {
  const sites = await brewwGetAll<BrewwSite>('/sites', accessToken)
  return { facilitiesCount: sites.length }
}

/** All drinks (beer products) for the account. */
export async function listDrinks(accessToken: string): Promise<BrewwDrink[]> {
  return brewwGetAll<BrewwDrink>('/drinks', accessToken)
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
export async function listRecentBatches(accessToken: string, sinceISO: string): Promise<BrewwBatch[]> {
  const batches = await brewwGetAll<BrewwBatch>('/drink-batches', accessToken)
  const since = new Date(sinceISO).getTime()
  return batches.filter((b) => {
    if (b.status != null && !ACTIVE_BATCH_STATUSES.has(String(b.status))) return false
    const ts = batchDate(b)
    if (!ts) return true
    return new Date(ts).getTime() >= since
  })
}

/** All stock-item-used allocations. Top-level endpoint; filter by batch client-side. */
export async function listAllStockItemsUsed(accessToken: string): Promise<BrewwStockItemUsed[]> {
  return brewwGetAll<BrewwStockItemUsed>('/drink-batch-stock-items-used', accessToken)
}

/** All container types defined in the account. */
export async function listContainerTypes(accessToken: string): Promise<BrewwContainerType[]> {
  return brewwGetAll<BrewwContainerType>('/container-types', accessToken)
}

/** Stock-item catalogue (malt, hops, yeast, packaging, etc.). */
export async function listStockItems(accessToken: string): Promise<BrewwStockItem[]> {
  return brewwGetAll<BrewwStockItem>('/stock-items', accessToken)
}

/** Prepped ingredient batches (e.g. yeast propagation, dry-hop blends). */
export async function listIngredientBatches(accessToken: string): Promise<BrewwIngredientBatch[]> {
  return brewwGetAll<BrewwIngredientBatch>('/ingredient-batches', accessToken)
}

/** Raw materials consumed by ingredient batches. */
export async function listIngredientBatchStockItemsUsed(
  accessToken: string,
): Promise<BrewwIngredientBatchStockItemUsed[]> {
  return brewwGetAll<BrewwIngredientBatchStockItemUsed>(
    '/ingredient-batch-stock-items-used',
    accessToken,
  )
}

/** Finished-goods SKUs. */
export async function listProducts(accessToken: string): Promise<BrewwProduct[]> {
  return brewwGetAll<BrewwProduct>('/products', accessToken)
}

/** Planned (and partly-executed) packaging runs — batch → SKU plan. */
export async function listPlannedPackagings(accessToken: string): Promise<BrewwPlannedPackaging[]> {
  return brewwGetAll<BrewwPlannedPackaging>('/planned-packagings', accessToken)
}

/** Actual packaging actions with volume-successful / volume-lost. */
export async function listDrinkBatchActions(accessToken: string): Promise<BrewwDrinkBatchAction[]> {
  return brewwGetAll<BrewwDrinkBatchAction>('/drink-batch-actions', accessToken)
}

export { BrewwError }
