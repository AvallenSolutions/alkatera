"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import type { MaturationProfile } from "@/lib/types/maturation";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  latest_lca_id?: string | null;
}

interface ProductionFacility {
  id: string;
  name: string;
  address_lat: number | null;
  address_lng: number | null;
  production_share?: number;
}

const DEFAULT_INGREDIENT: IngredientFormData = {
  tempId: `temp-${Date.now()}`,
  name: '',
  data_source: null,
  amount: '',
  unit: 'kg',
  origin_country: '',
  is_organic_certified: false,
  transport_mode: 'truck',
  distance_km: '',
};

const createDefaultPackaging = (): PackagingFormData => ({
  tempId: `temp-pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
  has_component_breakdown: false,
  components: [],
  epr_packaging_level: undefined,
  epr_packaging_activity: undefined,
  epr_is_household: true,
  epr_ram_rating: undefined,
  epr_uk_nation: undefined,
  epr_is_drinks_container: false,
});

// Simple fingerprint for comparing form states (ignores tempId)
function formFingerprint(forms: Array<{ name?: string; amount?: string | number; unit?: string; [key: string]: any }>): string {
  return JSON.stringify(forms.map(f => ({
    name: f.name || '',
    amount: String(f.amount || ''),
    unit: f.unit || '',
    origin_country: f.origin_country || '',
    data_source: f.data_source || null,
    packaging_category: (f as any).packaging_category || '',
  })));
}

export function useRecipeEditor(productId: string, organizationId: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [productionFacilities, setProductionFacilities] = useState<ProductionFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dirty state tracking
  const savedIngredientSnapshot = useRef<string>('');
  const savedPackagingSnapshot = useRef<string>('');

  const [ingredientForms, setIngredientForms] = useState<IngredientFormData[]>([
    { ...DEFAULT_INGREDIENT, tempId: `temp-${Date.now()}` },
  ]);

  const [packagingForms, setPackagingForms] = useState<PackagingFormData[]>([
    createDefaultPackaging(),
  ]);

  // Maturation profile state
  const [maturationProfile, setMaturationProfile] = useState<MaturationProfile | null>(null);
  const savedMaturationSnapshot = useRef<string>('');
  const [maturationDirty, setMaturationDirty] = useState(false);

  const fetchProductData = useCallback(async () => {
    if (!productId || !organizationId) return;

    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      // Fetch production sites
      let facilitiesToUse: ProductionFacility[] = [];

      const { data: assignmentsData } = await supabase
        .from("facility_product_assignments")
        .select(`
          id, facility_id, is_primary_facility,
          facilities ( id, name, address_lat, address_lng )
        `)
        .eq("product_id", productId)
        .eq("assignment_status", "active");

      if (assignmentsData && assignmentsData.length > 0) {
        const assignedFacilities = assignmentsData
          .filter((a: any) => a.facilities && a.facilities.address_lat && a.facilities.address_lng)
          .map((a: any) => ({
            id: a.facilities.id,
            name: a.facilities.name,
            address_lat: typeof a.facilities.address_lat === 'string' ? parseFloat(a.facilities.address_lat) : a.facilities.address_lat,
            address_lng: typeof a.facilities.address_lng === 'string' ? parseFloat(a.facilities.address_lng) : a.facilities.address_lng,
            production_share: a.is_primary_facility ? 100 : 0,
          }));
        facilitiesToUse.push(...assignedFacilities);
      }

      // Legacy fallback
      if (productData.latest_lca_id && facilitiesToUse.length === 0) {
        const result = await supabase
          .from("product_carbon_footprint_production_sites")
          .select(`
            id, share_of_production,
            facilities:facility_id ( id, name, address_lat, address_lng )
          `)
          .eq("product_carbon_footprint_id", productData.latest_lca_id);

        if (result.data && result.data.length > 0) {
          const ownedFacilities = result.data
            .filter((ps: any) => ps.facilities && ps.facilities.address_lat && ps.facilities.address_lng)
            .map((ps: any) => ({
              id: ps.facilities.id,
              name: ps.facilities.name,
              address_lat: typeof ps.facilities.address_lat === 'string' ? parseFloat(ps.facilities.address_lat) : ps.facilities.address_lat,
              address_lng: typeof ps.facilities.address_lng === 'string' ? parseFloat(ps.facilities.address_lng) : ps.facilities.address_lng,
              production_share: ps.share_of_production || 0,
            }));
          facilitiesToUse.push(...ownedFacilities);
        }
      }

      // Contract manufacturers
      const { data: contractMfgData } = await supabase
        .from("contract_manufacturer_allocation_summary")
        .select(`id, facility_id, facility_name, attribution_ratio`)
        .eq("product_id", productId);

      if (contractMfgData && contractMfgData.length > 0) {
        const facilityIds = contractMfgData.map((cm: any) => cm.facility_id);
        const { data: facilityCoords } = await supabase
          .from("facilities")
          .select("id, name, address_lat, address_lng")
          .in("id", facilityIds);

        if (facilityCoords && facilityCoords.length > 0) {
          for (const cm of contractMfgData) {
            const facilityData = facilityCoords.find((f: any) => f.id === cm.facility_id);
            if (facilityData && facilityData.address_lat && facilityData.address_lng) {
              facilitiesToUse.push({
                id: facilityData.id,
                name: facilityData.name,
                address_lat: typeof facilityData.address_lat === 'string' ? parseFloat(facilityData.address_lat) : facilityData.address_lat,
                address_lng: typeof facilityData.address_lng === 'string' ? parseFloat(facilityData.address_lng) : facilityData.address_lng,
                production_share: ((cm.attribution_ratio || 0) * 100),
              });
            }
          }
        }
      }

      setProductionFacilities(facilitiesToUse);

      // Load materials
      const { data: materialsData, error: materialsError } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (materialsError) throw materialsError;

      const ingredientItems = materialsData?.filter(m => m.material_type === 'ingredient') || [];
      const packagingItems = materialsData?.filter(m => m.material_type === 'packaging') || [];

      if (ingredientItems.length > 0) {
        const mappedIngredients = ingredientItems.map(item => ({
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
        }));
        setIngredientForms(mappedIngredients);
        savedIngredientSnapshot.current = formFingerprint(mappedIngredients);
      } else {
        const defaultForms = [{ ...DEFAULT_INGREDIENT, tempId: `temp-${Date.now()}` }];
        setIngredientForms(defaultForms);
        savedIngredientSnapshot.current = formFingerprint(defaultForms);
      }

      if (packagingItems.length > 0) {
        const mappedPackaging = packagingItems.map(item => {
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
            recycled_content_percentage: item.recycled_content_percentage || '',
            printing_process: item.printing_process || 'standard_ink',
            net_weight_g: item.net_weight_g || item.quantity || '',
            origin_country: item.origin_country || '',
            origin_address: item.origin_address || '',
            origin_lat: item.origin_lat || undefined,
            origin_lng: item.origin_lng || undefined,
            origin_country_code: item.origin_country_code || '',
            transport_mode: item.transport_mode || 'truck',
            distance_km: item.distance_km || '',
            has_component_breakdown: item.has_component_breakdown || false,
            components: [],
            epr_packaging_level: item.epr_packaging_level || undefined,
            epr_packaging_activity: item.epr_packaging_activity || undefined,
            epr_is_household: item.epr_is_household !== undefined ? item.epr_is_household : true,
            epr_ram_rating: item.epr_ram_rating || undefined,
            epr_uk_nation: item.epr_uk_nation || undefined,
            epr_is_drinks_container: item.epr_is_drinks_container || false,
          };
        });
        setPackagingForms(mappedPackaging);
        savedPackagingSnapshot.current = formFingerprint(mappedPackaging);
      } else {
        const defaultPkg = [createDefaultPackaging()];
        setPackagingForms(defaultPkg);
        savedPackagingSnapshot.current = formFingerprint(defaultPkg);
      }

      // Load maturation profile (optional — only for spirits/wine)
      const { data: matProfile } = await supabase
        .from("maturation_profiles")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      setMaturationProfile(matProfile as MaturationProfile | null);
      savedMaturationSnapshot.current = matProfile ? JSON.stringify(matProfile) : '';
      setMaturationDirty(false);
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  }, [productId, organizationId]);

  useEffect(() => {
    if (productId && organizationId) {
      fetchProductData();
    }
  }, [fetchProductData]);

  // CRUD operations
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
      { ...DEFAULT_INGREDIENT, tempId: `temp-${Date.now()}` },
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
    setPackagingForms(prev => [...prev, createDefaultPackaging()]);
  };

  const addPackagingWithType = (category: PackagingCategory) => {
    setPackagingForms(prev => [
      ...prev,
      { ...createDefaultPackaging(), packaging_category: category },
    ]);
    toast.info(`Adding new ${category} packaging. Your existing items are preserved.`);
  };

  // Save operations
  const saveIngredients = async () => {
    const validForms = ingredientForms.filter(f => f.name && f.amount && Number(f.amount) > 0);

    const { data: { user } } = await supabase.auth.getUser();
    if (validForms.length === 0) {
      toast.error("Please add at least one valid ingredient");
      return;
    }
    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    toast.info(`Saving ${validForms.length} ingredient${validForms.length === 1 ? '' : 's'}...`, { id: "save-ingredients" });

    try {
      const { error: deleteError } = await supabase
        .from("product_materials")
        .delete()
        .eq("product_id", productId)
        .eq("material_type", "ingredient");

      if (deleteError) throw new Error(`Failed to clear existing ingredients: ${deleteError.message}`);

      const materialsToInsert = validForms.map(form => {
        const materialData: any = {
          product_id: parseInt(productId),
          material_name: form.name,
          quantity: Number(form.amount),
          unit: form.unit,
          material_type: 'ingredient',
          origin_country: form.origin_country || null,
          is_organic_certified: form.is_organic_certified || false,
        };

        if (form.data_source === 'openlca' && form.data_source_id) {
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }

        if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km = Number(form.distance_km);
        }

        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        return materialData;
      });

      const { error: insertError } = await supabase
        .from("product_materials")
        .insert(materialsToInsert)
        .select();

      if (insertError) throw new Error(`Failed to save ingredients: ${insertError.message}`);

      toast.success(`${validForms.length} ingredient${validForms.length === 1 ? '' : 's'} saved successfully`, { id: "save-ingredients" });
      await fetchProductData();
    } catch (error: any) {
      console.error("Save ingredients error:", error);
      toast.error(error.message || "Failed to save ingredients", { id: "save-ingredients" });
    } finally {
      setSaving(false);
    }
  };

  const savePackaging = async () => {
    const validationErrors: string[] = [];
    packagingForms.forEach((form, idx) => {
      const formErrors: string[] = [];
      if (!form.packaging_category) formErrors.push('packaging type');
      if (!form.name) formErrors.push('material name');
      if (!form.amount && !form.net_weight_g) formErrors.push('net weight');
      else if (Number(form.amount) <= 0 && Number(form.net_weight_g) <= 0) formErrors.push('net weight (must be greater than 0)');
      if (formErrors.length > 0) validationErrors.push(`Packaging ${idx + 1}: missing ${formErrors.join(', ')}`);
    });

    const validForms = packagingForms.filter(
      f => f.name && f.amount && Number(f.amount) > 0 && f.packaging_category
    );

    if (validForms.length === 0) {
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
      } else {
        toast.error("Please add at least one valid packaging item with type, material name, and net weight");
      }
      return;
    }

    if (validForms.length < packagingForms.length) {
      const skippedCount = packagingForms.length - validForms.length;
      toast.warning(`${skippedCount} incomplete packaging item${skippedCount > 1 ? 's' : ''} will be skipped`);
    }

    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    toast.info(`Saving ${validForms.length} packaging item${validForms.length === 1 ? '' : 's'}...`, { id: "save-packaging" });

    try {
      const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
      const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
      const idsToKeep = existingItems.map(f => f.tempId);

      const { data: currentPackaging } = await supabase
        .from("product_materials")
        .select("id")
        .eq("product_id", productId)
        .eq("material_type", "packaging");

      if (currentPackaging && currentPackaging.length > 0) {
        const idsToDelete = currentPackaging
          .map(p => p.id)
          .filter(id => !idsToKeep.includes(id.toString()));

        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("product_materials")
            .delete()
            .in("id", idsToDelete);
          if (deleteError) throw new Error(`Failed to remove old packaging: ${deleteError.message}`);
        }
      }

      const buildMaterialData = (form: PackagingFormData) => {
        const materialData: any = {
          product_id: parseInt(productId),
          material_name: form.name,
          quantity: Number(form.amount),
          unit: form.unit,
          material_type: 'packaging',
          packaging_category: form.packaging_category || null,
          origin_country: form.origin_country || null,
          net_weight_g: Number(form.net_weight_g) || null,
          recycled_content_percentage: form.recycled_content_percentage ? Number(form.recycled_content_percentage) : null,
          printing_process: form.printing_process || null,
        };

        if (form.data_source === 'openlca' && form.data_source_id) {
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }

        if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km = Number(form.distance_km);
        }

        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        materialData.has_component_breakdown = form.has_component_breakdown || false;
        if (form.epr_packaging_level) materialData.epr_packaging_level = form.epr_packaging_level;
        if (form.epr_packaging_activity) materialData.epr_packaging_activity = form.epr_packaging_activity;
        materialData.epr_is_household = form.epr_is_household !== undefined ? form.epr_is_household : true;
        if (form.epr_ram_rating) materialData.epr_ram_rating = form.epr_ram_rating;
        if (form.epr_uk_nation) materialData.epr_uk_nation = form.epr_uk_nation;
        materialData.epr_is_drinks_container = form.epr_is_drinks_container || false;

        return materialData;
      };

      // Update existing items
      for (const form of existingItems) {
        const materialData = buildMaterialData(form);
        const { error: updateError } = await supabase
          .from("product_materials")
          .update(materialData)
          .eq("id", form.tempId);
        if (updateError) throw new Error(`Failed to update packaging: ${updateError.message}`);
      }

      // Insert new items
      let insertedData: any[] = [];
      if (newItems.length > 0) {
        const materialsToInsert = newItems.map(buildMaterialData);
        const { data, error: insertError } = await supabase
          .from("product_materials")
          .insert(materialsToInsert)
          .select();
        if (insertError) throw new Error(`Failed to save packaging: ${insertError.message}`);
        insertedData = data || [];
      }

      // Save components
      for (const form of validForms) {
        if (form.has_component_breakdown && form.components && form.components.length > 0) {
          let materialId: number | null = null;
          if (!form.tempId.startsWith('temp-')) {
            materialId = parseInt(form.tempId);
          } else {
            const insertedItem = insertedData.find((d: any) =>
              d.material_name === form.name && d.packaging_category === form.packaging_category
            );
            if (insertedItem) materialId = insertedItem.id;
          }

          if (materialId) {
            await supabase
              .from('packaging_material_components')
              .delete()
              .eq('product_material_id', materialId);

            const componentsToInsert = form.components.map(comp => ({
              product_material_id: materialId,
              epr_material_type: comp.epr_material_type,
              component_name: comp.component_name,
              weight_grams: comp.weight_grams,
              recycled_content_percentage: comp.recycled_content_percentage || 0,
              is_recyclable: comp.is_recyclable !== undefined ? comp.is_recyclable : true,
            }));

            await supabase
              .from('packaging_material_components')
              .insert(componentsToInsert);
          }
        }
      }

      toast.success(`${validForms.length} packaging item${validForms.length === 1 ? '' : 's'} saved successfully`, { id: "save-packaging" });
      await fetchProductData();
    } catch (error: any) {
      console.error("Save packaging error:", error);
      toast.error(`Failed to save packaging: ${error.message || 'Unknown error'}`, { id: "save-packaging" });
    } finally {
      setSaving(false);
    }
  };

  // Maturation CRUD
  const updateMaturationProfile = (updates: Partial<MaturationProfile>) => {
    setMaturationProfile(prev => prev ? { ...prev, ...updates } : null);
    setMaturationDirty(true);
  };

  const saveMaturation = async (profile: Omit<MaturationProfile, 'id' | 'created_at' | 'updated_at'>) => {
    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    toast.info("Saving maturation profile...", { id: "save-maturation" });

    try {
      const payload = {
        product_id: parseInt(productId),
        organization_id: organizationId,
        barrel_type: profile.barrel_type,
        barrel_volume_litres: profile.barrel_volume_litres,
        barrel_use_number: profile.barrel_use_number,
        barrel_co2e_new: profile.barrel_co2e_new || null,
        aging_duration_months: profile.aging_duration_months,
        angel_share_percent_per_year: profile.angel_share_percent_per_year,
        climate_zone: profile.climate_zone,
        fill_volume_litres: profile.fill_volume_litres,
        number_of_barrels: profile.number_of_barrels,
        warehouse_energy_kwh_per_barrel_year: profile.warehouse_energy_kwh_per_barrel_year,
        warehouse_energy_source: profile.warehouse_energy_source,
        allocation_method: profile.allocation_method,
        bottles_produced: profile.bottles_produced || null,
        notes: profile.notes || null,
      };

      // Upsert: if profile exists, update; otherwise insert
      if (maturationProfile?.id) {
        const { error } = await supabase
          .from("maturation_profiles")
          .update(payload)
          .eq("id", maturationProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maturation_profiles")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Maturation profile saved", { id: "save-maturation" });
      setMaturationDirty(false);
      await fetchProductData();
    } catch (error: any) {
      console.error("Save maturation error:", error);
      toast.error(error.message || "Failed to save maturation profile", { id: "save-maturation" });
    } finally {
      setSaving(false);
    }
  };

  const removeMaturation = async () => {
    if (!maturationProfile?.id) {
      setMaturationProfile(null);
      setMaturationDirty(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("maturation_profiles")
        .delete()
        .eq("id", maturationProfile.id);

      if (error) throw error;

      setMaturationProfile(null);
      setMaturationDirty(false);
      toast.success("Maturation profile removed");
      await fetchProductData();
    } catch (error: any) {
      console.error("Remove maturation error:", error);
      toast.error(error.message || "Failed to remove maturation profile");
    } finally {
      setSaving(false);
    }
  };

  const ingredientCount = ingredientForms.filter(f => f.name && f.amount).length;
  const packagingCount = packagingForms.filter(f => f.name && f.amount && f.packaging_category).length;

  // Dirty state: compare current forms against last-saved snapshot
  const isDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current ||
    formFingerprint(packagingForms) !== savedPackagingSnapshot.current ||
    maturationDirty;

  return {
    product,
    productionFacilities,
    loading,
    saving,
    isDirty,
    ingredientForms,
    packagingForms,
    maturationProfile,
    ingredientCount,
    packagingCount,
    hasMaturationProfile: !!maturationProfile,
    totalItems: ingredientCount + packagingCount,
    fetchProductData,
    updateIngredient,
    removeIngredient,
    addIngredient,
    updatePackaging,
    removePackaging,
    addPackaging,
    addPackagingWithType,
    saveIngredients,
    savePackaging,
    updateMaturationProfile,
    saveMaturation,
    removeMaturation,
  };
}
