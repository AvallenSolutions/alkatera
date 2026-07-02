import 'server-only'
import { createHmac } from 'crypto'

// Unleashed REST client.
// Docs: https://apidocs.unleashedsoftware.com/
//
// Auth: every request carries `api-auth-id` (the API ID) and
// `api-auth-signature`, which is a base64 HMAC-SHA256 of the query string
// (everything after `?`, without the leading `?`) signed with the API key.
// For requests with no query string, the signed value is an empty string.

export const UNLEASHED_API_BASE =
  process.env.UNLEASHED_API_BASE || 'https://api.unleashedsoftware.com'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UnleashedCredentials {
  apiId: string
  apiKey: string
}

export interface UnleashedPagination {
  NumberOfItems?: number
  PageSize?: number
  PageNumber?: number
  NumberOfPages?: number
}

export interface UnleashedListResponse<T> {
  Pagination?: UnleashedPagination
  Items: T[]
}

export interface UnleashedProduct {
  Guid: string
  ProductCode: string
  ProductDescription?: string | null
  ProductGroup?: { GroupName?: string | null } | null
  // Brand lives under ProductBrand.BrandName in the real API response.
  ProductBrand?: { BrandName?: string | null } | null
  UnitOfMeasure?: { Name?: string | null } | null
  PackSize?: number | null
  Weight?: number | null
  DefaultPurchasePrice?: number | null
  DefaultSellPrice?: number | null
  IsAssembledProduct?: boolean | null
  IsComponent?: boolean | null
  Obsolete?: boolean | null
  // Top-level Supplier shortcut included in product detail — useful for
  // linking a product to its primary supplier without a separate PO query.
  Supplier?: {
    Guid?: string | null
    SupplierCode?: string | null
    SupplierName?: string | null
  } | null
}

export interface UnleashedBillOfMaterials {
  Guid: string
  // Parent assembly
  Product: { Guid: string; ProductCode?: string; ProductDescription?: string | null }
  BillOfMaterialsLines?: Array<{
    Guid?: string
    LineNumber?: number
    Product: { Guid: string; ProductCode?: string; ProductDescription?: string | null }
    Quantity: number
    // Unleashed calls this WastageQuantity in BOM lines (not a % — it's a raw qty to scrap).
    WastageQuantity?: number | null
    UnitOfMeasure?: { Name?: string | null } | null
  }>
}

export interface UnleashedSupplier {
  Guid: string
  SupplierCode?: string | null
  SupplierName: string
  // The real API response uses `Email` not `ContactEmail`.
  Email?: string | null
  Currency?: { CurrencyCode?: string | null } | null
  Obsolete?: boolean | null
  // Country lives inside Addresses[0].Country — we extract it in the sync service.
  Addresses?: Array<{ Country?: string | null; City?: string | null }> | null
}

export interface UnleashedWarehouse {
  Guid: string
  WarehouseCode?: string | null
  WarehouseName: string
  IsDefault?: boolean | null
  City?: string | null
  Country?: string | null
}

export interface UnleashedPurchaseOrderLine {
  LineNumber: number
  Product?: { Guid?: string; ProductCode?: string; ProductDescription?: string | null } | null
  OrderQuantity?: number | null
  UnitPrice?: number | null
  LineTotal?: number | null
}

export interface UnleashedPurchaseOrder {
  Guid: string
  OrderNumber?: string | null
  OrderDate?: string | null
  OrderStatus?: string | null
  Supplier?: {
    Guid?: string | null
    SupplierName?: string | null
    Currency?: { CurrencyCode?: string | null } | null
  } | null
  PurchaseOrderLines?: UnleashedPurchaseOrderLine[]
}

export interface UnleashedWebhookSubscription {
  Guid?: string
  Url: string
  Events: string[]
  // Returned ONCE on creation. Stored on integration_connections.encrypted_config.webhookKey.
  SignatureKey?: string
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class UnleashedError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message)
    this.name = 'UnleashedError'
  }
}

// ── Signing ──────────────────────────────────────────────────────────────────

