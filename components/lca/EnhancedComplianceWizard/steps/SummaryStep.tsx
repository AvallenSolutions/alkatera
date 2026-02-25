'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  Target,
  Box,
  Scissors,
  BarChart2,
  LineChart,
  Shield,
  FileText,
  Edit,
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useWizardContext, getStepIdsForBoundary } from '../WizardContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

type PdfState = 'idle' | 'generating' | 'preview' | 'error';

type GenerationStep =
  | 'fetching-data'
  | 'generating-narratives'
  | 'building-pdf'
  | 'complete';

const STEP_LABELS: Record<GenerationStep, string> = {
  'fetching-data': 'Fetching LCA data...',
  'generating-narratives': 'Generating AI narrative content...',
  'building-pdf': 'Building PDF report...',
  'complete': 'Report ready!',
};

const STEP_PROGRESS: Record<GenerationStep, number> = {
  'fetching-data': 15,
  'generating-narratives': 45,
  'building-pdf': 80,
  'complete': 100,
};

// ============================================================================
// COMPLIANCE CHECK
// ============================================================================

interface ComplianceItem {
  field: string;
  label: string;
  required: boolean;
  completed: boolean;
  value?: string;
}

function useComplianceChecklist(): ComplianceItem[] {
  const { formData } = useWizardContext();

  return [
    {
      field: 'intendedApplication',
      label: 'Intended Application',
      required: true,
      completed: !!formData.intendedApplication.trim(),
      value: formData.intendedApplication,
    },
    {
      field: 'reasonsForStudy',
      label: 'Reasons for Study',
      required: true,
      completed: !!formData.reasonsForStudy.trim(),
      value: formData.reasonsForStudy,
    },
    {
      field: 'intendedAudience',
      label: 'Intended Audience',
      required: true,
      completed: formData.intendedAudience.length > 0,
      value: formData.intendedAudience.join(', '),
    },
    {
      field: 'functionalUnit',
      label: 'Functional Unit',
      required: true,
      completed: !!formData.functionalUnit.trim(),
      value: formData.functionalUnit,
    },
    {
      field: 'systemBoundary',
      label: 'System Boundary',
      required: true,
      completed: !!formData.systemBoundary,
      value: formData.systemBoundary,
    },
    {
      field: 'cutoffCriteria',
      label: 'Cut-off Criteria',
      required: true,
      completed: !!formData.cutoffCriteria.trim(),
      value: formData.cutoffCriteria,
    },
    {
      field: 'assumptions',
      label: 'Assumptions & Limitations',
      required: true,
      completed: formData.assumptions.length > 0,
      value: `${formData.assumptions.length} documented`,
    },
    {
      field: 'dataQuality.temporal_coverage',
      label: 'Temporal Coverage',
      required: true,
      completed: !!formData.dataQuality.temporal_coverage,
      value: formData.dataQuality.temporal_coverage,
    },
    {
      field: 'dataQuality.geographic_coverage',
      label: 'Geographic Coverage',
      required: true,
      completed: !!formData.dataQuality.geographic_coverage,
      value: formData.dataQuality.geographic_coverage,
    },
    {
      field: 'dataQuality.technological_coverage',
      label: 'Technological Coverage',
      required: true,
      completed: !!formData.dataQuality.technological_coverage,
      value: formData.dataQuality.technological_coverage,
    },
    {
      field: 'hasInterpretation',
      label: 'Interpretation Analysis',
      required: true,
      completed: formData.hasInterpretation,
      value: formData.hasInterpretation ? 'Generated' : 'Not generated',
    },
    {
      field: 'criticalReviewType',
      label: 'Critical Review',
      required: true,
      completed: !!formData.criticalReviewType,
      value: formData.criticalReviewType,
    },
  ];
}

// ============================================================================
// SECTION SUMMARY
// ============================================================================

interface SectionSummaryProps {
  icon: React.ElementType;
  title: string;
  items: Array<{ label: string; value: string | undefined }>;
  onEdit: () => void;
}

