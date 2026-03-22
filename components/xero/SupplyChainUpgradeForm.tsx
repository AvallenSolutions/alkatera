'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, ArrowUpCircle, TrendingDown, Package, Wheat } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  type XeroTransactionRow,
  type XeroTransactionView,
  toTransactionView,
  XERO_TX_SELECT_COLUMNS,
} from '@/lib/xero/types'

interface SupplyChainUpgradeFormProps {
  category: 'packaging' | 'raw_materials'
  onComplete: () => void
  onCancel: () => void
}

interface LinkedSupplier {
  supplierId: string
  supplierName: string
}

interface SupplierProduct {
  id: string
  name: string
  carbonIntensity: number | null
  unit: string
}

const CATEGORY_LABELS: Record<string, string> = {
  packaging: 'Packaging',
  raw_materials: 'Raw Materials & Ingredients',
}

export function SupplyChainUpgradeForm({ category, onComplete, onCancel }: SupplyChainUpgradeFormProps) {
  const { currentOrganization } = useOrganization()

  // Transaction data
  const [transactions, setTransactions] = useState<XeroTransactionView[]>([])
  const [spendTotal, setSpendTotal] = useState(0)
  const [spendEmissions, setSpendEmissions] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Linked supplier info
  const [linkedSuppliers, setLinkedSuppliers] = useState<LinkedSupplier[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  // Form fields
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [description, setDescription] = useState('')

  // Save state
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization?.id) return

      // Fetch pending transactions
      const { data: txData } = await supabase
        .from('xero_transactions')
        .select(XERO_TX_SELECT_COLUMNS)
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')
        .order('transaction_date', { ascending: false })

      if (txData) {
        const rows = txData as unknown as XeroTransactionRow[]
        setTransactions(rows.map(toTransactionView))
        setSpendTotal(rows.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0))
        setSpendEmissions(rows.reduce((sum, t) => sum + Math.abs(t.spend_based_emissions_kg || 0), 0))

        // Check for linked suppliers via xero_supplier_links
        const contactIds = Array.from(new Set(
          rows.map(t => t.xero_contact_name).filter(Boolean)
        ))

        if (contactIds.length > 0) {
          // Get unique xero_contact_ids from transactions
          const { data: txWithContacts } = await supabase
            .from('xero_transactions')
            .select('xero_contact_id')
            .eq('organization_id', currentOrganization.id)
            .eq('emission_category', category)
            .eq('upgrade_status', 'pending')
            .not('xero_contact_id', 'is', null)

          if (txWithContacts) {
            const uniqueContactIds = Array.from(new Set(txWithContacts.map(t => t.xero_contact_id)))

            const { data: links } = await supabase
              .from('xero_supplier_links')
              .select('supplier_id, xero_contact_name')
              .eq('organization_id', currentOrganization.id)
              .in('xero_contact_id', uniqueContactIds)
              .not('supplier_id', 'is', null)

            if (links && links.length > 0) {
              const supplierIds = links.map(l => l.supplier_id).filter(Boolean)

              // Get supplier names
              const { data: supplierData } = await supabase
                .from('suppliers')
                .select('id, name')
                .in('id', supplierIds)

              if (supplierData) {
                setLinkedSuppliers(supplierData.map(s => ({
                  supplierId: s.id,
                  supplierName: s.name,
                })))

                // Get supplier products
                const { data: products } = await supabase
                  .from('supplier_products')
                  .select('id, name, carbon_intensity, unit')
                  .in('supplier_id', supplierIds)
                  .eq('organization_id', currentOrganization.id)
                  .eq('is_active', true)
                  .order('name')

                if (products) {
                  setSupplierProducts(products.map(p => ({
                    id: p.id,
                    name: p.name,
                    carbonIntensity: p.carbon_intensity,
                    unit: p.unit,
                  })))
                }
              }
            }
          }
        }
      }

      setIsLoading(false)
    }

    loadData()
  }, [currentOrganization?.id, category])

  // Calculate activity-based emissions
  const quantityNum = parseFloat(quantity) || 0
  const selectedProduct = supplierProducts.find(p => p.id === selectedProductId)
  const activityEmissions = selectedProduct?.carbonIntensity && quantityNum > 0
    ? quantityNum * selectedProduct.carbonIntensity
    : 0

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(spendTotal)

  const formatEmissions = useCallback((kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }, [])

  const Icon = category === 'packaging' ? Package : Wheat

  async function handleSave() {
    if (!currentOrganization?.id) return

    if (quantityNum <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    setIsSaving(true)
    try {
      const transactionIds = transactions.map(t => t.id)
      const supplierNames = linkedSuppliers.map(s => s.supplierName)
      const autoDescription = description
        || `${CATEGORY_LABELS[category]}: ${quantityNum} ${unit}${supplierNames.length ? ` from ${supplierNames.join(', ')}` : ''}`

      // Mark transactions as upgraded with tier level based on data source
      const tier = selectedProduct?.carbonIntensity ? 1 : 2

      const { error: updateError } = await supabase
        .from('xero_transactions')
        .update({
          upgrade_status: 'upgraded',
          data_quality_tier: tier,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', currentOrganization.id)
        .eq('emission_category', category)
        .eq('upgrade_status', 'pending')

      if (updateError) throw updateError

      toast.success(`${CATEGORY_LABELS[category]} data upgraded to Tier ${tier}`)
      onComplete()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onCancel} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Action Centre
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Upgrade: {CATEGORY_LABELS[category]}
          </CardTitle>
          <CardDescription>
            We found {formattedSpend} in {CATEGORY_LABELS[category].toLowerCase()} spend across {transactions.length} transactions.
            {linkedSuppliers.length > 0
              ? ` Linked to: ${linkedSuppliers.map(s => s.supplierName).join(', ')}.`
              : ' Link your Xero contacts to suppliers in the matching panel to unlock Tier 1 data.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Transaction list */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Transactions identified
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{tx.supplierName || 'Unknown'}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                    <span className="font-medium shrink-0">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplier product selection (if linked) */}
          {supplierProducts.length > 0 && (
            <div className="space-y-2">
              <Label>Supplier product (for Tier 1 data)</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product with carbon data..." />
                </SelectTrigger>
                <SelectContent>
                  {supplierProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.carbonIntensity != null && (
                        <span className="text-muted-foreground ml-1">
                          ({p.carbonIntensity.toFixed(3)} kg CO2e/{p.unit})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity purchased</Label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="tonnes">tonnes</SelectItem>
                  <SelectItem value="litres">litres</SelectItem>
                  <SelectItem value="units">units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              placeholder={category === 'packaging' ? 'e.g. Glass bottles from supplier' : 'e.g. Malted barley from supplier'}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Before/After comparison */}
          {quantityNum > 0 && (
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Spend-based estimate</p>
                    <p className="text-lg font-semibold text-amber-600">
                      {formatEmissions(spendEmissions)}
                    </p>
                    <p className="text-xs text-muted-foreground">Tier 4 (lowest quality, ~70% uncertainty)</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {activityEmissions > 0 ? 'Supplier-specific calculation' : 'Activity-based data'}
                    </p>
                    {activityEmissions > 0 ? (
                      <>
                        <p className="text-lg font-semibold text-emerald-600">
                          {formatEmissions(activityEmissions)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tier 1 ({quantityNum} {unit} x {selectedProduct?.carbonIntensity?.toFixed(3)} kg CO2e/{selectedProduct?.unit})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-blue-600">
                          Tier 2
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Quantity recorded. Link supplier products for Tier 1 calculation.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {activityEmissions > 0 && spendEmissions > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Uncertainty reduced from ~70% to ~10% with supplier-specific data
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || quantityNum <= 0}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
