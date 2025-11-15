"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MaterialRow, type Material } from "@/components/lca/MaterialRow";

interface ProductLcaFormData {
  product_name: string;
  product_description: string;
  materials: Material[];
}

export default function CreateLcaPage() {
  const [formData, setFormData] = useState<ProductLcaFormData>({
    product_name: "",
    product_description: "",
    materials: [],
  });

  const handleProductNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, product_name: value }));
  };

  const handleProductDescriptionChange = (value: string) => {
    setFormData((prev) => ({ ...prev, product_description: value }));
  };

  const handleAddMaterial = () => {
    const newMaterial: Material = {
      id: `material-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "",
      quantity: 0,
      unit: "",
      lca_sub_stage_id: null,
    };

    setFormData((prev) => ({
      ...prev,
      materials: [...prev.materials, newMaterial],
    }));
  };

  const handleUpdateMaterial = (
    id: string,
    field: keyof Material,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.map((material) =>
        material.id === id ? { ...material, [field]: value } : material
      ),
    }));
  };

  const handleRemoveMaterial = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => material.id !== id),
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Product LCA</CardTitle>
          <CardDescription>
            Define your product and classify its materials according to life cycle assessment stages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={formData.product_name}
                onChange={(e) => handleProductNameChange(e.target.value)}
                placeholder="e.g., Premium Organic Coffee Blend"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Product Description</Label>
              <Textarea
                id="product-description"
                value={formData.product_description}
                onChange={(e) => handleProductDescriptionChange(e.target.value)}
                placeholder="Describe the product, its features, and intended use..."
                rows={4}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Ingredients & Materials</h3>
                <p className="text-sm text-muted-foreground">
                  Add all materials and classify them by life cycle stage
                </p>
              </div>
              <Button onClick={handleAddMaterial} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Material
              </Button>
            </div>

            {formData.materials.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-centre">
                <div className="flex flex-col items-centre justify-centre space-y-3">
                  <div className="rounded-full bg-muted p-3">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No materials added yet</p>
                    <p className="text-xs text-muted-foreground">
                      Click "Add Material" to begin building your product LCA
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.materials.map((material, index) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    index={index}
                    onUpdate={handleUpdateMaterial}
                    onRemove={handleRemoveMaterial}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-between items-centre pt-4">
            <div className="text-sm text-muted-foreground">
              {formData.materials.length} material
              {formData.materials.length !== 1 ? "s" : ""} added
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Cancel</Button>
              <Button disabled>Save LCA</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
