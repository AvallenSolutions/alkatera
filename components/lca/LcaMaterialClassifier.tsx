"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Box } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialCombobox } from "./MaterialCombobox";
import { useIngredients } from "@/hooks/data/useIngredients";
import { usePackagingTypes } from "@/hooks/data/usePackagingTypes";
import { useOrganization } from "@/lib/organizationContext";
import type { MaterialSelectionOutput, MaterialType } from "@/lib/types/lca";

interface LcaMaterialClassifierProps {
  onMaterialSelect: (selection: MaterialSelectionOutput) => void;
  initialValue?: MaterialSelectionOutput;
  disabled?: boolean;
  className?: string;
}

export function LcaMaterialClassifier({
  onMaterialSelect,
  initialValue,
  disabled = false,
  className,
}: LcaMaterialClassifierProps) {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const [activeTab, setActiveTab] = useState<MaterialType>(
    initialValue?.materialType || "ingredient"
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    initialValue?.materialId || null
  );
  const [materialType, setMaterialType] = useState<MaterialType | null>(
    initialValue?.materialType || null
  );
  const [quantity, setQuantity] = useState<number>(initialValue?.quantity || 0);
  const [selectedSubStageName, setSelectedSubStageName] = useState<string | null>(null);

  const { ingredients, isLoading: isLoadingIngredients, error: ingredientsError } = useIngredients(organizationId);
  const { packagingTypes, isLoading: isLoadingPackaging, error: packagingError } = usePackagingTypes(organizationId);

  const handleIngredientSelect = useCallback((ingredientId: string) => {
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    if (ingredient) {
      setSelectedMaterialId(ingredientId);
      setMaterialType("ingredient");
      setSelectedSubStageName(ingredient.lca_sub_stages?.name || "Uncategorised");
    }
  }, [ingredients]);

  const handlePackagingSelect = useCallback((packagingId: string) => {
    const packaging = packagingTypes.find((pkg) => pkg.id === packagingId);
    if (packaging) {
      setSelectedMaterialId(packagingId);
      setMaterialType("packaging");
      setSelectedSubStageName("Packaging Production");
    }
  }, [packagingTypes]);

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setQuantity(isNaN(value) ? 0 : Math.max(0, value));
  }, []);

  useEffect(() => {
    if (selectedMaterialId && materialType && quantity > 0) {
      onMaterialSelect({
        materialId: selectedMaterialId,
        materialType,
        quantity,
      });
    }
  }, [selectedMaterialId, materialType, quantity, onMaterialSelect]);

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as MaterialType;
    setActiveTab(newTab);
    setSelectedMaterialId(null);
    setMaterialType(null);
    setSelectedSubStageName(null);
  }, []);

  const isLoading = isLoadingIngredients || isLoadingPackaging;
  const hasError = ingredientsError || packagingError;

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
        <CardTitle>Select Material</CardTitle>
        <CardDescription>
          Choose from your organisation's ingredient or packaging library
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
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : ingredients.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No ingredients found. Add ingredients to your organisation library to begin.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ingredient-select">Ingredient</Label>
                  <MaterialCombobox
                    options={ingredients.map((ing) => ({
                      id: ing.id,
                      name: ing.name,
                    }))}
                    value={materialType === "ingredient" ? selectedMaterialId : null}
                    onChange={handleIngredientSelect}
                    placeholder="Select an ingredient..."
                    searchPlaceholder="Search ingredients..."
                    emptyMessage="No ingredients found."
                    disabled={disabled}
                  />
                </div>

                {selectedMaterialId && materialType === "ingredient" && (
                  <div className="space-y-2">
                    <Label htmlFor="lca-classification-ingredient">LCA Classification</Label>
                    <Input
                      id="lca-classification-ingredient"
                      value={selectedSubStageName || ""}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      This ingredient is automatically classified under the above LCA sub-stage
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="packaging" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : packagingTypes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No packaging types found. Add packaging to your organisation library to begin.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="packaging-select">Packaging Type</Label>
                  <MaterialCombobox
                    options={packagingTypes.map((pkg) => ({
                      id: pkg.id,
                      name: pkg.name,
                    }))}
                    value={materialType === "packaging" ? selectedMaterialId : null}
                    onChange={handlePackagingSelect}
                    placeholder="Select packaging..."
                    searchPlaceholder="Search packaging types..."
                    emptyMessage="No packaging types found."
                    disabled={disabled}
                  />
                </div>

                {selectedMaterialId && materialType === "packaging" && (
                  <div className="space-y-2">
                    <Label htmlFor="lca-classification-packaging">LCA Classification</Label>
                    <Input
                      id="lca-classification-packaging"
                      value="Packaging Production"
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      All packaging materials are classified under Packaging Production per LCA methodology
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {selectedMaterialId && (
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={handleQuantityChange}
              placeholder="Enter quantity..."
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Enter the quantity of this material used (e.g., kg, litres, units)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
