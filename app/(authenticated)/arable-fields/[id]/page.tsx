'use client';

/**
 * One arable field, in the studio grammar: a statement header with the
 * hectares standing right, pill actions (edit, copy from previous year,
 * add harvest), a quiet mono back-link, and the surface cut into
 * mono-eyebrow sections (map, latest harvest, history, trends). Data
 * loading, the impact calculator and the questionnaire launches are
 * unchanged.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { ArableGrowingQuestionnaire } from '@/components/arable-fields/ArableGrowingQuestionnaire';
import { ArableImpactOverview } from '@/components/arable-fields/ArableImpactOverview';
import { ArableTrendCharts } from '@/components/arable-fields/ArableTrendCharts';
import { HarvestHistoryTable } from '@/components/arable-fields/HarvestHistoryTable';
import { AddArableFieldDialog } from '@/components/arable-fields/AddArableFieldDialog';
import { LandUnitMap } from '@/components/geo/LandUnitMap';
import { calculateArableImpacts } from '@/lib/arable-calculator';
import type {
  ArableField,
  ArableGrowingProfile,
  ArableImpactResult,
  ArableHarvestImpactSummary,
  ArableCalculatorInput,
} from '@/lib/types/arable';

/** Quiet mono back-link to the list page. */
function BackLink() {
  return (
    <Link
      href="/arable-fields"
      className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      &larr; The arable fields
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

export default function ArableFieldDetailPage() {
  const params = useParams();
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
          soil_carbon_annual_change_kg_co2e_per_ha: profile.soil_carbon_annual_change_kg_co2e_per_ha,
          soil_carbon_change_methodology: profile.soil_carbon_change_methodology,
          soil_carbon_change_confidence: profile.soil_carbon_change_confidence,
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
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Arable field not found.</p>
      </div>
    );
  }

  if (showQuestionnaire) {
    return (
      <FeatureGate feature="arable_fields">
        <div className="space-y-8">
          <div className="min-w-0">
            <Statement
              eyebrow={`THE WORKBENCH · HARVEST ${questionnaireYear}`}
              headline={field.name.endsWith('.') ? field.name : `${field.name}.`}
            />
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Tell us about your growing practices so we can calculate the environmental impact of your grain growing.
            </p>
          </div>

          <ArableGrowingQuestionnaire
            fieldId={field.id}
            fieldName={field.name}
            fieldHectares={field.hectares}
            fieldAnnualYieldTonnes={field.annual_yield_tonnes}
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

  const factLine = [
    field.crop_type.charAt(0).toUpperCase() + field.crop_type.slice(1),
    field.address_city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FeatureGate feature="arable_fields">
      <div className="space-y-10">
        <div className="min-w-0 space-y-4">
          <BackLink />

          <Statement
            eyebrow="THE WORKBENCH · ARABLE FIELD"
            headline={field.name.endsWith('.') ? field.name : `${field.name}.`}
          >
            <BigNumber size="display" value={field.hectares} label="Hectares" />
            <div className="flex flex-wrap items-center gap-2">
              <PillButton variant="outline" onClick={() => setDialogOpen(true)}>
                Edit field
              </PillButton>
              {profiles.length > 0 && (
                <PillButton variant="outline" onClick={handleCopyFromPrevious}>
                  Copy from previous year
                </PillButton>
              )}
              <PillButton variant="room" onClick={handleAddHarvest}>
                Add harvest year
              </PillButton>
            </div>
          </Statement>

          <p className="max-w-xl text-sm text-muted-foreground">{factLine}</p>
        </div>

        <Section label="MAP & LOCATION">
          <LandUnitMap type="arable_field" id={field.id} />
        </Section>

        {latestProfile && latestImpacts ? (
          <>
            <Section label={`THE LATEST HARVEST · ${latestProfile.harvest_year}`}>
              <ArableImpactOverview impacts={latestImpacts} profile={latestProfile} />
            </Section>

            {harvestImpacts.length > 0 && (
              <Section label="HARVEST HISTORY">
                <HarvestHistoryTable
                  harvestImpacts={harvestImpacts}
                  fieldId={field.id}
                  onEditHarvest={handleEditHarvest}
                  onAddHarvest={handleAddHarvest}
                />
              </Section>
            )}

            {harvestImpacts.length >= 2 && (
              <Section label="TRENDS">
                <ArableTrendCharts harvestImpacts={harvestImpacts} />
              </Section>
            )}
          </>
        ) : (
          <div className="border-t border-studio-hairline pt-6">
            <p className="text-sm text-muted-foreground">
              No growing data yet. Add a harvest year to start tracking the environmental impact of your grain growing.
            </p>
            <PillButton variant="room" className="mt-4" onClick={handleAddHarvest}>
              Add harvest year
            </PillButton>
          </div>
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
