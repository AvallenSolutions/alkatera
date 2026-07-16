// Shared packaging row builder — the ONE write path that turns a catalogue
// match (format + material + weight) into a complete PackagingFormData row.
// Extracted from PackagingWizard so PackagingComposer (the one-line add) can
// reuse it exactly rather than growing a second inline row builder
// (see tasks/data-revolution-plan.md Pillar 2, "never reintroduce inline
// packaging row builders").

import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import type { PackagingDefaults } from "@/lib/constants/packaging-defaults";

let rowSeq = 0;
export const nextPackagingTempId = () => `temp-pkg-${Date.now()}-${rowSeq++}`;

/** Build a complete PackagingFormData row from the few fields a catalogue match sets. */
export function makePackagingRow(
  partial: Partial<PackagingFormData> & { name: string; packaging_category: PackagingCategory }
): PackagingFormData {
  return {
    tempId: nextPackagingTempId(),
    data_source: null,
    amount: '',
    unit: 'g',
    recycled_content_percentage: '',
    printing_process: 'standard_ink',
    net_weight_g: '',
    origin_country: '',
    transport_mode: 'truck',
    distance_km: '',
    has_component_breakdown: false,
    components: [],
    epr_is_household: true,
    epr_is_drinks_container: false,
    units_per_group: '',
    reuse_trips: '',
    recyclability_percent: '',
    end_of_life_pathway: '',
    biobased_content_percentage: '',
    ...partial,
  };
}

/** Apply a catalogue circularity-defaults block onto a row. */
export function applyPackagingDefaults(row: PackagingFormData, defaults: PackagingDefaults): PackagingFormData {
  return {
    ...row,
    recycled_content_percentage: defaults.recycled_content_percentage ?? row.recycled_content_percentage,
    recyclability_percent: defaults.recyclability_percent ?? row.recyclability_percent,
    reuse_trips: defaults.reuse_trips ?? row.reuse_trips,
    end_of_life_pathway: (defaults.end_of_life_pathway as PackagingFormData['end_of_life_pathway']) ?? row.end_of_life_pathway,
  };
}
