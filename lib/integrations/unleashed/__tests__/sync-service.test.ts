/**
 * Fixture-based integration tests for syncUnleashed().
 *
 * These tests replace real HTTP calls with the JSON fixtures captured from
 * Unleashed's public API docs. They verify:
 *   - Our type mapping matches the real API response shapes.
 *   - The sync-service produces the correct DB upsert rows.
 *   - Edge cases: null fields, /Date()/ timestamps, missing optional fields.
 *
 * No Unleashed account or network access required.
 */
import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { syncUnleashed, parseUnleashedDate } from '../sync-service'

import productsFixture from './fixtures/products.json'
import bomFixture from './fixtures/bill-of-materials.json'
import suppliersFixture from './fixtures/suppliers.json'
import warehousesFixture from './fixtures/warehouses.json'
import purchaseOrdersFixture from './fixtures/purchase-orders.json'

// ── Supabase mock ─────────────────────────────────────────────────────────────

type UpsertCall = { table: string; rows: Record<string, unknown>[]; onConflict: string }
const upsertCalls: UpsertCall[] = []

function makeServiceClient() {
  return {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict: string }) => {
        const normalized = Array.isArray(rows) ? rows : [rows]
        upsertCalls.push({ table, rows: normalized, onConflict: opts.onConflict })
        return Promise.resolve({ error: null })
      },
    }),
  } as unknown as Parameters<typeof syncUnleashed>[0]
}

// ── Fetch mock ────────────────────────────────────────────────────────────────

