'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { PageLoader } from '@/components/ui/page-loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Info,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useSupplierEsgAssessment } from '@/hooks/data/useSupplierEsgAssessment'
import { useSupplierEsgEvidence } from '@/hooks/data/useSupplierEsgEvidence'
import {
  ESG_SECTIONS,
  ESG_QUESTIONS,
  getQuestionsBySection,
  type EsgResponse,
  type EsgSection,
} from '@/lib/supplier-esg/questions'
import { isReadyToSubmit, getRatingLabel } from '@/lib/supplier-esg/scoring'
import { EsgQuestionEvidenceUpload } from '@/components/suppliers/EsgQuestionEvidenceUpload'
import type { SupplierEsgEvidence } from '@/lib/types/supplier-esg'

const DEFORESTATION_QUESTION_IDS = ['env_09', 'env_10']

const DEFORESTATION_STANDARD_OPTIONS = [
  { value: 'ndpe', label: 'NDPE (No Deforestation, No Peat, No Exploitation)' },
  { value: 'fsc', label: 'FSC (Forest Stewardship Council)' },
  { value: 'pefc', label: 'PEFC (Programme for the Endorsement of Forest Certification)' },
  { value: 'eu_deforestation_regulation', label: 'EU Deforestation Regulation' },
  { value: 'soy_moratorium', label: 'Soy Moratorium' },
  { value: 'rtrs', label: 'RTRS (Round Table on Responsible Soy)' },
  { value: 'other', label: 'Other' },
]

