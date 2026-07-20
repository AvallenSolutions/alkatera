"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UniversalDropzone } from "@/components/layouts/UniversalDropzone";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { PageLoader } from "@/components/ui/page-loader";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// Round 4 (auto-research): import wizard is a modal (open-gated), so defer it.
const WebsiteImportFlow = dynamic(() => import("@/components/products/WebsiteImportFlow").then((m) => m.WebsiteImportFlow), { ssr: false });
import { Trash2, MoreVertical, Search, Copy, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { duplicateProduct } from "@/lib/products";
import { useRouter } from "next/navigation";
import { normaliseBoundary, getBoundaryLabel } from "@/lib/system-boundaries";
import { useOrganization } from "@/lib/organizationContext";
import { useSubscription } from "@/hooks/useSubscription";
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
// Round 4 (auto-research): recharts matrix only renders under the 'portfolio' view.
const ProductPortfolioMatrix = dynamic(() => import("@/components/products/ProductPortfolioMatrix").then((m) => m.ProductPortfolioMatrix), { ssr: false });
import { buildPortfolioPoints, sumFacilityVolume, type PortfolioResult } from "@/lib/products/portfolio";
import { cn } from "@/lib/utils";
import { ProvenanceChip } from "@/components/studio/provenance-chip";
import { provenanceFromPcfStatus } from "@/lib/provenance";

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
  /** Per-unit climate footprint (kg CO2e) from the latest completed PCF. */
  footprint_per_unit: number | null;
  /** Latest PCF's raw status ('draft' | 'estimate' | 'completed' | ...), for the provenance chip. */
  latest_pcf_status: string | null;
  created_at: string;
}

