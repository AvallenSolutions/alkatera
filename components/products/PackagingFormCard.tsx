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
import { Trash2, Building2, Database, Sprout, Info, Package, Tag, Grip, Box, MapPin, Calculator, Truck, Layers, FileText, ChevronDown, ChevronRight, Plus, Loader2, Shield, CheckCircle2, Recycle } from "lucide-react";
import { lookupPackagingDefaults } from "@/lib/constants/packaging-defaults";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { LocationPicker, LocationData } from "@/components/shared/LocationPicker";
import { COUNTRIES } from "@/lib/countries";
import type {
  DataSource,
  PackagingCategory,
  EPRPackagingLevel,
  EPRPackagingActivity,
  EPRRAMRating,
  EPRUKNation,
  PackagingMaterialComponent,
} from "@/lib/types/lca";
import { PackagingComponentEditor } from "./PackagingComponentEditor";
import { calculateDistance } from "@/lib/utils/distance-calculator";
import { getTransportModeWarning, formatTransportMode, type TransportMode } from "@/lib/utils/transport-emissions-calculator";
import {
  generateLegId,
  calculateDistributionEmissions,
  type DistributionLeg,
  type DistributionResult,
} from "@/lib/distribution-factors";

export interface PackagingFormData {
  tempId: string;
  name: string;
  matched_source_name?: string; // Database match name when proxy used
  data_source: DataSource | null;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  amount: number | string;
  unit: string;
  packaging_category: PackagingCategory | null;
  recycled_content_percentage: number | string;
  printing_process: string;
  net_weight_g: number | string;
  origin_country: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;
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
  // EPR Compliance fields
  has_component_breakdown: boolean;
  components: PackagingMaterialComponent[];
  epr_packaging_level?: EPRPackagingLevel;
  epr_packaging_activity?: EPRPackagingActivity;
  epr_is_household: boolean;
  epr_ram_rating?: EPRRAMRating;
  epr_uk_nation?: EPRUKNation;
  epr_is_drinks_container: boolean;
  units_per_group: number | string;
  // Circularity (optional — defaults to '' / null for all construction sites)
  reuse_trips?: number | string;
  recyclability_percent?: number | string;
  end_of_life_pathway?: '' | 'landfill' | 'incineration' | 'recycling' | 'composting' | 'reuse' | 'unknown';
  biobased_content_percentage?: number | string;
}

interface ProductionFacility {
  id: string;
  name: string;
  address_lat: number | null;
  address_lng: number | null;
  production_share?: number;
}

interface PackagingFormCardProps {
  packaging: PackagingFormData;
  index: number;
  organizationId: string;
  productionFacilities: ProductionFacility[];
  totalLinkedFacilities?: number;
  organizationLat?: number | null;
  organizationLng?: number | null;
  linkedSupplierProducts?: any[];
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
  onRemove: (tempId: string) => void;
  onAddNewWithType?: (category: PackagingCategory) => void;
  canRemove: boolean;
}

// EPR Packaging Activity options
const EPR_PACKAGING_ACTIVITIES = [
  { value: 'brand', label: 'Supplied under your brand' },
  { value: 'packed_filled', label: 'Packed or filled' },
  { value: 'imported', label: 'Imported (first UK owner)' },
  { value: 'empty', label: 'Supplied as empty packaging' },
  { value: 'hired', label: 'Hired or loaned' },
  { value: 'marketplace', label: 'Online marketplace' },
] as const;

