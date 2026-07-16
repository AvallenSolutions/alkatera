"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Building2, Database, Sprout, Info, MapPin, Calculator, Award, Layers, Package, ChevronDown, ChevronUp, Plus, Leaf, Shield, CheckCircle2, Droplets, TreePine, HelpCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { MatchStatusBadge } from "@/components/products/MatchStatusBadge";
import { ProvenanceChip } from "@/components/studio/provenance-chip";
import { provenanceFromEfSourceType } from "@/lib/provenance";
import { autoMatchEmissionFactor } from "@/lib/products/ef-auto-match";
import { autoApplyConservativeProxy } from "@/lib/factors/auto-proxy";
import { VineyardSelector, type VineyardOption } from "@/components/vineyards/VineyardSelector";
import { ArableFieldSelector, type ArableFieldOption } from "@/components/arable-fields/ArableFieldSelector";
import { OrchardSelector, type OrchardOption } from "@/components/orchards/OrchardSelector";
import { useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/lib/organizationContext";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { isViticultureEligible } from "@/lib/viticulture-utils";
import { isArableEligible } from "@/lib/arable-utils";
import { isOrchardEligible } from "@/lib/orchard-utils";
import type { VineyardGrowingProfile } from "@/lib/types/viticulture";
import { LocationPicker, LocationData } from "@/components/shared/LocationPicker";
import type { DataSource } from "@/lib/types/lca";
import { calculateDistance } from "@/lib/utils/distance-calculator";
import { getTransportModeWarning, formatTransportMode, type TransportMode } from "@/lib/utils/transport-emissions-calculator";
import {
  generateLegId,
  calculateDistributionEmissions,
  type DistributionLeg,
  type DistributionResult,
} from "@/lib/distribution-factors";
import { INGREDIENT_UNITS, canonicaliseUnit, convertQuantity, findUnit, mapOpenLcaUnit, quantityToKg, unitKind, unitSizeToMl } from "@/lib/constants/material-units";
import { checkIngredientAmount } from "@/lib/constants/packaging-weight-ranges";
import { computeIngredientImpactPreview, formatPreviewKg } from "@/lib/products/impact-preview";
import { densityHintFor } from "@/lib/products/recipe-checks";
import { defaultTransportForOrigin, UNKNOWN_ORIGIN_DEFAULT } from "@/lib/constants/transport-defaults";
import { toast } from "sonner";

export interface IngredientFormData {
  tempId: string;
  name: string;
  matched_source_name?: string; // Database match name when proxy used
  data_source: DataSource | null;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  amount: number | string;
  unit: string;
  origin_country: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;
  is_organic_certified: boolean;
  transport_mode: 'truck' | 'train' | 'ship' | 'air';
  distance_km: number | string;
  // Multi-modal transport legs (replaces single transport_mode/distance_km when present)
  transport_legs?: DistributionLeg[] | null;
  carbon_intensity?: number;
  // Which OpenLCA database this factor comes from (ecoinvent or agribalyse)
  openlca_database?: string;
  // Emission factor metadata (for detail tooltip)
  ef_source?: string;
  ef_source_type?: string;
  ef_data_quality_grade?: string;
  ef_uncertainty_percent?: number;
  /** Raw reference unit of the selected emission factor (e.g. 'kg', 'l', 'Item(s)') */
  ef_reference_unit?: string;
  /** Emission factor provenance; null = legacy/unknown (no badge) */
  match_status?: import('@/lib/types/lca').MatchStatus | null;
  // Inbound delivery container (optional)
  inbound_container_type?: string | null;
  inbound_container_volume_l?: number | null;
  inbound_container_tare_kg?: number | null;
  inbound_container_reuse_cycles?: number | null;
  inbound_container_ef?: number | null;
  inbound_container_material?: string | null;
  // Self-grown ingredient (e.g. vineyard grapes, arable barley, orchard fruit)
  is_self_grown?: boolean;
  vineyard_id?: string | null;
  arable_field_id?: string | null;
  orchard_id?: string | null;
  // ISO 14067 §7: biogenic carbon classification
  is_biogenic_carbon?: boolean;
  // v2: production stage this ingredient belongs to (optional)
  stage_id?: string | null;
}

// ---------------------------------------------------------------------------
// Inbound container presets
// ---------------------------------------------------------------------------

export interface ContainerPreset {
  key: string;
  label: string;
  volume_l: number;
  tare_kg: number;
  reuse_cycles: number;
  is_reusable: boolean;
  material: string;
}

export const CONTAINER_PRESETS: ContainerPreset[] = [
  {
    key: 'ibc_1000l',
    label: 'IBC 1000L (composite)',
    volume_l: 1000,
    tare_kg: 57,  // HDPE inner bottle (~25kg) + steel cage (~20kg) + pallet base (~12kg) — IBCTanks.com industry standard
    reuse_cycles: 10,  // Industry avg for rental-pool IBCs (WRAP guidance)
    is_reusable: true,
    material: 'HDPE + steel',
  },
  {
    key: 'ibc_500l',
    label: 'IBC 500L (composite)',
    volume_l: 500,
    tare_kg: 45,  // Proportional estimate for composite 500L IBC — IBCTanks.com
    reuse_cycles: 10,  // Industry avg for rental-pool IBCs (WRAP guidance)
    is_reusable: true,
    material: 'HDPE + steel',
  },
  {
    key: 'drum_200l',
    label: 'Drum 200L (HDPE)',
    volume_l: 200,
    tare_kg: 10,  // Standard closed-head HDPE drum — industry manufacturer specs
    reuse_cycles: 1,
    is_reusable: false,
    material: 'HDPE',
  },
  {
    key: 'flexitank_24000l',
    label: 'Flexitank 24000L (LDPE)',
    volume_l: 24000,
    tare_kg: 48,  // LDPE bladder + steel support pipes + PP fabric + valves — LAF Technology specs
    reuse_cycles: 1,
    is_reusable: false,
    material: 'LDPE',
  },
  {
    key: 'bulk_tanker_25000l',
    label: 'Bulk tanker 25000L (stainless steel)',
    volume_l: 25000,
    tare_kg: 20000,  // Full tractor-trailer rig incl. stainless tank body
    reuse_cycles: 300,
    is_reusable: true,
    material: 'Stainless steel',
  },
  // Glass bottles — for ingredients purchased in retail units (spirits, liqueurs, etc.)
  {
    key: 'bottle_700ml_glass',
    label: 'Glass bottle 700ml (standard)',
    volume_l: 0.7,
    tare_kg: 0.40,
    reuse_cycles: 1,
    is_reusable: false,
    material: 'Glass',
  },
  {
    key: 'bottle_750ml_glass',
    label: 'Glass bottle 750ml (standard)',
    volume_l: 0.75,
    tare_kg: 0.45,
    reuse_cycles: 1,
    is_reusable: false,
    material: 'Glass',
  },
  {
    key: 'bottle_1l_glass',
    label: 'Glass bottle 1L (standard)',
    volume_l: 1.0,
    tare_kg: 0.50,
    reuse_cycles: 1,
    is_reusable: false,
    material: 'Glass',
  },
  {
    key: 'custom',
    label: 'Custom / manual entry',
    volume_l: 0,
    tare_kg: 0,
    reuse_cycles: 1,
    is_reusable: false,
    material: '',
  },
];

// kg CO₂e per kg of material — used for custom container EF lookup.
// Values from DEFRA 2025 / Ecoinvent 3.12 averages.
export const CONTAINER_MATERIAL_OPTIONS: { value: string; label: string; ef: number }[] = [
  { value: 'hdpe',       label: 'HDPE (high-density polyethylene)',   ef: 1.93 },
  { value: 'ldpe',       label: 'LDPE (low-density polyethylene)',    ef: 2.10 },
  { value: 'pp',         label: 'PP (polypropylene)',                 ef: 1.72 },
  { value: 'pet',        label: 'PET (polyethylene terephthalate)',   ef: 3.40 },
  { value: 'steel_mild', label: 'Steel (mild / carbon)',              ef: 1.46 },
  { value: 'steel_ss',   label: 'Stainless steel',                   ef: 2.89 },
  { value: 'aluminium',  label: 'Aluminium',                         ef: 8.24 },
  { value: 'glass',      label: 'Glass',                             ef: 0.85 },
  { value: 'cardboard',  label: 'Cardboard / fibreboard',            ef: 0.94 },
];

interface ProductionFacility {
  id: string;
  name: string;
  address_lat: number | null;
  address_lng: number | null;
  production_share?: number;
}

interface IngredientFormCardProps {
  ingredient: IngredientFormData;
  index: number;
  organizationId: string;
  productionFacilities: ProductionFacility[];
  totalLinkedFacilities?: number;
  organizationLat?: number | null;
  organizationLng?: number | null;
  linkedSupplierProducts?: any[];
  onUpdate: (tempId: string, updates: Partial<IngredientFormData>) => void;
  onRemove: (tempId: string) => void;
  canRemove: boolean;
  recipeScaleMode?: 'per_unit' | 'per_batch';
  batchYieldValue?: number | null;
  batchYieldUnit?: string | null;
  productUnitSizeValue?: number | null;
  productUnitSizeUnit?: string | null;
  /** Product category for benchmark-based impact previews */
  productCategory?: string | null;
  productionStages?: Array<{ id: string; ordinal: number; name: string; stage_type: string }>;
  /**
   * Render only one section (used by IngredientEditorTabs for the renovated
   * sectioned-expand UI). Default 'all' renders the original full card so
   * existing call sites keep working unchanged.
   */
  sectionFilter?: 'all' | 'basics' | 'source' | 'logistics' | 'stage';
}

// Quantity conversion between units lives in the shared vocabulary so the
// form, the calculator, and the DB constraint can never drift apart.
// Mass <-> volume conversions assume density ~1.0 kg/L; returns null for
// incompatible families (e.g. mass -> "unit") so the amount stays unchanged.
const convertAmount = convertQuantity;

function formatPerBottle(batchQty: number, unit: string, bottles: number): string {
  if (!batchQty || !bottles || bottles <= 0) return '–';
  const perBottle = batchQty / bottles;
  const u = (unit || '').toLowerCase();
  if (u === 'kg' && perBottle < 1) return `${(perBottle * 1000).toFixed(1)} g`;
  if (u === 'l' && perBottle < 1) return `${(perBottle * 1000).toFixed(1)} ml`;
  if (perBottle < 0.01) return `${perBottle.toFixed(4)} ${unit}`;
  return `${perBottle.toFixed(2)} ${unit}`;
}

/**
 * Live-preview helper: silently returns 1 when batch fields are incomplete so
 * the UI doesn't throw mid-typing. The authoritative calculator throws on the
 * same inputs and surfaces a calculation error there.
 */
function computeIngredientBottlesPerBatch(input: {
  recipeScaleMode: 'per_unit' | 'per_batch';
  batchYieldValue: number | null;
  batchYieldUnit: string | null;
  productUnitSizeValue: number | null;
  productUnitSizeUnit: string | null;
}): number {
  if (input.recipeScaleMode !== 'per_batch') return 1;
  const yieldValue = input.batchYieldValue;
  const yieldUnit = (input.batchYieldUnit || '').toLowerCase();
  if (!yieldValue || yieldValue <= 0 || !yieldUnit) return 1;
  if (yieldUnit === 'bottles' || yieldUnit === 'units') return yieldValue;
  const yieldToL: Record<string, number> = { ml: 0.001, l: 1, hl: 100, kl: 1000 };
  const sizeToL: Record<string, number> = { ml: 0.001, l: 1 };
  const yFactor = yieldToL[yieldUnit];
  const sFactor = sizeToL[(input.productUnitSizeUnit || '').toLowerCase()];
  if (!yFactor || !sFactor || !input.productUnitSizeValue) return 1;
  const batchLitres = yieldValue * yFactor;
  const bottleLitres = input.productUnitSizeValue * sFactor;
  if (bottleLitres <= 0) return 1;
  return batchLitres / bottleLitres;
}

// Transport mode display labels (used in multi-leg UI)
const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
  { value: 'truck', label: 'Road (HGV)' },
  { value: 'train', label: 'Rail Freight' },
  { value: 'ship', label: 'Sea Freight' },
  { value: 'air',   label: 'Air Freight' },
];