const creds = { apiId: 'test-api-id', apiKey: 'test-api-key' }
const ORG = 'org-uuid-1234'

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const path = new URL(url).pathname
    // Match the first fixture whose key is contained in the path.
    const match = Object.entries(responses).find(([key]) => path.includes(key))
    const body = match ? match[1] : { Items: [], Pagination: { NumberOfItems: 0, PageSize: 200, PageNumber: 1, NumberOfPages: 1 } }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }) as MockInstance
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('syncUnleashed', () => {
  let fetchSpy: MockInstance

  beforeEach(() => {
    upsertCalls.length = 0
    fetchSpy = mockFetch({
      Products: productsFixture,
      BillOfMaterials: bomFixture,
      Suppliers: suppliersFixture,
      Warehouses: warehousesFixture,
      PurchaseOrders: purchaseOrdersFixture,
      Currencies: { Items: [{ Guid: 'gbp', CurrencyCode: 'GBP' }], Pagination: { NumberOfItems: 1, PageSize: 200, PageNumber: 1, NumberOfPages: 1 } },
    })
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('returns counts that match the fixture item counts', async () => {
    const result = await syncUnleashed(makeServiceClient(), ORG, creds)
    expect(result.productsUpserted).toBe(3)
    expect(result.bomLinesUpserted).toBe(3) // 3 BoM lines on the single assembly
    expect(result.suppliersUpserted).toBe(2)
    expect(result.warehousesUpserted).toBe(2)
    expect(result.purchaseOrderLinesUpserted).toBe(2) // 1 line per PO × 2 POs
  })

  describe('products', () => {
    it('maps ProductBrand.BrandName → brand (not a top-level Brand field)', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const productRows = upsertCalls.find((c) => c.table === 'unleashed_products')?.rows ?? []
      const gin = productRows.find((r) => r.product_code === 'GIN-70-LONDON')
      expect(gin).toBeDefined()
      expect(gin!.brand).toBe('Avallen')
    })

    it('maps ProductGroup.GroupName → product_group', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const productRows = upsertCalls.find((c) => c.table === 'unleashed_products')?.rows ?? []
      const gin = productRows.find((r) => r.product_code === 'GIN-70-LONDON')
      expect(gin!.product_group).toBe('Spirits')
    })

    it('maps IsAssembledProduct correctly for assembly vs component', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const productRows = upsertCalls.find((c) => c.table === 'unleashed_products')?.rows ?? []
      const gin = productRows.find((r) => r.product_code === 'GIN-70-LONDON')
      const bottle = productRows.find((r) => r.product_code === 'BOT-70-FLINT')
      expect(gin!.is_assembled_product).toBe(true)
      expect(gin!.is_component).toBe(false)
      expect(bottle!.is_assembled_product).toBe(false)
      expect(bottle!.is_component).toBe(true)
    })

    it('handles null ProductBrand gracefully (brand → null)', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const productRows = upsertCalls.find((c) => c.table === 'unleashed_products')?.rows ?? []
      const bottle = productRows.find((r) => r.product_code === 'BOT-70-FLINT')
      expect(bottle!.brand).toBeNull()
    })

    it('upserts with organization_id and correct onConflict key', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const call = upsertCalls.find((c) => c.table === 'unleashed_products')
      expect(call?.onConflict).toBe('organization_id,external_id')
      expect(call?.rows[0].organization_id).toBe(ORG)
    })
  })

  describe('bill of materials', () => {
    it('flattens BoM lines into one row per (assembly, component) pair', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const bomRows = upsertCalls.find((c) => c.table === 'unleashed_bom_lines')?.rows ?? []
      expect(bomRows).toHaveLength(3)
    })

    it('maps assembly and component codes correctly', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const bomRows = upsertCalls.find((c) => c.table === 'unleashed_bom_lines')?.rows ?? []
      const spiritLine = bomRows.find((r) => r.component_code === 'GIN-BASE-SPIRIT')
      expect(spiritLine).toBeDefined()
      expect(spiritLine!.assembly_code).toBe('GIN-70-LONDON')
      expect(spiritLine!.quantity).toBe(0.35)
      expect(spiritLine!.unit_of_measure).toBe('L')
    })

    it('uses WastageQuantity (not Wastage) from the API response', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const bomRows = upsertCalls.find((c) => c.table === 'unleashed_bom_lines')?.rows ?? []
      const spiritLine = bomRows.find((r) => r.component_code === 'GIN-BASE-SPIRIT')
      // WastageQuantity from fixture is 0.005
      expect(spiritLine!.wastage_percent).toBe(0.005)
    })

    it('deduplicates repeated (assembly, component) pairs', async () => {
      // The sync-service deduplicates; a fixture with two identical pairs
      // should produce only one row.
      const dupBom = {
        ...bomFixture,
        Items: [
          {
            ...bomFixture.Items[0],
            BillOfMaterialsLines: [
              ...bomFixture.Items[0].BillOfMaterialsLines,
              // Duplicate of the first line
              { ...bomFixture.Items[0].BillOfMaterialsLines[0] },
            ],
          },
        ],
      }
      vi.stubGlobal(
        'fetch',
        mockFetch({
          Products: productsFixture,
          BillOfMaterials: dupBom,
          Suppliers: suppliersFixture,
          Warehouses: warehousesFixture,
          PurchaseOrders: purchaseOrdersFixture,
        }),
      )
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const bomRows = upsertCalls.find((c) => c.table === 'unleashed_bom_lines')?.rows ?? []
      // Should still be 3, not 4
      expect(bomRows).toHaveLength(3)
    })
  })

  describe('suppliers', () => {
    it('maps Email → contact_email (not ContactEmail)', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_suppliers')?.rows ?? []
      const glassco = rows.find((r) => r.supplier_code === 'GLASS-CO')
      expect(glassco!.contact_email).toBe('orders@glassco.co.uk')
    })

    it('maps Addresses[0].Country → country (not a top-level Country field)', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_suppliers')?.rows ?? []
      const glassco = rows.find((r) => r.supplier_code === 'GLASS-CO')
      expect(glassco!.country).toBe('United Kingdom')
    })

    it('maps Currency.CurrencyCode → currency', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_suppliers')?.rows ?? []
      expect(rows[0].currency).toBe('GBP')
    })
  })

  describe('warehouses', () => {
    it('maps WarehouseCode, WarehouseName, IsDefault correctly', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_warehouses')?.rows ?? []
      const main = rows.find((r) => r.warehouse_code === 'DISTILLERY')
      const cellar = rows.find((r) => r.warehouse_code === 'CELLAR-DOOR')
      expect(main!.is_default).toBe(true)
      expect(cellar!.is_default).toBe(false)
      expect(main!.warehouse_name).toBe('Distillery & Production')
    })
  })

  describe('purchase orders', () => {
    it('flattens PO header + lines into one row per line', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_purchase_order_lines')?.rows ?? []
      expect(rows).toHaveLength(2)
    })

    it('copies supplier info onto each line', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_purchase_order_lines')?.rows ?? []
      const glassLine = rows.find((r) => r.order_number === 'PO-00042')
      expect(glassLine!.supplier_name).toBe('Glassco Packaging Ltd')
      expect(glassLine!.supplier_currency).toBe('GBP')
      expect(glassLine!.product_code).toBe('BOT-70-FLINT')
      expect(glassLine!.quantity).toBe(6000)
      expect(glassLine!.line_total).toBe(7200)
    })

    it('parses /Date(ms)/ order dates to ISO yyyy-mm-dd', async () => {
      await syncUnleashed(makeServiceClient(), ORG, creds)
      const rows = upsertCalls.find((c) => c.table === 'unleashed_purchase_order_lines')?.rows ?? []
      const glassLine = rows.find((r) => r.order_number === 'PO-00042')
      // /Date(1700000000000)/ → 2023-11-14
      expect(glassLine!.order_date).toBe('2023-11-14')
    })
  })
})

// ── parseUnleashedDate unit tests ─────────────────────────────────────────────

describe('parseUnleashedDate', () => {
  it('parses Microsoft JSON date format /Date(ms)/', () => {
    expect(parseUnleashedDate('/Date(1700000000000)/')).toBe('2023-11-14')
  })

  it('handles negative timestamps (pre-1970)', () => {
    const result = parseUnleashedDate('/Date(-86400000)/')
    expect(result).toBe('1969-12-31')
  })

  it('parses ISO strings as fallback', () => {
    expect(parseUnleashedDate('2024-06-15T00:00:00.000Z')).toBe('2024-06-15')
  })

  it('returns null for null input', () => {
    expect(parseUnleashedDate(null)).toBeNull()
    expect(parseUnleashedDate(undefined)).toBeNull()
  })

  it('returns null for unparseable strings', () => {
    expect(parseUnleashedDate('not-a-date')).toBeNull()
  })
})
