"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Statement } from "@/components/studio/statement";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { Panel } from "@/components/studio/panel";
import { BrewwLinkBadge } from "@/components/products/BrewwLinkBadge";
import { BrewwSuggestionBanner } from "@/components/products/BrewwSuggestionBanner";
import { OverviewTab } from "@/components/products/OverviewTab";
import { LcaStalenessBanner } from "@/components/products/LcaStalenessBanner";
import { SpecificationTab } from "@/components/products/SpecificationTab";
import { MultipackContentsEditor } from "@/components/products/MultipackContentsEditor";
import { MultipackPackagingSection } from "@/components/products/MultipackPackagingSection";
import { FacilitiesTab } from "@/components/products/FacilitiesTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";
import dynamic from "next/dynamic";
import PassportManagementPanel from "@/components/passport/PassportManagementPanel";
import { ProductGuideTrigger } from "@/components/products/ProductGuide";
import { DownloadLCAButton } from "@/components/products/DownloadLCAButton";
import { useProductData } from "@/hooks/data/useProductData";

// Lazy-load ProductGuide (uses framer-motion, ~60KB) and only shows
// for users who haven't dismissed the guide.
const ProductGuide = dynamic(
  () => import("@/components/products/ProductGuide").then(mod => ({ default: mod.ProductGuide })),
  { ssr: false }
);
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

/** Quiet mono tab trigger: uppercase, tracked, 3px underline when active. */
const MONO_TAB =
  'relative -mb-px rounded-none border-b-[3px] border-transparent bg-transparent px-0 pb-2.5 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim shadow-none transition-colors data-[state=active]:border-room-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

const MONO_TAB_LIST =
  'h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Editing ingredients or packaging updates product_materials but does NOT
 * refresh the stored LCA snapshot, so a completed footprint can silently go
 * out of date. This mirrors the recipe editor's staleness check, quietly, so
 * the hub can flag it as a working-tone chip.
 */
function useRecipeStale(productId: string | undefined): boolean {
  const [stale, setStale] = useState(false);

  const checkStale = useCallback(async () => {
    if (!productId) return;
    const pid = parseInt(productId, 10);
    if (!Number.isFinite(pid)) return;

    const sb = getSupabaseBrowserClient();
    const { data: pcf } = await sb
      .from("product_carbon_footprints")
      .select("id, updated_at")
      .eq("product_id", pid)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pcf) {
      setStale(false);
      return;
    }

    const [{ data: snap }, { data: latestMat }] = await Promise.all([
      sb
        .from("product_carbon_footprint_materials")
        .select("created_at")
        .eq("product_carbon_footprint_id", pcf.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("product_materials")
        .select("updated_at")
        .eq("product_id", pid)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const snapTime = snap?.created_at
      ? new Date(snap.created_at).getTime()
      : pcf.updated_at
        ? new Date(pcf.updated_at).getTime()
        : 0;
    const editTime = latestMat?.updated_at ? new Date(latestMat.updated_at).getTime() : 0;
    setStale(editTime > 0 && snapTime > 0 && editTime > snapTime);
  }, [productId]);

  useEffect(() => {
    checkStale();
    const onFocus = () => checkStale();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [checkStale]);

  return stale;
}

export default function ProductDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;

  const { product, ingredients, packaging, lcaReports, isHealthy, loading, error, refetch } = useProductData(productId);
  const { currentOrganization } = useOrganization();
  const recipeStale = useRecipeStale(productId);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "overview");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const latestLca = lcaReports[0];
  const footprint = latestLca?.aggregated_impacts?.climate_change_gwp100;

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
    return <PageLoader message="Loading product..." />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-6 py-10">
        <Link
          href="/products"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
        >
          &larr; The products
        </Link>
        <p className="mt-6 text-sm text-studio-stale">{error || "Product not found."}</p>
      </div>
    );
  }

  const ctaLabel = footprint != null ? "Update LCA" : "Create LCA";

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      <div data-guide="product-header">
        <div className="mb-8">
          <Link
            href="/products"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
          >
            &larr; The products
          </Link>
        </div>

        <div className="flex items-start gap-5">
          <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-studio-hairline bg-studio-cream sm:block">
            {product.product_image_url ? (
              <Image
                src={product.product_image_url}
                alt={product.name}
                width={64}
                height={64}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-studio-dim">
                {product.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <Statement eyebrow="THE CELLAR · PRODUCT" headline={<>{product.name}.</>}>
              {footprint != null && (
                <BigNumber
                  size="display"
                  tone="room"
                  value={footprint.toFixed(2)}
                  label="KG CO₂E"
                />
              )}
            </Statement>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {product.sku && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              SKU {product.sku}
            </span>
          )}
          {product.product_category && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              {product.product_category}
            </span>
          )}
          {product.is_multipack && <StateChip tone="quiet">Multipack</StateChip>}
          <StateChip tone={footprint != null ? "good" : "quiet"}>
            {footprint != null ? "LCA complete" : "No LCA yet"}
          </StateChip>
          {recipeStale && <StateChip tone="attention">Recipe changed</StateChip>}
          <StateChip tone={isHealthy ? "good" : "attention"}>
            {isHealthy ? "Ready to calculate" : "Setup incomplete"}
          </StateChip>
          {product.id != null && <BrewwLinkBadge productId={product.id} />}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span data-guide="product-calculate-btn">
            <PillButton variant="room" onClick={handleCalculate}>
              {ctaLabel}
            </PillButton>
          </span>
          {latestLca?.id && (
            <DownloadLCAButton
              lcaId={latestLca.id}
              productName={product.name}
              productId={Number(productId)}
              size="default"
            />
          )}
          <PillButton variant="outline" onClick={() => setShowEditDialog(true)}>
            Edit details
          </PillButton>
          <ProductGuideTrigger />
        </div>
      </div>

      <div className="mt-8">
        <BrewwSuggestionBanner productId={productId} productName={product.name} />
      </div>

      {!isHealthy && (
        <Panel className="mt-6">
          <p className="text-sm text-muted-foreground">
            Add ingredients and packaging to this product before calculating its environmental impact.
          </p>
        </Panel>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-10 space-y-8">
        <TabsList data-guide="product-tabs" className={MONO_TAB_LIST}>
          <TabsTrigger value="overview" className={MONO_TAB}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="specification" data-guide="product-specification" className={MONO_TAB}>
            Specification
          </TabsTrigger>
          <TabsTrigger value="facilities" className={MONO_TAB}>
            Facilities
          </TabsTrigger>
          <TabsTrigger value="passport" data-guide="product-passport-tab" className={MONO_TAB}>
            Passport
          </TabsTrigger>
          <TabsTrigger value="settings" className={MONO_TAB}>
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" data-guide="product-overview" className="space-y-8">
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

        <TabsContent value="specification" className="space-y-8">
          {product.is_multipack && currentOrganization ? (
            // A multipack has no single-SKU recipe of its own to edit here; its
            // footprint comes from its component products. Show the contents
            // editor (add/remove products, change quantities) plus an editor for
            // the pack's OWN transit/grouping packaging (shipper box, shrink
            // wrap, pallet), which is otherwise only settable at create time.
            <>
              <MultipackContentsEditor
                productId={productId}
                organizationId={currentOrganization.id}
              />
              <MultipackPackagingSection
                productId={productId}
                organizationId={currentOrganization.id}
              />
            </>
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

        <TabsContent value="facilities" className="space-y-8">
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

        <TabsContent value="passport" className="space-y-8">
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

        <TabsContent value="settings" className="space-y-8">
          <SettingsTab
            productName={product.name}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

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
            <DialogTitle>Edit product details</DialogTitle>
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
