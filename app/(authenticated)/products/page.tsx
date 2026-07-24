"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from 'next/dynamic';
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import Link from "next/link";
import { UniversalDropzone } from "@/components/layouts/UniversalDropzone";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { PillButton } from "@/components/studio/pill-button";
import { MonoSwitch, MonoToggle } from "@/components/studio/mono-switch";
import { ProductCard } from "@/components/products/ProductCard";
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { PageLoader } from "@/components/ui/page-loader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// Round 4 (auto-research): import wizard is a modal (open-gated), so defer it.
const WebsiteImportFlow = dynamic(() => import("@/components/products/WebsiteImportFlow").then((m) => m.WebsiteImportFlow), { ssr: false });
import { Search } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { duplicateProduct } from "@/lib/products";
import { deleteProduct, ProductInUseError } from "@/lib/products/delete-product";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/organizationContext";
import { useSubscription } from "@/hooks/useSubscription";
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
import { buildPortfolioPoints, type PortfolioResult } from "@/lib/products/portfolio";
import type { CellarProductRow } from "@/app/api/cellar/products/route";

const VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'portfolio', label: 'Portfolio' },
] as const;

export default function ProductsPage() {
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const { isReadOnly } = useSubscription();
  const [products, setProducts] = useState<CellarProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<CellarProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bringInOpen, setBringInOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);
  const [view, setView] = useState<'list' | 'portfolio'>('list');
  const [matchCount, setMatchCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [findingMatches, setFindingMatches] = useState(false);

  // One request: /api/cellar/products assembles the rows server-side. This
  // page used to make four sequential browser round trips and stitch three
  // Maps together before it could render anything.
  const fetchProducts = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const params = new URLSearchParams({ organization_id: currentOrganization.id });
      if (showArchived) params.set('archived', '1');
      const res = await fetch(`/api/cellar/products?${params.toString()}`);
      if (!res.ok) throw new Error('Could not load the products');
      const body = await res.json();
      const rows: CellarProductRow[] = body.products ?? [];
      setProducts(rows);

      setPortfolio(
        buildPortfolioPoints(
          rows
            .filter((p) => p.footprint_per_unit != null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              perUnitKgCo2e: p.footprint_per_unit,
              annualVolume: p.annual_volume,
              functionalUnit: p.unit_size_unit ?? p.functional_unit ?? null,
            })),
        ),
      );
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, showArchived]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, fetchProducts]);

  // Tell Rosa what's on this list so she can answer questions like
  // "which of my products don't have an LCA yet?" or "what's my newest
  // product?" without making a separate query.
  const rosaSlice = useMemo(() => {
    if (!currentOrganization?.id) return null;
    const productSummaries = products.map((p) => ({
      name: p.name,
      functional_unit: p.functional_unit,
      boundary: p.pcf_boundary,
      has_lca: p.latest_pcf_status != null,
    }));
    const without = productSummaries.filter((p) => !p.has_lca);
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

  const loadMatchCount = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const res = await fetch(`/api/products/ingredient-matches?organization_id=${currentOrganization.id}`);
      const body = await res.json().catch(() => ({}));
      setMatchCount(res.ok ? (body.suggestions?.length ?? 0) : 0);
    } catch {
      // non-fatal
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadMatchCount();
  }, [loadMatchCount]);

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

  const handleDeleteClick = (product: CellarProductRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDuplicateClick = async (product: CellarProductRow, e: React.MouseEvent) => {
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
      // The shared helper carries the multipack guard and clears materials and
      // footprints first. This page used to delete the product row on its own,
      // which cascaded it out of every multipack that contained it.
      await deleteProduct(getSupabaseBrowserClient() as any, productToDelete.id);
      toast.success(`"${productToDelete.name}" deleted.`);
      await fetchProducts();
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(
        error instanceof ProductInUseError
          ? error.message
          : error.message || "Failed to delete product",
      );
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
      product.unit_size_unit?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <PageLoader message="Loading products..." />;
  }

  // Compose is the front door: pick a liquid, pick a pack, and the product
  // inherits the recipe and the specs rather than asking for forty fields
  // again. The long form stays one quiet link away for the edge cases.
  const addProduct = isReadOnly ? (
    <PillButton variant="room" href="/complete-subscription">
      Subscribe to add
    </PillButton>
  ) : (
    <PillButton variant="room" href="/products/new/compose">
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
                <Link href="/products/new" className={rowClasses} onClick={() => setBringInOpen(false)}>
                  <span className="block text-sm font-medium text-foreground">One from scratch</span>
                  <span className="block text-xs text-muted-foreground">
                    The long form, for anything unusual
                  </span>
                </Link>
              </PopoverContent>
            </Popover>
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
        <div className="flex flex-col gap-3 border-b border-studio-hairline sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="SEARCH THE RANGE"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search the range"
              className="w-full bg-transparent py-2 pl-6 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
          {/* Scrolls rather than clips: on a 375px screen the four controls do
              not fit, and the last one was cut off at the edge. */}
          <div className="-mx-4 flex items-center gap-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <MonoSwitch options={VIEWS} value={view} onChange={setView} label="View" />
            <MonoToggle label="Archived" pressed={showArchived} onChange={setShowArchived} />
            {/* Discovery is one quiet act, not a header button: the nudge row
                above is the loud form, and it only appears when there is
                something to review. */}
            <button
              type="button"
              onClick={findSupplierMatches}
              disabled={findingMatches}
              className="whitespace-nowrap py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
            >
              {findingMatches ? 'Looking…' : 'Find supplier matches'}
            </button>
          </div>
        </div>
      )}

      <FlagThresholdBanner />

      {products.length > 0 && view === 'portfolio' && portfolio && (
        <ProductPortfolioMatrix data={portfolio} />
      )}

      {products.length === 0 ? (
        <div className="space-y-4 py-6">
          <p className="max-w-md text-sm text-muted-foreground">
            Nothing in the cellar yet. Add your first product, or bring a batch in from a website or
            spreadsheet.
          </p>
          {addProduct}
        </div>
      ) : view !== 'list' ? null : filteredProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing matches &ldquo;{searchQuery}&rdquo;. Try a different search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              duplicating={duplicatingId === product.id}
              onDuplicate={handleDuplicateClick}
              onDelete={handleDeleteClick}
            />
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
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{productToDelete?.name}&quot;? This cannot be undone. Its ingredients,
              packaging and footprints go with it.
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
