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

  const accentBorder = isRed ? 'border-l-studio-stale' : 'border-l-studio-attention';
  const iconTone = isRed ? 'text-studio-stale' : 'text-studio-attention';

  const daysLabel = status.deadlinePassed
    ? `${Math.abs(status.daysRemaining)} days past the deadline`
    : `${status.daysRemaining} days remaining`;

  return (
    <div
      className={`w-full rounded-[6px] border border-studio-hairline border-l-2 bg-studio-cream px-4 py-3 ${accentBorder}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${iconTone}`} />
        <div className="space-y-1">
          <p className="font-display font-semibold text-foreground">ECGT Compliance Required</p>
          <p className="text-sm text-muted-foreground">
            Submit for audit by {status.deadlineLabel} to use the B Corp logo
            after {status.enforcementLabel}. {daysLabel}.
          </p>
          {status.atRisk && (
            <p className="text-sm font-medium text-foreground">
              At your current pace, you are unlikely to complete recertification
              before the ECGT deadline. Prioritise the requirements below.
            </p>
          )}
          <a
            href={ECGT_GUIDANCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-room-accent underline underline-offset-2"
          >
            Read B Lab&apos;s ECGT guidance
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
