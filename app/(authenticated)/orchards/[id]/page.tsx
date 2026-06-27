'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TreePine, ChevronRight, Plus, Edit2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
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
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Orchard not found.</p>
        <Button variant="outline" asChild>
          <Link href="/orchards">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orchards
          </Link>
        </Button>
      </div>
    );
  }

  if (showQuestionnaire) {
    return (
      <FeatureGate feature="orchard_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {questionnaireProfile
                ? `Edit Growing Profile: ${orchard.name}`
                : `Add Growing Profile: ${orchard.name}`}
            </h1>
            <p className="text-muted-foreground mt-2">
              Tell us about your growing practices so we can calculate the environmental impact of your fruit growing.
            </p>
          </div>

          <OrchardGrowingQuestionnaire
            orchardId={orchard.id}
            orchardName={orchard.name}
            orchardHectares={orchard.hectares}
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

  return (
    <FeatureGate feature="orchard_beta">
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/orchards" className="hover:text-foreground transition-colors">
            Orchards
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{orchard.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#ccff00]/10 p-2.5">
              <TreePine className="h-6 w-6 text-[#ccff00]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{orchard.name}</h1>
              <p className="text-muted-foreground mt-1 capitalize">
                {orchard.hectares} ha &middot; {orchard.orchard_type}
                {orchard.certification && orchard.certification !== 'conventional' && ` · ${orchard.certification}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Edit2 className="h-4 w-4" />
              Edit Orchard
            </Button>
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

        {/* Map & location */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Map &amp; location</h2>
          <LandUnitMap type="orchard" id={orchard.id} />
        </div>

        <Separator />

        {/* Impact overview + harvest history */}
        {latestProfile && latestImpacts ? (
          <>
            <OrchardImpactOverview impacts={latestImpacts} profile={latestProfile} />

            {harvestImpacts.length > 0 && (
              <HarvestHistoryTable
                harvestImpacts={harvestImpacts}
                orchardId={orchard.id}
                onEditHarvest={handleEditHarvest}
                onAddHarvest={handleAddHarvest}
              />
            )}

            {harvestImpacts.length >= 2 && <OrchardTrendCharts harvestImpacts={harvestImpacts} />}
          </>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-[#ccff00]/20 flex items-center justify-center mb-4">
                <TreePine className="h-7 w-7 text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Growing Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Add a harvest year to start tracking the environmental impact of your fruit growing operations.
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
