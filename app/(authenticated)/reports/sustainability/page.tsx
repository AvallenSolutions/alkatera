"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  FileText,
  Download,
  Loader2,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wand2,
  TrendingUp,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { QuickGenerateDialog } from '@/components/report-builder/QuickGenerateDialog';
import { GenerationProgress } from '@/components/report-builder/GenerationProgress';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { useReportProgress } from '@/hooks/useReportProgress';
import { useToast } from '@/hooks/use-toast';
import type { ReportConfig } from '@/types/report-builder';
import { AUDIENCE_LABELS } from '@/types/report-builder';
import { toast as sonnerToast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface GeneratedReport {
  id: string;
  report_name: string;
  report_year: number;
  audience: string;
  output_format: string;
  status: string;
  document_url: string | null;
  error_message: string | null;
  created_at: string;
  generated_at: string | null;
  is_latest: boolean;
}

export default function SustainabilityReportsPage() {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const { generateReport, loadDefaults, loading: generating } = useReportBuilder();

  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickGenerateOpen, setQuickGenerateOpen] = useState(false);
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  // Default config for quick generate
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

  // Load saved defaults
  useEffect(() => {
    if (currentOrganization) {
      const saved = loadDefaults(currentOrganization);
      if (saved) {
        setConfig(prev => ({ ...prev, ...saved }));
      }
    }
  }, [currentOrganization]);

  // Progress tracking for active generation
  const progress = useReportProgress(generatingReportId);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchReports();
    }
  }, [currentOrganization?.id]);

  // If generation completes, refresh the list
  useEffect(() => {
    if (progress.status === 'completed' || progress.status === 'failed') {
      fetchReports();
    }
  }, [progress.status]);

  const fetchReports = async () => {
    if (!currentOrganization?.id) return;
    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('generated_reports')
        .select('id, report_name, report_year, audience, output_format, status, document_url, error_message, created_at, generated_at, is_latest')
        .eq('organization_id', currentOrganization.id)
        .eq('is_latest', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      sonnerToast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (reportConfig?: ReportConfig) => {
    const cfg = reportConfig || config;

    if (cfg.sections.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one section', variant: 'destructive' });
      return;
    }

    const result = await generateReport(cfg);

    if (result.success && result.report_id) {
      setGeneratingReportId(result.report_id);
      setQuickGenerateOpen(false);
      toast({ title: 'Report generation started', description: 'This usually takes 30 to 60 seconds.' });
    } else {
      toast({
        title: 'Generation failed',
        description: result.error || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const downloadSummary = async (reportId: string, type: 'investor-summary' | 'regulatory-index') => {
    setExportingId(`${reportId}-${type}`);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/reports/${reportId}/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast({ title: 'Export failed', description: 'Could not generate the summary export.', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleResetProgress = () => {
    setGeneratingReportId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
    }
  };

  const getFormatLabel = (format: string) => {
    const map: Record<string, string> = { pptx: 'PPTX', pdf: 'PDF', html: 'HTML', docx: 'Word', xlsx: 'Excel' };
    return map[format] || format.toUpperCase();
  };

  if (isLoading) return <PageLoader message="Loading reports..." />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sustainability Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate professional sustainability reports from your data in seconds
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="lg"
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg"
            onClick={() => setQuickGenerateOpen(true)}
          >
            <Zap className="h-5 w-5 mr-2" />
            Quick Generate
          </Button>
          <Link href="/reports/builder">
            <Button variant="outline" size="lg">
              <Wand2 className="h-4 w-4 mr-2" />
              Custom Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Active generation progress */}
      {generatingReportId && progress.status !== 'completed' && progress.status !== 'failed' && (
        <GenerationProgress
          status={progress.status}
          documentUrl={progress.documentUrl}
          error={progress.error}
          reportName={config.reportName}
          onDownload={() => progress.documentUrl && handleDownload(progress.documentUrl)}
          onReset={handleResetProgress}
        />
      )}

      {/* Completed generation notification */}
      {generatingReportId && progress.status === 'completed' && progress.documentUrl && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Report ready</p>
                  <p className="text-sm text-muted-foreground">{config.reportName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => handleDownload(progress.documentUrl!)} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={handleResetProgress}>
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previously generated reports */}
      <Card>
        <CardHeader>
          <CardTitle>Your Reports</CardTitle>
          <CardDescription>
            Previously generated sustainability reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length > 0 ? (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{report.report_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{report.report_year}</span>
                        <span>·</span>
                        <span>{AUDIENCE_LABELS?.[report.audience as keyof typeof AUDIENCE_LABELS] || report.audience}</span>
                        <span>·</span>
                        <span>{getFormatLabel(report.output_format)}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(report.status)}
                    {report.status === 'completed' && report.document_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report.document_url!)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                    {report.status === 'completed' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Investor Summary (2-page PDF)"
                          disabled={exportingId === `${report.id}-investor-summary`}
                          onClick={() => downloadSummary(report.id, 'investor-summary')}
                        >
                          {exportingId === `${report.id}-investor-summary`
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <TrendingUp className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Regulatory Index (framework coverage PDF)"
                          disabled={exportingId === `${report.id}-regulatory-index`}
                          onClick={() => downloadSummary(report.id, 'regulatory-index')}
                        >
                          {exportingId === `${report.id}-regulatory-index`
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Scale className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">No reports yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Generate your first sustainability report in seconds. We will pull data from your facilities,
                products, fleet, and footprint automatically.
              </p>
              <Button
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                onClick={() => setQuickGenerateOpen(true)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate Your First Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coming soon frameworks */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground px-1">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'CDP Climate Disclosure', description: 'Streamlined reporting for the Carbon Disclosure Project questionnaire.' },
            { title: 'TCFD Report', description: 'Climate-related financial disclosures aligned with TCFD recommendations.' },
            { title: 'CSRD / ESRS E1', description: 'European Sustainability Reporting Standards climate reporting module.' },
          ].map((item) => (
            <Card key={item.title} className="opacity-60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
