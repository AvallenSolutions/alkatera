"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Building2, Database, Sprout, Info, Package, Tag, Grip, Box } from "lucide-react";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import type { DataSource, PackagingCategory } from "@/lib/types/lca";

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
  label_printing_type: string;
  transport_mode: 'truck' | 'train' | 'ship' | 'air';
  distance_km: number | string;
  carbon_intensity?: number;
  location?: string;
}

interface PackagingFormCardProps {
  packaging: PackagingFormData;
  index: number;
  organizationId: string;
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
  onRemove: (tempId: string) => void;
  canRemove: boolean;
}

const PACKAGING_CATEGORIES = [
  { value: 'container', label: 'Container', icon: Package, description: 'Bottles, cans, packs' },
  { value: 'label', label: 'Label', icon: Tag, description: 'Labels and printing' },
  { value: 'closure', label: 'Closure', icon: Grip, description: 'Caps, corks, seals' },
  { value: 'secondary', label: 'Secondary', icon: Box, description: 'Gift packs, delivery boxes' },
] as const;

export function PackagingFormCard({
  packaging,
  index,
  organizationId,
  onUpdate,
  onRemove,
  canRemove,
}: PackagingFormCardProps) {
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
    onUpdate(packaging.tempId, {
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
            <Label htmlFor={`category-${packaging.tempId}`}>
              Packaging Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={packaging.packaging_category || undefined}
              onValueChange={(value: PackagingCategory) =>
                onUpdate(packaging.tempId, { packaging_category: value })
              }
            >
              <SelectTrigger id={`category-${packaging.tempId}`}>
                <SelectValue placeholder="Select packaging category..." />
              </SelectTrigger>
              <SelectContent>
                {PACKAGING_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{cat.label}</div>
                          <div className="text-xs text-muted-foreground">{cat.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {packaging.packaging_category && (
            <>
              <div>
                <Label htmlFor={`search-${packaging.tempId}`} className="flex items-center gap-2">
                  Search Packaging <span className="text-destructive">*</span>
                </Label>
                <InlineIngredientSearch
                  organizationId={organizationId}
                  placeholder="Search for packaging materials..."
                  onSelect={handleSearchSelect}
                  value={packaging.name}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search by material name to find matches from your supplier network or global database
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`amount-${packaging.tempId}`}>
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`amount-${packaging.tempId}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={packaging.amount}
                    onChange={(e) => onUpdate(packaging.tempId, { amount: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantity used per product unit
                  </p>
                </div>

                <div>
                  <Label htmlFor={`unit-${packaging.tempId}`}>
                    Unit <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={packaging.unit}
                    onValueChange={(value) => onUpdate(packaging.tempId, { unit: value })}
                  >
                    <SelectTrigger id={`unit-${packaging.tempId}`}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Grams (g)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="unit">Units</SelectItem>
                      <SelectItem value="m2">Square Metres (m²)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {packaging.packaging_category === 'label' && (
                <div>
                  <Label htmlFor={`printing-${packaging.tempId}`}>Printing Type (Optional)</Label>
                  <Select
                    value={packaging.label_printing_type}
                    onValueChange={(value) => onUpdate(packaging.tempId, { label_printing_type: value })}
                  >
                    <SelectTrigger id={`printing-${packaging.tempId}`}>
                      <SelectValue placeholder="Select printing type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="offset">Offset</SelectItem>
                      <SelectItem value="flexographic">Flexographic</SelectItem>
                      <SelectItem value="gravure">Gravure</SelectItem>
                      <SelectItem value="screen">Screen</SelectItem>
                      <SelectItem value="letterpress">Letterpress</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
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
                  <Label htmlFor={`distance-${packaging.tempId}`}>Distance (km)</Label>
                  <Input
                    id={`distance-${packaging.tempId}`}
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={packaging.distance_km}
                    onChange={(e) => onUpdate(packaging.tempId, { distance_km: e.target.value })}
                  />
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