/**
 * Sign an Unleashed query string. The query string passed in MUST NOT include
 * the leading `?`. For an endpoint with no query, pass an empty string.
 *
 * Reference: https://apidocs.unleashedsoftware.com/Authentication
 */
export function signUnleashedQuery(queryString: string, apiKey: string): string {
  return createHmac('sha256', apiKey).update(queryString, 'utf-8').digest('base64')
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

interface FetchOpts {
  query?: Record<string, string | number | boolean | undefined>
  page?: number
  pageSize?: number
}

function buildQueryString(opts: FetchOpts): string {
  const params = new URLSearchParams()
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize))
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }
  }
  // Sort keys for deterministic signing — Unleashed signs whatever you send,
  // but stable order makes signature mismatches easier to debug.
  const sorted = new URLSearchParams(Array.from(params.entries()).sort())
  return sorted.toString()
}

async function unleashedFetch<T>(
  path: string,
  creds: UnleashedCredentials,
  opts: FetchOpts = {},
): Promise<T> {
  const qs = buildQueryString(opts)
  // The page number is in the URL path for paged endpoints, not the query string.
  const pagedPath = opts.page && opts.page > 1 ? `${path}/Page/${opts.page}` : path
  const url = `${UNLEASHED_API_BASE}${pagedPath}${qs ? `?${qs}` : ''}`
  const signature = signUnleashedQuery(qs, creds.apiKey)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'api-auth-id': creds.apiId,
      'api-auth-signature': signature,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'client-type': 'alkatera/integration',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new UnleashedError(
      res.status,
      `Unleashed ${path} failed (${res.status}): ${body.slice(0, 240)}`,
      body,
    )
  }
  return (await res.json()) as T
}

/**
 * Iterate every page of a list endpoint and return a flat array.
 * Unleashed paginates 1-indexed via /Page/{n} and includes Pagination metadata.
 */
async function listAll<T>(
  path: string,
  creds: UnleashedCredentials,
  opts: FetchOpts = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 200
  const items: T[] = []
  let page = 1
  // Hard cap to avoid runaway loops on a misbehaving API.
  const MAX_PAGES = 200
  while (page <= MAX_PAGES) {
    const data = await unleashedFetch<UnleashedListResponse<T>>(path, creds, {
      ...opts,
      pageSize,
      page,
    })
    const batch = data.Items ?? []
    items.push(...batch)
    const totalPages = data.Pagination?.NumberOfPages ?? 1
    if (page >= totalPages || batch.length === 0) break
    page += 1
  }
  return items
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Validate creds with a cheap call. /Currencies always returns rows for any account. */
export async function pingUnleashed(
  creds: UnleashedCredentials,
): Promise<{ currenciesCount: number }> {
  const data = await unleashedFetch<UnleashedListResponse<{ Guid: string }>>(
    '/Currencies',
    creds,
    { pageSize: 200 },
  )
  return { currenciesCount: data.Items?.length ?? 0 }
}

export function listProducts(creds: UnleashedCredentials): Promise<UnleashedProduct[]> {
  return listAll<UnleashedProduct>('/Products', creds)
}

export function listBillsOfMaterials(
  creds: UnleashedCredentials,
): Promise<UnleashedBillOfMaterials[]> {
  return listAll<UnleashedBillOfMaterials>('/BillOfMaterials', creds)
}

export function listSuppliers(creds: UnleashedCredentials): Promise<UnleashedSupplier[]> {
  return listAll<UnleashedSupplier>('/Suppliers', creds)
}

export function listWarehouses(creds: UnleashedCredentials): Promise<UnleashedWarehouse[]> {
  return listAll<UnleashedWarehouse>('/Warehouses', creds)
}

/** Purchase orders since the given ISO date (YYYY-MM-DD). */
export function listPurchaseOrders(
  creds: UnleashedCredentials,
  sinceISO: string,
): Promise<UnleashedPurchaseOrder[]> {
  return listAll<UnleashedPurchaseOrder>('/PurchaseOrders', creds, {
    query: { startDate: sinceISO },
  })
}
