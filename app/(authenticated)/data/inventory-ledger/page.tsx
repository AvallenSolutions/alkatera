'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, Link as LinkIcon, Package } from 'lucide-react'
import { toast } from 'sonner'
import { XeroInventoryLinker } from '@/components/inventory/XeroInventoryLinker'

interface Ingredient {
  id: string
  name: string
  unit: string | null
}

interface UnlinkedXero {
  id: string
  transactionDate: string
  supplierName: string
  description: string
  amount: number
  currency: string
  emissionCategory: string
  spendBasedEmissionsKg: number
}

interface ConsumptionRow {
  id: string
  consumptionDate: string
  consumedQuantity: number
  consumedEmissionKg: number
  method: string
  ingredientName: string | null
  productName: string | null
}

interface ReceiptRow {
  id: string
  ingredientId: string | null
  ingredientName: string | null
  receivedDate: string
  quantity: number
  quantityConsumed: number
  quantityUnit: string
  status: string
  emissionKg: number | null
  totalCostGbp: number | null
  xeroTransactionId: string | null
  sourceType: string
}

export default function InventoryLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [unlinked, setUnlinked] = useState<UnlinkedXero[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [consumptions, setConsumptions] = useState<ConsumptionRow[]>([])
  const [linkingRow, setLinkingRow] = useState<UnlinkedXero | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/emissions/inventory', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setIngredients(data.ingredients)
      setUnlinked(data.unlinkedXero)
      setReceipts(data.receipts)
      setConsumptions(data.consumptions || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const inStockReceipts = receipts.filter((r) => r.status !== 'fully_consumed')

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-7 w-7" />
          Inventory ledger
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Link raw-materials and packaging spend to the ingredients they stock.
          Emissions then book to the production period the stock is consumed in,
          not the date the invoice was paid — fixing the bottles-bought-2025-
          used-2026 problem for cross-period accounting.
        </p>
        <div className="mt-3 rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How the resolver handles linked spend</p>
          <p>
            <span className="font-medium">Ingredient is in a completed product LCA:</span> the
            Xero row is hidden from the corporate footprint — the LCA already books those
            emissions, so counting the spend line too would double-count.
          </p>
          <p>
            <span className="font-medium">No LCA yet:</span> the Xero row is hidden, and the
            emission is re-booked at the consumption date via this ledger, giving you honest
            period accounting until an LCA lands.
          </p>
          <p>
            <span className="font-medium">Unlinked:</span> the Xero row keeps booking
            spend-based emissions on the transaction date. Link it to upgrade it.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unlinked spend</CardTitle>
              <CardDescription>
                Xero raw-materials and packaging transactions without an inventory
                link. Each still books spend-based emissions on the transaction
                date until you link it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unlinked.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Nothing unlinked.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">tCO₂e</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unlinked.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">
                          {new Date(tx.transactionDate).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="text-sm">{tx.supplierName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.emissionCategory.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {tx.currency} {tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(tx.spendBasedEmissionsKg / 1000).toFixed(3)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setLinkingRow(tx)}>
                            <LinkIcon className="h-3 w-3 mr-1.5" />
                            Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">In-stock inventory</CardTitle>
              <CardDescription>
                Receipts you&apos;ve linked to ingredients. Shown oldest-first within
                each ingredient — that&apos;s the order they&apos;ll be drawn down on
                FIFO when you log production.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inStockReceipts.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No linked inventory yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost (GBP)</TableHead>
                      <TableHead className="text-right">kgCO₂e (total)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inStockReceipts.map((r) => {
                      const remaining = r.quantity - r.quantityConsumed
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {new Date(r.receivedDate).toLocaleDateString('en-GB')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.ingredientName || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {remaining.toLocaleString()} / {r.quantity.toLocaleString()} {r.quantityUnit}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                r.status === 'partially_consumed'
                                  ? 'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700'
                                  : 'text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700'
                              }
                            >
                              {r.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {r.totalCostGbp?.toFixed(2) ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {r.emissionKg?.toFixed(1) ?? '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent consumptions</CardTitle>
              <CardDescription>
                Inventory drawn down by production logs via FIFO. Emissions book
                to the consumption date, not the original purchase date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consumptions.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No consumptions yet. Log production against a product with a BOM to draw from linked inventory.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Drawn</TableHead>
                      <TableHead className="text-right">kgCO&#8322;e</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumptions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">
                          {new Date(c.consumptionDate).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="text-sm">{c.productName || '—'}</TableCell>
                        <TableCell className="text-sm">{c.ingredientName || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {c.consumedQuantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {c.consumedEmissionKg.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs uppercase">
                            {c.method}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <XeroInventoryLinker
        open={linkingRow !== null}
        xeroRow={linkingRow}
        ingredients={ingredients}
        onClose={() => setLinkingRow(null)}
        onLinked={load}
      />
    </div>
  )
}