// UK Nations
const EPR_UK_NATIONS = [
  { value: 'england', label: 'England' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'wales', label: 'Wales' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
] as const;

// RAM Recyclability ratings
const EPR_RAM_RATINGS = [
  { value: 'green', label: 'Green', description: 'Recyclable - collected and sorted for recycling' },
  { value: 'amber', label: 'Amber', description: 'Some recyclability issues' },
  { value: 'red', label: 'Red', description: 'Not recyclable in practice' },
] as const;

// EPR Compliance Section Component
function EPRComplianceSection({
  packaging,
  onUpdate,
}: {
  packaging: PackagingFormData;
  onUpdate: (updates: Partial<PackagingFormData>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pt-2 border-t">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto hover:bg-transparent w-full justify-start">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">EPR Compliance Data</span>
            <span className="text-xs text-muted-foreground ml-2">(optional)</span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Packaging Activity */}
            <div>
              <Label className="text-xs">Packaging Activity</Label>
              <Select
                value={packaging.epr_packaging_activity || ''}
                onValueChange={(value) => onUpdate({ epr_packaging_activity: value as EPRPackagingActivity })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select activity..." />
                </SelectTrigger>
                <SelectContent>
                  {EPR_PACKAGING_ACTIVITIES.map((activity) => (
                    <SelectItem key={activity.value} value={activity.value} className="text-xs">
                      {activity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">How this packaging was supplied</p>
            </div>

            {/* UK Nation */}
            <div>
              <Label className="text-xs">UK Nation</Label>
              <Select
                value={packaging.epr_uk_nation || ''}
                onValueChange={(value) => onUpdate({ epr_uk_nation: value as EPRUKNation })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select nation..." />
                </SelectTrigger>
                <SelectContent>
                  {EPR_UK_NATIONS.map((nation) => (
                    <SelectItem key={nation.value} value={nation.value} className="text-xs">
                      {nation.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">Where packaging is supplied/discarded</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* RAM Recyclability Rating */}
            <div>
              <Label className="text-xs">RAM Recyclability Rating</Label>
              <Select
                value={packaging.epr_ram_rating || ''}
                onValueChange={(value) => onUpdate({ epr_ram_rating: value as EPRRAMRating })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select rating..." />
                </SelectTrigger>
                <SelectContent>
                  {EPR_RAM_RATINGS.map((rating) => (
                    <SelectItem key={rating.value} value={rating.value} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          rating.value === 'green' ? 'bg-green-500' :
                          rating.value === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {rating.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">For EPR fee modulation</p>
            </div>

            {/* Household Toggle */}
            <div className="space-y-2">
              <Label className="text-xs">Packaging Type</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name={`household-${packaging.tempId}`}
                    checked={packaging.epr_is_household === true}
                    onChange={() => onUpdate({ epr_is_household: true })}
                    className="h-3 w-3"
                  />
                  Household
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name={`household-${packaging.tempId}`}
                    checked={packaging.epr_is_household === false}
                    onChange={() => onUpdate({ epr_is_household: false })}
                    className="h-3 w-3"
                  />
                  Non-household
                </label>
              </div>
            </div>
          </div>

          {/* Drinks Container checkbox - only show for containers */}
          {packaging.packaging_category === 'container' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`drinks-container-${packaging.tempId}`}
                checked={packaging.epr_is_drinks_container}
                onCheckedChange={(checked) => onUpdate({ epr_is_drinks_container: !!checked })}
              />
              <Label htmlFor={`drinks-container-${packaging.tempId}`} className="text-xs cursor-pointer">
                Drinks container (150ml - 3L)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    <p className="text-xs">Drinks containers between 150ml and 3L need separate tracking for EPR reporting</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const PACKAGING_TYPES = [
  {
    value: 'container',
    label: 'Container',
    icon: Package,
    eprLevel: 'primary',
    tooltip: 'Primary packaging that directly contains the product (bottles, cans, pouches)',
  },
  {
    value: 'label',
    label: 'Label',
    icon: Tag,
    eprLevel: 'primary',
    tooltip: 'Labels, stickers, and tamper seals applied to primary packaging',
  },
  {
    value: 'closure',
    label: 'Closure',
    icon: Grip,
    eprLevel: 'primary',
    tooltip: 'Caps, corks, lids, and seals for primary packaging',
  },
  {
    value: 'secondary',
    label: 'Secondary',
    icon: Box,
    eprLevel: 'secondary',
    tooltip: 'Retail/gift packaging grouping primary packs (gift boxes, retail cartons)',
  },
  {
    value: 'shipment',
    label: 'Shipment',
    icon: Truck,
    eprLevel: 'shipment',
    tooltip: 'Trade cases and packaging for B2B logistics and direct-to-consumer delivery',
  },
  {
    value: 'tertiary',
    label: 'Tertiary',
    icon: Layers,
    eprLevel: 'tertiary',
    tooltip: 'Bulk transport packaging (pallets, stretch wrap, edge protectors)',
  },
] as const;

// Transport mode display labels (used in multi-leg UI)
const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
  { value: 'truck', label: 'Road (HGV)' },
  { value: 'train', label: 'Rail Freight' },
  { value: 'ship', label: 'Sea Freight' },
  { value: 'air',   label: 'Air Freight' },
];

export function PackagingFormCard({
  packaging,
  index,
  organizationId,
  productionFacilities,
  totalLinkedFacilities = 0,
  organizationLat,
  organizationLng,
  linkedSupplierProducts,
  onUpdate,
  onRemove,
  onAddNewWithType,
  canRemove,
}: PackagingFormCardProps) {
  const [transportPreview, setTransportPreview] = useState<DistributionResult | null>(null);
  const [transportPreviewLoading, setTransportPreviewLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Multi-modal inbound transport helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive the current transport legs from packaging state.
   * Prefers transport_legs when set; falls back to single transport_mode/distance_km
   * so that existing packaging items load correctly without migration.
   */
  const legs: DistributionLeg[] = (() => {
    if (packaging.transport_legs && packaging.transport_legs.length > 0) {
      return packaging.transport_legs;
    }
    return [{
      id: 'leg_0_legacy',
      label: '',
      transportMode: (packaging.transport_mode || 'truck') as TransportMode,
      distanceKm: Number(packaging.distance_km || 0),
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
   * - Leg 0 "from" = packaging origin (or overrideOriginLat/Lng when origin just changed).
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
    const oLat = overrideOriginLat ?? packaging.origin_lat;
    const oLng = overrideOriginLng ?? packaging.origin_lng;

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
    onUpdate(packaging.tempId, {
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

    // Use net_weight_g as approximate weight for preview
    const weightKg = (Number(packaging.net_weight_g) || 1) / 1000;
    if (weightKg <= 0) { setTransportPreview(null); return; }

    const timer = setTimeout(async () => {
      setTransportPreviewLoading(true);
      try {
        const result = await calculateDistributionEmissions({ legs, productWeightKg: weightKg });
        setTransportPreview(result);
      } catch (err) {
        console.error('[PackagingFormCard] Transport preview failed:', err);
        setTransportPreview(null);
      } finally {
        setTransportPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [packaging.transport_legs, packaging.transport_mode, packaging.distance_km, packaging.net_weight_g]);

  // ---------------------------------------------------------------------------

  const getDataSourceBadge = () => {
    if (!packaging.data_source) return null;

    switch (packaging.data_source) {
      case 'supplier':
        return (
          <div className="space-y-1">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
              <Building2 className="h-3 w-3 mr-1" />
              Primary Data Selected
            </Badge>
            {packaging.supplier_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>From: <span className="font-medium text-foreground">{packaging.supplier_name}</span></span>
              </div>
            )}
          </div>
        );
      case 'openlca':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            <Database className="h-3 w-3 mr-1" />
            Secondary Data Selected
          </Badge>
        );
      case 'primary':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            <Sprout className="h-3 w-3 mr-1" />
            Custom Primary Data
          </Badge>
        );
      default:
        return null;
    }
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
    recycled_content_pct?: number;
    packaging_components?: any;
    ef_source?: string;
    ef_source_type?: string;
    ef_data_quality_grade?: string;
    ef_uncertainty_percent?: number;
    // Packaging supplier product data
    supplier_weight_g?: number | null;
    supplier_packaging_category?: string | null;
    supplier_primary_material?: string | null;
    supplier_epr_material_code?: string | null;
    supplier_epr_is_drinks_container?: boolean | null;
  }) => {
    // Preserve user's real material name, store DB match name separately
    const userOriginalName = selection.user_query || selection.name;

    // Use supplier packaging_category if available, otherwise auto-detect from name
    let detectedCategory: PackagingCategory = packaging.packaging_category || 'container';

    if (selection.supplier_packaging_category) {
      // Trust supplier-provided packaging category
      detectedCategory = selection.supplier_packaging_category as PackagingCategory;
    } else {
      // Auto-detect packaging category from the DATABASE match name (not user name)
      const nameLower = selection.name.toLowerCase();

      if (nameLower.includes('label') || nameLower.includes('sticker') || nameLower.includes('tamper')) {
        detectedCategory = 'label';
      } else if (nameLower.includes('cap') || nameLower.includes('lid') || nameLower.includes('closure') || nameLower.includes('cork') || nameLower.includes('seal')) {
        detectedCategory = 'closure';
      } else if (nameLower.includes('pallet') || nameLower.includes('stretch wrap') || nameLower.includes('edge protector') || nameLower.includes('strapping')) {
        detectedCategory = 'tertiary';
      } else if (nameLower.includes('trade case') || nameLower.includes('shipping') || nameLower.includes('transit')) {
        detectedCategory = 'shipment';
      } else if (nameLower.includes('box') || nameLower.includes('carton') || nameLower.includes('cardboard') || nameLower.includes('case') || nameLower.includes('crate') || nameLower.includes('gift')) {
        detectedCategory = 'secondary';
      } else if (nameLower.includes('bottle') || nameLower.includes('jar') || nameLower.includes('can') || nameLower.includes('container') || nameLower.includes('pouch')) {
        detectedCategory = 'container';
      }
    }

    const updates: Partial<PackagingFormData> = {
      // Auto-fill the display name from the DB match only if user hasn't entered one yet
      ...(!packaging.name ? { name: selection.name } : {}),
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
      // Only auto-detect category if user hasn't already chosen one
      ...(!packaging.packaging_category ? { packaging_category: detectedCategory } : {}),
      // Only prefill unit from search result when packaging has no amount set yet (first selection).
      // This prevents overriding a unit the user already chose (e.g., user picked "g" but DB has "kg").
      ...(!packaging.amount ? { unit: selection.unit } : {}),
      // Map search location to origin_address (the field actually saved to DB).
      // Only prefill if user hasn't already set an origin address.
      ...(!packaging.origin_address && selection.location ? { origin_address: selection.location } : {}),
    };

    // Auto-populate recycled content if provided
    if (selection.recycled_content_pct !== undefined && selection.recycled_content_pct !== null) {
      updates.recycled_content_percentage = selection.recycled_content_pct;
    }

    // Auto-populate component breakdown if provided
    if (selection.packaging_components && Array.isArray(selection.packaging_components) && selection.packaging_components.length > 0) {
      updates.components = selection.packaging_components;
      updates.has_component_breakdown = true;
    }

    // Auto-populate packaging-specific supplier data
    if (selection.supplier_weight_g !== undefined && selection.supplier_weight_g !== null && selection.supplier_weight_g > 0) {
      updates.net_weight_g = selection.supplier_weight_g;
      // Convert weight to the packaging unit for the amount field
      if (!packaging.amount || packaging.amount === '' || Number(packaging.amount) === 0) {
        if (packaging.unit === 'kg') {
          updates.amount = (selection.supplier_weight_g / 1000).toString();
        } else {
          updates.amount = selection.supplier_weight_g.toString();
        }
      }
    }

    // Auto-populate EPR drinks container flag from supplier
    if (selection.supplier_epr_is_drinks_container !== undefined && selection.supplier_epr_is_drinks_container !== null) {
      updates.epr_is_drinks_container = selection.supplier_epr_is_drinks_container;
    }

    onUpdate(packaging.tempId, updates);
  };

  // Filter linked supplier products for packaging context.
  // Treat any product with a packaging_category as packaging — older supplier
  // products may still default to product_type='ingredient' but carry the
  // packaging_category that proves their real nature.
  const packagingSupplierProducts = (linkedSupplierProducts || []).filter((p: any) => {
    const isPackaging =
      p.product_type === 'packaging' ||
      !!p.packaging_category ||
      p.weight_g != null ||
      !!p.primary_material ||
      !!p.epr_material_code ||
      (typeof p.category === 'string' && p.category.toLowerCase().startsWith('packaging'));
    if (!isPackaging) return false;
    // Further filter by packaging category if set
    if (packaging.packaging_category && p.packaging_category) {
      return p.packaging_category === packaging.packaging_category;
    }
    return true;
  });

  const handleSupplierProductSelect = (product: any) => {
    // Use the same logic as handleSearchSelect but directly from the supplier product
    let detectedCategory: PackagingCategory = packaging.packaging_category || 'container';
    if (product.packaging_category) {
      detectedCategory = product.packaging_category as PackagingCategory;
    }

    // Resolve origin: prefer product-level origin, fall back to supplier-level location
    const originAddress = product.origin_address || product.supplier_address
      || [product.supplier_city, product.supplier_country].filter(Boolean).join(', ')
      || undefined;
    const originLat = product.origin_lat ?? product.supplier_lat ?? undefined;
    const originLng = product.origin_lng ?? product.supplier_lng ?? undefined;
    const originCountryCode = product.origin_country_code ?? product.supplier_country_code ?? undefined;

    const updates: Partial<PackagingFormData> = {
      name: product.name,
      matched_source_name: product.name,
      data_source: 'supplier',
      data_source_id: product.id,
      supplier_product_id: product.id,
      supplier_name: product.supplier_name,
      carbon_intensity: product.impact_climate ?? product.carbon_intensity ?? undefined,
      ef_source: 'Primary Verified',
      ef_source_type: 'primary',
      ...(!packaging.packaging_category ? { packaging_category: detectedCategory } : {}),
      ...(!packaging.amount ? { unit: product.unit || 'kg' } : {}),
      // Origin/location data from supplier product or supplier profile
      ...(originAddress ? { origin_address: originAddress } : {}),
      ...(originLat != null ? { origin_lat: originLat } : {}),
      ...(originLng != null ? { origin_lng: originLng } : {}),
      ...(originCountryCode ? { origin_country_code: originCountryCode, origin_country: originCountryCode } : {}),
    };

    // Auto-populate recycled content if provided
    if (product.recycled_content_pct != null) {
      updates.recycled_content_percentage = product.recycled_content_pct;
    }

    // Auto-populate weight if provided
    if (product.weight_g != null && product.weight_g > 0) {
      updates.net_weight_g = product.weight_g;
      if (!packaging.amount || packaging.amount === '' || Number(packaging.amount) === 0) {
        if (packaging.unit === 'kg') {
          updates.amount = (product.weight_g / 1000).toString();
        } else {
          updates.amount = product.weight_g.toString();
        }
      }
    }

    // Auto-populate EPR drinks container flag
    if (product.epr_is_drinks_container != null) {
      updates.epr_is_drinks_container = product.epr_is_drinks_container;
    }

    onUpdate(packaging.tempId, updates);
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
                Packaging {index + 1}
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Use smart search to find packaging materials with environmental data
              </p>
            </div>
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(packaging.tempId)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">
              Type <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-2 font-normal">(UK EPR packaging class)</span>
            </Label>
            <TooltipProvider>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PACKAGING_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = packaging.packaging_category === type.value;
                  return (
                    <Tooltip key={type.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            // Only do something if the category actually changes
                            if (packaging.packaging_category !== type.value) {
                              // Check if this is a saved item (has database ID, not temp- prefix)
                              const isSavedItem = !packaging.tempId.startsWith('temp-');

                              if (isSavedItem && onAddNewWithType) {
                                // For saved items, ADD a new packaging item with the selected type
                                // This preserves the existing item instead of overwriting it
                                onAddNewWithType(type.value as PackagingCategory);
                              } else {
                                // For new/unsaved items, just update the type and reset fields
                                onUpdate(packaging.tempId, {
                                  packaging_category: type.value as PackagingCategory,
                                  // Reset material-specific fields when packaging type changes
                                  name: '',
                                  data_source: null,
                                  data_source_id: undefined,
                                  supplier_product_id: undefined,
                                  supplier_name: undefined,
                                  carbon_intensity: undefined,
                                  // Reset EPR components
                                  components: [],
                                  has_component_breakdown: false,
                                  // Reset auto-loaded recycled content
                                  recycled_content_percentage: '',
                                  // Reset weight fields
                                  net_weight_g: '',
                                  amount: '',
                                  // Reset allocation field
                                  units_per_group: '',
                                  // Reset origin & logistics fields
                                  origin_address: '',
                                  origin_lat: undefined,
                                  origin_lng: undefined,
                                  origin_country: '',
                                  origin_country_code: '',
                                  distance_km: '',
                                });
                              }
                            }
                          }}
                          className={`
                            flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all
                            ${isSelected
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }
                          `}
                        >
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-orange-600' : 'text-slate-600 dark:text-slate-400'}`} />
                          <span className={`text-[10px] font-medium leading-tight ${isSelected ? 'text-orange-800 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {type.label}
                          </span>
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${isSelected ? 'border-orange-300 text-orange-600' : 'border-slate-300 text-slate-500'}`}>
                            {type.eprLevel}
                          </Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px]">
                        <p className="text-xs">{type.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>

          {packaging.packaging_category && (
            <>
              {/* Supplier product suggestions - shown above name when available */}
              {packagingSupplierProducts.length > 0 && !packaging.supplier_product_id && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      From your suppliers
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {packagingSupplierProducts.slice(0, 6).map((product: any) => {
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
                              {product.weight_g != null && product.weight_g > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {product.weight_g}g
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
              {packaging.supplier_product_id && packaging.data_source === 'supplier' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    Using primary data from <span className="font-medium">{packaging.supplier_name || 'supplier'}</span>
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onUpdate(packaging.tempId, {
                      name: '',
                      matched_source_name: undefined,
                      data_source: null,
                      data_source_id: undefined,
                      supplier_product_id: undefined,
                      supplier_name: undefined,
                      carbon_intensity: undefined,
                      ef_source: undefined,
                      ef_source_type: undefined,
                      recycled_content_percentage: '',
                      net_weight_g: '',
                      amount: '',
                    })}
                  >
                    Clear
                  </button>
                </div>
              )}

              <div>
                <Label htmlFor={`name-${packaging.tempId}`}>
                  Material Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`name-${packaging.tempId}`}
                  value={packaging.name}
                  onChange={(e) => onUpdate(packaging.tempId, { name: e.target.value })}
                  placeholder="e.g. 750ml Flint Glass Bordeaux Bottle"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The full display name for this packaging material
                </p>
              </div>

              <div>
                <Label htmlFor={`search-${packaging.tempId}`} className="flex items-center gap-2">
                  Emission Factor <span className="text-destructive">*</span>
                </Label>
                <InlineIngredientSearch
                  organizationId={organizationId}
                  value={packaging.matched_source_name || ''}
                  placeholder="Search databases for emission factor..."
                  materialType="packaging"
                  packagingCategory={packaging.packaging_category || undefined}
                  onSelect={handleSearchSelect}
                  onChange={() => onUpdate(packaging.tempId, { matched_source_name: undefined, data_source: null, data_source_id: undefined, ef_source: undefined, ef_source_type: undefined, ef_data_quality_grade: undefined, ef_uncertainty_percent: undefined })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search for the closest matching emission factor from supplier data or global databases
                </p>
                {packaging.matched_source_name && packaging.matched_source_name !== packaging.name && packaging.data_source !== 'supplier' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs cursor-help">
                          <Database className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-amber-700 dark:text-amber-300">
                            Calculation proxy: <span className="font-medium">{packaging.matched_source_name}</span>
                          </span>
                          {(packaging.carbon_intensity || packaging.ef_source) && (
                            <Info className="h-3 w-3 text-amber-400 dark:text-amber-500 shrink-0 ml-auto" />
                          )}
                        </div>
                      </TooltipTrigger>
                      {(packaging.carbon_intensity || packaging.ef_source || packaging.ef_data_quality_grade) && (
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            {packaging.carbon_intensity != null && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">CO₂e intensity</span>
                                <span className="font-medium">{packaging.carbon_intensity.toFixed(3)} kg CO₂e/{packaging.unit || 'kg'}</span>
                              </div>
                            )}
                            {packaging.ef_source && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Source</span>
                                <span className="font-medium">{packaging.ef_source}</span>
                              </div>
                            )}
                            {packaging.ef_data_quality_grade && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Data quality</span>
                                <span className="font-medium">{packaging.ef_data_quality_grade}</span>
                              </div>
                            )}
                            {packaging.origin_address && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Geography</span>
                                <span className="font-medium">{packaging.origin_address}</span>
                              </div>
                            )}
                            {packaging.ef_uncertainty_percent != null && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Uncertainty</span>
                                <span className="font-medium">±{packaging.ef_uncertainty_percent}%</span>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {packaging.packaging_category === 'container' && (
                <div>
                  <Label htmlFor={`recycled-${packaging.tempId}`}>
                    Recycled Content (%)
                  </Label>
                  <Input
                    id={`recycled-${packaging.tempId}`}
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={packaging.recycled_content_percentage}
                    onChange={(e) => onUpdate(packaging.tempId, { recycled_content_percentage: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for Plastic Tax calculation
                  </p>
                </div>
              )}

              {packaging.packaging_category === 'label' && (
                <div>
                  <Label htmlFor={`printing-${packaging.tempId}`}>Printing Process</Label>
                  <Select
                    value={packaging.printing_process || 'standard_ink'}
                    onValueChange={(value) => onUpdate(packaging.tempId, { printing_process: value })}
                  >
                    <SelectTrigger id={`printing-${packaging.tempId}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard_ink">Standard Ink</SelectItem>
                      <SelectItem value="foil_stamping">Foil Stamping</SelectItem>
                      <SelectItem value="shrink_sleeve">Shrink Sleeve</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select &apos;Foil&apos; if metallic elements are used
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor={`net-weight-${packaging.tempId}`}>
                  Net Weight (g) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`net-weight-${packaging.tempId}`}
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0"
                  value={packaging.net_weight_g}
                  onChange={(e) => {
                    const weightInGrams = e.target.value;
                    const weightValue = Number(weightInGrams);

                    // Convert to the unit used by the material
                    let amount = weightInGrams;
                    if (packaging.unit === 'kg') {
                      // Convert grams to kg
                      amount = (weightValue / 1000).toString();
                    }

                    onUpdate(packaging.tempId, {
                      net_weight_g: weightInGrams,
                      amount: amount
                    });
                  }}
                  className={
                    (packaging.packaging_category === 'label' && Number(packaging.net_weight_g) > 10) ||
                    (packaging.packaging_category === 'closure' && Number(packaging.net_weight_g) > 10)
                      ? 'border-amber-500 focus-visible:ring-amber-500'
                      : ''
                  }
                />
                {packaging.packaging_category === 'label' && Number(packaging.net_weight_g) > 10 && (
                  <Alert className="mt-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Sanity Check:</strong> This label weighs over 10g, which is unusually high. Typical beverage labels weigh 1-5g. Please verify this value.
                    </AlertDescription>
                  </Alert>
                )}
                {packaging.packaging_category === 'closure' && Number(packaging.net_weight_g) > 10 && (
                  <Alert className="mt-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Sanity Check:</strong> This closure/cap weighs over 10g, which is unusually high. Typical caps weigh 2-8g. Please verify this value.
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  The weight of one unit
                </p>
              </div>

              {/* Units Per Packaging — only for secondary/shipment/tertiary (ISO 14044 allocation) */}
              {packaging.packaging_category && ['secondary', 'shipment', 'tertiary'].includes(packaging.packaging_category) && (
                <div>
                  <Label htmlFor={`units-per-group-${packaging.tempId}`}>
                    Units Per Packaging <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`units-per-group-${packaging.tempId}`}
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 24"
                    value={packaging.units_per_group}
                    onChange={(e) => onUpdate(packaging.tempId, { units_per_group: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How many product units does this packaging contain? (e.g. 24 for a case of 24 bottles). The environmental impact will be divided by this number.
                  </p>
                </div>
              )}

              {/* ── Circularity ─────────────────────────────────────────────
                  Reuse amortisation + recycled content + end-of-life. Shown
                  for primary + shared packaging; skipped for labels/closures
                  where reuse doesn't make sense. */}
              {packaging.packaging_category &&
                ['container', 'secondary', 'tertiary'].includes(packaging.packaging_category) && (
                <CircularitySection packaging={packaging} onUpdate={onUpdate} />
              )}

              {/* EPR Material Breakdown Section */}
              <PackagingComponentEditor
                components={packaging.components || []}
                totalWeight={Number(packaging.net_weight_g) || 0}
                onComponentsChange={(components) => onUpdate(packaging.tempId, {
                  components,
                  has_component_breakdown: components.length > 0,
                })}
                packagingCategory={packaging.packaging_category || undefined}
              />

              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Origin & Logistics
                </h4>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`origin-address-${packaging.tempId}`}>
                      Where is this manufactured? (City or Factory Name)
                    </Label>
                    <LocationPicker
                      value={packaging.origin_address || ''}
                      placeholder="e.g., Shanghai, China or Birmingham Glass Factory, UK"
                      onLocationSelect={(location: LocationData) => {
                        // Recompute ALL leg distances with the new origin coordinates.
                        const recomputed = recomputeDistances(legs, location.lat, location.lng);
                        const first = recomputed[0];
                        onUpdate(packaging.tempId, {
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
                      Search for the production location. City-level precision required.
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

                      // "From" — packaging origin for leg 0; previous leg's waypoint for subsequent legs
                      const fromLabel = isFirst
                        ? (packaging.origin_address || 'Set packaging origin above')
                        : (legs[legIndex - 1].toAddress || `Waypoint ${legIndex}`);
                      const fromHasCoords = isFirst
                        ? !!(packaging.origin_lat && packaging.origin_lng)
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
                            <p className="text-muted-foreground">Per unit weight. Uses DEFRA 2025 freight factors.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* EPR Compliance Section */}
              <EPRComplianceSection
                packaging={packaging}
                onUpdate={(updates) => onUpdate(packaging.tempId, updates)}
              />

              {packaging.data_source && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex-1">
                    {getDataSourceBadge()}
                  </div>
                </div>
              )}

              {packaging.data_source === 'openlca' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> This packaging uses secondary data from the global database. For more accurate results, consider using supplier-specific data from your network.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Circularity section: reuse amortisation + recycled content + recyclability
// + end-of-life pathway. Collapsible to keep the form visually lean.
// ────────────────────────────────────────────────────────────────────────────
function CircularitySection({
  packaging,
  onUpdate,
}: {
  packaging: PackagingFormData;
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
}) {
  const [isOpen, setIsOpen] = useState(
    !!(packaging.reuse_trips || packaging.recyclability_percent || packaging.end_of_life_pathway),
  );
  const trips = Number(packaging.reuse_trips) || 1;
  const netWeightG = Number(packaging.net_weight_g) || 0;
  const amortisedG = trips > 1 ? netWeightG / trips : netWeightG;
  const isReusable = trips > 1;

  const applyDefaults = () => {
    const defaults = lookupPackagingDefaults(packaging.name);
    if (!defaults) return;
    const patch: Partial<PackagingFormData> = {};
    if (defaults.reuse_trips && !packaging.reuse_trips) patch.reuse_trips = defaults.reuse_trips;
    if (defaults.recycled_content_percentage != null && !packaging.recycled_content_percentage) {
      patch.recycled_content_percentage = defaults.recycled_content_percentage;
    }
    if (defaults.recyclability_percent != null && !packaging.recyclability_percent) {
      patch.recyclability_percent = defaults.recyclability_percent;
    }
    if (defaults.end_of_life_pathway && !packaging.end_of_life_pathway) {
      patch.end_of_life_pathway = defaults.end_of_life_pathway;
    }
    if (Object.keys(patch).length > 0) onUpdate(packaging.tempId, patch);
  };

  const hasSuggestion = !!lookupPackagingDefaults(packaging.name);

  return (
    <div className="pt-2 border-t">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto hover:bg-transparent w-full justify-start">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Recycle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">Circularity</span>
            {isReusable && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
                Reusable · {trips} trips
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          {hasSuggestion && (
            <Button type="button" variant="outline" size="sm" onClick={applyDefaults} className="h-7 text-xs">
              Suggest defaults for &ldquo;{packaging.name}&rdquo;
            </Button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`reuse-trips-${packaging.tempId}`}>Reuse trips</Label>
              <Input
                id={`reuse-trips-${packaging.tempId}`}
                type="number"
                step="1"
                min="1"
                placeholder="Single use"
                value={packaging.reuse_trips}
                onChange={(e) => onUpdate(packaging.tempId, { reuse_trips: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Typical: firkin 100, keg 150, refillable glass 30. Leave blank for single-use.
              </p>
              {isReusable && netWeightG > 0 && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                  Per-unit impact: {amortisedG.toFixed(1)} g ({netWeightG.toFixed(0)} g ÷ {trips} trips)
                </p>
              )}
            </div>

            {packaging.packaging_category !== 'container' && (
              <div>
                <Label htmlFor={`recycled-nc-${packaging.tempId}`}>Recycled Content (%)</Label>
                <Input
                  id={`recycled-nc-${packaging.tempId}`}
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={packaging.recycled_content_percentage}
                  onChange={(e) => onUpdate(packaging.tempId, { recycled_content_percentage: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  % of feedstock that is recycled material.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor={`recyclability-${packaging.tempId}`}>Recyclability (%)</Label>
              <Input
                id={`recyclability-${packaging.tempId}`}
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                value={packaging.recyclability_percent}
                onChange={(e) => onUpdate(packaging.tempId, { recyclability_percent: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                % of this item that is recyclable in its destination market.
              </p>
            </div>

            <div>
              <Label htmlFor={`eol-${packaging.tempId}`}>End-of-life pathway</Label>
              <Select
                value={packaging.end_of_life_pathway || '__none__'}
                onValueChange={(value) => onUpdate(packaging.tempId, {
                  end_of_life_pathway: value === '__none__' ? '' : (value as PackagingFormData['end_of_life_pathway']),
                })}
              >
                <SelectTrigger id={`eol-${packaging.tempId}`}>
                  <SelectValue placeholder="Select pathway" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="reuse">Reuse</SelectItem>
                  <SelectItem value="recycling">Recycling</SelectItem>
                  <SelectItem value="composting">Composting</SelectItem>
                  <SelectItem value="incineration">Incineration (with energy recovery)</SelectItem>
                  <SelectItem value="landfill">Landfill</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Most common fate for this item after consumer use.
              </p>
            </div>

            <div>
              <Label htmlFor={`biobased-${packaging.tempId}`}>Bio-based content (%)</Label>
              <Input
                id={`biobased-${packaging.tempId}`}
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                value={packaging.biobased_content_percentage}
                onChange={(e) => onUpdate(packaging.tempId, { biobased_content_percentage: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                % of feedstock from renewable biological sources (optional).
              </p>
            </div>
          </div>

          <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
            <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <AlertDescription className="text-xs text-emerald-900 dark:text-emerald-100">
              Reuse trips amortise container weight across its service life (9 kg firkin ÷ 100 trips = 90 g/unit). Recycled content applies a 50% credit against the virgin-material climate impact (PAS 2050 cut-off).
            </AlertDescription>
          </Alert>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
