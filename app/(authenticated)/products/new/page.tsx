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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Save, ArrowLeft, Image as ImageIcon, AlertCircle, Info, Package, Layers, Sparkles, PenLine, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import Link from "next/link";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_GROUPS, getCategoriesByGroup } from "@/lib/product-categories";
import { useProductLimit } from "@/hooks/useSubscription";
import { LimitReachedBanner, UpgradePromptModal } from "@/components/subscription";
import { MultipackProductSelector, SelectedComponent } from "@/components/products/MultipackProductSelector";
import { MultipackSecondaryPackagingForm, SecondaryPackagingItem } from "@/components/products/MultipackSecondaryPackagingForm";
import { createCompleteMultipack } from "@/lib/multipacks";
import { UniversalDropzone } from "@/components/layouts/UniversalDropzone";

interface ProductFormData {
  name: string;
  sku: string;
  product_description: string;
  product_category: string;
  unit_size_value: string;
  unit_size_unit: string;
  product_image_url: string;
}

const UNIT_OPTIONS = [
  { value: "ml", label: "Millilitres (ml)" },
  { value: "l", label: "Litres (l)" },
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "units", label: "Units" },
];


export default function NewProductLCAPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Product type toggle (single or multipack)
  const [productType, setProductType] = useState<"single" | "multipack">("single");

  // Multipack-specific state
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [secondaryPackaging, setSecondaryPackaging] = useState<SecondaryPackagingItem[]>([]);

  // Creation method state (null = show selector, 'manual' = show form). The
  // BOM path is now the shared smart-upload flow (UniversalDropzone), which
  // creates the product and opens the recipe editor itself.
  const [creationMethod, setCreationMethod] = useState<"manual" | null>(null);

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
    product_image_url: "",
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear a field's inline error as soon as the user edits it.
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB");
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
    const errors: Partial<Record<keyof ProductFormData, string>> = {};

    if (!formData.name.trim()) {
      errors.name = "Product name is required";
    }

    // For single products, validate unit size and category inline.
    if (productType === "single" && !isDraft) {
      if (!formData.product_category) {
        errors.product_category = "Product category is required";
      }

      if (!formData.unit_size_value) {
        errors.unit_size_value = "Unit size is required";
      } else {
        const size = parseFloat(formData.unit_size_value);
        if (isNaN(size) || size <= 0) {
          errors.unit_size_value = "Unit size must be a positive number";
        }
      }

      if (!formData.unit_size_unit) {
        errors.unit_size_unit = "Unit type is required";
      }
    }

    setFieldErrors(errors);

    // The multipack component list has no single field to attach to, so it
    // keeps a toast.
    let multipackOk = true;
    if (productType === "multipack" && !isDraft && selectedComponents.length === 0) {
      toast.error("Please add at least one product to the multipack");
      multipackOk = false;
    }

    return Object.keys(errors).length === 0 && multipackOk;
  };

  const saveMultipack = async () => {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    if (!validateForm(false)) {
      return;
    }

    const limitCheck = await checkLimit();
    if (!limitCheck.allowed) {
      setShowUpgradeModal(true);
      toast.error(limitCheck.reason || "Product limit reached");
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.product_image_url;

      // Upload image if one was selected
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          toast.warning("Multipack will be created without image");
        }
      }

      const result = await createCompleteMultipack({
        organizationId: currentOrganization.id,
        name: formData.name,
        sku: formData.sku || undefined,
        product_description: formData.product_description || undefined,
        product_category: formData.product_category || undefined,
        product_image_url: imageUrl || undefined,
        components: selectedComponents.map((c) => ({
          component_product_id: c.product.id,
          quantity: c.quantity,
        })),
        secondaryPackaging: secondaryPackaging.map((p) => ({
          material_name: p.material_name,
          material_type: p.material_type,
          weight_grams: p.weight_grams,
          is_recyclable: p.is_recyclable,
          recycled_content_percentage: p.recycled_content_percentage,
          notes: p.notes || undefined,
        })),
      });

      toast.success("Multipack created successfully");
      router.push(`/products/${result.product.id}`);
    } catch (error: any) {
      console.error("Error creating multipack:", error);
      toast.error(error.message || "Failed to create multipack");
    } finally {
      setIsSubmitting(false);
    }
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
    if (productType === "multipack") {
      await saveMultipack();
    } else {
      await saveProduct(false);
    }
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

  // Show creation method selector if not yet chosen
  if (creationMethod === null) {
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
              Choose how you want to create your product
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

        <div className="grid md:grid-cols-3 gap-6 pt-4">
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => setCreationMethod("manual")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <PenLine className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Create from Scratch</CardTitle>
              <CardDescription>
                Manually enter product details, ingredients, and packaging
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Enter product information step by step</li>
                <li>Add ingredients and packaging manually</li>
                <li>Full control over all details</li>
              </ul>
              <Button className="mt-4 w-full" variant="outline">
                Start from Scratch
              </Button>
            </CardContent>
          </Card>

          <UniversalDropzone
            trigger={
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-[#8da300] dark:text-[#ccff00]" />
                  </div>
                  <CardTitle>Smart upload a recipe</CardTitle>
                  <CardDescription>
                    Drop a recipe, bill of materials, spreadsheet, PDF or photo and Rosa builds the product
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Reads xlsx, CSV, PDF or a photo</li>
                    <li>Understands per-litre and per-hectolitre dosages</li>
                    <li>Creates the product and opens the recipe</li>
                  </ul>
                  <Button className="mt-4 w-full" variant="outline">
                    Smart upload
                  </Button>
                </CardContent>
              </Card>
            }
          />

          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => router.push("/products/import")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Bulk Import from Spreadsheet</CardTitle>
              <CardDescription>
                Import multiple products with ingredients, packaging, and EPR data from Excel
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Download and fill in the Excel template</li>
                <li>Import multiple products at once</li>
                <li>Auto-match to emission factor databases</li>
              </ul>
              <Button className="mt-4 w-full" variant="outline">
                Bulk Import
              </Button>
            </CardContent>
          </Card>
        </div>
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
        <Button variant="outline" size="icon" onClick={() => setCreationMethod(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
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

      {/* Product Type Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Product Type</CardTitle>
          <CardDescription>
            Choose whether to create a single product or a multipack containing multiple products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={productType}
            onValueChange={(value) => {
              if (value) setProductType(value as "single" | "multipack");
            }}
            className="justify-start"
          >
            <ToggleGroupItem
              value="single"
              aria-label="Single Product"
              className="flex items-center gap-2 px-6 py-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Package className="h-4 w-4" />
              Single Product
            </ToggleGroupItem>
            <ToggleGroupItem
              value="multipack"
              aria-label="Multipack"
              className="flex items-center gap-2 px-6 py-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Layers className="h-4 w-4" />
              Multipack
            </ToggleGroupItem>
          </ToggleGroup>
          {productType === "multipack" && (
            <p className="text-sm text-muted-foreground mt-3">
              A multipack combines multiple existing products (e.g., a case of 24 beers, a gift pack with assorted items).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{productType === "multipack" ? "Multipack" : "Product"} Information</CardTitle>
          <CardDescription>
            Basic details about the product you&apos;re assessing
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
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="text-sm font-medium text-destructive">{fieldErrors.name}</p>
            )}
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
            {fieldErrors.product_category ? (
              <p className="text-sm font-medium text-destructive">{fieldErrors.product_category}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select the category that best describes your product
              </p>
            )}
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
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit Size - Only for single products */}
      {productType === "single" && (
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
                  aria-invalid={!!fieldErrors.unit_size_value}
                />
                {fieldErrors.unit_size_value && (
                  <p className="text-sm font-medium text-destructive">{fieldErrors.unit_size_value}</p>
                )}
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
                {fieldErrors.unit_size_unit && (
                  <p className="text-sm font-medium text-destructive">{fieldErrors.unit_size_unit}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Example: 500 ml for a beverage bottle, 250 g for a snack pack
            </p>
          </CardContent>
        </Card>
      )}

      {/* Multipack Components - Only for multipacks */}
      {productType === "multipack" && currentOrganization && (
        <>
          <MultipackProductSelector
            organizationId={currentOrganization.id}
            selectedComponents={selectedComponents}
            onComponentsChange={setSelectedComponents}
            disabled={isSubmitting}
          />

          <MultipackSecondaryPackagingForm
            packagingItems={secondaryPackaging}
            onPackagingChange={setSecondaryPackaging}
            disabled={isSubmitting}
          />
        </>
      )}

      <div className="flex items-center justify-between pt-6 border-t">
        <Link href="/products">
          <Button variant="outline" disabled={isSubmitting || isSavingDraft}>
            Cancel
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {/* Save Draft - only for single products */}
          {productType === "single" && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              loading={isSavingDraft}
              disabled={isSubmitting || isSavingDraft || isUploading}
            >
              {!isSavingDraft && <Save className="mr-2 h-4 w-4" />}
              {isSavingDraft ? "Saving Draft..." : "Save Draft"}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting || isSavingDraft || isUploading}
          >
            {isSubmitting ? (
              "Creating..."
            ) : productType === "multipack" ? (
              <>
                <Layers className="mr-2 h-5 w-5" />
                Create Multipack
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
