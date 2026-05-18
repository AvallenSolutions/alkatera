'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CertificationReadiness } from '@/lib/certifications/scoring';

interface ReadinessBannerProps {
  readiness: CertificationReadiness;
  onPrepareAudit?: () => void;
  onViewBlocking?: () => void;
}

export function ReadinessBanner({
  readiness,
  onPrepareAudit,
  onViewBlocking,
}: ReadinessBannerProps) {
  if (!readiness.hasCertification) return null;

  if (readiness.isReadyToSubmit) {
    return (
      <div
        className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800 dark:bg-emerald-950/40"
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                You have met all Year 0 requirements. You are ready to submit
                for audit.
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Prepare your audit package to compile evidence for your auditor.
              </p>
            </div>
          </div>
          {onPrepareAudit && (
            <Button
              onClick={onPrepareAudit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              Prepare Audit Package
            </Button>
          )}
        </div>
      </div>
    );
  }

  const count = readiness.blockingRequirements.length;
  const riskToolOutstanding = !readiness.riskToolComplete;

  return (
    <div
      className="w-full rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950/40"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {count} requirement{count === 1 ? '' : 's'} still need
              {count === 1 ? 's' : ''} to be met before you can submit.
            </p>
            {riskToolOutstanding && (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                The Risk Tool has not been completed yet. It is required before
                submission.
              </p>
            )}
          </div>
        </div>
        {onViewBlocking && (
          <Button
            variant="outline"
            onClick={onViewBlocking}
            className="border-amber-400 text-amber-900 dark:text-amber-200 shrink-0"
          >
            View blocking requirements
          </Button>
        )}
      </div>
    </div>
  );
}