export default function ProductsPage() {
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const { isReadOnly } = useSubscription();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bringInOpen, setBringInOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);
  const [view, setView] = useState<'list' | 'portfolio'>('list');
  const [matchCount, setMatchCount] = useState(0);
  const [findingMatches, setFindingMatches] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, showArchived]);

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
      let query = supabase
        .from("products")
        .select("*")
        // Only true products belong in this list — hospitality meals/drinks/room
        // nights reuse the products table but are surfaced under Hospitality.
        .eq("product_kind", "product")
        .eq("organization_id", currentOrganization!.id);
      // Hide archived products by default (archived_at is the real archive flag).
      if (!showArchived) query = query.is("archived_at", null);
      const { data, error } = await query
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

      // Latest PCF status per product, regardless of value — feeds the
      // provenance chip via lib/provenance's provenanceFromPcfStatus.
      // Separate from dqiData below, which only ever fetches completed PCFs.
      const { data: pcfStatusData } = productIds.length > 0
        ? await supabase
            .from("product_carbon_footprints")
            .select("product_id, status")
            .in("product_id", productIds)
            .order("created_at", { ascending: false })
        : { data: [] };
      const pcfStatusMap = new Map<string, string | null>();
      for (const pcf of pcfStatusData || []) {
        if (pcf.product_id && !pcfStatusMap.has(String(pcf.product_id))) {
          pcfStatusMap.set(String(pcf.product_id), pcf.status ?? null);
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
        footprint_per_unit: perUnitMap.get(String(p.id)) ?? null,
        latest_pcf_status: pcfStatusMap.get(String(p.id)) ?? null,
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

  const loadMatchCount = async () => {
    if (!currentOrganization?.id) return;
    try {
      const res = await fetch(`/api/products/ingredient-matches?organization_id=${currentOrganization.id}`);
      const body = await res.json().catch(() => ({}));
      setMatchCount(res.ok ? (body.suggestions?.length ?? 0) : 0);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    loadMatchCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const findSupplierMatches = async () => {
    if (!currentOrganization?.id) return;
    setFindingMatches(true);
    try {
      const res = await fetch('/api/products/ingredient-matches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: currentOrganization.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadMatchCount();
        if ((body.created ?? 0) > 0) {
          router.push('/products/supplier-matches');
        } else {
          toast.success('No new supplier matches found. Connect more suppliers or add supplier products.');
        }
      } else {
        toast.error(body.error ?? 'Could not look for matches');
      }
    } catch {
      toast.error('Could not look for matches');
    } finally {
      setFindingMatches(false);
    }
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

  const boundaryLabel = (boundary: string) => {
    // Normalise both DB enum format (underscores) and PCF format (hyphens),
    // plus the capitalised values older rows carry.
    return getBoundaryLabel(normaliseBoundary(boundary));
  };

  /** Format a per-unit footprint figure for the card number. */
  const formatFootprint = (value: number) =>
    value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

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

  const addProduct = isReadOnly ? (
    <PillButton variant="room" href="/complete-subscription">
      Subscribe to add
    </PillButton>
  ) : (
    <PillButton variant="room" href="/products/new">
      Add product
    </PillButton>
  );

  // A quiet menu row inside the "Bring products in" popover.
  const rowClasses =
    "block w-full rounded-[4px] px-3 py-2 text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/5";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="min-w-0">
          <Eyebrow className="mb-3">THE CELLAR · PRODUCTS</Eyebrow>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The products.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Everything you make, and the footprint behind it.
          </p>
        </div>
        <div className="flex shrink-0 items-end gap-8 pb-1">
          <BigNumber size="display" value={products.length} label="Products" />
          <div className="flex items-center gap-2">
            <Popover open={bringInOpen} onOpenChange={setBringInOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-studio-ink/25 bg-transparent px-4 text-sm font-medium text-foreground transition-colors duration-200 ease-studio hover:border-studio-ink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Bring products in
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-1">
                <UniversalDropzone
                  trigger={
                    <button type="button" className={rowClasses} onClick={() => setBringInOpen(false)}>
                      <span className="block text-sm font-medium text-foreground">Smart upload</span>
                      <span className="block text-xs text-muted-foreground">
                        Drop a file in, we read it for you
                      </span>
                    </button>
                  }
                />
                <button
                  type="button"
                  className={rowClasses}
                  onClick={() => {
                    setImportDialogOpen(true);
                    setBringInOpen(false);
                  }}
                >
                  <span className="block text-sm font-medium text-foreground">Import from a website</span>
                  <span className="block text-xs text-muted-foreground">
                    We read your product pages
                  </span>
                </button>
                <Link href="/products/import" className={rowClasses} onClick={() => setBringInOpen(false)}>
                  <span className="block text-sm font-medium text-foreground">From a spreadsheet</span>
                  <span className="block text-xs text-muted-foreground">
                    Bulk upload with our template
                  </span>
                </Link>
              </PopoverContent>
            </Popover>
            {products.length > 0 && (
              <PillButton variant="outline" onClick={findSupplierMatches} disabled={findingMatches}>
                {findingMatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Find supplier matches
              </PillButton>
            )}
            {addProduct}
          </div>
        </div>
      </header>

      {matchCount > 0 && (
        <Link
          href="/products/supplier-matches"
          className="flex items-center gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream px-4 py-2.5 text-sm transition-colors duration-150 ease-studio hover:border-room-accent"
        >
          <span className="flex-1">
            {matchCount} supplier {matchCount === 1 ? 'match' : 'matches'} to review. Linking adds real
            supplier data to your footprints.
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
            Review →
          </span>
        </Link>
      )}

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
          <div className="flex items-center gap-5">
            {(['list', 'portfolio'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'relative py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-opacity duration-150 ease-studio',
                  view === v ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                )}
              >
                {v}
                {view === v && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-room-accent" />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              'rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors',
              showArchived ? 'bg-[#ccff00]/20 text-foreground' : 'text-muted-foreground',
            )}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        </div>
      )}

      <FlagThresholdBanner />

      {products.length > 0 && view === 'portfolio' && portfolio && (
        <ProductPortfolioMatrix data={portfolio} />
      )}

      {products.length === 0 ? (
        <div className="space-y-4 py-6">
          <p className="max-w-md text-sm text-muted-foreground">
            No products yet. Add your first one, or bring a batch in from a website or spreadsheet.
          </p>
          {addProduct}
        </div>
      ) : view !== 'list' ? null : filteredProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products match &ldquo;{searchQuery}&rdquo;. Try a different search.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const hasFootprint = product.footprint_per_unit != null;
            const hasPcf = (product.product_carbon_footprints || []).length > 0;
            const status: { tone: 'good' | 'attention' | 'quiet'; label: string } = hasFootprint
              ? { tone: 'good', label: 'LCA complete' }
              : hasPcf
                ? { tone: 'attention', label: 'In progress' }
                : { tone: 'quiet', label: 'No LCA yet' };
            return (
              <div key={product.id} className="group relative">
                <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 border border-studio-hairline bg-studio-cream"
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
                        {duplicatingId === product.id ? 'Duplicating…' : 'Duplicate product'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-studio-stale focus:text-studio-stale"
                        onClick={(e) => handleDeleteClick(product, e)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete product
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link
                  href={`/products/${product.id}`}
                  className="block rounded-[6px] border border-studio-hairline bg-studio-cream p-4 transition-colors duration-150 ease-studio hover:border-room-accent"
                >
                  {product.product_image_url ? (
                    <div className="mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-[4px] bg-studio-paper">
                      <img
                        src={product.product_image_url}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex aspect-video items-center justify-center rounded-[4px] border border-studio-hairline bg-studio-paper">
                      <span className="font-display text-3xl font-bold text-muted-foreground/40">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <h3 className="line-clamp-2 font-display text-[15px] font-semibold text-foreground">
                      {product.name}
                    </h3>
                    {(product as any).archived_at && <StateChip tone="quiet">Archived</StateChip>}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {formatFunctionalUnit(product)}
                  </p>

                  <div className="mt-4">
                    {hasFootprint ? (
                      <BigNumber
                        size="panel"
                        value={formatFootprint(product.footprint_per_unit!)}
                        label="kg CO₂e / unit"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Footprint not calculated yet.</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-studio-hairline pt-3">
                    <div className="flex items-center gap-2">
                      <StateChip tone={status.tone}>{status.label}</StateChip>
                      {product.latest_pcf_status && (
                        <ProvenanceChip provenance={provenanceFromPcfStatus(product.latest_pcf_status)} compact />
                      )}
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {boundaryLabel(getEffectiveBoundary(product))}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
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
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}&quot;? This action cannot be undone and will remove all associated data including materials, LCA results, and calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-studio-stale text-studio-cream hover:bg-studio-stale/90"
            >
              {isDeleting ? "Deleting…" : "Delete product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
