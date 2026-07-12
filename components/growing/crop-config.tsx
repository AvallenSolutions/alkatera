'use client';

/**
 * Crop configuration for the shared growing-sites surface.
 *
 * The vineyards, orchards and arable-fields list pages are one surface
 * (GrowingSitesPage) driven by one of the config objects below. The per-crop
 * Add dialogs and growing questionnaires keep their own prop shapes, so each
 * config adapts them behind a common render contract. URLs, APIs, feature
 * flags and template downloads are untouched.
 */

import type { ReactNode } from 'react';
import { AddVineyardDialog } from '@/components/vineyards/AddVineyardDialog';
import { VineyardGrowingQuestionnaire } from '@/components/vineyards/VineyardGrowingQuestionnaire';
import { AddOrchardDialog } from '@/components/orchards/AddOrchardDialog';
import { OrchardGrowingQuestionnaire } from '@/components/orchards/OrchardGrowingQuestionnaire';
import { AddArableFieldDialog } from '@/components/arable-fields/AddArableFieldDialog';
import { ArableGrowingQuestionnaire } from '@/components/arable-fields/ArableGrowingQuestionnaire';
import { ORCHARD_TYPE_LABELS } from '@/lib/orchard-utils';
import { CROP_TYPE_LABELS } from '@/lib/arable-utils';
import type {
  Vineyard,
  VineyardGrowingProfile,
  VineyardClimateZone,
  VineyardCertification,
} from '@/lib/types/viticulture';
import type { Orchard, OrchardGrowingProfile } from '@/lib/types/orchard';
import type { ArableField, ArableGrowingProfile } from '@/lib/types/arable';

/** The fields the shared surface reads; all three site types satisfy it. */
export interface GrowingSiteBase {
  id: string;
  name: string;
  hectares: number;
  annual_yield_tonnes: number | null;
  address_city: string | null;
  address_country: string | null;
}

export interface AddDialogRenderProps<TSite> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created?: TSite) => void;
  editSite: TSite | null;
}

export interface QuestionnaireRenderProps<TSite, TProfile> {
  site: TSite;
  existingProfile: TProfile | null;
  onComplete: (profile: TProfile) => void;
  onCancel: () => void;
}

export interface CropConfig<TSite extends GrowingSiteBase, TProfile> {
  /** Route and API key, e.g. 'vineyards'. */
  key: 'vineyards' | 'orchards' | 'arable-fields';
  featureFlag: 'viticulture_beta' | 'orchard_beta' | 'arable_beta';
  /** Lowercase nouns for copy: 'vineyard' / 'vineyards'. */
  singular: string;
  plural: string;
  /** Mono eyebrow above the statement, e.g. 'THE WORKBENCH · VINEYARDS'. */
  eyebrow: string;
  /** The page's one sentence, ending with a full stop. */
  headline: string;
  /** Label beneath the standing count. */
  countLabel: string;
  /** Quiet supporting sentence beneath the statement. */
  intro: string;
  /** The one dim line when there is nothing yet. */
  emptyLine: string;
  /** Label on the room pill, e.g. 'Add vineyard'. */
  addLabel: string;
  /** API base, e.g. '/api/vineyards'. Growing profiles live at {apiBase}/{id}/growing-profile. */
  apiBase: string;
  detailPath: (id: string) => string;
  /** What one recorded growing season is called: vintage or harvest. */
  season: { singular: string; plural: string };
  /** The year a growing profile belongs to, for picking the most recent. */
  profileYear: (profile: TProfile) => number;
  /** Quiet one-line detail beneath the site name (location, varieties). */
  siteHint: (site: TSite) => string;
  /** Bulk-import template download; omitted when the crop has none. */
  downloadTemplate?: () => void;
  /** Supporting sentence on the questionnaire takeover. */
  questionnaireIntro: string;
  renderAddDialog: (props: AddDialogRenderProps<TSite>) => ReactNode;
  renderQuestionnaire: (props: QuestionnaireRenderProps<TSite, TProfile>) => ReactNode;
}

function joinFacts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

function locationLine(site: GrowingSiteBase): string {
  return [site.address_city, site.address_country].filter(Boolean).join(', ');
}

function varietiesLine(varieties: string[] | null | undefined): string {
  if (!varieties || varieties.length === 0) return '';
  const shown = varieties.slice(0, 3).join(', ');
  return varieties.length > 3 ? `${shown} +${varieties.length - 3}` : shown;
}

