'use client';

/**
 * The shared growing-sites surface: one studio list page for vineyards,
 * orchards and arable fields, driven by a CropConfig.
 *
 * Statement with the count standing right, quiet fact rows with a working-tone
 * profile chip, a confirmed delete, and the per-crop questionnaire takeover
 * behind a studio statement header. The per-site growing-profile fetch
 * behaviour is unchanged (same data, no API changes).
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PageLoader } from '@/components/ui/page-loader';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CropConfig, GrowingSiteBase } from './crop-config';

export function GrowingSitesPage<TSite extends GrowingSiteBase, TProfile>({
  config,
}: {
  config: CropConfig<TSite, TProfile>;
}) {
  const { currentOrganization } = useOrganization();
  const [sites, setSites] = useState<TSite[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, TProfile>>({});
  const [seasonCountMap, setSeasonCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSite, setEditSite] = useState<TSite | null>(null);
  const [questionnaireSite, setQuestionnaireSite] = useState<TSite | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TSite | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSites = useCallback(async () => {
    try {
      const res = await fetch(config.apiBase);
      if (!res.ok) throw new Error(`Failed to load ${config.plural}`);
      const { data } = await res.json();
      const list: TSite[] = data || [];
      setSites(list);

      // Fetch growing profiles for all sites in parallel (same behaviour as before)
      const profiles: Record<string, TProfile> = {};
      const seasonCounts: Record<string, number> = {};

      await Promise.all(
        list.map(async (site) => {
          try {
            const profRes = await fetch(`${config.apiBase}/${site.id}/growing-profile`);
            if (profRes.ok) {
              const { data: profileData } = await profRes.json();
              if (profileData) {
                // Handle both array and single object responses
                if (Array.isArray(profileData)) {
                  seasonCounts[site.id] = profileData.length;
                  if (profileData.length > 0) {
                    // Use the most recent profile for the status chip
                    const sorted = [...profileData].sort(
                      (a: TProfile, b: TProfile) => config.profileYear(b) - config.profileYear(a)
                    );
                    profiles[site.id] = sorted[0];
                  }
                } else {
                  seasonCounts[site.id] = 1;
                  profiles[site.id] = profileData;
                }
              }
            }
          } catch {
            // Ignore individual failures
          }
        })
      );
      setProfileMap(profiles);
      setSeasonCountMap(seasonCounts);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadSites();
    }
  }, [currentOrganization?.id, loadSites]);

  function openAddDialog() {
    setEditSite(null);
    setDialogOpen(true);
  }

  function handleEdit(site: TSite) {
    setEditSite(site);
    setDialogOpen(true);
  }

  /** Called when the Add dialog saves successfully. */
  function handleDialogSuccess(created?: TSite) {
    loadSites();
    // A newly created site goes straight into the growing questionnaire
    if (!editSite && created) {
      setQuestionnaireSite(created);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${config.apiBase}/${pendingDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete ${config.singular}`);
      toast.success(
        `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} removed`
      );
      setPendingDelete(null);
      loadSites();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <PageLoader />;
  }

  // The questionnaire takeover: full width, behind a studio statement header
  if (questionnaireSite) {
    return (
      <FeatureGate feature={config.featureFlag}>
        <div className="space-y-8">
          <div className="min-w-0">
            <Statement
              eyebrow={`${config.eyebrow} · GROWING PROFILE`}
              headline={
                questionnaireSite.name.endsWith('.')
                  ? questionnaireSite.name
                  : `${questionnaireSite.name}.`
              }
            />
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              {config.questionnaireIntro}
            </p>
          </div>

          {config.renderQuestionnaire({
            site: questionnaireSite,
            existingProfile: profileMap[questionnaireSite.id] ?? null,
            onComplete: (profile) => {
              setProfileMap((prev) => ({ ...prev, [questionnaireSite.id]: profile }));
              setQuestionnaireSite(null);
              toast.success('Growing profile saved');
              loadSites();
            },
            onCancel: () => setQuestionnaireSite(null),
          })}
        </div>
      </FeatureGate>
    );
  }

  const rows: FactRowItem[] = sites.map((site) => {
    const hasProfile = site.id in profileMap;
    const seasons = seasonCountMap[site.id] ?? 0;
    const hasHectares = typeof site.hectares === 'number' && site.hectares > 0;
    const hint = config.siteHint(site);

    return {
      id: site.id,
      title: site.name,
      hint: hint || undefined,
      chip: hasProfile
        ? { tone: 'good' as const, label: 'Profile complete' }
        : { tone: 'attention' as const, label: 'Needs growing data' },
      value: hasHectares ? String(site.hectares) : String(seasons),
      unit: hasHectares
        ? 'HA'
        : seasons === 1
          ? config.season.singular.toUpperCase()
          : config.season.plural.toUpperCase(),
      href: config.detailPath(site.id),
      trailing: (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEdit(site);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            aria-label={`Remove ${site.name}`}
            className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPendingDelete(site);
            }}
          >
            &times;
          </button>
        </span>
      ),
    };
  });

  return (
    <FeatureGate feature={config.featureFlag}>
      <div className="space-y-8">
        <div className="min-w-0">
          <Statement eyebrow={config.eyebrow} headline={config.headline}>
            <BigNumber size="display" value={sites.length} label={config.countLabel} />
            <div className="flex items-center gap-2">
              {config.downloadTemplate ? (
                <PillButton variant="outline" onClick={config.downloadTemplate}>
                  Download template
                </PillButton>
              ) : null}
              <PillButton variant="room" onClick={openAddDialog}>
                {config.addLabel}
              </PillButton>
            </div>
          </Statement>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">{config.intro}</p>
        </div>

        {sites.length === 0 ? (
          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">{config.emptyLine}</p>
            <PillButton variant="room" className="mt-4" onClick={openAddDialog}>
              {config.addLabel}
            </PillButton>
          </div>
        ) : (
          <FactList items={rows} className="border-t border-border" />
        )}

        {config.renderAddDialog({
          open: dialogOpen,
          onOpenChange: setDialogOpen,
          onSuccess: handleDialogSuccess,
          editSite,
        })}

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this {config.singular}?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete?.name} and its growing data will be removed. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Removing...' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FeatureGate>
  );
}
