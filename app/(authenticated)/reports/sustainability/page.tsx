'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Zap, FileText, Download, Loader2, CheckCircle2, AlertCircle,
  Wand2, TrendingUp, Scale, Clock, AlertTriangle, BarChart2, Layers,
  Target, TrendingDown, MapPin, ShieldAlert, Circle,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useOrganization } from '@/lib/organizationContext'
import { PageLoader } from '@/components/ui/page-loader'
import { QuickGenerateDialog } from '@/components/report-builder/QuickGenerateDialog'
import { VerificationCard } from '@/components/partners/VerificationCard'
import { GenerationProgress } from '@/components/report-builder/GenerationProgress'
import { useReportBuilder } from '@/hooks/useReportBuilder'
import { useReportProgress } from '@/hooks/useReportProgress'
import { useToast } from '@/hooks/use-toast'
import type { ReportConfig } from '@/types/report-builder'
import { AUDIENCE_LABELS } from '@/types/report-builder'
import { toast as sonnerToast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { CATEGORY_COLOURS } from '@/lib/materiality/topic-library'
import type { MaterialityTopic } from '@/lib/materiality/topic-library'
import type { TransitionPlan } from '@/lib/transition-plan/types'
import { SCOPE_LABELS, SCOPE_COLOURS } from '@/lib/transition-plan/types'

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
  const { generateReport, loadDefaults, loading: generating } = useReportBuilder()

  const currentYear = new Date().getFullYear()
  const activeTab = searchParams.get('tab') || 'reports'

  // ── Core state ───────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [quickGenerateOpen, setQuickGenerateOpen] = useState(false)
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [showFailedReports, setShowFailedReports] = useState(false)

  // ── Readiness + tab data (fetched together on mount) ─────────────────────────
  const [hasEmissions, setHasEmissions] = useState(false)
  const [matAssessment, setMatAssessment] = useState<MaterialityAssessment | null>(null)
  const [transitionPlan, setTransitionPlan] = useState<TransitionPlan | null>(null)
  const [lcaCount, setLcaCount] = useState(0)

  // ── Default config for Quick Generate ────────────────────────────────────────
  const [config, setConfig] = useState<ReportConfig>({
    reportName: `Sustainability Report ${currentYear}`,
    reportYear: currentYear,
    reportingPeriodStart: `${currentYear}-01-01`,
    reportingPeriodEnd: `${currentYear}-12-31`,
    audience: 'investors',
    outputFormat: 'pdf',
    standards: ['csrd', 'iso-14067'],
    sections: ['executive-summary'],
    branding: { logo: null, primaryColor: '#2563eb', secondaryColor: '#10b981' },
    isMultiYear: false,
    reportYears: [currentYear],
  })

  const progress = useReportProgress(generatingReportId)

  // ── Load saved branding/audience defaults ─────────────────────────────────────
  useEffect(() => {
    if (currentOrganization) {
      const saved = loadDefaults(currentOrganization)
      if (saved) setConfig(prev => ({ ...prev, ...saved }))
    }
  }, [currentOrganization])

  // ── Initial data load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrganization?.id) return
    fetchAllData()
  }, [currentOrganization?.id])

  // Refresh report list when generation finishes
  useEffect(() => {
    if (progress.status === 'completed' || progress.status === 'failed') {
      fetchReportList()
    }
  }, [progress.status])

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

      // LCA count
      supabase
        .from('product_carbon_footprints')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'completed')
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

  // ── Report generation ─────────────────────────────────────────────────────────
  const handleGenerate = async (reportConfig?: ReportConfig) => {
    const cfg = reportConfig || config
    if (cfg.sections.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one section', variant: 'destructive' })
      return
    }
    const result = await generateReport(cfg)
    if (result.success && result.report_id) {
      setGeneratingReportId(result.report_id)
      setQuickGenerateOpen(false)
      handleTabChange('reports')
      toast({ title: 'Report generation started', description: 'This usually takes 30 to 60 seconds.' })
    } else {
      toast({ title: 'Generation failed', description: result.error || 'An error occurred', variant: 'destructive' })
    }
  }

  const handleDownload = (url: string) => window.open(url, '_blank')

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
      if (!response.ok) throw new Error('Export failed')
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
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>
      case 'failed':
        return <Badge variant="destructive" className="shrink-0"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="secondary" className="shrink-0"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>
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

  // Treat any "generating" report older than 2 hours as stale (generation process died)
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  const isStaleGenerating = (r: GeneratedReport) =>
    r.status === 'generating' && Date.now() - new Date(r.created_at).getTime() > TWO_HOURS_MS
  const activeReports = reports.filter(r => r.status !== 'failed' && !isStaleGenerating(r))
  const failedReports = reports.filter(r => r.status === 'failed' || isStaleGenerating(r))

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Sustainability Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate, manage, and track your annual sustainability reports
        </p>
      </div>

      {/* ── Report Readiness Panel ───────────────────────────────────────────── */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="mb-4">
            <h2 className="font-semibold text-base">Report Readiness</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your data status for {currentYear} — click a tile to view details</p>
          </div>

          {/* 4 status tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Emissions */}
            <Link href="/data/scope-1-2" className="group">
              <div className={`p-3 rounded-lg border h-full transition-colors cursor-pointer ${hasEmissions
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/20'} hover:border-slate-400 dark:hover:border-slate-500`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {hasEmissions
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-slate-400 shrink-0" />}
                  <span className="text-xs font-medium">Emissions Data</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasEmissions ? `${currentYear} footprint calculated` : 'Not calculated yet'}
                </p>
              </div>
            </Link>

            {/* Materiality */}
            <button onClick={() => handleTabChange('materiality')} className="text-left group">
              <div className={`p-3 rounded-lg border h-full transition-colors cursor-pointer ${matComplete
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                : matInProgress
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/20'} hover:border-slate-400 dark:hover:border-slate-500`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {matComplete
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    : matInProgress
                    ? <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-slate-400 shrink-0" />}
                  <span className="text-xs font-medium">Materiality</span>
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
              <div className={`p-3 rounded-lg border h-full transition-colors cursor-pointer ${tpComplete
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                : tpInProgress
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/20'} hover:border-slate-400 dark:hover:border-slate-500`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {tpComplete
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    : tpInProgress
                    ? <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-slate-400 shrink-0" />}
                  <span className="text-xs font-medium">Transition Plan</span>
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
              <div className={`p-3 rounded-lg border h-full transition-colors cursor-pointer ${lcaCount > 0
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/20'} hover:border-slate-400 dark:hover:border-slate-500`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {lcaCount > 0
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-slate-400 shrink-0" />}
                  <span className="text-xs font-medium">Product LCAs</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lcaCount > 0 ? `${lcaCount} completed` : 'None completed'}
                </p>
              </div>
            </Link>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Button
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-sm"
                size="lg"
                onClick={() => setQuickGenerateOpen(true)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Generate
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-1.5">
                Auto-selects sections from your data. Ready in ~60 seconds.
              </p>
            </div>
            <div className="flex-1">
              <Link href="/reports/builder" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Custom Builder
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center mt-1.5">
                Choose your audience, sections, branding and more.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Impact Focus report creation ─────────────────────────────────── */}
      <VerificationCard variant="report-creation" />

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Reports
            {activeReports.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 text-xs px-1.5 py-0 h-4">{activeReports.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="materiality" className="gap-1.5">
            <Layers className="h-4 w-4" />
            Materiality
          </TabsTrigger>
          <TabsTrigger value="transition-plan" className="gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Transition Plan
          </TabsTrigger>
        </TabsList>

        {/* ── Reports tab ─────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="mt-6 space-y-4">

          {/* Active generation progress */}
          {generatingReportId && progress.status !== 'completed' && progress.status !== 'failed' && (
            <GenerationProgress
              status={progress.status}
              documentUrl={progress.documentUrl}
              error={progress.error}
              reportName={config.reportName}
              onDownload={() => progress.documentUrl && handleDownload(progress.documentUrl)}
              onReset={() => setGeneratingReportId(null)}
            />
          )}

          {/* Completed generation banner */}
          {generatingReportId && progress.status === 'completed' && progress.documentUrl && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-medium">Report ready</p>
                      <p className="text-sm text-muted-foreground">{config.reportName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button onClick={() => handleDownload(progress.documentUrl!)} size="sm">
                      <Download className="h-4 w-4 mr-1.5" />Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setGeneratingReportId(null)}>Dismiss</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports card grid — completed/generating only */}
          {activeReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeReports.map(report => (
                <Card key={report.id} className="flex flex-col">
                  <CardContent className="pt-5 flex flex-col flex-1">
                    {/* Header row */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight truncate">{report.report_name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge variant="secondary" className="text-xs">{report.report_year}</Badge>
                          <Badge variant="outline" className="text-xs">{getFormatLabel(report.output_format)}</Badge>
                          <Badge variant="outline" className="text-xs">{AUDIENCE_LABELS?.[report.audience as keyof typeof AUDIENCE_LABELS] || report.audience}</Badge>
                        </div>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>

                    <p className="text-xs text-muted-foreground mb-auto">
                      Generated {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    </p>

                    {/* Actions — only for completed reports */}
                    {report.status === 'completed' && (
                      <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border">
                        {report.document_url && (
                          <Button size="sm" onClick={() => handleDownload(report.document_url!)}>
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Download
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exportingId === `${report.id}-investor-summary`}
                          onClick={() => downloadSummary(report.id, 'investor-summary')}
                        >
                          {exportingId === `${report.id}-investor-summary`
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <TrendingUp className="h-3.5 w-3.5 mr-1.5" />}
                          Investor Summary
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exportingId === `${report.id}-regulatory-index`}
                          onClick={() => downloadSummary(report.id, 'regulatory-index')}
                        >
                          {exportingId === `${report.id}-regulatory-index`
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <Scale className="h-3.5 w-3.5 mr-1.5" />}
                          Regulatory Index
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            !generatingReportId && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No reports yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    Generate your first sustainability report in seconds. We will pull your emissions,
                    products, and facility data automatically.
                  </p>
                  <Button
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                    onClick={() => setQuickGenerateOpen(true)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Your First Report
                  </Button>
                </CardContent>
              </Card>
            )
          )}

          {/* Failed reports — collapsible section */}
          {failedReports.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowFailedReports(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                {failedReports.length} failed attempt{failedReports.length !== 1 ? 's' : ''}
                <span className="underline underline-offset-2">{showFailedReports ? 'Hide' : 'Show'}</span>
              </button>
              {showFailedReports && (
                <div className="mt-3 space-y-2">
                  {failedReports.map(report => (
                    <div key={report.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium truncate">{report.report_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </span>
                        <p className="text-xs text-destructive mt-0.5 truncate">
                          {isStaleGenerating(report) ? 'Generation timed out' : report.error_message}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs h-7"
                        onClick={() => setQuickGenerateOpen(true)}
                      >
                        Retry
                      </Button>
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
              <h2 className="text-xl font-semibold">Materiality Assessment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Identify and prioritise the sustainability topics that matter most to your business and stakeholders.
                Your materiality assessment shapes the structure and narrative of every report you generate.
              </p>
            </div>

            {/* Status banner */}
            {matComplete ? (
              <div className="rounded-xl border border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-lime-600 dark:text-lime-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-lime-800 dark:text-lime-300">{currentYear} assessment complete</p>
                  <p className="text-xs text-lime-700 dark:text-lime-400 mt-0.5">
                    {matTopics.length} material topics identified, {priorityCount} set as priorities.
                    Your reports will be structured around these topics.
                  </p>
                </div>
                <Link href={`/reports/materiality/setup?year=${currentYear}`}>
                  <Button variant="outline" size="sm">Edit</Button>
                </Link>
              </div>
            ) : matAssessment ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Assessment in progress</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {matTopics.length} topics marked as material so far. Complete the three-step setup to finalise.
                  </p>
                </div>
                <Link href={`/reports/materiality/setup?year=${currentYear}`}>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">Continue</Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/20 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">No assessment for {currentYear}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your double-materiality assessment to unlock structured, framework-compliant reports.
                    Takes around 20 minutes.
                  </p>
                </div>
                <Link href={`/reports/materiality/setup?year=${currentYear}`}>
                  <Button size="sm">Start Assessment</Button>
                </Link>
              </div>
            )}

            {/* ESG category counts */}
            {matTopics.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Environmental', count: envCount, color: CATEGORY_COLOURS.environmental },
                  { label: 'Social', count: socialCount, color: CATEGORY_COLOURS.social },
                  { label: 'Governance', count: govCount, color: CATEGORY_COLOURS.governance },
                ].map(({ label, count, color }) => (
                  <Card key={label}>
                    <CardContent className="pt-5">
                      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                      <div className="text-3xl font-bold" style={{ color }}>{count}</div>
                      <div className="text-xs text-muted-foreground mt-1">material topics</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Priority topics list */}
            {matComplete && priorityCount > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Priority Topics</CardTitle>
                  <CardDescription>
                    These topics appear first in your reports and drive the narrative structure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {matAssessment!.priority_topics.map((topicId, index) => {
                      const topic = matAssessment!.topics.find(t => t.id === topicId)
                      if (!topic) return null
                      return (
                        <div key={topicId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                          <span className="text-sm font-mono text-muted-foreground w-5 text-right">{index + 1}</span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLOURS[topic.category] }} />
                          <span className="text-sm flex-1">{topic.name}</span>
                          {topic.impactScore && topic.financialScore && (
                            <span className="text-xs text-muted-foreground">
                              {topic.impactScore}×{topic.financialScore} = {topic.impactScore * topic.financialScore}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Why materiality matters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Why materiality matters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Layers, title: 'Report structure', desc: 'Material topics appear first in your reports. Non-material topics move to the appendix.' },
                  { icon: BarChart2, title: 'Narrative quality', desc: 'AI section narratives are written with materiality context — specific to what matters for your business.' },
                  { icon: CheckCircle2, title: 'CSRD compliance', desc: 'A completed double-materiality assessment is required to use the CSRD standard on your reports.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Transition Plan tab ──────────────────────────────────────────── */}
        <TabsContent value="transition-plan" className="mt-6">
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-semibold">Transition Plan</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Define your decarbonisation pathway with reduction targets, milestones, and a climate risk assessment.
                Your transition plan feeds directly into generated sustainability reports.
              </p>
            </div>

            {/* Status banner */}
            {tpComplete ? (
              <div className="rounded-xl border border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-lime-600 dark:text-lime-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-lime-800 dark:text-lime-300">{currentYear} transition plan complete</p>
                  <p className="text-xs text-lime-700 dark:text-lime-400 mt-0.5">
                    {transitionPlan!.targets.length} target{transitionPlan!.targets.length !== 1 ? 's' : ''},{' '}
                    {transitionPlan!.milestones.length} milestone{transitionPlan!.milestones.length !== 1 ? 's' : ''},{' '}
                    {transitionPlan!.risks_and_opportunities!.length} risks and opportunities.
                    {transitionPlan!.sbti_aligned && ' SBTi aligned.'}
                  </p>
                </div>
                <Link href={`/reports/transition-plan/setup?year=${currentYear}`}>
                  <Button variant="outline" size="sm">Edit</Button>
                </Link>
              </div>
            ) : tpInProgress ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Plan in progress</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {!tpHasTargets && 'Add reduction targets. '}
                    {!tpHasMilestones && 'Add milestones. '}
                    {!tpHasRisks && 'Generate risks and opportunities to complete.'}
                  </p>
                </div>
                <Link href={`/reports/transition-plan/setup?year=${currentYear}`}>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">Continue</Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/20 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">No transition plan for {currentYear}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Demonstrate to investors and regulators that your sustainability commitments are backed by a credible pathway.
                    Takes around 15 minutes.
                  </p>
                </div>
                <Link href={`/reports/transition-plan/setup?year=${currentYear}`}>
                  <Button size="sm">Create Plan</Button>
                </Link>
              </div>
            )}

            {/* Summary counts */}
            {(tpHasTargets || tpHasMilestones) && transitionPlan && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-5">
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Targets</div>
                    <div className="text-3xl font-bold">{transitionPlan.targets.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">reduction targets</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Milestones</div>
                    <div className="text-3xl font-bold">{transitionPlan.milestones.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {transitionPlan.milestones.filter(m => m.status === 'complete').length} complete
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                      <div className="flex items-center gap-1.5">
                        Risks &amp; Opps
                        {transitionPlan.sbti_aligned && (
                          <Badge className="text-[10px] py-0 px-1.5 bg-[#ccff00] text-stone-800 border-0">SBTi</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-3xl font-bold">{transitionPlan.risks_and_opportunities?.length ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">identified</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Reduction targets list */}
            {tpHasTargets && transitionPlan && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Reduction Targets</CardTitle>
                  <CardDescription>Emission reduction commitments vs. {transitionPlan.baseline_year} baseline</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transitionPlan.targets.map(target => (
                      <div key={target.id} className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SCOPE_COLOURS[target.scope] }} />
                        <div className="flex-1 text-sm">{SCOPE_LABELS[target.scope]}</div>
                        <div className="text-sm font-semibold" style={{ color: SCOPE_COLOURS[target.scope] }}>
                          -{target.reductionPct}% by {target.targetYear}
                        </div>
                        {target.reductionPct >= 50 && (
                          <Badge variant="outline" className="text-xs border-[#ccff00] text-stone-600 bg-[#ccff00]/10">SBTi</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Why transition planning matters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Why transition planning matters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Target, title: 'Investor confidence', desc: 'Investors increasingly require a credible decarbonisation pathway, not just a net zero pledge. A transition plan demonstrates that targets are backed by specific actions.' },
                  { icon: TrendingDown, title: 'CSRD requirement', desc: 'The Corporate Sustainability Reporting Directive requires a transition plan for climate disclosures. Without one, CSRD reports are incomplete.' },
                  { icon: MapPin, title: 'Report integration', desc: 'When a plan exists, every generated report includes a Transition Roadmap section and a Risks and Opportunities analysis.' },
                  { icon: ShieldAlert, title: 'Risk management', desc: 'Identify physical and transition climate risks before they materialise and demonstrate governance accountability.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Generate Dialog */}
      <QuickGenerateDialog
        open={quickGenerateOpen}
        onOpenChange={setQuickGenerateOpen}
        config={config}
        onGenerate={handleGenerate}
        generating={generating}
        organizationId={currentOrganization?.id || null}
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
