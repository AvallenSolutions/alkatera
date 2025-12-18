"use client";

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
import { Trash2, Building2, Database, Sprout, Info, Package, Tag, Grip, Box, MapPin, Calculator } from "lucide-react";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { GoogleAddressInput } from "@/components/ui/google-address-input";
import { COUNTRIES } from "@/lib/countries";
import type { DataSource, PackagingCategory } from "@/lib/types/lca";
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

const PACKAGING_TYPES = [
  { value: 'container', label: 'Container', icon: Package },
  { value: 'label', label: 'Label', icon: Tag },
  { value: 'closure', label: 'Closure', icon: Grip },
  { value: 'secondary', label: 'Secondary', icon: Box },
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
    // Determine destination facilities: use production facilities if available, otherwise fall back to organization location
    const facilitiesToUse: Array<{ lat: number; lng: number; weight: number }> = [];

    if (productionFacilities.length > 0) {
      // Use production facilities with their shares
      for (const facility of productionFacilities) {
        if (facility.address_lat && facility.address_lng) {
          facilitiesToUse.push({
            lat: facility.address_lat,
            lng: facility.address_lng,
            weight: facility.production_share || (100 / productionFacilities.length),
          });
        }
      }
    } else if (organizationLat && organizationLng) {
      // Fall back to organization location if no production facilities
      facilitiesToUse.push({
        lat: organizationLat,
        lng: organizationLng,
        weight: 100,
      });
    } else {
      // No location data available
      return 0;
    }

    if (facilitiesToUse.length === 0) {
      return 0;
    }

    // Calculate weighted average distance
    let totalWeightedDistance = 0;
    let totalWeight = 0;

    for (const facility of facilitiesToUse) {
      const distance = calculateDistance(originLat, originLng, facility.lat, facility.lng);
      totalWeightedDistance += distance * facility.weight;
      totalWeight += facility.weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedDistance / totalWeight) : 0;
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
  }) => {
    // Auto-detect packaging category from material name
    const nameLower = selection.name.toLowerCase();
    let detectedCategory: PackagingCategory = 'container';

    if (nameLower.includes('label') || nameLower.includes('sticker')) {
      detectedCategory = 'label';
    } else if (nameLower.includes('cap') || nameLower.includes('lid') || nameLower.includes('closure') || nameLower.includes('cork')) {
      detectedCategory = 'closure';
    } else if (nameLower.includes('box') || nameLower.includes('carton') || nameLower.includes('cardboard') || nameLower.includes('case') || nameLower.includes('crate')) {
      detectedCategory = 'secondary';
    } else if (nameLower.includes('bottle') || nameLower.includes('jar') || nameLower.includes('can') || nameLower.includes('container') || nameLower.includes('pouch')) {
      detectedCategory = 'container';
    }

    onUpdate(packaging.tempId, {
      name: selection.name,
      data_source: selection.data_source,
      data_source_id: selection.data_source_id,
      supplier_product_id: selection.supplier_product_id,
      supplier_name: selection.supplier_name,
      unit: selection.unit,
      carbon_intensity: selection.carbon_intensity,
      location: selection.location,
      packaging_category: detectedCategory,
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
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PACKAGING_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = packaging.packaging_category === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => onUpdate(packaging.tempId, { packaging_category: type.value as PackagingCategory })}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-orange-600' : 'text-slate-600 dark:text-slate-400'}`} />
                    <span className={`text-xs font-medium ${isSelected ? 'text-orange-800 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
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
                    Select 'Foil' if metallic elements are used
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
                  onChange={(e) => onUpdate(packaging.tempId, {
                    net_weight_g: e.target.value,
                    amount: e.target.value
                  })}
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
                    <GoogleAddressInput
                      value={packaging.origin_address || ''}
                      placeholder="e.g., Shanghai, China or Birmingham Glass Factory, UK"
                      onAddressSelect={(address) => {
                        const calculatedDistance = calculateAndSetDistance(address.lat, address.lng);
                        onUpdate(packaging.tempId, {
                          origin_address: address.formatted_address,
                          origin_lat: address.lat,
                          origin_lng: address.lng,
                          origin_country_code: address.country_code,
                          origin_country: address.formatted_address,
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
                          Add a facility with location to enable automatic distance calculation
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

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
