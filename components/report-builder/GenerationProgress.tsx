'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Download, AlertCircle, Database, FileText, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerationProgressProps {
  status: string;
  documentUrl: string | null;
  error: string | null;
  reportName: string;
  onDownload: () => void;
  onReset: () => void;
}

const PROGRESS_STEPS = [
  { key: 'pending', label: 'Queued', icon: FileText },
  { key: 'aggregating_data', label: 'Aggregating Data', icon: Database },
  { key: 'building_content', label: 'Building Content', icon: FileText },
  { key: 'generating_document', label: 'Generating Document', icon: FileDown },
  { key: 'completed', label: 'Complete', icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  const idx = PROGRESS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function GenerationProgress({ status, documentUrl, error, reportName, onDownload, onReset }: GenerationProgressProps) {
  const currentIndex = getStepIndex(status);
  const isFailed = status === 'failed';
  const isComplete = status === 'completed';

  return (
    <Card className={cn(
      'max-w-xl mx-auto',
      isComplete && 'border-green-200',
      isFailed && 'border-red-200'
    )}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isFailed ? 'Generation Failed' : isComplete ? 'Report Ready' : 'Generating Report...'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{reportName}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Steps */}
        <div className="space-y-3">
          {PROGRESS_STEPS.map((step, index) => {
            const isActive = index === currentIndex && !isComplete && !isFailed;
            const isDone = index < currentIndex || isComplete;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0',
                    isDone && 'bg-green-600 border-green-600 text-white',
                    isActive && 'border-primary bg-primary/10',
                    !isDone && !isActive && 'border-muted-foreground/20 text-muted-foreground/40'
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className={cn(
                  'text-sm',
                  isDone && 'text-green-700 font-medium',
                  isActive && 'text-foreground font-medium',
                  !isDone && !isActive && 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {isFailed && error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isComplete && documentUrl && (
            <Button onClick={onDownload} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          )}
          {(isComplete || isFailed) && (
            <Button variant="outline" onClick={onReset} className={isComplete && documentUrl ? '' : 'flex-1'}>
              Generate Another
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
