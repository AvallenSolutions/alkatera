'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TreePine, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { OrchardCard } from '@/components/orchards/OrchardCard';
import { AddOrchardDialog } from '@/components/orchards/AddOrchardDialog';
import { OrchardGrowingQuestionnaire } from '@/components/orchards/OrchardGrowingQuestionnaire';
import { downloadOrchardTemplateAsXLSX } from '@/lib/bulk-import/orchard-template-generator';
import type { Orchard, OrchardGrowingProfile } from '@/lib/types/orchard';

export default function OrchardsPage() {
  const { currentOrganization } = useOrganization();
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, OrchardGrowingProfile>>({});
  const [harvestCountMap, setHarvestCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOrchard, setEditOrchard] = useState<Orchard | null>(null);
  const [questionnaireOrchard, setQuestionnaireOrchard] = useState<Orchard | null>(null);

  const loadOrchards = useCallback(async () => {
    try {
      const res = await fetch('/api/orchards');
      if (!res.ok) throw new Error('Failed to load orchards');
      const { data } = await res.json();
      const list: Orchard[] = data || [];
      setOrchards(list);

      const profiles: Record<string, OrchardGrowingProfile> = {};
      const harvestCounts: Record<string, number> = {};

      await Promise.all(
        list.map(async (o) => {
          try {
            const profRes = await fetch(`/api/orchards/${o.id}/growing-profile`);
            if (profRes.ok) {
              const { data: profileData } = await profRes.json();
              if (profileData) {
                if (Array.isArray(profileData)) {
                  harvestCounts[o.id] = profileData.length;
                  if (profileData.length > 0) {
                    const sorted = [...profileData].sort(
                      (a: OrchardGrowingProfile, b: OrchardGrowingProfile) =>
                        b.harvest_year - a.harvest_year
                    );
                    profiles[o.id] = sorted[0];
                  }
                } else {
                  harvestCounts[o.id] = 1;
                  profiles[o.id] = profileData;
                }
              }
            }
          } catch {
            // Ignore individual failures
          }
        })
      );
      setProfileMap(profiles);
      setHarvestCountMap(harvestCounts);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadOrchards();
    }
  }, [currentOrganization?.id, loadOrchards]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/orchards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete orchard');
      toast.success('Orchard removed');
      loadOrchards();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function handleEdit(orchard: Orchard) {
    setEditOrchard(orchard);
    setDialogOpen(true);
  }

  function handleEditProfile(orchard: Orchard) {
    setQuestionnaireOrchard(orchard);
  }

  function handleDialogSuccess(createdOrchard?: Orchard) {
    loadOrchards();
    if (!editOrchard && createdOrchard) {
      setQuestionnaireOrchard(createdOrchard);
    }
  }

  if (isLoading) {
    return <PageLoader message="Loading orchards..." />;
  }

  if (questionnaireOrchard) {
    return (
      <FeatureGate feature="orchard_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {profileMap[questionnaireOrchard.id]
                ? `Edit Growing Profile: ${questionnaireOrchard.name}`
                : `Set Up Growing Profile: ${questionnaireOrchard.name}`}
            </h1>
            <p className="text-muted-foreground mt-2">
              Tell us about your growing practices so we can calculate the environmental impact of your fruit growing.
            </p>
          </div>

          <OrchardGrowingQuestionnaire
            orchardId={questionnaireOrchard.id}
            orchardName={questionnaireOrchard.name}
            orchardHectares={questionnaireOrchard.hectares}
            orchardType={questionnaireOrchard.orchard_type}
            orchardClimateZone={questionnaireOrchard.climate_zone as 'wet' | 'dry' | 'temperate'}
            orchardCertification={questionnaireOrchard.certification}
            orchardCountryCode={questionnaireOrchard.location_country_code}
            orchardPreviousLandUse={questionnaireOrchard.previous_land_use_type}
            orchardLandConversionYear={questionnaireOrchard.land_conversion_year}
            existingProfile={profileMap[questionnaireOrchard.id] || null}
            onComplete={(profile) => {
              setProfileMap((prev) => ({ ...prev, [questionnaireOrchard.id]: profile }));
              setQuestionnaireOrchard(null);
              toast.success('Growing profile saved');
              loadOrchards();
            }}
            onCancel={() => setQuestionnaireOrchard(null)}
          />
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="orchard_beta">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orchards</h1>
            <p className="text-muted-foreground mt-2">
              Manage your fruit orchards and growing operations. Link orchards to
              products to calculate the environmental impact of self-grown fruit.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => downloadOrchardTemplateAsXLSX()}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Download className="h-5 w-5" />
              Download Template
            </Button>
            <Button
              onClick={() => {
                setEditOrchard(null);
                setDialogOpen(true);
              }}
              size="lg"
              className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
            >
              <Plus className="h-5 w-5" />
              Add Orchard
            </Button>
          </div>
        </div>

        {orchards.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-[#ccff00]/20 flex items-center justify-center mb-4">
                <TreePine className="h-7 w-7 text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Add Your First Orchard</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Register your fruit orchards here, then link them to products on the
                recipe page. You will be asked to fill in a growing questionnaire
                so we can calculate the environmental impact of your fruit growing.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => downloadOrchardTemplateAsXLSX()}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download Data Template
                </Button>
                <Button
                  onClick={() => {
                    setEditOrchard(null);
                    setDialogOpen(true);
                  }}
                  size="lg"
                  className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
                >
                  <Plus className="h-5 w-5" />
                  Add Orchard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orchards.map((orchard) => (
              <OrchardCard
                key={orchard.id}
                orchard={orchard}
                hasGrowingProfile={orchard.id in profileMap}
                harvestCount={harvestCountMap[orchard.id] ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onEditProfile={handleEditProfile}
              />
            ))}
          </div>
        )}

        <AddOrchardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleDialogSuccess}
          editOrchard={editOrchard}
        />
      </div>
    </FeatureGate>
  );
}
