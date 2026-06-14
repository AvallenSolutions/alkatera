'use client';

/**
 * For brands not yet submission-ready (especially first-timers): a plain
 * estimate of how far they are and roughly how long to submission-ready, so
 * starting doesn't feel like an open-ended commitment.
 */

import { Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CertificationReadiness } from '@/lib/certifications/scoring';
import { estimateEffort } from '@/lib/certifications/effort-estimate';

export function EligibilityEstimateCard({ readiness }: { readiness: CertificationReadiness }) {
  const e = estimateEffort(readiness);
  if (e.readyToSubmit) return null;

  return (
    <Card className="border-[#ccff00]/30">
      <CardContent className="flex items-start gap-3 p-5">
        <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-[#ccff00]" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Your route to certification</h3>
          <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{e.confirmCount}</span>{' '}
              <span className="text-muted-foreground">to confirm</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums text-foreground">{e.effortfulCount}</span>{' '}
              <span className="text-muted-foreground">need fresh evidence</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums text-foreground">{e.minWeeks}–{e.maxWeeks}</span>{' '}
              <span className="text-muted-foreground">weeks (estimate)</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
