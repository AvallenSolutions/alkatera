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
  Package,
  Plus,
  Leaf,
  Box,
  Info,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { UnifiedLcaDataCapture, type IngredientData } from "@/components/lca/UnifiedLcaDataCapture";

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
  origin_country?: string | null;
  is_organic_certified?: boolean;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"ingredient" | "packaging">("ingredient");
  const [modalData, setModalData] = useState<IngredientData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
        .eq("product_id", productId);

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

  const handleOpenModal = (type: "ingredient" | "packaging") => {
    setModalType(type);
    setModalData([]);
    setIsModalOpen(true);
  };

  const handleDataChange = (ingredients: IngredientData[]) => {
    setModalData(ingredients);
  };

  const handleSaveModal = async () => {
    try {
      setIsSaving(true);

      const invalidItems = modalData.filter(
        (item) => !item.name.trim() || item.weight_kg <= 0
      );

      if (invalidItems.length > 0) {
        toast.error(`Please complete all ${modalType} names and weights`);
        return;
      }

      // Transform the modal data to match product_materials schema
      const materialsToInsert = modalData.map((item) => ({
        product_id: parseInt(productId),
        material_name: item.name,
        quantity: item.weight_kg,
        unit: "kg",
        material_type: modalType,
        data_source: "manual",
        origin_country: null,
        is_organic_certified: false,
        notes: null,
      }));

      const { error: insertError } = await supabase
        .from("product_materials")
        .insert(materialsToInsert);

      if (insertError) throw insertError;

      toast.success(`Added ${modalData.length} ${modalType}${modalData.length > 1 ? 's' : ''}`);
      setIsModalOpen(false);
      setModalData([]);
      await fetchProductData();
    } catch (err: any) {
      console.error("Error saving materials:", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ingredients</CardTitle>
                  <CardDescription>Raw materials and components</CardDescription>
                </div>
                <Button onClick={() => handleOpenModal("ingredient")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ingredients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Leaf className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Ingredients Added</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building your recipe by adding ingredients from suppliers or the global database
                  </p>
                  <Button onClick={() => handleOpenModal("ingredient")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Ingredient
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.material_name}</p>
                        {item.data_source && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.data_source}
                            </Badge>
                            {item.origin_country && (
                              <span className="text-xs text-muted-foreground">
                                {item.origin_country}
                              </span>
                            )}
                          </div>
                        )}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Packaging</CardTitle>
                  <CardDescription>Containers and materials</CardDescription>
                </div>
                <Button onClick={() => handleOpenModal("packaging")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Packaging
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packaging.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Box className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Packaging Added</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Define your packaging materials and components
                  </p>
                  <Button onClick={() => handleOpenModal("packaging")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Packaging Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {packaging.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.material_name}</p>
                        {item.data_source && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.data_source}
                            </Badge>
                            {item.origin_country && (
                              <span className="text-xs text-muted-foreground">
                                {item.origin_country}
                              </span>
                            )}
                          </div>
                        )}
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add {modalType === "ingredient" ? "Ingredients" : "Packaging Materials"}
            </DialogTitle>
            <DialogDescription>
              Enter component details and environmental impact metrics
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <UnifiedLcaDataCapture
              initialIngredients={modalData}
              onDataChange={handleDataChange}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveModal}
              disabled={modalData.length === 0 || isSaving}
            >
              {isSaving ? "Saving..." : `Save ${modalType === "ingredient" ? "Ingredients" : "Packaging"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
