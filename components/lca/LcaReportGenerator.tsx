'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Loader2,
  Sparkles,
  Eye,
  RefreshCw,
  ArrowRight,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { evaluateCompliance, type ComplianceResult, type PcfComplianceData } from '@/lib/lca-compliance-checker';

// ============================================================================
// TYPES
// ============================================================================

interface LcaReportGeneratorProps {
  pcfId: string;
  productId: string;
  productName: string;
}

type GeneratorState =
  | 'checking'      // Checking ISO compliance
  | 'incomplete'    // Missing required fields
  | 'ready'         // Ready to generate
  | 'generating'    // Generating PDF
  | 'preview'       // PDF ready for preview/download
  | 'error';        // Something went wrong

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
// MAIN COMPONENT
// ============================================================================

export function LcaReportGenerator({
  pcfId,
  productId,
  productName,
}: LcaReportGeneratorProps) {
  const [state, setState] = useState<GeneratorState>('checking');
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [includeNarratives, setIncludeNarratives] = useState(true);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('fetching-data');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // CHECK COMPLIANCE
  // ============================================================================

  const checkCompliance = useCallback(async () => {
    setState('checking');
    setError(null);

    try {
      // Fetch PCF data for compliance check
      const { data: pcf, error: pcfError } = await supabase
        .from('product_carbon_footprints')
        .select('*')
        .eq('id', pcfId)
        .single();

      if (pcfError || !pcf) {
        setError('Could not load LCA data');
        setState('error');
        return;
      }

      // Check if materials exist
      const { count: materialCount } = await supabase
        .from('product_carbon_footprint_materials')
        .select('id', { count: 'exact', head: true })
        .eq('product_carbon_footprint_id', pcfId);

      // Check for interpretation
      const { data: interpretation } = await supabase
        .from('lca_interpretation_results')
        .select('id')
        .eq('product_carbon_footprint_id', pcfId)
        .maybeSingle();

      // Check for critical review
      const { data: review } = await supabase
        .from('lca_critical_reviews')
        .select('id, status, is_approved, reviewers:lca_reviewers(*), reviewer_statement')
        .eq('product_carbon_footprint_id', pcfId)
        .maybeSingle();

      const complianceData: PcfComplianceData = {
        intended_application: pcf.intended_application,
        reasons_for_study: pcf.reasons_for_study,
        intended_audience: pcf.intended_audience,
        is_comparative_assertion: pcf.is_comparative_assertion,
        assumptions_limitations: pcf.assumptions_limitations,
        data_quality_requirements: pcf.data_quality_requirements,
        critical_review_type: pcf.critical_review_type,
        critical_review_justification: pcf.critical_review_justification,
        cutoff_criteria: pcf.cutoff_criteria,
        functional_unit: pcf.functional_unit,
        system_boundary: pcf.system_boundary,
        reference_year: pcf.reference_year,
        aggregated_impacts: pcf.aggregated_impacts,
        dqi_score: pcf.dqi_score,
        hasMaterials: (materialCount || 0) > 0,
        hasInterpretation: !!interpretation,
        hasReview: !!review,
        reviewData: review
          ? {
              status: review.status,
              is_approved: review.is_approved,
              reviewers: review.reviewers,
              reviewer_statement: review.reviewer_statement,
            }
          : null,
      };

      const result = evaluateCompliance(complianceData);
      setCompliance(result);

      // Require at least 60% compliance to generate report
      if (result.overallScore >= 60) {
        setState('ready');
      } else {
        setState('incomplete');
      }
    } catch (err) {
      console.error('Compliance check error:', err);
      setError('Failed to check compliance status');
      setState('error');
    }
  }, [pcfId]);

  useEffect(() => {
    checkCompliance();
  }, [checkCompliance]);

  // ============================================================================
  // GENERATE PDF
  // ============================================================================

  const generatePdf = async () => {
    setState('generating');
    setGenerationStep('fetching-data');
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Simulate step progression for UX
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
        throw new Error(errorData.error || `PDF generation failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setPdfBlob(blob);
      setPdfUrl(url);
      setGenerationStep('complete');
      setState('preview');
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      setState('error');
    }
  };

  // ============================================================================
  // DOWNLOAD
  // ============================================================================

  const downloadPdf = () => {
    if (!pdfUrl || !pdfBlob) return;

    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `LCA_Report_${productName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Generate LCA Report</h2>
        <p className="text-muted-foreground mt-1">
          Create an ISO 14044 compliant Life Cycle Assessment report for <strong>{productName}</strong>
        </p>
      </div>

      {/* Checking State */}
      {state === 'checking' && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Checking ISO compliance status...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incomplete State */}
      {state === 'incomplete' && compliance && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Missing Required Fields</AlertTitle>
            <AlertDescription>
              Your LCA needs additional information before a compliant report can be generated.
              Complete the compliance wizard to fill in the missing fields.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    ISO 14044 Compliance
                  </CardTitle>
                  <CardDescription>
                    {compliance.completedSections} of {compliance.totalSections} sections complete
                  </CardDescription>
                </div>
                <Badge variant={compliance.overallScore >= 80 ? 'default' : 'destructive'} className="text-lg px-3 py-1">
                  {compliance.overallScore}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={compliance.overallScore} className="h-2" />

              {compliance.sections
                .filter(s => s.status !== 'complete')
                .map(section => (
                  <div key={section.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-sm">{section.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          ISO {section.isoRef} — {section.completedItems}/{section.totalItems} items complete
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              <Link href={`/products/${productId}/compliance-wizard`}>
                <Button className="w-full gap-2 mt-2">
                  Open Compliance Wizard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <div className="border-t pt-4 mt-4">
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setState('ready')}
                >
                  <FileText className="h-4 w-4" />
                  Generate report anyway (without full compliance)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ready State */}
      {state === 'ready' && compliance && (
        <div className="space-y-4">
          {/* Compliance badge */}
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
            <CardContent className="flex items-center gap-4 py-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-green-900 dark:text-green-300">ISO Compliance Ready</div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  Score: {compliance.overallScore}% — {compliance.completedSections}/{compliance.totalSections} sections complete
                </div>
              </div>
              {compliance.overallScore < 100 && (
                <Link href={`/products/${productId}/compliance-wizard`}>
                  <Button variant="outline" size="sm" className="text-green-700 border-green-300">
                    Improve Score
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Report options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Configuration
              </CardTitle>
              <CardDescription>
                Customise your LCA report before generating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium">Report will include:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Cover page
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Executive summary
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Methodology
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Climate impact
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Water footprint
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Circularity & waste
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Land use
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Supply chain
                  </div>
                </div>
              </div>

              <Button
                className="w-full gap-2 h-12 text-base bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold"
                onClick={generatePdf}
              >
                <FileText className="h-5 w-5" />
                Generate LCA Report
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generating State */}
      {state === 'generating' && (
        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#ccff00] mb-4" />
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
                  const isFuture = !isActive && !isPast;

                  if (step === 'generating-narratives' && !includeNarratives) return null;

                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                        isActive ? 'bg-[#ccff00]/10 text-foreground font-medium' :
                        isPast ? 'text-muted-foreground' :
                        'text-muted-foreground/50'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#ccff00] flex-shrink-0" />
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
      )}

      {/* Preview State */}
      {state === 'preview' && pdfUrl && (
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
                <Button variant="outline" size="sm" onClick={() => { setState('ready'); setError(null); }} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
                <Button size="sm" onClick={downloadPdf} className="gap-1.5 bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold">
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
                style={{ height: '80vh', minHeight: '600px' }}
                title="LCA Report Preview"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'An unexpected error occurred'}</AlertDescription>
          </Alert>

          <Button variant="outline" onClick={checkCompliance} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
