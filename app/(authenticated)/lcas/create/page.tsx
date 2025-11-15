"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LcaMaterialClassifier } from "@/components/lca/LcaMaterialClassifier";
import { useOrganization } from "@/lib/organizationContext";
import { supabase } from "@/lib/supabaseClient";
import type { MaterialSelectionOutput, MaterialWithDetails } from "@/lib/types/lca";
import { useIngredients } from "@/hooks/data/useIngredients";
import { usePackagingTypes } from "@/hooks/data/usePackagingTypes";

export default function CreateLcaPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const { ingredients } = useIngredients(organizationId);
  const { packagingTypes } = usePackagingTypes(organizationId);

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [functionalUnit, setFunctionalUnit] = useState("");
  const [materials, setMaterials] = useState<MaterialWithDetails[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<MaterialSelectionOutput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMaterialSelect = (selection: MaterialSelectionOutput) => {
    setCurrentMaterial(selection);
  };

  const handleAddMaterial = () => {
    if (!currentMaterial || currentMaterial.quantity <= 0) {
      return;
    }

    let materialName = "Unknown";

    if (currentMaterial.materialType === "ingredient") {
      const ingredient = ingredients.find((ing) => ing.id === currentMaterial.materialId);
      materialName = ingredient?.name || "Unknown Ingredient";
    } else if (currentMaterial.materialType === "packaging") {
      const packaging = packagingTypes.find((pkg) => pkg.id === currentMaterial.materialId);
      materialName = packaging?.name || "Unknown Packaging";
    }

    const materialWithDetails: MaterialWithDetails = {
      ...currentMaterial,
      name: materialName,
      displayName: materialName,
    };

    setMaterials([...materials, materialWithDetails]);
    setCurrentMaterial(null);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleSaveDraft = async () => {
    if (!organizationId) {
      setError("No organisation selected");
      return;
    }

    if (!productName.trim()) {
      setError("Product name is required");
      return;
    }

    if (!functionalUnit.trim()) {
      setError("Functional unit is required");
      return;
    }

    if (materials.length === 0) {
      setError("Please add at least one material");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: lcaData, error: lcaError } = await supabase
        .from("product_lcas")
        .insert({
          organization_id: organizationId,
          product_name: productName,
          functional_unit: functionalUnit,
          system_boundary: productDescription || "Not specified",
          status: "draft",
        })
        .select()
        .single();

      if (lcaError) {
        throw new Error(`Failed to create LCA: ${lcaError.message}`);
      }

      if (!lcaData) {
        throw new Error("No data returned from LCA creation");
      }

      const productLcaId = lcaData.id;

      const materialsToInsert = materials.map((material) => ({
        product_lca_id: productLcaId,
        material_id: material.materialId,
        material_type: material.materialType,
        quantity: material.quantity,
      }));

      const { error: materialsError } = await supabase
        .from("product_lca_materials")
        .insert(materialsToInsert);

      if (materialsError) {
        throw new Error(`Failed to add materials: ${materialsError.message}`);
      }

      setSuccess(true);

      setTimeout(() => {
        router.push(`/products`);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Error saving LCA draft:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>
            Please select an organisation to create a product LCA.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Product LCA</h1>
        <p className="text-muted-foreground mt-2">
          Define your product and add materials to create a new Life Cycle Assessment
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>
            LCA draft saved successfully! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Basic information about the product being assessed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name *</Label>
            <Input
              id="product-name"
              placeholder="e.g., Organic Coffee Blend 250g"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Product Description</Label>
            <Textarea
              id="product-description"
              placeholder="Optional description of the product..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="functional-unit">Functional Unit *</Label>
            <Input
              id="functional-unit"
              placeholder="e.g., 1 kg, 1 litre, 1 unit"
              value={functionalUnit}
              onChange={(e) => setFunctionalUnit(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              The reference unit for this LCA (e.g., per kilogramme, per litre, per unit)
            </p>
          </div>
        </CardContent>
      </Card>

      <LcaMaterialClassifier
        onMaterialSelect={handleMaterialSelect}
        disabled={isSaving}
      />

      {currentMaterial && currentMaterial.quantity > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleAddMaterial} disabled={isSaving}>
            Add Material to List
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Materials List</CardTitle>
          <CardDescription>
            Materials that have been added to this product LCA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No materials added yet. Use the classifier above to add materials.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {material.displayName || material.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={material.materialType === "ingredient" ? "default" : "secondary"}
                      >
                        {material.materialType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{material.quantity}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(index)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/products")}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveDraft}
          disabled={isSaving || materials.length === 0 || !productName || !functionalUnit}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
      </div>
    </div>
  );
}
