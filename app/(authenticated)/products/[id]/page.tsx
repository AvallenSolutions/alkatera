"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { Statement } from "@/components/studio/statement";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { ProvenanceChip } from "@/components/studio/provenance-chip";
import { PillButton } from "@/components/studio/pill-button";
import { Eyebrow } from "@/components/studio/eyebrow";
import { provenanceFromPcfStatus } from "@/lib/provenance";
import { BrewwLinkBadge } from "@/components/products/BrewwLinkBadge";
import { BrewwSuggestionBanner } from "@/components/products/BrewwSuggestionBanner";
import { LcaStalenessBanner } from "@/components/products/LcaStalenessBanner";
import { FootprintStory } from "@/components/products/hub/FootprintStory";
import { CompositionSection } from "@/components/products/hub/CompositionSection";
import { ProofSection } from "@/components/products/hub/ProofSection";
import { MultipackContentsEditor } from "@/components/products/MultipackContentsEditor";
import { MultipackPackagingSection } from "@/components/products/MultipackPackagingSection";
import { FacilitiesTab } from "@/components/products/FacilitiesTab";
import { SettingsTab } from "@/components/products/SettingsTab";
import { EditProductForm } from "@/components/products/EditProductForm";
import { useProductData } from "@/hooks/data/useProductData";
import { deleteProduct } from "@/lib/products/delete-product";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { getBoundaryLabel, normaliseBoundary } from "@/lib/system-boundaries";
import { toast } from "sonner";

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

/**
 * A product's one-page story.
 *
 * This page used to be five shadcn tabs (Overview, Specification, Facilities,
 * Passport, Settings) under a studio header: the old app in new clothes, which
 * the design canon names as the thing never to do. Nothing here is a mode, so
 * nothing here is a tab. It reads down the page: what it is, what its
 * footprint says, what it is made of, where it is made, what it can show the
 * world, and the housekeeping at the foot.
 *
 * The number appears here and on the dossier, deliberately: the hub says what
 * the footprint IS, the dossier says where every part of it came from and lets
 * it be corrected.
 */
