'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { ReportPreview } from './ReportPreview';
import { BrandingPanel } from './BrandingPanel';
import { DataPreviewPanel } from './DataPreviewPanel';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface ReviewStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
}

export function ReviewStep({ config, onChange, onBack, onGenerate, generating }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Preview</CardTitle>
          <CardDescription>
            Review your report configuration before generating
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportPreview config={config} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Customize the look and feel of your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingPanel config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>
            Preview the data that will be included in your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataPreviewPanel config={config} />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" disabled={generating}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onGenerate} disabled={generating} size="lg">
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
      </div>
    </div>
  );
}
