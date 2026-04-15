'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Wheat,
  ChevronRight,
  Plus,
  Copy,
  Edit2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { ArableGrowingQuestionnaire } from '@/components/arable-fields/ArableGrowingQuestionnaire';
import { ArableImpactOverview } from '@/components/arable-fields/ArableImpactOverview';
import { ArableTrendCharts } from '@/components/arable-fields/ArableTrendCharts';
import { HarvestHistoryTable } from '@/components/arable-fields/HarvestHistoryTable';
import { AddArableFieldDialog } from '@/components/arable-fields/AddArableFieldDialog';
import { calculateArableImpacts } from '@/lib/arable-calculator';
import type {
  ArableField,
  ArableGrowingProfile,
  ArableImpactResult,
  ArableHarvestImpactSummary,
  ArableCalculatorInput,
} from '@/lib/types/arable';

export default function ArableFieldDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const fieldId = params.id as string;

  const [field, setField] = useState<ArableField | null>(null);
  const [profiles, setProfiles] = useState<ArableGrowingProfile[]>([]);
  const [harvestImpacts, setHarvestImpacts] = useState<ArableHarvestImpactSummary[]>([]);
  const [latestImpacts, setLatestImpacts] = useState<ArableImpactResult | null>(null);
  const [latestProfile, setLatestProfile] = useState<ArableGrowingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Questionnaire state
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireProfile, setQuestionnaireProfile] = useState<ArableGrowingProfile | null>(null);
  const [questionnaireYear, setQuestionnaireYear] = useState<number | undefined>(undefined);
  const [copyFromData, setCopyFromData] = useState<Record<string, any> | undefined>(undefined);

  const loadField = useCallback(async () => {
    try {
      const res = await fetch(`/api/arable-fields/${fieldId}`);
      if (!res.ok) throw new Error('Failed to load arable field');
      const { data } = await res.json();
      setField(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [fieldId]);

  const loadProfiles = useCallback(async () => {
    if (!field) return;
    try {
      const res = await fetch(`/api/arable-fields/${fieldId}/growing-profile`);
      if (!res.ok) throw new Error('Failed to load growing profiles');
      const { data } = await res.json();

      const profileList: ArableGrowingProfile[] = Array.isArray(data)
        ? data
        : data
          ? [data]
          : [];

      // Sort by harvest year descending
      profileList.sort((a, b) => b.harvest_year - a.harvest_year);
      setProfiles(profileList);

      // Calculate impacts for each profile
      const impacts: ArableHarvestImpactSummary[] = profileList.map((profile) => {
        const input: ArableCalculatorInput = {
          crop_type: field.crop_type,
          climate_zone: field.climate_zone,
          certification: field.certification,
          location_country_code: field.location_country_code,
          area_ha: profile.area_ha,
          soil_management: profile.soil_management,
          straw_management: profile.straw_management,
          straw_yield_tonnes_per_ha: profile.straw_yield_tonnes_per_ha,
          lime_applied_kg_per_ha: profile.lime_applied_kg_per_ha,
          lime_type: profile.lime_type,
          fertiliser_type: profile.fertiliser_type,
          fertiliser_quantity_kg: profile.fertiliser_quantity_kg,
          fertiliser_n_content_percent: profile.fertiliser_n_content_percent,
          uses_pesticides: profile.uses_pesticides,
          pesticide_applications_per_year: profile.pesticide_applications_per_year,
          pesticide_type: profile.pesticide_type,
          uses_herbicides: profile.uses_herbicides,
          herbicide_applications_per_year: profile.herbicide_applications_per_year,
          herbicide_type: profile.herbicide_type,
          uses_growth_regulators: profile.uses_growth_regulators,
          growth_regulator_applications: profile.growth_regulator_applications,
          seed_rate_kg_per_ha: profile.seed_rate_kg_per_ha,
          diesel_litres_per_year: profile.diesel_litres_per_year,
          petrol_litres_per_year: profile.petrol_litres_per_year,
          grain_drying_fuel: profile.grain_drying_fuel,
          grain_drying_energy_kwh_per_tonne: profile.grain_drying_energy_kwh_per_tonne,
          is_irrigated: profile.is_irrigated,
          water_m3_per_ha: profile.water_m3_per_ha,
          irrigation_energy_source: profile.irrigation_energy_source,
          grain_yield_tonnes: profile.grain_yield_tonnes,
          grain_moisture_percent: profile.grain_moisture_percent,
          soil_carbon_override_kg_co2e_per_ha: profile.soil_carbon_override_kg_co2e_per_ha,
          transport_distance_km: profile.transport_distance_km,
          transport_mode: profile.transport_mode,
          previous_land_use_type: field.previous_land_use_type,
          land_conversion_year: field.land_conversion_year,
          harvest_year: profile.harvest_year,
        };

        const result = calculateArableImpacts(input);
        return {
          harvest_year: profile.harvest_year,
          profile_id: profile.id,
          is_complete: !profile.is_draft,
          is_draft: profile.is_draft,
          impacts: result,
          emissions_per_ha: result.total_emissions / profile.area_ha,
          water_per_ha: result.water_m3 / profile.area_ha,
          removals_per_ha: result.total_removals / profile.area_ha,
          yield_tonnes_per_ha: profile.grain_yield_tonnes / profile.area_ha,
        };
      });

      setHarvestImpacts(impacts);

      // Set latest profile and its impacts
      if (profileList.length > 0) {
        setLatestProfile(profileList[0]);
        setLatestImpacts(impacts[0]?.impacts ?? null);
      } else {
        setLatestProfile(null);
        setLatestImpacts(null);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [field, fieldId]);

  useEffect(() => {
    if (currentOrganization?.id && fieldId) {
      loadField();
    }
  }, [currentOrganization?.id, fieldId, loadField]);

  useEffect(() => {
    if (field) {
      loadProfiles().finally(() => setIsLoading(false));
    }
  }, [field, loadProfiles]);

  function handleAddHarvest() {
    const currentYear = new Date().getFullYear();
    const existingYears = profiles.map((p) => p.harvest_year);
    // Default to current year, or next available
    let newYear = currentYear;
    while (existingYears.includes(newYear)) {
      newYear++;
    }
    setQuestionnaireProfile(null);
    setQuestionnaireYear(newYear);
    setCopyFromData(undefined);
    setShowQuestionnaire(true);
  }

  function handleCopyFromPrevious() {
    if (profiles.length === 0) return;
    const latest = profiles[0]; // Already sorted descending
    const newYear = latest.harvest_year + 1;

    // Copy data from the latest profile
    const { id, created_at, updated_at, harvest_year, ...copyData } = latest;
    setQuestionnaireProfile(null);
    setQuestionnaireYear(newYear);
    setCopyFromData(copyData as Record<string, any>);
    setShowQuestionnaire(true);
  }

  function handleEditHarvest(year: number) {
    const profile = profiles.find((p) => p.harvest_year === year);
    if (profile) {
      setQuestionnaireProfile(profile);
      setQuestionnaireYear(profile.harvest_year);
      setCopyFromData(undefined);
      setShowQuestionnaire(true);
    }
  }

  function handleQuestionnaireComplete(profile: ArableGrowingProfile) {
    setShowQuestionnaire(false);
    setQuestionnaireProfile(null);
    setQuestionnaireYear(undefined);
    setCopyFromData(undefined);
    toast.success('Growing profile saved');
    loadProfiles();
  }

  if (isLoading) {
    return <PageLoader message="Loading arable field..." />;
  }

  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Arable field not found.</p>
        <Button variant="outline" asChild>
          <Link href="/arable-fields">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Arable Fields
          </Link>
        </Button>
      </div>
    );
  }

  if (showQuestionnaire) {
    return (
      <FeatureGate feature="arable_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {questionnaireProfile
                ? `Edit Growing Profile: ${field.name} (${questionnaireYear})`
                : `Add Growing Profile: ${field.name} (${questionnaireYear})`}
            </h1>
            <p className="text-muted-foreground mt-2">
              Tell us about your growing practices so we can calculate the environmental impact of your grain growing.
            </p>
          </div>

          <ArableGrowingQuestionnaire
            fieldId={field.id}
            fieldName={field.name}
            fieldHectares={field.hectares}
            cropType={field.crop_type}
            fieldClimateZone={field.climate_zone as 'wet' | 'dry' | 'temperate'}
            fieldCertification={field.certification}
            fieldCountryCode={field.location_country_code}
            fieldPreviousLandUse={field.previous_land_use_type}
            fieldLandConversionYear={field.land_conversion_year}
            existingProfile={questionnaireProfile || null}
            harvestYear={questionnaireYear}
            copyFromData={copyFromData}
            onComplete={handleQuestionnaireComplete}
            onCancel={() => {
              setShowQuestionnaire(false);
              setQuestionnaireProfile(null);
              setQuestionnaireYear(undefined);
              setCopyFromData(undefined);
            }}
          />
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="arable_beta">
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/arable-fields" className="hover:text-foreground transition-colors">
            Arable Fields
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{field.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#ccff00]/10 p-2.5">
              <Wheat className="h-6 w-6 text-[#ccff00]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{field.name}</h1>
              <p className="text-muted-foreground mt-1">
                {field.hectares} ha &middot; {field.crop_type.charAt(0).toUpperCase() + field.crop_type.slice(1)}
                {field.address_city && ` &middot; ${field.address_city}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <Edit2 className="h-4 w-4" />
              Edit Field
            </Button>
            {profiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleCopyFromPrevious}
              >
                <Copy className="h-4 w-4" />
                Copy from previous year
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
              onClick={handleAddHarvest}
            >
              <Plus className="h-4 w-4" />
              Add harvest year
            </Button>
          </div>
        </div>

        <Separator />

        {/* Impact Overview */}
        {latestProfile && latestImpacts ? (
          <>
            <ArableImpactOverview
              impacts={latestImpacts}
              profile={latestProfile}
            />

            {/* Harvest History Table */}
            {harvestImpacts.length > 0 && (
              <HarvestHistoryTable
                harvestImpacts={harvestImpacts}
                fieldId={field.id}
                onEditHarvest={handleEditHarvest}
                onAddHarvest={handleAddHarvest}
              />
            )}

            {/* Trend Charts (only show with 2+ harvests) */}
            {harvestImpacts.length >= 2 && (
              <ArableTrendCharts harvestImpacts={harvestImpacts} />
            )}
          </>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-[#ccff00]/20 flex items-center justify-center mb-4">
                <Wheat className="h-7 w-7 text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Growing Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Add a harvest year to start tracking the environmental impact of your grain growing operations.
              </p>
              <Button
                onClick={handleAddHarvest}
                size="lg"
                className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
              >
                <Plus className="h-5 w-5" />
                Add harvest year
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Field Dialog */}
        <AddArableFieldDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            loadField();
          }}
          editField={field}
        />
      </div>
    </FeatureGate>
  );
}
