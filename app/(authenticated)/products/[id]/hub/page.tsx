"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { CheckCircle2, Circle, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";

interface ProductData {
  id: number;
  organization_id: string;
  name: string;
  sku: string | null;
  functional_unit: string | null;
  components: any[];
  upstream_ingredients_complete: boolean;
  upstream_packaging_complete: boolean;
  core_operations_complete: boolean;
  downstream_distribution_complete: boolean;
  use_end_of_life_complete: boolean;
}

interface ProductHubPageProps {
  params: {
    id: string;
  };
}

export default function ProductHubPage({ params }: ProductHubPageProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const productId = params.id;

  const [product, setProduct] = useState<ProductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState({
    name: "",
    sku: "",
    functional_unit: "",
  });

  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (fetchError) throw fetchError;

      setProduct(data);
      setEditedFields({
        name: data.name || "",
        sku: data.sku || "",
        functional_unit: data.functional_unit || "",
      });
    } catch (err: any) {
      console.error("Error loading product:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSave = useCallback(
    (field: string, value: string) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      const timeout = setTimeout(async () => {
        try {
          setIsSaving(true);

          const { error: updateError } = await supabase
            .from("products")
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", productId);

          if (updateError) throw updateError;

          setProduct((prev) => (prev ? { ...prev, [field]: value } : null));
          toast.success("Saved");
        } catch (err: any) {
          console.error("Error saving:", err);
          toast.error("Failed to save");
        } finally {
          setIsSaving(false);
        }
      }, 800);

      setSaveTimeout(timeout);
    },
    [productId, saveTimeout]
  );

  const handleFieldChange = (field: keyof typeof editedFields, value: string) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
    debouncedSave(field, value);
  };

  if (isLoading) {
    return <PageLoader message="Loading product hub..." />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>{error || "Product not found"}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/dashboard/products")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
      </div>
    );
  }

  const tasks = [
    {
      label: "Upstream: Ingredients",
      href: `/products/${productId}/composition?view=ingredients`,
      complete: product.upstream_ingredients_complete,
    },
    {
      label: "Upstream: Packaging",
      href: `/products/${productId}/composition?view=packaging`,
      complete: product.upstream_packaging_complete,
    },
    {
      label: "Core Operations",
      href: `/products/${productId}/core-operations`,
      complete: product.core_operations_complete,
    },
    {
      label: "Downstream: Distribution",
      href: `/products/${productId}/distribution`,
      complete: product.downstream_distribution_complete,
    },
    {
      label: "Use & End of Life",
      href: `/products/${productId}/end-of-life`,
      complete: product.use_end_of_life_complete,
    },
  ];

  const completedCount = tasks.filter((t) => t.complete).length;
  const totalCount = tasks.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product LCA Hub</h1>
          <p className="text-muted-foreground mt-1">
            Central dashboard for managing product lifecycle assessment
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Information</CardTitle>
            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
          </div>
          <CardDescription>Edit fields to auto-save changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={editedFields.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter product name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={editedFields.sku}
                onChange={(e) => handleFieldChange("sku", e.target.value)}
                placeholder="Enter SKU"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="functional_unit">Functional Unit</Label>
              <Input
                id="functional_unit"
                value={editedFields.functional_unit}
                onChange={(e) => handleFieldChange("functional_unit", e.target.value)}
                placeholder="e.g., 1 litre, 1 kg"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LCA Completion Progress</CardTitle>
          <CardDescription>
            {completedCount} of {totalCount} sections complete ({completionPercentage}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Link key={task.href} href={task.href}>
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  {task.complete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{task.label}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {task.complete ? "Complete" : "Incomplete"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/products/${productId}/composition?view=ingredients`)}
          >
            Manage Ingredients
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/products/${productId}/composition?view=packaging`)}
          >
            Manage Packaging
          </Button>
          <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
            View Product Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
