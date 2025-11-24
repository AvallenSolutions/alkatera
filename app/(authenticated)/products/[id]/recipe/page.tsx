"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Leaf,
  Box,
  Info,
  Trash2,
  Building2,
  Database,
  Sprout,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { AssistedIngredientSearch } from "@/components/lca/AssistedIngredientSearch";
import { AssistedPackagingSearch } from "@/components/lca/AssistedPackagingSearch";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
}

interface RecipeItem {
  id: string;
  material_name: string;
  quantity: number;
  unit: string | null;
  material_type: string | null;
  data_source: string | null;
  supplier_product_id?: string | null;
  supplier_name?: string | null;
  carbon_intensity?: number | null;
  origin_country?: string | null;
  is_organic_certified?: boolean;
  packaging_category?: string | null;
  notes?: string | null;
}

export default function ProductRecipePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [product, setProduct] = useState<Product | null>(null);
  const [ingredients, setIngredients] = useState<RecipeItem[]>([]);
  const [packaging, setPackaging] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [subStages, setSubStages] = useState<any[]>([]);

  useEffect(() => {
    if (productId && currentOrganization?.id) {
      fetchProductData();
      fetchSubStages();
    }
  }, [productId, currentOrganization?.id]);

  const fetchProductData = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      setProduct(productData);

      const { data: materialsData, error: materialsError } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (materialsError) throw materialsError;

      const ingredientItems = materialsData?.filter(m => m.material_type === 'ingredient') || [];
      const packagingItems = materialsData?.filter(m => m.material_type === 'packaging') || [];

      setIngredients(ingredientItems);
      setPackaging(packagingItems);
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubStages = async () => {
    try {
      const { data, error } = await supabase
        .from("lca_sub_stages")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setSubStages(data || []);
    } catch (error: any) {
      console.error("Error fetching sub-stages:", error);
    }
  };

  const handleIngredientConfirmed = async (ingredient: {
    name: string;
    data_source: 'openlca' | 'supplier' | 'primary';
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit?: string;
    carbon_intensity?: number;
    quantity?: number;
    lca_sub_stage_id?: string | null;
    origin_country?: string;
    is_organic_certified?: boolean;
  }) => {
    try {
      const materialData = {
        product_id: parseInt(productId),
        material_name: ingredient.name,
        quantity: ingredient.quantity || 0,
        unit: ingredient.unit || 'kg',
        material_type: 'ingredient',
        data_source: ingredient.data_source,
        data_source_id: ingredient.data_source_id || null,
        supplier_product_id: ingredient.supplier_product_id || null,
        supplier_name: ingredient.supplier_name || null,
        carbon_intensity: ingredient.carbon_intensity || null,
        lca_sub_stage_id: ingredient.lca_sub_stage_id || null,
        origin_country: ingredient.origin_country || null,
        is_organic_certified: ingredient.is_organic_certified || false,
      };

      const { error } = await supabase
        .from("product_materials")
        .insert(materialData);

      if (error) throw error;

      toast.success("Ingredient added successfully");
      await fetchProductData();
    } catch (error: any) {
      console.error("Error saving ingredient:", error);
      toast.error("Failed to save ingredient");
    }
  };

  const handlePackagingConfirmed = async (packaging: {
    name: string;
    data_source: 'openlca' | 'supplier' | 'primary';
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    unit?: string;
    carbon_intensity?: number;
    quantity?: number;
    lca_sub_stage_id?: string | null;
    origin_country?: string;
    is_organic_certified?: boolean;
    packaging_category: string;
    label_printing_type?: string;
  }) => {
    try {
      const materialData = {
        product_id: parseInt(productId),
        material_name: packaging.name,
        quantity: packaging.quantity || 0,
        unit: packaging.unit || 'kg',
        material_type: 'packaging',
        data_source: packaging.data_source,
        data_source_id: packaging.data_source_id || null,
        supplier_product_id: packaging.supplier_product_id || null,
        supplier_name: packaging.supplier_name || null,
        carbon_intensity: packaging.carbon_intensity || null,
        lca_sub_stage_id: packaging.lca_sub_stage_id || null,
        packaging_category: packaging.packaging_category,
        label_printing_type: packaging.label_printing_type || null,
        origin_country: packaging.origin_country || null,
        is_organic_certified: packaging.is_organic_certified || false,
      };

      const { error } = await supabase
        .from("product_materials")
        .insert(materialData);

      if (error) throw error;

      toast.success("Packaging added successfully");
      await fetchProductData();
    } catch (error: any) {
      console.error("Error saving packaging:", error);
      toast.error("Failed to save packaging");
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase
        .from("product_materials")
        .delete()
        .eq("id", materialId);

      if (error) throw error;

      toast.success("Material deleted");
      await fetchProductData();
    } catch (err: any) {
      console.error("Error deleting material:", err);
      toast.error("Failed to delete material");
    }
  };

  const getDataSourceIcon = (source: string | null) => {
    switch (source) {
      case 'supplier':
        return <Building2 className="h-3 w-3" />;
      case 'openlca':
        return <Database className="h-3 w-3" />;
      case 'primary':
        return <Sprout className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getDataSourceBadge = (source: string | null) => {
    switch (source) {
      case 'supplier':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs">Supplier</Badge>;
      case 'openlca':
        return <Badge className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100 text-xs">OpenLCA</Badge>;
      case 'primary':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">Primary</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Manual</Badge>;
    }
  };

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

  const formatFunctionalUnit = () => {
    if (product.functional_unit) return product.functional_unit;
    if (product.unit_size_value && product.unit_size_unit) {
      return `${product.unit_size_value} ${product.unit_size_unit}`;
    }
    return "Not specified";
  };

  const getCompletenessPercentage = () => {
    const hasIngredients = ingredients.length > 0;
    const hasPackaging = packaging.length > 0;

    if (hasIngredients && hasPackaging) return 100;
    if (hasIngredients || hasPackaging) return 50;
    return 0;
  };

  const completenessPercent = getCompletenessPercentage();

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">
            {product.sku && `SKU: ${product.sku} · `}
            Functional Unit: {formatFunctionalUnit()}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipe Completeness</CardTitle>
              <CardDescription>Track your bill of materials progress</CardDescription>
            </div>
            <Badge
              variant={completenessPercent === 100 ? "default" : "secondary"}
              className={completenessPercent === 100 ? "bg-green-600" : "bg-amber-600"}
            >
              {completenessPercent}% Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${completenessPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Info className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ingredients">
            <Leaf className="h-4 w-4 mr-2" />
            Ingredients
          </TabsTrigger>
          <TabsTrigger value="packaging">
            <Box className="h-4 w-4 mr-2" />
            Packaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.product_image_url && (
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={product.product_image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{product.name}</span>
                </div>

                {product.sku && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Functional Unit</span>
                  <span className="font-medium">{formatFunctionalUnit()}</span>
                </div>

                {product.product_description && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">{product.product_description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recipe Summary</CardTitle>
              <CardDescription>Bill of materials overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Ingredients</p>
                  <p className="text-sm text-muted-foreground">Raw materials and components</p>
                </div>
                <Badge variant="outline">{ingredients.length} items</Badge>
              </div>

              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Packaging</p>
                  <p className="text-sm text-muted-foreground">Containers and materials</p>
                </div>
                <Badge variant="outline">{packaging.length} items</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingredients</CardTitle>
              <CardDescription>
                Search from suppliers, OpenLCA database, or add custom ingredients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentOrganization?.id && (
                <AssistedIngredientSearch
                  lcaId=""
                  organizationId={currentOrganization.id}
                  subStages={subStages}
                  onIngredientConfirmed={handleIngredientConfirmed}
                />
              )}

              {ingredients.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Added Ingredients ({ingredients.length})</h4>
                  {ingredients.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex-1 flex items-center gap-3">
                        {getDataSourceIcon(item.data_source)}
                        <div className="flex-1">
                          <p className="font-medium">{item.material_name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getDataSourceBadge(item.data_source)}
                            {item.supplier_name && (
                              <span className="text-xs text-muted-foreground">
                                {item.supplier_name}
                              </span>
                            )}
                            {item.carbon_intensity && (
                              <span className="text-xs text-muted-foreground">
                                • {item.carbon_intensity.toFixed(2)} kg CO₂e/{item.unit}
                              </span>
                            )}
                            {item.origin_country && (
                              <span className="text-xs text-muted-foreground">
                                • {item.origin_country}
                              </span>
                            )}
                            {item.is_organic_certified && (
                              <Badge variant="outline" className="text-xs">Organic</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">{item.quantity} {item.unit || 'kg'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMaterial(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Packaging</CardTitle>
              <CardDescription>
                Search from suppliers, OpenLCA database, or add custom packaging materials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentOrganization?.id && (
                <AssistedPackagingSearch
                  lcaId=""
                  organizationId={currentOrganization.id}
                  subStages={subStages}
                  onPackagingConfirmed={handlePackagingConfirmed}
                />
              )}

              {packaging.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Added Packaging ({packaging.length})</h4>
                  {packaging.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex-1 flex items-center gap-3">
                        {getDataSourceIcon(item.data_source)}
                        <div className="flex-1">
                          <p className="font-medium">{item.material_name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getDataSourceBadge(item.data_source)}
                            {item.packaging_category && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {item.packaging_category}
                              </Badge>
                            )}
                            {item.supplier_name && (
                              <span className="text-xs text-muted-foreground">
                                {item.supplier_name}
                              </span>
                            )}
                            {item.carbon_intensity && (
                              <span className="text-xs text-muted-foreground">
                                • {item.carbon_intensity.toFixed(2)} kg CO₂e/{item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">{item.quantity} {item.unit || 'kg'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMaterial(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
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