export const vineyardConfig: CropConfig<Vineyard, VineyardGrowingProfile> = {
  key: 'vineyards',
  featureFlag: 'viticulture_beta',
  singular: 'vineyard',
  plural: 'vineyards',
  eyebrow: 'THE WORKBENCH · VINEYARDS',
  headline: 'The vineyards.',
  countLabel: 'Vineyards',
  intro:
    'Manage your vineyards and growing operations. Link vineyards to products to calculate the environmental impact of self-grown grapes.',
  emptyLine:
    'No vineyards yet. Add your first, then link it to products on the recipe page to measure your grape growing.',
  addLabel: 'Add vineyard',
  apiBase: '/api/vineyards',
  detailPath: (id) => `/vineyards/${id}`,
  season: { singular: 'vintage', plural: 'vintages' },
  profileYear: (profile) => profile.vintage_year,
  siteHint: (site) => joinFacts([locationLine(site), varietiesLine(site.grape_varieties)]),
  downloadTemplate: () => {
    import('@/lib/bulk-import/viticulture-template-generator').then(
      ({ downloadViticultureTemplateAsXLSX }) => downloadViticultureTemplateAsXLSX()
    );
  },
  questionnaireIntro:
    'Tell us about your growing practices so we can calculate the environmental impact of your grape growing.',
  renderAddDialog: ({ open, onOpenChange, onSuccess, editSite }) => (
    <AddVineyardDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      editVineyard={editSite}
    />
  ),
  renderQuestionnaire: ({ site, existingProfile, onComplete, onCancel }) => (
    <VineyardGrowingQuestionnaire
      vineyardId={site.id}
      vineyardName={site.name}
      vineyardHectares={site.hectares}
      vineyardClimateZone={site.climate_zone as VineyardClimateZone}
      vineyardCertification={site.certification as VineyardCertification}
      vineyardCountryCode={site.location_country_code}
      vineyardPreviousLandUse={site.previous_land_use_type}
      vineyardLandConversionYear={site.land_conversion_year}
      existingProfile={existingProfile}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  ),
};

export const orchardConfig: CropConfig<Orchard, OrchardGrowingProfile> = {
  key: 'orchards',
  featureFlag: 'orchard_beta',
  singular: 'orchard',
  plural: 'orchards',
  eyebrow: 'THE WORKBENCH · ORCHARDS',
  headline: 'The orchards.',
  countLabel: 'Orchards',
  intro:
    'Manage your fruit orchards and growing operations. Link orchards to products to calculate the environmental impact of self-grown fruit.',
  emptyLine:
    'No orchards yet. Add your first, then link it to products on the recipe page to measure your fruit growing.',
  addLabel: 'Add orchard',
  apiBase: '/api/orchards',
  detailPath: (id) => `/orchards/${id}`,
  season: { singular: 'harvest', plural: 'harvests' },
  profileYear: (profile) => profile.harvest_year,
  siteHint: (site) =>
    joinFacts([
      ORCHARD_TYPE_LABELS[site.orchard_type] || site.orchard_type,
      locationLine(site),
      varietiesLine(site.fruit_varieties),
    ]),
  downloadTemplate: () => {
    import('@/lib/bulk-import/orchard-template-generator').then(
      ({ downloadOrchardTemplateAsXLSX }) => downloadOrchardTemplateAsXLSX()
    );
  },
  questionnaireIntro:
    'Tell us about your growing practices so we can calculate the environmental impact of your fruit growing.',
  renderAddDialog: ({ open, onOpenChange, onSuccess, editSite }) => (
    <AddOrchardDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      editOrchard={editSite}
    />
  ),
  renderQuestionnaire: ({ site, existingProfile, onComplete, onCancel }) => (
    <OrchardGrowingQuestionnaire
      orchardId={site.id}
      orchardName={site.name}
      orchardHectares={site.hectares}
      orchardType={site.orchard_type}
      orchardClimateZone={site.climate_zone as 'wet' | 'dry' | 'temperate'}
      orchardCertification={site.certification}
      orchardCountryCode={site.location_country_code}
      orchardPreviousLandUse={site.previous_land_use_type}
      orchardLandConversionYear={site.land_conversion_year}
      existingProfile={existingProfile}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  ),
};

export const arableFieldConfig: CropConfig<ArableField, ArableGrowingProfile> = {
  key: 'arable-fields',
  featureFlag: 'arable_beta',
  singular: 'arable field',
  plural: 'arable fields',
  eyebrow: 'THE WORKBENCH · ARABLE FIELDS',
  headline: 'The arable fields.',
  countLabel: 'Arable fields',
  intro:
    'Manage your arable fields and track the environmental impact of your grain growing operations.',
  emptyLine:
    'No arable fields yet. Add your first, then link it to products on the recipe page to measure your grain growing.',
  addLabel: 'Add arable field',
  apiBase: '/api/arable-fields',
  detailPath: (id) => `/arable-fields/${id}`,
  season: { singular: 'harvest', plural: 'harvests' },
  profileYear: (profile) => profile.harvest_year,
  siteHint: (site) =>
    joinFacts([
      CROP_TYPE_LABELS[site.crop_type] || site.crop_type,
      locationLine(site),
      varietiesLine(site.crop_varieties),
    ]),
  questionnaireIntro:
    'Tell us about your growing practices so we can calculate the environmental impact of your grain growing.',
  renderAddDialog: ({ open, onOpenChange, onSuccess, editSite }) => (
    <AddArableFieldDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      editField={editSite}
    />
  ),
  renderQuestionnaire: ({ site, existingProfile, onComplete, onCancel }) => (
    <ArableGrowingQuestionnaire
      fieldId={site.id}
      fieldName={site.name}
      fieldHectares={site.hectares}
      cropType={site.crop_type}
      fieldClimateZone={site.climate_zone as 'wet' | 'dry' | 'temperate'}
      fieldCertification={site.certification}
      fieldCountryCode={site.location_country_code}
      fieldPreviousLandUse={site.previous_land_use_type}
      fieldLandConversionYear={site.land_conversion_year}
      existingProfile={existingProfile}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  ),
};
