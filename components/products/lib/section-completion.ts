/**
 * Section-completion utilities for the renovated Recipe sidebar.
 *
 * Single source of truth for "is this tab complete?" — used by:
 *   - IngredientEditorTabs / PackagingEditorTabs (per-tab status dot)
 *   - IngredientRow / PackagingRow (collapsed summary fraction)
 *   - RecipeSidebarTour (deciding whether to step a user through a tab)
 *
 * Pure functions only. No React imports.
 */

import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";

export type SectionStatus = "empty" | "incomplete" | "complete" | "n/a";

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export interface IngredientSectionStatuses {
  basics: SectionStatus;
  source: SectionStatus;
  logistics: SectionStatus;
  /** "n/a" when no production chain exists; otherwise empty/incomplete/complete. */
  stage: SectionStatus;
}

function ingredientBasicsStatus(i: IngredientFormData): SectionStatus {
  const hasName = !!i.name?.trim();
  const hasAmount = Number(i.amount) > 0;
  const hasUnit = !!i.unit;
  const filled = [hasName, hasAmount, hasUnit].filter(Boolean).length;
  if (filled === 0) return "empty";
  if (filled === 3) return "complete";
  return "incomplete";
}

function ingredientSourceStatus(i: IngredientFormData): SectionStatus {
  if (i.is_self_grown) {
    const linked = !!(i.vineyard_id || i.arable_field_id || i.orchard_id);
    return linked ? "complete" : "incomplete";
  }
  if (i.data_source === "supplier" && i.supplier_product_id) return "complete";
  if ((i.data_source === "openlca" || i.data_source === "ecoinvent") && i.data_source_id) {
    return "complete";
  }
  if (i.data_source) return "incomplete";
  return "empty";
}

function ingredientLogisticsStatus(i: IngredientFormData): SectionStatus {
  // Self-grown ingredients skip logistics entirely (no transport).
  if (i.is_self_grown) return "n/a";

  const hasOrigin = !!(i.origin_address || i.origin_country);
  const legs = i.transport_legs ?? [];
  const hasTransportLeg =
    legs.some((l) => Number(l.distanceKm) > 0) ||
    Number(i.distance_km) > 0;

  if (!hasOrigin && !hasTransportLeg) return "empty";
  if (hasOrigin && hasTransportLeg) return "complete";
  return "incomplete";
}

function ingredientStageStatus(i: IngredientFormData, hasChain: boolean): SectionStatus {
  if (!hasChain) return "n/a";
  return i.stage_id ? "complete" : "empty";
}

export function getIngredientSectionStatus(
  ingredient: IngredientFormData,
  hasChain: boolean,
): IngredientSectionStatuses {
  return {
    basics: ingredientBasicsStatus(ingredient),
    source: ingredientSourceStatus(ingredient),
    logistics: ingredientLogisticsStatus(ingredient),
    stage: ingredientStageStatus(ingredient, hasChain),
  };
}

// ---------------------------------------------------------------------------
// Packaging
// ---------------------------------------------------------------------------

export interface PackagingSectionStatuses {
  basics: SectionStatus;
  /** "n/a" when has_component_breakdown is off. */
  components: SectionStatus;
  logistics: SectionStatus;
  /** "n/a" until the user opts in to EPR data. */
  compliance: SectionStatus;
}

function packagingBasicsStatus(p: PackagingFormData): SectionStatus {
  const hasType = !!p.packaging_category;
  const hasName = !!p.name?.trim();
  const hasWeight = Number(p.net_weight_g) > 0;
  const hasSource = !!p.data_source;
  const filled = [hasType, hasName, hasWeight, hasSource].filter(Boolean).length;
  if (filled === 0) return "empty";
  if (filled === 4) return "complete";
  return "incomplete";
}

function packagingComponentsStatus(p: PackagingFormData): SectionStatus {
  if (!p.has_component_breakdown) return "n/a";
  const components = p.components ?? [];
  if (components.length === 0) return "empty";
  const totalWeight = components.reduce(
    (acc, c: any) => acc + (Number(c.weight_g) || 0),
    0,
  );
  if (totalWeight <= 0) return "incomplete";
  return "complete";
}

function packagingLogisticsStatus(p: PackagingFormData): SectionStatus {
  const hasOrigin = !!(p.origin_address || p.origin_country);
  const legs = p.transport_legs ?? [];
  const hasTransportLeg =
    legs.some((l) => Number(l.distanceKm) > 0) ||
    Number(p.distance_km) > 0;

  if (!hasOrigin && !hasTransportLeg) return "empty";
  if (hasOrigin && hasTransportLeg) return "complete";
  return "incomplete";
}

function packagingComplianceStatus(p: PackagingFormData): SectionStatus {
  // EPR fields are optional (UK-specific). Treat as n/a until any EPR field is set,
  // then promote to complete once the activity + UK nation pair is filled.
  const anyEprSet =
    !!p.epr_packaging_activity ||
    !!p.epr_uk_nation ||
    !!p.epr_ram_rating ||
    p.epr_is_drinks_container === true;
  if (!anyEprSet) return "n/a";
  const minimal = p.epr_packaging_activity && p.epr_uk_nation;
  return minimal ? "complete" : "incomplete";
}

export function getPackagingSectionStatus(p: PackagingFormData): PackagingSectionStatuses {
  return {
    basics: packagingBasicsStatus(p),
    components: packagingComponentsStatus(p),
    logistics: packagingLogisticsStatus(p),
    compliance: packagingComplianceStatus(p),
  };
}

// ---------------------------------------------------------------------------
// Summary helpers (used by collapsed row to render "X of N sections complete")
// ---------------------------------------------------------------------------

export interface SectionSummary {
  complete: number;
  total: number;
}

function summaryOf(statuses: SectionStatus[]): SectionSummary {
  const applicable = statuses.filter((s) => s !== "n/a");
  const complete = applicable.filter((s) => s === "complete").length;
  return { complete, total: applicable.length };
}

export function summariseIngredientSections(s: IngredientSectionStatuses): SectionSummary {
  return summaryOf([s.basics, s.source, s.logistics, s.stage]);
}

export function summarisePackagingSections(s: PackagingSectionStatuses): SectionSummary {
  return summaryOf([s.basics, s.components, s.logistics, s.compliance]);
}
