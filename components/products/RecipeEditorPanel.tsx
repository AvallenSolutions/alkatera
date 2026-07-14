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
  Wand2,
  ShieldQuestion,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { IngredientFormCard } from "@/components/products/IngredientFormCard";
import { PackagingFormCard } from "@/components/products/PackagingFormCard";
import { BOMImportFlow } from "@/components/products/BOMImportFlow";
import { stashedLineItemsToExtracted } from "@/lib/bom/parser";
import type { ExtractedBOMItem } from "@/lib/bom/types";
import { MaturationProfileCard } from "@/components/products/MaturationProfileCard";
import { SearchGuidePanel } from "@/components/products/SearchGuidePanel";
import { RecipeChecklist } from "@/components/products/RecipeChecklist";
import { PackagingTemplateDialog } from "@/components/products/PackagingTemplateDialog";
import { PackagingWizard } from "@/components/products/packaging-wizard/PackagingWizard";
import { IngredientTemplateDialog } from "@/components/products/IngredientTemplateDialog";
import { RecipeScaleToggle } from "@/components/products/RecipeScaleToggle";
import { ProductionChainEditor } from "@/components/products/ProductionChainEditor";
import { RecipeModePicker } from "@/components/products/RecipeModePicker";
import { RecipeToolbar } from "@/components/products/RecipeToolbar";
import { IngredientRow } from "@/components/products/IngredientRow";
import { PackagingRow } from "@/components/products/PackagingRow";
import { RecipeSidebarTour, type TourStep } from "@/components/products/RecipeSidebarTour";
import { RecipeStalenessBanner } from "@/components/products/RecipeStalenessBanner";
import { RecipeStarterDialog } from "@/components/products/RecipeStarterDialog";
import { IngredientComposer } from "@/components/products/IngredientComposer";
import { ReviewMatchesDialog, type ReviewMatchItem } from "@/components/products/ReviewMatchesDialog";
import { computeIngredientImpactPreview, computePackagingImpactPreview } from "@/lib/products/impact-preview";
import { findDuplicateIngredientNames, checkRecipeTotalMass } from "@/lib/products/recipe-checks";
import { autoMatchEmissionFactor } from "@/lib/products/ef-auto-match";
import { scaleStarterAmount, type RecipeStarter } from "@/lib/constants/recipe-starters";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useRecipeEditor } from "@/hooks/useRecipeEditor";
import { useIngestStash } from "@/hooks/useIngestStash";
import { useLinkedSupplierProducts } from "@/hooks/data/useLinkedSupplierProducts";
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import { useMemo } from "react";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { MaturationFormData } from "@/components/products/MaturationProfileCard";
import { unitSizeToMl } from "@/lib/constants/material-units";

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
  const [showPackagingWizard, setShowPackagingWizard] = useState(false);
  const [showRecipeStarter, setShowRecipeStarter] = useState(false);
  const [showReviewMatches, setShowReviewMatches] = useState(false);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [showPackagingChecklist, setShowPackagingChecklist] = useState<boolean>(false);

  // First-run tour: drives which tab the first ingredient row shows + anchors a
  // sequence of popovers to Basics → Source → Logistics → Save.
  const { state: onboardingState, isLoading: onboardingLoading } = useOnboarding();
  const tourEligible =
    !onboardingLoading && !onboardingState.recipeSidebarTourCompleted && activeTab === "ingredients";
  const [tourStep, setTourStep] = useState<TourStep>("basics");
  const [initialBomFile, setInitialBomFile] = useState<File | null>(null);
  const [initialBomItems, setInitialBomItems] = useState<ExtractedBOMItem[] | null>(null);

  // Pick up BOM files stashed by the Universal Dropzone (header upload button).
  // Prefer the classifier's pre-extracted line items (correct for xlsx and
  // per-litre dosages); fall back to re-parsing the raw file when absent.
  useIngestStash('bom', (file, meta) => {
    const lineItems = meta?.bom?.line_items;
    setInitialBomItems(
      lineItems && lineItems.length > 0 ? stashedLineItemsToExtracted(lineItems) : null,
    );
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
    addIngredientRows,
    addPackagingWithDefaults,
    addPackagingRows,
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


  /**
   * Apply a typical-recipe starter: add the scaled ingredient rows instantly,
   * then auto-match each one's emission factor in the background. Rows arrive
   * "Matched, please check" (or needs_review when no confident match exists).
   */
  const applyRecipeStarter = (starter: RecipeStarter) => {
    const unitMl = unitSizeToMl(product?.unit_size_value, product?.unit_size_unit);
    const rows: IngredientFormData[] = starter.ingredients.map((ing, i) => ({
      tempId: `temp-starter-${Date.now()}-${i}`,
      name: ing.name,
      data_source: null,
      amount: String(scaleStarterAmount(ing.amountPerLitre, unitMl)),
      unit: ing.unit,
      origin_country: '',
      is_organic_certified: false,
      transport_mode: 'truck',
      distance_km: '',
    }));
    addIngredientRows(rows);
    toast.success(`${rows.length} typical ingredients added. Matching emission factors...`);

    void Promise.all(rows.map(async (row, i) => {
      const match = await autoMatchEmissionFactor({
        query: starter.ingredients[i].searchQuery,
        organizationId,
        materialType: 'ingredient',
      });
      if (!match) {
        updateIngredient(row.tempId, { match_status: 'needs_review' });
        return;
      }
      updateIngredient(row.tempId, {
        matched_source_name: match.matched_source_name,
        data_source: match.data_source as any,
        data_source_id: match.data_source_id,
        supplier_product_id: match.supplier_product_id,
        carbon_intensity: match.carbon_intensity,
        openlca_database: match.openlca_database,
        ef_source: match.ef_source,
        ef_source_type: match.ef_source_type,
        ef_data_quality_grade: match.ef_data_quality_grade,
        ef_uncertainty_percent: match.ef_uncertainty_percent,
        match_status: 'auto_matched',
      });
    }));
  };



  /** Composer add: row arrives instantly; typed-only names auto-match in the background. */
  const handleComposerAdd = (row: IngredientFormData, needsAutoMatch: string | null) => {
    addIngredientRows([row]);
    if (!needsAutoMatch) return;
    void autoMatchEmissionFactor({
      query: needsAutoMatch,
      organizationId,
      materialType: 'ingredient',
    }).then((match) => {
      if (!match) {
        updateIngredient(row.tempId, { match_status: 'needs_review' });
        return;
      }
      updateIngredient(row.tempId, {
        matched_source_name: match.matched_source_name,
        data_source: match.data_source as any,
        data_source_id: match.data_source_id,
        supplier_product_id: match.supplier_product_id,
        carbon_intensity: match.carbon_intensity,
        openlca_database: match.openlca_database,
        ef_source: match.ef_source,
        ef_source_type: match.ef_source_type,
        ef_data_quality_grade: match.ef_data_quality_grade,
        ef_uncertainty_percent: match.ef_uncertainty_percent,
        match_status: 'auto_matched',
      });
    });
  };

  // Recipe-level sanity checks (advisory)
  const duplicateIngredients = findDuplicateIngredientNames(ingredientForms);
  const recipeMassWarning = checkRecipeTotalMass({
    rows: ingredientForms,
    unitSizeMl: unitSizeToMl(product?.unit_size_value, product?.unit_size_unit),
    bottlesPerBatch: 1, // per-row batch handling already divides in batch mode
  });

  // Items for the "Review your matches" stepper: every auto-matched row from
  // both tabs, with an indicative impact preview for context.
  const reviewItems: ReviewMatchItem[] = [
    ...ingredientForms
      .filter(f => f.match_status === 'auto_matched')
      .map((f): ReviewMatchItem => ({
        tempId: f.tempId,
        kind: 'ingredient',
        name: f.name || '(unnamed ingredient)',
        matchedSourceName: f.matched_source_name,
        efSource: f.ef_source,
        efDataQualityGrade: f.ef_data_quality_grade,
        impactPreview: computeIngredientImpactPreview({
          amount: f.amount,
          unit: f.unit,
          carbonIntensity: f.carbon_intensity,
          unitSizeMl: unitSizeToMl(product?.unit_size_value, product?.unit_size_unit),
          category: productCategory,
        }),
      })),
    ...packagingForms
      .filter(f => f.match_status === 'auto_matched')
      .map((f): ReviewMatchItem => ({
        tempId: f.tempId,
        kind: 'packaging',
        name: f.name || '(unnamed packaging)',
        matchedSourceName: f.matched_source_name,
        efSource: f.ef_source,
        efDataQualityGrade: f.ef_data_quality_grade,
        impactPreview: computePackagingImpactPreview({
          netWeightG: f.net_weight_g,
          carbonIntensity: f.carbon_intensity,
          unitsPerGroup: f.units_per_group,
          reuseTrips: f.reuse_trips,
          unitSizeMl: unitSizeToMl(product?.unit_size_value, product?.unit_size_unit),
          category: productCategory,
        }),
      })),
  ];

  const confirmReviewItem = (item: ReviewMatchItem) => {
    if (item.kind === 'ingredient') updateIngredient(item.tempId, { match_status: 'verified' });
    else updatePackaging(item.tempId, { match_status: 'verified' });
  };

  const rejectReviewItem = (item: ReviewMatchItem) => {
    // Clear the match entirely so the row reads "Pick an emission factor"
    const cleared = {
      matched_source_name: undefined,
      data_source: null as any,
      data_source_id: undefined,
      carbon_intensity: undefined,
      ef_source: undefined,
      ef_source_type: undefined,
      ef_data_quality_grade: undefined,
      ef_uncertainty_percent: undefined,
      match_status: 'needs_review' as const,
    };
    if (item.kind === 'ingredient') updateIngredient(item.tempId, cleared);
    else updatePackaging(item.tempId, cleared);
  };

  // Maturation only earns a tab when there's data or the drink style ages.
  // Hidden tabs cost nothing; permanent irrelevant ones cost attention.
  const showMaturationTab =
    hasMaturationProfile ||
    /whisk|whiskey|rum|brandy|cognac|armagnac|wine|port|sherry|madeira|mead|tequila|mezcal|barrel|cask|aged/i.test(productCategory || '');

  const recipeScaleMode = (product?.recipe_scale_mode ?? 'per_unit') as 'per_unit' | 'per_batch';
  const batchYieldValue = product?.batch_yield_value ?? null;
  const batchYieldUnit = product?.batch_yield_unit ?? null;
  const hasProductionChain = productionStages.length > 0;

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Tell Rosa what the user is looking at on the recipe editor. The ID is
  // stable per product so the slice updates as the user picks ingredients,
  // adds new ones, or matches factors. Rosa uses this to answer questions
  // like "which factor should I pick for maple syrup?" without the user
  // having to copy-paste the ingredient name.
  const rosaSlice = useMemo(() => {
    if (!product) return null;
    const ingredients = ingredientForms.map(i => ({
      name: i.name || '(unnamed)',
      amount: i.amount,
      unit: i.unit,
      origin_country: i.origin_country || null,
      is_organic: i.is_organic_certified,
      data_source: i.data_source,
      matched_factor: i.matched_source_name || null,
      factor_source: i.ef_source || null,
      factor_quality_grade: i.ef_data_quality_grade || null,
      has_emission_factor: !!i.matched_source_name,
    }));
    const unmatched = ingredients.filter(i => !i.has_emission_factor && i.name !== '(unnamed)');
    return {
      id: 'recipe-editor',
      label: `Recipe: ${product.name || 'product'}${productCategory ? ` (${productCategory})` : ''}`,
      priority: 9,
      data: {
        product: {
          id: product.id,
          name: product.name,
          category: productCategory ?? null,
          abv_percent: productAbvPercent ?? null,
          bottle_size_ml: productBottleSizeMl ?? null,
          functional_unit: product.functional_unit ?? null,
        },
        active_tab: activeTab,
        recipe_scale_mode: recipeScaleMode,
        batch_yield: recipeScaleMode === 'per_batch' ? { value: batchYieldValue, unit: batchYieldUnit } : null,
        ingredient_count: ingredientCount,
        packaging_count: packagingCount,
        ingredients,
        ingredients_missing_factors: unmatched.map(i => i.name),
        notes: unmatched.length > 0
          ? `${unmatched.length} ingredient(s) don't have an emission factor matched yet. The user may ask which factor to pick.`
          : 'All ingredients have an emission factor matched.',
      },
    };
  }, [product, ingredientForms, activeTab, recipeScaleMode, batchYieldValue, batchYieldUnit, ingredientCount, packagingCount]);

  useRosaPageContext(rosaSlice);

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

      <RecipeStalenessBanner productId={productId} organizationId={organizationId} />

      <Tabs
        value={
          activeTab === 'overview' || (activeTab === 'maturation' && !showMaturationTab)
            ? 'ingredients'
            : activeTab
        }
        onValueChange={setActiveTab}
      >
        <TabsList className={showMaturationTab ? "grid w-full grid-cols-3" : "grid w-full grid-cols-2"}>
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Leaf className="h-4 w-4 pointer-events-none" />
            <span>Ingredients ({ingredientCount})</span>
          </TabsTrigger>
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Box className="h-4 w-4 pointer-events-none" />
            <span>Packaging ({packagingCount})</span>
          </TabsTrigger>
          {showMaturationTab && (
            <TabsTrigger value="maturation" className="flex items-center gap-2">
              <Wine className="h-4 w-4 pointer-events-none" />
              <span>Maturation</span>
              {hasMaturationProfile && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">1</Badge>}
            </TabsTrigger>
          )}
        </TabsList>


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

              {ingredientForms.filter(f => f.match_status === 'auto_matched').length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 py-2">
                  <ShieldQuestion className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    {ingredientForms.filter(f => f.match_status === 'auto_matched').length} item{ingredientForms.filter(f => f.match_status === 'auto_matched').length > 1 ? 's were' : ' was'} matched
                    automatically and {ingredientForms.filter(f => f.match_status === 'auto_matched').length > 1 ? 'are' : 'is'} already used in calculations.
                    Please check each one and click &quot;Looks right&quot; to confirm.
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2 h-6 px-2 text-[11px] border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      onClick={() => setShowReviewMatches(true)}
                    >
                      Review all
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {duplicateIngredients.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 py-2">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    {duplicateIngredients.join(', ')} appear{duplicateIngredients.length === 1 ? 's' : ''} more than once.
                    If that&apos;s not deliberate, remove the duplicate so it isn&apos;t counted twice.
                  </AlertDescription>
                </Alert>
              )}

              {recipeMassWarning && recipeScaleMode === 'per_unit' && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 py-2">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    {recipeMassWarning}
                  </AlertDescription>
                </Alert>
              )}

              {/* Guided ingredient starter: editing a plausible recipe beats
                  authoring from a blank tab. Prominent when empty. */}
              {ingredientForms.every(f => !f.name && !f.amount) ? (
                <Card className="p-5 border-dashed bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                        Start from a typical recipe
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        We add the usual ingredients for your drink style with matching
                        emission factors. You just adjust the amounts.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => setShowRecipeStarter(true)}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Pick a style
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRecipeStarter(true)}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Add from a typical recipe
                </Button>
              )}

              <IngredientComposer
                organizationId={organizationId}
                onAdd={handleComposerAdd}
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
                {ingredientForms.map((ingredient, index) => {
                  const tourActiveOnRow =
                    tourEligible && index === 0 && tourStep !== "save" && tourStep !== "done";
                  const controlledTabForRow =
                    tourActiveOnRow && (tourStep === "basics" || tourStep === "source" || tourStep === "logistics")
                      ? tourStep
                      : undefined;
                  return (
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
                      canRemove={ingredientForms.length > 0}
                      recipeScaleMode={recipeScaleMode}
                      batchYieldValue={batchYieldValue}
                      batchYieldUnit={batchYieldUnit}
                      productUnitSizeValue={product?.unit_size_value ?? null}
                      productUnitSizeUnit={product?.unit_size_unit ?? null}
                      productCategory={productCategory ?? null}
                      productionStages={productionStages}
                      forceExpanded={tourEligible && index === 0}
                      enableTourAnchors={tourEligible && index === 0}
                      controlledTab={controlledTabForRow}
                    />
                  );
                })}
              </div>

              <RecipeSidebarTour
                active={tourEligible}
                step={tourStep}
                onStepChange={setTourStep}
              />

              <div className="flex items-center gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={handleSaveIngredients}
                  disabled={saving}
                  className="flex-1"
                  data-tour-anchor="save"
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

              {/* Guided setup: question-led packaging builder. Prominent when
                  the product has no packaging yet, available as a quiet button
                  otherwise. */}
              {packagingCount === 0 ? (
                <Card className="p-5 border-dashed bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                        Set up packaging step by step
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Answer a few questions like &quot;can or bottle?&quot; and &quot;what does it weigh?&quot;
                        and we will build the list with matching emission factors for you.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => setShowPackagingWizard(true)}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Guided setup
                      </Button>
                      <Button type="button" variant="outline" onClick={addPackaging}>
                        Add manually
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPackagingWizard(true)}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Add packaging with guided setup
                </Button>
              )}

              {packagingForms.filter(f => f.match_status === 'auto_matched').length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 py-2">
                  <ShieldQuestion className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    {packagingForms.filter(f => f.match_status === 'auto_matched').length} item{packagingForms.filter(f => f.match_status === 'auto_matched').length > 1 ? 's were' : ' was'} matched
                    automatically and {packagingForms.filter(f => f.match_status === 'auto_matched').length > 1 ? 'are' : 'is'} already used in calculations.
                    Please check each one and click &quot;Looks right&quot; to confirm.
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2 h-6 px-2 text-[11px] border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      onClick={() => setShowReviewMatches(true)}
                    >
                      Review all
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

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
                    canRemove={packagingForms.length > 0}
                    containerSizeMl={unitSizeToMl(product?.unit_size_value, product?.unit_size_unit)}
                    productCategory={productCategory ?? null}
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


      <ReviewMatchesDialog
        open={showReviewMatches}
        onOpenChange={setShowReviewMatches}
        items={reviewItems}
        onConfirm={confirmReviewItem}
        onPickDifferent={rejectReviewItem}
      />

      <RecipeStarterDialog
        open={showRecipeStarter}
        onOpenChange={setShowRecipeStarter}
        productCategory={productCategory}
        unitSizeMl={unitSizeToMl(product?.unit_size_value, product?.unit_size_unit)}
        onApply={applyRecipeStarter}
      />

      <PackagingWizard
        open={showPackagingWizard}
        onOpenChange={setShowPackagingWizard}
        organizationId={organizationId}
        containerSizeMl={unitSizeToMl(product?.unit_size_value, product?.unit_size_unit)}
        onComplete={(rows) => {
          addPackagingRows(rows);
          // Offer to keep this pack for the next product ("our 750 ml bottle")
          toast('Reuse this packaging on other products?', {
            description: 'Save it as a template and apply it with one click next time.',
            action: {
              label: 'Save as template',
              onClick: () => {
                setTemplateDialogMode('save');
                setShowTemplateDialog(true);
              },
            },
            duration: 10000,
          });
        }}
      />

      <BOMImportFlow
        open={showBOMImport}
        onOpenChange={(next) => {
          setShowBOMImport(next);
          if (!next) {
            setInitialBomFile(null);
            setInitialBomItems(null);
          }
        }}
        onImportComplete={handleBOMImportComplete}
        organizationId={organizationId}
        initialFile={initialBomFile}
        initialItems={initialBomItems}
        productUnitSizeMl={unitSizeToMl(product?.unit_size_value, product?.unit_size_unit)}
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
