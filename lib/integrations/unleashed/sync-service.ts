import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listProducts,
  listBillsOfMaterials,
  listSuppliers,
  listWarehouses,
  listPurchaseOrders,
  type UnleashedCredentials,
  type UnleashedProduct,
  type UnleashedBillOfMaterials,
  type UnleashedSupplier,
  type UnleashedWarehouse,
  type UnleashedPurchaseOrder,
} from './client'

// One-shot Unleashed sync. Idempotent — upserts on the unique constraints
// defined in 20262605200000_unleashed_integration.sql so re-running is safe.

const PROVIDER_SLUG = 'unleashed'
const MONTHS_BACK = 12

export interface UnleashedSyncResult {
  productsUpserted: number
  bomLinesUpserted: number
  suppliersUpserted: number
  warehousesUpserted: number
  purchaseOrderLinesUpserted: number
}

function sinceISO(monthsBack: number): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - monthsBack)
  return d.toISOString().slice(0, 10)
}

export async function syncUnleashed(
  serviceClient: SupabaseClient,
  organizationId: string,
  creds: UnleashedCredentials,
): Promise<UnleashedSyncResult> {
  const startDate = sinceISO(MONTHS_BACK)

  const [products, boms, suppliers, warehouses, purchaseOrders] = await Promise.all([
    listProducts(creds),
    listBillsOfMaterials(creds).catch((err) => {
      console.warn('[unleashed/sync] BoM fetch failed:', err?.message ?? err)
      return [] as UnleashedBillOfMaterials[]
    }),
    listSuppliers(creds).catch((err) => {
      console.warn('[unleashed/sync] suppliers fetch failed:', err?.message ?? err)
      return [] as UnleashedSupplier[]
    }),
    listWarehouses(creds).catch((err) => {
      console.warn('[unleashed/sync] warehouses fetch failed:', err?.message ?? err)
      return [] as UnleashedWarehouse[]
    }),
    listPurchaseOrders(creds, startDate).catch((err) => {
      console.warn('[unleashed/sync] PO fetch failed:', err?.message ?? err)
      return [] as UnleashedPurchaseOrder[]
    }),
  ])

  const productsUpserted = await upsertProducts(serviceClient, organizationId, products)
  const bomLinesUpserted = await upsertBomLines(serviceClient, organizationId, boms)
  const suppliersUpserted = await upsertSuppliers(serviceClient, organizationId, suppliers)
  const warehousesUpserted = await upsertWarehouses(serviceClient, organizationId, warehouses)
  const purchaseOrderLinesUpserted = await upsertPurchaseOrderLines(
    serviceClient,
    organizationId,
    purchaseOrders,
  )

  return {
    productsUpserted,
    bomLinesUpserted,
    suppliersUpserted,
    warehousesUpserted,
    purchaseOrderLinesUpserted,
  }
}

// ── Upserts ──────────────────────────────────────────────────────────────────

async function upsertProducts(
  serviceClient: SupabaseClient,
  organizationId: string,
  products: UnleashedProduct[],
): Promise<number> {
  if (!products.length) return 0
  const rows = products.map((p) => ({
    organization_id: organizationId,
    external_id: p.Guid,
    product_code: p.ProductCode ?? null,
    product_description: p.ProductDescription ?? null,
    product_group: p.ProductGroup?.GroupName ?? null,
    brand: p.ProductBrand?.BrandName ?? null,
    unit_of_measure: p.UnitOfMeasure?.Name ?? null,
    pack_size: p.PackSize ?? null,
    weight_kg: p.Weight ?? null,
    default_purchase_price: p.DefaultPurchasePrice ?? null,
    default_sell_price: p.DefaultSellPrice ?? null,
    is_assembled_product: p.IsAssembledProduct ?? false,
    is_component: p.IsComponent ?? false,
    obsolete: p.Obsolete ?? false,
    raw: p as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }))
  return chunkUpsert(serviceClient, 'unleashed_products', rows, 'organization_id,external_id')
}

