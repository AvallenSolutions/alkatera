"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Clock, Info, Upload, X, Image as ImageIcon, Package, BarChart3 } from "lucide-react";
import { useSupplierProducts } from "@/hooks/data/useSupplierProducts";
import type { SupplierProduct, SupplierProductFormData } from "@/lib/types/supplier-product";
import { SupplierProductImpactForm } from "./SupplierProductImpactForm";
import { useOrganization } from "@/lib/organizationContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import Image from "next/image";

interface AddSupplierProductModalProps {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: SupplierProduct;
}

export function AddSupplierProductModal({
  supplierId,
  open,
  onOpenChange,
  product,
}: AddSupplierProductModalProps) {
  const { currentOrganization } = useOrganization();
  const { createProduct, updateProduct } = useSupplierProducts(supplierId);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.product_image_url || null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Basic product info
  const [basicData, setBasicData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    category: product?.category || "",
    unit: product?.unit || "kg",
    product_code: product?.product_code || "",
    is_active: product?.is_active !== undefined ? product.is_active : true,
  });

  // Impact data - initialize from existing product
  const [impactData, setImpactData] = useState<SupplierProductFormData>({
    name: product?.name || "",
    unit: product?.unit || "kg",
    is_active: product?.is_active !== undefined ? product.is_active : true,
    // Multi-category impacts
    impact_climate: product?.impact_climate ?? product?.carbon_intensity ?? undefined,
    impact_water: product?.impact_water ?? undefined,
    impact_waste: product?.impact_waste ?? undefined,
    impact_land: product?.impact_land ?? undefined,
    // GHG breakdown
    ghg_fossil: product?.ghg_fossil ?? undefined,
    ghg_biogenic: product?.ghg_biogenic ?? undefined,
    ghg_land_use_change: product?.ghg_land_use_change ?? undefined,
    // Water breakdown
    water_blue: product?.water_blue ?? undefined,
    water_green: product?.water_green ?? undefined,
    water_grey: product?.water_grey ?? undefined,
    water_scarcity_factor: product?.water_scarcity_factor ?? undefined,
    // Waste & circularity
    recycled_content_pct: product?.recycled_content_pct ?? undefined,
    recyclability_pct: product?.recyclability_pct ?? undefined,
    end_of_life_pathway: product?.end_of_life_pathway ?? undefined,
    circularity_score: product?.circularity_score ?? undefined,
    // Nature/biodiversity
    terrestrial_ecotoxicity: product?.terrestrial_ecotoxicity ?? undefined,
    freshwater_eutrophication: product?.freshwater_eutrophication ?? undefined,
    terrestrial_acidification: product?.terrestrial_acidification ?? undefined,
    // Data quality
    data_quality_score: product?.data_quality_score ?? undefined,
    data_confidence_pct: product?.data_confidence_pct ?? undefined,
    data_source_type: product?.data_source_type ?? undefined,
    methodology_standard: product?.methodology_standard ?? undefined,
    functional_unit: product?.functional_unit ?? undefined,
    system_boundary: product?.system_boundary ?? undefined,
    // Validity
    valid_from: product?.valid_from ?? undefined,
    valid_until: product?.valid_until ?? undefined,
    reference_year: product?.reference_year ?? undefined,
    geographic_scope: product?.geographic_scope ?? undefined,
    // Uncertainty
    uncertainty_type: product?.uncertainty_type ?? undefined,
    uncertainty_value: product?.uncertainty_value ?? undefined,
    // External verification
    external_verifier_name: product?.external_verifier_name ?? undefined,
    external_verification_date: product?.external_verification_date ?? undefined,
    external_verification_expiry: product?.external_verification_expiry ?? undefined,
    external_verification_standard: product?.external_verification_standard ?? undefined,
    external_verification_url: product?.external_verification_url ?? undefined,
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
    setHasUnsavedChanges(true);
  };

  // Draft management
  const getDraftKey = () => {
    if (product?.id) {
      return `supplier_product_draft_${product.id}`;
    }
    return `supplier_product_draft_new_${supplierId}_${currentOrganization?.id}`;
  };

  const saveDraftToLocalStorage = () => {
    const draftKey = getDraftKey();
    const draftData = {
      basicData,
      impactData,
      imagePreview,
      activeTab,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
  };

  const loadDraftFromLocalStorage = () => {
    const draftKey = getDraftKey();
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        // Only load draft if it's less than 24 hours old
        const draftAge = Date.now() - new Date(draftData.timestamp).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (draftAge < twentyFourHours) {
          return draftData;
        } else {
          // Clean up old draft
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
    return null;
  };

  const clearDraft = () => {
    const draftKey = getDraftKey();
    localStorage.removeItem(draftKey);
    setHasUnsavedChanges(false);
  };

  const handleSaveDraft = () => {
    setSavingDraft(true);
    saveDraftToLocalStorage();
    toast.success("Draft saved successfully");
    setHasUnsavedChanges(false);
    setTimeout(() => setSavingDraft(false), 500);
  };

  // Load draft when modal opens
  useEffect(() => {
    if (open && !product && currentOrganization) {
      const draft = loadDraftFromLocalStorage();
      if (draft) {
        toast.info("Draft restored", {
          description: "Your previous work has been restored. Continue editing or discard the draft.",
          duration: 5000,
        });
        setBasicData(draft.basicData);
        setImpactData(draft.impactData);
        setImagePreview(draft.imagePreview);
        setActiveTab(draft.activeTab || "basic");
        setHasUnsavedChanges(true);
      }
    }
  }, [open, product, currentOrganization]);

  // Auto-save to localStorage
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (hasUnsavedChanges && open) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraftToLocalStorage();
      }, 2000); // Auto-save after 2 seconds of inactivity
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [basicData, impactData, imagePreview, hasUnsavedChanges, open]);

  // Track changes
  useEffect(() => {
    if (open && (basicData.name || impactData.impact_climate !== undefined)) {
      setHasUnsavedChanges(true);
    }
  }, [basicData, impactData, open]);

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile || !currentOrganization) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${productId}_${Date.now()}.${fileExt}`;
      const filePath = `${currentOrganization.id}/${supplierId}/${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-product-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("supplier-product-images").getPublicUrl(filePath);

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
    if (!currentOrganization) return;

    setLoading(true);

    try {
      let imageUrl = imagePreview;

      // Combine basic data with impact data
      const productData: any = {
        supplier_id: supplierId,
        organization_id: currentOrganization.id,
        name: basicData.name,
        description: basicData.description || null,
        category: basicData.category || null,
        unit: basicData.unit,
        product_code: basicData.product_code || null,
        is_active: basicData.is_active,
        // Legacy field for backward compatibility
        carbon_intensity: impactData.impact_climate ?? null,
        // Multi-category impacts
        impact_climate: impactData.impact_climate ?? null,
        impact_water: impactData.impact_water ?? null,
        impact_waste: impactData.impact_waste ?? null,
        impact_land: impactData.impact_land ?? null,
        // GHG breakdown
        ghg_fossil: impactData.ghg_fossil ?? null,
        ghg_biogenic: impactData.ghg_biogenic ?? null,
        ghg_land_use_change: impactData.ghg_land_use_change ?? null,
        // Water breakdown
        water_blue: impactData.water_blue ?? null,
        water_green: impactData.water_green ?? null,
        water_grey: impactData.water_grey ?? null,
        water_scarcity_factor: impactData.water_scarcity_factor ?? null,
        // Waste & circularity
        recycled_content_pct: impactData.recycled_content_pct ?? null,
        recyclability_pct: impactData.recyclability_pct ?? null,
        end_of_life_pathway: impactData.end_of_life_pathway ?? null,
        circularity_score: impactData.circularity_score ?? null,
        // Nature/biodiversity
        terrestrial_ecotoxicity: impactData.terrestrial_ecotoxicity ?? null,
        freshwater_eutrophication: impactData.freshwater_eutrophication ?? null,
        terrestrial_acidification: impactData.terrestrial_acidification ?? null,
        // Data quality
        data_quality_score: impactData.data_quality_score ?? null,
        data_confidence_pct: impactData.data_confidence_pct ?? null,
        data_source_type: impactData.data_source_type ?? null,
        methodology_standard: impactData.methodology_standard ?? null,
        functional_unit: impactData.functional_unit ?? null,
        system_boundary: impactData.system_boundary ?? null,
        // Validity
        valid_from: impactData.valid_from ?? null,
        valid_until: impactData.valid_until ?? null,
        reference_year: impactData.reference_year ?? null,
        geographic_scope: impactData.geographic_scope ?? null,
        // Uncertainty
        uncertainty_type: impactData.uncertainty_type ?? null,
        uncertainty_value: impactData.uncertainty_value ?? null,
        // External verification
        external_verifier_name: impactData.external_verifier_name ?? null,
        external_verification_date: impactData.external_verification_date ?? null,
        external_verification_expiry: impactData.external_verification_expiry ?? null,
        external_verification_standard: impactData.external_verification_standard ?? null,
        external_verification_url: impactData.external_verification_url ?? null,
      };

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

      clearDraft(); // Clear draft on successful save
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseWithWarning = (shouldClose: boolean) => {
    if (shouldClose && hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Your progress has been auto-saved as a draft. Close anyway?")) {
        onOpenChange(false);
      }
    } else {
      onOpenChange(shouldClose);
    }
  };

  const handleDiscardDraft = () => {
    if (confirm("Are you sure you want to discard this draft? This cannot be undone.")) {
      clearDraft();
      resetForm();
      toast.success("Draft discarded");
    }
  };

  const resetForm = () => {
    setBasicData({
      name: "",
      description: "",
      category: "",
      unit: "kg",
      product_code: "",
      is_active: true,
    });
    setImpactData({
      name: "",
      unit: "kg",
      is_active: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setActiveTab("basic");
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseWithWarning}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
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
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                Unsaved Changes
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Update product details and environmental impact data"
              : "Add a new product with comprehensive environmental impact data"}
            {!product && (
              <span className="block mt-1 text-xs text-muted-foreground">
                Your work is auto-saved every 2 seconds to prevent data loss
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {product && product.is_verified && product.verified_at && (
          <div className="px-6">
            <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
              <Shield className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-100">
                This product has been verified by Alkatera on{" "}
                {new Date(product.verified_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . It will appear in material search results.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {(!product || (product && !product.is_verified)) && (
          <div className="px-6">
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-100">
                Products require verification by Alkatera before appearing in material search. You
                will be notified when verification is complete.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="impacts" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Environmental Impacts
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[calc(90vh-320px)] px-6">
              <TabsContent value="basic" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={basicData.name}
                    onChange={(e) => setBasicData({ ...basicData, name: e.target.value })}
                    placeholder="e.g., Organic Sugar Cane"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_code">Product Code / SKU</Label>
                  <Input
                    id="product_code"
                    value={basicData.product_code}
                    onChange={(e) => setBasicData({ ...basicData, product_code: e.target.value })}
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
                        <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={basicData.category}
                    onValueChange={(value) => setBasicData({ ...basicData, category: value })}
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
                    value={basicData.description}
                    onChange={(e) => setBasicData({ ...basicData, description: e.target.value })}
                    placeholder="Additional details about this product..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={basicData.unit}
                    onValueChange={(value) => setBasicData({ ...basicData, unit: value })}
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

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="is_active"
                    checked={basicData.is_active}
                    onCheckedChange={(checked) => setBasicData({ ...basicData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Product is active and available
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="impacts" className="mt-4">
                <SupplierProductImpactForm
                  formData={impactData}
                  onChange={(updates) => setImpactData((prev) => ({ ...prev, ...updates }))}
                  unit={basicData.unit}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-2">
                {hasUnsavedChanges && !product && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscardDraft}
                    disabled={loading || uploading || savingDraft}
                  >
                    Discard Draft
                  </Button>
                )}
                {hasUnsavedChanges && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={loading || uploading || savingDraft}
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCloseWithWarning(true)}
                  disabled={loading || uploading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || uploading || !basicData.name}>
                  {uploading ? "Uploading..." : loading ? "Saving..." : product ? "Update Product" : "Add Product"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
