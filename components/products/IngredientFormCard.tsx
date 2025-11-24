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
import { Trash2, Building2, Database, Sprout, Info } from "lucide-react";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { COUNTRIES } from "@/lib/countries";
import type { DataSource } from "@/lib/types/lca";

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
  is_organic_certified: boolean;
  transport_mode: 'truck' | 'train' | 'ship' | 'air';
  distance_km: number | string;
  carbon_intensity?: number;
  location?: string;
}

interface IngredientFormCardProps {
  ingredient: IngredientFormData;
  index: number;
  organizationId: string;
  onUpdate: (tempId: string, updates: Partial<IngredientFormData>) => void;
  onRemove: (tempId: string) => void;
  canRemove: boolean;
}

export function IngredientFormCard({
  ingredient,
  index,
  organizationId,
  onUpdate,
  onRemove,
  canRemove,
}: IngredientFormCardProps) {
  const getDataSourceBadge = () => {
    if (!ingredient.data_source) return null;

    switch (ingredient.data_source) {
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
              placeholder="Search for ingredients..."
              onSelect={handleSearchSelect}
              value={ingredient.name}
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

          <div>
            <Label htmlFor={`origin-${ingredient.tempId}`}>Origin Country</Label>
            <Select
              value={ingredient.origin_country}
              onValueChange={(value) => onUpdate(ingredient.tempId, { origin_country: value })}
            >
              <SelectTrigger id={`origin-${ingredient.tempId}`}>
                <SelectValue placeholder="Select country..." />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.value} value={country.label}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Country or region of origin
            </p>
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

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
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
              <Label htmlFor={`distance-${ingredient.tempId}`}>Distance (km)</Label>
              <Input
                id={`distance-${ingredient.tempId}`}
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={ingredient.distance_km}
                onChange={(e) => onUpdate(ingredient.tempId, { distance_km: e.target.value })}
              />
            </div>
          </div>

          {ingredient.data_source && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex-1">
                {getDataSourceBadge()}
              </div>
            </div>
          )}

          {ingredient.data_source === 'openlca' && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This ingredient uses secondary data from the global database. For more accurate results, consider using supplier-specific data from your network.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </Card>
  );
}
