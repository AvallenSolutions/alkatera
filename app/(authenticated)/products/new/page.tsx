"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Save, ArrowLeft, Image as ImageIcon, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import Link from "next/link";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_GROUPS, getCategoriesByGroup } from "@/lib/product-categories";
import { useProductLimit } from "@/hooks/useSubscription";
import { LimitReachedBanner, UpgradePromptModal } from "@/components/subscription";

interface ProductFormData {
  name: string;
  sku: string;
  product_description: string;
  product_category: string;
  unit_size_value: string;
  unit_size_unit: string;
  system_boundary: string;
  product_image_url: string;
}

const UNIT_OPTIONS = [
  { value: "ml", label: "Millilitres (ml)" },
  { value: "l", label: "Litres (l)" },
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "units", label: "Units" },
];

const SYSTEM_BOUNDARY_OPTIONS = [
  {
    value: "cradle_to_gate",
    label: "Cradle-to-Gate",
    description: "From raw material extraction to finished product leaving the factory gate"
  },
  {
    value: "cradle_to_grave",
    label: "Cradle-to-Grave",
    description: "Complete lifecycle from raw material extraction through end-of-life disposal"
  },
];

export default function NewProductLCAPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const {
    currentCount,
    maxCount,
    isUnlimited,
    percentage,
    checkLimit,
    isLoading: limitLoading
  } = useProductLimit();

  const isAtLimit = !isUnlimited && maxCount !== null && maxCount !== undefined && currentCount >= maxCount;
  const isNearLimit = !isUnlimited && maxCount !== null && maxCount !== undefined && percentage >= 80;

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    sku: "",
    product_description: "",
    product_category: "",
    unit_size_value: "",
    unit_size_unit: "",
    system_boundary: "cradle_to_gate",
    product_image_url: "",
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("File must be an image");
        return;
      }

      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setUploadedImageUrl(previewUrl);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !currentOrganization?.id) return null;

    setIsUploading(true);

    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${currentOrganization.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload image");
      }

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(uploadData.path);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Failed to upload image");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const validateForm = (isDraft: boolean = false): boolean => {
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return false;
    }

    if (!isDraft) {
      if (!formData.product_category) {
        toast.error("Product category is required");
        return false;
      }

      if (!formData.unit_size_value) {
        toast.error("Unit size is required");
        return false;
      }

      const size = parseFloat(formData.unit_size_value);
      if (isNaN(size) || size <= 0) {
        toast.error("Unit size must be a positive number");
        return false;
      }

      if (!formData.unit_size_unit) {
        toast.error("Unit type is required");
        return false;
      }
    }

    return true;
  };

  const saveProduct = async (isDraft: boolean = false) => {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    if (!validateForm(isDraft)) {
      return;
    }

    const limitCheck = await checkLimit();
    if (!limitCheck.allowed) {
      setShowUpgradeModal(true);
      toast.error(limitCheck.reason || "Product limit reached");
      return;
    }

    if (isDraft) {
      setIsSavingDraft(true);
    } else {
      setIsSubmitting(true);
    }

    try {
      let imageUrl = formData.product_image_url;

      // Upload image if one was selected
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          // If image upload fails, don't block product creation
          toast.warning("Product will be created without image");
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const functionalUnit = formData.unit_size_value && formData.unit_size_unit
        ? `${formData.unit_size_value} ${formData.unit_size_unit}`
        : null;

      const productData: any = {
        organization_id: currentOrganization.id,
        name: formData.name,
        sku: formData.sku || null,
        product_description: formData.product_description || null,
        product_category: formData.product_category || null,
        product_image_url: imageUrl || null,
        created_by: user.id,
        is_draft: isDraft,
        functional_unit: functionalUnit,
        unit_size_value: formData.unit_size_value ? parseFloat(formData.unit_size_value) : null,
        unit_size_unit: formData.unit_size_unit || null,
        system_boundary: formData.system_boundary,
      }

      const { data, error } = await supabase
        .from("products")
        .insert([productData])
        .select()
        .single();

      if (error) throw error;

      await supabase.rpc("increment_product_count", {
        p_organization_id: currentOrganization.id,
      });

      if (isDraft) {
        toast.success("Product draft saved successfully");
        router.push(`/products/${data.id}`);
      } else {
        toast.success("Product created successfully");
        router.push(`/products/${data.id}/recipe`);
      }
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast.error(error.message || "Failed to create product");
    } finally {
      if (isDraft) {
        setIsSavingDraft(false);
      } else {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async () => {
    await saveProduct(false);
  };

  const handleSaveDraft = async () => {
    await saveProduct(true);
  };

  if (!currentOrganization) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select an organisation to create a product.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <UpgradePromptModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType="products"
      />

      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Product</h1>
          <p className="text-muted-foreground mt-1">
            Define your product details and functional unit
          </p>
        </div>
      </div>

      {!limitLoading && !isUnlimited && maxCount !== null && maxCount !== undefined && (
        <LimitReachedBanner
          type="products"
          current={currentCount}
          max={maxCount}
          onUpgrade={() => setShowUpgradeModal(true)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Basic details about the product you're assessing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Organic Orange Juice 500ml"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              disabled={isSubmitting || isSavingDraft}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              placeholder="e.g., OOJ-500ML-001"
              value={formData.sku}
              onChange={(e) => handleInputChange("sku", e.target.value)}
              disabled={isSubmitting || isSavingDraft}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Product Description</Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed description of the product, including key ingredients, materials, or characteristics..."
              value={formData.product_description}
              onChange={(e) => handleInputChange("product_description", e.target.value)}
              disabled={isSubmitting || isSavingDraft}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="product_category">Product Category *</Label>
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
              value={formData.product_category}
              onValueChange={(value) => handleInputChange("product_category", value)}
              disabled={isSubmitting || isSavingDraft}
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

          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="border-2 border-dashed rounded-lg p-6">
              {uploadedImageUrl ? (
                <div className="space-y-4">
                  <img
                    src={uploadedImageUrl}
                    alt="Product preview"
                    className="max-w-xs mx-auto rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setUploadedImageUrl(null);
                      setImageFile(null);
                    }}
                    disabled={isSubmitting || isSavingDraft}
                  >
                    Remove Image
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <Label
                      htmlFor="image-upload"
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Click to upload an image
                    </Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                      disabled={isSubmitting || isSavingDraft}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unit Size</CardTitle>
          <CardDescription>
            Define the size and unit of measurement for your product
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_size_value">Size *</Label>
              <Input
                id="unit_size_value"
                type="number"
                step="0.01"
                min="0"
                placeholder="500"
                value={formData.unit_size_value}
                onChange={(e) => handleInputChange("unit_size_value", e.target.value)}
                disabled={isSubmitting || isSavingDraft}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_size_unit">Unit *</Label>
              <Select
                value={formData.unit_size_unit}
                onValueChange={(value) => handleInputChange("unit_size_unit", value)}
                disabled={isSubmitting || isSavingDraft}
              >
                <SelectTrigger id="unit_size_unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Example: 500 ml for a beverage bottle, 250 g for a snack pack
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>System Boundary</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>From raw material extraction to finished product leaving the factory gate</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Define the scope of your LCA assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system_boundary">Boundary Scope *</Label>
            <Select
              value={formData.system_boundary}
              onValueChange={(value) => handleInputChange("system_boundary", value)}
              disabled={isSubmitting || isSavingDraft}
            >
              <SelectTrigger id="system_boundary">
                <SelectValue placeholder="Select system boundary" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_BOUNDARY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-6 border-t">
        <Link href="/products">
          <Button variant="outline" disabled={isSubmitting || isSavingDraft}>
            Cancel
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSubmitting || isSavingDraft || isUploading}
          >
            {isSavingDraft ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Draft...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </>
            )}
          </Button>
          <Button onClick={handleSubmit} size="lg" disabled={isSubmitting || isSavingDraft || isUploading}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Create Product
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
