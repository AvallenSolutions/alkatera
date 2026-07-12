'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { BigNumber } from '@/components/studio/big-number'
import { StateChip } from '@/components/studio/state-chip'
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

function Section({
  label,
  blurb,
  children,
}: {
  label: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  )
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
    <div className="max-w-6xl space-y-10">
      <div className="space-y-4">
        <Statement eyebrow="THE WORKBENCH · INVENTORY" headline="The inventory ledger.">
          {!loading && (
            <BigNumber size="display" value={unlinked.length} label="To link" />
          )}
        </Statement>
        <div className="max-w-2xl space-y-1 text-sm text-muted-foreground">
          <p>
            Link raw-materials and packaging spend to the stock it buys, so emissions book
            to the period the stock is consumed, not the date the invoice was paid.
          </p>
          <p>
            Linked rows never double count: hidden where a completed product LCA already
            covers the ingredient, re-booked at the consumption date otherwise. Unlinked
            rows keep booking spend-based emissions on the transaction date.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Section
            label="To link"
            blurb="Xero raw-materials and packaging transactions without an inventory link. Each still books spend-based emissions on the transaction date until you link it."
          >
            {unlinked.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
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
                        <StateChip>{tx.emissionCategory.replace(/_/g, ' ')}</StateChip>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {tx.currency} {tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(tx.spendBasedEmissionsKg / 1000).toFixed(3)}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setLinkingRow(tx)}>
                          Link
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section
            label="In stock"
            blurb="Receipts linked to ingredients, oldest first within each ingredient: the order FIFO draws them down when you log production."
          >
            {inStockReceipts.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
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
                          {r.ingredientName || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {remaining.toLocaleString()} / {r.quantity.toLocaleString()} {r.quantityUnit}
                        </TableCell>
                        <TableCell>
                          <StateChip tone={r.status === 'partially_consumed' ? 'attention' : 'good'}>
                            {r.status.replace(/_/g, ' ')}
                          </StateChip>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.totalCostGbp?.toFixed(2) ?? '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.emissionKg?.toFixed(1) ?? '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section
            label="Recent consumptions"
            blurb="Inventory drawn down by production logs via FIFO. Emissions book to the consumption date, not the original purchase date."
          >
            {consumptions.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
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
                      <TableCell className="text-sm">{c.productName || '-'}</TableCell>
                      <TableCell className="text-sm">{c.ingredientName || '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.consumedQuantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.consumedEmissionKg.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <StateChip>{c.method}</StateChip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
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
