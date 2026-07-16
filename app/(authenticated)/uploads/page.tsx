'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'
import {
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  AlertCircle,
  Inbox,
  ArrowRight,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Uploads jobs inbox (U4)
//
// Ingest and URL-import jobs were previously invisible to users: close the
// dropzone mid-analysis or let a poll time out and the finished job was
// orphaned, with the only list living behind /admin/ingest-learning. This page
// is a read-only view over BOTH job tables for the signed-in user, so nothing
// gets lost (and nobody re-uploads and re-pays for classification).
//
// Read-only by contract: no API routes, calculator or ingest code is touched.
// ─────────────────────────────────────────────────────────────────────────────

interface IngestJobRow {
  id: string
  status: string
  phase_message: string | null
  result_type: string | null
  result_payload: Record<string, unknown> | null
  file_name: string | null
  file_mime: string | null
  error: string | null
  created_at: string
  updated_at: string
}

interface ProductImportJobRow {
  id: string
  url: string
  status: string
  phase_message: string | null
  pages_analyzed: number | null
  products: unknown[] | null
  error: string | null
  created_at: string
  updated_at: string
}

type JobKind = 'smart_upload' | 'website_import'

interface UnifiedJob {
  id: string
  kind: JobKind
  title: string
  status: string
  phaseMessage: string | null
  summary: string | null
  /** Where completed work landed, when a plain link can safely reach it. */
  href: string | null
  hrefLabel: string | null
  /** Handoff note when resuming needs the Smart Upload dialog (no plain link). */
  reopenNote: string | null
  error: string | null
  createdAt: string
}

// A completed smart upload holds a result_type. Most handoff types (BOM, menu,
// evidence, bills) only finish committing inside the Smart Upload dialog's own
// wizard — resuming needs the file re-fed through that machinery, which a plain
// link can't trigger. So for those we surface a friendly summary plus a
// "re-open Smart Upload" note rather than a broken deep link. This is the
// deliberate, honest choice called for in the brief.
const RESULT_TYPE_LABELS: Record<string, string> = {
  utility_bill: 'Energy bill read',
  water_bill: 'Water bill read',
  waste_bill: 'Waste bill read',
  bom: 'Recipe / bill of materials',
  bulk_xlsx: 'Spreadsheet read',
  spray_diary: 'Spray diary',
  supplier_invoice: 'Supplier invoice',
  freight_invoice: 'Freight invoice',
  refrigerant_service: 'Refrigerant service record',
  packaging_spec: 'Packaging specification',
  supplier_coa: 'Supplier certificate of analysis',
  certification: 'Certification',
  soil_carbon_lab: 'Soil carbon lab result',
  soil_carbon_evidence: 'Soil carbon evidence',
  accounts_csv: 'Accounts export',
  smart_meter_csv: 'Smart meter export',
  historical_sustainability_report: 'Historical sustainability report',
  historical_lca_report: 'Historical LCA report',
  hospitality_menu: 'Menu',
  pos_sales_export: 'Sales export',
  unsupported: 'Not recognised',
}

function resultTypeLabel(resultType: string | null): string | null {
  if (!resultType) return null
  return RESULT_TYPE_LABELS[resultType] ?? resultType.replace(/_/g, ' ')
}

const IN_PROGRESS_STATUSES = new Set(['pending', 'extracting', 'scraping'])

function isInProgress(status: string): boolean {
  return IN_PROGRESS_STATUSES.has(status)
}

function statusBadge(status: string) {
  if (status === 'completed') {
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">Completed</Badge>
  }
  if (status === 'failed') {
    return <Badge className="bg-red-600 hover:bg-red-600 text-white">Failed</Badge>
  }
  if (isInProgress(status)) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-black gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === 'scraping'
          ? 'Reading website'
          : status === 'extracting'
            ? 'Extracting'
            : 'In progress'}
      </Badge>
    )
  }
  return <Badge variant="secondary">{status}</Badge>
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export default function UploadsPage() {
  const { currentOrganization } = useOrganization()
  const [userId, setUserId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<UnifiedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobs = useCallback(async () => {
    // Resolve the signed-in user the same way the app does elsewhere (the
    // browser client carries the session). We filter by user_id so a user only
    // ever sees their own jobs; org is applied when present on the row.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUserId(null)
      setJobs([])
      return
    }
    setUserId(user.id)
    const orgId = currentOrganization?.id ?? null

    // Both queries: this user's rows, newest first, capped. ingest_jobs always
    // carries an organization_id (NOT NULL); product_import_jobs may not, so we
    // only constrain org when we have one and leave null-org rows visible.
    let ingestQuery = supabase
      .from('ingest_jobs')
      .select(
        'id, status, phase_message, result_type, result_payload, file_name, file_mime, error, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (orgId) ingestQuery = ingestQuery.eq('organization_id', orgId)

    const importQuery = supabase
      .from('product_import_jobs')
      .select(
        'id, url, status, phase_message, pages_analyzed, products, error, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const [ingestRes, importRes] = await Promise.all([ingestQuery, importQuery])

    if (ingestRes.error) console.error('Error loading smart uploads:', ingestRes.error)
    if (importRes.error) console.error('Error loading website imports:', importRes.error)

    const ingestJobs: UnifiedJob[] = (ingestRes.data as IngestJobRow[] | null ?? []).map(
      mapIngestJob,
    )
    const importJobs: UnifiedJob[] = (importRes.data as ProductImportJobRow[] | null ?? []).map(
      mapImportJob,
    )

    const merged = [...ingestJobs, ...importJobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    setJobs(merged)
  }, [currentOrganization?.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchJobs().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchJobs])

  // Refetch when the tab regains focus — a job that finished while the user was
  // elsewhere shows up without a manual refresh, and without any polling.
  useEffect(() => {
    const onFocus = () => {
      fetchJobs()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchJobs])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchJobs()
    setRefreshing(false)
  }

  const inProgressCount = useMemo(
    () => jobs.filter((j) => isInProgress(j.status)).length,
    [jobs],
  )

  if (loading) {
    return <PageLoader message="Loading your uploads..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uploads</h1>
          <p className="text-muted-foreground mt-2">
            Every smart upload and website import you have started, so nothing gets lost if you
            close a dialog mid-analysis.
            {inProgressCount > 0 && (
              <span className="ml-1">
                {inProgressCount} still in progress.
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {!userId ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please sign in to see your uploads.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No uploads yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              When you use Smart Upload or import a product from a website, the job appears here so
              you can track it and pick up where you left off.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobRow key={`${job.kind}-${job.id}`} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}

function JobRow({ job }: { job: UnifiedJob }) {
  const inProgress = isInProgress(job.status)
  const KindIcon = job.kind === 'website_import' ? Globe : FileText

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-4 py-4">
        <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/60 flex items-center justify-center">
          <KindIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {job.kind === 'website_import' ? 'Website import' : 'Smart upload'}
            </span>
            {statusBadge(job.status)}
          </div>

          <p className="font-medium truncate" title={job.title}>
            {job.title}
          </p>

          {inProgress && job.phaseMessage && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              {job.phaseMessage}
            </p>
          )}

          {!inProgress && job.summary && (
            <p className="text-sm text-muted-foreground">{job.summary}</p>
          )}

          {job.status === 'failed' && job.error && (
            <p className="text-sm text-red-600 dark:text-red-400 break-words">{job.error}</p>
          )}

          {job.reopenNote && (
            <p className="text-xs text-muted-foreground italic">{job.reopenNote}</p>
          )}

          <div className="flex items-center gap-3 pt-0.5">
            <span className="text-xs text-muted-foreground">{relativeTime(job.createdAt)}</span>
            {job.href && job.hrefLabel && (
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs gap-1">
                <Link href={job.href}>
                  {job.hrefLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── mappers ─────────────────────────────────────────────────────────────────

function mapIngestJob(row: IngestJobRow): UnifiedJob {
  const typeLabel = resultTypeLabel(row.result_type)
  let summary: string | null = null
  let reopenNote: string | null = null

  if (row.status === 'completed') {
    if (row.result_type === 'unsupported') {
      const reason =
        (row.result_payload as { reason?: string } | null)?.reason ??
        'We could not recognise this document.'
      summary = reason
    } else {
      summary = typeLabel ? `${typeLabel} recognised.` : 'Analysis complete.'
      // Handoff types finish inside the Smart Upload dialog wizard, which a
      // plain link can't drive. Be honest rather than link to a page that
      // implies the data was already saved.
      reopenNote = 'Re-open Smart Upload to action this.'
    }
  }

  return {
    id: row.id,
    kind: 'smart_upload',
    title: row.file_name || 'Uploaded document',
    status: row.status,
    phaseMessage: row.phase_message,
    summary,
    href: null,
    hrefLabel: null,
    reopenNote,
    error: row.error,
    createdAt: row.created_at,
  }
}

function mapImportJob(row: ProductImportJobRow): UnifiedJob {
  const productCount = Array.isArray(row.products) ? row.products.length : 0
  let summary: string | null = null
  let href: string | null = null
  let hrefLabel: string | null = null

  if (row.status === 'completed') {
    const pagesBit =
      row.pages_analyzed && row.pages_analyzed > 0
        ? ` from ${row.pages_analyzed} page${row.pages_analyzed === 1 ? '' : 's'}`
        : ''
    summary =
      productCount > 0
        ? `${productCount} product${productCount === 1 ? '' : 's'} found${pagesBit}.`
        : `Website read${pagesBit}.`
    // Imported products land in the products list.
    href = '/products'
    hrefLabel = 'View products'
  }

  return {
    id: row.id,
    kind: 'website_import',
    title: prettyUrl(row.url),
    status: row.status,
    phaseMessage: row.phase_message,
    summary,
    href,
    hrefLabel,
    reopenNote: null,
    error: row.error,
    createdAt: row.created_at,
  }
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}
