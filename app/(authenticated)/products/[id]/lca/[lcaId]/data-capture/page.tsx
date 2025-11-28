"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Clock,
  Package,
  Boxes,
  Factory,
  Info,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { saveDraftData, markTabComplete, getAllTabsComplete } from "@/lib/lcaWorkflow";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";
import { AssistedIngredientSearch } from "@/components/lca/AssistedIngredientSearch";
import { IngredientsList } from "@/components/lca/IngredientsList";
import { IngredientsSummary } from "@/components/lca/IngredientsSummary";
import { AssistedPackagingSearch } from "@/components/lca/AssistedPackagingSearch";
import { PackagingList } from "@/components/lca/PackagingList";
import { PackagingSummary } from "@/components/lca/PackagingSummary";
import { addIngredientToLCA, getIngredientsForLCA, updateIngredient, removeIngredient, type IngredientMaterial } from "@/lib/ingredientOperations";
import { addPackagingToLCA, getPackagingForLCA, updatePackaging, removePackaging, type PackagingMaterial } from "@/lib/packagingOperations";
import { logIngredientSelection } from "@/lib/ingredientAudit";
import type { LcaSubStage, PackagingCategory } from "@/lib/types/lca";
import { ProductionFacilitiesTable, type ProductionSite } from "@/components/lca/ProductionFacilitiesTable";
import { LinkFacilityModal } from "@/components/lca/LinkFacilityModal";
import { getProductionSites, addProductionSite, removeProductionSite, markProductionComplete } from "@/lib/productionSiteOperations";

interface LcaData {
  id: string;
  product_name: string;
  functional_unit: string;
  lca_scope_type: string;
  organization_id: string;
  draft_data: {
    ingredients?: any[];
    packaging?: any[];
    production?: any;
  };
  ingredients_complete: boolean;
  packaging_complete: boolean;
  production_complete: boolean;
  updated_at: string;
}

