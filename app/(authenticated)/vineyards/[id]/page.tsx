'use client';

/**
 * One vineyard, in the studio grammar: a statement header with the
 * hectares standing right, a quiet mono back-link, and the old tab bar
 * re-cut as mono-eyebrow sections down one paper (overview, trends,
 * history, map). The vintage selector stays as the one working control.
 * Queries, questionnaire launches and handlers are unchanged.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PageLoader } from '@/components/ui/page-loader';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { useVineyardDashboard } from '@/hooks/data/useVineyardDashboard';
import { VineyardImpactOverview } from '@/components/vineyards/VineyardImpactOverview';
import { VineyardTrendCharts } from '@/components/vineyards/VineyardTrendCharts';
import { VintageHistoryTable } from '@/components/vineyards/VintageHistoryTable';
import { VineyardGrowingQuestionnaire } from '@/components/vineyards/VineyardGrowingQuestionnaire';
import { LandUnitMap } from '@/components/geo/LandUnitMap';
import type { VineyardClimateZone, VineyardCertification } from '@/lib/types/viticulture';

const CERTIFICATION_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  organic: 'Organic',
  biodynamic: 'Biodynamic',
  leaf: 'LEAF Marque',
};

const CLIMATE_LABELS: Record<string, string> = {
  wet: 'Wet',
  dry: 'Dry',
  temperate: 'Temperate',
};

/** Quiet mono back-link to the list page. */
function BackLink() {
  return (
    <Link
      href="/vineyards/"
      className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      &larr; The vineyards
    </Link>
  );
}

/** A quiet section: mono eyebrow over a hairline rule, then the work. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
      </div>
      {children}
    </section>
  );
}

export default function VineyardDetailPage() {
  const params = useParams();
  const vineyardId = params.id as string;
  const { vineyard, profiles, vintageImpacts, isLoading, error, refetch } = useVineyardDashboard(vineyardId);

  // Year selector: default to most recent vintage
  const availableYears = useMemo(
    () => vintageImpacts.map((v) => v.vintage_year).sort((a, b) => b - a),
    [vintageImpacts]
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Resolve the effective year (most recent by default)
  const effectiveYear = selectedYear ?? (availableYears.length > 0 ? availableYears[0] : null);

  // Find the selected vintage impact and profile
  const selectedImpact = effectiveYear
    ? vintageImpacts.find((v) => v.vintage_year === effectiveYear) ?? null
    : null;
  const selectedProfile = effectiveYear
    ? profiles.find((p) => p.vintage_year === effectiveYear) ?? null
    : null;

  // Questionnaire state
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireYear, setQuestionnaireYear] = useState<number | undefined>(undefined);
  const [copyFromData, setCopyFromData] = useState<Record<string, any> | undefined>(undefined);

  if (isLoading) {
    return <PageLoader message="Loading vineyard..." />;
  }

  if (error || !vineyard) {
    return (
      <FeatureGate feature="viticulture">
        <div className="space-y-4">
          <BackLink />
          <p className="text-sm text-muted-foreground">{error || 'Vineyard not found.'}</p>
        </div>
      </FeatureGate>
    );
  }

  // Questionnaire handlers
  function handleEditVintage(year: number) {
    const profile = profiles.find((p) => p.vintage_year === year);
    setQuestionnaireYear(year);
    setCopyFromData(undefined);
    setShowQuestionnaire(true);
  }

  function handleAddVintage() {
    const currentYear = new Date().getFullYear();
    const mostRecentYear = availableYears.length > 0 ? availableYears[0] : currentYear - 1;
    const nextYear = mostRecentYear < currentYear ? mostRecentYear + 1 : currentYear;

    // Copy from most recent profile if available
    const mostRecentProfile = profiles.find((p) => p.vintage_year === mostRecentYear);
    setQuestionnaireYear(nextYear);
    setCopyFromData(mostRecentProfile ? { ...mostRecentProfile } : undefined);
    setShowQuestionnaire(true);
  }

  // Show questionnaire full-width when open
  if (showQuestionnaire) {
    const editProfile = questionnaireYear
      ? profiles.find((p) => p.vintage_year === questionnaireYear) ?? null
      : null;

    return (
      <FeatureGate feature="viticulture">
        <div className="space-y-8">
          <div className="min-w-0">
            <Statement
              eyebrow={`THE WORKBENCH · VINTAGE ${questionnaireYear}`}
              headline={vineyard.name.endsWith('.') ? vineyard.name : `${vineyard.name}.`}
            />
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Enter growing data for the {questionnaireYear} vintage.
            </p>
          </div>
          <VineyardGrowingQuestionnaire
            vineyardId={vineyard.id}
            vineyardName={vineyard.name}
            vineyardHectares={vineyard.hectares}
            vineyardAnnualYieldTonnes={vineyard.annual_yield_tonnes}
            vineyardClimateZone={vineyard.climate_zone as VineyardClimateZone}
            vineyardCertification={vineyard.certification as VineyardCertification}
            vineyardCountryCode={vineyard.location_country_code}
            vineyardPreviousLandUse={vineyard.previous_land_use_type}
            vineyardLandConversionYear={vineyard.land_conversion_year}
            vineyardPlantingYear={vineyard.vine_planting_year}
            existingProfile={editProfile}
            vintageYear={questionnaireYear}
            copyFromData={!editProfile ? copyFromData : undefined}
            onComplete={() => {
              setShowQuestionnaire(false);
              refetch();
            }}
            onCancel={() => setShowQuestionnaire(false)}
          />
        </div>
      </FeatureGate>
    );
  }

  const location = [vineyard.address_city, vineyard.address_country].filter(Boolean).join(', ');
  const factLine = [
    CERTIFICATION_LABELS[vineyard.certification] || vineyard.certification,
    CLIMATE_LABELS[vineyard.climate_zone] || vineyard.climate_zone,
    location,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FeatureGate feature="viticulture">
      <div className="space-y-10">
        <div className="min-w-0 space-y-4">
          <BackLink />

          <Statement
            eyebrow="THE WORKBENCH · VINEYARD"
            headline={vineyard.name.endsWith('.') ? vineyard.name : `${vineyard.name}.`}
          >
            <BigNumber size="display" value={vineyard.hectares} label="Hectares" />
            {availableYears.length > 0 && (
              <div>
                <Eyebrow tone="dim" className="mb-2">
                  Vintage
                </Eyebrow>
                <Select
                  value={String(effectiveYear)}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Statement>

          <p className="max-w-xl text-sm text-muted-foreground">{factLine}</p>
        </div>

        <Section label={effectiveYear ? `VINTAGE ${effectiveYear} · OVERVIEW` : 'OVERVIEW'}>
          <VineyardImpactOverview
            impacts={selectedImpact?.impacts ?? null}
            profile={selectedProfile ?? null}
          />
        </Section>

        <Section label="TRENDS">
          <VineyardTrendCharts vintageImpacts={vintageImpacts} />
        </Section>

        <Section label="VINTAGE HISTORY">
          <VintageHistoryTable
            vintageImpacts={vintageImpacts}
            vineyardId={vineyard.id}
            onEditVintage={handleEditVintage}
            onAddVintage={handleAddVintage}
          />
        </Section>

        <Section label="MAP & LOCATION">
          <LandUnitMap type="vineyard" id={vineyard.id} />
        </Section>
      </div>
    </FeatureGate>
  );
}
