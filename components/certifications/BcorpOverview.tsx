'use client';

/**
 * B Corp "Overview" tab — the at-a-glance view: where the brand stands and what
 * to do next, without the full requirement-by-requirement list (that lives in
 * the Requirements tab). Opening a next-step jumps to that requirement there.
 */

import type { CertificationReadiness } from '@/lib/certifications/scoring';
import { MomentumCard } from '@/components/certifications/MomentumCard';
import { EligibilityEstimateCard } from '@/components/certifications/EligibilityEstimateCard';
import { DeadlinePlanCard } from '@/components/certifications/DeadlinePlanCard';
import { RecertDeltaCard } from '@/components/certifications/RecertDeltaCard';
import { RoadmapCard } from '@/components/certifications/RoadmapCard';
import { PlatformHealthPanel } from '@/components/certifications/PlatformHealthPanel';
import { UpcomingRequirements } from '@/components/certifications/UpcomingRequirements';

export function BcorpOverview({
  readiness,
  certified,
  onOpenRequirement,
}: {
  readiness: CertificationReadiness;
  certified: boolean;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {certified && <UpcomingRequirements readiness={readiness} />}

      <MomentumCard />

      {readiness.certificationType === 'new' && <EligibilityEstimateCard readiness={readiness} />}

      {(readiness.certificationType === 'recertification' || readiness.recertPrepActive) && (
        <DeadlinePlanCard readiness={readiness} />
      )}

      {readiness.certificationType === 'recertification' && (
        <RecertDeltaCard readiness={readiness} onOpen={onOpenRequirement} />
      )}

      <RoadmapCard readiness={readiness} onOpen={onOpenRequirement} />

      {readiness.platformHealth && <PlatformHealthPanel entries={readiness.platformHealth} />}
    </div>
  );
}
