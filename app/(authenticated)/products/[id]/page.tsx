"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Package,
  AlertCircle,
  Plus,
  FileText,
  Boxes,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { LatestLCAResults } from "@/components/products/LatestLCAResults";
import { ProductActions } from "@/components/products/ProductActions";
import { DownloadLCAButton } from "@/components/products/DownloadLCAButton";

interface Product {
  id: string;
  name: string;
  sku: string | null;
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
  calculation_log?: {
    response_data: any;
    created_at: string;
  } | null;
}

interface LatestLCAData {
  lcaId: string | null;
  totalCo2e: number | null;
  unit: string | null;
  calculatedAt: string | null;
  status: string | null;
  lcaVersion: string | null;
  scopeType: string | null;
}

interface DraftLCAData {
  hasDraft: boolean;
  draftLcaId: string | null;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [product, setProduct] = useState<Product | null>(null);
  const [materials, setMaterials] = useState<ProductMaterial[]>([]);
  const [lcas, setLcas] = useState<ProductLCA[]>([]);
  const [latestLca, setLatestLca] = useState<LatestLCAData>({
    lcaId: null,
    totalCo2e: null,
    unit: null,
    calculatedAt: null,
    status: null,
    lcaVersion: null,
    scopeType: null,
  });
  const [draftLca, setDraftLca] = useState<DraftLCAData>({
    hasDraft: false,
    draftLcaId: null,
  });
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

      const [productRes, materialsRes, lcasRes, latestLcaRes, draftLcaRes] = await Promise.all([
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
          .order("created_at", { ascending: false }),
        supabase
          .from("product_lcas")
          .select(`
            id,
            status,
            lca_version,
            lca_scope_type,
            product_lca_calculation_logs!inner(
              response_data,
              created_at,
              status
            )
          `)
          .eq("product_id", productId)
          .eq("status", "completed")
          .eq("product_lca_calculation_logs.status", "success")
          .order("product_lca_calculation_logs.created_at", { ascending: false, foreignTable: "product_lca_calculation_logs" })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("product_lcas")
          .select("id")
          .eq("product_id", productId)
          .eq("is_draft", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (productRes.error) throw productRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (lcasRes.error) throw lcasRes.error;

      setProduct(productRes.data);
      setMaterials(materialsRes.data || []);
      setLcas(lcasRes.data || []);

      if (latestLcaRes.data && latestLcaRes.data.product_lca_calculation_logs) {
        const logs = latestLcaRes.data.product_lca_calculation_logs as any[];
        if (logs.length > 0) {
          const log = logs[0];
          const summary = log.response_data?.summary;
          setLatestLca({
            lcaId: latestLcaRes.data.id,
            totalCo2e: summary?.total_co2e || null,
            unit: summary?.unit || null,
            calculatedAt: log.created_at,
            status: latestLcaRes.data.status,
            lcaVersion: latestLcaRes.data.lca_version || null,
            scopeType: latestLcaRes.data.lca_scope_type || null,
          });
        }
      }

      if (draftLcaRes.data) {
        setDraftLca({
          hasDraft: true,
          draftLcaId: draftLcaRes.data.id,
        });
      }
    } catch (err: any) {
      console.error("Error fetching product data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLCAsWithResults = async () => {
    try {
      const { data, error } = await supabase
        .from("product_lcas")
        .select(`
          id,
          product_name,
          created_at,
          status,
          product_lca_calculation_logs(
            response_data,
            created_at,
            status
          )
        `)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enrichedLcas = (data || []).map((lca: any) => ({
        id: lca.id,
        product_name: lca.product_name,
        created_at: lca.created_at,
        status: lca.status,
        calculation_log: lca.product_lca_calculation_logs?.find((log: any) => log.status === "success") || null,
      }));

      setLcas(enrichedLcas);
    } catch (err: any) {
      console.error("Error fetching LCAs with results:", err);
    }
  };

  useEffect(() => {
    if (productId && !loading) {
      fetchLCAsWithResults();
    }
  }, [productId, loading]);

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
              {product.sku && (
                <div>
                  <p className="text-sm text-muted-foreground">SKU</p>
                  <p className="text-base font-medium">{product.sku}</p>
                </div>
              )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LatestLCAResults
            productId={productId}
            lcaId={latestLca.lcaId}
            totalCo2e={latestLca.totalCo2e}
            unit={latestLca.unit}
            calculatedAt={latestLca.calculatedAt}
            status={latestLca.status}
            lcaVersion={latestLca.lcaVersion}
            scopeType={latestLca.scopeType}
            hasDraft={draftLca.hasDraft}
            draftLcaId={draftLca.draftLcaId}
          />
        </div>

        <div>
          {currentOrganization && (
            <ProductActions
              productId={productId}
              productName={product.name}
              organizationId={currentOrganization.id}
            />
          )}
        </div>
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
                  {lcas.map((lca) => {
                    const co2eValue = lca.calculation_log?.response_data?.summary?.total_co2e;
                    const unit = lca.calculation_log?.response_data?.summary?.unit;

                    return (
                      <div
                        key={lca.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{lca.product_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>Created {formatDate(lca.created_at)}</span>
                            {co2eValue && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground">
                                  {co2eValue.toFixed(2)} {unit || "kg CO2e"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{lca.status || "draft"}</Badge>
                          {lca.status === "completed" && (
                            <DownloadLCAButton
                              lcaId={lca.id}
                              productName={product.name}
                            />
                          )}
                          <Link href={`/dashboard/lcas/${lca.id}/results`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
