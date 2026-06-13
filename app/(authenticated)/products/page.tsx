"use client";

import { useState, useEffect, useMemo } from "react";
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Input } from "@/components/ui/input";
import { WebsiteImportFlow } from "@/components/products/WebsiteImportFlow";
import { Plus, Package, AlertCircle, Trash2, MoreVertical, Search, Leaf, ArrowRight, Globe, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { duplicateProduct } from "@/lib/products";
import { useRouter } from "next/navigation";
import { boundaryFromDbEnum, getBoundaryLabel, SYSTEM_BOUNDARIES } from "@/lib/system-boundaries";
import { useOrganization } from "@/lib/organizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DataQualityIndicator } from "@/components/ui/data-quality-indicator";
import { ProductPortfolioMatrix } from "@/components/products/ProductPortfolioMatrix";
import { buildPortfolioPoints, sumFacilityVolume, type PortfolioResult } from "@/lib/products/portfolio";
import { cn } from "@/lib/utils";

interface ProductCarbonFootprint {
  system_boundary: string | null;
}

interface Product {
  id: string;
  name: string;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  // Legacy fields (kept for backwards compatibility)
  functional_unit_type: string | null;
  functional_unit_volume: number | null;
  functional_unit_measure: string | null;
  system_boundary: string;
  product_carbon_footprints: ProductCarbonFootprint[];
  /** Impact-weighted data quality score (0-100) from the latest completed PCF. */
  dqi_score: number | null;
  created_at: string;
}

export default function ProductsPage() {
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);
  const [view, setView] = useState<'list' | 'portfolio'>('list');

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Tell Rosa what's on this list so she can answer questions like
  // "which of my products don't have an LCA yet?" or "what's my newest
  // product?" without making a separate query.
  const rosaSlice = useMemo(() => {
    if (!currentOrganization?.id) return null;
    const productSummaries = products.map(p => {
      const hasLca = (p.product_carbon_footprints || []).length > 0;
      const boundaryLabels = (p.product_carbon_footprints || [])
        .map(f => f.system_boundary)
        .filter(Boolean);
      return {
        name: p.name,
        functional_unit: p.functional_unit,
        boundary: boundaryLabels.length > 0 ? boundaryLabels.join(', ') : null,
        has_lca: hasLca,
      };
    });
    const without = productSummaries.filter(p => !p.has_lca);
    return {
      id: 'products-list',
      label: `Products list (${products.length})`,
      priority: 6,
      data: {
        product_count: products.length,
        products_without_lca: without.length,
        products: productSummaries,
        notes: without.length > 0
          ? `${without.length} of ${products.length} products don't have an LCA yet.`
          : 'All products have an LCA.',
      },
    };
  }, [products, currentOrganization?.id]);

  useRosaPageContext(rosaSlice);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch the latest system_boundary from product_carbon_footprints for each product
      const productIds = (data || []).map((p: any) => p.id);
      const { data: pcfData } = productIds.length > 0
        ? await supabase
            .from("product_carbon_footprints")
            .select("product_id, system_boundary")
            .in("product_id", productIds)
            .not("system_boundary", "is", null)
            .order("created_at", { ascending: false })
        : { data: [] };

      // Build a map of product_id -> latest PCF boundary
      const pcfBoundaryMap = new Map<string, string>();
      for (const pcf of pcfData || []) {
        // First entry per product_id wins (ordered by created_at desc)
        if (pcf.product_id && !pcfBoundaryMap.has(String(pcf.product_id))) {
          pcfBoundaryMap.set(String(pcf.product_id), pcf.system_boundary);
        }
      }

      // Fetch each product's data quality score (DQI) from its completed PCF.
      // dqi_score is the impact-weighted confidence across all materials,
      // written by the aggregator on every calculation.
      // Completed PCFs carry the DQI plus the per-unit climate figure and the
      // facility detail we sum into an annual volume for the portfolio matrix.
      // JSON-path selects keep the payload slim (no full aggregated_impacts).
      const { data: dqiData } = productIds.length > 0
        ? await supabase
            .from("product_carbon_footprints")
            .select(
              "product_id, dqi_score, status, perUnit:aggregated_impacts->climate_change_gwp100, facilityDetail:aggregated_impacts->facility_detail"
            )
            .in("product_id", productIds)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
        : { data: [] };

      const dqiMap = new Map<string, number>();
      const perUnitMap = new Map<string, number>();
      const volumeMap = new Map<string, number>();
      for (const pcf of dqiData || []) {
        const pid = pcf.product_id ? String(pcf.product_id) : null;
        if (!pid || dqiMap.has(pid) || perUnitMap.has(pid)) continue; // first (latest) per product wins
        if (pcf.dqi_score != null) dqiMap.set(pid, Number(pcf.dqi_score));
        if (pcf.perUnit != null) perUnitMap.set(pid, Number(pcf.perUnit));
        volumeMap.set(pid, sumFacilityVolume(pcf.facilityDetail as any));
      }

      const productsWithMeta = (data || []).map((p: any) => ({
        ...p,
        product_carbon_footprints: pcfBoundaryMap.has(String(p.id))
          ? [{ system_boundary: pcfBoundaryMap.get(String(p.id))! }]
          : [],
        dqi_score: dqiMap.get(String(p.id)) ?? null,
      }));
      setProducts(productsWithMeta);

      // Portfolio matrix data: only products with a completed footprint.
      setPortfolio(
        buildPortfolioPoints(
          productsWithMeta
            .filter((p: any) => perUnitMap.has(String(p.id)))
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              perUnitKgCo2e: perUnitMap.get(String(p.id)) ?? null,
              annualVolume: volumeMap.get(String(p.id)) ?? null,
              functionalUnit: p.unit_size_unit ?? p.functional_unit ?? null,
            }))
        )
      );
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatFunctionalUnit = (product: Product) => {
    // Prefer the structured unit_size fields (updated by the edit form)
    if (product.unit_size_value && product.unit_size_unit) {
      return `${product.unit_size_value} ${product.unit_size_unit}`;
    }

    // Fallback: legacy functional_unit text field
    if (product.functional_unit) {
      return product.functional_unit;
    }

    // Legacy fallback: check old functional_unit_type fields
    if (product.functional_unit_type) {
      return `${product.functional_unit_volume || "?"} ${product.functional_unit_measure || ""} ${product.functional_unit_type}`;
    }

    return "Not specified";
  };

  const getEffectiveBoundary = (product: Product): string => {
    // Prefer the boundary set by the LCA wizard (stored in product_carbon_footprints)
    // over the products table default which may never have been updated
    const pcfBoundary = product.product_carbon_footprints?.find(
      (pcf) => pcf.system_boundary
    )?.system_boundary;
    return pcfBoundary || product.system_boundary || "cradle_to_gate";
  };

  const getBoundaryBadge = (boundary: string) => {
    // Normalise both DB enum format (underscores) and PCF format (hyphens)
    const normalised = boundary.includes("_") ? boundaryFromDbEnum(boundary) : boundary;
    const label = getBoundaryLabel(normalised);
    const isFullLifecycle = normalised === "cradle-to-consumer" || normalised === "cradle-to-grave";
    return (
      <Badge
        variant={isFullLifecycle ? "default" : "secondary"}
        className={isFullLifecycle ? "bg-green-600" : "bg-amber-600 text-white"}
      >
        {label}
      </Badge>
    );
  };

  const handleDeleteClick = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const handleDuplicateClick = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (duplicatingId) return;
    setDuplicatingId(product.id);
    toast.info(`Duplicating "${product.name}"...`, { id: 'duplicate-product' });
    try {
      const newId = await duplicateProduct(product.id);
      toast.success('Copy created. Ingredients and packaging came across; production data and reports start fresh.', { id: 'duplicate-product' });
      router.push(`/products/${newId}`);
    } catch (error: any) {
      console.error('Error duplicating product:', error);
      toast.error(error.message || 'Failed to duplicate product', { id: 'duplicate-product' });
      setDuplicatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productToDelete.id);

      if (error) throw error;

      toast.success(`Product "${productToDelete.name}" deleted successfully`);
      await fetchProducts();
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(error.message || "Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.product_description?.toLowerCase().includes(query) ||
      product.functional_unit?.toLowerCase().includes(query) ||
      product.functional_unit_type?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <PageLoader message="Loading products..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage your products here
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => setImportDialogOpen(true)}
          >
            <Globe className="h-4 w-4" />
            Import from Website
          </Button>
          <Link href="/products/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add New Product
            </Button>
          </Link>
        </div>
      </div>

      {products.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products by name, description, or functional unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex rounded-md border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-[#ccff00]/20 text-foreground' : 'text-muted-foreground',
              )}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView('portfolio')}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'portfolio' ? 'bg-[#ccff00]/20 text-foreground' : 'text-muted-foreground',
              )}
            >
              Portfolio
            </button>
          </div>
        </div>
      )}

      <FlagThresholdBanner />

      {products.length > 0 && view === 'portfolio' && portfolio && (
        <ProductPortfolioMatrix data={portfolio} />
      )}

      {products.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <Leaf className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Build Your Product Portfolio</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Products are at the heart of your sustainability story. Import from your website or create one manually.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                size="lg"
                className="gap-2 bg-neon-lime text-black hover:bg-neon-lime/90"
                onClick={() => setImportDialogOpen(true)}
              >
                <Globe className="h-4 w-4" />
                Import from Website
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/products/new">
                  <Plus className="h-4 w-4" />
                  Add Manually
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : view !== 'list' ? null : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No products match your search. Try adjusting your search terms.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="h-full hover:shadow-lg transition-shadow relative group">
              <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-sm"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => handleDuplicateClick(product, e)}
                      disabled={duplicatingId === product.id}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {duplicatingId === product.id ? 'Duplicating...' : 'Duplicate Product'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={(e) => handleDeleteClick(product, e)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link href={`/products/${product.id}`}>
                <CardHeader>
                  {product.product_image_url ? (
                    <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <img
                        src={product.product_image_url}
                        alt={product.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {product.product_description || "No description provided"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Functional Unit:</span>
                    <span className="font-medium">{formatFunctionalUnit(product)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">System Boundary:</span>
                    {getBoundaryBadge(getEffectiveBoundary(product))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data Quality:</span>
                    {product.dqi_score !== null ? (
                      <DataQualityIndicator
                        variant="minimal"
                        confidenceScore={Math.round(product.dqi_score)}
                        dataQualityGrade={product.dqi_score >= 80 ? 'HIGH' : product.dqi_score >= 50 ? 'MEDIUM' : 'LOW'}
                        methodology="Weighted across all materials in the latest calculation"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Created {formatDate(product.created_at)}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {currentOrganization && (
        <WebsiteImportFlow
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          organizationId={currentOrganization.id}
          onSuccess={(count) => {
            // Refresh products in the background while success state is shown
            fetchProducts();
            toast.success(`${count} product${count !== 1 ? 's' : ''} imported successfully`);
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}&quot;? This action cannot be undone and will remove all associated data including materials, LCA results, and calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
