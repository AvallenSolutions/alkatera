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
  Copy,
  BookmarkPlus,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { IngredientFormCard } from "@/components/products/IngredientFormCard";
import { PackagingFormCard } from "@/components/products/PackagingFormCard";
import { BOMImportFlow } from "@/components/products/BOMImportFlow";
import { MaturationProfileCard } from "@/components/products/MaturationProfileCard";
import { SearchGuidePanel } from "@/components/products/SearchGuidePanel";
import { RecipeChecklist } from "@/components/products/RecipeChecklist";
import { PackagingTemplateDialog } from "@/components/products/PackagingTemplateDialog";
import { IngredientTemplateDialog } from "@/components/products/IngredientTemplateDialog";
import { RecipeScaleToggle } from "@/components/products/RecipeScaleToggle";
import { ProductionChainEditor } from "@/components/products/ProductionChainEditor";
import { RecipeModePicker } from "@/components/products/RecipeModePicker";
import { RecipeToolbar } from "@/components/products/RecipeToolbar";
import { IngredientRow } from "@/components/products/IngredientRow";
import { PackagingRow } from "@/components/products/PackagingRow";
import { useRecipeEditor } from "@/hooks/useRecipeEditor";
import { useIngestStash } from "@/hooks/useIngestStash";
import { useLinkedSupplierProducts } from "@/hooks/data/useLinkedSupplierProducts";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { MaturationFormData } from "@/components/products/MaturationProfileCard";

interface RecipeEditorPanelProps {
  productId: string;
  organizationId: string;
  productCategory?: string | null;
  productAbvPercent?: number | null;
  productBottleSizeMl?: number | null;
  primaryFacilityCountryCode?: string | null;
  onSaveComplete?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  compact?: boolean;
  initialTab?: string;
}

