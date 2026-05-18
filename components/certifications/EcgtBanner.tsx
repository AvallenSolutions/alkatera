'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import { getEcgtStatus, ECGT_GUIDANCE_URL } from '@/lib/certifications/ecgt';

interface EcgtBannerProps {
  ecgtApplicable: boolean;
  isReadyToSubmit: boolean;
}

export function EcgtBanner({
  ecgtApplicable,
  isReadyToSubmit,
}: EcgtBannerProps) {
  if (!ecgtApplicable) return null;

  const status = getEcgtStatus(isReadyToSubmit);
  const isRed = status.severity === 'red';

  const containerClass = isRed
    ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
    : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300';

  const daysLabel = status.deadlinePassed
    ? `${Math.abs(status.daysRemaining)} days past the deadline`
    : `${status.daysRemaining} days remaining`;

  return (
    <div
      className={`w-full rounded-lg border px-4 py-3 ${containerClass}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">ECGT Compliance Required</p>
          <p className="text-sm">
            Submit for audit by {status.deadlineLabel} to use the B Corp logo
            after {status.enforcementLabel}. {daysLabel}.
          </p>
          {status.atRisk && (
            <p className="text-sm font-medium">
              At your current pace, you are unlikely to complete recertification
              before the ECGT deadline. Prioritise the requirements below.
            </p>
          )}
          <a
            href={ECGT_GUIDANCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2"
          >
            Read B Lab&apos;s ECGT guidance
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
