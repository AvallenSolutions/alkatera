'use client';

import { useCallback, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { PosterBlock } from '@/components/studio/poster-block';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/lib/organizationContext';
import { usePersistedYear, useLatestDataYear } from '@/hooks/usePersistedYear';
import { useAxisData } from '@/hooks/data/useAxisData';
import type { VitalityComposite } from '@/lib/vitality/composite';
import type { ClimateScoreBreakdown } from '@/lib/vitality/environmental';
import { AXES, axisBreakdown, isAxisSlug, type AxisSlug } from './axis-config';
import { ClimateProgressTable, ScoreBuildUp } from './climate-sections';
import { PillarMeasures, governanceMeasures, socialMeasures } from './pillar-sections';

// The deep-dives are recharts-heavy; they were lazy-loaded on /performance/ for
// the same reason and stay lazy here.
const CarbonDeepDive = dynamic(() => import('@/components/vitality/CarbonDeepDive').then((m) => m.CarbonDeepDive), { ssr: false });
const WaterDeepDive = dynamic(() => import('@/components/vitality/WaterDeepDive').then((m) => m.WaterDeepDive), { ssr: false });
const WasteDeepDive = dynamic(() => import('@/components/vitality/WasteDeepDive').then((m) => m.WasteDeepDive), { ssr: false });
const NatureDeepDive = dynamic(() => import('@/components/vitality/NatureDeepDive').then((m) => m.NatureDeepDive), { ssr: false });

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

/**
 * /performance/[axis]/ — one axis, in full.
 *
 * The vitality page used to nest this four deep: pillar card, expand the card,
 * read the deep-dive, then "View full analysis" opened a sheet on top of the
 * page. The house rule is "recurse the rhythm, not the navigation". So an axis
 * is now somewhere you GO, the way you go from the cellar to a product, and
 * the sheets and the in-card expansion are gone.
 */
export default function AxisPage({ params }: { params: { axis: string } }) {
  const slug = params.axis;
  if (!isAxisSlug(slug)) notFound();
  return <Axis slug={slug} />;
}

function Axis({ slug }: { slug: AxisSlug }) {
  const axis = AXES[slug];
  const { currentOrganization } = useOrganization();
  const latestDataYear = useLatestDataYear(currentOrganization?.id);
  const { selectedYear } = usePersistedYear(AVAILABLE_YEARS, latestDataYear);
  const data = useAxisData(selectedYear);

  const [composite, setComposite] = useState<VitalityComposite | null>(null);
  const orgId = currentOrganization?.id;

  const loadComposite = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch('/api/vitality/composite', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.composite) setComposite(json.composite);
    } catch {
      // Keep the page usable without the score; the breakdown below is the
      // substance and does not depend on it.
    }
  }, [orgId]);

  useEffect(() => {
    void loadComposite();
  }, [loadComposite]);

  const isPillar = slug === 'social' || slug === 'governance';
  const breakdown = axisBreakdown(composite, slug) as any;
  const score = breakdown?.score ?? null;

  const headlineFigure = axisHeadline(slug, data);

  return (
    <div className="space-y-10 pb-24">
      <Statement
        eyebrow={axis.eyebrow}
        headline={
          score !== null
            ? `Your ${axis.noun} score is ${Math.round(score)}.`
            : `Your ${axis.noun} score is not in yet.`
        }
      />

      <PosterBlock
        eyebrow={axis.posterEyebrow}
        mark="quarter"
        headline={
          score !== null ? (
            <>
              {Math.round(score)}
              <span className="ml-2 font-mono text-sm font-normal uppercase tracking-[0.18em] opacity-80">
                / 100
              </span>
            </>
          ) : (
            'Not scored'
          )
        }
        note={headlineFigure ? headlineFigure.toUpperCase() : undefined}
      />

      {/* Climate is the only axis whose score is a blend of two measures and
          the only one with a year-against-year record, so it is the only one
          that can honestly show its own working. */}
      {slug === 'climate' ? (
        <>
          <ClimateProgressTable breakdown={breakdown as ClimateScoreBreakdown | null} />
          <ScoreBuildUp breakdown={breakdown as ClimateScoreBreakdown | null} />
        </>
      ) : null}

      {isPillar ? (
        <PillarMeasures
          measures={slug === 'social' ? socialMeasures(breakdown) : governanceMeasures(breakdown)}
          score={score}
        />
      ) : (
        <section>
          <Eyebrow className="mb-1">The full breakdown</Eyebrow>
          <p className="mb-4 text-sm text-muted-foreground">
            On the page, rather than inside a sheet on top of it.
          </p>
          {data.loading ? (
            <Skeleton className="h-64 rounded-[6px]" />
          ) : (
            <AxisBody slug={slug} data={data} year={selectedYear} />
          )}
        </section>
      )}

      <section className="border-t border-studio-hairline pt-5">
        <Eyebrow tone="dim" className="mb-2">
          Methodology
        </Eyebrow>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {axis.methodology} Figures on this page are in{' '}
          <span className="font-mono">{axis.preciseUnit}</span>.{' '}
          {breakdown && 'mode' in breakdown && breakdown.mode ? (
            <StateChip>{String(breakdown.mode).replace(/_/g, ' ')}</StateChip>
          ) : null}
        </p>
      </section>

      <div>
        <PillButton size="sm" variant="ghost" href="/performance/">
          Back to the vitality
        </PillButton>
      </div>
    </div>
  );
}

