"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileBarChart, Settings, FileText, Info, Calculator, Factory, Globe } from "lucide-react";
import { ProductHeader } from "@/components/products/ProductHeader";
import { OverviewTab } from "@/components/products/OverviewTab";
import { SpecificationTab } from "@/components/products/SpecificationTab";
import { ProductionSitesTab } from "@/components/products/ProductionSitesTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";
import PassportManagementPanel from "@/components/passport/PassportManagementPanel";
import { useProductData } from "@/hooks/data/useProductData";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

export default function ProductDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { product, ingredients, packaging, lcaReports, isHealthy, loading, error, refetch } = useProductData(productId);
  const { currentOrganization } = useOrganization();

  const [activeTab, setActiveTab] = useState("overview");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleCalculate = async () => {
    if (!isHealthy) {
      toast.error("Please add ingredients and packaging before calculating");
      return;
    }

    try {
      toast.info("Redirecting to impact calculator...");
      router.push(`/products/${productId}/calculate-lca`);
    } catch (error) {
      console.error("Calculate error:", error);
      toast.error("Failed to navigate to calculator");
    }
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
        .from("product_lcas")
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
    return <PageLoader message="Loading product dashboard..." />;
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
        <ProductHeader
          product={{
            name: product.name,
            sku: product.sku || "",
            image_url: product.product_image_url,
            product_category: product.product_category,
          }}
          isHealthy={isHealthy}
          onEdit={() => setShowEditDialog(true)}
        />

        {/* Main Content */}
        <div className="container mx-auto px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/products")}
            className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>

          <Button
            onClick={handleCalculate}
            disabled={!isHealthy}
            size="lg"
            className="backdrop-blur-xl bg-lime-500/90 hover:bg-lime-500 text-black font-semibold shadow-lg shadow-lime-500/20 border border-lime-400/50"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Calculate LCA
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
          <TabsList className="grid w-full grid-cols-5 max-w-4xl backdrop-blur-xl bg-white/5 border border-white/10 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Info className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="specification"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <FileBarChart className="mr-2 h-4 w-4" />
              Specification
            </TabsTrigger>
            <TabsTrigger
              value="production-sites"
              className="data-[state=active]:bg-lime-500/20 data-[state=active]:text-lime-400 data-[state=active]:shadow-lg text-slate-400 hover:text-white"
            >
              <Factory className="mr-2 h-4 w-4" />
              Production Sites
            </TabsTrigger>
            <TabsTrigger
              value="passport"
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

          <TabsContent value="overview" className="space-y-6">
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
            />
          </TabsContent>

          <TabsContent value="production-sites" className="space-y-6">
            {currentOrganization && (
              <ProductionSitesTab
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
