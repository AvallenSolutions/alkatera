'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Download, CheckCircle2 } from 'lucide-react';
import { BasicConfigForm } from '@/components/report-builder/BasicConfigForm';
import { DataSelectionPanel } from '@/components/report-builder/DataSelectionPanel';
import { StandardsSelector } from '@/components/report-builder/StandardsSelector';
import { BrandingPanel } from '@/components/report-builder/BrandingPanel';
import { ReportPreview } from '@/components/report-builder/ReportPreview';
import { DataPreviewPanel } from '@/components/report-builder/DataPreviewPanel';
import { SectionRecommendations } from '@/components/report-builder/SectionRecommendations';
import { TemplateLibrary } from '@/components/report-builder/TemplateLibrary';
import { DataGapAlerts } from '@/components/report-builder/DataGapAlerts';
import { ReportVersioning } from '@/components/report-builder/ReportVersioning';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { useToast } from '@/hooks/use-toast';

export interface ReportConfig {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  audience: 'investors' | 'regulators' | 'customers' | 'internal' | 'supply-chain' | 'technical';
  outputFormat: 'pptx';
  standards: string[];
  sections: string[];
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  isMultiYear?: boolean;
  reportYears?: number[];
}

export default function ReportBuilderPage() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [config, setConfig] = useState<ReportConfig>({
    reportName: `Sustainability Report ${currentYear}`,
    reportYear: currentYear,
    reportingPeriodStart: `${currentYear}-01-01`,
    reportingPeriodEnd: `${currentYear}-12-31`,
    audience: 'investors',
    outputFormat: 'pptx',
    standards: ['csrd', 'iso-14067'],
    sections: ['executive-summary'], // Required section
    branding: {
      logo: null,
      primaryColor: '#2563eb',
      secondaryColor: '#10b981',
    },
    isMultiYear: false,
    reportYears: [currentYear],
  });

  const [activeTab, setActiveTab] = useState('basics');
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{
    id: string;
    document_url: string;
  } | null>(null);

  const { generateReport } = useReportBuilder();

  const handleUpdateConfig = (updates: Partial<ReportConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const handleGenerate = async () => {
    // Validation
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

      if (result.success && result.report_id && result.document_url) {
        setGeneratedReport({
          id: result.report_id,
          document_url: result.document_url,
        });

        toast({
          title: 'Success!',
          description: 'Your sustainability report has been generated',
        });
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred while generating your report',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedReport?.document_url) {
      window.open(generatedReport.document_url, '_blank');
    }
  };

  // Extract reportId to avoid TypeScript narrowing issues
  const reportId = generatedReport?.id;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Sustainability Report</h1>
        <p className="text-muted-foreground">
          Create a comprehensive, data-driven sustainability report with AI-powered document generation
        </p>
      </div>

      {generatedReport ? (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle className="text-green-900">Report Generated Successfully</CardTitle>
            </div>
            <CardDescription>
              Your sustainability report is ready to download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">{config.reportName}</p>
                  <p className="text-sm text-muted-foreground">
                    {config.outputFormat.toUpperCase()} • {config.reportYear} • {config.sections.length} sections
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
            <Button variant="outline" onClick={() => setGeneratedReport(null)} className="w-full">
              Generate Another Report
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>
              Configure your sustainability report settings and select the data to include
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 gap-1">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
                <TabsTrigger value="data">Data Selection</TabsTrigger>
                <TabsTrigger value="data-preview">Data Preview</TabsTrigger>
                <TabsTrigger value="standards">Standards</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="gaps">Data Gaps</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="versions">Versions</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-4 mt-6">
                <BasicConfigForm config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="templates" className="space-y-4 mt-6">
                <TemplateLibrary config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4 mt-6">
                <SectionRecommendations config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="data" className="space-y-4 mt-6">
                <DataSelectionPanel config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="data-preview" className="space-y-4 mt-6">
                <DataPreviewPanel config={config} />
              </TabsContent>

              <TabsContent value="standards" className="space-y-4 mt-6">
                <StandardsSelector config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="branding" className="space-y-4 mt-6">
                <BrandingPanel config={config} onChange={handleUpdateConfig} />
              </TabsContent>

              <TabsContent value="gaps" className="space-y-4 mt-6">
                <DataGapAlerts config={config} />
              </TabsContent>

              <TabsContent value="preview" className="space-y-4 mt-6">
                <ReportPreview config={config} />
              </TabsContent>

              <TabsContent value="versions" className="space-y-4 mt-6">
                <ReportVersioning
                  reportId={reportId}
                  currentConfig={config}
                  onRestore={handleUpdateConfig}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" disabled={generating}>
              Save as Template
            </Button>
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
