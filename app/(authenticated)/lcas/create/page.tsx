"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Save, Image as ImageIcon } from "lucide-react";
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
import { toast } from "sonner";
import { LcaMaterialSelector } from "@/components/lca/LcaMaterialSelector";
import { useOrganization } from "@/lib/organizationContext";
import { uploadProductImage } from "@/lib/uploadImage";
import type { MaterialWithDetails } from "@/lib/types/lca";

export default function CreateLcaPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [materialsList, setMaterialsList] = useState<MaterialWithDetails[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageUpload = useCallback(async () => {
    if (!imageFile || !organizationId) {
      return;
    }

    setIsUploadingImage(true);
    try {
      const { url, error: uploadError } = await uploadProductImage(imageFile, organizationId);

      if (uploadError || !url) {
        throw uploadError || new Error('Failed to upload image');
      }

      setProductImageUrl(url);
      toast.success('Image uploaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      toast.error(errorMessage);
      console.error('Image upload error:', err);
    } finally {
      setIsUploadingImage(false);
    }
  }, [imageFile, organizationId]);

  const handleAddMaterial = useCallback((material: MaterialWithDetails) => {
    setMaterialsList((prev) => [...prev, material]);
    toast.success(`Added ${material.name} to materials list`);
  }, []);

  const handleRemoveMaterial = useCallback((index: number) => {
    setMaterialsList((prev) => {
      const material = prev[index];
      toast.success(`Removed ${material.name} from materials list`);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSaveLca = useCallback(async () => {
    if (!organizationId) {
      setError("No organisation selected");
      return;
    }

    if (!productName.trim()) {
      setError("Product name is required");
      return;
    }

    if (materialsList.length === 0) {
      setError("Please add at least one material");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-product-lca`;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!apiUrl || !anonKey) {
        throw new Error('Supabase configuration missing');
      }

      const payload = {
        productDetails: {
          product_name: productName,
          product_description: productDescription,
          product_image_url: productImageUrl,
          functional_unit: "1 unit",
          system_boundary: "Cradle to gate",
        },
        materials: materialsList.map((m) => ({
          material_id: m.material_id,
          material_type: m.material_type,
          quantity: m.quantity,
          unit: m.unit,
          country_of_origin: m.country_of_origin,
          is_organic: m.is_organic,
          is_regenerative: m.is_regenerative,
          lca_sub_stage_id: m.lca_sub_stage_id,
        })),
        organization_id: organizationId,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      toast.success('Product LCA created successfully!');

      setTimeout(() => {
        router.push('/products');
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Error saving LCA:', err);
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, productName, productDescription, productImageUrl, materialsList, router]);

  if (!organizationId) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription>
            Please select an organisation to create a product LCA.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Product LCA</h1>
        <p className="text-muted-foreground mt-2">
          Define your product details and add materials to create a comprehensive Life Cycle Assessment
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Product LCA</CardTitle>
              <CardDescription>Enter the basic information about your product</CardDescription>
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
                  placeholder="Describe the product, its features, and intended use..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  disabled={isSaving}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-image">Product Image</Label>
                <div className="flex gap-2">
                  <Input
                    id="product-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={isSaving || isUploadingImage}
                    className="flex-1"
                  />
                  {imageFile && !productImageUrl && (
                    <Button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={isUploadingImage || isSaving}
                      variant="outline"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploadingImage ? 'Uploading...' : 'Upload'}
                    </Button>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-2 relative w-full h-48 border rounded-lg overflow-hidden bg-muted">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="w-full h-full object-contain"
                    />
                    {productImageUrl && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">Uploaded</Badge>
                      </div>
                    )}
                  </div>
                )}
                {!imagePreview && (
                  <div className="mt-2 w-full h-48 border rounded-lg flex items-center justify-center bg-muted">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="mx-auto h-12 w-12 mb-2" />
                      <p className="text-sm">No image selected</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <LcaMaterialSelector
            onAddMaterial={handleAddMaterial}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Materials List</CardTitle>
              <CardDescription>
                Materials added to this product LCA ({materialsList.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {materialsList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No materials added yet.</p>
                  <p className="text-xs mt-1">Use the selector on the left to add materials.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Life Cycle Stage</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialsList.map((material, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{material.name}</div>
                              {material.country_of_origin && material.country_of_origin !== "Not specified" && (
                                <div className="text-xs text-muted-foreground">
                                  {material.country_of_origin}
                                </div>
                              )}
                              {(material.is_organic || material.is_regenerative) && (
                                <div className="flex gap-1 mt-1">
                                  {material.is_organic && (
                                    <Badge variant="outline" className="text-xs">Organic</Badge>
                                  )}
                                  {material.is_regenerative && (
                                    <Badge variant="outline" className="text-xs">Regenerative</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={material.material_type === "ingredient" ? "default" : "secondary"}>
                              {material.material_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{material.lca_sub_stage_name || "Not specified"}</div>
                          </TableCell>
                          <TableCell className="text-right">{material.quantity}</TableCell>
                          <TableCell>{material.unit}</TableCell>
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
                </div>
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
              onClick={handleSaveLca}
              disabled={isSaving || materialsList.length === 0 || !productName}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save LCA"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
