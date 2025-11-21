"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertCircle, Plus, Trash2, Edit } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
}

interface ProductMaterial {
  id: string;
  material_name: string;
  quantity: number;
  unit: string | null;
  material_type: string | null;
  origin_country: string | null;
  is_organic_certified: boolean;
  notes: string | null;
}

export default function ProductMaterialsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [materials, setMaterials] = useState<ProductMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ProductMaterial | null>(null);
  const [formData, setFormData] = useState({
    material_name: "",
    quantity: "",
    unit: "kg",
    material_type: "ingredient",
    origin_country: "",
    is_organic_certified: false,
    notes: "",
  });

  useEffect(() => {
    if (productId) {
      fetchData();
    }
  }, [productId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [productRes, materialsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name")
          .eq("id", productId)
          .single(),
        supabase
          .from("product_materials")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true }),
      ]);

      if (productRes.error) throw productRes.error;
      if (materialsRes.error) throw materialsRes.error;

      setProduct(productRes.data);
      setMaterials(materialsRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (material?: ProductMaterial) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({
        material_name: material.material_name,
        quantity: material.quantity.toString(),
        unit: material.unit || "kg",
        material_type: material.material_type || "ingredient",
        origin_country: material.origin_country || "",
        is_organic_certified: material.is_organic_certified,
        notes: material.notes || "",
      });
    } else {
      setEditingMaterial(null);
      setFormData({
        material_name: "",
        quantity: "",
        unit: "kg",
        material_type: "ingredient",
        origin_country: "",
        is_organic_certified: false,
        notes: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingMaterial(null);
  };

  const handleSave = async () => {
    try {
      if (!formData.material_name || !formData.quantity) {
        toast.error("Material name and quantity are required");
        return;
      }

      const materialData = {
        product_id: parseInt(productId!),
        material_name: formData.material_name,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        material_type: formData.material_type,
        origin_country: formData.origin_country || null,
        is_organic_certified: formData.is_organic_certified,
        notes: formData.notes || null,
      };

      if (editingMaterial) {
        const { error } = await supabase
          .from("product_materials")
          .update(materialData)
          .eq("id", editingMaterial.id);

        if (error) throw error;
        toast.success("Material updated successfully");
      } else {
        const { error } = await supabase
          .from("product_materials")
          .insert([materialData]);

        if (error) throw error;
        toast.success("Material added successfully");
      }

      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      console.error("Error saving material:", error);
      toast.error(error.message);
    }
  };

  const handleDelete = async (materialId: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    try {
      const { error } = await supabase
        .from("product_materials")
        .delete()
        .eq("id", materialId);

      if (error) throw error;

      toast.success("Material deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting material:", error);
      toast.error(error.message);
    }
  };

  if (loading) {
    return <PageLoader message="Loading materials..." />;
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Product not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Master Bill of Materials</CardTitle>
              <CardDescription>
                Manage materials for {product.name}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Material
            </Button>
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
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <p className="font-medium">{material.material_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {material.quantity} {material.unit || "units"}
                      {material.material_type && ` • ${material.material_type}`}
                      {material.origin_country && ` • ${material.origin_country}`}
                      {material.is_organic_certified && " • Organic"}
                    </p>
                    {material.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{material.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(material)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(material.id)}
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? "Edit Material" : "Add Material"}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? "Update the material details"
                : "Add a new material to the master bill of materials"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material_name">Material Name *</Label>
              <Input
                id="material_name"
                value={formData.material_name}
                onChange={(e) =>
                  setFormData({ ...formData, material_name: e.target.value })
                }
                placeholder="e.g., Organic Wheat Flour"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="mL">mL</SelectItem>
                    <SelectItem value="units">units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material_type">Material Type</Label>
              <Select
                value={formData.material_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, material_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="origin_country">Origin Country</Label>
              <Input
                id="origin_country"
                value={formData.origin_country}
                onChange={(e) =>
                  setFormData({ ...formData, origin_country: e.target.value })
                }
                placeholder="e.g., United Kingdom"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_organic_certified"
                checked={formData.is_organic_certified}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_organic_certified: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_organic_certified" className="cursor-pointer">
                Organic Certified
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this material"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingMaterial ? "Update" : "Add"} Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
