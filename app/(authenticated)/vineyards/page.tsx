'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Leaf, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { VineyardCard } from '@/components/vineyards/VineyardCard';
import { AddVineyardDialog } from '@/components/vineyards/AddVineyardDialog';
import { VineyardGrowingQuestionnaire } from '@/components/vineyards/VineyardGrowingQuestionnaire';
import type { Vineyard, VineyardGrowingProfile, VineyardClimateZone, VineyardCertification } from '@/lib/types/viticulture';

export default function VineyardsPage() {
  const { currentOrganization } = useOrganization();
  const [vineyards, setVineyards] = useState<Vineyard[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, VineyardGrowingProfile>>({});
  const [vintageCountMap, setVintageCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVineyard, setEditVineyard] = useState<Vineyard | null>(null);

  // Questionnaire state
  const [questionnaireVineyard, setQuestionnaireVineyard] = useState<Vineyard | null>(null);

  const loadVineyards = useCallback(async () => {
    try {
      const res = await fetch('/api/vineyards');
      if (!res.ok) throw new Error('Failed to load vineyards');
      const { data } = await res.json();
      const list: Vineyard[] = data || [];
      setVineyards(list);

      // Fetch growing profiles for all vineyards in parallel
      const profiles: Record<string, VineyardGrowingProfile> = {};
      const vintageCounts: Record<string, number> = {};

      await Promise.all(
        list.map(async (v) => {
          try {
            const profRes = await fetch(`/api/vineyards/${v.id}/growing-profile`);
            if (profRes.ok) {
              const { data: profileData } = await profRes.json();
              if (profileData) {
                // Handle both array and single object responses
                if (Array.isArray(profileData)) {
                  vintageCounts[v.id] = profileData.length;
                  if (profileData.length > 0) {
                    // Use most recent profile for the "has profile" badge
                    const sorted = [...profileData].sort(
                      (a: VineyardGrowingProfile, b: VineyardGrowingProfile) =>
                        b.vintage_year - a.vintage_year
                    );
                    profiles[v.id] = sorted[0];
                  }
                } else {
                  vintageCounts[v.id] = 1;
                  profiles[v.id] = profileData;
                }
              }
            }
          } catch {
            // Ignore individual failures
          }
        })
      );
      setProfileMap(profiles);
      setVintageCountMap(vintageCounts);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadVineyards();
    }
  }, [currentOrganization?.id, loadVineyards]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/vineyards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete vineyard');
      toast.success('Vineyard removed');
      loadVineyards();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function handleEdit(vineyard: Vineyard) {
    setEditVineyard(vineyard);
    setDialogOpen(true);
  }

  function handleEditProfile(vineyard: Vineyard) {
    setQuestionnaireVineyard(vineyard);
  }

  /** Called when AddVineyardDialog saves successfully */
  function handleDialogSuccess(createdVineyard?: Vineyard) {
    loadVineyards();
    // If a new vineyard was created (not editing), auto-open the questionnaire
    if (!editVineyard && createdVineyard) {
      setQuestionnaireVineyard(createdVineyard);
    }
  }

  if (isLoading) {
    return <PageLoader message="Loading vineyards..." />;
  }

  // If the questionnaire is open, show it full-width
  if (questionnaireVineyard) {
    return (
      <FeatureGate feature="viticulture_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {profileMap[questionnaireVineyard.id]
                ? `Edit Growing Profile: ${questionnaireVineyard.name}`
                : `Set Up Growing Profile: ${questionnaireVineyard.name}`}
            </h1>
            <p className="text-muted-foreground mt-2">
              Tell us about your growing practices so we can calculate the environmental impact of your grape growing.
            </p>
          </div>

          <VineyardGrowingQuestionnaire
            vineyardId={questionnaireVineyard.id}
            vineyardName={questionnaireVineyard.name}
            vineyardHectares={questionnaireVineyard.hectares}
            vineyardClimateZone={questionnaireVineyard.climate_zone as VineyardClimateZone}
            vineyardCertification={questionnaireVineyard.certification as VineyardCertification}
            vineyardCountryCode={questionnaireVineyard.location_country_code}
            vineyardPreviousLandUse={questionnaireVineyard.previous_land_use_type}
            vineyardLandConversionYear={questionnaireVineyard.land_conversion_year}
            existingProfile={profileMap[questionnaireVineyard.id] || null}
            onComplete={(profile) => {
              setProfileMap((prev) => ({ ...prev, [questionnaireVineyard.id]: profile }));
              setQuestionnaireVineyard(null);
              toast.success('Growing profile saved');
              loadVineyards();
            }}
            onCancel={() => setQuestionnaireVineyard(null)}
          />
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="viticulture_beta">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vineyards</h1>
            <p className="text-muted-foreground mt-2">
              Manage your vineyards and growing operations. Link vineyards to
              products to calculate the environmental impact of self-grown grapes.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditVineyard(null);
              setDialogOpen(true);
            }}
            size="lg"
            className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
          >
            <Plus className="h-5 w-5" />
            Add Vineyard
          </Button>
        </div>

        {vineyards.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-[#ccff00]/20 flex items-center justify-center mb-4">
                <Leaf className="h-7 w-7 text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Add Your First Vineyard</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Register your vineyards here, then link them to products on the
                recipe page. You will be asked to fill in a growing questionnaire
                so we can calculate the environmental impact of your grape growing.
              </p>
              <Button
                onClick={() => {
                  setEditVineyard(null);
                  setDialogOpen(true);
                }}
                size="lg"
                className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
              >
                <Plus className="h-5 w-5" />
                Add Vineyard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vineyards.map((vineyard) => (
              <VineyardCard
                key={vineyard.id}
                vineyard={vineyard}
                hasGrowingProfile={vineyard.id in profileMap}
                vintageCount={vintageCountMap[vineyard.id] ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onEditProfile={handleEditProfile}
              />
            ))}
          </div>
        )}

        <AddVineyardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleDialogSuccess}
          editVineyard={editVineyard}
        />
      </div>
    </FeatureGate>
  );
}
