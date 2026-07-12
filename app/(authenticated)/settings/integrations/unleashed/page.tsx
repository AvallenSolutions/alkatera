'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Statement } from '@/components/studio'
import { StateChip } from '@/components/studio/state-chip'
import { ArrowLeft, Package, Layers, Truck, Building2, Receipt } from 'lucide-react'

interface ProductRow {
  id: string
  product_code: string | null
  product_description: string | null
  product_group: string | null
  brand: string | null
  unit_of_measure: string | null
  is_assembled_product: boolean
  obsolete: boolean
}

interface BomRow {
  id: string
  assembly_code: string | null
  assembly_description: string | null
  component_code: string | null
  component_description: string | null
  quantity: number
  unit_of_measure: string | null
}

interface SupplierRow {
  id: string
  supplier_code: string | null
  supplier_name: string
  country: string | null
  currency: string | null
}

interface WarehouseRow {
  id: string
  warehouse_code: string | null
  warehouse_name: string
  city: string | null
  country: string | null
  is_default: boolean
}

interface PoLineRow {
  id: string
  order_number: string | null
  order_date: string | null
  supplier_name: string | null
  product_code: string | null
  product_description: string | null
  quantity: number | null
  unit_price: number | null
  line_total: number | null
  supplier_currency: string | null
}

type Tab = 'products' | 'bom' | 'suppliers' | 'warehouses' | 'purchase_orders'

export default function UnleashedSettingsPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [tab, setTab] = useState<Tab>('products')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [bom, setBom] = useState<BomRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [poLines, setPoLines] = useState<PoLineRow[]>([])

  const load = useCallback(async (t: Tab) => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/unleashed/data?organizationId=${orgId}&table=${t}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load')
      const rows = body.data ?? []
      if (t === 'products') setProducts(rows)
      else if (t === 'bom') setBom(rows)
      else if (t === 'suppliers') setSuppliers(rows)
      else if (t === 'warehouses') setWarehouses(rows)
      else if (t === 'purchase_orders') setPoLines(rows)
    } catch {
      /* surfaced via toast in the connect card flow */
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => router.push('/settings/integrations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <StateChip tone="quiet" className="ml-auto">Beta</StateChip>
      </div>

      <div className="space-y-3">
        <Statement eyebrow="THE WIRING · INTEGRATIONS" headline="Unleashed." />
        <p className="text-sm text-studio-dim">
          Synced data from your Unleashed account. Use the connection card on the integrations page to sync.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Products</TabsTrigger>
          <TabsTrigger value="bom" className="gap-1.5"><Layers className="h-3.5 w-3.5" />BoM</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5"><Truck className="h-3.5 w-3.5" />Suppliers</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Warehouses</TabsTrigger>
          <TabsTrigger value="purchase_orders" className="gap-1.5"><Receipt className="h-3.5 w-3.5" />Purchase orders</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Loading
            </span>
          </div>
        )}

        <TabsContent value="products">
          <SimpleTable
            empty="No products synced yet."
            rows={products}
            columns={[
              { header: 'Code', cell: (r) => r.product_code ?? '·' },
              { header: 'Description', cell: (r) => r.product_description ?? '·' },
              { header: 'Group', cell: (r) => r.product_group ?? '·' },
              { header: 'Brand', cell: (r) => r.brand ?? '·' },
              { header: 'UoM', cell: (r) => r.unit_of_measure ?? '·' },
              { header: 'Type', cell: (r) => r.is_assembled_product ? 'Assembly' : 'Component' },
            ]}
          />
        </TabsContent>

        <TabsContent value="bom">
          <SimpleTable
            empty="No Bills of Materials synced yet."
            rows={bom}
            columns={[
              { header: 'Assembly', cell: (r) => `${r.assembly_code ?? '·'} ${r.assembly_description ? `· ${r.assembly_description}` : ''}` },
              { header: 'Component', cell: (r) => `${r.component_code ?? '·'} ${r.component_description ? `· ${r.component_description}` : ''}` },
              { header: 'Qty', cell: (r) => `${r.quantity} ${r.unit_of_measure ?? ''}`.trim() },
            ]}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <SimpleTable
            empty="No suppliers synced yet."
            rows={suppliers}
            columns={[
              { header: 'Code', cell: (r) => r.supplier_code ?? '·' },
              { header: 'Name', cell: (r) => r.supplier_name },
              { header: 'Country', cell: (r) => r.country ?? '·' },
              { header: 'Currency', cell: (r) => r.currency ?? '·' },
            ]}
          />
        </TabsContent>

        <TabsContent value="warehouses">
          <SimpleTable
            empty="No warehouses synced yet."
            rows={warehouses}
            columns={[
              { header: 'Code', cell: (r) => r.warehouse_code ?? '·' },
              { header: 'Name', cell: (r) => `${r.warehouse_name}${r.is_default ? ' · default' : ''}` },
              { header: 'City', cell: (r) => r.city ?? '·' },
              { header: 'Country', cell: (r) => r.country ?? '·' },
            ]}
          />
        </TabsContent>

        <TabsContent value="purchase_orders">
          <SimpleTable
            empty="No purchase orders in the last 12 months."
            rows={poLines}
            columns={[
              { header: 'Order', cell: (r) => r.order_number ?? '·' },
              { header: 'Date', cell: (r) => r.order_date ?? '·' },
              { header: 'Supplier', cell: (r) => r.supplier_name ?? '·' },
              { header: 'Product', cell: (r) => `${r.product_code ?? '·'} ${r.product_description ? `· ${r.product_description}` : ''}` },
              { header: 'Qty', cell: (r) => r.quantity ?? '·' },
              { header: 'Total', cell: (r) => r.line_total != null ? `${r.line_total.toLocaleString()} ${r.supplier_currency ?? ''}`.trim() : '·' },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface Column<T> {
  header: string
  cell: (row: T) => React.ReactNode
}

function SimpleTable<T extends { id: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[]
  columns: Column<T>[]
  empty: string
}) {
  if (!rows.length) {
    return <div className="text-center text-sm text-muted-foreground py-12">{empty}</div>
  }
  return (
    <div className="border border-border rounded-[6px] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="text-left px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {columns.map((c) => (
                <td key={c.header} className="px-3 py-2 align-top">
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
