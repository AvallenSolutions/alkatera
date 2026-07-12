'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { PillButton } from '@/components/studio';
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
        className="w-full rounded-[6px] border border-studio-hairline border-l-2 border-l-studio-good bg-studio-cream px-5 py-4"
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-studio-good" />
            <div>
              <p className="font-display font-semibold text-foreground">
                You have met all Year 0 requirements. You are ready to submit
                for audit.
              </p>
              <p className="text-sm text-muted-foreground">
                Prepare your audit package to compile evidence for your auditor.
              </p>
            </div>
          </div>
          {onPrepareAudit && (
            <PillButton variant="room" onClick={onPrepareAudit} className="shrink-0">
              Prepare Audit Package
            </PillButton>
          )}
        </div>
      </div>
    );
  }

  const count = readiness.blockingRequirements.length;
  const riskToolOutstanding = !readiness.riskToolComplete;

  return (
    <div
      className="w-full rounded-[6px] border border-studio-hairline border-l-2 border-l-studio-attention bg-studio-cream px-5 py-4"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 shrink-0 text-studio-attention" />
          <div>
            <p className="font-display font-semibold text-foreground">
              {count} requirement{count === 1 ? '' : 's'} still need
              {count === 1 ? 's' : ''} to be met before you can submit.
            </p>
            {riskToolOutstanding && (
              <p className="text-sm text-muted-foreground">
                The Risk Tool has not been completed yet. It is required before
                submission.
              </p>
            )}
          </div>
        </div>
        {onViewBlocking && (
          <PillButton variant="outline" onClick={onViewBlocking} className="shrink-0">
            View blocking requirements
          </PillButton>
        )}
      </div>
    </div>
  );
}
