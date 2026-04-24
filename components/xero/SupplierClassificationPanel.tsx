'use client'

/**
 * Supplier-first classification panel.
 *
 * Features:
 *  - Bulk multi-select + batch apply
 *  - AI Review Mode (keyboard-driven accept/skip/change)
 *  - Smart near-duplicate clustering (toggle)
 *  - Filters (source, min spend) + sort (spend/count/name/AI confidence)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Loader2, Search, Sparkles, ChevronDown, ChevronRight, Check, Ban, Users, X,
  SkipForward, LayoutGrid, SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS, CLASSIFICATION_SOURCE_LABELS } from '@/lib/xero/category-labels'
import { classifyTransactionsChunked } from '@/lib/xero/classify-ai-client'

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

interface SupplierCluster {
  key: string
  canonicalName: string
  transactionCount: number
  classifiedCount: number
  totalSpend: number
  currentCategory: string | null
  classificationSource: string | null
  aiSuggestedCategory: string | null
  aiSuggestedConfidence: number | null
  members: SupplierSummary[]
}

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
    options: [{ value: 'grid_electricity', label: 'Electricity' }],
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

const currencyFmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })

type SortKey = 'spend' | 'count' | 'name' | 'ai_confidence'
type SourceFilter = 'all' | 'ai' | 'rule' | 'manual' | 'unclassified'

interface Filters {
  sort: SortKey
  source: SourceFilter
  minSpend: number
  clusters: boolean
}

function loadFilters(orgId: string): Filters {
  if (typeof window === 'undefined') return { sort: 'spend', source: 'all', minSpend: 0, clusters: true }
  try {
    const raw = window.localStorage.getItem(`spend-inbox-filters-${orgId}`)
    if (!raw) return { sort: 'spend', source: 'all', minSpend: 0, clusters: true }
    return { sort: 'spend', source: 'all', minSpend: 0, clusters: true, ...JSON.parse(raw) }
  } catch {
    return { sort: 'spend', source: 'all', minSpend: 0, clusters: true }
  }
}

function saveFilters(orgId: string, f: Filters) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`spend-inbox-filters-${orgId}`, JSON.stringify(f))
}

interface SupplierClassificationPanelProps {
  onClassified?: () => void
}

export function SupplierClassificationPanel({ onClassified }: SupplierClassificationPanelProps = {}) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [clusters, setClusters] = useState<SupplierCluster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFiltersState] = useState<Filters>({ sort: 'spend', source: 'all', minSpend: 0, clusters: true })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pendingCategories, setPendingCategories] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [isSuggestingAI, setIsSuggestingAI] = useState(false)
  const [classifiedOpen, setClassifiedOpen] = useState(false)
  const [excludedOpen, setExcludedOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState<string>('')
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

  // AI Review Mode
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const reviewContainerRef = useRef<HTMLDivElement | null>(null)

  function setFilters(next: Filters) {
    setFiltersState(next)
    if (orgId) saveFilters(orgId, next)
  }

  useEffect(() => {
    if (orgId) setFiltersState(loadFilters(orgId))
  }, [orgId])

  const fetchSuppliers = useCallback(async () => {
    if (!orgId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const params = new URLSearchParams({
        organizationId: orgId,
        sort: filters.sort,
        source: filters.source,
        minSpend: String(filters.minSpend),
        clusters: filters.clusters ? '1' : '0',
      })
      const res = await fetch(`/api/xero/suppliers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
      setClusters(data.clusters || [])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      toast.error('Failed to load suppliers')
    } finally {
      setIsLoading(false)
    }
  }, [orgId, filters])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // ── Derived views ────────────────────────────────────────────────
  const rows = useMemo<SupplierCluster[]>(() => {
    if (filters.clusters && clusters.length > 0) return clusters
    // Render plain suppliers as single-member clusters to reuse the row UI
    return suppliers.map(s => ({
      key: s.contactName,
      canonicalName: s.contactName,
      transactionCount: s.transactionCount,
      classifiedCount: s.classifiedCount,
      totalSpend: s.totalSpend,
      currentCategory: s.currentCategory,
      classificationSource: s.classificationSource,
      aiSuggestedCategory: s.aiSuggestedCategory,
      aiSuggestedConfidence: s.aiSuggestedConfidence,
      members: [s],
    }))
  }, [filters.clusters, clusters, suppliers])

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter(r =>
      r.canonicalName.toLowerCase().includes(q) ||
      r.members.some(m => m.contactName.toLowerCase().includes(q))
    )
  }, [rows, searchQuery])

  const unclassified = filteredRows.filter(r => r.classifiedCount < r.transactionCount && r.currentCategory !== 'exclude')
  const classified = filteredRows.filter(r => r.classifiedCount === r.transactionCount && r.currentCategory !== null && r.currentCategory !== 'exclude')
  const excluded = filteredRows.filter(r => r.currentCategory === 'exclude')

  const totalRows = rows.length
  const classifiedRows = rows.filter(r => r.classifiedCount === r.transactionCount && r.currentCategory !== null).length
  const progressPct = totalRows > 0 ? Math.round((classifiedRows / totalRows) * 100) : 0
  const totalUnclassifiedTx = unclassified.reduce((sum, r) => sum + (r.transactionCount - r.classifiedCount), 0)

  // ── Selection helpers ────────────────────────────────────────────
  function toggleSelected(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function selectAllVisible() {
    setSelected(new Set(unclassified.map(r => r.key)))
  }
  function clearSelection() {
    setSelected(new Set())
  }

  // ── Apply a single row ───────────────────────────────────────────
  async function handleApplyRow(row: SupplierCluster) {
    const category = pendingCategories[row.key]
    if (!category || !orgId) return
    setSavingKey(row.key)
    try {
      await applyCategoryToContacts(memberNames(row), category)
      setPendingCategories(prev => { const n = { ...prev }; delete n[row.key]; return n })
      await fetchSuppliers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to classify')
    } finally {
      setSavingKey(null)
    }
  }

  // ── Apply bulk to selected ───────────────────────────────────────
  async function handleBulkApply() {
    if (!orgId || !bulkCategory || selected.size === 0) return
    setIsBulkSaving(true)
    try {
      const contactNames: string[] = []
      const rowsByKey = new Map(rows.map(r => [r.key, r]))
      selected.forEach(key => {
        const row = rowsByKey.get(key)
        if (row) contactNames.push(...memberNames(row))
      })
      await applyCategoryToContacts(contactNames, bulkCategory)
      toast.success(`Classified ${selected.size} supplier${selected.size === 1 ? '' : 's'}`)
      setSelected(new Set())
      setBulkCategory('')
      await fetchSuppliers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk classify failed')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // ── Shared apply helper ──────────────────────────────────────────
  async function applyCategoryToContacts(contactNames: string[], category: string) {
    if (!orgId || contactNames.length === 0) return
    const { data: { session } } = await supabase.auth.getSession()

    if (category === 'exclude') {
      const { error } = await supabase
        .from('xero_transactions')
        .update({
          emission_category: 'exclude',
          classification_source: 'manual',
          classification_confidence: 1.0,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .in('xero_contact_name', contactNames)
      if (error) throw new Error(error.message)
      onClassified?.()
      return
    }

    const res = await fetch('/api/xero/learn-rule/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        organizationId: orgId,
        contactNames,
        emissionCategory: category,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Batch classify failed')
    }
    onClassified?.()
  }

  // ── AI suggest ───────────────────────────────────────────────────
  async function handleSuggestAI() {
    if (!orgId || unclassified.length === 0) return
    setIsSuggestingAI(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { data: txSamples } = await supabase
        .from('xero_transactions')
        .select('id, xero_contact_name, description, amount')
        .eq('organization_id', orgId)
        .is('emission_category', null)
        .limit(200)

      if (!txSamples || txSamples.length === 0) {
        toast.info('No unclassified transactions to analyse')
        return
      }

      const seen = new Set<string>()
      const representative = txSamples.filter(tx => {
        const name = tx.xero_contact_name || ''
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })

      await classifyTransactionsChunked({
        organizationId: orgId,
        accessToken: session?.access_token,
        transactions: representative.map(tx => ({
          id: tx.id,
          contactName: tx.xero_contact_name,
          description: tx.description,
          amount: tx.amount,
        })),
      })
      await fetchSuppliers() // AI suggestions are persisted server-side
      toast.success('AI suggestions ready. Review them below.')
      setReviewMode(true)
      setReviewIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI classification failed')
    } finally {
      setIsSuggestingAI(false)
    }
  }

  // ── AI Review Mode ───────────────────────────────────────────────
  const reviewQueue = useMemo(
    () => unclassified.filter(r => r.aiSuggestedCategory),
    [unclassified]
  )

  // Auto-exit review mode when queue empties (user has reviewed everything)
  useEffect(() => {
    if (reviewMode && reviewQueue.length === 0 && !isLoading) {
      setReviewMode(false)
      setReviewIndex(0)
    }
  }, [reviewMode, reviewQueue.length, isLoading])

  async function acceptAllHighConfidence() {
    if (!orgId) return
    const high = reviewQueue.filter(r => (r.aiSuggestedConfidence || 0) >= 0.85)
    if (high.length === 0) {
      toast.info('No high-confidence suggestions (≥85%) yet')
      return
    }
    // Group by category
    const byCategory = new Map<string, string[]>()
    for (const r of high) {
      const cat = r.aiSuggestedCategory!
      const names = memberNames(r)
      byCategory.set(cat, [...(byCategory.get(cat) || []), ...names])
    }
    setIsBulkSaving(true)
    try {
      for (const [cat, names] of Array.from(byCategory.entries())) {
        await applyCategoryToContacts(names, cat)
      }
      toast.success(`Accepted ${high.length} high-confidence suggestions`)
      await fetchSuppliers()
      setReviewIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Batch accept failed')
    } finally {
      setIsBulkSaving(false)
    }
  }

  async function reviewAccept() {
    const row = reviewQueue[reviewIndex]
    if (!row || !row.aiSuggestedCategory) return
    setSavingKey(row.key)
    try {
      await applyCategoryToContacts(memberNames(row), row.aiSuggestedCategory)
      await fetchSuppliers()
      // After refetch, reviewQueue will shrink. reviewIndex stays the same so user sees next row.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Accept failed')
    } finally {
      setSavingKey(null)
    }
  }

  function reviewSkip() {
    if (reviewIndex < reviewQueue.length - 1) setReviewIndex(reviewIndex + 1)
    else setReviewMode(false)
  }

  // Keyboard shortcuts for review mode
  useEffect(() => {
    if (!reviewMode) return
    function onKey(e: KeyboardEvent) {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setReviewIndex(i => Math.min(i + 1, reviewQueue.length - 1)) }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setReviewIndex(i => Math.max(i - 1, 0)) }
      else if (e.key === 'a') { e.preventDefault(); reviewAccept() }
      else if (e.key === 's') { e.preventDefault(); reviewSkip() }
      else if (e.key === 'Escape') { e.preventDefault(); setReviewMode(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewMode, reviewQueue, reviewIndex])

  // ── Render ───────────────────────────────────────────────────────
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

  if (reviewMode) {
    return (
      <AIReviewMode
        queue={reviewQueue}
        index={reviewIndex}
        onIndexChange={setReviewIndex}
        onAccept={reviewAccept}
        onSkip={reviewSkip}
        onChange={(row, cat) => {
          setPendingCategories(prev => ({ ...prev, [row.key]: cat }))
        }}
        pendingCategories={pendingCategories}
        onApplyChanged={async row => {
          const cat = pendingCategories[row.key]
          if (!cat) return
          await applyCategoryToContacts(memberNames(row), cat)
          setPendingCategories(prev => { const n = { ...prev }; delete n[row.key]; return n })
          await fetchSuppliers()
        }}
        onAcceptAllHigh={acceptAllHighConfidence}
        isSaving={isBulkSaving || !!savingKey}
        onExit={() => setReviewMode(false)}
      />
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Classify Your Suppliers
            </CardTitle>
            <CardDescription className="mt-1">
              Assign an emission category to each supplier. All their transactions are classified automatically.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFiltersOpen(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filters
            </Button>
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
            {reviewQueue.length > 0 && (
              <Button
                size="sm"
                variant="default"
                onClick={() => { setReviewMode(true); setReviewIndex(0) }}
              >
                Review {reviewQueue.length} AI suggestion{reviewQueue.length === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {classifiedRows} of {totalRows} {filters.clusters ? 'groups' : 'suppliers'} classified
              {totalUnclassifiedTx > 0 && (
                <span className="text-amber-400 ml-2">({totalUnclassifiedTx} transactions remaining)</span>
              )}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" indicatorColor="lime" />
        </div>

        <div className="mt-3 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {filtersOpen && (
          <div className="mt-3 p-3 rounded-md border border-border bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sort</label>
              <Select value={filters.sort} onValueChange={(v: SortKey) => setFilters({ ...filters, sort: v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend" className="text-xs">Spend (desc)</SelectItem>
                  <SelectItem value="count" className="text-xs">Transaction count</SelectItem>
                  <SelectItem value="name" className="text-xs">A–Z</SelectItem>
                  <SelectItem value="ai_confidence" className="text-xs">AI confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</label>
              <Select value={filters.source} onValueChange={(v: SourceFilter) => setFilters({ ...filters, source: v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  <SelectItem value="unclassified" className="text-xs">Unclassified only</SelectItem>
                  <SelectItem value="ai" className="text-xs">Classified by AI</SelectItem>
                  <SelectItem value="rule" className="text-xs">Classified by rule</SelectItem>
                  <SelectItem value="manual" className="text-xs">Classified manually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Min spend (£)</label>
              <Input
                type="number"
                min={0}
                value={filters.minSpend}
                onChange={e => setFilters({ ...filters, minSpend: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Grouping</label>
              <Button
                size="sm"
                variant={filters.clusters ? 'default' : 'outline'}
                onClick={() => setFilters({ ...filters, clusters: !filters.clusters })}
                className="h-8 text-xs mt-1 w-full justify-start"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                {filters.clusters ? 'Smart grouping on' : 'Smart grouping off'}
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-background border-y border-border px-6 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1 max-w-xs">
            <CategorySelect value={bulkCategory} onChange={setBulkCategory} placeholder="Category..." />
          </div>
          <Button size="sm" onClick={handleBulkApply} disabled={!bulkCategory || isBulkSaving}>
            {isBulkSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Apply to all
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setBulkCategory('exclude'); handleBulkApply() }} disabled={isBulkSaving}>
            <Ban className="h-3.5 w-3.5 mr-1.5" /> Exclude
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <CardContent className="pt-0">
        {/* Unclassified */}
        {unclassified.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Needs Classification ({unclassified.length})
              </div>
              <button
                onClick={selectAllVisible}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all visible
              </button>
            </div>

            <div className="space-y-1">
              {unclassified.map(row => (
                <ClusterRow
                  key={row.key}
                  row={row}
                  selected={selected.has(row.key)}
                  onToggleSelected={() => toggleSelected(row.key)}
                  selectedCategory={pendingCategories[row.key] || ''}
                  onCategoryChange={cat =>
                    setPendingCategories(prev => ({ ...prev, [row.key]: cat }))
                  }
                  onApply={() => handleApplyRow(row)}
                  isSaving={savingKey === row.key}
                  variant="unclassified"
                  isExpanded={expandedClusters.has(row.key)}
                  onToggleExpand={() => {
                    setExpandedClusters(prev => {
                      const n = new Set(prev)
                      if (n.has(row.key)) n.delete(row.key); else n.add(row.key)
                      return n
                    })
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {classified.length > 0 && (
          <Collapsible open={classifiedOpen} onOpenChange={setClassifiedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${classifiedOpen ? '' : '-rotate-90'}`} />
              Classified ({classified.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1">
                {classified.map(row => (
                  <ClusterRow
                    key={row.key}
                    row={row}
                    selected={selected.has(row.key)}
                    onToggleSelected={() => toggleSelected(row.key)}
                    selectedCategory={pendingCategories[row.key] || row.currentCategory || ''}
                    onCategoryChange={cat =>
                      setPendingCategories(prev => ({ ...prev, [row.key]: cat }))
                    }
                    onApply={() => handleApplyRow(row)}
                    isSaving={savingKey === row.key}
                    variant="classified"
                    isExpanded={expandedClusters.has(row.key)}
                    onToggleExpand={() => {
                      setExpandedClusters(prev => {
                        const n = new Set(prev)
                        if (n.has(row.key)) n.delete(row.key); else n.add(row.key)
                        return n
                      })
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {excluded.length > 0 && (
          <Collapsible open={excludedOpen} onOpenChange={setExcludedOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${excludedOpen ? '' : '-rotate-90'}`} />
              Excluded ({excluded.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1">
                {excluded.map(row => (
                  <ClusterRow
                    key={row.key}
                    row={row}
                    selected={selected.has(row.key)}
                    onToggleSelected={() => toggleSelected(row.key)}
                    selectedCategory={pendingCategories[row.key] || 'exclude'}
                    onCategoryChange={cat =>
                      setPendingCategories(prev => ({ ...prev, [row.key]: cat }))
                    }
                    onApply={() => handleApplyRow(row)}
                    isSaving={savingKey === row.key}
                    variant="excluded"
                    isExpanded={expandedClusters.has(row.key)}
                    onToggleExpand={() => {
                      setExpandedClusters(prev => {
                        const n = new Set(prev)
                        if (n.has(row.key)) n.delete(row.key); else n.add(row.key)
                        return n
                      })
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {filteredRows.length === 0 && searchQuery && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No suppliers match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function memberNames(row: SupplierCluster): string[] {
  return row.members.map(m => m.contactName)
}

// ── Cluster Row ────────────────────────────────────────────────────

interface ClusterRowProps {
  row: SupplierCluster
  selected: boolean
  onToggleSelected: () => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onApply: () => void
  isSaving: boolean
  variant: 'unclassified' | 'classified' | 'excluded'
  isExpanded: boolean
  onToggleExpand: () => void
}

function ClusterRow({
  row,
  selected,
  onToggleSelected,
  selectedCategory,
  onCategoryChange,
  onApply,
  isSaving,
  variant,
  isExpanded,
  onToggleExpand,
}: ClusterRowProps) {
  const hasAI = !!row.aiSuggestedCategory
  const hasPendingChange = variant === 'classified'
    ? selectedCategory !== row.currentCategory
    : variant === 'excluded'
      ? selectedCategory !== 'exclude'
      : !!selectedCategory

  const isCluster = row.members.length > 1

  return (
    <div>
      <div className={`
        flex items-center gap-3 py-2 px-3 rounded-md text-sm
        ${variant === 'unclassified' ? 'bg-slate-50 dark:bg-slate-900/50' : ''}
        ${variant === 'excluded' ? 'opacity-60' : ''}
      `}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelected}
          aria-label="Select supplier"
        />

        {isCluster ? (
          <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-3.5" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{row.canonicalName}</span>
            {isCluster && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {row.members.length} variants
              </Badge>
            )}
            {hasAI && variant === 'unclassified' && (
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
                      AI suggests: <strong>{CATEGORY_LABELS[row.aiSuggestedCategory!] || row.aiSuggestedCategory}</strong>
                      {row.aiSuggestedConfidence && (
                        <span className="ml-1 text-muted-foreground">
                          ({Math.round(row.aiSuggestedConfidence * 100)}% confidence)
                        </span>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {variant === 'classified' && row.classificationSource && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {CLASSIFICATION_SOURCE_LABELS[row.classificationSource] || row.classificationSource}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.transactionCount} transaction{row.transactionCount !== 1 ? 's' : ''}
            {' · '}
            {currencyFmt.format(row.totalSpend)}
          </div>
        </div>

        <div className="w-48 shrink-0">
          <CategorySelect value={selectedCategory} onChange={onCategoryChange} />
        </div>

        <Button
          size="sm"
          variant={hasPendingChange ? 'default' : 'ghost'}
          className="h-8 w-8 p-0 shrink-0"
          onClick={onApply}
          disabled={!hasPendingChange || isSaving}
          aria-label="Apply"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isCluster && isExpanded && (
        <div className="ml-14 pl-3 border-l border-border mt-1 mb-2 space-y-0.5">
          {row.members.map(m => (
            <div key={m.contactName} className="flex items-center justify-between py-1 text-xs text-muted-foreground">
              <span className="truncate">{m.contactName}</span>
              <span>{m.transactionCount} tx · {currencyFmt.format(m.totalSpend)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Category select (shared) ───────────────────────────────────────

function CategorySelect({
  value,
  onChange,
  placeholder = 'Select category...',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
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
  )
}

// ── AI Review Mode ─────────────────────────────────────────────────

interface AIReviewModeProps {
  queue: SupplierCluster[]
  index: number
  onIndexChange: (i: number) => void
  onAccept: () => Promise<void>
  onSkip: () => void
  onChange: (row: SupplierCluster, cat: string) => void
  pendingCategories: Record<string, string>
  onApplyChanged: (row: SupplierCluster) => Promise<void>
  onAcceptAllHigh: () => Promise<void>
  isSaving: boolean
  onExit: () => void
}

function AIReviewMode({
  queue,
  index,
  onIndexChange,
  onAccept,
  onSkip,
  onChange,
  pendingCategories,
  onApplyChanged,
  onAcceptAllHigh,
  isSaving,
  onExit,
}: AIReviewModeProps) {
  const current = queue[index]
  const highCount = queue.filter(r => (r.aiSuggestedConfidence || 0) >= 0.85).length

  if (queue.length === 0 || !current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            AI Review
          </CardTitle>
          <CardDescription>No AI suggestions to review. Run &ldquo;Suggest with AI&rdquo; first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onExit}>Back to suppliers</Button>
        </CardContent>
      </Card>
    )
  }

  const suggestedLabel = CATEGORY_LABELS[current.aiSuggestedCategory!] || current.aiSuggestedCategory
  const confidencePct = current.aiSuggestedConfidence ? Math.round(current.aiSuggestedConfidence * 100) : null
  const pendingOverride = pendingCategories[current.key]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              AI Review · {index + 1} of {queue.length}
            </CardTitle>
            <CardDescription className="mt-1">
              Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">A</kbd> accept ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">S</kbd> skip ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">J/K</kbd> next/prev ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> exit
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {highCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAcceptAllHigh}
                disabled={isSaving}
              >
                Accept all high-confidence ({highCount})
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onExit}>Exit</Button>
          </div>
        </div>
        <Progress value={((index + 1) / queue.length) * 100} className="h-1.5 mt-3" indicatorColor="lime" />
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border border-border p-5 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</div>
            <div className="text-lg font-semibold mt-1">{current.canonicalName}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {current.transactionCount} transaction{current.transactionCount === 1 ? '' : 's'} · {currencyFmt.format(current.totalSpend)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-sm">AI suggests</span>
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-400/40">{suggestedLabel}</Badge>
            {confidencePct !== null && (
              <span className="text-xs text-muted-foreground">{confidencePct}% confidence</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CategorySelect
                value={pendingOverride || current.aiSuggestedCategory || ''}
                onChange={cat => onChange(current, cat)}
                placeholder="Change category..."
              />
            </div>
            {pendingOverride && pendingOverride !== current.aiSuggestedCategory ? (
              <Button onClick={() => onApplyChanged(current)} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Apply change
              </Button>
            ) : (
              <Button onClick={onAccept} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Accept
              </Button>
            )}
            <Button variant="outline" onClick={onSkip} disabled={isSaving}>
              <SkipForward className="h-4 w-4 mr-1.5" />
              Skip
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button
            onClick={() => onIndexChange(Math.max(0, index - 1))}
            disabled={index === 0}
            className="disabled:opacity-50"
          >
            ← Previous
          </button>
          <button
            onClick={() => onIndexChange(Math.min(queue.length - 1, index + 1))}
            disabled={index >= queue.length - 1}
            className="disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
