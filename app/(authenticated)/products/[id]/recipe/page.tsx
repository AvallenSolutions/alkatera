"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Leaf,
  Box,
  Info,
  Plus,
  Sparkles,
  Settings,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { IngredientFormCard, IngredientFormData } from "@/components/products/IngredientFormCard";
import { PackagingFormCard, PackagingFormData } from "@/components/products/PackagingFormCard";
import { OpenLCAConfigDialog } from "@/components/lca/OpenLCAConfigDialog";
import { BOMImportFlow } from "@/components/products/BOMImportFlow";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
}

interface ProductionFacility {
  id: string;
  name: string;
  address_lat: number | null;
  address_lng: number | null;
  production_share?: number;
}

export default function ProductRecipePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [product, setProduct] = useState<Product | null>(null);
  const [productionFacilities, setProductionFacilities] = useState<ProductionFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showOpenLCAConfig, setShowOpenLCAConfig] = useState(false);
  const [showBOMImport, setShowBOMImport] = useState(false);

  const [ingredientForms, setIngredientForms] = useState<IngredientFormData[]>([
    {
      tempId: `temp-${Date.now()}`,
      name: '',
      data_source: null,
      amount: '',
      unit: 'kg',
      origin_country: '',
      is_organic_certified: false,
      transport_mode: 'truck',
      distance_km: '',
    }
  ]);

  const [packagingForms, setPackagingForms] = useState<PackagingFormData[]>([
    {
      tempId: `temp-pkg-${Date.now()}`,
      name: '',
      data_source: null,
      amount: '',
      unit: 'g',
      packaging_category: 'container',
      recycled_content_percentage: '',
      printing_process: 'standard_ink',
      net_weight_g: '',
      origin_country: '',
      transport_mode: 'truck',
      distance_km: '',
    }
  ]);

  useEffect(() => {
    if (productId && currentOrganization?.id) {
      fetchProductData();
    }
  }, [productId, currentOrganization?.id]);

  const fetchProductData = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from("facilities")
        .select("id, name, address_lat, address_lng")
        .eq("organization_id", currentOrganization?.id);

      if (!facilitiesError && facilitiesData) {
        setProductionFacilities(facilitiesData.filter(f => f.address_lat && f.address_lng) as ProductionFacility[]);
      }

      const { data: materialsData, error: materialsError } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (materialsError) throw materialsError;

      const ingredientItems = materialsData?.filter(m => m.material_type === 'ingredient') || [];
      const packagingItems = materialsData?.filter(m => m.material_type === 'packaging') || [];

      if (ingredientItems.length > 0) {
        setIngredientForms(ingredientItems.map(item => ({
          tempId: item.id,
          name: item.material_name,
          data_source: item.data_source as any,
          data_source_id: item.data_source_id,
          supplier_product_id: item.supplier_product_id,
          amount: item.quantity,
          unit: item.unit || 'kg',
          origin_country: item.origin_country || '',
          origin_address: item.origin_address || '',
          origin_lat: item.origin_lat || undefined,
          origin_lng: item.origin_lng || undefined,
          origin_country_code: item.origin_country_code || '',
          is_organic_certified: item.is_organic_certified || false,
          transport_mode: item.transport_mode || 'truck',
          distance_km: item.distance_km || '',
        })));
      }

      if (packagingItems.length > 0) {
        setPackagingForms(packagingItems.map(item => {
          const categoryMatch = item.notes?.match(/Category: (\w+)/);
          return {
            tempId: item.id,
            name: item.material_name,
            data_source: item.data_source as any,
            data_source_id: item.data_source_id,
            supplier_product_id: item.supplier_product_id,
            amount: item.quantity,
            unit: item.unit || 'g',
            packaging_category: item.packaging_category || (categoryMatch ? categoryMatch[1] : 'container'),
            recycled_content_percentage: '',
            printing_process: 'standard_ink',
            net_weight_g: item.quantity || '',
            origin_country: item.origin_country || '',
            origin_address: item.origin_address || '',
            origin_lat: item.origin_lat || undefined,
            origin_lng: item.origin_lng || undefined,
            origin_country_code: item.origin_country_code || '',
            transport_mode: item.transport_mode || 'truck',
            distance_km: item.distance_km || '',
          };
        }));
      }
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  };

  const updateIngredient = (tempId: string, updates: Partial<IngredientFormData>) => {
    setIngredientForms(prev =>
      prev.map(form => form.tempId === tempId ? { ...form, ...updates } : form)
    );
  };

  const removeIngredient = (tempId: string) => {
    if (ingredientForms.length > 1) {
      setIngredientForms(prev => prev.filter(form => form.tempId !== tempId));
    }
  };

  const addIngredient = () => {
    setIngredientForms(prev => [
      ...prev,
      {
        tempId: `temp-${Date.now()}`,
        name: '',
        data_source: null,
        amount: '',
        unit: 'kg',
        origin_country: '',
        is_organic_certified: false,
        transport_mode: 'truck',
        distance_km: '',
      }
    ]);
  };

  const updatePackaging = (tempId: string, updates: Partial<PackagingFormData>) => {
    setPackagingForms(prev =>
      prev.map(form => form.tempId === tempId ? { ...form, ...updates } : form)
    );
  };

  const removePackaging = (tempId: string) => {
    if (packagingForms.length > 1) {
      setPackagingForms(prev => prev.filter(form => form.tempId !== tempId));
    }
  };

  const addPackaging = () => {
    setPackagingForms(prev => [
      ...prev,
      {
        tempId: `temp-pkg-${Date.now()}`,
        name: '',
        data_source: null,
        amount: '',
        unit: 'g',
        packaging_category: 'container',
        recycled_content_percentage: '',
        printing_process: 'standard_ink',
        net_weight_g: '',
        origin_country: '',
        transport_mode: 'truck',
        distance_km: '',
      }
    ]);
  };

  const handleBOMImportComplete = async (
    importedIngredients: IngredientFormData[],
    importedPackaging: PackagingFormData[]
  ) => {
    setSaving(true);

    try {
      const totalImported = importedIngredients.length + importedPackaging.length;

      if (totalImported === 0) {
        toast.error('No items to import');
        return;
      }

      if (importedIngredients.length > 0) {
        await saveBOMIngredients(importedIngredients);
      }

      if (importedPackaging.length > 0) {
        await saveBOMPackaging(importedPackaging);
      }

      toast.success(`Imported and saved ${totalImported} item${totalImported !== 1 ? 's' : ''} from BOM`);

      await fetchProductData();

      if (importedIngredients.length > 0 && importedPackaging.length === 0) {
        setActiveTab('ingredients');
      } else if (importedPackaging.length > 0 && importedIngredients.length === 0) {
        setActiveTab('packaging');
      }
    } catch (error: any) {
      console.error('BOM import error:', error);
      toast.error(`Failed to import BOM: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveBOMIngredients = async (forms: IngredientFormData[]) => {
    const validForms = forms.filter(f => f.name && f.amount && Number(f.amount) > 0);

    if (validForms.length === 0) {
      throw new Error('No valid ingredients to save');
    }

    if (!currentOrganization?.id) {
      throw new Error('No organization selected');
    }

    const { error: deleteError } = await supabase
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .eq('material_type', 'ingredient');

    if (deleteError) {
      throw new Error(`Failed to clear existing ingredients: ${deleteError.message}`);
    }

    const materialsToInsert = validForms.map(form => ({
      product_id: parseInt(productId),
      material_name: form.name,
      quantity: Number(form.amount),
      unit: form.unit,
      material_type: 'ingredient',
      origin_country: form.origin_country || null,
      is_organic_certified: form.is_organic_certified || false,
      transport_mode: form.transport_mode || 'truck',
      distance_km: form.distance_km ? Number(form.distance_km) : null,
    }));

    const { error: insertError } = await supabase
      .from('product_materials')
      .insert(materialsToInsert);

    if (insertError) {
      throw new Error(`Failed to save ingredients: ${insertError.message}`);
    }
  };

  const saveBOMPackaging = async (forms: PackagingFormData[]) => {
    const validForms = forms.filter(
      f => f.name && f.amount && Number(f.amount) > 0
    );

    if (validForms.length === 0) {
      throw new Error('No valid packaging to save');
    }

    if (!currentOrganization?.id) {
      throw new Error('No organization selected');
    }

    const { error: deleteError } = await supabase
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .eq('material_type', 'packaging');

    if (deleteError) {
      throw new Error(`Failed to clear existing packaging: ${deleteError.message}`);
    }

    const materialsToInsert = validForms.map(form => ({
      product_id: parseInt(productId),
      material_name: form.name,
      quantity: Number(form.net_weight_g) || Number(form.amount),
      unit: form.unit,
      material_type: 'packaging',
      packaging_category: form.packaging_category || null,
      origin_country: form.origin_country || null,
      transport_mode: form.transport_mode || 'truck',
      distance_km: form.distance_km ? Number(form.distance_km) : null,
    }));

    const { error: insertError } = await supabase
      .from('product_materials')
      .insert(materialsToInsert);

    if (insertError) {
      throw new Error(`Failed to save packaging: ${insertError.message}`);
    }
  };

  const saveIngredients = async () => {
    const validForms = ingredientForms.filter(f => f.name && f.amount && Number(f.amount) > 0);

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();

    console.log('=== SAVE INGREDIENTS START ===');
    console.log('Current user:', user?.id, user?.email);
    console.log('validForms:', validForms);
    console.log('productId:', productId, 'type:', typeof productId);
    console.log('currentOrganization:', currentOrganization);

    if (validForms.length === 0) {
      console.log('ERROR: No valid forms');
      toast.error("Please add at least one valid ingredient");
      return;
    }

    if (!currentOrganization?.id) {
      console.log('ERROR: No organization');
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    try {
      console.log('Step 1: Deleting existing ingredients...');
      // Delete existing ingredients
      const { error: deleteError } = await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId)
        .eq("material_type", "ingredient");

      if (deleteError) {
        console.error("Delete error:", deleteError);
        toast.error(`Delete failed: ${deleteError.message}`);
        throw new Error(`Failed to clear existing ingredients: ${deleteError.message}`);
      }
      console.log('Step 1: Delete successful');

      // Prepare materials to insert
      const materialsToInsert = validForms.map(form => {
        // Handle data source fields according to constraint requirements
        const materialData: any = {
          product_id: parseInt(productId),
          material_name: form.name,
          quantity: Number(form.amount),
          unit: form.unit,
          material_type: 'ingredient',
          origin_country: form.origin_country || null,
          is_organic_certified: form.is_organic_certified || false,
        };

        // Only include data_source if it's a valid value with required fields
        if (form.data_source === 'openlca' && form.data_source_id) {
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }
        // Otherwise, leave data_source as null (don't include it)

        // Include transport data if available
        if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km = Number(form.distance_km);
        }

        // Include origin geolocation data if available
        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        return materialData;
      });

      console.log('Step 2: Prepared materials to insert:', JSON.stringify(materialsToInsert, null, 2));

      // Insert new ingredients
      const { data: insertedData, error: insertError } = await supabase
        .from("product_materials")
        .insert(materialsToInsert)
        .select();

      if (insertError) {
        console.error("Insert error object:", insertError);
        console.error("Insert error details:", JSON.stringify(insertError, null, 2));
        toast.error(`Insert failed: ${insertError.message}`);
        throw new Error(`Failed to save ingredients: ${insertError.message}`);
      }

      console.log('Step 2: Insert successful, data:', insertedData);
      console.log('=== SAVE INGREDIENTS SUCCESS ===');

      toast.success(`${validForms.length} ingredient${validForms.length === 1 ? '' : 's'} saved successfully`);
      await fetchProductData();
    } catch (error: any) {
      console.error("=== SAVE INGREDIENTS ERROR ===");
      console.error("Error object:", error);
      console.error("Error stack:", error.stack);
      toast.error(error.message || "Failed to save ingredients");
    } finally {
      setSaving(false);
    }
  };

  const savePackaging = async () => {
    console.log('=== SAVE PACKAGING DEBUG ===');
    console.log('All packaging forms:', packagingForms);

    packagingForms.forEach((form, idx) => {
      console.log(`Form ${idx}:`, {
        name: form.name,
        hasName: !!form.name,
        amount: form.amount,
        hasAmount: !!form.amount,
        amountNumber: Number(form.amount),
        amountValid: Number(form.amount) > 0,
        packaging_category: form.packaging_category,
        hasCategory: !!form.packaging_category,
      });
    });

    const validForms = packagingForms.filter(
      f => f.name && f.amount && Number(f.amount) > 0 && f.packaging_category
    );

    console.log('Valid forms:', validForms);
    console.log('Product ID:', productId);
    console.log('Current Organization:', currentOrganization);

    if (validForms.length === 0) {
      toast.error("Please add at least one valid packaging item with category selected");
      return;
    }

    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    try {
      // Delete existing packaging
      const { error: deleteError } = await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId)
        .eq("material_type", "packaging");

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw new Error(`Failed to clear existing packaging: ${deleteError.message}`);
      }

      // Prepare materials to insert
      const materialsToInsert = validForms.map(form => {
        // Handle data source fields according to constraint requirements
        const materialData: any = {
          product_id: parseInt(productId),
          material_name: form.name,
          quantity: Number(form.net_weight_g) || Number(form.amount),
          unit: form.unit,
          material_type: 'packaging',
          packaging_category: form.packaging_category || null,
          origin_country: form.origin_country || null,
        };

        // Only include data_source if it's a valid value with required fields
        if (form.data_source === 'openlca' && form.data_source_id) {
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }
        // Otherwise, leave data_source as null (don't include it)

        // Include transport data if available
        if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km = Number(form.distance_km);
        }

        // Include origin geolocation data if available
        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        return materialData;
      });

      console.log('Inserting materials:', materialsToInsert);

      // Insert new packaging
      const { data: insertedData, error: insertError } = await supabase
        .from("product_materials")
        .insert(materialsToInsert)
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to save packaging: ${insertError.message}`);
      }

      console.log('=== INSERT SUCCESSFUL ===');
      console.log('Inserted data:', insertedData);

      // Show success toast
      toast.success(`✓ ${validForms.length} packaging item${validForms.length === 1 ? '' : 's'} saved successfully`);

      // Refetch product data
      console.log('Refetching product data...');
      await fetchProductData();
      console.log('Product data refetched');
    } catch (error: any) {
      console.error("=== ERROR SAVING PACKAGING ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error details:", error);
      toast.error(`Failed to save packaging: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Product Not Found</h2>
          <Link href="/products">
            <Button className="mt-4">Back to Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatFunctionalUnit = () => {
    if (product.functional_unit) return product.functional_unit;
    if (product.unit_size_value && product.unit_size_unit) {
      return `${product.unit_size_value} ${product.unit_size_unit}`;
    }
    return "Not specified";
  };

  const ingredientCount = ingredientForms.filter(f => f.name && f.amount).length;
  const packagingCount = packagingForms.filter(f => f.name && f.amount && f.packaging_category).length;
  const totalItems = ingredientCount + packagingCount;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">
            {product.sku && `SKU: ${product.sku} · `}
            Functional Unit: {formatFunctionalUnit()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowBOMImport(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import from BOM
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOpenLCAConfig(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure OpenLCA
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipe Completeness</CardTitle>
              <CardDescription>Track your bill of materials progress</CardDescription>
            </div>
            <Badge variant={totalItems > 0 ? "default" : "secondary"} className="bg-green-600">
              {totalItems} {totalItems === 1 ? 'Item' : 'Items'} Added
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Info className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ingredients">
            <Leaf className="h-4 w-4 mr-2" />
            Ingredients
          </TabsTrigger>
          <TabsTrigger value="packaging">
            <Box className="h-4 w-4 mr-2" />
            Packaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.product_image_url && (
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={product.product_image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{product.name}</span>
                </div>

                {product.sku && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Functional Unit</span>
                  <span className="font-medium">{formatFunctionalUnit()}</span>
                </div>

                {product.product_description && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">{product.product_description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recipe Summary</CardTitle>
              <CardDescription>Bill of materials overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Ingredients</h3>
                  <Badge variant="outline">{ingredientCount} items</Badge>
                </div>

                {ingredientCount > 0 ? (
                  <div className="space-y-2">
                    {ingredientForms.filter(f => f.name && f.amount).map((ingredient, index) => (
                      <div key={ingredient.tempId} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{ingredient.name}</p>
                          {ingredient.origin_country && (
                            <p className="text-xs text-muted-foreground">Origin: {ingredient.origin_country}</p>
                          )}
                          {ingredient.is_organic_certified && (
                            <p className="text-xs text-green-600">Organic Certified</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{ingredient.amount} {ingredient.unit}</p>
                          {ingredient.data_source && (
                            <p className="text-xs text-muted-foreground capitalize">{ingredient.data_source}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No ingredients added yet</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Packaging</h3>
                  <Badge variant="outline">{packagingCount} items</Badge>
                </div>

                {packagingCount > 0 ? (
                  <div className="space-y-2">
                    {packagingForms.filter(f => f.name && f.amount && f.packaging_category).map((packaging, index) => (
                      <div key={packaging.tempId} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{packaging.name}</p>
                          {packaging.packaging_category && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {packaging.packaging_category.replace('_', ' ')}
                            </p>
                          )}
                          {packaging.origin_country && (
                            <p className="text-xs text-muted-foreground">Origin: {packaging.origin_country}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{packaging.amount} {packaging.unit}</p>
                          {packaging.data_source && (
                            <p className="text-xs text-muted-foreground capitalize">{packaging.data_source}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No packaging added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle>Recipe & Ingredients</CardTitle>
                  <CardDescription>
                    Build your product recipe with environmental impact data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                  <strong>How to Complete This Form</strong>
                  <br />
                  1. Use the smart search bar to find ingredients from your supplier network (primary data) or the global database (secondary data)
                  <br />
                  2. Enter the quantity used per product unit
                  <br />
                  3. Specify the distance from your ingredient source to your processing site for accurate transport calculations
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {ingredientForms.map((ingredient, index) => (
                  <IngredientFormCard
                    key={ingredient.tempId}
                    ingredient={ingredient}
                    index={index}
                    organizationId={currentOrganization?.id || ''}
                    productionFacilities={productionFacilities}
                    onUpdate={updateIngredient}
                    onRemove={removeIngredient}
                    canRemove={ingredientForms.length > 1}
                  />
                ))}
              </div>

              <Button
                onClick={addIngredient}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Ingredient ({ingredientCount}/{ingredientForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveIngredients} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Ingredients'}
                </Button>
                <Button variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Box className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle>Packaging Materials</CardTitle>
                  <CardDescription>
                    Define your packaging materials with environmental impact data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                  <strong>How to Complete This Form</strong>
                  <br />
                  1. Select the packaging category (Container, Label, Closure, or Secondary)
                  <br />
                  2. Use the smart search bar to find materials from your supplier network or the global database
                  <br />
                  3. Enter the quantity and specify transport distance for accurate calculations
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {packagingForms.map((packaging, index) => (
                  <PackagingFormCard
                    key={packaging.tempId}
                    packaging={packaging}
                    index={index}
                    organizationId={currentOrganization?.id || ''}
                    productionFacilities={productionFacilities}
                    onUpdate={updatePackaging}
                    onRemove={removePackaging}
                    canRemove={packagingForms.length > 1}
                  />
                ))}
              </div>

              <Button
                onClick={addPackaging}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Packaging ({packagingCount}/{packagingForms.length})
              </Button>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={savePackaging} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Packaging'}
                </Button>
                <Button variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OpenLCAConfigDialog
        open={showOpenLCAConfig}
        onOpenChange={setShowOpenLCAConfig}
      />

      <BOMImportFlow
        open={showBOMImport}
        onOpenChange={setShowBOMImport}
        onImportComplete={handleBOMImportComplete}
        organizationId={currentOrganization?.id || ''}
      />
    </div>
  );
}
