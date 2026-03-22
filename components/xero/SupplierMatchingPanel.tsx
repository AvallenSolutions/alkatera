'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Link2, Check, X, Users, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  findSupplierMatches,
  getUnmatchedContacts,
  linkContactToSupplier,
  ignoreContact,
  type UnmatchedContact,
} from '@/lib/xero/supplier-matcher'

interface LinkedContact {
  xeroContactId: string
  xeroContactName: string
  supplierName: string
  matchType: string
  totalSpend: number
  transactionCount: number
}

interface Supplier {
  id: string
  name: string
}

export function SupplierMatchingPanel() {
  const { currentOrganization } = useOrganization()
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([])
  const [linked, setLinked] = useState<LinkedContact[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMatching, setIsMatching] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Load suppliers for the dropdown
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .order('name')

    setSuppliers(supplierData || [])

    // Load linked contacts
    const { data: linkData } = await supabase
      .from('xero_supplier_links')
      .select('xero_contact_id, xero_contact_name, supplier_id, match_type, total_spend, transaction_count')
      .eq('organization_id', currentOrganization.id)
      .not('match_type', 'eq', 'unmatched')
      .not('match_type', 'eq', 'ignored')
      .order('total_spend', { ascending: false })

    if (linkData) {
      // Enrich with supplier names
      const supplierMap = new Map((supplierData || []).map(s => [s.id, s.name]))
      setLinked(linkData.map(l => ({
        xeroContactId: l.xero_contact_id,
        xeroContactName: l.xero_contact_name,
        supplierName: supplierMap.get(l.supplier_id) || 'Unknown',
        matchType: l.match_type,
        totalSpend: l.total_spend,
        transactionCount: l.transaction_count,
      })))
    }

    // Load unmatched contacts
    const unmatchedData = await getUnmatchedContacts(supabase, currentOrganization.id)
    setUnmatched(unmatchedData)

    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleRunMatching() {
    if (!currentOrganization?.id) return
    setIsMatching(true)
    try {
      const result = await findSupplierMatches(supabase, currentOrganization.id)
      toast.success(`Matching complete: ${result.matched} auto-linked, ${result.unmatched} need review`)
      await loadData()
    } catch (err) {
      toast.error('Matching failed')
      console.error(err)
    } finally {
      setIsMatching(false)
    }
  }

  async function handleLink(xeroContactId: string) {
    if (!currentOrganization?.id) return
    const supplierId = selectedSuppliers[xeroContactId]
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }
    try {
      await linkContactToSupplier(supabase, currentOrganization.id, xeroContactId, supplierId)
      toast.success('Supplier linked successfully')
      await loadData()
    } catch (err) {
      toast.error('Failed to link supplier')
    }
  }

  async function handleIgnore(xeroContactId: string) {
    if (!currentOrganization?.id) return
    try {
      await ignoreContact(supabase, currentOrganization.id, xeroContactId)
      toast.success('Contact ignored')
      await loadData()
    } catch (err) {
      toast.error('Failed to ignore contact')
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const hasNoData = unmatched.length === 0 && linked.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Supplier Matching
            </CardTitle>
            <CardDescription>
              Link Xero contacts to your alka<strong>tera</strong> suppliers for better data quality tracking.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunMatching}
            disabled={isMatching}
          >
            {isMatching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {hasNoData ? 'Run Matching' : 'Re-run'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasNoData && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Users className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>No Xero contacts found yet.</p>
            <p className="text-xs mt-1">Sync your Xero data first, then click &quot;Run Matching&quot;.</p>
          </div>
        )}

        {/* Unmatched contacts needing review */}
        {unmatched.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Needs Review ({unmatched.length})
            </h4>
            <div className="space-y-2">
              {unmatched.map(contact => (
                <div
                  key={contact.xeroContactId}
                  className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{contact.xeroContactName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatCurrency(contact.totalSpend)} across {contact.transactionCount} transactions
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => handleIgnore(contact.xeroContactId)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Ignore
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedSuppliers[contact.xeroContactId] || ''}
                      onValueChange={v => setSelectedSuppliers(prev => ({ ...prev, [contact.xeroContactId]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Select supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleLink(contact.xeroContactId)}
                      disabled={!selectedSuppliers[contact.xeroContactId]}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                  </div>

                  {/* Suggested matches */}
                  {contact.suggestedMatches.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>Suggestions: </span>
                      {contact.suggestedMatches.map((s, i) => (
                        <button
                          key={s.supplierId}
                          className="underline hover:text-foreground cursor-pointer"
                          onClick={() => setSelectedSuppliers(prev => ({
                            ...prev,
                            [contact.xeroContactId]: s.supplierId,
                          }))}
                        >
                          {s.supplierName} ({Math.round(s.confidence * 100)}%)
                          {i < contact.suggestedMatches.length - 1 ? ', ' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already linked */}
        {linked.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linked ({linked.length})
            </h4>
            <div className="space-y-1">
              {linked.map(l => (
                <div
                  key={l.xeroContactId}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{l.xeroContactName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium truncate">{l.supplierName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {l.matchType === 'auto_exact' ? 'Exact' : l.matchType === 'auto_fuzzy' ? 'Fuzzy' : 'Manual'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {formatCurrency(l.totalSpend)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
