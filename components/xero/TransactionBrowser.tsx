'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, Search, ChevronLeft, ChevronRight, Filter, X, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  CATEGORY_LABELS,
  EMISSION_CATEGORY_OPTIONS,
  CLASSIFICATION_SOURCE_LABELS,
  UPGRADE_STATUS_LABELS,
  TIER_CONFIG,
} from '@/lib/xero/category-labels'

interface Transaction {
  id: string
  xero_contact_name: string | null
  description: string | null
  amount: number
  transaction_date: string
  emission_category: string | null
  classification_source: string | null
  classification_confidence: number | null
  data_quality_tier: number
  upgrade_status: string
}

const PAGE_SIZE = 50

export function TransactionBrowser() {
  const { currentOrganization } = useOrganization()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // CSV export
  const [isExporting, setIsExporting] = useState(false)

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<string>('')

  const fetchTransactions = useCallback(async () => {
    if (!currentOrganization?.id) return
    setIsLoading(true)

    let query = supabase
      .from('xero_transactions')
      .select(
        'id, xero_contact_name, description, amount, transaction_date, emission_category, classification_source, classification_confidence, data_quality_tier, upgrade_status',
        { count: 'exact' }
      )
      .eq('organization_id', currentOrganization.id)
      .order('transaction_date', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterCategory && filterCategory !== 'all') {
      query = query.eq('emission_category', filterCategory)
    }
    if (filterSource && filterSource !== 'all') {
      query = query.eq('classification_source', filterSource)
    }
    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('upgrade_status', filterStatus)
    }
    if (search.trim()) {
      query = query.or(`xero_contact_name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
    }

    const { data, count } = await query

    setTransactions(data || [])
    setTotal(count || 0)
    setIsLoading(false)
  }, [currentOrganization?.id, page, filterCategory, filterSource, filterStatus, search])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [filterCategory, filterSource, filterStatus, search])

  async function handleReclassify(txId: string) {
    if (!editCategory) return

    const category = editCategory === 'none' ? null : editCategory
    const { error } = await supabase
      .from('xero_transactions')
      .update({
        emission_category: category,
        classification_source: 'manual',
        classification_confidence: 1.0,
        upgrade_status: category ? 'pending' : 'not_applicable',
        updated_at: new Date().toISOString(),
      })
      .eq('id', txId)

    if (error) {
      toast.error('Failed to reclassify')
      return
    }

    toast.success('Transaction reclassified')
    setEditingId(null)
    fetchTransactions()
  }

  function clearFilters() {
    setSearch('')
    setFilterCategory('all')
    setFilterSource('all')
    setFilterStatus('all')
    setPage(0)
  }

  async function handleExportCSV() {
    if (!currentOrganization?.id) return
    setIsExporting(true)

    try {
      const params = new URLSearchParams({ organizationId: currentOrganization.id })
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory)
      if (filterSource && filterSource !== 'all') params.set('source', filterSource)
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/xero/export-csv?${params.toString()}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xero-transactions-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Transactions exported successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export transactions'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  const hasFilters = search || filterCategory !== 'all' || filterSource !== 'all' || filterStatus !== 'all'
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Math.abs(amount))

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search supplier or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EMISSION_CATEGORY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(CLASSIFICATION_SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(UPGRADE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={isExporting || total === 0}
          className="h-9"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} transaction{total !== 1 ? 's' : ''}
          {hasFilters ? ' (filtered)' : ''}
        </span>
        {totalPages > 1 && (
          <span>Page {page + 1} of {totalPages}</span>
        )}
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {hasFilters ? 'No transactions match your filters.' : 'No transactions imported yet.'}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="max-w-[200px]">Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Conf.</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(tx => {
                const tierConfig = TIER_CONFIG[tx.data_quality_tier] || TIER_CONFIG[4]
                const isEditing = editingId === tx.id

                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(tx.transaction_date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[150px]">
                      {tx.xero_contact_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={tx.description || ''}>
                      {tx.description || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger className="h-7 text-xs w-[130px]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unclassified</SelectItem>
                              {EMISSION_CATEGORY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleReclassify(tx.id)}>
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-1" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-left"
                          onClick={() => {
                            setEditingId(tx.id)
                            setEditCategory(tx.emission_category || 'none')
                          }}
                        >
                          {tx.emission_category ? (
                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                              {CATEGORY_LABELS[tx.emission_category] || tx.emission_category}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic cursor-pointer hover:underline">
                              Unclassified
                            </span>
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.classification_source
                        ? CLASSIFICATION_SOURCE_LABELS[tx.classification_source] || tx.classification_source
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {tx.classification_confidence != null
                        ? `${Math.round(tx.classification_confidence * 100)}%`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${tierConfig.colour}`}>
                        T{tx.data_quality_tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          tx.upgrade_status === 'upgraded'
                            ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                            : tx.upgrade_status === 'pending'
                              ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                              : ''
                        }`}
                      >
                        {UPGRADE_STATUS_LABELS[tx.upgrade_status] || tx.upgrade_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