/** The one figure worth putting on the poster, per axis. */
function axisHeadline(slug: AxisSlug, data: ReturnType<typeof useAxisData>): string | null {
  const round = (n: number) => Math.round(n).toLocaleString('en-GB');
  switch (slug) {
    case 'climate':
      return data.totalCO2 > 0 ? `${round(data.totalCO2 / 1000)} t CO2e this year` : null;
    case 'water':
      return data.waterScarcityImpact > 0 ? `${round(data.waterScarcityImpact)} m³ world eq` : null;
    case 'circularity':
      return data.circularityRate > 0 ? `${data.circularityRate.toFixed(0)}% diverted` : null;
    case 'nature':
      return data.landUse > 0 ? `${round(data.landUse)} m² a year` : null;
    // The pillar pages are made of sub-scores, not of one measured quantity.
    case 'social':
    case 'governance':
      return null;
  }
}

function AxisBody({
  slug,
  data,
  year,
}: {
  slug: AxisSlug;
  data: ReturnType<typeof useAxisData>;
  year: number;
}) {
  switch (slug) {
    case 'climate':
      return (
        <CarbonDeepDive
          scopeBreakdown={data.scopeBreakdown}
          totalCO2={data.totalCO2}
          productLcaTotalCO2={data.productLcaTotalCO2}
          materialBreakdown={data.materialBreakdown}
          ghgBreakdown={data.ghgBreakdown}
          lifecycleStageBreakdown={data.lifecycleStageBreakdown}
          facilityEmissionsBreakdown={data.facilityEmissionsBreakdown}
          scope3Categories={data.scope3Categories}
          scope3ProductDetails={data.scope3ProductDetails}
          scope3TravelDetails={data.scope3TravelDetails}
          scope3LogisticsDetails={data.scope3LogisticsDetails}
          scope3WasteDetails={data.scope3WasteDetails}
          scope3Total={data.scope3Total}
          year={year}
          isLoadingScope3={data.footprintLoading}
        />
      );
    case 'water':
      return (
        <WaterDeepDive
          facilityWaterRisks={data.facilityWaterRisks}
          facilitySummaries={data.waterFacilitySummaries}
          companyOverview={data.waterCompanyOverview}
          sourceBreakdown={data.waterSourceBreakdown}
          waterTimeSeries={data.waterTimeSeries}
          loading={data.loading || data.waterLoading}
          productLcaWaterConsumption={data.waterConsumption}
          productLcaWaterScarcity={data.waterScarcityImpact}
        />
      );
    case 'circularity':
      return <WasteDeepDive wasteMetrics={data.wasteMetrics} loading={data.wasteLoading} />;
    case 'nature':
      return <NatureDeepDive natureMetrics={data.natureMetrics} />;
    default:
      return null;
  }
}
