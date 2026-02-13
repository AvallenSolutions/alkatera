'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
  RefreshCw,
  Package,
  PoundSterling,
  Scale,
  ShieldCheck,
  Hash,
} from 'lucide-react'
import type { EPRSubmission, EPRSubmissionLine, RPDMaterialCode } from '@/lib/epr/types'
import { RPD_MATERIAL_NAMES } from '@/lib/epr/constants'

// ---------------------------------------------------------------------------
// Submission period and fee year config
// ---------------------------------------------------------------------------

const SUBMISSION_PERIODS = [
  { value: '2025-H1', label: '2025 H1 (Jan-Jun)' },
  { value: '2025-H2', label: '2025 H2 (Jul-Dec)' },
  { value: '2025-P0', label: '2025 Full Year' },
  { value: '2026-H1', label: '2026 H1 (Jan-Jun)' },
  { value: '2026-H2', label: '2026 H2 (Jul-Dec)' },
  { value: '2026-P0', label: '2026 Full Year' },
]

function deriveFeeYear(period: string): string {
  if (period.startsWith('2025')) return '2025-26'
  if (period.startsWith('2026')) return '2026-27'
  return '2025-26'
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusBadge(status: EPRSubmission['status']) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-zinc-700 text-zinc-200">Draft</Badge>
    case 'ready':
      return <Badge className="bg-blue-600/20 text-blue-400 border border-blue-600/40">Ready</Badge>
    case 'submitted':
      return <Badge className="bg-green-600/20 text-green-400 border border-green-600/40">Submitted</Badge>
    case 'amended':
      return <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/40">Amended</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ---------------------------------------------------------------------------
// Sort helper types
// ---------------------------------------------------------------------------

type SortField =
  | 'product_name'
  | 'rpd_packaging_material'
  | 'rpd_packaging_activity'
  | 'rpd_packaging_type'
  | 'rpd_from_nation'
  | 'rpd_material_weight_kg'
  | 'rpd_material_units'
  | 'rpd_recyclability_rating'
  | 'fee_rate_per_tonne'
  | 'estimated_fee_gbp'
  | 'is_drs_excluded'

type SortDirection = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EPRSubmissionsPage() {
  const { currentOrganization } = useOrganization()
  const organizationId = currentOrganization?.id

  // Period selector
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2025-H1')
  const feeYear = deriveFeeYear(selectedPeriod)

  // Submissions list
  const [submissions, setSubmissions] = useState<EPRSubmission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)

  // Active submission + lines
  const [activeSubmission, setActiveSubmission] = useState<EPRSubmission | null>(null)
  const [lines, setLines] = useState<EPRSubmissionLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)

  // Generation / export
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [markingSubmitted, setMarkingSubmitted] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])

  // Sort state for lines table
  const [sortField, setSortField] = useState<SortField>('product_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // -----------------------------------------------------------------------
  // Fetch submissions list
  // -----------------------------------------------------------------------

  const fetchSubmissions = useCallback(async () => {
    if (!organizationId) return
    setLoadingSubmissions(true)
    try {
      const { data, error } = await supabase
        .from('epr_submissions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubmissions((data as EPRSubmission[]) || [])
    } catch (err) {
      console.error('Error fetching submissions:', err)
      toast.error('Failed to load submissions')
    } finally {
      setLoadingSubmissions(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  // -----------------------------------------------------------------------
  // Fetch lines for an active submission
  // -----------------------------------------------------------------------

  const fetchLines = useCallback(async (submissionId: string) => {
    setLoadingLines(true)
    try {
      const { data, error } = await supabase
        .from('epr_submission_lines')
        .select('*')
        .eq('submission_id', submissionId)
        .order('rpd_packaging_material', { ascending: true })

      if (error) throw error
      setLines((data as EPRSubmissionLine[]) || [])
    } catch (err) {
      console.error('Error fetching submission lines:', err)
      toast.error('Failed to load submission lines')
    } finally {
      setLoadingLines(false)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Select a submission (click on card)
  // -----------------------------------------------------------------------

  const selectSubmission = useCallback(
    (submission: EPRSubmission) => {
      setActiveSubmission(submission)
      setWarnings([])
      fetchLines(submission.id)
    },
    [fetchLines],
  )

  // -----------------------------------------------------------------------
  // Generate Submission
  // -----------------------------------------------------------------------

  const handleGenerate = async () => {
    if (!organizationId) return
    setGenerating(true)
    setWarnings([])

    try {
      const res = await fetch('/api/epr/generate-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          submission_period: selectedPeriod,
          fee_year: feeYear,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate submission')

      toast.success('Submission generated successfully')
      setActiveSubmission(data.submission as EPRSubmission)
      setLines((data.lines as EPRSubmissionLine[]) || [])
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings)
      }

      // Refresh submissions list
      await fetchSubmissions()
    } catch (err) {
      console.error('Error generating submission:', err)
      const message = err instanceof Error ? err.message : 'Failed to generate submission'
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }

  // -----------------------------------------------------------------------
  // Export CSV
  // -----------------------------------------------------------------------

  const handleExportCSV = async () => {
    if (!organizationId || !activeSubmission) return
    setExporting(true)

    try {
      const res = await fetch('/api/epr/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          submissionId: activeSubmission.id,
        }),
      })

      // Check if the response is a direct CSV download (fallback when storage fails)
      const contentType = res.headers.get('Content-Type')
      if (contentType?.includes('text/csv')) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'rpd_export.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.success('CSV downloaded')
        await fetchSubmissions()
        // Refresh active submission
        const { data: refreshed } = await supabase
          .from('epr_submissions')
          .select('*')
          .eq('id', activeSubmission.id)
          .single()
        if (refreshed) setActiveSubmission(refreshed as EPRSubmission)
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to export CSV')

      // Open signed download URL
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      }

      toast.success(`CSV exported (${data.line_count} lines)`)

      // Refresh
      await fetchSubmissions()
      const { data: refreshed } = await supabase
        .from('epr_submissions')
        .select('*')
        .eq('id', activeSubmission.id)
        .single()
      if (refreshed) setActiveSubmission(refreshed as EPRSubmission)
    } catch (err) {
      console.error('Error exporting CSV:', err)
      const message = err instanceof Error ? err.message : 'Failed to export CSV'
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  // -----------------------------------------------------------------------
  // Mark as Submitted
  // -----------------------------------------------------------------------

  const handleMarkSubmitted = async () => {
    if (!activeSubmission) return
    setMarkingSubmitted(true)

    try {
      const { error } = await supabase
        .from('epr_submissions')
        .update({
          status: 'submitted',
          submitted_to_rpd_at: new Date().toISOString(),
        })
        .eq('id', activeSubmission.id)

      if (error) throw error

      toast.success('Submission marked as submitted')
      setActiveSubmission({ ...activeSubmission, status: 'submitted', submitted_to_rpd_at: new Date().toISOString() })
      await fetchSubmissions()
    } catch (err) {
      console.error('Error marking submission as submitted:', err)
      toast.error('Failed to update submission status')
    } finally {
      setMarkingSubmitted(false)
    }
  }

  // -----------------------------------------------------------------------
  // Sorted lines (client-side)
  // -----------------------------------------------------------------------

  const sortedLines = useMemo(() => {
    const sorted = [...lines]
    sorted.sort((a, b) => {
      let aVal: any = (a as any)[sortField]
      let bVal: any = (b as any)[sortField]

      // Handle nulls
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''

      // Booleans
      if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0
        bVal = bVal ? 1 : 0
      }

      // Numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Strings
      const comparison = String(aVal).localeCompare(String(bVal))
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [lines, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // -----------------------------------------------------------------------
  // Summary calculations
  // -----------------------------------------------------------------------

  const summary = useMemo(() => {
    const totalWeightKg = lines.reduce((sum, l) => sum + (l.rpd_material_weight_kg || 0), 0)
    const totalFee = lines.reduce((sum, l) => sum + (l.estimated_fee_gbp || 0), 0)
    const drsCount = lines.filter(l => l.is_drs_excluded).length

    const materialMap = new Map<string, { weight_kg: number; fee_gbp: number }>()
    for (const line of lines) {
      const code = line.rpd_packaging_material
      const existing = materialMap.get(code) || { weight_kg: 0, fee_gbp: 0 }
      existing.weight_kg += line.rpd_material_weight_kg || 0
      existing.fee_gbp += line.estimated_fee_gbp || 0
      materialMap.set(code, existing)
    }

    const materials = Array.from(materialMap.entries()).map(([code, data]) => ({
      code: code as RPDMaterialCode,
      name: RPD_MATERIAL_NAMES[code as RPDMaterialCode] || code,
      ...data,
    }))

    return { totalWeightKg, totalFee, drsCount, materials }
  }, [lines])

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const formatWeight = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`
    return `${kg.toLocaleString()} kg`
  }

  const formatCurrency = (gbp: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(gbp)

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-[#ccff00] transition-colors text-left"
        onClick={() => toggleSort(field)}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
    </TableHead>
  )

  // -----------------------------------------------------------------------
  // Early return: no org
  // -----------------------------------------------------------------------

  if (!currentOrganization) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Alert>
          <AlertDescription>Please select an organisation to view RPD submissions.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RPD Submissions</h1>
        <p className="text-muted-foreground mt-1">
          Generate, review and export packaging data submissions for the Defra RPD portal.
        </p>
      </div>

      {/* Period Selector + Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submission Period</CardTitle>
          <CardDescription>
            Select a reporting period, then generate a submission from your product packaging data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-64">
              <label className="text-sm font-medium text-muted-foreground">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Fee Year</label>
              <p className="text-sm font-mono h-10 flex items-center">{feeYear}</p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Submission
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="border-amber-600/40 bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription>
            <p className="font-medium text-amber-400 mb-2">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''} during generation:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Existing Submissions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Existing Submissions</h2>
          <Button variant="ghost" size="sm" onClick={fetchSubmissions} disabled={loadingSubmissions}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingSubmissions ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loadingSubmissions ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No submissions yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select a period above and click "Generate Submission" to create your first RPD submission.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.map(sub => (
              <Card
                key={sub.id}
                className={`cursor-pointer transition-all hover:border-[#ccff00]/50 ${
                  activeSubmission?.id === sub.id ? 'border-[#ccff00] ring-1 ring-[#ccff00]/30' : ''
                }`}
                onClick={() => selectSubmission(sub)}
              >
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{sub.submission_period}</span>
                    {statusBadge(sub.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-muted-foreground/70">Weight</span>
                      <span className="font-medium text-foreground">{formatWeight(sub.total_packaging_weight_kg)}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-muted-foreground/70">Fee</span>
                      <span className="font-medium text-foreground">{formatCurrency(sub.total_estimated_fee_gbp)}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-muted-foreground/70">Lines</span>
                      <span className="font-medium text-foreground">{sub.total_line_items}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-muted-foreground/70">CSV</span>
                      <span className="font-medium text-foreground">
                        {sub.csv_generated_at
                          ? new Date(sub.csv_generated_at).toLocaleDateString('en-GB')
                          : '--'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Submission Detail */}
      {activeSubmission && (
        <div className="space-y-6">
          {/* Actions Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {activeSubmission.submission_period}{' '}
                    <span className="text-muted-foreground font-normal">({activeSubmission.fee_year})</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {statusBadge(activeSubmission.status)}
                    {activeSubmission.csv_checksum && (
                      <span className="text-xs font-mono text-muted-foreground" title="CSV Checksum">
                        SHA-256: {activeSubmission.csv_checksum.substring(0, 16)}...
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={exporting || lines.length === 0}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </>
                    )}
                  </Button>
                  {activeSubmission.status !== 'submitted' && (
                    <Button
                      onClick={handleMarkSubmitted}
                      disabled={markingSubmitted}
                      className="bg-green-700 hover:bg-green-600 text-white"
                    >
                      {markingSubmitted ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark as Submitted
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Panel */}
          {lines.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Scale className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Total Weight</span>
                  </div>
                  <p className="text-2xl font-bold">{summary.totalWeightKg.toLocaleString()} kg</p>
                  <p className="text-sm text-muted-foreground">{(summary.totalWeightKg / 1000).toFixed(2)} tonnes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <PoundSterling className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Estimated Fee</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalFee)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Hash className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Line Items</span>
                  </div>
                  <p className="text-2xl font-bold">{lines.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">DRS Excluded</span>
                  </div>
                  <p className="text-2xl font-bold">{summary.drsCount}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Material Breakdown */}
          {summary.materials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Material Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {summary.materials.map(mat => (
                    <div
                      key={mat.code}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      <div>
                        <p className="text-sm font-medium">{mat.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{mat.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatWeight(mat.weight_kg)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(mat.fee_gbp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Lines Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Submission Lines</CardTitle>
              <CardDescription>
                {lines.length} RPD line{lines.length !== 1 ? 's' : ''} for {activeSubmission.submission_period}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLines ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : lines.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No submission lines found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <div className="min-w-[1100px] px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHeader field="product_name">Product</SortableHeader>
                          <SortableHeader field="rpd_packaging_material">Material</SortableHeader>
                          <SortableHeader field="rpd_packaging_activity">Activity</SortableHeader>
                          <SortableHeader field="rpd_packaging_type">Type</SortableHeader>
                          <SortableHeader field="rpd_from_nation">Nation</SortableHeader>
                          <SortableHeader field="rpd_material_weight_kg">Weight (kg)</SortableHeader>
                          <SortableHeader field="rpd_material_units">Units</SortableHeader>
                          <SortableHeader field="rpd_recyclability_rating">Rating</SortableHeader>
                          <SortableHeader field="fee_rate_per_tonne">Rate (/t)</SortableHeader>
                          <SortableHeader field="estimated_fee_gbp">Fee</SortableHeader>
                          <SortableHeader field="is_drs_excluded">DRS</SortableHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedLines.map(line => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium max-w-[180px] truncate" title={line.product_name || ''}>
                              {line.product_name || '--'}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">{line.rpd_packaging_material}</span>{' '}
                              <span className="text-muted-foreground text-xs">
                                {RPD_MATERIAL_NAMES[line.rpd_packaging_material] || ''}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{line.rpd_packaging_activity}</TableCell>
                            <TableCell className="font-mono text-xs">{line.rpd_packaging_type}</TableCell>
                            <TableCell className="font-mono text-xs">{line.rpd_from_nation}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.rpd_material_weight_kg.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.rpd_material_units != null ? line.rpd_material_units.toLocaleString() : '--'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {line.rpd_recyclability_rating || '--'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.fee_rate_per_tonne != null
                                ? formatCurrency(line.fee_rate_per_tonne)
                                : '--'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(line.estimated_fee_gbp)}
                            </TableCell>
                            <TableCell>
                              {line.is_drs_excluded ? (
                                <Badge variant="outline" className="text-amber-400 border-amber-600/40 text-xs">
                                  Excluded
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
