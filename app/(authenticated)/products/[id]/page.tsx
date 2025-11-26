"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileBarChart, Settings, FileText, Info } from "lucide-react";
import { ProductHeader } from "@/components/products/ProductHeader";
import { OverviewTab } from "@/components/products/OverviewTab";
import { SpecificationTab } from "@/components/products/SpecificationTab";
import { ImpactReportsTab } from "@/components/products/ImpactReportsTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";
import { useProductData } from "@/hooks/data/useProductData";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";

export default function ProductDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { product, ingredients, packaging, lcaReports, isHealthy, loading, error, refetch } = useProductData(productId);

  const [activeTab, setActiveTab] = useState("overview");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleCalculate = async () => {
    if (!isHealthy) {
      toast.error("Please add ingredients and packaging before calculating");
      return;
    }

    try {
      toast.info("Initiating LCA calculation...");
      router.push(`/products/${productId}/lca/initiate`);
    } catch (error) {
      console.error("Calculate error:", error);
      toast.error("Failed to initiate calculation");
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
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
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-3xl">
            <TabsTrigger value="overview">
              <Info className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="specification">
              <FileBarChart className="mr-2 h-4 w-4" />
              Specification
            </TabsTrigger>
            <TabsTrigger value="impact">
              <FileText className="mr-2 h-4 w-4" />
              Impact & Reports
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewTab product={product} />
          </TabsContent>

          <TabsContent value="specification" className="space-y-6">
            <SpecificationTab
              productId={productId}
              ingredients={ingredients}
              packaging={packaging}
            />
          </TabsContent>

          <TabsContent value="impact" className="space-y-6">
            <ImpactReportsTab
              productId={productId}
              isHealthy={isHealthy}
              lcaReports={lcaReports}
              onCalculate={handleCalculate}
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
