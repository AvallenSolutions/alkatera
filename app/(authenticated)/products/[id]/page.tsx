"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileBarChart, Settings, FileText, Info, Calculator, Factory, Globe } from "lucide-react";
import { ProductHeader } from "@/components/products/ProductHeader";
import { OverviewTab } from "@/components/products/OverviewTab";
import { SpecificationTab } from "@/components/products/SpecificationTab";
import { FacilitiesTab } from "@/components/products/FacilitiesTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";
import { RecipeEditorPanel } from "@/components/products/RecipeEditorPanel";

import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import PassportManagementPanel from "@/components/passport/PassportManagementPanel";
import { ProductGuide, ProductGuideTrigger } from "@/components/products/ProductGuide";
import { useProductData } from "@/hooks/data/useProductData";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

export default function ProductDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;

  const { product, ingredients, packaging, lcaReports, isHealthy, loading, error, refetch } = useProductData(productId);
  const { currentOrganization } = useOrganization();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "overview");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);
  const [recipeInitialTab, setRecipeInitialTab] = useState<string>("ingredients");
  const [recipeEditorDirty, setRecipeEditorDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // 5.1 URL State Sync: Open sheets from URL params on mount
  useEffect(() => {
    const editorParam = searchParams.get('editor');

    if (editorParam === 'ingredients' || editorParam === 'packaging') {
      setRecipeInitialTab(editorParam);
      setShowRecipeEditor(true);
    }
  }, []); // Only run on mount

  // Update URL when sheets open/close (shallow — no navigation)
  const updateUrlParams = useCallback((key: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const openRecipeEditor = useCallback((tab: string) => {
    setRecipeInitialTab(tab);
    setShowRecipeEditor(true);
    updateUrlParams('editor', tab);
  }, [updateUrlParams]);

  const closeRecipeEditor = useCallback((force = false) => {
    if (!force && recipeEditorDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    setShowRecipeEditor(false);
    setRecipeEditorDirty(false);
    updateUrlParams('editor', null);
  }, [updateUrlParams, recipeEditorDirty]);

  const handleCalculate = () => {
    if (!isHealthy) {
      toast.error("Please add ingredients and packaging before calculating");
      return;
    }
    router.push(`/products/${productId}/compliance-wizard`);
  };

  const handleArchive = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("products")
        .update({ is_draft: true })
        .eq("id", productId);

      if (error) throw error;

      toast.success("Product archived successfully");
      router.push("/products");
    } catch (error: any) {
      console.error("Archive error:", error);
      toast.error(error.message || "Failed to archive product");
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Delete materials first
      await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId);

      // Delete LCAs
      await supabase
        .from("product_carbon_footprints")
        .delete()
        .eq("product_id", productId);

      // Delete product
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast.success("Product deleted successfully");
      router.push("/products");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete product");
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
        <div className="relative z-10">
          {/* Skeleton header */}
          <div className="container mx-auto px-6 pt-8 pb-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-xl bg-white/5" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-64 bg-white/5" />
                <Skeleton className="h-4 w-40 bg-white/5" />
              </div>
            </div>
          </div>
          {/* Skeleton content */}
          <div className="container mx-auto px-6 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-36 bg-white/5" />
              <Skeleton className="h-10 w-56 bg-white/5" />
            </div>
            <Skeleton className="h-10 w-full max-w-4xl bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 bg-white/5 rounded-xl" />
              <Skeleton className="h-64 bg-white/5 rounded-xl" />
            </div>
            <Skeleton className="h-48 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-6 py-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Product not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Animated Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-lime-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div data-guide="product-header">
        <ProductHeader
          product={{
            name: product.name,
            sku: product.sku || "",
            image_url: product.product_image_url,
            product_category: product.product_category,
            is_multipack: product.is_multipack,
          }}
          isHealthy={isHealthy}
          onEdit={() => setShowEditDialog(true)}
        />
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/products")}
              className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
            <ProductGuideTrigger />
          </div>

          <Button
            data-guide="product-calculate-btn"
            onClick={handleCalculate}
            disabled={!isHealthy}
            size="lg"
            className="backdrop-blur-xl bg-lime-500/90 hover:bg-lime-500 text-black font-semibold shadow-lg shadow-lime-500/20 border border-lime-400/50"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Create LCA
          </Button>
        </div>

        {!isHealthy && (
          <Alert className="mb-6 backdrop-blur-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              Please add ingredients and packaging to your product before calculating its environmental impact.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList data-guide="product-tabs" className="grid w-full grid-cols-5 max-w-4xl backdrop-blur-xl bg-white/5 border border-white/10 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Info className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="specification"
              data-guide="product-specification"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <FileBarChart className="mr-2 h-4 w-4" />
              Specification
            </TabsTrigger>
            <TabsTrigger
              value="facilities"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Factory className="mr-2 h-4 w-4" />
              Facilities
            </TabsTrigger>
            <TabsTrigger
              value="passport"
              data-guide="product-passport-tab"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Globe className="mr-2 h-4 w-4" />
              Passport
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" data-guide="product-overview" className="space-y-6">
            <OverviewTab
              product={product}
              ingredients={ingredients}
              packaging={packaging}
              lcaReports={lcaReports}
              isHealthy={isHealthy}
            />
          </TabsContent>

          <TabsContent value="specification" className="space-y-6">
            <SpecificationTab
              productId={productId}
              ingredients={ingredients}
              packaging={packaging}
              onManageIngredients={() => openRecipeEditor("ingredients")}
              onManagePackaging={() => openRecipeEditor("packaging")}
            />
          </TabsContent>

          <TabsContent value="facilities" className="space-y-6">
            {currentOrganization && (
              <FacilitiesTab
                productId={parseInt(productId)}
                organizationId={currentOrganization.id}
              />
            )}
          </TabsContent>

          <TabsContent value="passport" className="space-y-6">
            <PassportManagementPanel
              productId={productId}
              productName={product.name}
              initialPassportEnabled={product.passport_enabled || false}
              initialPassportToken={product.passport_token || null}
              initialViewsCount={product.passport_views_count || 0}
              initialLastViewedAt={product.passport_last_viewed_at || null}
              initialPassportSettings={(product.passport_settings as Record<string, unknown>) || {}}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SettingsTab
              productName={product.name}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Product Guide */}
      <ProductGuide
        onAction={(action) => {
          if (action === 'open-ingredients') {
            openRecipeEditor('ingredients');
          }
        }}
      />

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product Details</DialogTitle>
          </DialogHeader>
          <EditProductForm
            productId={productId}
            onSuccess={() => {
              setShowEditDialog(false);
              refetch();
              toast.success("Product updated successfully");
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Recipe Editor Sheet */}
      <Sheet open={showRecipeEditor} onOpenChange={(open) => { if (!open) closeRecipeEditor(); else setShowRecipeEditor(true); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl overflow-y-auto"
          preventClose
        >
          <SheetHeader className="mb-4">
            <SheetTitle>Edit Recipe - {product.name}</SheetTitle>
            <SheetDescription>
              Add and manage ingredients and packaging for this product
            </SheetDescription>
          </SheetHeader>
          <RecipeEditorPanel
            productId={productId}
            organizationId={currentOrganization?.id || ''}
            onSaveComplete={() => {
              refetch();
            }}
            onDirtyChange={setRecipeEditorDirty}
            compact={true}
            initialTab={recipeInitialTab}
          />
        </SheetContent>
      </Sheet>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your recipe. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedWarning(false);
                closeRecipeEditor(true);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
