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
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { ArrowLeft, Settings, Sparkles } from "lucide-react";
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
          <h2 className="text-2xl font-bold">Product Not Found</h2>
          <Link href="/products">
            <Button className="mt-4">Back to Products</Button>
          </Link>
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
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/products/${productId}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">
            {product.sku && `SKU: ${product.sku} · `}
            Functional Unit: {functionalUnit}
          </p>
        </div>
        <div className="flex gap-2">
          {brewwLinked && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowBrewwImport(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Import from Breww
            </Button>
          )}
          {!brewwLinked && brewwConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/settings/integrations/breww?tab=products")}
              className="text-[#2B46C0] border-border"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Link to Breww
            </Button>
          )}
          {isAlkateraAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOpenLCAConfig(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure OpenLCA
            </Button>
          )}
        </div>
      </div>

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
