"use client";

import { useState, useCallback } from "react";
import { Package, Box, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialCombobox } from "./MaterialCombobox";
import { useIngredients } from "@/hooks/data/useIngredients";
import { usePackagingTypes } from "@/hooks/data/usePackagingTypes";
import { useOrganization } from "@/lib/organizationContext";
import type { MaterialType, MaterialWithDetails } from "@/lib/types/lca";

interface LcaMaterialSelectorProps {
  onAddMaterial: (material: MaterialWithDetails) => void;
  disabled?: boolean;
  className?: string;
}

export function LcaMaterialSelector({
  onAddMaterial,
  disabled = false,
  className,
}: LcaMaterialSelectorProps) {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const [activeTab, setActiveTab] = useState<MaterialType>("ingredient");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [countryOfOrigin, setCountryOfOrigin] = useState<string>("");
  const [isOrganic, setIsOrganic] = useState<boolean>(false);
  const [isRegenerative, setIsRegenerative] = useState<boolean>(false);

  const { ingredients, isLoading: isLoadingIngredients, error: ingredientsError } = useIngredients(organizationId);
  const { packagingTypes, isLoading: isLoadingPackaging, error: packagingError } = usePackagingTypes(organizationId);

  const handleIngredientSelect = useCallback((ingredientId: string) => {
    setSelectedMaterialId(ingredientId);
  }, []);

  const handlePackagingSelect = useCallback((packagingId: string) => {
    setSelectedMaterialId(packagingId);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as MaterialType;
    setActiveTab(newTab);
    setSelectedMaterialId(null);
    setQuantity("");
    setUnit("");
    setCountryOfOrigin("");
    setIsOrganic(false);
    setIsRegenerative(false);
  }, []);

  const handleAddMaterial = useCallback(() => {
    if (!selectedMaterialId || !quantity || parseFloat(quantity) <= 0) {
      return;
    }

    let materialName = "Unknown";

    if (activeTab === "ingredient") {
      const ingredient = ingredients.find((ing) => ing.id === selectedMaterialId);
      materialName = ingredient?.name || "Unknown Ingredient";
    } else {
      const packaging = packagingTypes.find((pkg) => pkg.id === selectedMaterialId);
      materialName = packaging?.name || "Unknown Packaging";
    }

    const material: MaterialWithDetails = {
      material_id: selectedMaterialId,
      material_type: activeTab,
      name: materialName,
      quantity: parseFloat(quantity),
      unit: unit.trim() || "units",
      country_of_origin: countryOfOrigin.trim() || "Not specified",
      is_organic: isOrganic,
      is_regenerative: isRegenerative,
    };

    onAddMaterial(material);

    setSelectedMaterialId(null);
    setQuantity("");
    setUnit("");
    setCountryOfOrigin("");
    setIsOrganic(false);
    setIsRegenerative(false);
  }, [
    selectedMaterialId,
    quantity,
    unit,
    countryOfOrigin,
    isOrganic,
    isRegenerative,
    activeTab,
    ingredients,
    packagingTypes,
    onAddMaterial,
  ]);

  const isLoading = isLoadingIngredients || isLoadingPackaging;
  const hasError = ingredientsError || packagingError;
  const canAdd = selectedMaterialId && quantity && parseFloat(quantity) > 0;

  if (!organizationId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Please select an organisation to access material libraries.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Add Material</CardTitle>
        <CardDescription>
          Select materials from your organisation's library and specify details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>
              {ingredientsError?.message || packagingError?.message || "Failed to load materials"}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ingredient" disabled={disabled}>
              <Package className="mr-2 h-4 w-4" />
              Ingredients
            </TabsTrigger>
            <TabsTrigger value="packaging" disabled={disabled}>
              <Box className="mr-2 h-4 w-4" />
              Packaging
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingredient" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : ingredients.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No ingredients found. Add ingredients to your organisation library to begin.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ingredient-select">Ingredient</Label>
                <MaterialCombobox
                  options={ingredients.map((ing) => ({
                    id: ing.id,
                    name: ing.name,
                  }))}
                  value={selectedMaterialId}
                  onChange={handleIngredientSelect}
                  placeholder="Select an ingredient..."
                  searchPlaceholder="Search ingredients..."
                  emptyMessage="No ingredients found."
                  disabled={disabled}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="packaging" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : packagingTypes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No packaging types found. Add packaging to your organisation library to begin.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="packaging-select">Packaging Type</Label>
                <MaterialCombobox
                  options={packagingTypes.map((pkg) => ({
                    id: pkg.id,
                    name: pkg.name,
                  }))}
                  value={selectedMaterialId}
                  onChange={handlePackagingSelect}
                  placeholder="Select packaging..."
                  searchPlaceholder="Search packaging types..."
                  emptyMessage="No packaging types found."
                  disabled={disabled}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedMaterialId && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity..."
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg, L, units..."
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country of Origin</Label>
              <Input
                id="country"
                type="text"
                value={countryOfOrigin}
                onChange={(e) => setCountryOfOrigin(e.target.value)}
                placeholder="e.g., United Kingdom, France..."
                disabled={disabled}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-organic"
                  checked={isOrganic}
                  onCheckedChange={(checked) => setIsOrganic(checked === true)}
                  disabled={disabled}
                />
                <Label
                  htmlFor="is-organic"
                  className="text-sm font-normal cursor-pointer"
                >
                  Organic certified
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-regenerative"
                  checked={isRegenerative}
                  onCheckedChange={(checked) => setIsRegenerative(checked === true)}
                  disabled={disabled}
                />
                <Label
                  htmlFor="is-regenerative"
                  className="text-sm font-normal cursor-pointer"
                >
                  Regenerative practices
                </Label>
              </div>
            </div>

            <Button
              onClick={handleAddMaterial}
              disabled={!canAdd || disabled}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Material
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