async function upsertBomLines(
  serviceClient: SupabaseClient,
  organizationId: string,
  boms: UnleashedBillOfMaterials[],
): Promise<number> {
  const rows: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const bom of boms) {
    const assemblyExt = bom.Product?.Guid
    if (!assemblyExt) continue
    for (const line of bom.BillOfMaterialsLines ?? []) {
      const componentExt = line.Product?.Guid
      if (!componentExt) continue
      const key = `${assemblyExt}|${componentExt}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        organization_id: organizationId,
        assembly_external_id: assemblyExt,
        assembly_code: bom.Product?.ProductCode ?? null,
        assembly_description: bom.Product?.ProductDescription ?? null,
        component_external_id: componentExt,
        component_code: line.Product?.ProductCode ?? null,
        component_description: line.Product?.ProductDescription ?? null,
        quantity: line.Quantity ?? 0,
        unit_of_measure: line.UnitOfMeasure?.Name ?? null,
        wastage_percent: line.WastageQuantity ?? null,
        synced_at: new Date().toISOString(),
      })
    }
  }
  return chunkUpsert(
    serviceClient,
    'unleashed_bom_lines',
    rows,
    'organization_id,assembly_external_id,component_external_id',
  )
}

async function upsertSuppliers(
  serviceClient: SupabaseClient,
  organizationId: string,
  suppliers: UnleashedSupplier[],
): Promise<number> {
  if (!suppliers.length) return 0
  const rows = suppliers.map((s) => ({
    organization_id: organizationId,
    external_id: s.Guid,
    supplier_code: s.SupplierCode ?? null,
    supplier_name: s.SupplierName,
    contact_email: s.Email ?? null,
    // Country lives inside Addresses[0].Country in the real API response.
    country: s.Addresses?.[0]?.Country ?? null,
    currency: s.Currency?.CurrencyCode ?? null,
    obsolete: s.Obsolete ?? false,
    raw: s as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }))
  return chunkUpsert(serviceClient, 'unleashed_suppliers', rows, 'organization_id,external_id')
}

async function upsertWarehouses(
  serviceClient: SupabaseClient,
  organizationId: string,
  warehouses: UnleashedWarehouse[],
): Promise<number> {
  if (!warehouses.length) return 0
  const rows = warehouses.map((w) => ({
    organization_id: organizationId,
    external_id: w.Guid,
    warehouse_code: w.WarehouseCode ?? null,
    warehouse_name: w.WarehouseName,
    is_default: w.IsDefault ?? false,
    city: w.City ?? null,
    country: w.Country ?? null,
    synced_at: new Date().toISOString(),
  }))
  return chunkUpsert(serviceClient, 'unleashed_warehouses', rows, 'organization_id,external_id')
}

async function upsertPurchaseOrderLines(
  serviceClient: SupabaseClient,
  organizationId: string,
  orders: UnleashedPurchaseOrder[],
): Promise<number> {
  const rows: Record<string, unknown>[] = []
  for (const o of orders) {
    if (!o.Guid) continue
    const orderDate = parseUnleashedDate(o.OrderDate)
    for (const line of o.PurchaseOrderLines ?? []) {
      rows.push({
        organization_id: organizationId,
        order_external_id: o.Guid,
        order_number: o.OrderNumber ?? null,
        order_date: orderDate,
        order_status: o.OrderStatus ?? null,
        supplier_external_id: o.Supplier?.Guid ?? null,
        supplier_name: o.Supplier?.SupplierName ?? null,
        supplier_currency: o.Supplier?.Currency?.CurrencyCode ?? null,
        product_external_id: line.Product?.Guid ?? null,
        product_code: line.Product?.ProductCode ?? null,
        product_description: line.Product?.ProductDescription ?? null,
        quantity: line.OrderQuantity ?? null,
        unit_price: line.UnitPrice ?? null,
        line_total: line.LineTotal ?? null,
        line_number: line.LineNumber,
        synced_at: new Date().toISOString(),
      })
    }
  }
  return chunkUpsert(
    serviceClient,
    'unleashed_purchase_order_lines',
    rows,
    'organization_id,order_external_id,line_number',
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Unleashed returns dates as `/Date(1612137600000+0000)/` (Microsoft JSON date).
 * Parse that into ISO yyyy-mm-dd, or fall back to whatever ISO-ish string
 * is provided.
 */
export function parseUnleashedDate(input: string | null | undefined): string | null {
  if (!input) return null
  const msMatch = /\/Date\((-?\d+)/.exec(input)
  if (msMatch) {
    const ms = Number(msMatch[1])
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10)
  }
  const d = new Date(input)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

async function chunkUpsert(
  serviceClient: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<number> {
  if (!rows.length) return 0
  const CHUNK = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await serviceClient.from(table).upsert(slice, { onConflict })
    if (error) {
      console.warn(`[unleashed/sync] ${table} chunk error:`, error.message)
      continue
    }
    upserted += slice.length
  }
  return upserted
}

export { PROVIDER_SLUG }
