"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Clock, Info } from "lucide-react";
import { useSupplierProducts, SupplierProduct } from "@/hooks/data/useSupplierProducts";
import { useOrganization } from "@/lib/organizationContext";

interface AddSupplierProductModalProps {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: SupplierProduct;
}

export function AddSupplierProductModal({ supplierId, open, onOpenChange, product }: AddSupplierProductModalProps) {
  const { currentOrganization } = useOrganization();
  const { createProduct, updateProduct } = useSupplierProducts(supplierId);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    category: product?.category || "",
    unit: product?.unit || "kg",
    carbon_intensity: product?.carbon_intensity?.toString() || "",
    product_code: product?.product_code || "",
    is_active: product?.is_active !== undefined ? product.is_active : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    setLoading(true);

    try {
      const productData = {
        supplier_id: supplierId,
        organization_id: currentOrganization.id,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        unit: formData.unit,
        carbon_intensity: formData.carbon_intensity ? parseFloat(formData.carbon_intensity) : null,
        product_code: formData.product_code || null,
        is_active: formData.is_active,
      };

      if (product) {
        await updateProduct(product.id, productData);
      } else {
        await createProduct(productData);
      }

      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        category: "",
        unit: "kg",
        carbon_intensity: "",
        product_code: "",
        is_active: true,
      });
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {product ? "Edit Product" : "Add Product"}
            {product?.is_verified && (
              <Badge className="bg-emerald-600 text-white">
                <Shield className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
            {product && !product.is_verified && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <Clock className="h-3 w-3 mr-1" />
                Pending Verification
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {product ? "Update product details" : "Add a new product to this supplier's portfolio"}
          </DialogDescription>
        </DialogHeader>

        {product && product.is_verified && product.verified_at && (
          <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-100">
              This product has been verified by Alkatera on{' '}
              {new Date(product.verified_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
              . It will appear in material search results.
            </AlertDescription>
          </Alert>
        )}

        {(!product || (product && !product.is_verified)) && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-100">
              Products require verification by Alkatera before appearing in material search.
              You will be notified when verification is complete.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Organic Sugar Cane"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_code">Product Code / SKU</Label>
            <Input
              id="product_code"
              value={formData.product_code}
              onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
              placeholder="e.g., OSC-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ingredient">Ingredient</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
                <SelectItem value="raw_material">Raw Material</SelectItem>
                <SelectItem value="chemical">Chemical</SelectItem>
                <SelectItem value="energy">Energy</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this product..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                  <SelectItem value="g">Gramme (g)</SelectItem>
                  <SelectItem value="L">Litre (L)</SelectItem>
                  <SelectItem value="ml">Millilitre (ml)</SelectItem>
                  <SelectItem value="tonne">Tonne</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="m">Metre (m)</SelectItem>
                  <SelectItem value="m2">Square Metre (m²)</SelectItem>
                  <SelectItem value="m3">Cubic Metre (m³)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="carbon_intensity">
                Carbon Intensity (kg CO₂e per {formData.unit})
              </Label>
              <Input
                id="carbon_intensity"
                type="number"
                step="0.0001"
                min="0"
                value={formData.carbon_intensity}
                onChange={(e) => setFormData({ ...formData, carbon_intensity: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Product is active and available
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : product ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
