'use client';

/**
 * One orchard, in the studio grammar: a statement header with the
 * hectares standing right, pill actions, a quiet mono back-link, and
 * the surface cut into mono-eyebrow sections (map, latest harvest,
 * history, trends). Data loading, the impact calculator and the
 * questionnaire launches are unchanged.
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
import { OrchardGrowingQuestionnaire } from '@/components/orchards/OrchardGrowingQuestionnaire';
import { OrchardImpactOverview } from '@/components/orchards/OrchardImpactOverview';
import { OrchardTrendCharts } from '@/components/orchards/OrchardTrendCharts';
import { HarvestHistoryTable } from '@/components/orchards/HarvestHistoryTable';
import { AddOrchardDialog } from '@/components/orchards/AddOrchardDialog';
import { LandUnitMap } from '@/components/geo/LandUnitMap';
import { calculateOrchardImpacts } from '@/lib/orchard-calculator';
import type {
  Orchard,
  OrchardGrowingProfile,
  OrchardCalculatorInput,
  OrchardImpactResult,
  HarvestImpactSummary,
} from '@/lib/types/orchard';

/** Build the calculator input for one harvest from the orchard + its profile. */
function buildInput(orchard: Orchard, profile: OrchardGrowingProfile): OrchardCalculatorInput {
  return {
    orchard_type: orchard.orchard_type,
    climate_zone: orchard.climate_zone,
    certification: orchard.certification,
    location_country_code: orchard.location_country_code,
    area_ha: profile.area_ha,
    soil_management: profile.soil_management,
    pruning_residue_returned: profile.pruning_residue_returned,
    fertiliser_type: profile.fertiliser_type,
    fertiliser_quantity_kg: profile.fertiliser_quantity_kg,
    fertiliser_n_content_percent: profile.fertiliser_n_content_percent,
    uses_pesticides: profile.uses_pesticides,
    pesticide_applications_per_year: profile.pesticide_applications_per_year,
    pesticide_type: profile.pesticide_type,
    uses_herbicides: profile.uses_herbicides,
    herbicide_applications_per_year: profile.herbicide_applications_per_year,
    herbicide_type: profile.herbicide_type,
    diesel_litres_per_year: profile.diesel_litres_per_year,
    petrol_litres_per_year: profile.petrol_litres_per_year,
    is_irrigated: profile.is_irrigated,
    water_m3_per_ha: profile.water_m3_per_ha,
    irrigation_energy_source: profile.irrigation_energy_source,
    fruit_yield_tonnes: profile.fruit_yield_tonnes,
    soil_carbon_override_kg_co2e_per_ha: profile.soil_carbon_override_kg_co2e_per_ha,
    soil_carbon_annual_change_kg_co2e_per_ha: profile.soil_carbon_annual_change_kg_co2e_per_ha,
    soil_carbon_change_methodology: profile.soil_carbon_change_methodology,
    soil_carbon_change_confidence: profile.soil_carbon_change_confidence,
    transport_distance_km: profile.transport_distance_km,
    transport_mode: profile.transport_mode,
    previous_land_use_type: orchard.previous_land_use_type,
    land_conversion_year: orchard.land_conversion_year,
    harvest_year: profile.harvest_year,
    tree_age: orchard.planting_year != null ? profile.harvest_year - orchard.planting_year : null,
    removal_verification_status:
      (profile.removal_verification_status as OrchardCalculatorInput['removal_verification_status']) ?? 'unverified',
  };
}