export default function LcaDataCapturePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const lcaId = params.lcaId as string;

  const { currentOrganization } = useOrganization();
  const [lca, setLca] = useState<LcaData | null>(null);
  const [activeTab, setActiveTab] = useState("ingredients");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [ingredients, setIngredients] = useState<(IngredientMaterial & { supplier_name?: string | null })[]>([]);
  const [packaging, setPackaging] = useState<(PackagingMaterial & { supplier_name?: string | null })[]>([]);
  const [subStages, setSubStages] = useState<LcaSubStage[]>([]);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);
  const [isLoadingPackaging, setIsLoadingPackaging] = useState(false);
  const [productionSites, setProductionSites] = useState<ProductionSite[]>([]);
  const [isLoadingProduction, setIsLoadingProduction] = useState(false);
  const [isLinkFacilityModalOpen, setIsLinkFacilityModalOpen] = useState(false);
  const [productNetVolume, setProductNetVolume] = useState<number>(1);
  const [volumeUnit, setVolumeUnit] = useState<string>('litre');

  useEffect(() => {
    loadLcaData();
    loadSubStages();
  }, [lcaId]);

  useEffect(() => {
    if (lca && currentOrganization?.id) {
      loadIngredients();
      loadPackaging();
      loadProductionSites();
      loadProductDetails();
    }
  }, [lca, currentOrganization]);

  const loadLcaData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("product_lcas")
        .select("*")
        .eq("id", lcaId)
        .single();

      if (error) throw error;

      setLca(data);
      setLastSaved(new Date(data.updated_at));
    } catch (error: any) {
      console.error("Error loading LCA data:", error);
      toast.error(error.message || "Failed to load LCA data");
    } finally {
      setLoading(false);
    }
  };

  const loadSubStages = async () => {
    try {
      const { data, error } = await supabase
        .from('lca_sub_stages')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      setSubStages(data || []);
    } catch (error: any) {
      console.error("Error loading sub stages:", error);
    }
  };

  const loadIngredients = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoadingIngredients(true);
      const result = await getIngredientsForLCA(lcaId, currentOrganization.id);

      if (result.success) {
        setIngredients(result.ingredients);
      } else {
        toast.error(result.error || "Failed to load ingredients");
      }
    } catch (error: any) {
      console.error("Error loading ingredients:", error);
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const loadPackaging = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoadingPackaging(true);
      const result = await getPackagingForLCA(lcaId, currentOrganization.id);

      if (result.success) {
        setPackaging(result.packaging);
      } else {
        toast.error(result.error || "Failed to load packaging");
      }
    } catch (error: any) {
      console.error("Error loading packaging:", error);
    } finally {
      setIsLoadingPackaging(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      toast.info("Saving draft...");

      await loadLcaData();

      setLastSaved(new Date());
      toast.success("Draft saved successfully");
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast.error(error.message || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleIngredientConfirmed = async (ingredient: {
    name: string;
    data_source: 'openlca' | 'supplier' | 'primary';
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit?: string;
    carbon_intensity?: number;
    quantity?: number;
    lca_sub_stage_id?: string | null;
    origin_country?: string;
    is_organic_certified?: boolean;
    impact_climate?: number;
    impact_water?: number;
    impact_land?: number;
    impact_waste?: number;
  }) => {
    if (!currentOrganization?.id || !lca) {
      console.error('[handleIngredientConfirmed] Missing requirements:', {
        hasOrganization: !!currentOrganization?.id,
        hasLca: !!lca,
      });
      return;
    }

    console.log('[handleIngredientConfirmed] Adding ingredient:', ingredient);

    try {
      const defaultSubStageId = subStages[0]?.id || null;

      await logIngredientSelection({
        organizationId: currentOrganization.id,
        lcaId: lcaId,
        ingredientName: ingredient.name,
        dataSource: ingredient.data_source,
        sourceIdentifier: ingredient.data_source_id || ingredient.supplier_product_id,
        sourceName: ingredient.data_source === 'supplier' ? ingredient.supplier_name : 'Generic Database',
      });

      const ingredientData = {
        name: ingredient.name,
        quantity: ingredient.quantity ?? 1,
        unit: ingredient.unit || 'kg',
        lca_sub_stage_id: ingredient.lca_sub_stage_id ?? defaultSubStageId,
        data_source: ingredient.data_source,
        data_source_id: ingredient.data_source_id,
        supplier_product_id: ingredient.supplier_product_id,
        supplier_name: ingredient.supplier_name,
        origin_country: ingredient.origin_country || '',
        is_organic_certified: ingredient.is_organic_certified ?? false,
        impact_climate: ingredient.impact_climate,
        impact_water: ingredient.impact_water,
        impact_land: ingredient.impact_land,
        impact_waste: ingredient.impact_waste,
      };

      console.log('[handleIngredientConfirmed] Calling addIngredientToLCA with:', ingredientData);

      const result = await addIngredientToLCA({
        lcaId: lcaId,
        organizationId: currentOrganization.id,
        ingredient: ingredientData,
      });

      console.log('[handleIngredientConfirmed] Result:', result);

      if (result.success) {
        toast.success(`Added ${ingredient.name}`);
        console.log('[handleIngredientConfirmed] Reloading ingredients...');
        await loadIngredients();
        console.log('[handleIngredientConfirmed] Ingredients reloaded successfully');
      } else {
        console.error('[handleIngredientConfirmed] Failed:', result.error);
        toast.error(result.error || 'Failed to add ingredient');
      }
    } catch (error: any) {
      console.error('Error adding ingredient:', error);
      toast.error(error.message || 'Failed to add ingredient');
    }
  };

  const handleEditIngredient = async (ingredient: IngredientMaterial & { supplier_name?: string | null }) => {
    toast.info('Edit functionality coming soon');
  };

  const handleRemoveIngredient = async (ingredientId: string) => {
    if (!currentOrganization?.id) return;

    try {
      const result = await removeIngredient(ingredientId, lcaId, currentOrganization.id);

      if (result.success) {
        toast.success('Ingredient removed');
        await loadIngredients();
      } else {
        toast.error(result.error || 'Failed to remove ingredient');
      }
    } catch (error: any) {
      console.error('Error removing ingredient:', error);
      toast.error(error.message || 'Failed to remove ingredient');
    }
  };

  const handlePackagingConfirmed = async (packaging: {
    name: string;
    data_source: 'openlca' | 'supplier' | 'primary';
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit?: string;
    carbon_intensity?: number;
    quantity?: number;
    lca_sub_stage_id?: string | null;
    origin_country?: string;
    is_organic_certified?: boolean;
    packaging_category: PackagingCategory;
    label_printing_type?: string;
    impact_climate?: number;
    impact_water?: number;
    impact_land?: number;
    impact_waste?: number;
  }) => {
    if (!currentOrganization?.id || !lca) {
      console.error('[handlePackagingConfirmed] Missing requirements');
      return;
    }

    try {
      const defaultSubStageId = subStages[0]?.id || null;

      const packagingData = {
        name: packaging.name,
        quantity: packaging.quantity ?? 1,
        unit: packaging.unit || 'kg',
        lca_sub_stage_id: packaging.lca_sub_stage_id ?? defaultSubStageId,
        data_source: packaging.data_source,
        data_source_id: packaging.data_source_id,
        supplier_product_id: packaging.supplier_product_id,
        supplier_name: packaging.supplier_name,
        origin_country: packaging.origin_country || '',
        is_organic_certified: packaging.is_organic_certified ?? false,
        packaging_category: packaging.packaging_category,
        label_printing_type: packaging.label_printing_type,
        impact_climate: packaging.impact_climate,
        impact_water: packaging.impact_water,
        impact_land: packaging.impact_land,
        impact_waste: packaging.impact_waste,
      };

      const result = await addPackagingToLCA({
        lcaId: lcaId,
        organizationId: currentOrganization.id,
        packaging: packagingData,
      });

      if (result.success) {
        toast.success(`Added ${packaging.name}`);
        await loadPackaging();
      } else {
        toast.error(result.error || 'Failed to add packaging');
      }
    } catch (error: any) {
      console.error('Error adding packaging:', error);
      toast.error(error.message || 'Failed to add packaging');
    }
  };

  const handleEditPackaging = async (packaging: PackagingMaterial & { supplier_name?: string | null }) => {
    toast.info('Edit functionality coming soon');
  };

  const handleRemovePackaging = async (packagingId: string) => {
    if (!currentOrganization?.id) return;

    try {
      const result = await removePackaging(packagingId, lcaId, currentOrganization.id);

      if (result.success) {
        toast.success('Packaging removed');
        await loadPackaging();
      } else {
        toast.error(result.error || 'Failed to remove packaging');
      }
    } catch (error: any) {
      console.error('Error removing packaging:', error);
      toast.error(error.message || 'Failed to remove packaging');
    }
  };

  const loadProductDetails = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("net_volume, net_volume_unit")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      if (productData) {
        setProductNetVolume(Number(productData.net_volume) || 1);
        setVolumeUnit(productData.net_volume_unit || 'litre');
      }
    } catch (error: any) {
      console.error('Error loading product details:', error);
    }
  };

  const loadProductionSites = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoadingProduction(true);

      const result = await getProductionSites(lcaId, currentOrganization.id);

      if (result.success) {
        setProductionSites(result.sites);
      } else {
        console.error('Error loading production sites:', result.error);
      }
    } catch (error: any) {
      console.error('Error loading production sites:', error);
    } finally {
      setIsLoadingProduction(false);
    }
  };

  const handleAddFacility = () => {
    setIsLinkFacilityModalOpen(true);
  };

  const handleLinkFacility = async (facilityId: string, productionVolume: number) => {
    if (!currentOrganization?.id) return;

    try {
      const result = await addProductionSite({
        lcaId,
        facilityId,
        organizationId: currentOrganization.id,
        productionVolume,
      });

      if (result.success) {
        toast.success('Production facility linked');
        await loadProductionSites();

        if (productionSites.length === 0) {
          await markProductionComplete(lcaId, currentOrganization.id, true);
          await loadLcaData();
        }
      } else {
        toast.error(result.error || 'Failed to link facility');
      }
    } catch (error: any) {
      console.error('Error linking facility:', error);
      toast.error(error.message || 'Failed to link facility');
    }
  };

  const handleRemoveFacility = async (siteId: string) => {
    if (!currentOrganization?.id) return;

    try {
      const result = await removeProductionSite(siteId, currentOrganization.id);

      if (result.success) {
        toast.success('Production facility removed');
        await loadProductionSites();

        const updatedSites = productionSites.filter(s => s.id !== siteId);
        if (updatedSites.length === 0) {
          await markProductionComplete(lcaId, currentOrganization.id, false);
          await loadLcaData();
        }
      } else {
        toast.error(result.error || 'Failed to remove facility');
      }
    } catch (error: any) {
      console.error('Error removing facility:', error);
      toast.error(error.message || 'Failed to remove facility');
    }
  };

  const handleProceedToReview = async () => {
    const completion = await getAllTabsComplete(lcaId);

    if (!completion.allComplete) {
      const incomplete = [];
      if (!completion.details.ingredients) incomplete.push("Ingredients");
      if (!completion.details.packaging) incomplete.push("Packaging");
      if (!completion.details.production) incomplete.push("Production");

      toast.error(`Please complete all sections: ${incomplete.join(", ")}`);
      return;
    }

    router.push(`/products/${productId}/lca/${lcaId}/review`);
  };

  const getTabStatus = (tabName: 'ingredients' | 'packaging' | 'production') => {
    if (!lca) return 'pending';

    const fieldMap = {
      ingredients: lca.ingredients_complete,
      packaging: lca.packaging_complete,
      production: lca.production_complete,
    };

    return fieldMap[tabName] ? 'complete' : 'pending';
  };

  const getTabBadge = (status: string) => {
    if (status === 'complete') {
      return (
        <Badge className="bg-green-600 ml-2">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="ml-2">
        <Clock className="h-3 w-3 mr-1" />
        Draft
      </Badge>
    );
  };

  const formatLastSaved = () => {
    if (!lastSaved) return "Not saved yet";

    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return "Saved just now";
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} mins ago`;
    return `Saved ${Math.floor(diff / 3600)} hours ago`;
  };

  if (loading) {
    return <PageLoader message="Loading LCA data capture..." />;
  }

  if (!lca) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>LCA not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Capture</h1>
          <p className="text-muted-foreground mt-1">{lca.product_name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Goal & Scope (Confirmed)</CardTitle>
              <CardDescription>
                <strong>Functional Unit:</strong> {lca.functional_unit}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              {lca.lca_scope_type === 'cradle-to-grave' ? 'Cradle-to-Grave' : 'Cradle-to-Gate'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Complete all three sections below. Your data is automatically saved as you work.
          All sections must be completed before proceeding to calculation.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Ingredients</span>
            {getTabBadge(getTabStatus('ingredients'))}
          </TabsTrigger>
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            <span>Packaging</span>
            {getTabBadge(getTabStatus('packaging'))}
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            <span>Production</span>
            {getTabBadge(getTabStatus('production'))}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ingredients & Raw Materials</CardTitle>
                  <CardDescription>
                    Add all liquid and dry ingredients used in this product
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentOrganization && (
                    <AssistedIngredientSearch
                      lcaId={lcaId}
                      organizationId={currentOrganization.id}
                      subStages={subStages}
                      onIngredientConfirmed={handleIngredientConfirmed}
                      disabled={isLoadingIngredients}
                    />
                  )}

                  <Separator />

                  {isLoadingIngredients ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Loading ingredients...</p>
                    </div>
                  ) : (
                    <IngredientsList
                      ingredients={ingredients}
                      onEdit={handleEditIngredient}
                      onRemove={handleRemoveIngredient}
                      disabled={isLoadingIngredients}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              {currentOrganization && (
                <IngredientsSummary
                  ingredients={ingredients}
                  lcaId={lcaId}
                  organizationId={currentOrganization.id}
                  organizationName={currentOrganization.name}
                  onMarkComplete={() => loadLcaData()}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Packaging Materials</CardTitle>
                  <CardDescription>
                    Add containers, labels, closures, and secondary packaging
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentOrganization && (
                    <AssistedPackagingSearch
                      lcaId={lcaId}
                      organizationId={currentOrganization.id}
                      subStages={subStages}
                      onPackagingConfirmed={handlePackagingConfirmed}
                      disabled={isLoadingPackaging}
                    />
                  )}

                  <Separator />

                  {isLoadingPackaging ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Loading packaging...</p>
                    </div>
                  ) : (
                    <PackagingList
                      packaging={packaging}
                      onEdit={handleEditPackaging}
                      onRemove={handleRemovePackaging}
                      disabled={isLoadingPackaging}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              {currentOrganization && (
                <PackagingSummary
                  packaging={packaging}
                  lcaId={lcaId}
                  organizationId={currentOrganization.id}
                  organizationName={currentOrganization.name}
                  onMarkComplete={() => loadLcaData()}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          {isLoadingProduction ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading production sites...</p>
            </div>
          ) : (
            <ProductionFacilitiesTable
              productionSites={productionSites}
              onAddFacility={handleAddFacility}
              onRemoveFacility={handleRemoveFacility}
              productNetVolume={productNetVolume}
              volumeUnit={volumeUnit}
              loading={isLoadingProduction}
            />
          )}

          {currentOrganization && (
            <LinkFacilityModal
              open={isLinkFacilityModalOpen}
              onClose={() => setIsLinkFacilityModalOpen(false)}
              onSubmit={handleLinkFacility}
              organizationId={currentOrganization.id}
              excludeFacilityIds={productionSites.map(site => site.facility_id)}
            />
          )}
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 bg-background border-t pt-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {formatLastSaved()}
            </div>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </div>

          <Button
            onClick={handleProceedToReview}
            size="lg"
            disabled={!lca.ingredients_complete || !lca.packaging_complete || !lca.production_complete}
          >
            Proceed to Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
