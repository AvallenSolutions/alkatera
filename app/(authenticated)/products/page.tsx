"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Plus, Package, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";

interface Product {
  id: string;
  name: string;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit_type: string | null;
  functional_unit_volume: number | null;
  functional_unit_measure: string | null;
  system_boundary: string;
  created_at: string;
}

export default function ProductsPage() {
  const { currentOrganization } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data || []);
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
    if (!product.functional_unit_type) return "Not specified";

    return `${product.functional_unit_volume || "?"} ${product.functional_unit_measure || ""} ${product.functional_unit_type}`;
  };

  const getBoundaryBadge = (boundary: string) => {
    if (boundary === "cradle_to_grave") {
      return (
        <Badge variant="default" className="bg-green-600">
          Cradle-to-Grave
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-600 text-white">
        Cradle-to-Gate
      </Badge>
    );
  };

  if (loading) {
    return <PageLoader message="Loading products..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product LCAs</h1>
          <p className="text-muted-foreground mt-2">
            Define and manage product life cycle assessments
          </p>
        </div>
        <Link href="/products/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            New Product LCA
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No products found. Create your first product LCA to get started.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  {product.product_image_url ? (
                    <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={product.product_image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
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
                    {getBoundaryBadge(product.system_boundary)}
                  </div>

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Created {formatDate(product.created_at)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
