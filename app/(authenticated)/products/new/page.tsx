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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Upload, Loader2, Save, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import Link from "next/link";

interface ProductFormData {
  name: string;
  product_description: string;
  functional_unit_type: string;
  functional_unit_volume: string;
  functional_unit_measure: string;
  system_boundary: "cradle_to_gate" | "cradle_to_grave";
  product_image_url: string;
}

const FUNCTIONAL_UNIT_TYPES = [
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can" },
  { value: "pack", label: "Pack" },
  { value: "unit", label: "Unit" },
];

const FUNCTIONAL_UNIT_MEASURES = [
  { value: "ml", label: "Millilitres (ml)" },
  { value: "l", label: "Litres (l)" },
];

export default function NewProductLCAPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    product_description: "",
    functional_unit_type: "",
    functional_unit_volume: "",
    functional_unit_measure: "",
    system_boundary: "cradle_to_gate",
    product_image_url: "",
  });

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

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return false;
    }

    if (formData.functional_unit_type && formData.functional_unit_volume) {
      const volume = parseFloat(formData.functional_unit_volume);
      if (isNaN(volume) || volume <= 0) {
        toast.error("Functional unit volume must be a positive number");
        return false;
      }

      if (!formData.functional_unit_measure) {
        toast.error("Please select a measurement unit");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.product_image_url;

      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const productData: any = {
        organization_id: currentOrganization.id,
        name: formData.name,
        product_description: formData.product_description || null,
        system_boundary: formData.system_boundary,
        product_image_url: imageUrl || null,
        created_by: user.id,
      };

      if (formData.functional_unit_type) {
        productData.functional_unit_type = formData.functional_unit_type;
      }

      if (formData.functional_unit_volume) {
        productData.functional_unit_volume = parseFloat(formData.functional_unit_volume);
      }

      if (formData.functional_unit_measure) {
        productData.functional_unit_measure = formData.functional_unit_measure;
      }

      const { data, error } = await supabase
        .from("products")
        .insert([productData])
        .select()
        .single();

      if (error) throw error;

      toast.success("Product LCA definition created successfully");
      router.push(`/products/detail?id=${data.id}`);
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast.error(error.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            Please select an organization to create a product LCA.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Define New Product LCA</h1>
          <p className="text-muted-foreground mt-1">
            Create the foundational definition for your product's life cycle assessment
          </p>
        </div>
      </div>

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
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Product Description</Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed description of the product, including key ingredients, materials, or characteristics..."
              value={formData.product_description}
              onChange={(e) => handleInputChange("product_description", e.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
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
                    disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
          <CardTitle>Functional Unit Definition</CardTitle>
          <CardDescription>
            Define the reference unit for your LCA calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="unit-type">Unit Type</Label>
            <Select
              value={formData.functional_unit_type}
              onValueChange={(value) => handleInputChange("functional_unit_type", value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="unit-type">
                <SelectValue placeholder="Select packaging type" />
              </SelectTrigger>
              <SelectContent>
                {FUNCTIONAL_UNIT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volume">Volume</Label>
              <Input
                id="volume"
                type="number"
                step="0.01"
                min="0"
                placeholder="500"
                value={formData.functional_unit_volume}
                onChange={(e) => handleInputChange("functional_unit_volume", e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measure">Measurement Unit</Label>
              <Select
                value={formData.functional_unit_measure}
                onValueChange={(value) => handleInputChange("functional_unit_measure", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="measure">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {FUNCTIONAL_UNIT_MEASURES.map((measure) => (
                    <SelectItem key={measure.value} value={measure.value}>
                      {measure.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Example: 1 bottle of 500ml represents the functional unit for this assessment
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Boundary Selection</CardTitle>
          <CardDescription>
            Define the scope of your LCA calculation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.system_boundary}
            onValueChange={(value) =>
              handleInputChange("system_boundary", value as "cradle_to_gate" | "cradle_to_grave")
            }
            disabled={isSubmitting}
          >
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="cradle_to_gate" id="cradle-to-gate" />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="cradle-to-gate"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Cradle-to-Gate
                </Label>
                <p className="text-sm text-muted-foreground">
                  From raw material extraction to factory gate (excludes distribution, use, and disposal)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="cradle_to_grave" id="cradle-to-grave" />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="cradle-to-grave"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Cradle-to-Grave
                </Label>
                <p className="text-sm text-muted-foreground">
                  Complete lifecycle from raw material extraction through end-of-life disposal
                </p>
              </div>
            </div>
          </RadioGroup>

          {formData.system_boundary === "cradle_to_gate" && (
            <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>Warning:</strong> This boundary is suitable for internal benchmarking or B2B
                reporting only. Using 'cradle-to-gate' data for public-facing marketing claims carries
                a high risk of non-compliance with greenwashing regulations like the EU Green Claims
                Directive and UK DMCC Act.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {formData.system_boundary === "cradle_to_grave" && (
        <>
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Stages</CardTitle>
              <CardDescription>
                Additional data capture sections for cradle-to-grave assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Distribution</p>
                    <p className="text-sm text-muted-foreground">
                      Transport and logistics data
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Available after creation</span>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Retail</p>
                    <p className="text-sm text-muted-foreground">
                      Storage and refrigeration requirements
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Available after creation</span>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Consumer Use</p>
                    <p className="text-sm text-muted-foreground">
                      Usage patterns and energy consumption
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Available after creation</span>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">End of Life</p>
                    <p className="text-sm text-muted-foreground">
                      Disposal, recycling, and waste management
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Available after creation</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center justify-end gap-4 pt-6 border-t">
        <Link href="/products">
          <Button variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} size="lg" disabled={isSubmitting || isUploading}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Create Product LCA
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
