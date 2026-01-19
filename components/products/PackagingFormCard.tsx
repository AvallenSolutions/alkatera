"use client";

import { useState } from "react";
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
import { Trash2, Building2, Database, Sprout, Info, Package, Tag, Grip, Box, MapPin, Calculator, Truck, Layers, FileText, ChevronDown, ChevronRight } from "lucide-react";
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

export interface PackagingFormData {
  tempId: string;
  name: string;
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
  carbon_intensity?: number;
  location?: string;
  // EPR Compliance fields
  has_component_breakdown: boolean;
  components: PackagingMaterialComponent[];
  epr_packaging_level?: EPRPackagingLevel;
  epr_packaging_activity?: EPRPackagingActivity;
  epr_is_household: boolean;
  epr_ram_rating?: EPRRAMRating;
  epr_uk_nation?: EPRUKNation;
  epr_is_drinks_container: boolean;
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
  organizationLat?: number | null;
  organizationLng?: number | null;
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
  onRemove: (tempId: string) => void;
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

export function PackagingFormCard({
  packaging,
  index,
  organizationId,
  productionFacilities,
  organizationLat,
  organizationLng,
  onUpdate,
  onRemove,
  canRemove,
}: PackagingFormCardProps) {
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

  const getDataSourceBadge = () => {
    if (!packaging.data_source) return null;

    switch (packaging.data_source) {
      case 'supplier':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            <Building2 className="h-3 w-3 mr-1" />
            Primary Data Selected
          </Badge>
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
    data_source: DataSource;
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit: string;
    carbon_intensity?: number;
    location?: string;
    recycled_content_pct?: number;
    packaging_components?: any;
  }) => {
    // Auto-detect packaging category from material name
    const nameLower = selection.name.toLowerCase();
    let detectedCategory: PackagingCategory = 'container';

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

    const updates: Partial<PackagingFormData> = {
      name: selection.name,
      data_source: selection.data_source,
      data_source_id: selection.data_source_id,
      supplier_product_id: selection.supplier_product_id,
      supplier_name: selection.supplier_name,
      unit: selection.unit,
      carbon_intensity: selection.carbon_intensity,
      location: selection.location,
      packaging_category: detectedCategory,
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
                            // Only reset material data if the category actually changes
                            if (packaging.packaging_category !== type.value) {
                              onUpdate(packaging.tempId, {
                                packaging_category: type.value as PackagingCategory,
                                // Reset material-specific fields when packaging type changes
                                name: '',
                                data_source: null,
                                data_source_id: undefined,
                                supplier_product_id: undefined,
                                supplier_name: undefined,
                                carbon_intensity: undefined,
                                location: undefined,
                                // Reset EPR components
                                components: [],
                                has_component_breakdown: false,
                                // Reset auto-loaded recycled content
                                recycled_content_percentage: '',
                              });
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
              <div>
                <Label htmlFor={`search-${packaging.tempId}`} className="flex items-center gap-2">
                  Search Material <span className="text-destructive">*</span>
                </Label>
                <InlineIngredientSearch
                  organizationId={organizationId}
                  value={packaging.name}
                  placeholder="Search for packaging material..."
                  onSelect={handleSearchSelect}
                  onChange={(value) => onUpdate(packaging.tempId, { name: value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search by material name to find matches from your supplier network or global database
                </p>
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
                  step="0.01"
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
                        console.log(`[Address Selected] ${location.address}`);
                        console.log(`[Material Origin Coordinates] Lat: ${location.lat}, Lng: ${location.lng}`);
                        const calculatedDistance = calculateAndSetDistance(location.lat, location.lng);
                        onUpdate(packaging.tempId, {
                          origin_address: location.address,
                          origin_lat: location.lat,
                          origin_lng: location.lng,
                          origin_country_code: location.countryCode || '',
                          origin_country: location.address,
                          distance_km: calculatedDistance,
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Search for the production location. City-level precision required.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`transport-${packaging.tempId}`}>Transport Mode</Label>
                      <Select
                        value={packaging.transport_mode}
                        onValueChange={(value: any) => onUpdate(packaging.tempId, { transport_mode: value })}
                      >
                        <SelectTrigger id={`transport-${packaging.tempId}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="train">Train</SelectItem>
                          <SelectItem value="ship">Ship</SelectItem>
                          <SelectItem value="air">Air</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor={`distance-${packaging.tempId}`} className="flex items-center gap-1">
                        Distance (km)
                        {packaging.distance_km && productionFacilities.length > 0 && (
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                            <Calculator className="h-2.5 w-2.5 mr-0.5" />
                            Auto
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id={`distance-${packaging.tempId}`}
                        type="number"
                        step="1"
                        min="0"
                        placeholder={productionFacilities.length === 0 ? "No facilities configured" : "Select origin to calculate"}
                        value={packaging.distance_km}
                        onChange={(e) => onUpdate(packaging.tempId, { distance_km: e.target.value })}
                        readOnly={!!packaging.origin_lat && productionFacilities.length > 0}
                        className={packaging.origin_lat && productionFacilities.length > 0 ? 'bg-muted cursor-not-allowed' : ''}
                      />
                      {packaging.origin_lat && productionFacilities.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Automatically calculated from origin to your production facility
                        </p>
                      )}
                      {productionFacilities.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          No production sites configured.{' '}
                          <Link href="/facilities" className="underline hover:text-amber-700 dark:hover:text-amber-300">
                            Add a facility with location
                          </Link>{' '}
                          and configure production sites to enable automatic distance calculation.
                        </p>
                      )}
                    </div>
                  </div>

                  {packaging.origin_lat && packaging.origin_lng && productionFacilities.length > 0 && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-xs space-y-1">
                        <div className="font-semibold text-blue-900 dark:text-blue-100">Distance Calculation Details:</div>
                        <div className="text-blue-800 dark:text-blue-200">
                          <strong>Material Origin:</strong> {packaging.origin_address}
                          <br />
                          <span className="font-mono text-[10px]">({packaging.origin_lat?.toFixed(4)}, {packaging.origin_lng?.toFixed(4)})</span>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                          <strong>Production Facility:</strong> {productionFacilities[0]?.name}
                          <br />
                          <span className="font-mono text-[10px]">({productionFacilities[0]?.address_lat?.toFixed(4)}, {productionFacilities[0]?.address_lng?.toFixed(4)})</span>
                        </div>
                        <div className="text-blue-900 dark:text-blue-100 font-semibold pt-1">
                          Calculated Distance: {packaging.distance_km} km
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
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
