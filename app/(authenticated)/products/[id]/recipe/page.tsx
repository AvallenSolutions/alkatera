"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Leaf,
  Box,
  Info,
  Plus,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { IngredientFormCard, IngredientFormData } from "@/components/products/IngredientFormCard";
import { PackagingFormCard, PackagingFormData } from "@/components/products/PackagingFormCard";

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

export default function ProductRecipePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [ingredientForms, setIngredientForms] = useState<IngredientFormData[]>([
    {
      tempId: `temp-${Date.now()}`,
      name: '',
      data_source: null,
      amount: '',
      unit: 'kg',
      origin_country: '',
      is_organic_certified: false,
      transport_mode: 'truck',
      distance_km: '',
    }
  ]);

  const [packagingForms, setPackagingForms] = useState<PackagingFormData[]>([
    {
      tempId: `temp-pkg-${Date.now()}`,
      name: '',
      data_source: null,
      amount: '',
      unit: 'kg',
      packaging_category: null,
      label_printing_type: '',
      transport_mode: 'truck',
      distance_km: '',
    }
  ]);

  useEffect(() => {
    if (productId && currentOrganization?.id) {
      fetchProductData();
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

      if (ingredientItems.length > 0) {
        setIngredientForms(ingredientItems.map(item => ({
          tempId: item.id,
          name: item.material_name,
          data_source: item.data_source as any,
          data_source_id: item.data_source_id,
          supplier_product_id: item.supplier_product_id,
          supplier_name: item.supplier_name,
          amount: item.quantity,
          unit: item.unit || 'kg',
          origin_country: item.origin_country || '',
          is_organic_certified: item.is_organic_certified || false,
          transport_mode: 'truck',
          distance_km: '',
          carbon_intensity: item.carbon_intensity,
        })));
      }

      if (packagingItems.length > 0) {
        setPackagingForms(packagingItems.map(item => ({
          tempId: item.id,
          name: item.material_name,
          data_source: item.data_source as any,
          data_source_id: item.data_source_id,
          supplier_product_id: item.supplier_product_id,
          supplier_name: item.supplier_name,
          amount: item.quantity,
          unit: item.unit || 'kg',
          packaging_category: item.packaging_category as any,
          label_printing_type: item.label_printing_type || '',
          transport_mode: 'truck',
          distance_km: '',
          carbon_intensity: item.carbon_intensity,
        })));
      }
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  };

  const updateIngredient = (tempId: string, updates: Partial<IngredientFormData>) => {
    setIngredientForms(prev =>
      prev.map(form => form.tempId === tempId ? { ...form, ...updates } : form)
    );
  };

  const removeIngredient = (tempId: string) => {
    if (ingredientForms.length > 1) {
      setIngredientForms(prev => prev.filter(form => form.tempId !== tempId));
    }
  };

  const addIngredient = () => {
    setIngredientForms(prev => [
      ...prev,
      {
        tempId: `temp-${Date.now()}`,
        name: '',
        data_source: null,
        amount: '',
        unit: 'kg',
        origin_country: '',
        is_organic_certified: false,
        transport_mode: 'truck',
        distance_km: '',
      }
    ]);
  };

  const updatePackaging = (tempId: string, updates: Partial<PackagingFormData>) => {
    setPackagingForms(prev =>
      prev.map(form => form.tempId === tempId ? { ...form, ...updates } : form)
    );
  };

  const removePackaging = (tempId: string) => {
    if (packagingForms.length > 1) {
      setPackagingForms(prev => prev.filter(form => form.tempId !== tempId));
    }
  };

  const addPackaging = () => {
    setPackagingForms(prev => [
      ...prev,
      {
        tempId: `temp-pkg-${Date.now()}`,
        name: '',
        data_source: null,
        amount: '',
        unit: 'kg',
        packaging_category: null,
        label_printing_type: '',
        transport_mode: 'truck',
        distance_km: '',
      }
    ]);
  };

  const saveIngredients = async () => {
    const validForms = ingredientForms.filter(f => f.name && f.amount && Number(f.amount) > 0);

    if (validForms.length === 0) {
      toast.error("Please add at least one valid ingredient");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId)
        .eq("material_type", "ingredient");

      const materialsToInsert = validForms.map(form => ({
        product_id: parseInt(productId),
        material_name: form.name,
        quantity: Number(form.amount),
        unit: form.unit,
        material_type: 'ingredient',
        data_source: form.data_source,
        data_source_id: form.data_source_id || null,
        supplier_product_id: form.supplier_product_id || null,
        supplier_name: form.supplier_name || null,
        carbon_intensity: form.carbon_intensity || null,
        origin_country: form.origin_country || null,
        is_organic_certified: form.is_organic_certified,
      }));

      const { error } = await supabase
        .from("product_materials")
        .insert(materialsToInsert);

      if (error) throw error;

      toast.success("Ingredients saved successfully");
      await fetchProductData();
    } catch (error: any) {
      console.error("Error saving ingredients:", error);
      toast.error("Failed to save ingredients");
    } finally {
      setSaving(false);
    }
  };

  const savePackaging = async () => {
    const validForms = packagingForms.filter(
      f => f.name && f.amount && Number(f.amount) > 0 && f.packaging_category
    );

    if (validForms.length === 0) {
      toast.error("Please add at least one valid packaging item");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId)
        .eq("material_type", "packaging");

      const materialsToInsert = validForms.map(form => ({
        product_id: parseInt(productId),
        material_name: form.name,
        quantity: Number(form.amount),
        unit: form.unit,
        material_type: 'packaging',
        data_source: form.data_source,
        data_source_id: form.data_source_id || null,
        supplier_product_id: form.supplier_product_id || null,
        supplier_name: form.supplier_name || null,
        carbon_intensity: form.carbon_intensity || null,
        packaging_category: form.packaging_category,
        label_printing_type: form.label_printing_type || null,
      }));

      const { error } = await supabase
        .from("product_materials")
        .insert(materialsToInsert);

      if (error) throw error;

      toast.success("Packaging saved successfully");
      await fetchProductData();
    } catch (error: any) {
      console.error("Error saving packaging:", error);
      toast.error("Failed to save packaging");
    } finally {
      setSaving(false);
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

  const ingredientCount = ingredientForms.filter(f => f.name && f.amount).length;
  const packagingCount = packagingForms.filter(f => f.name && f.amount && f.packaging_category).length;
  const totalItems = ingredientCount + packagingCount;

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
            <Badge variant={totalItems > 0 ? "default" : "secondary"} className="bg-green-600">
              {totalItems} {totalItems === 1 ? 'Item' : 'Items'} Added
            </Badge>
          </div>
        </CardHeader>
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
                <Badge variant="outline">{ingredientCount} items</Badge>
              </div>

              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Packaging</p>
                  <p className="text-sm text-muted-foreground">Containers and materials</p>
                </div>
                <Badge variant="outline">{packagingCount} items</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle>Recipe & Ingredients</CardTitle>
                  <CardDescription>
                    Select ingredients from our OpenLCA database for automated environmental impact calculations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                  <strong>Automated Environmental Data</strong>
                  <br />
                  Ingredients selected below will automatically use OpenLCA ecoinvent database for scientifically validated environmental impact calculations including water footprint, carbon emissions, and land use.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {ingredientForms.map((ingredient, index) => (
                  <IngredientFormCard
                    key={ingredient.tempId}
                    ingredient={ingredient}
                    index={index}
                    organizationId={currentOrganization?.id || ''}
                    onUpdate={updateIngredient}
                    onRemove={removeIngredient}
                    canRemove={ingredientForms.length > 1}
                  />
                ))}
              </div>

              <Button
                onClick={addIngredient}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Ingredient ({ingredientCount}/{ingredientForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveIngredients} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Ingredients'}
                </Button>
                <Button variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Box className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle>Packaging Materials</CardTitle>
                  <CardDescription>
                    Select packaging from our OpenLCA database for automated environmental impact calculations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                  <strong>Automated Environmental Data</strong>
                  <br />
                  Packaging materials selected below will automatically use OpenLCA ecoinvent database for scientifically validated environmental impact calculations including carbon footprint and recyclability metrics.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {packagingForms.map((packaging, index) => (
                  <PackagingFormCard
                    key={packaging.tempId}
                    packaging={packaging}
                    index={index}
                    organizationId={currentOrganization?.id || ''}
                    onUpdate={updatePackaging}
                    onRemove={removePackaging}
                    canRemove={packagingForms.length > 1}
                  />
                ))}
              </div>

              <Button
                onClick={addPackaging}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Packaging ({packagingCount}/{packagingForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={savePackaging} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Packaging'}
                </Button>
                <Button variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
