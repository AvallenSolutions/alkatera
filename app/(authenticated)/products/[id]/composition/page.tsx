"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { UnifiedLcaDataCapture, type IngredientData } from "@/components/lca/UnifiedLcaDataCapture";

interface ComponentData extends IngredientData {
  type: "ingredient" | "packaging";
}

interface ProductData {
  id: number;
  name: string;
  components: ComponentData[];
}

interface CompositionManagerPageProps {
  params: {
    id: string;
  };
}

export default function CompositionManagerPage({ params }: CompositionManagerPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = params.id;
  const viewParam = searchParams.get("view") || "ingredients";

  const [activeTab, setActiveTab] = useState<"ingredients" | "packaging">(
    viewParam === "packaging" ? "packaging" : "ingredients"
  );
  const [product, setProduct] = useState<ProductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<IngredientData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "packaging" || view === "ingredients") {
      setActiveTab(view as "ingredients" | "packaging");
    }
  }, [searchParams]);

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("products")
        .select("id, name, components")
        .eq("id", productId)
        .single();

      if (fetchError) throw fetchError;

      setProduct({
        ...data,
        components: data.components || [],
      });
    } catch (err: any) {
      console.error("Error loading product:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    const newTab = value as "ingredients" | "packaging";
    setActiveTab(newTab);
    router.push(`/products/${productId}/composition?view=${newTab}`);
  };

  const handleAddNew = () => {
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
        toast.error(`Please complete all ${activeTab} names and weights`);
        return;
      }

      const newComponents: ComponentData[] = modalData.map((item) => ({
        ...item,
        type: activeTab === "ingredients" ? "ingredient" : "packaging",
      }));

      const existingComponents = product?.components || [];
      const updatedComponents = [...existingComponents, ...newComponents];

      const { error: updateError } = await supabase
        .from("products")
        .update({
          components: updatedComponents,
          updated_at: new Date().toISOString(),
          [`upstream_${activeTab}_complete`]: updatedComponents.filter(
            (c) => c.type === (activeTab === "ingredients" ? "ingredient" : "packaging")
          ).length > 0,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      toast.success(`Added ${modalData.length} ${activeTab}`);
      setIsModalOpen(false);
      setModalData([]);
      await loadProduct();
    } catch (err: any) {
      console.error("Error saving components:", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    try {
      const updatedComponents = product?.components.filter((c) => c.id !== componentId) || [];

      const { error: updateError } = await supabase
        .from("products")
        .update({
          components: updatedComponents,
          updated_at: new Date().toISOString(),
          [`upstream_${activeTab}_complete`]: updatedComponents.filter(
            (c) => c.type === (activeTab === "ingredients" ? "ingredient" : "packaging")
          ).length > 0,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      toast.success("Component deleted");
      await loadProduct();
    } catch (err: any) {
      console.error("Error deleting component:", err);
      toast.error("Failed to delete component");
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading composition data..." />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Product not found"}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push(`/products/${productId}/hub`)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
        </Button>
      </div>
    );
  }

  const filteredComponents = product.components.filter((c) =>
    activeTab === "ingredients" ? c.type === "ingredient" : c.type === "packaging"
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Composition</h1>
          <p className="text-muted-foreground mt-1">{product.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}/hub`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Components</CardTitle>
          <CardDescription>
            Add and manage ingredients and packaging materials for this product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                <TabsTrigger value="packaging">Packaging</TabsTrigger>
              </TabsList>
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add New {activeTab === "ingredients" ? "Ingredient" : "Packaging"}
              </Button>
            </div>

            <TabsContent value="ingredients" className="space-y-4">
              {filteredComponents.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No ingredients added yet. Click "Add New Ingredient" to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {filteredComponents.map((component) => (
                    <Card key={component.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <p className="font-medium">{component.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {component.weight_kg} kg
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComponent(component.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="packaging" className="space-y-4">
              {filteredComponents.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No packaging materials added yet. Click "Add New Packaging" to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {filteredComponents.map((component) => (
                    <Card key={component.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <p className="font-medium">{component.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {component.weight_kg} kg
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComponent(component.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add {activeTab === "ingredients" ? "Ingredients" : "Packaging Materials"}
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
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveModal}
              disabled={modalData.length === 0 || isSaving}
            >
              {isSaving ? "Saving..." : `Save ${activeTab === "ingredients" ? "Ingredients" : "Packaging"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
