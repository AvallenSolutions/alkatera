"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Leaf,
  Box,
  Info,
  Plus,
  Sparkles,
  Upload,
  Wine,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { IngredientFormCard } from "@/components/products/IngredientFormCard";
import { PackagingFormCard } from "@/components/products/PackagingFormCard";
import { BOMImportFlow } from "@/components/products/BOMImportFlow";
import { MaturationProfileCard } from "@/components/products/MaturationProfileCard";
import { SearchGuidePanel } from "@/components/products/SearchGuidePanel";
import { useRecipeEditor } from "@/hooks/useRecipeEditor";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { MaturationFormData } from "@/components/products/MaturationProfileCard";

interface RecipeEditorPanelProps {
  productId: string;
  organizationId: string;
  onSaveComplete?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  compact?: boolean;
  initialTab?: string;
}

export function RecipeEditorPanel({
  productId,
  organizationId,
  onSaveComplete,
  onDirtyChange,
  compact = false,
  initialTab = "ingredients",
}: RecipeEditorPanelProps) {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showBOMImport, setShowBOMImport] = useState(false);

  const {
    product,
    productionFacilities,
    loading,
    saving,
    isDirty,
    ingredientForms,
    packagingForms,
    maturationProfile,
    ingredientCount,
    packagingCount,
    hasMaturationProfile,
    totalItems,
    fetchProductData,
    updateIngredient,
    removeIngredient,
    addIngredient,
    updatePackaging,
    removePackaging,
    addPackaging,
    addPackagingWithType,
    saveIngredients,
    savePackaging,
    saveMaturation,
    removeMaturation,
  } = useRecipeEditor(productId, organizationId);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSaveIngredients = async () => {
    await saveIngredients();
    onSaveComplete?.();
  };

  const handleSavePackaging = async () => {
    await savePackaging();
    onSaveComplete?.();
  };

  const handleSaveMaturation = async (formData: MaturationFormData) => {
    await saveMaturation({
      ...formData,
      product_id: parseInt(productId),
      organization_id: organizationId,
    } as any);
    onSaveComplete?.();
  };

  const handleRemoveMaturation = async () => {
    await removeMaturation();
    onSaveComplete?.();
  };

  const handleBOMImportComplete = async (
    importedIngredients: IngredientFormData[],
    importedPackaging: PackagingFormData[]
  ) => {
    // BOM import is handled by the hook's fetchProductData after import
    await fetchProductData();
    onSaveComplete?.();
    if (importedIngredients.length > 0 && importedPackaging.length === 0) {
      setActiveTab('ingredients');
    } else if (importedPackaging.length > 0 && importedIngredients.length === 0) {
      setActiveTab('packaging');
    }
  };

  if (loading) {
    return <PageLoader message="Loading recipe editor..." />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!compact && (
        <div className="flex justify-between items-center">
          <Card className="flex-1">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recipe Completeness</CardTitle>
                  <CardDescription className="text-sm">Track your bill of materials progress</CardDescription>
                </div>
                <Badge variant={totalItems > 0 ? "default" : "secondary"} className="bg-green-600">
                  {totalItems} {totalItems === 1 ? 'Item' : 'Items'} Added
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <Badge variant={totalItems > 0 ? "default" : "secondary"} className="bg-green-600">
            {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
          </Badge>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBOMImport(true)}
              className="bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              <Upload className="h-3 w-3 mr-1" />
              Import BOM
            </Button>
          </div>
        </div>
      )}

      <SearchGuidePanel />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={compact ? "grid w-full grid-cols-3" : "grid w-full grid-cols-4"}>
          {!compact && (
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Info className="h-4 w-4 pointer-events-none" />
              <span>Overview</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Leaf className="h-4 w-4 pointer-events-none" />
            <span>Ingredients ({ingredientCount})</span>
          </TabsTrigger>
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Box className="h-4 w-4 pointer-events-none" />
            <span>Packaging ({packagingCount})</span>
          </TabsTrigger>
          <TabsTrigger value="maturation" className="flex items-center gap-2">
            <Wine className="h-4 w-4 pointer-events-none" />
            <span>Maturation</span>
            {hasMaturationProfile && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">1</Badge>}
          </TabsTrigger>
        </TabsList>

        {!compact && (
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recipe Summary</CardTitle>
                <CardDescription>Bill of materials overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Ingredients</h3>
                    <Badge variant="outline">{ingredientCount} items</Badge>
                  </div>
                  {ingredientCount > 0 ? (
                    <div className="space-y-2">
                      {ingredientForms.filter(f => f.name && f.amount).map((ingredient) => (
                        <div key={ingredient.tempId} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{ingredient.name}</p>
                            {ingredient.origin_country && (
                              <p className="text-xs text-muted-foreground">Origin: {ingredient.origin_country}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{ingredient.amount} {ingredient.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No ingredients added yet</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Packaging</h3>
                    <Badge variant="outline">{packagingCount} items</Badge>
                  </div>
                  {packagingCount > 0 ? (
                    <div className="space-y-2">
                      {packagingForms.filter(f => f.name && f.amount && f.packaging_category).map((packaging) => (
                        <div key={packaging.tempId} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{packaging.name}</p>
                            {packaging.packaging_category && (
                              <p className="text-xs text-muted-foreground capitalize">{packaging.packaging_category.replace('_', ' ')}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{packaging.amount} {packaging.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No packaging added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="ingredients" className="space-y-4">
          <Card className={compact ? "" : "border-l-4 border-l-green-500"}>
            <CardHeader className={compact ? "py-3 px-4" : undefined}>
              <div className="flex items-start gap-3">
                <div className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0`}>
                  <Leaf className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                </div>
                <div className="flex-1">
                  <CardTitle className={compact ? "text-base" : undefined}>Recipe & Ingredients</CardTitle>
                  <CardDescription>
                    Build your product recipe with environmental impact data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!compact && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                    <strong>How to Complete This Form</strong>
                    <br />
                    1. Use the smart search bar to find ingredients from your supplier network (primary data) or the global database (secondary data)
                    <br />
                    2. Enter the quantity used per product unit
                    <br />
                    3. Specify the distance from your ingredient source to your processing site for accurate transport calculations
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {ingredientForms.map((ingredient, index) => (
                  <IngredientFormCard
                    key={ingredient.tempId}
                    ingredient={ingredient}
                    index={index}
                    organizationId={organizationId}
                    productionFacilities={productionFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    onUpdate={updateIngredient}
                    onRemove={removeIngredient}
                    canRemove={ingredientForms.length > 1}
                  />
                ))}
              </div>

              <Button
                type="button"
                onClick={addIngredient}
                variant="outline"
                className="w-full border-dashed"
                size={compact ? "default" : "lg"}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Ingredient ({ingredientCount}/{ingredientForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={handleSaveIngredients}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Ingredients'}
                </Button>
                <Button type="button" variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <Card className={compact ? "" : "border-l-4 border-l-green-500"}>
            <CardHeader className={compact ? "py-3 px-4" : undefined}>
              <div className="flex items-start gap-3">
                <div className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0`}>
                  <Box className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                </div>
                <div className="flex-1">
                  <CardTitle className={compact ? "text-base" : undefined}>Packaging Materials</CardTitle>
                  <CardDescription>
                    Define your packaging materials with environmental impact data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!compact && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                    <strong>How to Complete This Form</strong>
                    <br />
                    1. Select the packaging category (Container, Label, Closure, or Secondary)
                    <br />
                    2. Use the smart search bar to find materials from your supplier network or the global database
                    <br />
                    3. Enter the quantity and specify transport distance for accurate calculations
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {packagingForms.map((packaging, index) => (
                  <PackagingFormCard
                    key={packaging.tempId}
                    packaging={packaging}
                    index={index}
                    organizationId={organizationId}
                    productionFacilities={productionFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    onUpdate={updatePackaging}
                    onRemove={removePackaging}
                    onAddNewWithType={addPackagingWithType}
                    canRemove={packagingForms.length > 1}
                  />
                ))}
              </div>

              <Button
                type="button"
                onClick={addPackaging}
                variant="outline"
                className="w-full border-dashed"
                size={compact ? "default" : "lg"}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Packaging ({packagingCount}/{packagingForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={handleSavePackaging}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Packaging'}
                </Button>
                <Button type="button" variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maturation" className="space-y-4">
          <MaturationProfileCard
            profile={maturationProfile}
            organizationId={organizationId}
            productId={productId}
            onSave={handleSaveMaturation}
            onRemove={handleRemoveMaturation}
            saving={saving}
          />
        </TabsContent>
      </Tabs>


      <BOMImportFlow
        open={showBOMImport}
        onOpenChange={setShowBOMImport}
        onImportComplete={handleBOMImportComplete}
        organizationId={organizationId}
      />
    </div>
  );
}
