import { describe, it, expect } from 'vitest';
import {
  packagingToTemplateItem,
  templateItemToPackagingForm,
  type PackagingTemplateItem,
} from '../usePackagingTemplates';
import type { PackagingFormData } from '@/components/products/PackagingFormCard';
import { MATERIAL_CLASSES } from '@/lib/constants/packaging-material-classes';

/**
 * The template round-trip, which had no test at all until now. That is how
 * `packaging_material_class` and `packaging_material_variant` came to be
 * missing from both directions: a restored row came back with no class, the
 * next save NULLed the column, and the row then fell out of the parametric
 * factor path in the calculator and was matched by name instead, raising a
 * "predates packaging material classes" fallback warning.
 *
 * A template exists precisely to avoid re-entry, so anything that drives the
 * emission factor has to survive the trip.
 */

const GLASS_BOTTLE: PackagingFormData = {
  tempId: 'temp-pkg-1',
  name: '700ml Flint Bottle',
  matched_source_name: 'Glass bottle, flint',
  data_source: null,
  data_source_id: undefined,
  amount: 1,
  unit: 'g',
  packaging_category: 'container',
  packaging_material_class: 'glass',
  packaging_material_variant: 'flint',
  net_weight_g: 480,
  recycled_content_percentage: 51,
  printing_process: 'standard_ink',
  origin_country: 'FR',
  origin_country_code: 'FR',
  transport_mode: 'truck',
  distance_km: 420,
  has_component_breakdown: false,
  components: [],
  epr_packaging_activity: undefined,
  epr_is_household: null,
  epr_uk_nation: undefined,
  epr_is_drinks_container: true,
  units_per_group: '',
  container_format: 'bottle',
  container_material: 'glass',
  container_size_ml: 700,
} as PackagingFormData;

describe('packaging template round-trip', () => {
  it('carries the parametric material identity into the template', () => {
    const item = packagingToTemplateItem(GLASS_BOTTLE);
    expect(item.packaging_material_class).toBe('glass');
    expect(item.packaging_material_variant).toBe('flint');
  });

  it('restores the parametric material identity from the template', () => {
    const restored = templateItemToPackagingForm(packagingToTemplateItem(GLASS_BOTTLE));
    expect(restored.packaging_material_class).toBe('glass');
    expect(restored.packaging_material_variant).toBe('flint');
  });

  it('restores a class the calculator will treat as parametric', () => {
    // The specific failure: an undefined class means the row is not parametric,
    // so it is resolved by name search rather than from the endpoint table.
    const restored = templateItemToPackagingForm(packagingToTemplateItem(GLASS_BOTTLE));
    const classDef = MATERIAL_CLASSES[restored.packaging_material_class as keyof typeof MATERIAL_CLASSES];
    expect(classDef).toBeDefined();
    expect(classDef.kind).toBe('parametric');
  });

  it('preserves every field that drives the emission factor', () => {
    const restored = templateItemToPackagingForm(packagingToTemplateItem(GLASS_BOTTLE));
    // Class, variant and recycled content are the three inputs to
    // derivePackagingFactor; origin country picks the regional endpoint.
    expect(restored.packaging_material_class).toBe('glass');
    expect(restored.packaging_material_variant).toBe('flint');
    expect(restored.recycled_content_percentage).toBe(51);
    expect(restored.origin_country_code).toBe('FR');
    expect(restored.net_weight_g).toBe(480);
  });

  it('leaves an older template without the fields as an explicit null', () => {
    // Templates saved before this fix have no class. They must restore as null
    // rather than undefined so the save path writes a stable value and the
    // calculator's legacy-row inference can take over.
    const legacy = {
      ...packagingToTemplateItem(GLASS_BOTTLE),
      packaging_material_class: undefined,
      packaging_material_variant: undefined,
    } as PackagingTemplateItem;
    const restored = templateItemToPackagingForm(legacy);
    expect(restored.packaging_material_class).toBeNull();
    expect(restored.packaging_material_variant).toBeNull();
  });

  it('keeps EPR inheritance intact through the trip', () => {
    // Null means "inherit from the organisation". A template that stamped a
    // concrete value would pin every row it is applied to.
    const restored = templateItemToPackagingForm(packagingToTemplateItem(GLASS_BOTTLE));
    expect(restored.epr_is_household).toBeNull();
    expect(restored.epr_packaging_activity).toBeUndefined();
    expect(restored.epr_uk_nation).toBeUndefined();
  });
});