export default function ProductDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;

  const {
    product,
    ingredients,
    packaging,
    lcaReports,
    latestPcf,
    maturation,
    isHealthy,
    loading,
    error,
    refetch,
  } = useProductData(productId);
  const { currentOrganization } = useOrganization();
  const recipeStale = useRecipeStale(productId);
  const facilitiesRef = useRef<HTMLDivElement>(null);

  const [showEditDialog, setShowEditDialog] = useState(false);
  // Bumped when something on this page invalidates the stored footprint, so the
  // staleness banner remounts and re-checks rather than waiting for a refocus.
  const [stalenessKey, setStalenessKey] = useState(0);

  const footprint = latestPcf?.aggregated_impacts?.climate_change_gwp100;
  const boundary = latestPcf?.system_boundary ?? (product as any)?.system_boundary ?? null;

  // /company/production-allocation deep-links here with ?tab=facilities, from
  // when facilities was a tab. It is a section now, so the link scrolls.
  //
  // Two things make a single scroll unreliable: the section is gated on the
  // organisation resolving, so the ref is still null on the first render after
  // loading finishes, and the sections above it fetch their own data, so the
  // page grows underneath us afterwards. So: wait for the element, then settle
  // once more when the async content above has landed.
  // Deep links land on the section through the URL fragment (#facilities), which
  // the browser and the router already know how to honour, so there is no scroll
  // code here. `?tab=facilities` is the older form, kept working by turning it
  // into that fragment once the section exists to receive it.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (loading || deepLinked.current) return;
    if (searchParams.get("tab") !== "facilities") return;
    if (!facilitiesRef.current) return;
    deepLinked.current = true;
    // Waits for the sections above to finish arriving, otherwise the anchor
    // moves out from under the jump.
    const settle = window.setTimeout(() => {
      facilitiesRef.current?.scrollIntoView({ block: "start" });
    }, 900);
    return () => window.clearTimeout(settle);
  }, [loading, searchParams, currentOrganization]);

  // "Open" rather than "Create": a product with a recipe already has an
  // estimated footprint, so there is nothing to create, only something to look
  // at and correct.
  const handleOpenFootprint = () => {
    if (!isHealthy) {
      toast.error(
        product?.is_multipack
          ? "Add the products this multipack contains before calculating its LCA"
          : "Please add ingredients and packaging before calculating"
      );
      return;
    }
    router.push(`/products/${productId}/dossier`);
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
      // The guard against a silent multipack cascade lives in the shared
      // helper, so the products list cannot forget it (it used to).
      await deleteProduct(getSupabaseBrowserClient() as any, productId);
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

  const ctaLabel = footprint != null ? "Open the footprint" : "Start the footprint";

  const metaFacts = [
    product.sku ? `SKU ${product.sku}` : null,
    product.product_category,
    product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : null,
    boundary ? getBoundaryLabel(normaliseBoundary(boundary)) : null,
  ].filter(Boolean);

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
      <div data-guide="product-statement">
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
                alt=""
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
                  label="KG CO₂E PER UNIT"
                />
              )}
            </Statement>
          </div>
        </div>

        {/* Provenance is the status vocabulary. The old chip row said "LCA
            complete" beside a dossier reading "0% confirmed"; only one of them
            could be right. Everything left here is actionable. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {metaFacts.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              {metaFacts.join(" · ")}
            </span>
          )}
          {latestPcf?.status && (
            <ProvenanceChip provenance={provenanceFromPcfStatus(latestPcf.status)} />
          )}
          {product.is_multipack && <StateChip tone="quiet">Multipack</StateChip>}
          {recipeStale && <StateChip tone="attention">Recipe changed</StateChip>}
          {!isHealthy && <StateChip tone="attention">Setup incomplete</StateChip>}
          {product.id != null && <BrewwLinkBadge productId={product.id} />}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span data-guide="product-footprint-cta">
            <PillButton variant="room" onClick={handleOpenFootprint}>
              {ctaLabel}
            </PillButton>
          </span>
          <PillButton variant="outline" href={`/products/${productId}/recipe`}>
            Edit the recipe
          </PillButton>
          <button
            type="button"
            onClick={() => setShowEditDialog(true)}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 ease-studio hover:text-foreground"
          >
            Edit details
          </button>
        </div>
      </div>

      <div className="mt-8">
        <BrewwSuggestionBanner productId={productId} productName={product.name} />
      </div>

      {currentOrganization && (
        <div className="mt-6">
          <LcaStalenessBanner
            key={stalenessKey}
            productId={productId}
            organizationId={currentOrganization.id}
            onRecalculated={() => window.location.reload()}
          />
        </div>
      )}

      <div className="mt-10 space-y-10">
        <FootprintStory
          productId={productId}
          category={product.product_category}
          unitSizeUnit={product.unit_size_unit}
          unitSizeValue={product.unit_size_value}
          pcf={latestPcf}
          isHealthy={isHealthy}
        />

        <div data-guide="product-recipe">
          {product.is_multipack && currentOrganization ? (
            // A multipack has no single-SKU recipe of its own; its footprint
            // comes from its component products. It gets the contents editor
            // plus its own transit packaging instead of a composition.
            <section className="border-t border-studio-hairline pt-8">
              <Eyebrow className="mb-6">WHAT IT CONTAINS</Eyebrow>
              <div className="space-y-8">
                <MultipackContentsEditor
                  productId={productId}
                  organizationId={currentOrganization.id}
                  onChanged={() => setStalenessKey((k) => k + 1)}
                />
                <MultipackPackagingSection
                  productId={productId}
                  organizationId={currentOrganization.id}
                />
              </div>
            </section>
          ) : (
            <CompositionSection
              productId={productId}
              liquidId={(product as any).liquid_id ?? null}
              packFormatId={(product as any).pack_format_id ?? null}
              ingredients={ingredients}
              packaging={packaging}
              maturation={maturation}
            />
          )}
        </div>

        {currentOrganization && (
          <section
            ref={facilitiesRef}
            id="facilities"
            className="scroll-mt-24 border-t border-studio-hairline pt-8"
          >
            <Eyebrow className="mb-6">WHERE IT IS MADE</Eyebrow>
            <FacilitiesTab
              productId={parseInt(productId)}
              organizationId={currentOrganization.id}
              annualProductionVolume={product.annual_production_volume ?? null}
              annualProductionUnit={product.annual_production_unit ?? null}
              unitSizeUnit={product.unit_size_unit ?? null}
              onProductUpdated={refetch}
            />
          </section>
        )}

        <div data-guide="product-story">
          <ProofSection productId={productId} product={product} lcaReports={lcaReports} />
        </div>

        <section className="border-t border-studio-hairline pt-8">
          <SettingsTab
            productName={product.name}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </section>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
