'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, CheckCircle2 } from 'lucide-react';
import { WizardStepIndicator } from '@/components/report-builder/WizardStepIndicator';
import { ConfigureStep } from '@/components/report-builder/ConfigureStep';
import { ContentSelectionStep } from '@/components/report-builder/ContentSelectionStep';
import { ReviewStep } from '@/components/report-builder/ReviewStep';
import { GenerationProgress } from '@/components/report-builder/GenerationProgress';
import { QuickGenerateDialog } from '@/components/report-builder/QuickGenerateDialog';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { useReportProgress } from '@/hooks/useReportProgress';
import { useToast } from '@/hooks/use-toast';
import type { WizardStep, ReportConfig } from '@/types/report-builder';
export type { ReportConfig } from '@/types/report-builder';

export default function ReportBuilderPage() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [currentStep, setCurrentStep] = useState<WizardStep>('configure');
  const [config, setConfig] = useState<ReportConfig>({
    reportName: `Sustainability Report ${currentYear}`,
    reportYear: currentYear,
    reportingPeriodStart: `${currentYear}-01-01`,
    reportingPeriodEnd: `${currentYear}-12-31`,
    audience: 'investors',
    outputFormat: 'pptx',
    standards: ['csrd', 'iso-14067'],
    sections: ['executive-summary'],
    branding: {
      logo: null,
      primaryColor: '#2563eb',
      secondaryColor: '#10b981',
    },
    isMultiYear: false,
    reportYears: [currentYear],
  });

  const [generating, setGenerating] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<{
    id: string;
    document_url: string;
  } | null>(null);

  const { generateReport } = useReportBuilder();
  const progress = useReportProgress(generating ? activeReportId : null);

  // React to progress completion or failure
  useEffect(() => {
    if (!activeReportId) return;

    if (progress.status === 'completed') {
      setGenerating(false);
      setGeneratedReport({
        id: activeReportId,
        document_url: progress.document_url || '',
      });
      setActiveReportId(null);
      toast({
        title: 'Success!',
        description: 'Your sustainability report has been generated',
      });
    } else if (progress.status === 'failed') {
      setGenerating(false);
      setActiveReportId(null);
      toast({
        title: 'Generation Failed',
        description: progress.message || 'Report generation failed',
        variant: 'destructive',
      });
    }
  }, [progress.status, activeReportId, progress.document_url, progress.message, toast]);

  const handleUpdateConfig = (updates: Partial<ReportConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const handleGenerate = async () => {
    if (!config.reportName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a report name',
        variant: 'destructive',
      });
      return;
    }

    if (config.sections.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one section',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      const result = await generateReport(config);

      if (result.success && result.report_id) {
        setActiveReportId(result.report_id);
        // Edge function runs async — progress tracked via useReportProgress
        // Page will show GenerationProgress component while generating=true
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      setGenerating(false);
      setActiveReportId(null);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred while generating your report',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (generatedReport?.document_url) {
      window.open(generatedReport.document_url, '_blank');
    }
  };

  // Show generation progress overlay
  if (generating && activeReportId) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Generating Your Report</h1>
          <p className="text-muted-foreground">
            Please wait while we build your sustainability report...
          </p>
        </div>
        <GenerationProgress progress={progress} />
      </div>
    );
  }

  // Show completed state
  if (generatedReport) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Report Generated</h1>
        </div>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle className="text-green-900 dark:text-green-100">Report Generated Successfully</CardTitle>
            </div>
            <CardDescription>
              Your sustainability report is ready to download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-background rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">{config.reportName}</p>
                  <p className="text-sm text-muted-foreground">
                    {config.outputFormat.toUpperCase()} &middot; {config.reportYear} &middot; {config.sections.length} sections
                  </p>
                </div>
              </div>
              <Button onClick={handleDownload} size="lg">
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </div>
            <Alert>
              <AlertDescription>
                The document is editable. You can open it in PowerPoint and make any final adjustments before sharing.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedReport(null);
                setCurrentStep('configure');
              }}
              className="w-full"
            >
              Generate Another Report
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Generate Sustainability Report</h1>
          <p className="text-muted-foreground">
            Create a comprehensive, data-driven sustainability report with AI-powered document generation
          </p>
        </div>
        <QuickGenerateDialog onGenerate={handleGenerate} generating={generating} />
      </div>

      <WizardStepIndicator currentStep={currentStep} onStepClick={setCurrentStep} />

      {currentStep === 'configure' && (
        <ConfigureStep
          config={config}
          onChange={handleUpdateConfig}
          onNext={() => setCurrentStep('content')}
        />
      )}

      {currentStep === 'content' && (
        <ContentSelectionStep
          config={config}
          onChange={handleUpdateConfig}
          onNext={() => setCurrentStep('review')}
          onBack={() => setCurrentStep('configure')}
        />
      )}

      {currentStep === 'review' && (
        <ReviewStep
          config={config}
          onChange={handleUpdateConfig}
          onBack={() => setCurrentStep('content')}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}
    </div>
  );
}
