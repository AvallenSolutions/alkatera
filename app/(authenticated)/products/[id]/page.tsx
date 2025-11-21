"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Package,
  AlertCircle,
  Edit,
  Plus,
  FileText,
  Boxes
} from "lucide-react";
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

interface ProductMaterial {
  id: string;
  material_name: string;
  quantity: number;
  unit: string | null;
  material_type: string | null;
  lca_stage_id: string | null;
  data_source: string | null;
  origin_country: string | null;
  is_organic_certified: boolean;
}

interface ProductLCA {
  id: string;
  product_name: string;
  created_at: string;
  status: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [materials, setMaterials] = useState<ProductMaterial[]>([]);
  const [lcas, setLcas] = useState<ProductLCA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchProductData();
    }
  }, [productId]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productRes, materialsRes, lcasRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single(),
        supabase
          .from("product_materials")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true }),
        supabase
          .from("product_lcas")
          .select("id, product_name, created_at, status")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
      ]);

      if (productRes.error) throw productRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (lcasRes.error) throw lcasRes.error;

      setProduct(productRes.data);
      setMaterials(materialsRes.data || []);
      setLcas(lcasRes.data || []);
    } catch (err: any) {
      console.error("Error fetching product data:", err);
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
    });
  };

  const formatFunctionalUnit = (product: Product) => {
    if (!product.functional_unit_type) return "Not specified";
    return `${product.functional_unit_volume || "?"} ${product.functional_unit_measure || ""} ${product.functional_unit_type}`;
  };

  const getBoundaryBadge = (boundary: string) => {
    if (boundary === "cradle_to_grave") {
      return <Badge className="bg-green-600">Cradle-to-Grave</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-600 text-white">Cradle-to-Gate</Badge>;
  };

  if (loading) {
    return <PageLoader message="Loading product details..." />;
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Product not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
        <div className="flex gap-2">
          <Link href={`/products/${productId}/materials`}>
            <Button variant="outline">
              <Boxes className="mr-2 h-4 w-4" />
              Manage Materials
            </Button>
          </Link>
          <Link href={`/products/${productId}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Product Image</CardTitle>
          </CardHeader>
          <CardContent>
            {product.product_image_url ? (
              <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={product.product_image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-2xl">{product.name}</CardTitle>
            <CardDescription>
              {product.product_description || "No description provided"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Functional Unit</p>
                <p className="text-base font-medium">{formatFunctionalUnit(product)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Boundary</p>
                <div className="mt-1">{getBoundaryBadge(product.system_boundary)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-base font-medium">{formatDate(product.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-base font-medium">{formatDate(product.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="materials" className="space-y-4">
        <TabsList>
          <TabsTrigger value="materials">
            <Boxes className="mr-2 h-4 w-4" />
            Materials ({materials.length})
          </TabsTrigger>
          <TabsTrigger value="lcas">
            <FileText className="mr-2 h-4 w-4" />
            LCA Calculations ({lcas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Master Bill of Materials</CardTitle>
                  <CardDescription>
                    Default materials template for new LCA calculations
                  </CardDescription>
                </div>
                <Link href={`/products/${productId}/materials`}>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No materials defined yet. Add materials to create a template for LCA calculations.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{material.material_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {material.quantity} {material.unit || "units"}
                          {material.material_type && ` • ${material.material_type}`}
                          {material.origin_country && ` • ${material.origin_country}`}
                        </p>
                      </div>
                      {material.is_organic_certified && (
                        <Badge variant="secondary" className="ml-2">
                          Organic
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lcas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LCA Calculations</CardTitle>
                  <CardDescription>
                    Historical life cycle assessment calculations for this product
                  </CardDescription>
                </div>
                <Link href={`/lca/new?product_id=${productId}`}>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New LCA
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {lcas.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No LCA calculations yet. Create your first LCA to calculate environmental impact.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {lcas.map((lca) => (
                    <Link
                      key={lca.id}
                      href={`/dashboard/lcas/${lca.id}/results`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer">
                        <div className="flex-1">
                          <p className="font-medium">{lca.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Created {formatDate(lca.created_at)}
                          </p>
                        </div>
                        <Badge variant="secondary">{lca.status || "draft"}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
