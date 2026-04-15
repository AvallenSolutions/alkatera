"use client";

import { useState, useEffect } from "react";
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
import { Trash2, Building2, Database, Sprout, Info, MapPin, Calculator, Award, Layers, Package, ChevronDown, ChevronUp, Plus, Loader2, Leaf, Shield, CheckCircle2, Droplets, TreePine, HelpCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
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
  // Inbound delivery container (optional)
  inbound_container_type?: string | null;
  inbound_container_volume_l?: number | null;
  inbound_container_tare_kg?: number | null;
  inbound_container_reuse_cycles?: number | null;
  inbound_container_ef?: number | null;
  // Self-grown ingredient (e.g. vineyard grapes, arable barley, orchard fruit)
  is_self_grown?: boolean;
  vineyard_id?: string | null;
  arable_field_id?: string | null;
  orchard_id?: string | null;
  // ISO 14067 §7: biogenic carbon classification
  is_biogenic_carbon?: boolean;
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
    label: 'IBC 1000L (HDPE)',
    volume_l: 1000,
    tare_kg: 25,
    reuse_cycles: 10,  // Industry avg for rental-pool IBCs (WRAP guidance)
    is_reusable: true,
    material: 'HDPE',
  },
  {
    key: 'ibc_500l',
    label: 'IBC 500L (HDPE)',
    volume_l: 500,
    tare_kg: 16,
    reuse_cycles: 10,  // Industry avg for rental-pool IBCs (WRAP guidance)
    is_reusable: true,
    material: 'HDPE',
  },
  {
    key: 'drum_200l',
    label: 'Drum 200L (HDPE)',
    volume_l: 200,
    tare_kg: 8.5,
    reuse_cycles: 1,
    is_reusable: false,
    material: 'HDPE',
  },
  {
    key: 'flexitank_24000l',
    label: 'Flexitank 24000L (LDPE)',
    volume_l: 24000,
    tare_kg: 30,
    reuse_cycles: 1,
    is_reusable: false,
    material: 'LDPE',
  },
  {
    key: 'bulk_tanker_25000l',
    label: 'Bulk tanker 25000L (stainless steel)',
    volume_l: 25000,
    tare_kg: 20000,
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
}

/**
 * Convert a quantity between units, keeping the physical amount consistent.
 *
 * Mass ↔ volume conversions assume density ≈ 1.0 kg/L (appropriate for most
 * beverages and water-based ingredients). For spirits (~0.8–0.95 kg/L) this
 * introduces a small error, but it's far better than no conversion at all.
 *
 * Returns null when conversion between incompatible unit families (e.g.
 * mass → "unit") so the caller can leave the amount unchanged.
 */
