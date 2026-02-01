'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, ArrowLeft, ArrowRight, FileText, Loader2 } from 'lucide-react';
import { WizardStepIndicator } from '@/components/report-builder/WizardStepIndicator';
import { ConfigureStep } from '@/components/report-builder/ConfigureStep';
import { ContentSelectionStep } from '@/components/report-builder/ContentSelectionStep';
import { ReviewStep } from '@/components/report-builder/ReviewStep';
import { QuickGenerateDialog } from '@/components/report-builder/QuickGenerateDialog';
import { GenerationProgress } from '@/components/report-builder/GenerationProgress';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { useReportProgress } from '@/hooks/useReportProgress';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import type { ReportConfig } from '@/types/report-builder';

const WIZARD_STEPS = [
  { label: 'Configure', description: 'Name, year, audience' },
  { label: 'Select Content', description: 'Choose report sections' },
  { label: 'Review & Generate', description: 'Branding and final review' },
];

export default function ReportBuilderPage() {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const { generateReport, saveDefaults, loadDefaults, loading: generating } = useReportBuilder();
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState(1);
  const [quickGenerateOpen, setQuickGenerateOpen] = useState(false);
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

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

  // Load saved defaults from org context on mount
  useEffect(() => {
    if (currentOrganization) {
      const saved = loadDefaults(currentOrganization);
      if (saved) {
        setConfig(prev => ({ ...prev, ...saved }));
      }
    }
  }, [currentOrganization]);

  // Progress tracking
  const progress = useReportProgress(generatingReportId);

  const handleUpdateConfig = (updates: Partial<ReportConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleGenerate = async (reportConfig?: ReportConfig) => {
    const cfg = reportConfig || config;

    if (!cfg.reportName.trim()) {
      toast({ title: 'Error', description: 'Please enter a report name', variant: 'destructive' });
      return;
    }
    if (cfg.sections.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one section', variant: 'destructive' });
      return;
    }

    const result = await generateReport(cfg);

    if (result.success && result.report_id) {
      setGeneratingReportId(result.report_id);
      setQuickGenerateOpen(false);
      toast({ title: 'Report generation started', description: 'You can track progress below' });
    } else {
      toast({
        title: 'Generation Failed',
        description: result.error || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleSaveDefaults = async () => {
    if (!currentOrganization) return;
    const success = await saveDefaults(currentOrganization.id, config);
    if (success) {
      setDefaultsSaved(true);
      toast({ title: 'Defaults saved', description: 'Your branding and preferences will be pre-filled next time' });
    }
  };

  const handleDownload = () => {
    if (progress.documentUrl) {
      window.open(progress.documentUrl, '_blank');
    }
  };

  const handleReset = () => {
    setGeneratingReportId(null);
    setStep(1);
  };

  // If generating/completed, show progress view
  if (generatingReportId) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Generate Sustainability Report</h1>
        </div>
        <GenerationProgress
          status={progress.status}
          documentUrl={progress.documentUrl}
          error={progress.error}
          reportName={config.reportName}
          onDownload={handleDownload}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Generate Sustainability Report</h1>
          <p className="text-muted-foreground">
            Create a data-driven sustainability report with AI-powered document generation
          </p>
        </div>
        <Button
          variant="default"
          size="lg"
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg"
          onClick={() => setQuickGenerateOpen(true)}
        >
          <Zap className="mr-2 h-5 w-5" />
          Quick Generate
        </Button>
      </div>

      {/* Wizard Steps */}
      <WizardStepIndicator currentStep={step} steps={WIZARD_STEPS} />

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[step - 1].label}</CardTitle>
          <CardDescription>{WIZARD_STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <ConfigureStep config={config} onChange={handleUpdateConfig} />
          )}
          {step === 2 && (
            <ContentSelectionStep config={config} onChange={handleUpdateConfig} organizationId={currentOrganization?.id || null} />
          )}
          {step === 3 && (
            <ReviewStep
              config={config}
              onChange={handleUpdateConfig}
              onSaveDefaults={handleSaveDefaults}
              defaultsSaved={defaultsSaved}
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => handleGenerate()} disabled={generating} size="lg">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

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
  );
}
