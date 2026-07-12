"use client";

// Full-page recipe editor. This is the single, canonical product recipe
// editor: it provides the page chrome (product name, functional unit, Breww
// import, OpenLCA config) and delegates the entire editing surface to
// <RecipeEditorPanel>, the shared editor used to be duplicated by a ~1900-line
// flat-form variant here. The panel owns ingredients, packaging, the guided
// packaging wizard, BOM import, templates, maturation, production stages,
// autosave and facility loading via the useRecipeEditor hook.

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageLoader } from "@/components/ui/page-loader";
import { Statement } from "@/components/studio/statement";
import { PillButton } from "@/components/studio/pill-button";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { unitSizeToMl } from "@/lib/constants/material-units";
import { RecipeEditorPanel } from "@/components/products/RecipeEditorPanel";
import { OpenLCAConfigDialog } from "@/components/lca/OpenLCAConfigDialog";
import { BrewwRecipeImportDialog } from "@/components/products/BrewwRecipeImportDialog";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  product_category: string | null;
  alcohol_content_abv: number | null;
}

export default function ProductRecipePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();
  const { isAlkateraAdmin } = useIsAlkateraAdmin();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOpenLCAConfig, setShowOpenLCAConfig] = useState(false);
  const [showBrewwImport, setShowBrewwImport] = useState(false);
  const [brewwLinked, setBrewwLinked] = useState(false);
  const [brewwConnected, setBrewwConnected] = useState(false);
  // Bumped after a Breww import to remount the panel and reload from the DB,
  // since the import replaces the recipe rows externally.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!productId) return;
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, functional_unit, unit_size_value, unit_size_unit, product_category, alcohol_content_abv")
        .eq("id", productId)
        .maybeSingle();
      if (cancelled) return;
      setProduct(data as Product | null);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [productId]);

  // Check whether this product is linked to a Breww SKU — if so, offer the
  // "Import recipe from Breww" action in the header.
  useEffect(() => {
    let cancelled = false;
    const checkLink = async () => {
      if (!productId || !currentOrganization?.id) return;
      const [{ data: link }, { data: conn }] = await Promise.all([
        supabase
          .from("breww_product_links")
          .select("id")
          .eq("organization_id", currentOrganization.id)
          .eq("alkatera_product_id", productId)
          .maybeSingle(),
        supabase
          .from("integration_connections")
          .select("status")
          .eq("organization_id", currentOrganization.id)
          .eq("provider_slug", "breww")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setBrewwLinked(!!link);
      setBrewwConnected(conn?.status === "active");
    };
    checkLink();
    return () => { cancelled = true; };
  }, [productId, currentOrganization?.id]);

  if (loading) {
    return <PageLoader message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em]">Product not found.</h2>
          <PillButton href="/products" variant="outline" className="mt-4">
            Back to products
          </PillButton>
        </div>
      </div>
    );
  }

  const functionalUnit =
    product.functional_unit ||
    (product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : "Not specified");

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <Link
          href={`/products/${productId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
        >
          &larr; Back to product
        </Link>
      </div>

      <Statement eyebrow="THE CELLAR · RECIPE" headline={<>{product.name}.</>} />

      <div className="mt-4 mb-8 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          {functionalUnit}
        </span>
        {product.sku && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            SKU {product.sku}
          </span>
        )}
      </div>

      {(brewwLinked || (!brewwLinked && brewwConnected) || isAlkateraAdmin) && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {brewwLinked && (
            <PillButton variant="outline" size="sm" onClick={() => setShowBrewwImport(true)}>
              Import from Breww
            </PillButton>
          )}
          {!brewwLinked && brewwConnected && (
            <PillButton
              variant="ghost"
              size="sm"
              onClick={() => router.push("/settings/integrations/breww?tab=products")}
            >
              Link to Breww
            </PillButton>
          )}
          {isAlkateraAdmin && (
            <PillButton variant="ghost" size="sm" onClick={() => setShowOpenLCAConfig(true)}>
              Configure OpenLCA
            </PillButton>
          )}
        </div>
      )}

      <RecipeEditorPanel
        key={reloadKey}
        productId={productId}
        organizationId={currentOrganization?.id || ""}
        productCategory={product.product_category}
        productAbvPercent={product.alcohol_content_abv ?? null}
        productBottleSizeMl={unitSizeToMl(product.unit_size_value, product.unit_size_unit)}
        compact={false}
        initialTab={searchParams.get("tab") || "ingredients"}
      />

      <OpenLCAConfigDialog
        open={showOpenLCAConfig}
        onOpenChange={setShowOpenLCAConfig}
      />

      {brewwLinked && currentOrganization?.id && (
        <BrewwRecipeImportDialog
          open={showBrewwImport}
          onOpenChange={setShowBrewwImport}
          organizationId={currentOrganization.id}
          productId={productId}
          onImported={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