function convertAmount(
  amount: number | string,
  fromUnit: string,
  toUnit: string
): number | null {
  const qty = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(qty) || qty <= 0) return null;
  if (fromUnit === toUnit) return qty;

  // Convert to grams as the common intermediate
  const toGrams: Record<string, number> = {
    kg: 1000,
    g: 1,
    mg: 0.001,
    oz: 28.3495,
    lb: 453.592,
    // Volume → mass assuming density ≈ 1.0 kg/L
    l: 1000,
    ml: 1,
  };

  const fromFactor = toGrams[fromUnit];
  const toFactor = toGrams[toUnit];

  if (!fromFactor || !toFactor) return null; // "unit" or unknown — don't convert

  const grams = qty * fromFactor;
  const converted = grams / toFactor;

  // Round to avoid floating-point noise (max 6 decimal places)
  return parseFloat(converted.toPrecision(6));
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
}: IngredientFormCardProps) {
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
    // EF: use override if set, otherwise use a known approximate for the preview
    const EF_APPROX: Record<string, number> = {
      ibc_1000l: 1.93, ibc_500l: 1.93, drum_200l: 1.93,
      flexitank_24000l: 2.10, bulk_tanker_25000l: 2.89,
      bottle_700ml_glass: 0.85, bottle_750ml_glass: 0.85, bottle_1l_glass: 0.85,
    };
    const ef = Number(ingredient.inbound_container_ef ?? EF_APPROX[ingredient.inbound_container_type ?? ''] ?? 0);

    if (!ef || !tare || !volume) return null;

    const qty = Number(ingredient.amount);
    const unit = (ingredient.unit || '').toLowerCase();
    let warning: string | undefined;

    const VOLUME_UNITS = ['l', 'litre', 'litres', 'liter', 'liters', 'ml', 'millilitre', 'millilitres'];
    const MASS_UNITS   = ['kg', 'kilograms', 'g', 'grams'];

    let ingredientLitres: number;
    if (VOLUME_UNITS.includes(unit)) {
      // normaliseToKg treats L as 1:1 with kg, so qty is already in "litre-equivalent"
      ingredientLitres = unit.startsWith('ml') ? qty / 1000 : qty;
    } else if (MASS_UNITS.includes(unit)) {
      ingredientLitres = unit === 'g' ? qty / 1000 : qty; // density ≈ 1 kg/L
      warning = 'Using 1 kg ≈ 1 L — consider switching to litres for spirits';
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

    const qty = Number(ingredient.amount) || 0;
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
  }, [ingredient.transport_legs, ingredient.transport_mode, ingredient.distance_km, ingredient.amount, ingredient.unit]);

  // ---------------------------------------------------------------------------

  const getDataSourceBadge = () => {
    if (!ingredient.data_source) return null;

    switch (ingredient.data_source) {
      case 'supplier':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Award className="h-3 w-3 mr-1.5" />
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
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Layers className="h-3 w-3 mr-1.5" />
              Hybrid Source (DEFRA + Ecoinvent)
            </Badge>
            <span className="text-xs text-muted-foreground">80% confidence</span>
          </div>
        );
      case 'ecoinvent':
      case 'openlca':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
              <Database className="h-3 w-3 mr-1.5" />
              Ecoinvent Database (Medium Quality)
            </Badge>
            <span className="text-xs text-muted-foreground">70% confidence</span>
          </div>
        );
      case 'primary':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Sprout className="h-3 w-3 mr-1.5" />
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
      // Only prefill unit from search result when ingredient has no amount set yet (first selection).
      // This prevents overriding a unit the user already chose (e.g., user picked "g" but DB has "kg").
      ...(!ingredient.amount ? { unit: selection.unit } : {}),
      // Map search location to origin_address (the field actually saved to DB).
      // Only prefill if user hasn't already set an origin address.
      ...(!ingredient.origin_address && selection.location ? { origin_address: selection.location } : {}),
    };

    console.log('[IngredientFormCard] Calling onUpdate with:', updates);
    onUpdate(ingredient.tempId, updates);
  };

  // Filter linked supplier products for ingredient context
  const ingredientSupplierProducts = (linkedSupplierProducts || []).filter(
    (p: any) => p.product_type === 'ingredient' || !p.product_type
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
      ...(!ingredient.amount ? { unit: product.unit || 'kg' } : {}),
      // Origin/location data from supplier product or supplier profile
      ...(originAddress ? { origin_address: originAddress } : {}),
      ...(originLat != null ? { origin_lat: originLat } : {}),
      ...(originLng != null ? { origin_lng: originLng } : {}),
      ...(originCountryCode ? { origin_country_code: originCountryCode, origin_country: originCountryCode } : {}),
    });
  };

  return (
    <Card className="border-l-4 border-l-orange-500 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center text-white font-medium text-sm">
              {index + 1}
            </div>
            <div>
              <h3 className="font-semibold text-orange-800 dark:text-orange-300">
                Ingredient {index + 1}
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
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

        <div className="space-y-4">
          {/* Supplier product suggestions - shown above name when available */}
          {ingredientSupplierProducts.length > 0 && !ingredient.supplier_product_id && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-sm transition-all text-left"
                    >
                      <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-700 dark:text-emerald-400">
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
            </Label>
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
            {ingredient.matched_source_name && ingredient.matched_source_name !== ingredient.name && ingredient.data_source !== 'supplier' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs cursor-help">
                      <Database className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300">
                        Calculation proxy: <span className="font-medium">{ingredient.matched_source_name}</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`amount-${ingredient.tempId}`}>
                Amount <span className="text-destructive">*</span>
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
                Quantity used per product unit
              </p>
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
                  <SelectItem value="ml">Millilitres (ml)</SelectItem>
                  <SelectItem value="l">Litres (l)</SelectItem>
                  <SelectItem value="g">Grams (g)</SelectItem>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="oz">Ounces (oz)</SelectItem>
                  <SelectItem value="lb">Pounds (lb)</SelectItem>
                  <SelectItem value="unit">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                <Leaf className="h-3.5 w-3.5 text-[#ccff00]" />
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
                <Leaf className="h-3.5 w-3.5 text-[#ccff00]" />
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
                <Leaf className="h-3.5 w-3.5 text-[#ccff00]" />
                Grown in our own orchard
              </Label>
            </div>
            )}
          </div>

          {/* Vineyard selector + profile status */}
          {ingredient.is_self_grown && ingredient.data_source === 'viticulture_primary' && (
            <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-4 space-y-3">
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingProfile && growingProfile && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 space-y-1">
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">
                        <Sprout className="h-3 w-3 mr-1.5" />
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
            <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-4 space-y-3">
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingArableProfile && arableProfile && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 space-y-1">
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">
                        <Sprout className="h-3 w-3 mr-1.5" />
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
            <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-4 space-y-3">
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking growing profile...
                    </div>
                  )}

                  {!loadingOrchardProfile && orchardProfile && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 space-y-1">
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">
                        <Sprout className="h-3 w-3 mr-1.5" />
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

          {!ingredient.is_self_grown && (
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
                              {leg.distanceKm > 0 ? leg.distanceKm.toLocaleString() : '—'} km
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
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                      inbound_container_ef: null, // always clear override when switching preset
                    });
                  }}
                >
                  <SelectTrigger id={`container-type-${ingredient.tempId}`}>
                    <SelectValue placeholder="Select container type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix UI v2 requires non-empty strings — use sentinel '__none__' */}
                    <SelectItem value="__none__">— None —</SelectItem>
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
                      <Label htmlFor={`container-tare-${ingredient.tempId}`}>Tare weight (kg)</Label>
                      <Input
                        id={`container-tare-${ingredient.tempId}`}
                        type="number"
                        min={0.01}
                        step="any"
                        value={ingredient.inbound_container_tare_kg ?? ''}
                        readOnly={ingredient.inbound_container_type !== 'custom'}
                        className={ingredient.inbound_container_type !== 'custom' ? 'bg-muted cursor-not-allowed' : ''}
                        onChange={(e) => {
                          if (ingredient.inbound_container_type === 'custom') {
                            onUpdate(ingredient.tempId, { inbound_container_tare_kg: parseFloat(e.target.value) || null });
                          }
                        }}
                      />
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

                  {/* EF override — custom only */}
                  {ingredient.inbound_container_type === 'custom' && (
                    <div>
                      <Label htmlFor={`container-ef-${ingredient.tempId}`}>
                        Emission factor (kg CO₂e / kg material)
                        <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                      </Label>
                      <Input
                        id={`container-ef-${ingredient.tempId}`}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Leave blank to use platform default"
                        value={ingredient.inbound_container_ef ?? ''}
                        onChange={(e) =>
                          onUpdate(ingredient.tempId, {
                            inbound_container_ef: parseFloat(e.target.value) || null,
                          })
                        }
                      />
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

          {ingredient.data_source && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex-1">
                {ingredient.is_self_grown ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-[#ccff00]/10 text-[#ccff00] border-[#ccff00]/30">
                      <Leaf className="h-3 w-3 mr-1.5" />
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
        </div>
      </div>
    </Card>
  );
}