function SectionSummary({
  icon: Icon,
  title,
  items,
  onEdit,
}: SectionSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="max-w-[60%] truncate font-medium">
              {item.value || '-'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// HELPER: step ID → step number
// ============================================================================

function useStepNumber(stepId: string): number {
  const { formData } = useWizardContext();
  const boundary = formData.systemBoundary || 'cradle-to-gate';
  const ids = getStepIdsForBoundary(boundary);
  const idx = ids.indexOf(stepId);
  return idx >= 0 ? idx + 1 : 1;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SummaryStep() {
  const {
    formData,
    progress,
    goToStep,
    pcfId,
    preCalcState,
    saveProgress,
    finishWizard,
  } = useWizardContext();

  const checklist = useComplianceChecklist();
  const completedCount = checklist.filter((item) => item.completed).length;
  const requiredCount = checklist.filter((item) => item.required).length;
  const allComplete = completedCount === requiredCount;
  const compliancePercent = Math.round((completedCount / requiredCount) * 100);

  // Step number lookup for Edit buttons
  const goalStep = useStepNumber('goal');
  const boundaryStep = useStepNumber('boundary');
  const cutoffStep = useStepNumber('cutoff');
  const dataQualityStep = useStepNumber('data-quality');
  const interpretationStep = useStepNumber('interpretation');
  const reviewStep = useStepNumber('review');

  // PDF generation state
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const [includeNarratives, setIncludeNarratives] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('fetching-data');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const productName = preCalcState.product?.name || 'Product';

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ============================================================================
  // PDF GENERATION
  // ============================================================================

  const generatePdf = useCallback(async () => {
    if (!pcfId) return;

    setPdfState('generating');
    setGenerationStep('fetching-data');
    setPdfError(null);

    try {
      // Save all ISO fields to DB first
      await saveProgress();

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Step progression for UX
      setGenerationStep('fetching-data');
      await new Promise(r => setTimeout(r, 500));

      if (includeNarratives) {
        setGenerationStep('generating-narratives');
      }

      setGenerationStep('building-pdf');

      // Call the PDF generation API
      const response = await fetch(`/api/lca/${pcfId}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          includeNarratives,
          inline: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.details || errorData.error || `PDF generation failed (${response.status})`;
        throw new Error(msg);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Clean up previous URL
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfBlob(blob);
      setPdfUrl(url);
      setGenerationStep('complete');
      setPdfState('preview');

      // Mark wizard as complete
      await finishWizard();
    } catch (err) {
      console.error('[SummaryStep] PDF generation error:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to generate PDF');
      setPdfState('error');
    }
  }, [pcfId, includeNarratives, saveProgress, finishWizard, pdfUrl]);

  const downloadPdf = useCallback(() => {
    if (!pdfUrl || !pdfBlob) return;

    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `LCA_Report_${productName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfUrl, pdfBlob, productName]);

  const handleRegenerate = useCallback(() => {
    setPdfState('idle');
    setPdfError(null);
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Report & Completion</h3>
        <p className="text-sm text-muted-foreground">
          Review your ISO 14044 compliance information and generate your LCA report PDF.
        </p>
      </div>

      {/* Completion Status */}
      <Card className={cn(allComplete ? 'border-green-200 dark:border-green-800' : 'border-yellow-200 dark:border-yellow-800')}>
        <CardContent className="flex items-center gap-4 p-4">
          {allComplete ? (
            <CheckCircle2 className="h-10 w-10 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-yellow-600 flex-shrink-0" />
          )}
          <div>
            <p className="text-lg font-semibold">
              {completedCount} of {requiredCount} required fields completed
            </p>
            <p className="text-sm text-muted-foreground">
              {allComplete
                ? 'All required ISO 14044 compliance fields are complete.'
                : 'Some required fields are missing. Please review and complete them.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Missing Fields Alert */}
      {!allComplete && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Required Information</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc">
              {checklist
                .filter((item) => item.required && !item.completed)
                .map((item) => (
                  <li key={item.field}>{item.label}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Section Summaries */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionSummary
          icon={Target}
          title="Goal & Purpose"
          onEdit={() => goToStep(goalStep)}
          items={[
            { label: 'Application', value: formData.intendedApplication.slice(0, 50) + (formData.intendedApplication.length > 50 ? '...' : '') },
            { label: 'Audience', value: `${formData.intendedAudience.length} selected` },
            { label: 'Comparative', value: formData.isComparativeAssertion ? 'Yes' : 'No' },
          ]}
        />

        <SectionSummary
          icon={Box}
          title="System Boundary"
          onEdit={() => goToStep(boundaryStep)}
          items={[
            { label: 'Functional Unit', value: formData.functionalUnit.slice(0, 50) + (formData.functionalUnit.length > 50 ? '...' : '') },
            { label: 'Boundary', value: formData.systemBoundary },
            { label: 'Reference Year', value: formData.referenceYear.toString() },
          ]}
        />

        <SectionSummary
          icon={Scissors}
          title="Cut-off Criteria"
          onEdit={() => goToStep(cutoffStep)}
          items={[
            { label: 'Criteria', value: formData.cutoffCriteria ? 'Defined' : 'Not defined' },
            { label: 'Assumptions', value: `${formData.assumptions.length} documented` },
          ]}
        />

        <SectionSummary
          icon={BarChart2}
          title="Data Quality"
          onEdit={() => goToStep(dataQualityStep)}
          items={[
            { label: 'DQI Score', value: formData.dqiScore ? `${formData.dqiScore}%` : 'N/A' },
            { label: 'Temporal', value: formData.dataQuality.temporal_coverage },
            { label: 'Geographic', value: formData.dataQuality.geographic_coverage },
            { label: 'Precision', value: formData.dataQuality.precision },
          ]}
        />

        <SectionSummary
          icon={LineChart}
          title="Interpretation"
          onEdit={() => goToStep(interpretationStep)}
          items={[
            { label: 'Status', value: formData.hasInterpretation ? 'Generated' : 'Pending' },
          ]}
        />

        <SectionSummary
          icon={Shield}
          title="Critical Review"
          onEdit={() => goToStep(reviewStep)}
          items={[
            { label: 'Review Type', value: formData.criticalReviewType },
            { label: 'Justification', value: formData.criticalReviewJustification ? 'Provided' : 'None' },
          ]}
        />
      </div>

      <Separator />

      {/* Compliance Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            ISO 14044 Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.field}
                className="flex items-center gap-2 text-sm"
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span
                  className={cn(
                    item.completed
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
                {item.required && !item.completed && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ================================================================== */}
      {/* PDF GENERATION SECTION                                             */}
      {/* ================================================================== */}

      {!pcfId ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No LCA Calculation</AlertTitle>
          <AlertDescription>
            Run the LCA calculation first before generating a report.
          </AlertDescription>
        </Alert>
      ) : compliancePercent < 60 && pdfState === 'idle' ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Compliance Below Threshold</AlertTitle>
          <AlertDescription>
            At least 60% compliance is recommended before generating a report.
            Current score: {compliancePercent}%. Please complete the missing fields above.
          </AlertDescription>
        </Alert>
      ) : pdfState === 'idle' ? (
        /* Ready to generate */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate LCA Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Narrative Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">AI-Enhanced Narratives</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Generate executive summary, key findings, and recommendations using AI
                  </div>
                </div>
              </div>
              <Switch
                checked={includeNarratives}
                onCheckedChange={setIncludeNarratives}
              />
            </div>

            {/* Report contents */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Report will include:</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {['Cover page', 'Executive summary', 'Methodology', 'Climate impact', 'Water footprint', 'Circularity & waste', 'Land use', 'Supply chain'].map(item => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              className="w-full gap-2 h-12 text-base bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold"
              onClick={generatePdf}
            >
              <FileText className="h-5 w-5" />
              Generate LCA Report
            </Button>
          </CardContent>
        </Card>
      ) : pdfState === 'generating' ? (
        /* Generating state */
        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-1">Generating Report</h3>
                <p className="text-sm text-muted-foreground">
                  {STEP_LABELS[generationStep]}
                </p>
              </div>

              <Progress value={STEP_PROGRESS[generationStep]} className="h-2" />

              <div className="space-y-2">
                {(Object.keys(STEP_LABELS) as GenerationStep[]).map(step => {
                  const isActive = step === generationStep;
                  const isPast = STEP_PROGRESS[step] < STEP_PROGRESS[generationStep];

                  if (step === 'generating-narratives' && !includeNarratives) return null;

                  return (
                    <div
                      key={step}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                        isActive && 'bg-[#ccff00]/10 text-foreground font-medium',
                        isPast && 'text-muted-foreground',
                        !isActive && !isPast && 'text-muted-foreground/50',
                      )}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                      )}
                      {STEP_LABELS[step]}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : pdfState === 'preview' && pdfUrl ? (
        /* Preview state */
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-semibold text-green-900 dark:text-green-300">Report Generated Successfully</div>
                  <div className="text-sm text-green-700 dark:text-green-400">
                    {pdfBlob ? `${(pdfBlob.size / 1024).toFixed(0)} KB` : ''} — Ready for download
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={downloadPdf}
                  className="gap-1.5 bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PDF Preview */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <iframe
                src={pdfUrl}
                className="w-full border-0"
                style={{ height: '70vh', minHeight: '500px' }}
                title="LCA Report Preview"
              />
            </CardContent>
          </Card>
        </div>
      ) : pdfState === 'error' ? (
        /* Error state */
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Report Generation Failed</AlertTitle>
            <AlertDescription>{pdfError || 'An unexpected error occurred'}</AlertDescription>
          </Alert>

          <Button variant="outline" onClick={handleRegenerate} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
