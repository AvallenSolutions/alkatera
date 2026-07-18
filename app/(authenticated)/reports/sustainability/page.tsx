'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Download, TrendingUp, Scale, Link2,
} from 'lucide-react'
import {
  Statement, Eyebrow, StateChip, BigNumber, PillButton, Panel, FactRow,
} from '@/components/studio'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import { VerificationCard } from '@/components/partners/VerificationCard'
import { BrandKitEditor } from '@/components/report-builder/BrandKitEditor'
import { ProvenanceGateDialog } from '@/components/studio/provenance-gate-dialog'
import { parseProvenanceRefusal } from '@/hooks/useProvenanceGate'
import type { ProvenanceBlocker } from '@/lib/provenance/gate'
import { useToast } from '@/hooks/use-toast'
import { AUDIENCE_LABELS } from '@/types/report-builder'
import { toast as sonnerToast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { MaterialityTopic } from '@/lib/materiality/topic-library'
import type { TransitionPlan } from '@/lib/transition-plan/types'
import { SCOPE_LABELS } from '@/lib/transition-plan/types'

// Short mono tag for an ESG category — replaces the old inline CATEGORY_COLOURS dot.
const CATEGORY_TAG: Record<string, string> = {
  environmental: 'ENV',
  social: 'SOC',
  governance: 'GOV',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedReport {
  id: string
  report_name: string
  report_year: number
  audience: string
  output_format: string
  status: string
  document_url: string | null
  error_message: string | null
  created_at: string
  generated_at: string | null
  is_latest: boolean
}

interface MaterialityAssessment {
  id: string
  assessment_year: number
  topics: MaterialityTopic[]
  priority_topics: string[]
  completed_at: string | null
  updated_at: string
}

// ─── Inner Component (uses useSearchParams — requires Suspense) ───────────────

function SustainabilityReportsHub() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { currentOrganization } = useOrganization()

  const currentYear = new Date().getFullYear()
  const activeTab = searchParams.get('tab') || 'reports'

  // ── Core state ───────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [showFailedReports, setShowFailedReports] = useState(false)
  // Active share links by report id (report_shares rows with no revocation)
  const [shareTokens, setShareTokens] = useState<Record<string, string>>({})
  const [shareBusyId, setShareBusyId] = useState<string | null>(null)
  // Blockers returned by a gated route, shown in the studio dialog
  const [gateBlockers, setGateBlockers] = useState<ProvenanceBlocker[] | null>(null)

  // ── Readiness + tab data (fetched together on mount) ─────────────────────────
  const [hasEmissions, setHasEmissions] = useState(false)
  const [matAssessment, setMatAssessment] = useState<MaterialityAssessment | null>(null)
  const [transitionPlan, setTransitionPlan] = useState<TransitionPlan | null>(null)
  const [lcaCount, setLcaCount] = useState(0)

  // ── Initial data load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrganization?.id) return
    fetchAllData()
  }, [currentOrganization?.id])

  // While any report is still generating (kicked off from the funnel page),
  // refresh the list every few seconds so cards flip to Complete on their own.
  // Drafts are parked, not in flight: they never poll.
  const hasInFlight = reports.some(r => r.status !== 'completed' && r.status !== 'failed' && r.status !== 'draft')
  useEffect(() => {
    if (!hasInFlight) return
    const interval = setInterval(fetchReportList, 5000)
    return () => clearInterval(interval)
  }, [hasInFlight, currentOrganization?.id])

  const fetchAllData = async () => {
    if (!currentOrganization?.id) return
    setIsLoading(true)
    const supabase = getSupabaseBrowserClient()
    const orgId = currentOrganization.id

    await Promise.all([
      // Generated reports list
      supabase
        .from('generated_reports')
        .select('id, report_name, report_year, audience, output_format, status, document_url, error_message, created_at, generated_at, is_latest')
        .eq('organization_id', orgId)
        .eq('is_latest', true)
        .order('created_at', { ascending: false })
        .then(({ data }) => setReports(data || [])),

      // Active share links (report_shares is newer than the generated types)
      (supabase as any)
        .from('report_shares')
        .select('report_id, token')
        .eq('organization_id', orgId)
        .is('revoked_at', null)
        .then(({ data }: { data: { report_id: string; token: string }[] | null }) =>
          setShareTokens(Object.fromEntries((data || []).map(s => [s.report_id, s.token])))),

      // Emissions check
      supabase
        .from('corporate_reports')
        .select('id, total_emissions')
        .eq('organization_id', orgId)
        .eq('year', currentYear)
        .maybeSingle()
        .then(({ data }) => setHasEmissions(!!(data && data.total_emissions > 0))),

      // Materiality assessment (full data — used for readiness + tab)
      supabase
        .from('materiality_assessments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('assessment_year', currentYear)
        .maybeSingle()
        .then(({ data }) => setMatAssessment(data as MaterialityAssessment | null)),

      // Transition plan (full data — used for readiness + tab)
      supabase
        .from('transition_plans')
        .select('*')
        .eq('organization_id', orgId)
        .eq('plan_year', currentYear)
        .maybeSingle()
        .then(({ data }) => setTransitionPlan(data as TransitionPlan | null)),

      // LCA count (drinks products only — hospitality meals/drinks/rooms are PCF
      // rows too but belong to the hospitality module, not the LCA count).
      supabase
        .from('product_carbon_footprints')
        .select('id, products!product_lcas_product_id_fkey!inner(product_kind)', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .eq('products.product_kind', 'product')
        .then(({ count }) => setLcaCount(count ?? 0)),
    ])

    setIsLoading(false)
  }

  const fetchReportList = async () => {
    if (!currentOrganization?.id) return
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('generated_reports')
        .select('id, report_name, report_year, audience, output_format, status, document_url, error_message, created_at, generated_at, is_latest')
        .eq('organization_id', currentOrganization.id)
        .eq('is_latest', true)
        .order('created_at', { ascending: false })
      setReports(data || [])
    } catch {
      sonnerToast.error('Failed to refresh reports')
    }
  }

  // ── Tab navigation (URL-synced) ───────────────────────────────────────────────
  const handleTabChange = (tab: string) => {
    router.replace(`/reports/sustainability?tab=${tab}`, { scroll: false })
  }

  const handleDownload = (url: string) => window.open(url, '_blank')

  // ── Share links ───────────────────────────────────────────────────────────────
  const copyShareUrl = async (token: string) => {
    const url = `${window.location.origin}/report/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Anyone with the link can view the report until you revoke it.' })
    } catch {
      toast({ title: 'Copy failed', description: url })
    }
  }

  const handleShare = async (reportId: string) => {
    setShareBusyId(reportId)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const response = await fetch(`/api/reports/${reportId}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        // A public link needs confirmed data behind it: name what to confirm.
        const body = await response.json().catch(() => null)
        const blockers = parseProvenanceRefusal(body)
        if (blockers) {
          setGateBlockers(blockers)
          return
        }
        throw new Error('Share failed')
      }
      const { token: shareToken } = await response.json()
      setShareTokens(prev => ({ ...prev, [reportId]: shareToken }))
      await copyShareUrl(shareToken)
    } catch {
      toast({ title: 'Share failed', description: 'Could not create the share link.', variant: 'destructive' })
    } finally {
      setShareBusyId(null)
    }
  }

  const handleRevokeShare = async (reportId: string) => {
    setShareBusyId(reportId)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const response = await fetch(`/api/reports/${reportId}/share`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Revoke failed')
      setShareTokens(prev => {
        const next = { ...prev }
        delete next[reportId]
        return next
      })
      toast({ title: 'Link revoked', description: 'The shared report is no longer accessible.' })
    } catch {
      toast({ title: 'Revoke failed', description: 'Could not revoke the share link.', variant: 'destructive' })
    } finally {
      setShareBusyId(null)
    }
  }

  const downloadSummary = async (reportId: string, type: 'investor-summary' | 'regulatory-index') => {
    setExportingId(`${reportId}-${type}`)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const response = await fetch(`/api/reports/${reportId}/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const blockers = parseProvenanceRefusal(body)
        if (blockers) {
          setGateBlockers(blockers)
          return
        }
        throw new Error('Export failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `${type}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch {
      toast({ title: 'Export failed', description: 'Could not generate the export.', variant: 'destructive' })
    } finally {
      setExportingId(null)
    }
  }

  const getFormatLabel = (format: string) => {
    const map: Record<string, string> = { pptx: 'PPTX', pdf: 'PDF', html: 'HTML', docx: 'Word', xlsx: 'Excel' }
    return map[format] || format.toUpperCase()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <StateChip tone="good" className="shrink-0">Complete</StateChip>
      case 'failed':
        return <StateChip tone="stale" className="shrink-0">Failed</StateChip>
      case 'draft':
        return <StateChip className="shrink-0">Draft</StateChip>
      default:
        return <StateChip tone="attention" className="shrink-0">Generating</StateChip>
    }
  }

  if (isLoading) return <PageLoader message="Loading reports..." />

  // ── Derived values for readiness panel + tabs ─────────────────────────────────
  const matTopics = matAssessment?.topics?.filter(t => t.status === 'material') || []
  const priorityCount = matAssessment?.priority_topics?.length || 0
  const matComplete = !!matAssessment?.completed_at
  const matInProgress = !!matAssessment && !matComplete
  const envCount = matTopics.filter(t => t.category === 'environmental').length
  const socialCount = matTopics.filter(t => t.category === 'social').length
  const govCount = matTopics.filter(t => t.category === 'governance').length

  const tpHasTargets = (transitionPlan?.targets?.length ?? 0) > 0
  const tpHasMilestones = (transitionPlan?.milestones?.length ?? 0) > 0
  const tpHasRisks = (transitionPlan?.risks_and_opportunities?.length ?? 0) > 0
  const tpComplete = tpHasTargets && tpHasMilestones && tpHasRisks
  const tpInProgress = (tpHasTargets || tpHasMilestones) && !tpComplete

  // Treat any in-flight report older than 2 hours as stale (generation process
  // died). Drafts are exempt: parking one for days is legitimate.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  const isStaleGenerating = (r: GeneratedReport) =>
    r.status !== 'completed' && r.status !== 'failed' && r.status !== 'draft' &&
    Date.now() - new Date(r.created_at).getTime() > TWO_HOURS_MS
  const activeReports = reports.filter(r => r.status !== 'failed' && !isStaleGenerating(r))
  const failedReports = reports.filter(r => r.status === 'failed' || isStaleGenerating(r))

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Statement eyebrow="THE EVIDENCE · REPORTS" headline="Sustainability reports." />
        <p className="text-sm text-muted-foreground">
          Generate, manage and track your annual sustainability reports.
        </p>
      </div>

      {/* ── Report Readiness Panel ───────────────────────────────────────────── */}
      <Panel>
        <div className="mb-4">
          <Eyebrow tone="dim">READINESS · {currentYear}</Eyebrow>
          <p className="text-xs text-muted-foreground mt-1.5">Your data status for the year. Open a tile for detail.</p>
        </div>

        {/* 4 status tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Emissions */}
          <Link href="/data/scope-1-2" className="group">
            <div className="p-3 rounded-[6px] border border-studio-hairline h-full transition-colors cursor-pointer hover:border-foreground/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Emissions data</span>
                <StateChip tone={hasEmissions ? 'good' : 'quiet'}>{hasEmissions ? 'Ready' : 'Todo'}</StateChip>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasEmissions ? `${currentYear} footprint calculated` : 'Not calculated yet'}
              </p>
            </div>
          </Link>

          {/* Materiality */}
          <button onClick={() => handleTabChange('materiality')} className="text-left group">
            <div className="p-3 rounded-[6px] border border-studio-hairline h-full transition-colors cursor-pointer hover:border-foreground/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Materiality</span>
                <StateChip tone={matComplete ? 'good' : matInProgress ? 'attention' : 'quiet'}>
                  {matComplete ? 'Done' : matInProgress ? 'Going' : 'Todo'}
                </StateChip>
              </div>
              <p className="text-xs text-muted-foreground">
                {matComplete
                  ? `${matTopics.length} material topics`
                  : matInProgress ? 'In progress' : 'Not started'}
              </p>
            </div>
          </button>

          {/* Transition Plan */}
          <button onClick={() => handleTabChange('transition-plan')} className="text-left group">
            <div className="p-3 rounded-[6px] border border-studio-hairline h-full transition-colors cursor-pointer hover:border-foreground/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Transition plan</span>
                <StateChip tone={tpComplete ? 'good' : tpInProgress ? 'attention' : 'quiet'}>
                  {tpComplete ? 'Done' : tpInProgress ? 'Going' : 'Todo'}
                </StateChip>
              </div>
              <p className="text-xs text-muted-foreground">
                {tpComplete
                  ? `${transitionPlan!.targets.length} targets set`
                  : tpInProgress ? 'In progress' : 'Not started'}
              </p>
            </div>
          </button>

          {/* LCAs */}
          <Link href="/products" className="group">
            <div className="p-3 rounded-[6px] border border-studio-hairline h-full transition-colors cursor-pointer hover:border-foreground/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Product LCAs</span>
                <StateChip tone={lcaCount > 0 ? 'good' : 'quiet'}>{lcaCount > 0 ? 'Ready' : 'Todo'}</StateChip>
              </div>
              <p className="text-xs text-muted-foreground">
                {lcaCount > 0 ? `${lcaCount} completed` : 'None completed'}
              </p>
            </div>
          </Link>
        </div>

        {/* CTA */}
        <div>
          <PillButton variant="room" href="/reports/builder" className="w-full">
            Create a report
          </PillButton>
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            One page, prefilled from your data. Pick who it is for, confirm, generate.
          </p>
        </div>
      </Panel>

      {/* ── Impact Focus report creation ─────────────────────────────────── */}
      <VerificationCard variant="report-creation" />

      {/* ── Guardian cross-link (the guardian's door from reports) ────────── */}
      <FactRow
        subject="Check a claim before you publish"
        detail="run it past the greenwash guardian"
        meta="OPEN →"
        href="/greenwash-guardian/"
      />

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="reports" className="gap-2">
            Reports
            {activeReports.length > 0 && (
              <StateChip>{activeReports.length}</StateChip>
            )}
          </TabsTrigger>
          <TabsTrigger value="materiality">Materiality</TabsTrigger>
          <TabsTrigger value="transition-plan">Transition Plan</TabsTrigger>
          <TabsTrigger value="brand-kit">Brand kit</TabsTrigger>
        </TabsList>

        {/* ── Reports tab ─────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="mt-6 space-y-4">

          {/* Reports card grid — completed/generating only */}
          {activeReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeReports.map(report => (
                <Panel key={report.id} className="flex flex-col">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold leading-tight truncate text-foreground">{report.report_name}</div>
                      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {report.report_year} · {getFormatLabel(report.output_format)} · {AUDIENCE_LABELS?.[report.audience as keyof typeof AUDIENCE_LABELS] || report.audience}
                      </div>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>

                  <p className="text-xs text-muted-foreground mb-auto">
                    Generated {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </p>

                  {/* Draft: back into the review step */}
                  {report.status === 'draft' && (
                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-studio-hairline">
                      <PillButton size="sm" href={`/reports/builder?draft=${report.id}`}>
                        Review draft
                      </PillButton>
                    </div>
                  )}

                  {/* Actions — only for completed reports */}
                  {report.status === 'completed' && (
                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-studio-hairline">
                      {report.document_url && (
                        <PillButton size="sm" onClick={() => handleDownload(report.document_url!)}>
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </PillButton>
                      )}
                      <PillButton
                        variant="outline"
                        size="sm"
                        disabled={exportingId === `${report.id}-investor-summary`}
                        onClick={() => downloadSummary(report.id, 'investor-summary')}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        {exportingId === `${report.id}-investor-summary` ? 'Exporting...' : 'Investor summary'}
                      </PillButton>
                      <PillButton
                        variant="outline"
                        size="sm"
                        disabled={exportingId === `${report.id}-regulatory-index`}
                        onClick={() => downloadSummary(report.id, 'regulatory-index')}
                      >
                        <Scale className="h-3.5 w-3.5" />
                        {exportingId === `${report.id}-regulatory-index` ? 'Exporting...' : 'Regulatory index'}
                      </PillButton>
                      {shareTokens[report.id] ? (
                        <>
                          <PillButton
                            variant="outline"
                            size="sm"
                            onClick={() => copyShareUrl(shareTokens[report.id])}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Copy link
                          </PillButton>
                          <PillButton
                            variant="ghost"
                            size="sm"
                            disabled={shareBusyId === report.id}
                            onClick={() => handleRevokeShare(report.id)}
                          >
                            {shareBusyId === report.id ? 'Revoking...' : 'Revoke link'}
                          </PillButton>
                        </>
                      ) : (
                        <PillButton
                          variant="outline"
                          size="sm"
                          disabled={shareBusyId === report.id}
                          onClick={() => handleShare(report.id)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {shareBusyId === report.id ? 'Creating...' : 'Share link'}
                        </PillButton>
                      )}
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          ) : (
            <div className="border-t border-studio-hairline py-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                No reports yet. Create your first in about a minute, we pull your emissions, products and facility data automatically.
              </p>
              <PillButton variant="room" href="/reports/builder">
                Create a report
              </PillButton>
            </div>
          )}

          {/* Failed reports — one quiet stale line + a quiet retry */}
          {failedReports.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowFailedReports(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <StateChip tone="stale">{failedReports.length} failed attempt{failedReports.length !== 1 ? 's' : ''}</StateChip>
                <span className="underline underline-offset-2">{showFailedReports ? 'Hide' : 'Show'}</span>
              </button>
              {showFailedReports && (
                <div className="mt-3 divide-y divide-border">
                  {failedReports.map(report => (
                    <div key={report.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-display font-semibold text-foreground truncate">{report.report_name}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </span>
                        <p className="text-xs text-studio-stale mt-0.5 truncate">
                          {isStaleGenerating(report) ? 'Generation timed out' : report.error_message}
                        </p>
                      </div>
                      <PillButton
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        href="/reports/builder"
                      >
                        Retry
                      </PillButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Materiality tab ──────────────────────────────────────────────── */}
        <TabsContent value="materiality" className="mt-6">
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Materiality assessment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Identify and prioritise the sustainability topics that matter most to your business and stakeholders.
                Your materiality assessment shapes the structure and narrative of every report you generate.
              </p>
            </div>

            {/* Status banner */}
            {matComplete ? (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-sm font-semibold text-foreground">{currentYear} assessment complete</p>
                    <StateChip tone="good">Done</StateChip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {matTopics.length} material topics identified, {priorityCount} set as priorities.
                    Your reports will be structured around these topics.
                  </p>
                </div>
                <PillButton variant="outline" size="sm" href={`/reports/materiality/setup?year=${currentYear}`}>Edit</PillButton>
              </Panel>
            ) : matAssessment ? (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-sm font-semibold text-foreground">Assessment in progress</p>
                    <StateChip tone="attention">Going</StateChip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {matTopics.length} topics marked as material so far. Complete the three-step setup to finalise.
                  </p>
                </div>
                <PillButton variant="room" size="sm" href={`/reports/materiality/setup?year=${currentYear}`}>Continue</PillButton>
              </Panel>
            ) : (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-display text-sm font-semibold text-foreground">No assessment for {currentYear}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your double-materiality assessment to unlock structured, framework-compliant reports.
                    Takes around 20 minutes.
                  </p>
                </div>
                <PillButton size="sm" href={`/reports/materiality/setup?year=${currentYear}`}>Start assessment</PillButton>
              </Panel>
            )}

            {/* ESG category counts */}
            {matTopics.length > 0 && (
              <Panel className="grid grid-cols-3 gap-4">
                <BigNumber value={envCount} label="Environmental" />
                <BigNumber value={socialCount} label="Social" />
                <BigNumber value={govCount} label="Governance" />
              </Panel>
            )}

            {/* Priority topics list */}
            {matComplete && priorityCount > 0 && (
              <div>
                <Eyebrow tone="dim">PRIORITY TOPICS</Eyebrow>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  These topics appear first in your reports and drive the narrative structure.
                </p>
                <div className="divide-y divide-border">
                  {matAssessment!.priority_topics.map((topicId, index) => {
                    const topic = matAssessment!.topics.find(t => t.id === topicId)
                    if (!topic) return null
                    return (
                      <div key={topicId} className="flex items-center gap-3 py-2.5">
                        <span className="w-5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>
                        <StateChip>{CATEGORY_TAG[topic.category] ?? topic.category}</StateChip>
                        <span className="flex-1 text-sm text-foreground">{topic.name}</span>
                        {topic.impactScore && topic.financialScore && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            {topic.impactScore}×{topic.financialScore} = {topic.impactScore * topic.financialScore}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Why materiality matters */}
            <Panel>
              <Eyebrow tone="dim">WHY MATERIALITY MATTERS</Eyebrow>
              <div className="mt-3 space-y-3">
                {[
                  { title: 'Report structure', desc: 'Material topics appear first in your reports. Non-material topics move to the appendix.' },
                  { title: 'Narrative quality', desc: 'Section narratives are written with materiality context, specific to what matters for your business.' },
                  { title: 'CSRD compliance', desc: 'A completed double-materiality assessment is required to use the CSRD standard on your reports.' },
                ].map(({ title, desc }) => (
                  <div key={title}>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ── Transition Plan tab ──────────────────────────────────────────── */}
        <TabsContent value="transition-plan" className="mt-6">
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Transition plan</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Define your decarbonisation pathway with reduction targets, milestones and a climate risk assessment.
                Your transition plan feeds directly into generated sustainability reports.
              </p>
            </div>

            {/* Status banner */}
            {tpComplete ? (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-sm font-semibold text-foreground">{currentYear} transition plan complete</p>
                    <StateChip tone="good">Done</StateChip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transitionPlan!.targets.length} target{transitionPlan!.targets.length !== 1 ? 's' : ''},{' '}
                    {transitionPlan!.milestones.length} milestone{transitionPlan!.milestones.length !== 1 ? 's' : ''},{' '}
                    {transitionPlan!.risks_and_opportunities!.length} risks and opportunities.
                    {transitionPlan!.sbti_aligned && ' SBTi aligned.'}
                  </p>
                </div>
                <PillButton variant="outline" size="sm" href={`/reports/transition-plan/setup?year=${currentYear}`}>Edit</PillButton>
              </Panel>
            ) : tpInProgress ? (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-sm font-semibold text-foreground">Plan in progress</p>
                    <StateChip tone="attention">Going</StateChip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {!tpHasTargets && 'Add reduction targets. '}
                    {!tpHasMilestones && 'Add milestones. '}
                    {!tpHasRisks && 'Generate risks and opportunities to complete.'}
                  </p>
                </div>
                <PillButton variant="room" size="sm" href={`/reports/transition-plan/setup?year=${currentYear}`}>Continue</PillButton>
              </Panel>
            ) : (
              <Panel className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-display text-sm font-semibold text-foreground">No transition plan for {currentYear}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Demonstrate to investors and regulators that your sustainability commitments are backed by a credible pathway.
                    Takes around 15 minutes.
                  </p>
                </div>
                <PillButton size="sm" href={`/reports/transition-plan/setup?year=${currentYear}`}>Create plan</PillButton>
              </Panel>
            )}

            {/* Summary counts */}
            {(tpHasTargets || tpHasMilestones) && transitionPlan && (
              <Panel className="grid grid-cols-3 gap-4">
                <BigNumber value={transitionPlan.targets.length} label="Reduction targets" />
                <BigNumber
                  value={transitionPlan.milestones.length}
                  label={`Milestones · ${transitionPlan.milestones.filter(m => m.status === 'complete').length} complete`}
                />
                <div>
                  <BigNumber value={transitionPlan.risks_and_opportunities?.length ?? 0} label="Risks & opps identified" />
                  {transitionPlan.sbti_aligned && <StateChip tone="good" className="mt-1.5 inline-block">SBTi</StateChip>}
                </div>
              </Panel>
            )}

            {/* Reduction targets list */}
            {tpHasTargets && transitionPlan && (
              <div>
                <Eyebrow tone="dim">REDUCTION TARGETS</Eyebrow>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Emission reduction commitments vs the {transitionPlan.baseline_year} baseline.
                </p>
                <div className="divide-y divide-border">
                  {transitionPlan.targets.map(target => (
                    <div key={target.id} className="flex items-center gap-4 py-2.5">
                      <div className="flex-1 text-sm text-foreground">{SCOPE_LABELS[target.scope]}</div>
                      <div className="font-display text-sm font-semibold text-room-accent">
                        -{target.reductionPct}% by {target.targetYear}
                      </div>
                      {target.reductionPct >= 50 && (
                        <StateChip tone="good">SBTi</StateChip>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Why transition planning matters */}
            <Panel>
              <Eyebrow tone="dim">WHY TRANSITION PLANNING MATTERS</Eyebrow>
              <div className="mt-3 space-y-3">
                {[
                  { title: 'Investor confidence', desc: 'Investors increasingly require a credible decarbonisation pathway, not just a net zero pledge. A transition plan demonstrates that targets are backed by specific actions.' },
                  { title: 'CSRD requirement', desc: 'The Corporate Sustainability Reporting Directive requires a transition plan for climate disclosures. Without one, CSRD reports are incomplete.' },
                  { title: 'Report integration', desc: 'When a plan exists, every generated report includes a transition roadmap section and a risks and opportunities analysis.' },
                  { title: 'Risk management', desc: 'Identify physical and transition climate risks before they materialise and demonstrate governance accountability.' },
                ].map(({ title, desc }) => (
                  <div key={title}>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ── Brand kit tab ────────────────────────────────────────────────── */}
        <TabsContent value="brand-kit" className="mt-6">
          <BrandKitEditor />
        </TabsContent>
      </Tabs>

      <ProvenanceGateDialog
        open={gateBlockers !== null}
        onClose={() => setGateBlockers(null)}
        subject="This report"
        blockers={gateBlockers ?? []}
      />
    </div>
  )
}

// ─── Page export (wraps in Suspense for useSearchParams) ─────────────────────

export default function SustainabilityReportsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading reports..." />}>
      <SustainabilityReportsHub />
    </Suspense>
  )
}
