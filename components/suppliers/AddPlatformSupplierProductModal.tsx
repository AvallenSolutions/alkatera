"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Clock, Info, Upload, X, Image as ImageIcon } from "lucide-react";
import { PlatformSupplierProduct, usePlatformSupplierProducts } from "@/hooks/data/usePlatformSupplierProducts";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import Image from "next/image";

interface AddPlatformSupplierProductModalProps {
  platformSupplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: PlatformSupplierProduct;
}

export function AddPlatformSupplierProductModal({
  platformSupplierId,
  open,
  onOpenChange,
  product
}: AddPlatformSupplierProductModalProps) {
  const { createProduct, updateProduct } = usePlatformSupplierProducts(platformSupplierId);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.product_image_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    category: product?.category || "",
    unit: product?.unit || "kg",
    carbon_intensity: product?.carbon_intensity?.toString() || "",
    product_code: product?.product_code || "",
    is_active: product?.is_active !== undefined ? product.is_active : true,
    is_verified: product?.is_verified || false,
    verification_notes: product?.verification_notes || "",
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("File must be an image");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${productId}_${Date.now()}.${fileExt}`;
      const filePath = `${platformSupplierId}/${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-product-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("supplier-product-images")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      let imageUrl = imagePreview;

      const productData: any = {
        platform_supplier_id: platformSupplierId,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        unit: formData.unit,
        carbon_intensity: formData.carbon_intensity ? parseFloat(formData.carbon_intensity) : null,
        product_code: formData.product_code || null,
        is_active: formData.is_active,
        is_verified: formData.is_verified,
        verification_notes: formData.verification_notes || null,
      };

      // Set verified_at when verifying
      if (formData.is_verified && !product?.is_verified) {
        productData.verified_at = new Date().toISOString();
      } else if (!formData.is_verified && product?.is_verified) {
        productData.verified_at = null;
      }

      let savedProduct;

      if (product) {
        if (imageFile) {
          const uploadedUrl = await uploadImage(product.id);
          if (uploadedUrl) imageUrl = uploadedUrl;
        }

        productData.product_image_url = imageUrl;
        savedProduct = await updateProduct(product.id, productData);
      } else {
        savedProduct = await createProduct(productData);

        if (savedProduct && imageFile) {
          const uploadedUrl = await uploadImage(savedProduct.id);
          if (uploadedUrl) {
            await updateProduct(savedProduct.id, { product_image_url: uploadedUrl });
          }
        }
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
        is_verified: false,
        verification_notes: "",
      });
      setImageFile(null);
      setImagePreview(null);
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
            {formData.is_verified && (
              <Badge className="bg-emerald-600 text-white">
                <Shield className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {product ? "Update product details" : "Add a new product to this supplier's portfolio"}
          </DialogDescription>
        </DialogHeader>

        {formData.is_verified && (
          <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-100">
              This product is verified and will appear in material search results.
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
            <Label>Product Image</Label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">
              {imagePreview ? (
                <div className="relative">
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <Image
                      src={imagePreview}
                      alt="Product preview"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Image
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </div>
              )}
            </div>
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

          <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
            <Switch
              id="is_verified"
              checked={formData.is_verified}
              onCheckedChange={(checked) => setFormData({ ...formData, is_verified: checked })}
            />
            <Label htmlFor="is_verified" className="cursor-pointer font-medium">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Mark as Verified (will appear in search results)
              </div>
            </Label>
          </div>

          {formData.is_verified && (
            <div className="space-y-2">
              <Label htmlFor="verification_notes">Verification Notes</Label>
              <Textarea
                id="verification_notes"
                value={formData.verification_notes}
                onChange={(e) => setFormData({ ...formData, verification_notes: e.target.value })}
                placeholder="Optional notes about verification..."
                rows={2}
              />
            </div>
          )}

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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {uploading ? "Uploading..." : loading ? "Saving..." : product ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
