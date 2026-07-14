"use client";

import { useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileBarChart, Settings, FileText, Info, Calculator, Factory, Globe } from "lucide-react";
import { ProductHeader } from "@/components/products/ProductHeader";
import { BrewwSuggestionBanner } from "@/components/products/BrewwSuggestionBanner";
import { OverviewTab } from "@/components/products/OverviewTab";
import { LcaStalenessBanner } from "@/components/products/LcaStalenessBanner";
import { SpecificationTab } from "@/components/products/SpecificationTab";
import { MultipackContentsEditor } from "@/components/products/MultipackContentsEditor";
import { FacilitiesTab } from "@/components/products/FacilitiesTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";

import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import PassportManagementPanel from "@/components/passport/PassportManagementPanel";
import { ProductGuideTrigger } from "@/components/products/ProductGuide";
import { DownloadLCAButton } from "@/components/products/DownloadLCAButton";
import { useProductData } from "@/hooks/data/useProductData";

// Lazy-load ProductGuide — uses framer-motion (~60KB) and only shows
// for users who haven't dismissed the guide.
const ProductGuide = dynamic(
  () => import("@/components/products/ProductGuide").then(mod => ({ default: mod.ProductGuide })),
  { ssr: false }
);
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

  const handleCalculate = () => {
    if (!isHealthy) {
      toast.error(
        product?.is_multipack
          ? "Add the products this multipack contains before calculating its LCA"
          : "Please add ingredients and packaging before calculating"
      );
      return;
    }
    router.push(`/products/${productId}/compliance-wizard`);
  };

  const handleArchive = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Use archived_at, NOT is_draft: is_draft is overloaded (most products
      // are drafts) and nothing surfaced it, so archiving via is_draft did
      // nothing visible. archived_at drives the list filter and badge.
      const { error } = await supabase
        .from("products")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", productId);

      if (error) throw error;

      toast.success("Product archived");
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

      // Guard against a silent cascade: multipack_components.component_product_id
      // is ON DELETE CASCADE, so deleting a product would quietly remove it from
      // every multipack that contains it (and leave those multipacks with a
      // stale total). Block the delete and tell the user which multipacks to fix
      // first.
      const { data: memberships } = await supabase
        .from("multipack_components")
        .select("multipack:products!multipack_product_id(name)")
        .eq("component_product_id", productId);
      if (memberships && memberships.length > 0) {
        const names = memberships
          .map((m: any) => m.multipack?.name)
          .filter(Boolean);
        const list = names.length > 0 ? `: ${names.join(", ")}` : "";
        toast.error(
          `This product is part of ${memberships.length} multipack${memberships.length === 1 ? "" : "s"}${list}. Remove it from ${memberships.length === 1 ? "that multipack" : "those multipacks"} before deleting it.`,
        );
        throw new Error("Product is in use by a multipack");
      }

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
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="relative z-10">
          {/* Skeleton header */}
          <div className="container mx-auto px-6 pt-8 pb-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
          {/* Skeleton content */}
          <div className="container mx-auto px-6 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-56" />
            </div>
            <Skeleton className="h-10 w-full max-w-4xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <Skeleton className="h-48 rounded-xl" />
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div data-guide="product-header">
        <ProductHeader
          product={{
            id: productId,
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
              variant="outline"
              onClick={() => router.push("/products")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
            <ProductGuideTrigger />
          </div>

          <div className="flex items-center gap-2">
            {lcaReports.length > 0 && lcaReports[0]?.id && (
              <DownloadLCAButton
                lcaId={lcaReports[0].id}
                productName={product.name}
                productId={Number(productId)}
                size="lg"
              />
            )}
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
        </div>

        <div className="mb-6">
          <BrewwSuggestionBanner productId={productId} productName={product.name} />
        </div>

        {!isHealthy && (
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Please add ingredients and packaging to your product before calculating its environmental impact.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList data-guide="product-tabs" className="grid w-full grid-cols-5 max-w-4xl bg-muted border p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-700 dark:data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground"
            >
              <Info className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="specification"
              data-guide="product-specification"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-700 dark:data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground"
            >
              <FileBarChart className="mr-2 h-4 w-4" />
              Specification
            </TabsTrigger>
            <TabsTrigger
              value="facilities"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-700 dark:data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground"
            >
              <Factory className="mr-2 h-4 w-4" />
              Facilities
            </TabsTrigger>
            <TabsTrigger
              value="passport"
              data-guide="product-passport-tab"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-700 dark:data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground"
            >
              <Globe className="mr-2 h-4 w-4" />
              Passport
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-700 dark:data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" data-guide="product-overview" className="space-y-6">
            {currentOrganization && (
              <LcaStalenessBanner
                productId={productId}
                organizationId={currentOrganization.id}
                onRecalculated={() => window.location.reload()}
              />
            )}
            <OverviewTab
              product={product}
              ingredients={ingredients}
              packaging={packaging}
              lcaReports={lcaReports}
              isHealthy={isHealthy}
              onEditMultipack={() => setActiveTab('specification')}
            />
          </TabsContent>

          <TabsContent value="specification" className="space-y-6">
            {product.is_multipack && currentOrganization ? (
              // A multipack has no single-SKU recipe/packaging of its own to edit
              // here; its footprint comes from its component products. Show the
              // contents editor (add/remove products, change quantities) instead.
              <MultipackContentsEditor
                productId={productId}
                organizationId={currentOrganization.id}
              />
            ) : (
              <SpecificationTab
                productId={productId}
                ingredients={ingredients}
                packaging={packaging}
                productCategory={product?.product_category ?? null}
                productAbvPercent={product?.alcohol_content_abv ?? null}
              />
            )}
          </TabsContent>

          <TabsContent value="facilities" className="space-y-6">
            {currentOrganization && (
              <FacilitiesTab
                productId={parseInt(productId)}
                organizationId={currentOrganization.id}
                annualProductionVolume={product.annual_production_volume ?? null}
                annualProductionUnit={product.annual_production_unit ?? null}
                unitSizeUnit={product.unit_size_unit ?? null}
                onProductUpdated={refetch}
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
            router.push(`/products/${productId}/recipe?tab=ingredients`);
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

    </div>
  );
}
