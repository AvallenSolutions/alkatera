"use client";

import type { LCAData, SubscriptionTier, TierVisibility } from '@/lib/types/passport';
import { TIER_VISIBILITY } from '@/lib/types/passport';
import {
  CoverSection,
  ExecutiveSummarySection,
  MethodologySection,
  ResultsSection,
  ConclusionSection,
} from './sections';

interface LCAPassportTemplateProps {
  data: LCAData;
  tier: SubscriptionTier;
  onDownloadPDF?: () => void;
  onShare?: () => void;
}

export default function LCAPassportTemplate({
  data,
  tier,
  onDownloadPDF,
  onShare,
}: LCAPassportTemplateProps) {
  const visibility: TierVisibility = TIER_VISIBILITY[tier];

  return (
    <div className="passport-template w-full min-h-screen bg-stone-50 text-stone-900 font-sans">
      <CoverSection meta={data.meta} />

      {visibility.showExecutiveSummary && (
        <ExecutiveSummarySection
          data={data.executiveSummary}
          visibility={visibility}
        />
      )}

      {visibility.showMethodology && (
        <MethodologySection data={data.methodology} visibility={visibility} />
      )}

      <ResultsSection data={data.results} visibility={visibility} />

      <ConclusionSection
        data={data.conclusion}
        meta={data.meta}
        visibility={visibility}
        onDownloadPDF={onDownloadPDF}
        onShare={onShare}
      />
    </div>
  );
}