export function RecipeEditorPanel({
  productId,
  organizationId,
  productCategory,
  productAbvPercent,
  productBottleSizeMl,
  primaryFacilityCountryCode,
  onSaveComplete,
  onDirtyChange,
  compact = false,
  initialTab = "ingredients",
}: RecipeEditorPanelProps) {
  const { currentOrganization } = useOrganization();
  const { products: linkedSupplierProducts } = useLinkedSupplierProducts(organizationId);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showBOMImport, setShowBOMImport] = useState(false);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [showPackagingChecklist, setShowPackagingChecklist] = useState<boolean>(false);
  const [initialBomFile, setInitialBomFile] = useState<File | null>(null);

  // Pick up BOM files stashed by the Universal Dropzone (header upload button).
  useIngestStash('bom', (file) => {
    setInitialBomFile(file);
    setShowBOMImport(true);
  });
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<"save" | "browse">("browse");
  const [showIngredientTemplateDialog, setShowIngredientTemplateDialog] = useState(false);
  const [ingredientTemplateDialogMode, setIngredientTemplateDialogMode] = useState<"save" | "browse">("browse");

  const {
    product,
    productionFacilities,
    loading,
    saving,
    autoSaving,
    lastSavedAt,
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
    addIngredientWithDefaults,
    addPackagingWithDefaults,
    saveIngredients,
    savePackaging,
    setPackagingFromTemplate,
    setIngredientsFromTemplate,
    saveMaturation,
    removeMaturation,
    saveRecipeScale,
    productionStages,
    addProductionStage,
    updateProductionStage,
    removeProductionStage,
    applyProductionTemplate,
    clearProductionChain,
  } = useRecipeEditor(productId, organizationId);

  const recipeScaleMode = (product?.recipe_scale_mode ?? 'per_unit') as 'per_unit' | 'per_batch';
  const batchYieldValue = product?.batch_yield_value ?? null;
  const batchYieldUnit = product?.batch_yield_unit ?? null;
  const hasProductionChain = productionStages.length > 0;

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
    // BOMImportFlow hands us form-shaped arrays but never writes to DB — push
    // them into the hook's form state so the rows show up immediately in the
    // recipe cards. User then clicks Save on each section to persist.
    //
    // We prepend any *existing* valid form rows so running BOM import on a
    // product that already has ingredients merges rather than wipes.
    if (importedIngredients.length > 0) {
      const currentValid = ingredientForms.filter(
        (f) => f.name && Number(f.amount) > 0,
      );
      setIngredientsFromTemplate([...currentValid, ...importedIngredients]);
    }
    if (importedPackaging.length > 0) {
      const currentValid = packagingForms.filter(
        (f) => f.name && (Number(f.amount) > 0 || Number(f.net_weight_g) > 0) && f.packaging_category,
      );
      setPackagingFromTemplate([...currentValid, ...importedPackaging]);
    }

    if (importedIngredients.length > 0 && importedPackaging.length === 0) {
      setActiveTab('ingredients');
    } else if (importedPackaging.length > 0 && importedIngredients.length === 0) {
      setActiveTab('packaging');
    } else if (importedIngredients.length > 0) {
      // Mixed — default to ingredients tab (they're the more common editing target first)
      setActiveTab('ingredients');
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
              <RecipeModePicker
                recipeScaleMode={recipeScaleMode}
                batchYieldValue={batchYieldValue}
                batchYieldUnit={batchYieldUnit}
                productionStages={productionStages}
                ingredientForms={ingredientForms}
                productUnitSizeValue={product?.unit_size_value ?? null}
                productUnitSizeUnit={product?.unit_size_unit ?? null}
                onSaveScale={saveRecipeScale}
                onAddStage={addProductionStage}
                onUpdateStage={updateProductionStage}
                onRemoveStage={removeProductionStage}
                onApplyTemplate={applyProductionTemplate}
                onClearChain={clearProductionChain}
              />

              <RecipeToolbar
                itemCount={ingredientCount}
                onAdd={addIngredient}
                onApplyTemplate={() => {
                  setIngredientTemplateDialogMode("browse");
                  setShowIngredientTemplateDialog(true);
                }}
                onSaveAsTemplate={() => {
                  setIngredientTemplateDialogMode("save");
                  setShowIngredientTemplateDialog(true);
                }}
                onImportBom={() => setShowBOMImport(true)}
                onToggleChecklist={() => setShowChecklist(s => !s)}
                showChecklist={showChecklist}
                primaryAddLabel="Add ingredient"
                importBomLabel="Import BOM"
              />

              {showChecklist && (
                <RecipeChecklist
                  productCategory={productCategory}
                  type="ingredient"
                  existingItems={ingredientForms}
                  onQuickAdd={(name, searchQuery) => {
                    addIngredientWithDefaults(name, searchQuery);
                  }}
                />
              )}

              <div className="space-y-2">
                {ingredientForms.map((ingredient, index) => (
                  <IngredientRow
                    key={ingredient.tempId}
                    ingredient={ingredient}
                    index={index}
                    organizationId={organizationId}
                    productionFacilities={productionFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    linkedSupplierProducts={linkedSupplierProducts}
                    onUpdate={updateIngredient}
                    onRemove={removeIngredient}
                    canRemove={ingredientForms.length > 1}
                    recipeScaleMode={recipeScaleMode}
                    batchYieldValue={batchYieldValue}
                    batchYieldUnit={batchYieldUnit}
                    productUnitSizeValue={product?.unit_size_value ?? null}
                    productUnitSizeUnit={product?.unit_size_unit ?? null}
                    productionStages={productionStages}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
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
                {autoSaving && (
                  <span className="text-xs text-muted-foreground animate-pulse">Autosaving...</span>
                )}
                {!autoSaving && lastSavedAt && (
                  <span className="text-xs text-muted-foreground">All changes saved</span>
                )}
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
              <RecipeToolbar
                itemCount={packagingCount}
                onAdd={addPackaging}
                onApplyTemplate={() => {
                  setTemplateDialogMode("browse");
                  setShowTemplateDialog(true);
                }}
                onSaveAsTemplate={() => {
                  setTemplateDialogMode("save");
                  setShowTemplateDialog(true);
                }}
                onImportBom={() => setShowBOMImport(true)}
                onToggleChecklist={() => setShowPackagingChecklist(s => !s)}
                showChecklist={showPackagingChecklist}
                primaryAddLabel="Add packaging"
                importBomLabel="Import BOM"
              />

              {showPackagingChecklist && (
                <RecipeChecklist
                  productCategory={productCategory}
                  type="packaging"
                  existingItems={packagingForms}
                  onQuickAdd={(name, searchQuery, packagingCategory) => {
                    addPackagingWithDefaults(name, searchQuery, packagingCategory);
                  }}
                />
              )}

              <div className="space-y-2">
                {packagingForms.map((packaging, index) => (
                  <PackagingRow
                    key={packaging.tempId}
                    packaging={packaging}
                    index={index}
                    organizationId={organizationId}
                    productionFacilities={productionFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    linkedSupplierProducts={linkedSupplierProducts}
                    onUpdate={updatePackaging}
                    onRemove={removePackaging}
                    onAddNewWithType={addPackagingWithType}
                    canRemove={packagingForms.length > 1}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
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
                {autoSaving && (
                  <span className="text-xs text-muted-foreground animate-pulse">Autosaving...</span>
                )}
                {!autoSaving && lastSavedAt && (
                  <span className="text-xs text-muted-foreground">All changes saved</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maturation" className="space-y-4">
          <MaturationProfileCard
            profile={maturationProfile}
            organizationId={organizationId}
            productId={productId}
            productCategory={productCategory}
            productAbvPercent={productAbvPercent}
            productBottleSizeMl={productBottleSizeMl}
            primaryFacilityCountryCode={primaryFacilityCountryCode}
            onSave={handleSaveMaturation}
            onRemove={handleRemoveMaturation}
            saving={saving}
          />
        </TabsContent>
      </Tabs>


      <BOMImportFlow
        open={showBOMImport}
        onOpenChange={(next) => {
          setShowBOMImport(next);
          if (!next) setInitialBomFile(null);
        }}
        onImportComplete={handleBOMImportComplete}
        organizationId={organizationId}
        initialFile={initialBomFile}
      />

      <PackagingTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        organizationId={organizationId}
        mode={templateDialogMode}
        currentPackaging={packagingForms}
        onApplyTemplate={(items) => {
          setPackagingFromTemplate(items);
          setShowTemplateDialog(false);
        }}
      />

      <IngredientTemplateDialog
        open={showIngredientTemplateDialog}
        onOpenChange={setShowIngredientTemplateDialog}
        organizationId={organizationId}
        mode={ingredientTemplateDialogMode}
        currentIngredients={ingredientForms}
        currentProductVolumeValue={product?.unit_size_value ?? null}
        currentProductVolumeUnit={product?.unit_size_unit ?? null}
        currentMaturation={maturationProfile}
        productId={productId}
        productCategory={productCategory ?? null}
        onApplyTemplate={(items) => {
          setIngredientsFromTemplate(items);
          setShowIngredientTemplateDialog(false);
        }}
        onMaturationApplied={() => {
          fetchProductData();
        }}
      />
    </div>
  );
}
