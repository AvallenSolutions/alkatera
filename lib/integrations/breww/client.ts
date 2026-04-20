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
  id: string | number
  name: string
  sku?: string | null
}

export interface BrewwBatch {
  id: string | number
  drink_id?: string | number
  product_id?: string | number // fallback field name
  product_name?: string
  brewed_at?: string // ISO date
  packaged_at?: string
  volume_hl?: number
  volume_l?: number
}

export interface BrewwStockItemUsed {
  id: string | number
  stock_item_id: string | number
  stock_item_name: string
  quantity: number
  unit: string
}

export interface BrewwContainerType {
  id: string | number
  name: string
  volume_ml?: number | null
  weight_g?: number | null
  material_type?: string | null
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

/** Drink batches since the given ISO date, across all pages. */
export async function listRecentBatches(apiKey: string, sinceISO: string): Promise<BrewwBatch[]> {
  const qs = new URLSearchParams({ since: sinceISO })
  const batches = await brewwGetAll<BrewwBatch>(`/drink-batches?${qs.toString()}`, apiKey)
  const since = new Date(sinceISO).getTime()
  return batches.filter((b) => {
    const ts = b.brewed_at || b.packaged_at
    if (!ts) return true
    return new Date(ts).getTime() >= since
  })
}

/** Stock items (ingredients + packaging) consumed by a specific batch. */
export async function listBatchIngredientsUsed(
  apiKey: string,
  batchId: string | number,
): Promise<BrewwStockItemUsed[]> {
  return brewwGetAll<BrewwStockItemUsed>(`/drink-batches/${batchId}/stock-items-used`, apiKey)
}

/** All container types defined in the account. */
export async function listContainerTypes(apiKey: string): Promise<BrewwContainerType[]> {
  return brewwGetAll<BrewwContainerType>('/container-types', apiKey)
}

export { BrewwError }
