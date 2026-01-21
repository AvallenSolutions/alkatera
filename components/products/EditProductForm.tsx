"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Info, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchProduct, updateProduct } from "@/lib/products";
import type { UnitSizeUnit, Certification, Award } from "@/lib/types/products";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_GROUPS, getCategoriesByGroup } from "@/lib/product-categories";
import { useOrganization } from "@/lib/organizationContext";
import { uploadProductImage } from "@/lib/uploadImage";
import { cn } from "@/lib/utils";

interface EditProductFormProps {
  productId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditProductForm({ productId, onSuccess, onCancel }: EditProductFormProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [unitSizeValue, setUnitSizeValue] = useState("");
  const [unitSizeUnit, setUnitSizeUnit] = useState<UnitSizeUnit | "">("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const product = await fetchProduct(productId);

      if (!product) {
        setError("Product not found");
        return;
      }

      setName(product.name);
      setSku(product.sku || "");
      setProductCategory(product.product_category || "");
      setUnitSizeValue(product.unit_size_value?.toString() || "");
      setUnitSizeUnit((product.unit_size_unit as UnitSizeUnit) || "");
      setDescription(product.product_description || "");
      setImageUrl(product.product_image_url || "");
      setCertifications(product.certifications || []);
      setAwards(product.awards || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load product";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCertification = () => {
    setCertifications([...certifications, { name: "", evidence_url: "" }]);
  };

  const handleUpdateCertification = (index: number, field: keyof Certification, value: string) => {
    const updated = [...certifications];
    updated[index][field] = value;
    setCertifications(updated);
  };

  const handleRemoveCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const handleAddAward = () => {
    setAwards([...awards, { name: "" }]);
  };

  const handleUpdateAward = (index: number, value: string) => {
    const updated = [...awards];
    updated[index].name = value;
    setAwards(updated);
  };

  const handleRemoveAward = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  // Image upload handlers
  const handleImageUpload = async (file: File) => {
    if (!currentOrganization?.id) {
      setUploadError("Organization not found. Please try again.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const result = await uploadProductImage(file, currentOrganization.id);

      if (result.error) {
        throw result.error;
      }

      if (result.url) {
        setImageUrl(result.url);
        toast.success("Image uploaded successfully!");
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [currentOrganization?.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemoveImage = () => {
    setImageUrl("");
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const validCertifications = certifications.filter((cert) => cert.name.trim());
      const validAwards = awards.filter((award) => award.name.trim());

      await updateProduct({
        id: productId,
        name: name.trim(),
        sku: sku.trim() || undefined,
        product_category: productCategory || undefined,
        unit_size_value: unitSizeValue ? parseFloat(unitSizeValue) : undefined,
        unit_size_unit: unitSizeUnit || undefined,
        product_description: description.trim() || undefined,
        product_image_url: imageUrl.trim() || undefined,
        certifications: validCertifications,
        awards: validAwards,
      });

      toast.success("Product updated successfully!");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/products");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update product";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error && !name) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => router.push("/dashboard/products")}>
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Modify the information about your product
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Premium Coffee Blend"
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., PCB-250-001"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="product_category">Product Category</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Used to match with industry average emission factors when specific facility data is unavailable</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={productCategory}
                onValueChange={setProductCategory}
                disabled={isSaving}
              >
                <SelectTrigger id="product_category">
                  <SelectValue placeholder="Select product category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORY_GROUPS.map((group) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {group}
                      </div>
                      {getCategoriesByGroup(group).map((category) => (
                        <SelectItem key={category.label} value={category.value}>
                          <div>
                            <div className="font-medium">{category.label}</div>
                            {category.description && (
                              <div className="text-xs text-muted-foreground">{category.description}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the category that best describes your product
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit-size-value">Unit Size Value</Label>
                <Input
                  id="unit-size-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitSizeValue}
                  onChange={(e) => setUnitSizeValue(e.target.value)}
                  placeholder="250"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-size-unit">Unit</Label>
                <Select
                  value={unitSizeUnit}
                  onValueChange={(value) => setUnitSizeUnit(value as UnitSizeUnit)}
                  disabled={isSaving}
                >
                  <SelectTrigger id="unit-size-unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Product Image</Label>

              {/* Image Preview */}
              {imageUrl && (
                <div className="relative mb-4">
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                    disabled={isSaving || isUploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as "upload" | "url")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="url">Enter URL</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                  <div
                    className={cn(
                      "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50",
                      (isUploading || isSaving) && "opacity-50 cursor-not-allowed"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isUploading && !isSaving && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isUploading || isSaving}
                    />

                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop or click to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPEG, PNG, GIF, or WebP (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-sm text-destructive mt-2">{uploadError}</p>
                  )}
                </TabsContent>

                <TabsContent value="url" className="mt-4">
                  <Input
                    id="image-url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter the full URL to the product image
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Product Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the product..."
                rows={4}
                disabled={isSaving}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Certifications</h3>
                <p className="text-sm text-muted-foreground">
                  Add product certifications and evidence
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCertification}
                disabled={isSaving}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Certification
              </Button>
            </div>

            {certifications.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  No certifications added yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {certifications.map((cert, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={cert.name}
                        onChange={(e) =>
                          handleUpdateCertification(index, "name", e.target.value)
                        }
                        placeholder="Certification name"
                        disabled={isSaving}
                      />
                      <Input
                        value={cert.evidence_url}
                        onChange={(e) =>
                          handleUpdateCertification(index, "evidence_url", e.target.value)
                        }
                        placeholder="Evidence URL"
                        disabled={isSaving}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCertification(index)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Awards</h3>
                <p className="text-sm text-muted-foreground">
                  Add product awards and recognition
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAward}
                disabled={isSaving}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Award
              </Button>
            </div>

            {awards.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  No awards added yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {awards.map((award, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={award.name}
                      onChange={(e) => handleUpdateAward(index, e.target.value)}
                      placeholder="Award name"
                      disabled={isSaving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAward(index)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel ? onCancel() : router.push("/dashboard/products")}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
