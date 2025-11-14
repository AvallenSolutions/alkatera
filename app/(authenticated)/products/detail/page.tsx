"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { ArrowLeft, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
  updated_at: string;
}

export default function ProductDetailPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    } else {
      setError("No product ID provided");
      setLoading(false);
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) throw error;

      setProduct(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFunctionalUnit = (product: Product) => {
    if (!product.functional_unit_type) return "Not specified";

    return `${product.functional_unit_volume || "?"} ${product.functional_unit_measure || ""} ${product.functional_unit_type}`;
  };

  if (loading) {
    return <PageLoader message="Loading product..." />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Product not found"}</AlertDescription>
        </Alert>
        <Link href="/products" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground mt-1">
            Product LCA Definition
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Core information about this product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.product_image_url && (
                <div className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={product.product_image_url}
                    alt={product.name}
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-base">{product.name}</p>
              </div>

              {product.product_description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm whitespace-pre-wrap">{product.product_description}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Functional Unit</label>
                <p className="text-base">{formatFunctionalUnit(product)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Boundary</CardTitle>
              <CardDescription>Scope of the LCA assessment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {product.system_boundary === "cradle_to_grave" ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-semibold">Cradle-to-Grave</p>
                      <p className="text-sm text-muted-foreground">
                        Complete lifecycle from raw material extraction through end-of-life disposal
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="font-semibold">Cradle-to-Gate</p>
                      <p className="text-sm text-muted-foreground">
                        From raw material extraction to factory gate
                      </p>
                    </div>
                  </>
                )}
              </div>

              {product.system_boundary === "cradle_to_gate" && (
                <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 dark:text-amber-200">
                    This boundary is suitable for internal benchmarking or B2B reporting only.
                    Public-facing claims may violate greenwashing regulations.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {product.system_boundary === "cradle_to_grave" && (
            <Card>
              <CardHeader>
                <CardTitle>Lifecycle Stages</CardTitle>
                <CardDescription>
                  Data collection sections for comprehensive assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Distribution</p>
                      <p className="text-sm text-muted-foreground">
                        Transport and logistics data
                      </p>
                    </div>
                    <Badge variant="outline">Not started</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Retail</p>
                      <p className="text-sm text-muted-foreground">
                        Storage and refrigeration requirements
                      </p>
                    </div>
                    <Badge variant="outline">Not started</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Consumer Use</p>
                      <p className="text-sm text-muted-foreground">
                        Usage patterns and energy consumption
                      </p>
                    </div>
                    <Badge variant="outline">Not started</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">End of Life</p>
                      <p className="text-sm text-muted-foreground">
                        Disposal, recycling, and waste management
                      </p>
                    </div>
                    <Badge variant="outline">Not started</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <label className="text-muted-foreground">Created</label>
                <p>{formatDate(product.created_at)}</p>
              </div>

              <div>
                <label className="text-muted-foreground">Last Updated</label>
                <p>{formatDate(product.updated_at)}</p>
              </div>

              <div>
                <label className="text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant="secondary">Definition Complete</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" disabled>
                Edit Definition
              </Button>
              <Button variant="outline" className="w-full" disabled>
                Begin Data Collection
              </Button>
              <Button variant="outline" className="w-full text-red-600" disabled>
                Delete Product
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
