'use client';

import { Panel, StateChip, PillButton } from '@/components/studio';
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
  { key: 'pending', label: 'Queued' },
  { key: 'aggregating_data', label: 'Gathering your data' },
  { key: 'building_content', label: 'Writing the content' },
  { key: 'generating_document', label: 'Laying out the document' },
  { key: 'completed', label: 'Ready' },
];

function getStepIndex(status: string): number {
  const idx = PROGRESS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

/** Generation progress as a quiet studio fact-list: one hairline row per
 * stage, working tones doing the talking. */
export function GenerationProgress({ status, documentUrl, error, reportName, onDownload, onReset }: GenerationProgressProps) {
  const currentIndex = getStepIndex(status);
  const isFailed = status === 'failed';
  const isComplete = status === 'completed';

  return (
    <Panel className="mx-auto max-w-xl">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-foreground">
            {isFailed ? 'Generation failed.' : isComplete ? 'Report ready.' : 'Generating your report.'}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{reportName}</p>
        </div>
        {isFailed ? (
          <StateChip tone="stale">Failed</StateChip>
        ) : isComplete ? (
          <StateChip tone="good">Complete</StateChip>
        ) : (
          <StateChip tone="attention">Working</StateChip>
        )}
      </div>

      <div>
        {PROGRESS_STEPS.map((step, index) => {
          const isActive = index === currentIndex && !isComplete && !isFailed;
          const isDone = index < currentIndex || isComplete;
          return (
            <div
              key={step.key}
              className="flex items-center justify-between gap-3 border-b border-studio-hairline py-2.5 last:border-b-0"
            >
              <span
                className={cn(
                  'text-sm',
                  isDone && 'text-foreground',
                  isActive && 'font-medium text-foreground',
                  !isDone && !isActive && 'text-muted-foreground/60'
                )}
              >
                {step.label}
              </span>
              {isDone ? (
                <StateChip tone="good">Done</StateChip>
              ) : isActive ? (
                <StateChip tone="attention">Now</StateChip>
              ) : (
                <StateChip>Next</StateChip>
              )}
            </div>
          );
        })}
      </div>

      {isFailed && error && <p className="mt-4 text-xs text-studio-stale">{error}</p>}

      {(isComplete || isFailed) && (
        <div className="mt-5 flex gap-2">
          {isComplete && documentUrl && (
            <PillButton onClick={onDownload}>Download the report</PillButton>
          )}
          <PillButton variant="outline" onClick={onReset}>
            Create another
          </PillButton>
        </div>
      )}
    </Panel>
  );
}
