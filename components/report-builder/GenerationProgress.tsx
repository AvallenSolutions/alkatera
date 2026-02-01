'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Database, FileCode, FileOutput, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProgressEvent } from '@/types/report-builder';

interface GenerationProgressProps {
  progress: ReportProgressEvent;
}

const STAGES = [
  { key: 'aggregating_data', label: 'Aggregating Data', icon: Database, description: 'Collecting emissions, facility, and product data...' },
  { key: 'building_content', label: 'Building Content', icon: FileCode, description: 'Creating slides and formatting content...' },
  { key: 'generating_document', label: 'Generating Document', icon: FileOutput, description: 'Producing your PowerPoint presentation...' },
  { key: 'completed', label: 'Complete', icon: CheckCircle2, description: 'Your report is ready to download!' },
] as const;

export function GenerationProgress({ progress }: GenerationProgressProps) {
  const currentStageIndex = STAGES.findIndex((s) => s.key === progress.status);
  const isFailed = progress.status === 'failed';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isFailed ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : progress.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          {isFailed ? 'Generation Failed' : 'Generating Report...'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Progress value={progress.progress} className="h-2" />
        <p className="text-sm text-muted-foreground text-center">
          {progress.message || `${progress.progress}% complete`}
        </p>

        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const isActive = stage.key === progress.status;
            const isComplete = index < currentStageIndex;
            const Icon = stage.icon;

            return (
              <div
                key={stage.key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors',
                  isActive && 'bg-primary/5 border border-primary/20',
                  isComplete && 'opacity-60',
                  !isActive && !isComplete && 'opacity-30'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isComplete && 'bg-primary/10 text-primary',
                    isActive && 'bg-primary text-primary-foreground',
                    !isActive && !isComplete && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isActive && 'text-primary')}>
                    {stage.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