export function IngredientFormCard({
  ingredient,
  index,
  organizationId,
  productionFacilities,
  totalLinkedFacilities = 0,
  organizationLat,
  organizationLng,
  linkedSupplierProducts,
  onUpdate,
  onRemove,
  canRemove,
  recipeScaleMode = 'per_unit',
  batchYieldValue = null,
  batchYieldUnit = null,
  productUnitSizeValue = null,
  productUnitSizeUnit = null,
  productCategory = null,
  productionStages = [],
  sectionFilter = 'all',
}: IngredientFormCardProps) {
  const showAll = sectionFilter === 'all';
  const showBasics = showAll || sectionFilter === 'basics';
  const showSource = showAll || sectionFilter === 'source';
  const showLogistics = showAll || sectionFilter === 'logistics';
  const showStage = showAll || sectionFilter === 'stage';
  const bottlesPerBatch = computeIngredientBottlesPerBatch({
    recipeScaleMode,
    batchYieldValue,
    batchYieldUnit,
    productUnitSizeValue,
    productUnitSizeUnit,
  });
  const isBatchMode = recipeScaleMode === 'per_batch' && bottlesPerBatch > 1;

  // Unit-kind cross-check: the quantity's unit family (mass/volume/count)
  // should match the selected factor's reference unit family. Mass and
  // volume interconvert at density ~1 in the calculator, so only the
  // genuinely incompatible case is flagged: count vs anything else.
  const unitMismatch = (() => {
    if (!ingredient.ef_reference_unit) return null;
    const refUnit = mapOpenLcaUnit(ingredient.ef_reference_unit);
    if (!refUnit) return null;
    const refKind = unitKind(refUnit);
    const enteredKind = unitKind(ingredient.unit);
    if (!refKind || !enteredKind || refKind === enteredKind) return null;
    if (refKind !== 'count' && enteredKind !== 'count') return null;
    return { refUnit, refKind, enteredKind };
  })();

  // Live impact preview: converts the chosen factor + amount into a visible
  // per-unit number and a share of a typical product's footprint, so a wrong
  // factor or amount shows up as a weird number rather than staying invisible.
  const impactPreview = computeIngredientImpactPreview({
    amount: ingredient.amount,
    unit: ingredient.unit,
    carbonIntensity: ingredient.carbon_intensity,
    bottlesPerBatch,
    unitSizeMl: unitSizeToMl(productUnitSizeValue, productUnitSizeUnit),
    category: productCategory,
  });

  // Plausibility: does this amount make physical sense per product unit?
  // Catches batch quantities entered as per-unit values. Advisory only.
  const amountCheck = (() => {
    const unitDef = findUnit(ingredient.unit);
    const amount = Number(ingredient.amount);
    if (!unitDef?.toKg || !amount || amount <= 0) return { level: 'ok' as const };
    const unitSizeMl = unitSizeToMl(productUnitSizeValue, productUnitSizeUnit);
    return checkIngredientAmount({
      amountKgPerUnit: (quantityToKg(amount, unitDef) ?? 0) / bottlesPerBatch,
      unitSizeMl,
      ingredientName: ingredient.name,
    });
  })();

  const { hasFeature } = useSubscription();
  const { currentOrganization } = useOrganization();
  const { isAlkateraAdmin } = useIsAlkateraAdmin();
  const showViticultureToggle = hasFeature('viticulture_beta') && isViticultureEligible(currentOrganization, isAlkateraAdmin);
  const showArableToggle = hasFeature('arable_beta') && isArableEligible(currentOrganization as any, isAlkateraAdmin);
  const showOrchardToggle = hasFeature('orchard_beta') && isOrchardEligible(currentOrganization as any, isAlkateraAdmin);

  const [containerOpen, setContainerOpen] = useState<boolean>(
    !!(ingredient.inbound_container_type)
  );
  const [transportPreview, setTransportPreview] = useState<DistributionResult | null>(null);
  const [transportPreviewLoading, setTransportPreviewLoading] = useState(false);

  // Viticulture growing profile state
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardOption | null>(null);
  const [growingProfile, setGrowingProfile] = useState<VineyardGrowingProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Fetch growing profile when vineyard changes
  useEffect(() => {
    if (!ingredient.vineyard_id || !ingredient.is_self_grown) {
      setGrowingProfile(null);
      return;
    }
    setLoadingProfile(true);
    fetch(`/api/vineyards/${ingredient.vineyard_id}/growing-profile`)
      .then((res) => res.ok ? res.json() : { data: null })
      .then(({ data }) => setGrowingProfile(data || null))
      .catch(() => setGrowingProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [ingredient.vineyard_id, ingredient.is_self_grown]);

  // Factor selection abolished as a user task (tasks/data-revolution-plan.md,
  // Pillar 2): once a name is typed and no factor is attached yet, try a
  // confident auto-match first (same gate the wizard uses) and fall back to
  // a conservative proxy so the row always computes — the user is never
  // required to open the search picker below. Runs once per row (the ref
  // guards against re-firing while the async match is in flight or after it
  // resolves) so a later manual pick is never fought.
  const autoMatchAttemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (ingredient.is_self_grown) return;
    if (ingredient.matched_source_name) return;
    const name = ingredient.name.trim();
    if (name.length < 3) return;
    if (autoMatchAttemptedRef.current.has(ingredient.tempId)) return;

    const timer = setTimeout(async () => {
      autoMatchAttemptedRef.current.add(ingredient.tempId);
      const confident = await autoMatchEmissionFactor({ query: name, organizationId, materialType: 'ingredient' });
      if (confident) {
        onUpdate(ingredient.tempId, {
          matched_source_name: confident.matched_source_name,
          data_source: confident.data_source,
          data_source_id: confident.data_source_id,
          supplier_product_id: confident.supplier_product_id,
          carbon_intensity: confident.carbon_intensity,
          openlca_database: confident.openlca_database,
          ef_source: confident.ef_source,
          ef_source_type: confident.ef_source_type,
          ef_data_quality_grade: confident.ef_data_quality_grade,
          ef_uncertainty_percent: confident.ef_uncertainty_percent,
          match_status: 'auto_matched',
        });
        return;
      }
      const proxy = await autoApplyConservativeProxy({ query: name, organizationId, materialType: 'ingredient' });
      onUpdate(ingredient.tempId, {
        matched_source_name: proxy.matched_source_name,
        data_source: proxy.data_source,
        data_source_id: proxy.data_source_id,
        carbon_intensity: proxy.carbon_intensity,
        ef_source: proxy.ef_source,
        ef_source_type: proxy.ef_source_type,
        ef_data_quality_grade: proxy.ef_data_quality_grade,
        ef_uncertainty_percent: proxy.ef_uncertainty_percent,
        // Still 'auto_matched': a proxy is applied automatically just like a
        // confident match, so it gets the same "please check" badge; the
        // ProvenanceChip alongside it (ef_source_type === 'proxy') is what
        // tells the two apart.
        match_status: 'auto_matched',
      });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient.name, ingredient.is_self_grown, ingredient.matched_source_name, ingredient.tempId, organizationId]);

  // The factor picker is a "full record" workshop control now, not a step
  // everyone takes: collapsed the moment a factor is attached (auto-matched
  // or a proxy), open only while nothing has matched yet or the user asks
  // for it via "Not right? Choose yourself." Once the user has toggled it by
  // hand, later auto-match results stop moving it.
  const [factorPickerOpen, setFactorPickerOpen] = useState<boolean>(!ingredient.matched_source_name);
  const factorPickerUserToggledRef = useRef(false);
  useEffect(() => {
    if (factorPickerUserToggledRef.current) return;
    setFactorPickerOpen(!ingredient.matched_source_name);
  }, [ingredient.matched_source_name]);
  const toggleFactorPicker = () => {
    factorPickerUserToggledRef.current = true;
    setFactorPickerOpen((v) => !v);
  };

  // Arable field growing profile state
  const [selectedArableField, setSelectedArableField] = useState<ArableFieldOption | null>(null);
  const [arableProfile, setArableProfile] = useState<any | null>(null);
  const [loadingArableProfile, setLoadingArableProfile] = useState(false);

  useEffect(() => {
    if (!ingredient.arable_field_id || !ingredient.is_self_grown) {
      setArableProfile(null);
      return;
    }
    setLoadingArableProfile(true);
    fetch(`/api/arable-fields/${ingredient.arable_field_id}/growing-profile`)
      .then((res) => res.ok ? res.json() : { data: null })
      .then(({ data }) => {
        // The route may return an array (multi-harvest) or a single profile.
        if (Array.isArray(data)) setArableProfile(data[0] || null);
        else setArableProfile(data || null);
      })
      .catch(() => setArableProfile(null))
      .finally(() => setLoadingArableProfile(false));
  }, [ingredient.arable_field_id, ingredient.is_self_grown]);

  // Orchard growing profile state
  const [selectedOrchard, setSelectedOrchard] = useState<OrchardOption | null>(null);
  const [orchardProfile, setOrchardProfile] = useState<any | null>(null);
  const [loadingOrchardProfile, setLoadingOrchardProfile] = useState(false);

  useEffect(() => {
    if (!ingredient.orchard_id || !ingredient.is_self_grown) {
      setOrchardProfile(null);
      return;
    }
    setLoadingOrchardProfile(true);
    fetch(`/api/orchards/${ingredient.orchard_id}/growing-profile`)
      .then((res) => res.ok ? res.json() : { data: null })
      .then(({ data }) => {
        if (Array.isArray(data)) setOrchardProfile(data[0] || null);
        else setOrchardProfile(data || null);
      })
      .catch(() => setOrchardProfile(null))
      .finally(() => setLoadingOrchardProfile(false));
  }, [ingredient.orchard_id, ingredient.is_self_grown]);

  const getContainerPreset = (key: string | null | undefined): ContainerPreset | undefined =>
    CONTAINER_PRESETS.find((p) => p.key === key);

  /** Live impact preview shown in the container section (kg CO₂e per product unit). */
  const getContainerImpactPreview = (): { value: number; warning?: string } | null => {
    const preset = getContainerPreset(ingredient.inbound_container_type);
    if (!preset && ingredient.inbound_container_type !== 'custom') return null;

    const tare = Number(ingredient.inbound_container_tare_kg ?? (preset?.tare_kg ?? 0));
    const volume = Number(ingredient.inbound_container_volume_l ?? (preset?.volume_l ?? 0));
    const cycles = Math.max(1, Number(ingredient.inbound_container_reuse_cycles ?? (preset?.reuse_cycles ?? 1)));
    // EF: use manual override first, then preset approximation, then material lookup for custom
    const EF_APPROX: Record<string, number> = {
      ibc_1000l: 1.93, ibc_500l: 1.93, drum_200l: 1.93,
      flexitank_24000l: 2.10, bulk_tanker_25000l: 2.89,
      bottle_700ml_glass: 0.85, bottle_750ml_glass: 0.85, bottle_1l_glass: 0.85,
    };
    const materialEf = ingredient.inbound_container_type === 'custom' && ingredient.inbound_container_material
      ? (CONTAINER_MATERIAL_OPTIONS.find(m => m.value === ingredient.inbound_container_material)?.ef ?? 0)
      : 0;
    const ef = Number(ingredient.inbound_container_ef ?? EF_APPROX[ingredient.inbound_container_type ?? ''] ?? materialEf);

    if (!ef || !tare || !volume) return null;

    const qty = Number(ingredient.amount) / bottlesPerBatch;
    const unit = (ingredient.unit || '').toLowerCase();
    let warning: string | undefined;

    const VOLUME_UNITS = ['l', 'litre', 'litres', 'liter', 'liters', 'ml', 'millilitre', 'millilitres'];
    const MASS_UNITS   = ['kg', 'kilogram', 'kilograms', 'g', 'gram', 'grams'];

    const MILLILITRE_UNITS = ['ml', 'millilitre', 'millilitres'];
    const GRAM_UNITS = ['g', 'gram', 'grams'];

    let ingredientLitres: number;
    if (VOLUME_UNITS.includes(unit)) {
      // normaliseToKg treats L as 1:1 with kg, so qty is already in "litre-equivalent"
      ingredientLitres = MILLILITRE_UNITS.includes(unit) ? qty / 1000 : qty;
    } else if (MASS_UNITS.includes(unit)) {
      ingredientLitres = GRAM_UNITS.includes(unit) ? qty / 1000 : qty; // density ≈ 1 kg/L
      warning = 'Using 1 kg ≈ 1 L, consider switching to litres for spirits';
    } else {
      return null; // unit type (e.g. "unit") — can't calculate
    }

    if (!ingredientLitres || ingredientLitres <= 0) return null;

    const efPerFill   = (ef * tare) / cycles;
    const fillFraction = ingredientLitres / volume;
    const co2PerUnit   = efPerFill * fillFraction;

    return { value: co2PerUnit, warning };
  };

  // ---------------------------------------------------------------------------
  // Multi-modal inbound transport helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive the current transport legs from ingredient state.
   * Prefers transport_legs when set; falls back to single transport_mode/distance_km
   * so that existing ingredients load correctly without migration.
   */
  const legs: DistributionLeg[] = (() => {
    if (ingredient.transport_legs && ingredient.transport_legs.length > 0) {
      return ingredient.transport_legs;
    }
    return [{
      id: 'leg_0_legacy',
      label: '',
      transportMode: (ingredient.transport_mode || 'truck') as TransportMode,
      distanceKm: Number(ingredient.distance_km || 0),
    }];
  })();

  /**
   * Get the primary production facility / org fallback as the shipment destination.
   * Returns coords + display label.
   */
  const getDestinationCoords = (): { lat: number; lng: number; label: string } | null => {
    const sorted = [...productionFacilities].sort(
      (a, b) => (b.production_share || 0) - (a.production_share || 0)
    );
    const fac = sorted.find((f) => f.address_lat && f.address_lng);
    if (fac) return { lat: fac.address_lat!, lng: fac.address_lng!, label: fac.name };
    if (organizationLat && organizationLng) return { lat: organizationLat, lng: organizationLng, label: 'Your location' };
    return null;
  };

  /**
   * Recompute distanceKm for every leg from coordinate data.
   * - Leg 0 "from" = ingredient origin (or overrideOriginLat/Lng when origin just changed).
   * - Leg N "from" = legs[N-1].toLat/toLng.
   * - Last leg "to" = production facility / org fallback.
   * - Non-last leg "to" = leg.toLat/toLng (user-picked waypoint).
   * Falls back to the stored distanceKm when coordinates are missing.
   */
  const recomputeDistances = (
    legsInput: DistributionLeg[],
    overrideOriginLat?: number,
    overrideOriginLng?: number,
  ): DistributionLeg[] => {
    const dest = getDestinationCoords();
    const oLat = overrideOriginLat ?? ingredient.origin_lat;
    const oLng = overrideOriginLng ?? ingredient.origin_lng;

    return legsInput.map((leg, idx) => {
      const isLast = idx === legsInput.length - 1;
      const fromLat = idx === 0 ? oLat : legsInput[idx - 1].toLat;
      const fromLng = idx === 0 ? oLng : legsInput[idx - 1].toLng;
      const toLat   = isLast ? dest?.lat : leg.toLat;
      const toLng   = isLast ? dest?.lng : leg.toLng;

      if (fromLat && fromLng && toLat && toLng) {
        return { ...leg, distanceKm: Math.round(calculateDistance(fromLat, fromLng, toLat, toLng)) };
      }
      return leg; // keep stored distanceKm as fallback
    });
  };

  /** Persist legs array, always recomputing distances first. */
  const updateLegs = (newLegs: DistributionLeg[]) => {
    const recomputed = recomputeDistances(newLegs);
    const first = recomputed[0];
    onUpdate(ingredient.tempId, {
      transport_legs: recomputed,
      transport_mode: (first?.transportMode ?? 'truck') as any,
      distance_km: first?.distanceKm ?? 0,
    });
  };

  const addTransportLeg = () => {
    updateLegs([...legs, {
      id: generateLegId(),
      label: '',
      transportMode: 'truck',
      distanceKm: 0,
    }]);
  };

  const removeTransportLeg = (legId: string) => {
    const filtered = legs.filter((l) => l.id !== legId);
    updateLegs(filtered.length > 0 ? filtered : [{
      id: generateLegId(),
      label: '',
      transportMode: 'truck',
      distanceKm: 0,
    }]);
  };

  const updateTransportLeg = (legId: string, partial: Partial<DistributionLeg>) => {
    updateLegs(legs.map((leg) => leg.id === legId ? { ...leg, ...partial } : leg));
  };

  // Live transport preview — debounced, only shown with 2+ legs
  useEffect(() => {
    if (legs.length < 2) {
      setTransportPreview(null);
      return;
    }
    const hasValidLeg = legs.some((l) => l.distanceKm > 0);
    if (!hasValidLeg) {
      setTransportPreview(null);
      return;
    }

    const qty = (Number(ingredient.amount) || 0) / bottlesPerBatch;
    const unit = (ingredient.unit || 'kg').toLowerCase();
    let weightKg = qty;
    if (unit === 'ml') weightKg = qty / 1000;
    else if (unit === 'g') weightKg = qty / 1000;
    else if (unit === 'l') weightKg = qty;
    if (weightKg <= 0) { setTransportPreview(null); return; }

    const timer = setTimeout(async () => {
      setTransportPreviewLoading(true);
      try {
        const result = await calculateDistributionEmissions({ legs, productWeightKg: weightKg });
        setTransportPreview(result);
      } catch (err) {
        console.error('[IngredientFormCard] Transport preview failed:', err);
        setTransportPreview(null);
      } finally {
        setTransportPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [ingredient.transport_legs, ingredient.transport_mode, ingredient.distance_km, ingredient.amount, ingredient.unit, bottlesPerBatch]);

  // ---------------------------------------------------------------------------

  const getDataSourceBadge = () => {
    if (!ingredient.data_source) return null;

    switch (ingredient.data_source) {
      case 'supplier':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <Award className="h-3 w-3 mr-1.5 text-studio-good" />
                Supplier Verified (High Quality)
              </Badge>
              <span className="text-xs text-muted-foreground">95% confidence</span>
            </div>
            {ingredient.supplier_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>From: <span className="font-medium text-foreground">{ingredient.supplier_name}</span></span>
              </div>
            )}
          </div>
        );
      case 'staging':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Layers className="h-3 w-3 mr-1.5 text-studio-hold" />
              Hybrid Source (DEFRA + Ecoinvent)
            </Badge>
            <span className="text-xs text-muted-foreground">80% confidence</span>
          </div>
        );
      case 'ecoinvent':
      case 'openlca':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Database className="h-3 w-3 mr-1.5 text-studio-dim" />
              Ecoinvent Database (Medium Quality)
            </Badge>
            <span className="text-xs text-muted-foreground">70% confidence</span>
          </div>
        );
      case 'primary':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Sprout className="h-3 w-3 mr-1.5 text-studio-good" />
              Custom Primary Data
            </Badge>
            <span className="text-xs text-muted-foreground">90% confidence</span>
          </div>
        );
      default:
        return null;
    }
  };

  const calculateAndSetDistance = (originLat: number, originLng: number) => {
    // Step 1: Identify the primary production facility for this product
    let targetFacility: { lat: number; lng: number } | null = null;

    if (productionFacilities.length > 0) {
      // Find the facility with the highest production share, or use the first one
      const sortedFacilities = [...productionFacilities].sort((a, b) => {
        const shareA = a.production_share || 0;
        const shareB = b.production_share || 0;
        return shareB - shareA;
      });

      // Get the first facility with valid coordinates
      for (const facility of sortedFacilities) {
        if (facility.address_lat && facility.address_lng) {
          targetFacility = {
            lat: facility.address_lat,
            lng: facility.address_lng,
          };
          console.log(`[Distance] Using facility: ${facility.name} (${facility.address_lat}, ${facility.address_lng})`);
          break;
        }
      }
    }

    // Step 2: Fall back to organization location if no production facilities
    if (!targetFacility && organizationLat && organizationLng) {
      targetFacility = {
        lat: organizationLat,
        lng: organizationLng,
      };
      console.log(`[Distance] Using organization location: (${organizationLat}, ${organizationLng})`);
    }

    // Step 3: If no location data available, return 0
    if (!targetFacility) {
      console.warn('[Distance] No facility or organization location available');
      return 0;
    }

    // Step 4: Calculate distance between ONLY these two specific locations
    const distance = calculateDistance(originLat, originLng, targetFacility.lat, targetFacility.lng);
    console.log(`[Distance] From (${originLat}, ${originLng}) to (${targetFacility.lat}, ${targetFacility.lng}) = ${distance} km`);

    return Math.round(distance);
  };

  const handleSearchSelect = (selection: {
    name: string;
    user_query?: string;
    data_source: DataSource;
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit: string;
    ef_reference_unit?: string;
    auto_matched?: boolean;
    carbon_intensity?: number;
    location?: string;
    ef_source?: string;
    ef_source_type?: string;
    ef_data_quality_grade?: string;
    ef_uncertainty_percent?: number;
    openlca_database?: string;
  }) => {
    // Preserve the user's real ingredient name, store DB match name separately
    const userOriginalName = selection.user_query || selection.name;

    console.log('[IngredientFormCard] handleSearchSelect received:', {
      name: selection.name,
      user_query: selection.user_query,
      userOriginalName,
      data_source: selection.data_source,
      data_source_id: selection.data_source_id,
    });

    const updates: Partial<IngredientFormData> = {
      // Auto-fill the display name from the DB match only if user hasn't entered one yet
      ...(!ingredient.name ? { name: selection.name } : {}),
      matched_source_name: selection.name,
      data_source: selection.data_source,
      data_source_id: selection.data_source_id,
      supplier_product_id: selection.supplier_product_id,
      supplier_name: selection.supplier_name,
      carbon_intensity: selection.carbon_intensity,
      // Emission factor metadata for tooltip
      ef_source: selection.ef_source,
      ef_source_type: selection.ef_source_type,
      ef_data_quality_grade: selection.ef_data_quality_grade,
      ef_uncertainty_percent: selection.ef_uncertainty_percent,
      openlca_database: selection.openlca_database,
      // Remember the factor's reference unit so a quantity entered in an
      // incompatible unit kind (mass vs volume vs count) can be flagged.
      ef_reference_unit: selection.ef_reference_unit,
      // Apply + flag: software picks need a one-click confirmation, the
      // user's own picks are verified immediately.
      match_status: selection.auto_matched ? 'auto_matched' : 'verified',
      // Only prefill unit from search result when ingredient has no amount set
      // yet (first selection), and only when the factor's unit is known and in
      // our vocabulary. An unknown unit must never silently become 'kg'.
      ...(!ingredient.amount && selection.unit && canonicaliseUnit(selection.unit)
        ? { unit: canonicaliseUnit(selection.unit)! }
        : {}),
      // Map search location to origin_address (the field actually saved to DB).
      // Only prefill if user hasn't already set an origin address.
      ...(!ingredient.origin_address && selection.location ? { origin_address: selection.location } : {}),
    };

    console.log('[IngredientFormCard] Calling onUpdate with:', updates);
    onUpdate(ingredient.tempId, updates);
  };

  // Filter linked supplier products for ingredient context.
  // product_type defaults to 'ingredient' on legacy rows even for packaging
  // suppliers (e.g. Frugalpac), so any packaging signal — packaging_category,
  // weight_g, primary_material or epr_material_code — disqualifies a row from
  // the ingredient list.
  const looksLikePackaging = (p: any) =>
    !!p.packaging_category ||
    p.weight_g != null ||
    !!p.primary_material ||
    !!p.epr_material_code ||
    (typeof p.category === 'string' && p.category.toLowerCase().startsWith('packaging'));
  const ingredientSupplierProducts = (linkedSupplierProducts || []).filter(
    (p: any) => p.product_type === 'ingredient' && !looksLikePackaging(p)
  );

  const handleSupplierProductSelect = (product: any) => {
    // Resolve origin: prefer product-level origin, fall back to supplier-level location
    const originAddress = product.origin_address || product.supplier_address
      || [product.supplier_city, product.supplier_country].filter(Boolean).join(', ')
      || undefined;
    const originLat = product.origin_lat ?? product.supplier_lat ?? undefined;
    const originLng = product.origin_lng ?? product.supplier_lng ?? undefined;
    const originCountryCode = product.origin_country_code ?? product.supplier_country_code ?? undefined;

    onUpdate(ingredient.tempId, {
      name: product.name,
      matched_source_name: product.name,
      data_source: 'supplier',
      data_source_id: product.id,
      supplier_product_id: product.id,
      supplier_name: product.supplier_name,
      carbon_intensity: product.impact_climate ?? product.carbon_intensity ?? undefined,
      ef_source: 'Primary Verified',
      ef_source_type: 'primary',
      match_status: 'verified',
      ...(!ingredient.amount ? { unit: product.unit || 'kg' } : {}),
      // Origin/location data from supplier product or supplier profile
      ...(originAddress ? { origin_address: originAddress } : {}),
      ...(originLat != null ? { origin_lat: originLat } : {}),
      ...(originLng != null ? { origin_lng: originLng } : {}),
      ...(originCountryCode ? { origin_country_code: originCountryCode, origin_country: originCountryCode } : {}),
    });
  };

  // Inline render: defining Wrapper as a component inside render would change
  // its function identity every render and force React to unmount/remount the
  // entire subtree on every keystroke (which broke the Emission Factor search
  // input's focus). Render conditionally with stable element types instead.
  const renderWrapper = (children: React.ReactNode) =>
    showAll ? (
      <Card className="rounded-[6px] border border-border bg-card">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim pt-1">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-semibold text-foreground">
                  Ingredient {index + 1}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use smart search to find ingredients with environmental data
                </p>
              </div>
            </div>
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(ingredient.tempId)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {children}
        </div>
      </Card>
    ) : (
      <div className="space-y-4">{children}</div>
    );

  return renderWrapper(
    (
        <div className="space-y-4">
          {showBasics && <>
          {/* Supplier product suggestions - shown above name when available */}
          {ingredientSupplierProducts.length > 0 && !ingredient.supplier_product_id && (
            <div className="rounded-[6px] border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-studio-good" />
                <span className="text-xs font-medium text-foreground">
                  From your suppliers
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ingredientSupplierProducts.slice(0, 6).map((product: any) => {
                  const climateVal = product.impact_climate ?? product.carbon_intensity;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSupplierProductSelect(product)}
                      className="flex items-center gap-2 px-3 py-2 rounded-[6px] border border-border bg-card hover:border-room-accent transition-all text-left"
                    >
                      <Shield className="h-3.5 w-3.5 text-studio-good shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{product.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{product.supplier_name}</span>
                          {climateVal != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {climateVal.toFixed(3)} kg CO₂e
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show primary data indicator when supplier product is selected */}
          {ingredient.supplier_product_id && ingredient.data_source === 'supplier' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] border border-border bg-card">
              <CheckCircle2 className="h-4 w-4 text-studio-good shrink-0" />
              <span className="text-xs text-foreground">
                Using primary data from <span className="font-medium">{ingredient.supplier_name || 'supplier'}</span>
              </span>
              <button
                type="button"
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onUpdate(ingredient.tempId, {
                  name: '',
                  matched_source_name: undefined,
                  data_source: null,
                  data_source_id: undefined,
                  supplier_product_id: undefined,
                  supplier_name: undefined,
                  carbon_intensity: undefined,
                  ef_source: undefined,
                  ef_source_type: undefined,
                })}
              >
                Clear
              </button>
            </div>
          )}

          <div>
            <Label htmlFor={`name-${ingredient.tempId}`}>
              Ingredient Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`name-${ingredient.tempId}`}
              value={ingredient.name}
              onChange={(e) => onUpdate(ingredient.tempId, { name: e.target.value })}
              placeholder="e.g. Simpsons Golden Promise Pale Ale Malt"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The full display name for this ingredient as it appears on your recipe
            </p>
          </div>

          {!ingredient.is_self_grown && (
          <div>
            <Label htmlFor={`search-${ingredient.tempId}`} className="flex items-center gap-2">
              Emission Factor <span className="text-destructive">*</span>
              <MatchStatusBadge
                status={ingredient.match_status}
                onConfirm={() => onUpdate(ingredient.tempId, { match_status: 'verified' })}
              />
              {ingredient.ef_source_type === 'proxy' && (
                <ProvenanceChip provenance={provenanceFromEfSourceType(ingredient.ef_source_type)} compact />
              )}
            </Label>

            {/* Factor selection is a "full record" control, not a step everyone
                takes: once something has matched, show a quiet summary and hide
                the search behind a link instead of the picker itself. */}
            {ingredient.matched_source_name && !factorPickerOpen ? (
              <div className="flex items-center justify-between gap-2 rounded-[6px] border border-border bg-card px-3 py-2">
                <span className="truncate text-sm text-foreground">{ingredient.matched_source_name}</span>
                <button
                  type="button"
                  onClick={toggleFactorPicker}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
                >
                  Not right? Choose yourself.
                </button>
              </div>
            ) : (
            <>
            <InlineIngredientSearch
              organizationId={organizationId}
              value={ingredient.matched_source_name || ''}
              placeholder="Search databases for emission factor..."
              onSelect={handleSearchSelect}
              onChange={() => onUpdate(ingredient.tempId, { matched_source_name: undefined, data_source: null, data_source_id: undefined, ef_source: undefined, ef_source_type: undefined, ef_data_quality_grade: undefined, ef_uncertainty_percent: undefined })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Search for the closest matching emission factor from supplier data or global databases
            </p>
            </>
            )}
            {factorPickerOpen && ingredient.matched_source_name && ingredient.matched_source_name !== ingredient.name && ingredient.data_source !== 'supplier' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs cursor-help">
                      <Database className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300">
                        Calculating with the closest match: <span className="font-medium">{ingredient.matched_source_name}</span>.
                        {' '}There is no exact entry for this ingredient, so a close equivalent is used. Your result stays valid, and you can refine it any time.
                      </span>
                      {(ingredient.carbon_intensity || ingredient.ef_source) && (
                        <Info className="h-3 w-3 text-amber-400 dark:text-amber-500 shrink-0 ml-auto" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {(ingredient.carbon_intensity || ingredient.ef_source || ingredient.ef_data_quality_grade) && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        {ingredient.carbon_intensity != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">CO₂e intensity</span>
                            <span className="font-medium">{ingredient.carbon_intensity.toFixed(3)} kg CO₂e/{ingredient.unit || 'kg'}</span>
                          </div>
                        )}
                        {ingredient.ef_source && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Source</span>
                            <span className="font-medium">{ingredient.ef_source}</span>
                          </div>
                        )}
                        {ingredient.ef_data_quality_grade && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Data quality</span>
                            <span className="font-medium">{ingredient.ef_data_quality_grade}</span>
                          </div>
                        )}
                        {ingredient.origin_address && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Geography</span>
                            <span className="font-medium">{ingredient.origin_address}</span>
                          </div>
                        )}
                        {ingredient.ef_uncertainty_percent != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Uncertainty</span>
                            <span className="font-medium">±{ingredient.ef_uncertainty_percent}%</span>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          )}

          {/* Search first: the quantity only appears once the ingredient has
              an identity (a name or a matched factor), so the unit can be
              defaulted from the factor's reference unit instead of guessed. */}
          {!(ingredient.name || ingredient.matched_source_name) ? (
            <p className="text-xs text-muted-foreground italic">
              Find your ingredient above first. The amount comes next.
            </p>
          ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`amount-${ingredient.tempId}`}>
                {isBatchMode ? 'Quantity per batch' : 'Amount'} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`amount-${ingredient.tempId}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={ingredient.amount}
                onChange={(e) => onUpdate(ingredient.tempId, { amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isBatchMode
                  ? `Total used per batch, divided by ${bottlesPerBatch.toFixed(0)} bottles`
                  : 'Quantity used per product unit'}
              </p>
              {isBatchMode && Number(ingredient.amount) > 0 && (
                <p className="text-xs text-studio-good mt-1">
                  ≈ {formatPerBottle(Number(ingredient.amount), ingredient.unit, bottlesPerBatch)} per bottle
                </p>
              )}
              {impactPreview && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {formatPreviewKg(impactPreview.perUnitKgCo2e)} kg CO₂e per unit
                  {impactPreview.shareOfBenchmark != null && impactPreview.shareOfBenchmark >= 0.01 && (
                    <> · about {Math.round(impactPreview.shareOfBenchmark * 100)}% of a typical {impactPreview.benchmarkLabel || 'product'} footprint</>
                  )}
                </p>
              )}
              {impactPreview?.shareOfBenchmark != null && impactPreview.shareOfBenchmark > 0.8 && (
                <Alert className="mt-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    This one ingredient is more than 80% of a typical product&apos;s whole footprint. That can be right, but please double-check the amount and the matched factor.
                  </AlertDescription>
                </Alert>
              )}
              {amountCheck.level === 'warning' && (
                <Alert className="mt-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Please double-check:</strong> {amountCheck.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div>
              <Label htmlFor={`unit-${ingredient.tempId}`}>
                Unit <span className="text-destructive">*</span>
              </Label>
              <Select
                value={ingredient.unit}
                onValueChange={(newUnit) => {
                  const updates: Partial<IngredientFormData> = { unit: newUnit };
                  // Convert the amount so the physical quantity stays the same
                  if (ingredient.amount && ingredient.unit) {
                    const converted = convertAmount(ingredient.amount, ingredient.unit, newUnit);
                    if (converted !== null) {
                      updates.amount = converted;
                    }
                  }
                  onUpdate(ingredient.tempId, updates);
                }}
              >
                <SelectTrigger id={`unit-${ingredient.tempId}`}>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {INGREDIENT_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unitMismatch && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  The emission factor for this ingredient is per {unitMismatch.refUnit === 'unit' ? 'item' : unitMismatch.refUnit},
                  but the amount is entered in {unitMismatch.enteredKind === 'count' ? 'items' : `a ${unitMismatch.enteredKind} unit`}.
                  Please switch the unit so they match, or the result will be wrong.
                </p>
              )}
              {(() => {
                const hint = densityHintFor(ingredient.name, ingredient.unit);
                return hint ? (
                  <p className="text-xs text-muted-foreground mt-1">{hint}</p>
                ) : null;
              })()}
            </div>
          </div>
          )}
          </>}

          {showStage && productionStages.length > 0 && (
            <div>
              <Label htmlFor={`stage-${ingredient.tempId}`}>Production stage</Label>
              <Select
                value={ingredient.stage_id ?? "__unassigned"}
                onValueChange={(v) =>
                  onUpdate(ingredient.tempId, {
                    stage_id: v === "__unassigned" ? null : v,
                  })
                }
              >
                <SelectTrigger id={`stage-${ingredient.tempId}`}>
                  <SelectValue placeholder="Pick a stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
                  {productionStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.ordinal + 1}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Where in the production chain is this ingredient consumed?
              </p>
            </div>
          )}

          {showBasics && (
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`organic-${ingredient.tempId}`}
                checked={ingredient.is_organic_certified}
                onCheckedChange={(checked) =>
                  onUpdate(ingredient.tempId, { is_organic_certified: checked as boolean })
                }
              />
              <Label
                htmlFor={`organic-${ingredient.tempId}`}
                className="text-sm font-normal cursor-pointer"
              >
                Organic certified
              </Label>
            </div>

            {!ingredient.data_source && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`biogenic-${ingredient.tempId}`}
                checked={ingredient.is_biogenic_carbon || false}
                onCheckedChange={(checked) =>
                  onUpdate(ingredient.tempId, { is_biogenic_carbon: checked as boolean })
                }
              />
              <Label
                htmlFor={`biogenic-${ingredient.tempId}`}
                className="text-sm font-normal cursor-pointer"
              >
                Biogenic carbon source
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Tick if the carbon emissions from this material arise from biological processes (e.g. fermentation CO₂). Do not tick for fossil fuels, chemicals, or packaging.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            )}
          </div>
          )}

          {showSource && (
          <>
          <div className="flex items-center gap-6 flex-wrap">
            {showViticultureToggle && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`self-grown-vineyard-${ingredient.tempId}`}
                checked={ingredient.is_self_grown && !!ingredient.vineyard_id || (ingredient.is_self_grown && !ingredient.arable_field_id && !ingredient.orchard_id && !ingredient.vineyard_id && ingredient.data_source === 'viticulture_primary')}
                onCheckedChange={(checked) => {
                  const isSelfGrown = checked as boolean;
                  onUpdate(ingredient.tempId, {
                    is_self_grown: isSelfGrown,
                    ...(isSelfGrown ? {
                      data_source: 'viticulture_primary' as any,
                      matched_source_name: undefined,
                      data_source_id: undefined,
                      carbon_intensity: undefined,
                      ef_source: undefined,
                      ef_source_type: undefined,
                      ef_data_quality_grade: undefined,
                      ef_uncertainty_percent: undefined,
                      // Clear the other farm FKs (mutually exclusive)
                      arable_field_id: null,
                      orchard_id: null,
                    } : {
                      data_source: null,
                      vineyard_id: null,
                    }),
                  });
                }}
              />
              <Label
                htmlFor={`self-grown-vineyard-${ingredient.tempId}`}
                className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
              >
                <Leaf className="h-3.5 w-3.5 text-studio-good" />
                Grown on our own vineyard
              </Label>
            </div>
            )}

            {showArableToggle && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`self-grown-arable-${ingredient.tempId}`}
                checked={ingredient.is_self_grown && !!ingredient.arable_field_id || (ingredient.is_self_grown && !ingredient.vineyard_id && !ingredient.orchard_id && !ingredient.arable_field_id && ingredient.data_source === 'arable_primary')}
                onCheckedChange={(checked) => {
                  const isSelfGrown = checked as boolean;
                  onUpdate(ingredient.tempId, {
                    is_self_grown: isSelfGrown,
                    ...(isSelfGrown ? {
                      data_source: 'arable_primary' as any,
                      matched_source_name: undefined,
                      data_source_id: undefined,
                      carbon_intensity: undefined,
                      ef_source: undefined,
                      ef_source_type: undefined,
                      ef_data_quality_grade: undefined,
                      ef_uncertainty_percent: undefined,
                      vineyard_id: null,
                      orchard_id: null,
                    } : {
                      data_source: null,
                      arable_field_id: null,
                    }),
                  });
                }}
              />
              <Label
                htmlFor={`self-grown-arable-${ingredient.tempId}`}
                className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
              >
                <Leaf className="h-3.5 w-3.5 text-studio-good" />
                Grown on our own arable field
              </Label>
            </div>
            )}

            {showOrchardToggle && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`self-grown-orchard-${ingredient.tempId}`}
                checked={ingredient.is_self_grown && !!ingredient.orchard_id || (ingredient.is_self_grown && !ingredient.vineyard_id && !ingredient.arable_field_id && !ingredient.orchard_id && ingredient.data_source === 'orchard_primary')}
                onCheckedChange={(checked) => {
                  const isSelfGrown = checked as boolean;
                  onUpdate(ingredient.tempId, {
                    is_self_grown: isSelfGrown,
                    ...(isSelfGrown ? {
                      data_source: 'orchard_primary' as any,
                      matched_source_name: undefined,
                      data_source_id: undefined,
                      carbon_intensity: undefined,
                      ef_source: undefined,
                      ef_source_type: undefined,
                      ef_data_quality_grade: undefined,
                      ef_uncertainty_percent: undefined,
                      vineyard_id: null,
                      arable_field_id: null,
                    } : {
                      data_source: null,
                      orchard_id: null,
                    }),
                  });
                }}
              />
              <Label
                htmlFor={`self-grown-orchard-${ingredient.tempId}`}
                className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
              >
                <Leaf className="h-3.5 w-3.5 text-studio-good" />
                Grown in our own orchard
              </Label>
            </div>
            )}
          </div>

          {/* Vineyard selector + profile status */}
          {ingredient.is_self_grown && ingredient.data_source === 'viticulture_primary' && (
            <div className="rounded-[6px] border border-border bg-card p-4 space-y-3">
              <VineyardSelector
                organizationId={organizationId}
                value={ingredient.vineyard_id || ''}
                onValueChange={(vineyardId, vineyard) => {
                  setSelectedVineyard(vineyard);
                  onUpdate(ingredient.tempId, { vineyard_id: vineyardId });
                }}
              />

              {ingredient.vineyard_id && (
                <>
                  {loadingProfile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingProfile && growingProfile && (
                    <div className="rounded-[6px] border border-border bg-card px-3 py-2 space-y-1">
                      <Badge variant="outline">
                        <Sprout className="h-3 w-3 mr-1.5 text-studio-good" />
                        Growing profile complete
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {growingProfile.area_ha} ha, {growingProfile.grape_yield_tonnes} t yield,{' '}
                        {(growingProfile.soil_management || 'conventional tillage').replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {!loadingProfile && !growingProfile && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        This vineyard needs a growing profile before we can calculate its environmental impact.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-300 dark:border-amber-700"
                        asChild
                      >
                        <a href="/vineyards/">
                          <Sprout className="mr-1.5 h-3 w-3" />
                          Complete on Vineyards page
                        </a>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Arable field selector + profile status */}
          {ingredient.is_self_grown && ingredient.data_source === 'arable_primary' && (
            <div className="rounded-[6px] border border-border bg-card p-4 space-y-3">
              <ArableFieldSelector
                organizationId={organizationId}
                value={ingredient.arable_field_id || ''}
                onValueChange={(fieldId, field) => {
                  setSelectedArableField(field);
                  onUpdate(ingredient.tempId, { arable_field_id: fieldId });
                }}
              />

              {ingredient.arable_field_id && (
                <>
                  {loadingArableProfile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingArableProfile && arableProfile && (
                    <div className="rounded-[6px] border border-border bg-card px-3 py-2 space-y-1">
                      <Badge variant="outline">
                        <Sprout className="h-3 w-3 mr-1.5 text-studio-good" />
                        Growing profile complete
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {arableProfile.area_ha} ha, {arableProfile.grain_yield_tonnes} t yield,{' '}
                        {(arableProfile.soil_management || 'conventional tillage').replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {!loadingArableProfile && !arableProfile && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        This arable field needs a growing profile before we can calculate its environmental impact.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-300 dark:border-amber-700"
                        asChild
                      >
                        <a href="/arable-fields/">
                          <Sprout className="mr-1.5 h-3 w-3" />
                          Complete on Arable Fields page
                        </a>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Orchard selector + profile status */}
          {ingredient.is_self_grown && ingredient.data_source === 'orchard_primary' && (
            <div className="rounded-[6px] border border-border bg-card p-4 space-y-3">
              <OrchardSelector
                organizationId={organizationId}
                value={ingredient.orchard_id || ''}
                onValueChange={(orchardId, orchard) => {
                  setSelectedOrchard(orchard);
                  onUpdate(ingredient.tempId, { orchard_id: orchardId });
                }}
              />

              {ingredient.orchard_id && (
                <>
                  {loadingOrchardProfile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingOrchardProfile && orchardProfile && (
                    <div className="rounded-[6px] border border-border bg-card px-3 py-2 space-y-1">
                      <Badge variant="outline">
                        <Sprout className="h-3 w-3 mr-1.5 text-studio-good" />
                        Growing profile complete
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {orchardProfile.area_ha} ha, {orchardProfile.fruit_yield_tonnes} t yield,{' '}
                        {(orchardProfile.soil_management || 'conventional tillage').replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {!loadingOrchardProfile && !orchardProfile && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        This orchard needs a growing profile before we can calculate its environmental impact.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-300 dark:border-amber-700"
                        asChild
                      >
                        <a href="/orchards/">
                          <Sprout className="mr-1.5 h-3 w-3" />
                          Complete on Orchards page
                        </a>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          </>
          )}

          {showLogistics && !ingredient.is_self_grown && (
          <>
          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Origin & Logistics
            </h4>

            <div className="space-y-4">
              <div>
                <Label htmlFor={`origin-address-${ingredient.tempId}`}>
                  Where is this manufactured? (City or Factory Name)
                </Label>
                <LocationPicker
                  value={ingredient.origin_address || ''}
                  placeholder="e.g., Munich, Germany or Yorkshire Maltings, UK"
                  onLocationSelect={(location: LocationData) => {
                    // Recompute ALL leg distances with the new origin coordinates.
                    // recomputeDistances propagates changes through the whole leg chain.
                    const recomputed = recomputeDistances(legs, location.lat, location.lng);
                    const first = recomputed[0];
                    onUpdate(ingredient.tempId, {
                      origin_address: location.address,
                      origin_lat: location.lat,
                      origin_lng: location.lng,
                      origin_country_code: location.countryCode || '',
                      origin_country: location.address,
                      distance_km: first?.distanceKm ?? 0,
                      transport_legs: recomputed,
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search for the city or factory where this ingredient is produced.
                  We need at least city-level accuracy for transport calculations.
                </p>
              </div>

              {/* ── Multi-modal transport legs ─────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Label className="text-sm font-medium">Transport route</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Distances are calculated automatically from coordinates. Add legs for multi-modal routes (e.g. truck → ship → truck).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTransportLeg}
                    className="h-7 text-xs shrink-0"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add leg
                  </Button>
                </div>

                {legs.map((leg, legIndex) => {
                  const isLast = legIndex === legs.length - 1;
                  const isFirst = legIndex === 0;

                  // "From" — ingredient origin for leg 0; previous leg's waypoint for subsequent legs
                  const fromLabel = isFirst
                    ? (ingredient.origin_address || 'Set ingredient origin above')
                    : (legs[legIndex - 1].toAddress || `Waypoint ${legIndex}`);
                  const fromHasCoords = isFirst
                    ? !!(ingredient.origin_lat && ingredient.origin_lng)
                    : !!(legs[legIndex - 1].toLat && legs[legIndex - 1].toLng);

                  // "To" — production facility for last leg; user-set waypoint for intermediate legs
                  const destCoords = getDestinationCoords();
                  const destLabel = destCoords?.label || 'Your facility';
                  const toHasCoords = isLast ? !!destCoords : !!(leg.toLat && leg.toLng);

                  // Distance is auto-calculated only when both endpoints have coordinates
                  const distanceIsAuto = fromHasCoords && toHasCoords;

                  const warning = getTransportModeWarning(leg.transportMode, leg.distanceKm);

                  return (
                    <div key={leg.id} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                      {/* Leg header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Leg {legIndex + 1}
                          </span>
                          {distanceIsAuto && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Calculator className="h-2.5 w-2.5 mr-0.5" />
                              Auto
                            </Badge>
                          )}
                        </div>
                        {legs.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTransportLeg(leg.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Transport mode */}
                      <div className="space-y-1">
                        <Label className="text-xs">Transport mode</Label>
                        <Select
                          value={leg.transportMode}
                          onValueChange={(value) =>
                            updateTransportLeg(leg.id, { transportMode: value as TransportMode })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSPORT_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* From → To route */}
                      <div className="space-y-2">
                        {/* From (always auto-derived, read-only) */}
                        <div>
                          <Label className="text-xs mb-1 block">From</Label>
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${
                            fromHasCoords
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                              : 'bg-muted border-border'
                          }`}>
                            <MapPin className={`h-3 w-3 shrink-0 ${fromHasCoords ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                            <span className={fromHasCoords ? 'text-green-800 dark:text-green-200' : 'text-muted-foreground italic'}>
                              {fromLabel}
                            </span>
                          </div>
                        </div>

                        {/* To */}
                        {isLast ? (
                          <div>
                            <Label className="text-xs mb-1 block">To (production facility)</Label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${
                              destCoords
                                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                                : 'bg-muted border-border'
                            }`}>
                              <MapPin className={`h-3 w-3 shrink-0 ${destCoords ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                              <span className={destCoords ? 'text-blue-800 dark:text-blue-200' : 'text-muted-foreground italic'}>
                                {destCoords ? destLabel : 'No facility with coordinates found'}
                              </span>
                            </div>
                            {!destCoords && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                <Link href="/company/facilities" className="underline">
                                  Add facility coordinates
                                </Link>{' '}
                                to enable auto-calculation.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs">To (set intermediate waypoint)</Label>
                            <LocationPicker
                              value={leg.toAddress || ''}
                              placeholder="e.g. Port of Rotterdam, Netherlands"
                              onLocationSelect={(location: LocationData) => {
                                updateTransportLeg(leg.id, {
                                  toAddress: location.address,
                                  toLat: location.lat,
                                  toLng: location.lng,
                                });
                              }}
                            />
                            {!leg.toAddress && (
                              <p className="text-xs text-muted-foreground">
                                Search for the port, hub, or waypoint where transport mode changes.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Distance */}
                      <div className="space-y-1">
                        <Label className="text-xs">Distance (km)</Label>
                        {distanceIsAuto ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs">
                            <Calculator className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                            <span className="font-mono font-semibold text-green-800 dark:text-green-200">
                              {leg.distanceKm > 0 ? leg.distanceKm.toLocaleString() : '–'} km
                            </span>
                            <span className="text-green-700 dark:text-green-300 text-[10px] ml-1">
                              auto-calculated
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            placeholder={
                              !fromHasCoords
                                ? 'Set origin above to auto-calculate'
                                : !toHasCoords && !isLast
                                ? 'Set waypoint above to auto-calculate'
                                : 'Enter distance manually'
                            }
                            value={leg.distanceKm || ''}
                            onChange={(e) =>
                              updateTransportLeg(leg.id, { distanceKm: parseFloat(e.target.value) || 0 })
                            }
                          />
                        )}
                      </div>

                      {/* Plausibility warning */}
                      {warning && (
                        <Alert className="py-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                          <Info className="h-3.5 w-3.5 text-amber-600" />
                          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })}

                {/* A leg without a distance is silently excluded from the
                    calculation — make that visible instead of letting the
                    user assume their transport is counted. */}
                {legs.some((l) => !l.distanceKm || l.distanceKm <= 0) && (
                  <Alert className="py-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                    <Info className="h-3.5 w-3.5 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      Transport for this ingredient is not counted until every step has a distance. Set the origin location to calculate it automatically, or enter the distance yourself.
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 block"
                        onClick={() => {
                          const dest = getDestinationCoords();
                          const est = (ingredient.origin_country_code
                            ? defaultTransportForOrigin({
                                originCountryCode: ingredient.origin_country_code,
                                destinationLat: dest?.lat,
                                destinationLng: dest?.lng,
                              })
                            : null) ?? UNKNOWN_ORIGIN_DEFAULT;
                          updateLegs(legs.map((l) => (!l.distanceKm || l.distanceKm <= 0)
                            ? { ...l, transportMode: est.mode, distanceKm: est.distanceKm }
                            : l));
                          toast.info(est.assumption);
                        }}
                      >
                        Don&apos;t know? Use an estimate
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Facility setup hints */}
                {productionFacilities.length === 0 && totalLinkedFacilities > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Your linked facilities don&apos;t have location coordinates.{' '}
                    <Link href="/company/facilities" className="underline hover:text-amber-700 dark:hover:text-amber-300">
                      Update facility locations
                    </Link>{' '}
                    to enable automatic distance calculation.
                  </p>
                )}
                {productionFacilities.length === 0 && totalLinkedFacilities === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No facilities linked.{' '}
                    <Link href="/company/facilities" className="underline hover:text-amber-700 dark:hover:text-amber-300">
                      Add a facility with location
                    </Link>{' '}
                    to enable automatic distance calculation.
                  </p>
                )}

                {/* Multi-leg transport preview */}
                {legs.length > 1 && (
                  <div>
                    {transportPreviewLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        Calculating transport emissions…
                      </div>
                    )}
                    {transportPreview && !transportPreviewLoading && (
                      <div className="rounded-md bg-slate-50 dark:bg-slate-900 border px-3 py-2 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <Calculator className="h-3 w-3" />
                          Transport impact preview
                        </div>
                        {transportPreview.perLeg.map((legResult, i) => (
                          <div key={legResult.legId} className="flex justify-between text-muted-foreground">
                            <span>
                              {`Leg ${i + 1}`}{' '}
                              <span className="text-[10px]">({formatTransportMode(legResult.mode)}, {legResult.distanceKm.toLocaleString()} km)</span>
                            </span>
                            <span>{legResult.emissions.toFixed(4)} kg CO₂e</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t pt-1 font-medium">
                          <span>Total inbound transport</span>
                          <span className="text-primary">{transportPreview.total.toFixed(4)} kg CO₂e</span>
                        </div>
                        <p className="text-muted-foreground">Per functional unit. Uses DEFRA 2025 freight factors.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Delivery Container ─────────────────────────────────────────── */}
          <Collapsible open={containerOpen} onOpenChange={setContainerOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between pt-3 border-t text-left"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Delivery Container
                  </span>
                  {ingredient.inbound_container_type && (
                    <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-900">
                      {getContainerPreset(ingredient.inbound_container_type)?.label ?? ingredient.inbound_container_type}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                {containerOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-3 space-y-4">
              <p className="text-xs text-muted-foreground">
                Record the bulk container your ingredient arrived in. The container&apos;s
                manufacturing footprint is allocated to this product per unit based on
                the volume it delivers.
              </p>

              {/* Container type */}
              <div>
                <Label htmlFor={`container-type-${ingredient.tempId}`}>Container type</Label>
                <Select
                  value={ingredient.inbound_container_type ?? '__none__'}
                  onValueChange={(value) => {
                    if (value === '__none__') {
                      onUpdate(ingredient.tempId, {
                        inbound_container_type: null,
                        inbound_container_volume_l: null,
                        inbound_container_tare_kg: null,
                        inbound_container_reuse_cycles: null,
                        inbound_container_ef: null,
                      });
                      return;
                    }
                    const preset = getContainerPreset(value);
                    onUpdate(ingredient.tempId, {
                      inbound_container_type: value,
                      inbound_container_volume_l: preset && preset.volume_l > 0 ? preset.volume_l : null,
                      inbound_container_tare_kg: preset && preset.tare_kg > 0 ? preset.tare_kg : null,
                      inbound_container_reuse_cycles: preset ? preset.reuse_cycles : 1,
                      inbound_container_ef: null,
                      // clear material when switching to a preset (presets have known EFs)
                      inbound_container_material: null,
                    });
                  }}
                >
                  <SelectTrigger id={`container-type-${ingredient.tempId}`}>
                    <SelectValue placeholder="Select container type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix UI v2 requires non-empty strings — use sentinel '__none__' */}
                    <SelectItem value="__none__">None</SelectItem>
                    {CONTAINER_PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ingredient.inbound_container_type && (
                <>
                  {/* Volume + tare row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`container-volume-${ingredient.tempId}`}>Capacity (L)</Label>
                      <Input
                        id={`container-volume-${ingredient.tempId}`}
                        type="number"
                        min={0.001}
                        step="any"
                        value={ingredient.inbound_container_volume_l ?? ''}
                        readOnly={ingredient.inbound_container_type !== 'custom'}
                        className={ingredient.inbound_container_type !== 'custom' ? 'bg-muted cursor-not-allowed' : ''}
                        onChange={(e) => {
                          if (ingredient.inbound_container_type === 'custom') {
                            onUpdate(ingredient.tempId, { inbound_container_volume_l: parseFloat(e.target.value) || null });
                          }
                        }}
                      />
                    </div>
                    <div>
                      {(() => {
                        const preset = getContainerPreset(ingredient.inbound_container_type ?? '');
                        const isOverridden = preset && ingredient.inbound_container_tare_kg != null
                          && ingredient.inbound_container_tare_kg !== preset.tare_kg;
                        return (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <Label htmlFor={`container-tare-${ingredient.tempId}`}>Tare weight (kg)</Label>
                              {isOverridden && (
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground underline"
                                  onClick={() => onUpdate(ingredient.tempId, { inbound_container_tare_kg: preset!.tare_kg })}
                                >
                                  Reset to {preset!.tare_kg} kg
                                </button>
                              )}
                            </div>
                            <Input
                              id={`container-tare-${ingredient.tempId}`}
                              type="number"
                              min={0.01}
                              step="any"
                              value={ingredient.inbound_container_tare_kg ?? ''}
                              onChange={(e) =>
                                onUpdate(ingredient.tempId, { inbound_container_tare_kg: parseFloat(e.target.value) || null })
                              }
                            />
                            {preset && !isOverridden && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Industry default. Edit if your actual container differs.
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Reusable */}
                  {(() => {
                    const preset = getContainerPreset(ingredient.inbound_container_type);
                    const isReusable = preset
                      ? preset.is_reusable
                      : (ingredient.inbound_container_reuse_cycles ?? 1) > 1;
                    const isLocked = ingredient.inbound_container_type !== 'custom' && ingredient.inbound_container_type !== 'bulk_tanker_25000l';
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`container-reusable-${ingredient.tempId}`}
                            checked={isReusable}
                            disabled={isLocked}
                            onCheckedChange={(checked) => {
                              if (!isLocked) {
                                onUpdate(ingredient.tempId, {
                                  inbound_container_reuse_cycles: checked ? 2 : 1,
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`container-reusable-${ingredient.tempId}`}
                            className={`text-sm font-normal ${isLocked ? 'text-muted-foreground' : ''}`}
                          >
                            Returned / reusable container
                          </Label>
                        </div>

                        {isReusable && (
                          <div>
                            <Label htmlFor={`container-cycles-${ingredient.tempId}`}>
                              Reuse cycles
                            </Label>
                            <Input
                              id={`container-cycles-${ingredient.tempId}`}
                              type="number"
                              min={1}
                              step={1}
                              value={ingredient.inbound_container_reuse_cycles ?? (preset?.reuse_cycles ?? 1)}
                              onChange={(e) =>
                                onUpdate(ingredient.tempId, {
                                  inbound_container_reuse_cycles: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Total number of uses in the container&apos;s lifetime (e.g. 300 for a steel road tanker fleet).
                              Carbon footprint is divided across all cycles.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Material + EF — custom only */}
                  {ingredient.inbound_container_type === 'custom' && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`container-material-${ingredient.tempId}`}>
                          Container material <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={ingredient.inbound_container_material ?? '__none__'}
                          onValueChange={(v) =>
                            onUpdate(ingredient.tempId, {
                              inbound_container_material: v === '__none__' ? null : v,
                              // clear any manual EF override when material changes — let lookup take over
                              inbound_container_ef: null,
                            })
                          }
                        >
                          <SelectTrigger id={`container-material-${ingredient.tempId}`}>
                            <SelectValue placeholder="Select material…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select material</SelectItem>
                            {CONTAINER_MATERIAL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({m.ef} kg CO₂e/kg)
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Used to calculate the container&apos;s manufacturing footprint.
                          Select the primary material by weight.
                        </p>
                      </div>

                      {/* EF override — advanced, only shown after material is set */}
                      {ingredient.inbound_container_material && (
                        <div>
                          <Label htmlFor={`container-ef-${ingredient.tempId}`}>
                            Emission factor override (kg CO₂e / kg material)
                            <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                          </Label>
                          <Input
                            id={`container-ef-${ingredient.tempId}`}
                            type="number"
                            min={0}
                            step="any"
                            placeholder={`Leave blank to use material default (${
                              CONTAINER_MATERIAL_OPTIONS.find(m => m.value === ingredient.inbound_container_material)?.ef ?? '–'
                            } kg CO₂e/kg)`}
                            value={ingredient.inbound_container_ef ?? ''}
                            onChange={(e) =>
                              onUpdate(ingredient.tempId, {
                                inbound_container_ef: parseFloat(e.target.value) || null,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live impact preview */}
                  {(() => {
                    const preview = getContainerImpactPreview();
                    if (!preview) return null;
                    return (
                      <div className="rounded-md bg-slate-50 dark:bg-slate-900 border px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          <Calculator className="h-3 w-3" />
                          Container impact preview
                        </div>
                        <div className="font-mono text-foreground">
                          ~{preview.value < 0.001
                            ? preview.value.toExponential(2)
                            : preview.value.toFixed(4)
                          } kg CO₂e per functional unit
                        </div>
                        {preview.warning && (
                          <div className="text-amber-600 dark:text-amber-400">⚠ {preview.warning}</div>
                        )}
                        <div className="text-muted-foreground">
                          Added to ingredient&apos;s climate impact at calculation time.
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
          </>
          )}

          {showBasics && <>
          {ingredient.data_source && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex-1">
                {ingredient.is_self_grown ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Leaf className="h-3 w-3 mr-1.5 text-studio-good" />
                      Self-Grown (Viticulture)
                    </Badge>
                    <span className="text-xs text-muted-foreground">Calculated from growing profile</span>
                  </div>
                ) : (
                  getDataSourceBadge()
                )}
              </div>
            </div>
          )}

          {(ingredient.data_source === 'openlca' || ingredient.data_source === 'ecoinvent') && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This ingredient uses secondary data from the Ecoinvent 3.12 database (70% confidence). For improved accuracy, consider requesting Environmental Product Declaration (EPD) data from your supplier.
              </AlertDescription>
            </Alert>
          )}
          {ingredient.data_source === 'staging' && (
            <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <Info className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-xs text-purple-800 dark:text-purple-200">
                <strong>Hybrid Source:</strong> GHG data from DEFRA 2025 (UK regulatory compliance), non-GHG environmental impacts from Ecoinvent 3.12. Confidence: 80%.
              </AlertDescription>
            </Alert>
          )}
          </>}
        </div>
    )
  );
}
