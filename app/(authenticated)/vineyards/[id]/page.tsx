'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Leaf, MapPin, Thermometer } from 'lucide-react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PageLoader } from '@/components/ui/page-loader';
import { useVineyardDashboard } from '@/hooks/data/useVineyardDashboard';
import { VineyardImpactOverview } from '@/components/vineyards/VineyardImpactOverview';
import { VineyardTrendCharts } from '@/components/vineyards/VineyardTrendCharts';
import { VintageHistoryTable } from '@/components/vineyards/VintageHistoryTable';
import { VineyardGrowingQuestionnaire } from '@/components/vineyards/VineyardGrowingQuestionnaire';
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

export default function VineyardDetailPage() {
  const params = useParams();
  const router = useRouter();
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
      <FeatureGate feature="viticulture_beta">
        <div className="space-y-4">
          <Link href="/vineyards/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to vineyards
          </Link>
          <p className="text-muted-foreground">{error || 'Vineyard not found.'}</p>
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
      <FeatureGate feature="viticulture_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {editProfile ? `Edit Vintage ${questionnaireYear}` : `Add Vintage ${questionnaireYear}`}: {vineyard.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              Enter growing data for the {questionnaireYear} vintage.
            </p>
          </div>
          <VineyardGrowingQuestionnaire
            vineyardId={vineyard.id}
            vineyardName={vineyard.name}
            vineyardHectares={vineyard.hectares}
            vineyardClimateZone={vineyard.climate_zone as VineyardClimateZone}
            vineyardCertification={vineyard.certification as VineyardCertification}
            vineyardCountryCode={vineyard.location_country_code}
            vineyardPreviousLandUse={vineyard.previous_land_use_type}
            vineyardLandConversionYear={vineyard.land_conversion_year}
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

  return (
    <FeatureGate feature="viticulture_beta">
      <div className="space-y-6">
        {/* Back button */}
        <Link
          href="/vineyards/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to vineyards
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-[#ccff00]/10 p-3">
              <Leaf className="h-6 w-6 text-[#ccff00]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{vineyard.name}</h1>
              {vineyard.address_city && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[vineyard.address_city, vineyard.address_country].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline">
                  {CERTIFICATION_LABELS[vineyard.certification] || vineyard.certification}
                </Badge>
                <Badge variant="secondary">{vineyard.hectares} ha</Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  {CLIMATE_LABELS[vineyard.climate_zone] || vineyard.climate_zone}
                </Badge>
              </div>
            </div>
          </div>

          {/* Year selector */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Vintage:</span>
              <Select
                value={String(effectiveYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="history">Vintage History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <VineyardImpactOverview
              impacts={selectedImpact?.impacts ?? null}
              profile={selectedProfile ?? null}
            />
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <VineyardTrendCharts vintageImpacts={vintageImpacts} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <VintageHistoryTable
              vintageImpacts={vintageImpacts}
              vineyardId={vineyard.id}
              onEditVintage={handleEditVintage}
              onAddVintage={handleAddVintage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