/** Quiet mono back-link to the list page. */
function BackLink() {
  return (
    <Link
      href="/orchards"
      className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      &larr; The orchards
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

export default function OrchardDetailPage() {
  const params = useParams();
  const { currentOrganization } = useOrganization();
  const orchardId = params.id as string;

  const [orchard, setOrchard] = useState<Orchard | null>(null);
  const [profiles, setProfiles] = useState<OrchardGrowingProfile[]>([]);
  const [harvestImpacts, setHarvestImpacts] = useState<HarvestImpactSummary[]>([]);
  const [latestImpacts, setLatestImpacts] = useState<OrchardImpactResult | null>(null);
  const [latestProfile, setLatestProfile] = useState<OrchardGrowingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireProfile, setQuestionnaireProfile] = useState<OrchardGrowingProfile | null>(null);

  const loadOrchard = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchards/${orchardId}`);
      if (!res.ok) throw new Error('Failed to load orchard');
      const { data } = await res.json();
      setOrchard(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [orchardId]);

  const loadProfiles = useCallback(async () => {
    if (!orchard) return;
    try {
      const res = await fetch(`/api/orchards/${orchardId}/growing-profile`);
      if (!res.ok) throw new Error('Failed to load growing profiles');
      const { data } = await res.json();
      const list: OrchardGrowingProfile[] = Array.isArray(data) ? data : data ? [data] : [];
      list.sort((a, b) => b.harvest_year - a.harvest_year);
      setProfiles(list);

      const impacts: HarvestImpactSummary[] = list.map((profile) => {
        const result = calculateOrchardImpacts(buildInput(orchard, profile));
        const area = profile.area_ha || 1;
        const yieldT = profile.fruit_yield_tonnes || 0;
        return {
          harvest_year: profile.harvest_year,
          profile_id: profile.id,
          is_complete: !profile.is_draft,
          is_draft: profile.is_draft,
          impacts: result,
          emissions_per_ha: result.total_emissions / area,
          water_per_ha: result.water_m3 / area,
          removals_per_ha: result.total_removals / area,
          yield_tonnes_per_ha: yieldT / area,
        };
      });
      setHarvestImpacts(impacts);

      if (list.length > 0) {
        setLatestProfile(list[0]);
        setLatestImpacts(impacts[0]?.impacts ?? null);
      } else {
        setLatestProfile(null);
        setLatestImpacts(null);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [orchard, orchardId]);

  useEffect(() => {
    if (currentOrganization?.id && orchardId) loadOrchard();
  }, [currentOrganization?.id, orchardId, loadOrchard]);

  useEffect(() => {
    if (orchard) loadProfiles().finally(() => setIsLoading(false));
  }, [orchard, loadProfiles]);

  function handleAddHarvest() {
    setQuestionnaireProfile(null);
    setShowQuestionnaire(true);
  }

  function handleEditHarvest(year: number) {
    const profile = profiles.find((p) => p.harvest_year === year);
    if (profile) {
      setQuestionnaireProfile(profile);
      setShowQuestionnaire(true);
    }
  }

  if (isLoading) return <PageLoader message="Loading orchard..." />;

  if (!orchard) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Orchard not found.</p>
      </div>
    );
  }

  if (showQuestionnaire) {
    return (
      <FeatureGate feature="orchards">
        <div className="space-y-8">
          <div className="min-w-0">
            <Statement
              eyebrow="THE WORKBENCH · GROWING PROFILE"
              headline={orchard.name.endsWith('.') ? orchard.name : `${orchard.name}.`}
            />
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Tell us about your growing practices so we can calculate the environmental impact of your fruit growing.
            </p>
          </div>

          <OrchardGrowingQuestionnaire
            orchardId={orchard.id}
            orchardName={orchard.name}
            orchardHectares={orchard.hectares}
            orchardAnnualYieldTonnes={orchard.annual_yield_tonnes}
            orchardType={orchard.orchard_type}
            orchardClimateZone={orchard.climate_zone}
            orchardCertification={orchard.certification}
            orchardCountryCode={orchard.location_country_code}
            orchardPreviousLandUse={orchard.previous_land_use_type}
            orchardLandConversionYear={orchard.land_conversion_year}
            existingProfile={questionnaireProfile}
            onComplete={() => {
              setShowQuestionnaire(false);
              setQuestionnaireProfile(null);
              toast.success('Growing profile saved');
              loadProfiles();
            }}
            onCancel={() => {
              setShowQuestionnaire(false);
              setQuestionnaireProfile(null);
            }}
          />
        </div>
      </FeatureGate>
    );
  }

  const factLine = [
    orchard.orchard_type,
    orchard.certification && orchard.certification !== 'conventional' ? orchard.certification : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FeatureGate feature="orchards">
      <div className="space-y-10">
        <div className="min-w-0 space-y-4">
          <BackLink />

          <Statement
            eyebrow="THE WORKBENCH · ORCHARD"
            headline={orchard.name.endsWith('.') ? orchard.name : `${orchard.name}.`}
          >
            <BigNumber size="display" value={orchard.hectares} label="Hectares" />
            <div className="flex items-center gap-2">
              <PillButton variant="outline" onClick={() => setDialogOpen(true)}>
                Edit orchard
              </PillButton>
              <PillButton variant="room" onClick={handleAddHarvest}>
                Add harvest year
              </PillButton>
            </div>
          </Statement>

          <p className="max-w-xl text-sm capitalize text-muted-foreground">{factLine}</p>
        </div>

        <Section label="MAP & LOCATION">
          <LandUnitMap type="orchard" id={orchard.id} />
        </Section>

        {latestProfile && latestImpacts ? (
          <>
            <Section label={`THE LATEST HARVEST · ${latestProfile.harvest_year}`}>
              <OrchardImpactOverview impacts={latestImpacts} profile={latestProfile} />
            </Section>

            {harvestImpacts.length > 0 && (
              <Section label="HARVEST HISTORY">
                <HarvestHistoryTable
                  harvestImpacts={harvestImpacts}
                  orchardId={orchard.id}
                  onEditHarvest={handleEditHarvest}
                  onAddHarvest={handleAddHarvest}
                />
              </Section>
            )}

            {harvestImpacts.length >= 2 && (
              <Section label="TRENDS">
                <OrchardTrendCharts harvestImpacts={harvestImpacts} />
              </Section>
            )}
          </>
        ) : (
          <div className="border-t border-studio-hairline pt-6">
            <p className="text-sm text-muted-foreground">
              No growing data yet. Add a harvest year to start tracking the environmental impact of your fruit growing.
            </p>
            <PillButton variant="room" className="mt-4" onClick={handleAddHarvest}>
              Add harvest year
            </PillButton>
          </div>
        )}

        {/* Edit Orchard Dialog */}
        <AddOrchardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => loadOrchard()}
          editOrchard={orchard}
        />
      </div>
    </FeatureGate>
  );
}