export default function SupplierEsgAssessmentPage() {
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const [loadingSupplier, setLoadingSupplier] = useState(true)
  const [hasCommodityProducts, setHasCommodityProducts] = useState(false)

  const {
    assessment,
    loading,
    saving,
    ensureAssessment,
    saveAnswers,
    submitAssessment,
  } = useSupplierEsgAssessment(supplierId)

  const {
    evidenceByQuestion,
    uploadEvidence,
    deleteEvidence,
    loading: evidenceLoading,
  } = useSupplierEsgEvidence(assessment?.id)

  // Load supplier id
  useEffect(() => {
    async function loadSupplier() {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (data) {
        setSupplierId(data.id)

        // Check if this supplier has any products with deforestation-linked commodities
        const { data: commodityProducts } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', data.id)
          .neq('commodity_type', 'none')
          .limit(1)
        setHasCommodityProducts(!!(commodityProducts && commodityProducts.length > 0))
      }
      setLoadingSupplier(false)
    }
    loadSupplier()
  }, [])

  const answers: Record<string, EsgResponse> = (assessment?.answers as Record<string, EsgResponse>) || {}
  const isSubmitted = assessment?.submitted === true
  const isVerified = assessment?.is_verified === true

  const handleAnswer = async (questionId: string, value: EsgResponse) => {
    if (isSubmitted) return

    // Ensure assessment record exists on first interaction
    if (!assessment) {
      await ensureAssessment()
    }

    const updated = { ...answers, [questionId]: value }
    saveAnswers(updated)
  }

  const handleSubmit = async () => {
    if (!isReadyToSubmit(answers)) return
    await submitAssessment()
  }

  // Count completed sections
  const completedSections = ESG_SECTIONS.filter((s) => {
    const qs = getQuestionsBySection(s.key)
    return qs.every((q) => answers[q.id] != null)
  }).length

  const totalQuestions = ESG_QUESTIONS.length
  const answeredQuestions = ESG_QUESTIONS.filter((q) => answers[q.id] != null).length
  const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
  const totalEvidenceFiles = Object.values(evidenceByQuestion).reduce((sum, items) => sum + items.length, 0)

  if (loadingSupplier || loading) {
    return <PageLoader message="Loading ESG assessment..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-emerald-500" />
          ESG Self-Assessment
        </h1>
        <p className="text-muted-foreground mt-2">
          Complete this voluntary questionnaire to demonstrate your ESG credentials to buying organisations.
        </p>
      </div>

      {/* Status Banners */}
      {isVerified && (
        <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-100">
            <strong>ESG Verified</strong> — Your assessment was verified on{' '}
            {new Date(assessment!.verified_at!).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            . Your score: <strong>{assessment!.score_total ?? 'N/A'}</strong> ({getRatingLabel((assessment!.score_rating || 'not_assessed') as any)})
          </AlertDescription>
        </Alert>
      )}

      {isSubmitted && !isVerified && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-100">
            <strong>Pending verification</strong> — Your assessment has been submitted and is awaiting review by the alka<strong>tera</strong> team.
          </AlertDescription>
        </Alert>
      )}

      {/* Revision notes from admin */}
      {!isSubmitted && assessment?.verification_notes && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-100">
            <strong>Revision requested</strong> — {assessment.verification_notes}
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Sections Completed</p>
              <p className="text-2xl font-bold">{completedSections} / {ESG_SECTIONS.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Completion</p>
              <div className="flex items-center gap-3">
                <Progress value={completionPercent} className="flex-1" />
                <span className="text-sm font-medium">{completionPercent}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Evidence Files</p>
              <p className="text-2xl font-bold">{totalEvidenceFiles}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Score</p>
              {assessment?.score_total != null ? (
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{assessment.score_total}</p>
                  <RatingBadge rating={assessment.score_rating} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Complete all sections to see your score</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Accordions */}
      <Accordion type="multiple" defaultValue={[ESG_SECTIONS[0].key]}>
        {ESG_SECTIONS.map((section) => {
          // Filter out deforestation questions if supplier has no commodity products
          const allQuestions = getQuestionsBySection(section.key)
          const questions = hasCommodityProducts
            ? allQuestions
            : allQuestions.filter((q) => !DEFORESTATION_QUESTION_IDS.includes(q.id))
          const sectionAnswered = questions.filter((q) => answers[q.id] != null).length
          const sectionComplete = sectionAnswered === questions.length

          return (
            <AccordionItem key={section.key} value={section.key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  {sectionComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{section.label}</span>
                  <Badge variant="secondary" className="ml-auto mr-4 text-xs">
                    {sectionAnswered} / {questions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-2">
                  {questions.map((question, idx) => {
                    // env_10: show as standard select when env_09 is yes/partial
                    if (question.id === 'env_10') {
                      const env09Answer = answers['env_09']
                      if (env09Answer !== 'yes' && env09Answer !== 'partial') return null
                      return (
                        <div key={question.id} className="border rounded-lg p-4">
                          <div className="flex gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6 flex-shrink-0">
                              {idx + 1}.
                            </span>
                            <div className="flex-1 space-y-3">
                              <p className="text-sm font-medium leading-relaxed">{question.text}</p>
                              {question.guidanceNote && (
                                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{question.guidanceNote}</span>
                                </div>
                              )}
                              <Select
                                value={answers['env_10'] || ''}
                                onValueChange={(val) => handleAnswer('env_10', val as EsgResponse)}
                                disabled={isSubmitted}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select standard" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEFORESTATION_STANDARD_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {(answers['env_10'] as string) === 'other' && (
                                <Input
                                  placeholder="Please specify the standard"
                                  disabled={isSubmitted}
                                  onChange={(e) => handleAnswer('env_10', e.target.value as EsgResponse)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      index={idx + 1}
                      value={answers[question.id] || null}
                      onChange={(val) => handleAnswer(question.id, val)}
                      disabled={isSubmitted}
                      evidence={evidenceByQuestion[question.id] || []}
                      onUploadEvidence={uploadEvidence}
                      onDeleteEvidence={deleteEvidence}
                    />
                  )})}

                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Submit Button */}
      {!isSubmitted && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to submit?</p>
                <p className="text-sm text-muted-foreground">
                  {isReadyToSubmit(answers)
                    ? 'All questions answered. You can now submit for verification.'
                    : `Answer all ${totalQuestions} questions to submit. ${totalQuestions - answeredQuestions} remaining.`}
                </p>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!isReadyToSubmit(answers) || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Submit Assessment
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saving indicator */}
      {saving && !isSubmitted && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

function QuestionRow({
  question,
  index,
  value,
  onChange,
  disabled,
  evidence,
  onUploadEvidence,
  onDeleteEvidence,
}: {
  question: { id: string; text: string; guidanceNote?: string; allowNA?: boolean }
  index: number
  value: EsgResponse | null
  onChange: (val: EsgResponse) => void
  disabled: boolean
  evidence: SupplierEsgEvidence[]
  onUploadEvidence: (questionId: string, file: File, name: string) => Promise<any>
  onDeleteEvidence: (id: string) => Promise<boolean>
}) {
  const options: { label: string; value: EsgResponse }[] = [
    { label: 'Yes', value: 'yes' },
    { label: 'Partial', value: 'partial' },
    { label: 'No', value: 'no' },
    { label: 'N/A', value: 'na' },
  ]

  const showEvidence = value === 'yes' || value === 'partial'

  return (
    <div className="border rounded-lg p-4">
      <div className="flex gap-3">
        <span className="text-sm font-medium text-muted-foreground w-6 flex-shrink-0">
          {index}.
        </span>
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium leading-relaxed">{question.text}</p>
          {question.guidanceNote && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{question.guidanceNote}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  value === opt.value
                    ? opt.value === 'yes'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : opt.value === 'partial'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : opt.value === 'no'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    : 'border-border text-muted-foreground hover:bg-accent'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {showEvidence && (
            <EsgQuestionEvidenceUpload
              questionId={question.id}
              evidence={evidence}
              onUpload={onUploadEvidence}
              onDelete={onDeleteEvidence}
              disabled={disabled}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return null

  const styles: Record<string, string> = {
    leader: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    progressing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    needs_improvement: 'bg-red-500/20 text-red-400 border-red-500/30',
    not_assessed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }

  return (
    <Badge className={`text-xs ${styles[rating] || ''}`}>
      {getRatingLabel(rating as any)}
    </Badge>
  )
}
