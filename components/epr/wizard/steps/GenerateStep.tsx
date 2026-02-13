'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Weight,
  PoundSterling,
  Rows3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganization } from '@/lib/organizationContext'
import { toast } from 'sonner'
import { RPD_MATERIAL_NAMES } from '@/lib/epr/constants'
import type { EPRSubmission, RPDMaterialCode } from '@/lib/epr/types'

interface GenerateStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

const SUBMISSION_PERIODS = [
  { value: '2025-H1', label: '2025 H1 (Jan-Jun)' },
  { value: '2025-H2', label: '2025 H2 (Jul-Dec)' },
] as const

const FEE_YEARS = [
  { value: '2025-26', label: '2025/26' },
  { value: '2026-27', label: '2026/27' },
] as const

const formatGBP = (amount: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

export function GenerateStep({ onComplete, onBack }: GenerateStepProps) {
  const { currentOrganization } = useOrganization()

  const [submissionPeriod, setSubmissionPeriod] = useState<string>('')
  const [feeYear, setFeeYear] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Result state
  const [submission, setSubmission] = useState<EPRSubmission | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const generated = !!submission

  const materialSummary: Record<string, { weight_kg: number; fee_gbp: number; count: number }> =
    (submission?.material_summary as Record<string, { weight_kg: number; fee_gbp: number; count: number }>) ?? {}

  const handleGenerate = async () => {
    if (!currentOrganization?.id || !submissionPeriod || !feeYear) {
      toast.error('Please select a submission period and fee year.')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/epr/generate-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          submission_period: submissionPeriod,
          fee_year: feeYear,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate submission')
      }

      setSubmission(data.submission)
      setWarnings(data.warnings || [])

      // Store submissionId for the Export step
      if (data.submission?.id) {
        sessionStorage.setItem('epr_draft_submission_id', data.submission.id)
      }

      toast.success('Submission generated successfully!')
    } catch (err: any) {
      const message = err.message || 'An unexpected error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }

  const totalWeightTonnes = submission
    ? (submission.total_packaging_weight_kg / 1000).toFixed(2)
    : '0'

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
          Generate Submission
        </h2>
        <p className="text-white/60 text-sm max-w-md mx-auto">
          Select your reporting period and fee year, then generate your RPD
          submission lines.
        </p>
      </div>

      {/* Period & Fee Year Selectors */}
      <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Submission Period */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                Submission Period
              </label>
              <Select
                value={submissionPeriod}
                onValueChange={setSubmissionPeriod}
                disabled={generating}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fee Year */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                Fee Year
              </label>
              <Select
                value={feeYear}
                onValueChange={setFeeYear}
                disabled={generating}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50">
                  <SelectValue placeholder="Select fee year" />
                </SelectTrigger>
                <SelectContent>
                  {FEE_YEARS.map((y) => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          {!generated && (
            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleGenerate}
                disabled={generating || !submissionPeriod || !feeYear}
                className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl px-8 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Submission
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Generation failed
            </p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Generated Summary */}
      {generated && submission && (
        <>
          {/* Summary Stats */}
          <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Submission Summary
                </h3>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/15">
                  Draft
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Weight */}
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <Weight className="w-5 h-5 text-[#ccff00] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">
                    {totalWeightTonnes}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Total Weight (tonnes)
                  </p>
                </div>

                {/* Estimated Fee */}
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <PoundSterling className="w-5 h-5 text-[#ccff00] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">
                    {formatGBP(submission.total_estimated_fee_gbp)}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Estimated Fee</p>
                </div>

                {/* Line Count */}
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <Rows3 className="w-5 h-5 text-[#ccff00] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">
                    {submission.total_line_items}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Submission Lines
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Material Breakdown */}
          {Object.keys(materialSummary).length > 0 && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
              <CardContent className="p-6">
                <h3 className="text-sm font-medium text-white/70 mb-4">
                  Material Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-xs text-white/40 font-medium pb-2 pr-4">
                          Material
                        </th>
                        <th className="text-right text-xs text-white/40 font-medium pb-2 px-4">
                          Weight (kg)
                        </th>
                        <th className="text-right text-xs text-white/40 font-medium pb-2 pl-4">
                          Est. Fee
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(materialSummary).map(
                        ([code, data]) => (
                          <tr
                            key={code}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="py-2.5 pr-4 text-white/80">
                              {RPD_MATERIAL_NAMES[
                                code as RPDMaterialCode
                              ] || code}
                            </td>
                            <td className="py-2.5 px-4 text-right text-white/60 tabular-nums">
                              {data.weight_kg.toLocaleString('en-GB')}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-white/60 tabular-nums">
                              {formatGBP(data.fee_gbp)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10">
                        <td className="pt-3 pr-4 text-white font-medium">
                          Total
                        </td>
                        <td className="pt-3 px-4 text-right text-white font-medium tabular-nums">
                          {submission.total_packaging_weight_kg.toLocaleString(
                            'en-GB'
                          )}
                        </td>
                        <td className="pt-3 pl-4 text-right text-white font-medium tabular-nums">
                          {formatGBP(submission.total_estimated_fee_gbp)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Card className="bg-amber-500/5 backdrop-blur-md border border-amber-500/15 rounded-2xl">
              <CardContent className="p-6">
                <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings ({warnings.length})
                </h3>
                <ul className="space-y-2">
                  {warnings.map((warning, i) => (
                    <li
                      key={i}
                      className="text-xs text-amber-400/70 flex items-start gap-2"
                    >
                      <span className="text-amber-400/40 mt-0.5">--</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white/40 hover:text-white hover:bg-white/10"
        >
          Back
        </Button>

        {generated && (
          <Button
            onClick={onComplete}
            className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
