'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wheat, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { ArableFieldCard } from '@/components/arable-fields/ArableFieldCard';
import { AddArableFieldDialog } from '@/components/arable-fields/AddArableFieldDialog';
import { ArableGrowingQuestionnaire } from '@/components/arable-fields/ArableGrowingQuestionnaire';
import type { ArableField, ArableGrowingProfile } from '@/lib/types/arable';

export default function ArableFieldsPage() {
  const { currentOrganization } = useOrganization();
  const [fields, setFields] = useState<ArableField[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ArableGrowingProfile>>({});
  const [harvestCountMap, setHarvestCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editField, setEditField] = useState<ArableField | null>(null);
  const [questionnaireField, setQuestionnaireField] = useState<ArableField | null>(null);

  const loadFields = useCallback(async () => {
    try {
      const res = await fetch('/api/arable-fields');
      if (!res.ok) throw new Error('Failed to load arable fields');
      const { data } = await res.json();
      const list: ArableField[] = data || [];
      setFields(list);

      const profiles: Record<string, ArableGrowingProfile> = {};
      const harvestCounts: Record<string, number> = {};

      await Promise.all(
        list.map(async (f) => {
          try {
            const profRes = await fetch(`/api/arable-fields/${f.id}/growing-profile`);
            if (profRes.ok) {
              const { data: profileData } = await profRes.json();
              if (profileData) {
                if (Array.isArray(profileData)) {
                  harvestCounts[f.id] = profileData.length;
                  if (profileData.length > 0) {
                    const sorted = [...profileData].sort(
                      (a: ArableGrowingProfile, b: ArableGrowingProfile) =>
                        b.harvest_year - a.harvest_year
                    );
                    profiles[f.id] = sorted[0];
                  }
                } else {
                  harvestCounts[f.id] = 1;
                  profiles[f.id] = profileData;
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
      loadFields();
    }
  }, [currentOrganization?.id, loadFields]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/arable-fields/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete arable field');
      toast.success('Arable field removed');
      loadFields();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function handleEdit(field: ArableField) {
    setEditField(field);
    setDialogOpen(true);
  }

  function handleEditProfile(field: ArableField) {
    setQuestionnaireField(field);
  }

  function handleDialogSuccess(createdField?: ArableField) {
    loadFields();
    if (!editField && createdField) {
      setQuestionnaireField(createdField);
    }
  }

  if (isLoading) {
    return <PageLoader message="Loading arable fields..." />;
  }

  if (questionnaireField) {
    return (
      <FeatureGate feature="arable_beta">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {profileMap[questionnaireField.id]
                ? `Edit Growing Profile: ${questionnaireField.name}`
                : `Set Up Growing Profile: ${questionnaireField.name}`}
            </h1>
            <p className="text-muted-foreground mt-2">
              Tell us about your growing practices so we can calculate the environmental impact of your grain growing.
            </p>
          </div>

          <ArableGrowingQuestionnaire
            fieldId={questionnaireField.id}
            fieldName={questionnaireField.name}
            fieldHectares={questionnaireField.hectares}
            cropType={questionnaireField.crop_type}
            fieldClimateZone={questionnaireField.climate_zone as 'wet' | 'dry' | 'temperate'}
            fieldCertification={questionnaireField.certification}
            fieldCountryCode={questionnaireField.location_country_code}
            fieldPreviousLandUse={questionnaireField.previous_land_use_type}
            fieldLandConversionYear={questionnaireField.land_conversion_year}
            existingProfile={profileMap[questionnaireField.id] || null}
            onComplete={(profile) => {
              setProfileMap((prev) => ({ ...prev, [questionnaireField.id]: profile }));
              setQuestionnaireField(null);
              toast.success('Growing profile saved');
              loadFields();
            }}
            onCancel={() => setQuestionnaireField(null)}
          />
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="arable_beta">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Arable Fields</h1>
            <p className="text-muted-foreground mt-2">
              Manage your arable fields and track the environmental impact of your grain growing operations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setEditField(null);
                setDialogOpen(true);
              }}
              size="lg"
              className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
            >
              <Plus className="h-5 w-5" />
              Add Arable Field
            </Button>
          </div>
        </div>

        {fields.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-[#ccff00]/20 flex items-center justify-center mb-4">
                <Wheat className="h-7 w-7 text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Add Your First Arable Field</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Register your arable fields here, then link them to products on the
                recipe page. You will be asked to fill in a growing questionnaire
                so we can calculate the environmental impact of your grain growing.
              </p>
              <Button
                onClick={() => {
                  setEditField(null);
                  setDialogOpen(true);
                }}
                size="lg"
                className="gap-2 bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
              >
                <Plus className="h-5 w-5" />
                Add Arable Field
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <ArableFieldCard
                key={field.id}
                field={field}
                hasGrowingProfile={field.id in profileMap}
                harvestCount={harvestCountMap[field.id] ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onEditProfile={handleEditProfile}
              />
            ))}
          </div>
        )}

        <AddArableFieldDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleDialogSuccess}
          editField={editField}
        />
      </div>
    </FeatureGate>
  );
}
