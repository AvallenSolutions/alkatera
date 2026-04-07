"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Input } from "@/components/ui/input";
import { Plus, Package, AlertCircle, Trash2, MoreVertical, Search, Leaf, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
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
  created_at: string;
}

export default function ProductsPage() {
  const { currentOrganization } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

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

      setProducts(
        (data || []).map((p: any) => ({
          ...p,
          product_carbon_footprints: pcfBoundaryMap.has(String(p.id))
            ? [{ system_boundary: pcfBoundaryMap.get(String(p.id))! }]
            : [],
        }))
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
        <Link href="/products/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Add New Product
          </Button>
        </Link>
      </div>

      {products.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search products by name, description, or functional unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <FlagThresholdBanner />

      {products.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <Leaf className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Build Your Product Portfolio</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Products are at the heart of your sustainability story. Create your first one and I&apos;ll walk you through building its lifecycle assessment.
            </p>
            <Button asChild size="lg" className="gap-2 bg-neon-lime text-black hover:bg-neon-lime/90">
              <Link href="/products/new">
                Create Your First Product <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
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

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Created {formatDate(product.created_at)}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
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
