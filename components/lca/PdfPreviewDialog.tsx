'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pcfId: string;
  productName: string;
  onGeneratePdf: () => Promise<Blob>;
}

type GenerationStep =
  | 'idle'
  | 'fetching-data'
  | 'generating-narratives'
  | 'building-pdf'
  | 'ready'
  | 'error';

const STEP_LABELS: Record<GenerationStep, string> = {
  idle: 'Ready to generate',
  'fetching-data': 'Fetching LCA data...',
  'generating-narratives': 'Generating narrative content...',
  'building-pdf': 'Building PDF document...',
  ready: 'PDF ready for download',
  error: 'Generation failed',
};

const STEP_PROGRESS: Record<GenerationStep, number> = {
  idle: 0,
  'fetching-data': 20,
  'generating-narratives': 50,
  'building-pdf': 80,
  ready: 100,
  error: 0,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PdfPreviewDialog({
  open,
  onOpenChange,
  pcfId,
  productName,
  onGeneratePdf,
}: PdfPreviewDialogProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<GenerationStep>('idle');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAiNarratives, setUseAiNarratives] = useState(true);

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

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep('idle');
      setError(null);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      setPdfBlob(null);
    }
  }, [open]);

  // ============================================================================
  // GENERATE PDF
  // ============================================================================

  const handleGenerate = useCallback(async () => {
    setError(null);
    setPdfBlob(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      // Step 1: Fetching data
      setStep('fetching-data');
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay for UX

      // Step 2: Generating narratives (if AI enabled)
      if (useAiNarratives) {
        setStep('generating-narratives');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Step 3: Building PDF
      setStep('building-pdf');
      const blob = await onGeneratePdf();

      // Create URL for preview
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);

      setStep('ready');
    } catch (err: any) {
      console.error('[PdfPreviewDialog] Generation error:', err);
      setError(err.message || 'Failed to generate PDF');
      setStep('error');
    }
  }, [onGeneratePdf, useAiNarratives, pdfUrl]);

  // ============================================================================
  // DOWNLOAD PDF
  // ============================================================================

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return;

    const filename = `${productName.replace(/\s+/g, '_')}_LCA_Report.pdf`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'PDF Downloaded',
      description: `${filename} has been saved to your downloads folder.`,
    });
  }, [pdfBlob, productName, toast]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate LCA Report PDF
          </DialogTitle>
          <DialogDescription>
            Generate and preview an ISO 14044 compliant PDF report for {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Narrative Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">AI-Enhanced Narratives</p>
                <p className="text-sm text-muted-foreground">
                  Use Claude AI to generate executive summary and key findings
                </p>
              </div>
            </div>
            <Button
              variant={useAiNarratives ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseAiNarratives(!useAiNarratives)}
              disabled={step !== 'idle' && step !== 'ready' && step !== 'error'}
            >
              {useAiNarratives ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Progress Indicator */}
          {step !== 'idle' && step !== 'ready' && step !== 'error' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{STEP_LABELS[step]}</span>
                <span className="font-medium">{STEP_PROGRESS[step]}%</span>
              </div>
              <Progress value={STEP_PROGRESS[step]} className="h-2" />
            </div>
          )}

          {/* Error State */}
          {step === 'error' && error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Ready State - PDF Preview */}
          {step === 'ready' && pdfUrl && (
            <div className="space-y-3">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  PDF generated successfully! Preview below or download directly.
                </AlertDescription>
              </Alert>

              {/* PDF Preview iframe */}
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={pdfUrl}
                  className="h-[400px] w-full"
                  title="PDF Preview"
                />
              </div>
            </div>
          )}

          {/* Idle State - Info */}
          {step === 'idle' && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Eye className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h4 className="mb-2 font-medium">Ready to Generate</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Click &quot;Generate PDF&quot; to create an ISO 14044 compliant
                report with all your LCA data and compliance information.
              </p>
              <div className="text-left">
                <p className="mb-2 text-sm font-medium">Report includes:</p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  <li>Executive summary and key findings</li>
                  <li>Goal and scope definition</li>
                  <li>Data quality assessment (Pedigree Matrix)</li>
                  <li>Impact assessment results</li>
                  <li>Interpretation and recommendations</li>
                  <li>Critical review status</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'idle' && (
            <Button onClick={handleGenerate}>
              <FileText className="mr-2 h-4 w-4" />
              Generate PDF
            </Button>
          )}

          {(step === 'fetching-data' ||
            step === 'generating-narratives' ||
            step === 'building-pdf') && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </Button>
          )}

          {step === 'ready' && (
            <>
              <Button variant="outline" onClick={handleGenerate}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </>
          )}

          {step === 'error' && (
            <Button onClick={handleGenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PDF DOWNLOAD BUTTON (standalone)
// ============================================================================

interface PdfDownloadButtonProps {
  pcfId: string;
  productName: string;
  onGeneratePdf: () => Promise<Blob>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showPreview?: boolean;
}

export function PdfDownloadButton({
  pcfId,
  productName,
  onGeneratePdf,
  variant = 'default',
  size = 'default',
  className,
  showPreview = true,
}: PdfDownloadButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDirectDownload = async () => {
    setLoading(true);
    try {
      const blob = await onGeneratePdf();
      const filename = `${productName.replace(/\s+/g, '_')}_LCA_Report.pdf`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'PDF Downloaded',
        description: `${filename} has been saved.`,
      });
    } catch (err: any) {
      toast({
        title: 'Download Failed',
        description: err.message || 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (showPreview) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setDialogOpen(true)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Generate PDF Report
        </Button>
        <PdfPreviewDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pcfId={pcfId}
          productName={productName}
          onGeneratePdf={onGeneratePdf}
        />
      </>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDirectDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Download PDF
    </Button>
  );
}
