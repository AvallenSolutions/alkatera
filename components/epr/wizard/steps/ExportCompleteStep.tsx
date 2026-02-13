'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Download,
  Loader2,
  ExternalLink,
  FileText,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  ClipboardList,
  History,
  PartyPopper,
  Dog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/lib/organizationContext'
import { toast } from 'sonner'

interface ExportCompleteStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface ExportResult {
  download_url: string | null
  checksum: string
  filename: string
  line_count: number
}

const NEXT_STEPS = [
  {
    href: '/epr/submissions',
    icon: ClipboardList,
    title: 'View Submissions',
    description: 'Review all your RPD submissions and their statuses.',
  },
  {
    href: '/epr/costs',
    icon: BarChart3,
    title: 'Cost Estimator',
    description: 'Explore fee projections and material cost breakdowns.',
  },
  {
    href: '/epr/audit',
    icon: History,
    title: 'Audit Trail',
    description: 'Full history of every change for compliance records.',
  },
] as const

export function ExportCompleteStep({ onComplete, onBack }: ExportCompleteStepProps) {
  const { currentOrganization } = useOrganization()

  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exported = !!exportResult

  const handleExport = async () => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected.')
      return
    }

    setExporting(true)
    setError(null)

    try {
      // Retrieve the submissionId stored by the Generate step
      let submissionId = sessionStorage.getItem('epr_draft_submission_id')

      // If not in session storage, fetch the latest draft submission
      if (!submissionId) {
        const latestRes = await fetch(
          `/api/epr/generate-submission?organizationId=${currentOrganization.id}&latest=true`
        )
        if (latestRes.ok) {
          const latestData = await latestRes.json()
          submissionId = latestData.submission?.id ?? null
        }
      }

      if (!submissionId) {
        throw new Error(
          'No draft submission found. Please go back and generate a submission first.'
        )
      }

      const res = await fetch('/api/epr/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          submissionId,
        }),
      })

      // Handle direct CSV response (fallback when storage fails)
      if (
        res.ok &&
        res.headers.get('Content-Type')?.includes('text/csv')
      ) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const filename =
          res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
          'rpd_export.csv'
        const checksum = res.headers.get('X-CSV-Checksum') || 'N/A'

        setExportResult({
          download_url: url,
          checksum,
          filename,
          line_count: 0,
        })
        toast.success('CSV exported successfully!')
        return
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to export CSV')
      }

      setExportResult({
        download_url: data.download_url,
        checksum: data.checksum,
        filename: data.filename,
        line_count: data.line_count,
      })

      toast.success('CSV exported successfully!')
    } catch (err: any) {
      const message = err.message || 'An unexpected error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Celebration Header */}
      <div className="text-center space-y-4">
        {exported ? (
          <>
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              {/* Confetti-style dots */}
              <div className="absolute -top-2 -left-3 w-2 h-2 rounded-full bg-[#ccff00] animate-bounce" />
              <div className="absolute -top-1 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce delay-100" />
              <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-200" />
              <div className="absolute top-0 -right-3 w-2 h-2 rounded-full bg-purple-400 animate-bounce delay-150" />
              <div className="absolute -bottom-2 right-1 w-1 h-1 rounded-full bg-amber-400 animate-bounce delay-300" />
              <div className="absolute top-4 -left-5 w-1 h-1 rounded-full bg-pink-400 animate-bounce delay-75" />
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Your RPD CSV is Ready!
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Download the file below and upload it to the Defra RPD portal.
              Everything has been recorded in your audit trail.
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
              <Download className="w-10 h-10 text-[#ccff00]" />
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Export &amp; Finish
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Generate the official RPD-format CSV file ready for upload to the
              Defra portal.
            </p>
          </>
        )}
      </div>

      {/* Export Button (pre-export) */}
      {!exported && !error && (
        <div className="flex justify-center">
          <Button
            onClick={handleExport}
            disabled={exporting}
            size="lg"
            className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl px-8"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <PartyPopper className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Export failed</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-2 px-0"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Export Result */}
      {exported && exportResult && (
        <>
          {/* Download Card */}
          <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-white truncate">
                      {exportResult.filename}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/20 text-emerald-400"
                      >
                        Ready
                      </Badge>
                      {exportResult.line_count > 0 && (
                        <span className="text-xs text-white/40">
                          {exportResult.line_count} lines
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Checksum */}
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/30 uppercase tracking-wide">
                        SHA-256 Checksum
                      </p>
                      <p className="text-xs text-white/50 font-mono truncate">
                        {exportResult.checksum}
                      </p>
                    </div>
                  </div>

                  {/* Download Link */}
                  {exportResult.download_url && (
                    <a
                      href={exportResult.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#ccff00] hover:text-[#b8e600] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rosa Celebration */}
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center flex-shrink-0 border border-emerald-400/30">
              <Dog className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-400">Rosa</p>
              <p className="text-sm text-white/70 mt-1 leading-relaxed">
                Brilliant! Your RPD CSV is ready to download. You can upload
                this directly to the Defra portal. I&apos;ve also recorded
                everything in your audit trail for your compliance records.
              </p>
            </div>
          </div>

          {/* What's Next? */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide text-center">
              What&apos;s Next?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {NEXT_STEPS.map((step) => {
                const Icon = step.icon
                return (
                  <a
                    key={step.href}
                    href={step.href}
                    className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:bg-white/8 hover:border-white/15 transition-all"
                  >
                    <Icon className="w-5 h-5 text-[#ccff00] mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-medium text-white">
                      {step.title}
                    </p>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-[#ccff00]/60 group-hover:text-[#ccff00] transition-colors">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Finish Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={onComplete}
              size="lg"
              className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl px-10"
            >
              <PartyPopper className="w-5 h-5 mr-2" />
              Finish
            </Button>
          </div>
        </>
      )}

      {/* Back button (only shown pre-export) */}
      {!exported && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            Back
          </Button>
          <div />
        </div>
      )}
    </div>
  )
}
