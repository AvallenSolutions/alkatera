"use client";

import type { LCAData, SubscriptionTier, TierVisibility } from '@/lib/types/passport';
import { TIER_VISIBILITY } from '@/lib/types/passport';
import {
  CoverSection,
  ProductIdentitySection,
  ExecutiveSummarySection,
  MethodologySection,
  OriginsSection,
  PackagingSection,
  ResultsSection,
  ConclusionSection,
} from './sections';

interface LCAPassportTemplateProps {
  data: LCAData;
  tier: SubscriptionTier;
  hiddenSections?: string[];
  onDownloadPDF?: () => void;
  onShare?: () => void;
}

export default function LCAPassportTemplate({
  data,
  tier,
  hiddenSections = [],
  onDownloadPDF,
  onShare,
}: LCAPassportTemplateProps) {
  // Start with tier-based visibility, then apply user overrides
  const tierVisibility: TierVisibility = TIER_VISIBILITY[tier];
  const visibility: TierVisibility = {
    ...tierVisibility,
    // If user has hidden origins, override regardless of tier
    showOrigins: tierVisibility.showOrigins && !hiddenSections.includes('origins'),
    // If user has hidden packaging, override both summary and detail
    showPackagingSummary: tierVisibility.showPackagingSummary && !hiddenSections.includes('packaging'),
    showPackagingDetail: tierVisibility.showPackagingDetail && !hiddenSections.includes('packaging'),
  };

  // Compute dynamic section numbers based on which numbered sections are visible
  let sectionCounter = 0;
  const execSummaryNum = visibility.showExecutiveSummary ? String(++sectionCounter).padStart(2, '0') : '';
  const methodologyNum = visibility.showMethodology ? String(++sectionCounter).padStart(2, '0') : '';
  const originsNum = visibility.showOrigins && data.origins ? String(++sectionCounter).padStart(2, '0') : '';
  const packagingNum = (visibility.showPackagingSummary || visibility.showPackagingDetail) && data.packaging
    ? String(++sectionCounter).padStart(2, '0') : '';
  const resultsNum = String(++sectionCounter).padStart(2, '0');

  return (
    <div className="passport-template w-full min-h-screen bg-stone-50 text-stone-900 font-sans">
      <CoverSection meta={data.meta} />

      <ProductIdentitySection
        data={data.productIdentity}
        visibility={visibility}
      />

      {visibility.showExecutiveSummary && (
        <ExecutiveSummarySection
          data={data.executiveSummary}
          visibility={visibility}
        />
      )}

      {visibility.showMethodology && (
        <MethodologySection data={data.methodology} visibility={visibility} />
      )}

      {visibility.showOrigins && data.origins && (
        <OriginsSection data={data.origins} sectionNumber={originsNum} />
      )}

      {(visibility.showPackagingSummary || visibility.showPackagingDetail) && data.packaging && (
        <PackagingSection
          data={data.packaging}
          visibility={visibility}
          sectionNumber={packagingNum}
        />
      )}

      <ResultsSection
        data={data.results}
        visibility={visibility}
        sectionNumber={resultsNum}
        functionalUnit={data.meta.functionalUnit}
      />

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
