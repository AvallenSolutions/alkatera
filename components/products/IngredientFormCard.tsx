"use client";

import { useState, useEffect } from "react";
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
import { Trash2, Building2, Database, Sprout, Info, MapPin, Calculator, Award, Layers } from "lucide-react";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { GoogleAddressInput } from "@/components/ui/google-address-input";
import { COUNTRIES } from "@/lib/countries";
import type { DataSource } from "@/lib/types/lca";
import { calculateDistance } from "@/lib/utils/distance-calculator";

export interface IngredientFormData {
  tempId: string;
  name: string;
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

interface IngredientFormCardProps {
  ingredient: IngredientFormData;
  index: number;
  organizationId: string;
  productionFacilities: ProductionFacility[];
  onUpdate: (tempId: string, updates: Partial<IngredientFormData>) => void;
  onRemove: (tempId: string) => void;
  canRemove: boolean;
}

export function IngredientFormCard({
  ingredient,
  index,
  organizationId,
  productionFacilities,
  onUpdate,
  onRemove,
  canRemove,
}: IngredientFormCardProps) {
  const getDataSourceBadge = () => {
    if (!ingredient.data_source) return null;

    switch (ingredient.data_source) {
      case 'supplier':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Award className="h-3 w-3 mr-1.5" />
              Supplier Verified (High Quality)
            </Badge>
            <span className="text-xs text-muted-foreground">95% confidence</span>
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
    if (productionFacilities.length === 0) {
      return 0;
    }

    if (productionFacilities.length === 1) {
      const facility = productionFacilities[0];
      if (facility.address_lat && facility.address_lng) {
        return calculateDistance(originLat, originLng, facility.address_lat, facility.address_lng);
      }
    }

    // Calculate weighted average distance based on production share
    let totalWeightedDistance = 0;
    let totalWeight = 0;

    for (const facility of productionFacilities) {
      if (facility.address_lat && facility.address_lng) {
        const distance = calculateDistance(originLat, originLng, facility.address_lat, facility.address_lng);
        const weight = facility.production_share || (100 / productionFacilities.length); // Equal weight if no share specified
        totalWeightedDistance += distance * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalWeightedDistance / totalWeight) : 0;
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
    onUpdate(ingredient.tempId, {
      name: selection.name,
      data_source: selection.data_source,
      data_source_id: selection.data_source_id,
      supplier_product_id: selection.supplier_product_id,
      supplier_name: selection.supplier_name,
      unit: selection.unit,
      carbon_intensity: selection.carbon_intensity,
      location: selection.location,
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
          <div>
            <Label htmlFor={`search-${ingredient.tempId}`} className="flex items-center gap-2">
              Search Ingredient <span className="text-destructive">*</span>
            </Label>
            <InlineIngredientSearch
              organizationId={organizationId}
              value={ingredient.name}
              placeholder="Search for ingredient..."
              onSelect={handleSearchSelect}
              onChange={(value) => onUpdate(ingredient.tempId, { name: value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Search by ingredient name to find matches from your supplier network or global database
            </p>
          </div>

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
                onValueChange={(value) => onUpdate(ingredient.tempId, { unit: value })}
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
                <GoogleAddressInput
                  value={ingredient.origin_address || ''}
                  placeholder="e.g., Munich, Germany or Yorkshire Maltings, UK"
                  onAddressSelect={(address) => {
                    const calculatedDistance = calculateAndSetDistance(address.lat, address.lng);
                    onUpdate(ingredient.tempId, {
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
                  Search for the city or factory where this ingredient is produced.
                  We need at least city-level accuracy for transport calculations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`transport-${ingredient.tempId}`}>Transport Mode</Label>
                  <Select
                    value={ingredient.transport_mode}
                    onValueChange={(value: any) => onUpdate(ingredient.tempId, { transport_mode: value })}
                  >
                    <SelectTrigger id={`transport-${ingredient.tempId}`}>
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
                  <Label htmlFor={`distance-${ingredient.tempId}`} className="flex items-center gap-1">
                    Distance (km)
                    {ingredient.distance_km && productionFacilities.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                        <Calculator className="h-2.5 w-2.5 mr-0.5" />
                        Auto
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id={`distance-${ingredient.tempId}`}
                    type="number"
                    step="1"
                    min="0"
                    placeholder={productionFacilities.length === 0 ? "No facilities configured" : "Select origin to calculate"}
                    value={ingredient.distance_km}
                    onChange={(e) => onUpdate(ingredient.tempId, { distance_km: e.target.value })}
                    readOnly={!!ingredient.origin_lat && productionFacilities.length > 0}
                    className={ingredient.origin_lat && productionFacilities.length > 0 ? 'bg-muted cursor-not-allowed' : ''}
                  />
                  {ingredient.origin_lat && productionFacilities.length > 0 && (
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

          {ingredient.data_source && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex-1">
                {getDataSourceBadge()}
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
