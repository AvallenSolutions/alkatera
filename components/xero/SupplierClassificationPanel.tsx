'use client'

/**
 * Supplier-first classification panel.
 *
 * The primary UI for classifying Xero transactions. Groups all transactions
 * by supplier name, lets the user assign an emission category per supplier
 * with a single click. The system learns the mapping and applies it to all
 * past and future transactions from that supplier.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, Search, Sparkles, ChevronDown, Check, Ban, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS, CLASSIFICATION_SOURCE_LABELS } from '@/lib/xero/category-labels'

interface SupplierSummary {
  contactName: string
  transactionCount: number
  classifiedCount: number
  totalSpend: number
  currentCategory: string | null
  classificationSource: string | null
  aiSuggestedCategory: string | null
  aiSuggestedConfidence: number | null
}

// Grouped category options for the dropdown
const CATEGORY_GROUPS = [
  {
    label: 'Scope 1 — Direct emissions',
    options: [
      { value: 'natural_gas', label: 'Natural Gas' },
      { value: 'diesel_stationary', label: 'Diesel (stationary)' },
      { value: 'diesel_mobile', label: 'Diesel (mobile)' },
      { value: 'petrol_mobile', label: 'Petrol (mobile)' },
      { value: 'lpg', label: 'LPG' },
    ],
  },
  {
    label: 'Scope 2 — Purchased energy',
    options: [
      { value: 'grid_electricity', label: 'Electricity' },
    ],
  },
  {
    label: 'Scope 3 — Travel & commuting',
    options: [
      { value: 'air_travel', label: 'Air Travel' },
      { value: 'rail_travel', label: 'Rail Travel' },
      { value: 'accommodation', label: 'Accommodation' },
      { value: 'employee_commuting', label: 'Team & Commuting' },
    ],
  },
  {
    label: 'Scope 3 — Goods & materials',
    options: [
      { value: 'raw_materials', label: 'Raw Materials' },
      { value: 'packaging', label: 'Packaging' },
      { value: 'marketing_materials', label: 'Marketing Materials' },
      { value: 'capital_goods', label: 'Capital Goods' },
    ],
  },
  {
    label: 'Scope 3 — Logistics & freight',
    options: [
      { value: 'road_freight', label: 'Road Freight' },
      { value: 'sea_freight', label: 'Sea Freight' },
      { value: 'air_freight', label: 'Air Freight' },
      { value: 'courier', label: 'Courier' },
    ],
  },
  {
    label: 'Scope 3 — Services & utilities',
    options: [
      { value: 'professional_services', label: 'Professional Services' },
      { value: 'it_services', label: 'IT Services' },
      { value: 'telecoms', label: 'Telecoms' },
      { value: 'water', label: 'Water' },
      { value: 'waste', label: 'Waste' },
      { value: 'other', label: 'Other' },
    ],
  },
]

const currencyFmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function SupplierClassificationPanel() {
  const { currentOrganization } = useOrganization()
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingCategories, setPendingCategories] = useState<Record<string, string>>({})
  const [savingSupplier, setSavingSupplier] = useState<string | null>(null)
  const [isSuggestingAI, setIsSuggestingAI] = useState(false)
  const [classifiedOpen, setClassifiedOpen] = useState(false)
  const [excludedOpen, setExcludedOpen] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    if (!currentOrganization?.id) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `/api/xero/suppliers?organizationId=${currentOrganization.id}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      )
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      toast.error('Failed to load suppliers')
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Split suppliers into unclassified, classified, and excluded
  const filtered = suppliers.filter(s =>
    !searchQuery || s.contactName.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const unclassified = filtered.filter(s => s.classifiedCount < s.transactionCount && s.currentCategory !== 'exclude')
  const excluded = filtered.filter(s => s.currentCategory === 'exclude')
  const classified = filtered.filter(s =>
    s.classifiedCount === s.transactionCount && s.currentCategory !== null && s.currentCategory !== 'exclude'
  )

  const totalSuppliers = suppliers.length
  const classifiedSuppliers = suppliers.filter(s =>
    s.classifiedCount === s.transactionCount && s.currentCategory !== null
  ).length
  const progressPct = totalSuppliers > 0 ? Math.round((classifiedSuppliers / totalSuppliers) * 100) : 0
  const totalUnclassifiedTx = unclassified.reduce((sum, s) => sum + (s.transactionCount - s.classifiedCount), 0)

  async function handleApply(contactName: string) {
    const category = pendingCategories[contactName]
    if (!category || !currentOrganization?.id) return

    setSavingSupplier(contactName)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (category === 'exclude') {
        // For exclude, we need to mark all transactions from this supplier
        // Update directly since learn-rule doesn't handle 'exclude'
        const { error } = await supabase
          .from('xero_transactions')
          .update({
            emission_category: 'exclude',
            classification_source: 'manual',
            classification_confidence: 1.0,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', currentOrganization.id)
          .eq('xero_contact_name', contactName)

        if (error) throw new Error(error.message)

        toast.success(`${contactName} excluded from emissions tracking`)
      } else {
        // Use learn-rule API which creates the supplier rule + reclassifies
        const res = await fetch('/api/xero/learn-rule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            contactName,
            emissionCategory: category,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to classify')
        }

        const result = await res.json()
        const label = CATEGORY_LABELS[category] || category
        const extra = result.additionalClassified > 0
          ? ` ${result.additionalClassified} transactions updated.`
          : ''
        toast.success(`${contactName} classified as ${label}.${extra}`)
      }

      // Clear pending and refresh
      setPendingCategories(prev => {
        const next = { ...prev }
        delete next[contactName]
        return next
      })
      await fetchSuppliers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to classify supplier'
      toast.error(message)
    } finally {
      setSavingSupplier(null)
    }
  }

  async function handleSuggestAI() {
    if (!currentOrganization?.id || unclassified.length === 0) return
    setIsSuggestingAI(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      // Get one representative transaction per unclassified supplier for AI
      const { data: txSamples } = await supabase
        .from('xero_transactions')
        .select('id, xero_contact_name, description, amount')
        .eq('organization_id', currentOrganization.id)
        .is('emission_category', null)
        .limit(200)

      if (!txSamples || txSamples.length === 0) {
        toast.info('No unclassified transactions to analyse')
        return
      }

      // Deduplicate by supplier — one per supplier
      const seen = new Set<string>()
      const representative = txSamples.filter(tx => {
        const name = tx.xero_contact_name || ''
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })

      // Call the AI classify endpoint
      const res = await fetch('/api/xero/classify-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          transactions: representative.map(tx => ({
            id: tx.id,
            contactName: tx.xero_contact_name,
            description: tx.description,
            amount: tx.amount,
          })),
        }),
      })

      if (!res.ok) throw new Error('AI classification failed')
      const data = await res.json()

      // Map AI suggestions back to supplier names and pre-fill dropdowns
      const newPending: Record<string, string> = { ...pendingCategories }
      let suggestCount = 0

      if (data.suggestions && Array.isArray(data.suggestions)) {
        for (const suggestion of data.suggestions) {
          if (suggestion.suggestedCategory && suggestion.confidence >= 0.5) {
            // Find the supplier name for this transaction
            const tx = representative.find(t => t.id === suggestion.transactionId)
            const supplierName = tx?.xero_contact_name
            if (supplierName && !newPending[supplierName]) {
              newPending[supplierName] = suggestion.suggestedCategory
              suggestCount++
            }
          }
        }
      }

      setPendingCategories(newPending)
      toast.success(`AI suggested categories for ${suggestCount} suppliers. Review and apply below.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI classification failed'
      toast.error(message)
    } finally {
      setIsSuggestingAI(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading suppliers...</span>
        </CardContent>
      </Card>
    )
  }

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No transactions found. Sync your Xero data first from Settings &gt; Integrations.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Classify Your Suppliers
            </CardTitle>
            <CardDescription className="mt-1">
              Assign an emission category to each supplier. All their transactions are classified automatically.
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSuggestAI}
            disabled={isSuggestingAI || unclassified.length === 0}
          >
            {isSuggestingAI ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isSuggestingAI ? 'Analysing...' : 'Suggest with AI'}
          </Button>
        </div>

        {/* Stats + progress */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {classifiedSuppliers} of {totalSuppliers} suppliers classified
              {totalUnclassifiedTx > 0 && (
                <span className="text-amber-400 ml-2">
                  ({totalUnclassifiedTx} transactions remaining)
                </span>
              )}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" indicatorColor="lime" />
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* ── Unclassified Suppliers ─────────────────────────────────── */}
        {unclassified.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Needs Classification ({unclassified.length})
            </div>

            <div className="space-y-1">
              {unclassified.map(supplier => (
                <SupplierRow
                  key={supplier.contactName}
                  supplier={supplier}
                  selectedCategory={pendingCategories[supplier.contactName] || ''}
                  onCategoryChange={(cat) =>
                    setPendingCategories(prev => ({ ...prev, [supplier.contactName]: cat }))
                  }
                  onApply={() => handleApply(supplier.contactName)}
                  isSaving={savingSupplier === supplier.contactName}
                  variant="unclassified"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Classified Suppliers ───────────────────────────────────── */}
        {classified.length > 0 && (
          <Collapsible open={classifiedOpen} onOpenChange={setClassifiedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${classifiedOpen ? '' : '-rotate-90'}`} />
              Classified ({classified.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1">
                {classified.map(supplier => (
                  <SupplierRow
                    key={supplier.contactName}
                    supplier={supplier}
                    selectedCategory={pendingCategories[supplier.contactName] || supplier.currentCategory || ''}
                    onCategoryChange={(cat) =>
                      setPendingCategories(prev => ({ ...prev, [supplier.contactName]: cat }))
                    }
                    onApply={() => handleApply(supplier.contactName)}
                    isSaving={savingSupplier === supplier.contactName}
                    variant="classified"
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── Excluded Suppliers ─────────────────────────────────────── */}
        {excluded.length > 0 && (
          <Collapsible open={excludedOpen} onOpenChange={setExcludedOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${excludedOpen ? '' : '-rotate-90'}`} />
              Excluded ({excluded.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1">
                {excluded.map(supplier => (
                  <SupplierRow
                    key={supplier.contactName}
                    supplier={supplier}
                    selectedCategory={pendingCategories[supplier.contactName] || 'exclude'}
                    onCategoryChange={(cat) =>
                      setPendingCategories(prev => ({ ...prev, [supplier.contactName]: cat }))
                    }
                    onApply={() => handleApply(supplier.contactName)}
                    isSaving={savingSupplier === supplier.contactName}
                    variant="excluded"
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty state after search */}
        {filtered.length === 0 && searchQuery && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No suppliers match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  )
}


// ── Supplier Row Component ──────────────────────────────────────────

interface SupplierRowProps {
  supplier: SupplierSummary
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onApply: () => void
  isSaving: boolean
  variant: 'unclassified' | 'classified' | 'excluded'
}

function SupplierRow({
  supplier,
  selectedCategory,
  onCategoryChange,
  onApply,
  isSaving,
  variant,
}: SupplierRowProps) {
  const hasAISuggestion = !!supplier.aiSuggestedCategory
  const hasPendingChange = variant === 'classified'
    ? selectedCategory !== supplier.currentCategory
    : variant === 'excluded'
      ? selectedCategory !== 'exclude'
      : !!selectedCategory

  return (
    <div className={`
      flex items-center gap-3 py-2 px-3 rounded-md text-sm
      ${variant === 'unclassified' ? 'bg-slate-50 dark:bg-slate-900/50' : ''}
      ${variant === 'excluded' ? 'opacity-60' : ''}
    `}>
      {/* Supplier info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{supplier.contactName}</span>
          {hasAISuggestion && variant === 'unclassified' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-400/50 text-violet-400">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    AI
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">
                    AI suggests: <strong>{CATEGORY_LABELS[supplier.aiSuggestedCategory!] || supplier.aiSuggestedCategory}</strong>
                    {supplier.aiSuggestedConfidence && (
                      <span className="ml-1 text-muted-foreground">
                        ({Math.round(supplier.aiSuggestedConfidence * 100)}% confidence)
                      </span>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {variant === 'classified' && supplier.classificationSource && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {CLASSIFICATION_SOURCE_LABELS[supplier.classificationSource] || supplier.classificationSource}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {supplier.transactionCount} transaction{supplier.transactionCount !== 1 ? 's' : ''}
          {' · '}
          {currencyFmt.format(supplier.totalSpend)}
        </div>
      </div>

      {/* Category select */}
      <div className="w-48 shrink-0">
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </div>
                {group.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </div>
            ))}
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Not emissions-relevant
            </div>
            <SelectItem value="exclude" className="text-xs">
              <span className="flex items-center gap-1">
                <Ban className="h-3 w-3" /> Exclude
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        variant={hasPendingChange ? 'default' : 'ghost'}
        className="h-8 w-8 p-0 shrink-0"
        onClick={onApply}
        disabled={!hasPendingChange || isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
