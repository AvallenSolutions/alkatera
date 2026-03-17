"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import type { PackagingCategory } from "@/lib/types/lca";
import { OpenLCAConfigDialog } from "@/components/lca/OpenLCAConfigDialog";
import { BOMImportFlow } from "@/components/products/BOMImportFlow";
import { useAutoSave } from "@/hooks/useAutoSave";

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
  const searchParams = useSearchParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [product, setProduct] = useState<Product | null>(null);
  const [productionFacilities, setProductionFacilities] = useState<ProductionFacility[]>([]);
  const [totalLinkedFacilities, setTotalLinkedFacilities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "overview");
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
      // EPR Compliance fields
      has_component_breakdown: false,
      components: [],
      epr_packaging_level: undefined,
      epr_packaging_activity: undefined,
      epr_is_household: true,
      epr_ram_rating: undefined,
      epr_uk_nation: undefined,
      epr_is_drinks_container: false,
      units_per_group: 1,
    }
  ]);

  // --- Autosave infrastructure ---
  const savedIngredientSnapshot = useRef<string>('');
  const savedPackagingSnapshot = useRef<string>('');
  const ingredientFormsRef = useRef(ingredientForms);
  const packagingFormsRef = useRef(packagingForms);
  const savingRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => { ingredientFormsRef.current = ingredientForms; }, [ingredientForms]);
  useEffect(() => { packagingFormsRef.current = packagingForms; }, [packagingForms]);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  const formFingerprint = useCallback((forms: Array<{ [key: string]: any }>): string => {
    return JSON.stringify(forms.map(f => ({
      name: f.name || '',
      amount: String(f.amount || ''),
      unit: f.unit || '',
      origin_country: f.origin_country || '',
      origin_address: f.origin_address || '',
      origin_lat: f.origin_lat || '',
      origin_lng: f.origin_lng || '',
      data_source: f.data_source || null,
      transport_mode: f.transport_mode || '',
      distance_km: String(f.distance_km || ''),
      packaging_category: f.packaging_category || '',
      net_weight_g: String(f.net_weight_g || ''),
      recycled_content_percentage: String(f.recycled_content_percentage || ''),
      printing_process: f.printing_process || '',
      is_organic_certified: f.is_organic_certified || false,
    })));
  }, []);
  // --- End autosave infrastructure ---

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

      // Fetch production sites from multiple sources:
      // 1. facility_product_assignments (NEW - primary source from Facilities tab)
      // 2. product_carbon_footprint_production_sites (legacy - from LCA)
      // 3. Contract manufacturers (contract_manufacturer_allocation_summary)
      let facilitiesToUse: ProductionFacility[] = [];

      // Fetch from facility_product_assignments (primary source - this is where Facilities tab stores links)
      const { data: assignmentsData } = await supabase
        .from("facility_product_assignments")
        .select(`
          id,
          facility_id,
          is_primary_facility,
          facilities (
            id,
            name,
            address_lat,
            address_lng,
            address_line1,
            address_city,
            address_country,
            location_address
          )
        `)
        .eq("product_id", productId)
        .eq("assignment_status", "active");

      if (assignmentsData && assignmentsData.length > 0) {
        // Track total linked facilities (before coordinate filtering)
        const linkedWithFacility = assignmentsData.filter((a: any) => a.facilities);
        setTotalLinkedFacilities(linkedWithFacility.length);

        // Identify facilities that have address info but no coordinates — auto-geocode them
        const facilitiesNeedingGeocode = linkedWithFacility.filter((a: any) => {
          const f = a.facilities;
          const hasCoords = f.address_lat && f.address_lng;
          const hasAddress = f.address_line1 || f.address_city || f.location_address;
          return !hasCoords && hasAddress;
        });

        if (facilitiesNeedingGeocode.length > 0) {
          console.log(`[Production Sites] ${facilitiesNeedingGeocode.length} facility/ies have address but no coordinates — auto-geocoding...`);
          // Geocode in parallel, don't block page load on failures
          const geocodeResults = await Promise.allSettled(
            facilitiesNeedingGeocode.map(async (a: any) => {
              try {
                const response = await fetch('/api/facilities/geocode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ facilityId: a.facilities.id }),
                });
                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.lat && data.lng) {
                    return { facilityId: a.facilities.id, lat: data.lat, lng: data.lng };
                  }
                }
                return null;
              } catch (err) {
                console.warn(`[Production Sites] Failed to geocode facility ${a.facilities.id}:`, err);
                return null;
              }
            })
          );

          // Merge geocoded coordinates back into assignmentsData
          for (const result of geocodeResults) {
            if (result.status === 'fulfilled' && result.value) {
              const { facilityId: geoFacilityId, lat, lng } = result.value;
              const assignment = assignmentsData.find((a: any) => a.facilities?.id === geoFacilityId);
              if (assignment) {
                (assignment as any).facilities.address_lat = lat;
                (assignment as any).facilities.address_lng = lng;
                console.log(`[Production Sites] Auto-geocoded facility ${geoFacilityId}: (${lat}, ${lng})`);
              }
            }
          }
        }

        const assignedFacilities = assignmentsData
          .filter((a: any) => a.facilities && a.facilities.address_lat && a.facilities.address_lng)
          .map((a: any) => {
            const facility = a.facilities;
            return {
              id: facility.id,
              name: facility.name,
              address_lat: typeof facility.address_lat === 'string' ? parseFloat(facility.address_lat) : facility.address_lat,
              address_lng: typeof facility.address_lng === 'string' ? parseFloat(facility.address_lng) : facility.address_lng,
              production_share: a.is_primary_facility ? 100 : 0,
            };
          });
        facilitiesToUse.push(...assignedFacilities);
        console.log(`[Production Sites] Loaded ${assignedFacilities.length} facilities from facility_product_assignments for product ${productId}:`, assignedFacilities);
      }

      // Fetch from legacy product_carbon_footprint_production_sites (fallback for older data)
      if (productData.latest_lca_id && facilitiesToUse.length === 0) {
        const result = await supabase
          .from("product_carbon_footprint_production_sites")
          .select(`
            id,
            share_of_production,
            facilities:facility_id (
              id,
              name,
              address_lat,
              address_lng
            )
          `)
          .eq("product_carbon_footprint_id", productData.latest_lca_id);

        if (result.data && result.data.length > 0) {
          const ownedFacilities = result.data
            .filter((ps: any) => ps.facilities && ps.facilities.address_lat && ps.facilities.address_lng)
            .map((ps: any) => {
              const facility = ps.facilities;
              return {
                id: facility.id,
                name: facility.name,
                address_lat: typeof facility.address_lat === 'string' ? parseFloat(facility.address_lat) : facility.address_lat,
                address_lng: typeof facility.address_lng === 'string' ? parseFloat(facility.address_lng) : facility.address_lng,
                production_share: ps.share_of_production || 0,
              };
            });
          facilitiesToUse.push(...ownedFacilities);
          console.log(`[Production Sites] Loaded ${ownedFacilities.length} owned facilities from legacy LCA data for product ${productId}:`, ownedFacilities);
        }
      }

      // Fetch contract manufacturers
      const { data: contractMfgData } = await supabase
        .from("contract_manufacturer_allocation_summary")
        .select(`
          id,
          facility_id,
          facility_name,
          attribution_ratio
        `)
        .eq("product_id", productId);

      if (contractMfgData && contractMfgData.length > 0) {
        // Get coordinates for contract manufacturer facilities
        const facilityIds = contractMfgData.map((cm: any) => cm.facility_id);
        const { data: facilityCoords } = await supabase
          .from("facilities")
          .select("id, name, address_lat, address_lng")
          .in("id", facilityIds);

        if (facilityCoords && facilityCoords.length > 0) {
          const contractFacilities: ProductionFacility[] = [];

          for (const cm of contractMfgData) {
            const facilityData = facilityCoords.find((f: any) => f.id === cm.facility_id);
            if (facilityData && facilityData.address_lat && facilityData.address_lng) {
              contractFacilities.push({
                id: facilityData.id,
                name: facilityData.name,
                address_lat: typeof facilityData.address_lat === 'string' ? parseFloat(facilityData.address_lat) : facilityData.address_lat,
                address_lng: typeof facilityData.address_lng === 'string' ? parseFloat(facilityData.address_lng) : facilityData.address_lng,
                production_share: ((cm.attribution_ratio || 0) * 100),
              });
            }
          }

          facilitiesToUse.push(...contractFacilities);
          console.log(`[Production Sites] Loaded ${contractFacilities.length} contract manufacturer facilities for product ${productId}:`, contractFacilities);
        }
      }

      if (facilitiesToUse.length === 0) {
        console.warn(`[Facilities] No facilities linked for product ${productId}. Distance calculations will not be available until you link facilities in the Facilities tab.`);
      }

      setProductionFacilities(facilitiesToUse);

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
          matched_source_name: item.matched_source_name || undefined,
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
          // Multi-modal transport legs. If absent, synthesise a single leg from legacy fields
          // so the component always has transport_legs to work with.
          transport_legs: item.transport_legs ?? (
            item.transport_mode ? [{
              id: 'leg_0',
              label: '',
              transportMode: item.transport_mode,
              distanceKm: Number(item.distance_km || 0),
            }] : [{ id: 'leg_0', label: '', transportMode: 'truck', distanceKm: 0 }]
          ),
          // Inbound delivery container
          inbound_container_type:         item.inbound_container_type         ?? null,
          inbound_container_volume_l:     item.inbound_container_volume_l     ?? null,
          inbound_container_tare_kg:      item.inbound_container_tare_kg      ?? null,
          inbound_container_reuse_cycles: item.inbound_container_reuse_cycles ?? null,
          inbound_container_ef:           item.inbound_container_ef           ?? null,
        })));
      }

      if (packagingItems.length > 0) {
        // Load component breakdowns for all packaging items
        const packagingIds = packagingItems.map(p => p.id);
        const { data: allComponents } = await supabase
          .from('packaging_material_components')
          .select('*')
          .in('product_material_id', packagingIds);

        // Group components by parent packaging item
        const componentsByMaterial: Record<string, any[]> = {};
        for (const comp of (allComponents || [])) {
          if (!componentsByMaterial[comp.product_material_id]) {
            componentsByMaterial[comp.product_material_id] = [];
          }
          componentsByMaterial[comp.product_material_id].push({
            id: comp.id,
            product_material_id: comp.product_material_id,
            epr_material_type: comp.epr_material_type,
            component_name: comp.component_name,
            weight_grams: comp.weight_grams,
            recycled_content_percentage: comp.recycled_content_percentage,
            is_recyclable: comp.is_recyclable,
          });
        }

        setPackagingForms(packagingItems.map(item => {
          const categoryMatch = item.notes?.match(/Category: (\w+)/);
          return {
            tempId: item.id,
            name: item.material_name,
            matched_source_name: item.matched_source_name || undefined,
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
            transport_legs: item.transport_legs ?? (
              item.transport_mode
                ? [{ id: 'leg_0', label: '', transportMode: item.transport_mode, distanceKm: Number(item.distance_km || 0) }]
                : [{ id: 'leg_0', label: '', transportMode: 'truck', distanceKm: 0 }]
            ),
            // EPR Compliance fields
            has_component_breakdown: item.has_component_breakdown || false,
            components: componentsByMaterial[item.id] || [],
            epr_packaging_level: item.epr_packaging_level || undefined,
            epr_packaging_activity: item.epr_packaging_activity || undefined,
            epr_is_household: item.epr_is_household !== undefined ? item.epr_is_household : true,
            epr_ram_rating: item.epr_ram_rating || undefined,
            epr_uk_nation: item.epr_uk_nation || undefined,
            epr_is_drinks_container: item.epr_is_drinks_container || false,
            units_per_group: item.units_per_group || 1,
          };
        }));
      }

      // Capture initial snapshots for dirty detection after data load
      // (must happen synchronously after setIngredientForms/setPackagingForms in the same tick)
      setTimeout(() => {
        savedIngredientSnapshot.current = formFingerprint(ingredientFormsRef.current);
        savedPackagingSnapshot.current = formFingerprint(packagingFormsRef.current);
      }, 0);
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
        // EPR Compliance fields
        has_component_breakdown: false,
        components: [],
        epr_packaging_level: undefined,
        epr_packaging_activity: undefined,
        epr_is_household: true,
        epr_ram_rating: undefined,
        epr_uk_nation: undefined,
        epr_is_drinks_container: false,
        units_per_group: 1,
      }
    ]);
  };

  // Add a new packaging item with a specific type pre-selected
  // Used when user clicks a different type on an already-saved item
  const addPackagingWithType = (category: PackagingCategory) => {
    setPackagingForms(prev => [
      ...prev,
      {
        tempId: `temp-pkg-${Date.now()}`,
        name: '',
        data_source: null,
        amount: '',
        unit: 'g',
        packaging_category: category,
        recycled_content_percentage: '',
        printing_process: 'standard_ink',
        net_weight_g: '',
        origin_country: '',
        transport_mode: 'truck',
        distance_km: '',
        // EPR Compliance fields
        has_component_breakdown: false,
        components: [],
        epr_packaging_level: undefined,
        epr_packaging_activity: undefined,
        epr_is_household: true,
        epr_ram_rating: undefined,
        epr_uk_nation: undefined,
        epr_is_drinks_container: false,
        units_per_group: 1,
      }
    ]);
    // Show a helpful toast
    toast.info(`Adding new ${category} packaging. Your existing items are preserved.`);
  };

  // --- Autosave: silent save functions (no toasts, no fetchProductData) ---
  const autoSaveIngredients = useCallback(async (forms: IngredientFormData[]) => {
    const validForms = forms.filter(f => f.name && f.amount && Number(f.amount) > 0);
    if (validForms.length === 0 || !currentOrganization?.id) return;

    const { error: deleteError } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", productId)
      .eq("material_type", "ingredient");
    if (deleteError) throw new Error(`Autosave ingredients failed: ${deleteError.message}`);

    const materialsToInsert = validForms.map(form => {
      const materialData: any = {
        product_id: parseInt(productId),
        material_name: form.name,
        matched_source_name: form.matched_source_name || null,
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
      if (form.transport_legs && form.transport_legs.length > 0) {
        materialData.transport_legs = form.transport_legs;
        materialData.transport_mode = form.transport_legs[0].transportMode;
        materialData.distance_km = form.transport_legs[0].distanceKm;
      } else if (form.transport_mode && form.distance_km) {
        materialData.transport_mode = form.transport_mode;
        materialData.distance_km = Number(form.distance_km);
        materialData.transport_legs = null;
      }
      if (form.origin_lat && form.origin_lng) {
        materialData.origin_lat = form.origin_lat;
        materialData.origin_lng = form.origin_lng;
        materialData.origin_address = form.origin_address || null;
        materialData.origin_country_code = form.origin_country_code || null;
      }
      materialData.inbound_container_type = form.inbound_container_type ?? null;
      materialData.inbound_container_volume_l = form.inbound_container_volume_l ?? null;
      materialData.inbound_container_tare_kg = form.inbound_container_tare_kg ?? null;
      materialData.inbound_container_reuse_cycles = form.inbound_container_reuse_cycles ?? null;
      materialData.inbound_container_ef = form.inbound_container_ef ?? null;
      return materialData;
    });

    const { error: insertError } = await supabase
      .from("product_materials").insert(materialsToInsert).select();
    if (insertError) throw new Error(`Autosave ingredients failed: ${insertError.message}`);
    savedIngredientSnapshot.current = formFingerprint(forms);
  }, [productId, currentOrganization?.id, formFingerprint]);

  const autoSavePackaging = useCallback(async (forms: PackagingFormData[]) => {
    const validForms = forms.filter(
      f => f.name && (Number(f.amount) > 0 || Number(f.net_weight_g) > 0) && f.packaging_category
    );
    if (validForms.length === 0 || !currentOrganization?.id) return;

    const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
    const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
    const idsToKeep = existingItems.map(f => f.tempId);

    const { data: currentPkg } = await supabase
      .from("product_materials").select("id")
      .eq("product_id", productId).eq("material_type", "packaging");

    if (currentPkg && currentPkg.length > 0) {
      const idsToDelete = currentPkg.map(p => p.id).filter(id => !idsToKeep.includes(id.toString()));
      if (idsToDelete.length > 0) {
        const { error } = await supabase.from("product_materials").delete().in("id", idsToDelete);
        if (error) throw new Error(`Autosave packaging failed: ${error.message}`);
      }
    }

    const buildMaterialData = (form: PackagingFormData) => {
      let quantity = Number(form.amount);
      if (!quantity || quantity <= 0 || isNaN(quantity)) {
        const weightG = Number(form.net_weight_g);
        quantity = isNaN(weightG) ? 0 : (form.unit === 'kg' ? weightG / 1000 : weightG);
      }
      const materialData: any = {
        product_id: parseInt(productId),
        material_name: form.name,
        matched_source_name: form.matched_source_name || null,
        quantity, unit: form.unit, material_type: 'packaging',
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
      if (form.transport_legs && form.transport_legs.length > 0) {
        materialData.transport_legs = form.transport_legs;
        materialData.transport_mode = form.transport_legs[0].transportMode;
        materialData.distance_km = form.transport_legs[0].distanceKm;
      } else if (form.transport_mode && form.distance_km) {
        materialData.transport_mode = form.transport_mode;
        materialData.distance_km = Number(form.distance_km);
        materialData.transport_legs = null;
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
      materialData.units_per_group = Number(form.units_per_group) || 1;
      return materialData;
    };

    for (const form of existingItems) {
      const materialData = buildMaterialData(form);
      if (!materialData.quantity || materialData.quantity <= 0 || isNaN(materialData.quantity)) continue;
      const { error } = await supabase.from("product_materials").update(materialData).eq("id", form.tempId);
      if (error) throw new Error(`Autosave packaging failed: ${error.message}`);
    }

    if (newItems.length > 0) {
      const toInsert = newItems.map(buildMaterialData).filter(m => m.quantity > 0 && !isNaN(m.quantity));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("product_materials").insert(toInsert).select();
        if (error) throw new Error(`Autosave packaging failed: ${error.message}`);
      }
    }
    savedPackagingSnapshot.current = formFingerprint(forms);
  }, [productId, currentOrganization?.id, formFingerprint]);

  const performAutoSave = useCallback(async () => {
    if (savingRef.current) return;
    const curIng = ingredientFormsRef.current;
    const curPkg = packagingFormsRef.current;
    const ingDirty = formFingerprint(curIng) !== savedIngredientSnapshot.current;
    const pkgDirty = formFingerprint(curPkg) !== savedPackagingSnapshot.current;
    if (!ingDirty && !pkgDirty) return;
    try {
      if (ingDirty) await autoSaveIngredients(curIng);
      if (pkgDirty) await autoSavePackaging(curPkg);
      setLastSavedAt(new Date());
    } catch (error: any) {
      console.error('Autosave error:', error);
      toast.error('Autosave failed. Your changes are still in memory - use the Save button.', { id: 'autosave-error' });
    }
  }, [autoSaveIngredients, autoSavePackaging, formFingerprint]);

  const { scheduleSave: scheduleAutoSave, cancel: cancelAutoSave, isSaving: autoSaving } = useAutoSave({
    onSave: performAutoSave,
    delay: 8000,
    enabled: !saving && !loading,
  });

  // Trigger autosave when forms change
  useEffect(() => {
    if (loading) return;
    const ingDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current;
    const pkgDirty = formFingerprint(packagingForms) !== savedPackagingSnapshot.current;
    if (ingDirty || pkgDirty) {
      scheduleAutoSave();
    }
  }, [ingredientForms, packagingForms, loading, scheduleAutoSave, formFingerprint]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const ingDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current;
    const pkgDirty = formFingerprint(packagingForms) !== savedPackagingSnapshot.current;
    const handler = (e: BeforeUnloadEvent) => {
      if (ingDirty || pkgDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [ingredientForms, packagingForms, formFingerprint]);
  // --- End autosave ---

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
      matched_source_name: form.matched_source_name || null,
      quantity: Number(form.amount),
      unit: form.unit,
      material_type: 'ingredient',
      origin_country: form.origin_country || null,
      is_organic_certified: form.is_organic_certified || false,
      // Derive single-leg backward-compat fields from transport_legs[0] (or legacy fields)
      transport_mode: form.transport_legs?.[0]?.transportMode ?? form.transport_mode ?? 'truck',
      distance_km:    form.transport_legs?.[0]?.distanceKm    ?? (form.distance_km ? Number(form.distance_km) : null),
      transport_legs: (form.transport_legs && form.transport_legs.length > 0) ? form.transport_legs : null,
      // Inbound delivery container
      inbound_container_type:         form.inbound_container_type         ?? null,
      inbound_container_volume_l:     form.inbound_container_volume_l     ?? null,
      inbound_container_tare_kg:      form.inbound_container_tare_kg      ?? null,
      inbound_container_reuse_cycles: form.inbound_container_reuse_cycles ?? null,
      inbound_container_ef:           form.inbound_container_ef           ?? null,
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
      f => f.name && (Number(f.amount) > 0 || Number(f.net_weight_g) > 0) && f.packaging_category
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

    const materialsToInsert = validForms.map(form => {
      let quantity = Number(form.net_weight_g) || Number(form.amount);
      if (!quantity || quantity <= 0 || isNaN(quantity)) quantity = 0;
      return {
        product_id: parseInt(productId),
        material_name: form.name,
        matched_source_name: form.matched_source_name || null,
        quantity,
        unit: form.unit,
        material_type: 'packaging' as const,
        packaging_category: form.packaging_category || null,
        origin_country: form.origin_country || null,
        transport_mode: form.transport_mode || 'truck',
        distance_km: form.distance_km ? Number(form.distance_km) : null,
      };
    }).filter(m => m.quantity > 0);

    if (materialsToInsert.length === 0) return;

    const { error: insertError } = await supabase
      .from('product_materials')
      .insert(materialsToInsert);

    if (insertError) {
      throw new Error(`Failed to save packaging: ${insertError.message}`);
    }
  };

  const saveIngredients = async () => {
    cancelAutoSave();
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
    toast.info(`Saving ${validForms.length} ingredient${validForms.length === 1 ? '' : 's'}...`, { id: "save-ingredients" });
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
          matched_source_name: form.matched_source_name || null,
          quantity: Number(form.amount),
          unit: form.unit,
          material_type: 'ingredient',
          origin_country: form.origin_country || null,
          is_organic_certified: form.is_organic_certified || false,
        };

        // Debug logging for OpenLCA data flow
        console.log('[Recipe Save] Form data before OpenLCA check:', {
          material_name: form.name,
          data_source: form.data_source,
          data_source_id: form.data_source_id,
          has_data_source: !!form.data_source,
          has_data_source_id: !!form.data_source_id,
        });

        // Only include data_source if it's a valid value with required fields
        if (form.data_source === 'openlca' && form.data_source_id) {
          console.log('[Recipe Save] ✅ OpenLCA data will be saved:', form.data_source_id);
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'openlca') {
          console.error('[Recipe Save] ❌ OpenLCA selected but NO data_source_id!');
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }
        // Otherwise, leave data_source as null (don't include it)

        // Include transport data (multi-modal preferred; single-leg backward compat)
        if (form.transport_legs && form.transport_legs.length > 0) {
          materialData.transport_legs  = form.transport_legs;
          // Keep legacy fields in sync with first leg for backward-compat calculations
          materialData.transport_mode  = form.transport_legs[0].transportMode;
          materialData.distance_km     = form.transport_legs[0].distanceKm;
        } else if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km    = Number(form.distance_km);
          materialData.transport_legs = null;
        }

        // Include origin geolocation data if available
        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        // Include inbound delivery container fields (all nullable)
        materialData.inbound_container_type         = form.inbound_container_type         ?? null;
        materialData.inbound_container_volume_l     = form.inbound_container_volume_l     ?? null;
        materialData.inbound_container_tare_kg      = form.inbound_container_tare_kg      ?? null;
        materialData.inbound_container_reuse_cycles = form.inbound_container_reuse_cycles ?? null;
        materialData.inbound_container_ef           = form.inbound_container_ef           ?? null;

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

      toast.success(`${validForms.length} ingredient${validForms.length === 1 ? '' : 's'} saved successfully`, { id: "save-ingredients" });
      await fetchProductData();
    } catch (error: any) {
      console.error("=== SAVE INGREDIENTS ERROR ===");
      console.error("Error object:", error);
      console.error("Error stack:", error.stack);
      toast.error(error.message || "Failed to save ingredients", { id: "save-ingredients" });
    } finally {
      setSaving(false);
    }
  };

  const savePackaging = async () => {
    cancelAutoSave();
    console.log('=== SAVE PACKAGING DEBUG ===');
    console.log('All packaging forms:', packagingForms);

    // Check each form and collect validation errors
    const validationErrors: string[] = [];
    packagingForms.forEach((form, idx) => {
      const formErrors: string[] = [];
      if (!form.packaging_category) {
        formErrors.push('packaging type');
      }
      if (!form.name) {
        formErrors.push('material name');
      }
      if (!form.amount && !form.net_weight_g) {
        formErrors.push('net weight');
      } else if (Number(form.amount) <= 0 && Number(form.net_weight_g) <= 0) {
        formErrors.push('net weight (must be greater than 0)');
      }

      if (formErrors.length > 0) {
        validationErrors.push(`Packaging ${idx + 1}: missing ${formErrors.join(', ')}`);
      }

      console.log(`Form ${idx}:`, {
        name: form.name,
        hasName: !!form.name,
        amount: form.amount,
        hasAmount: !!form.amount,
        net_weight_g: form.net_weight_g,
        amountNumber: Number(form.amount),
        amountValid: Number(form.amount) > 0,
        packaging_category: form.packaging_category,
        hasCategory: !!form.packaging_category,
        errors: formErrors,
      });
    });

    const validForms = packagingForms.filter(
      f => f.name && (Number(f.amount) > 0 || Number(f.net_weight_g) > 0) && f.packaging_category
    );

    console.log('Valid forms:', validForms);
    console.log('Validation errors:', validationErrors);
    console.log('Product ID:', productId);
    console.log('Current Organization:', currentOrganization);

    if (validForms.length === 0) {
      // Show specific validation errors
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]); // Show first error
        if (validationErrors.length > 1) {
          console.warn('Additional validation errors:', validationErrors.slice(1));
        }
      } else {
        toast.error("Please add at least one valid packaging item with type, material name, and net weight");
      }
      return;
    }

    // Warn if some forms are invalid
    if (validForms.length < packagingForms.length) {
      const skippedCount = packagingForms.length - validForms.length;
      toast.warning(`${skippedCount} incomplete packaging item${skippedCount > 1 ? 's' : ''} will be skipped`);
    }

    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    setSaving(true);
    toast.info(`Saving ${validForms.length} packaging item${validForms.length === 1 ? '' : 's'}...`, { id: "save-packaging" });
    try {
      // Separate existing items (have DB IDs) from new items (have temp- prefix)
      const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
      const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));

      // Get IDs of items that should be kept
      const idsToKeep = existingItems.map(f => f.tempId);

      // Delete only items that are no longer in the form (not in idsToKeep)
      // First, get all current packaging IDs for this product
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

          if (deleteError) {
            console.error("Delete error:", deleteError);
            throw new Error(`Failed to remove old packaging: ${deleteError.message}`);
          }
          console.log(`[Packaging Save] Deleted ${idsToDelete.length} removed items`);
        }
      }

      // Helper function to build material data object
      const buildMaterialData = (form: PackagingFormData) => {
        // Derive quantity from amount, falling back to net_weight_g with unit conversion
        let quantity = Number(form.amount);
        if (!quantity || quantity <= 0 || isNaN(quantity)) {
          const weightG = Number(form.net_weight_g);
          quantity = isNaN(weightG) ? 0 : (form.unit === 'kg' ? weightG / 1000 : weightG);
        }

        const materialData: any = {
          product_id: parseInt(productId),
          material_name: form.name,
          matched_source_name: form.matched_source_name || null,
          quantity,
          unit: form.unit,
          material_type: 'packaging',
          packaging_category: form.packaging_category || null,
          origin_country: form.origin_country || null,
          net_weight_g: Number(form.net_weight_g) || null,
          recycled_content_percentage: form.recycled_content_percentage ? Number(form.recycled_content_percentage) : null,
          printing_process: form.printing_process || null,
        };

        // Only include data_source if it's a valid value with required fields
        if (form.data_source === 'openlca' && form.data_source_id) {
          materialData.data_source = 'openlca';
          materialData.data_source_id = form.data_source_id;
        } else if (form.data_source === 'supplier' && form.supplier_product_id) {
          materialData.data_source = 'supplier';
          materialData.supplier_product_id = form.supplier_product_id;
        }

        // Include transport data — prefer multi-leg JSONB; fall back to single mode/distance
        if (form.transport_legs && form.transport_legs.length > 0) {
          materialData.transport_legs = form.transport_legs;
          materialData.transport_mode = form.transport_legs[0].transportMode;
          materialData.distance_km = form.transport_legs[0].distanceKm;
        } else if (form.transport_mode && form.distance_km) {
          materialData.transport_mode = form.transport_mode;
          materialData.distance_km = Number(form.distance_km);
          materialData.transport_legs = null;
        }

        // Include origin geolocation data if available
        if (form.origin_lat && form.origin_lng) {
          materialData.origin_lat = form.origin_lat;
          materialData.origin_lng = form.origin_lng;
          materialData.origin_address = form.origin_address || null;
          materialData.origin_country_code = form.origin_country_code || null;
        }

        // Include EPR Compliance fields
        materialData.has_component_breakdown = form.has_component_breakdown || false;
        if (form.epr_packaging_level) {
          materialData.epr_packaging_level = form.epr_packaging_level;
        }
        if (form.epr_packaging_activity) {
          materialData.epr_packaging_activity = form.epr_packaging_activity;
        }
        materialData.epr_is_household = form.epr_is_household !== undefined ? form.epr_is_household : true;
        if (form.epr_ram_rating) {
          materialData.epr_ram_rating = form.epr_ram_rating;
        }
        if (form.epr_uk_nation) {
          materialData.epr_uk_nation = form.epr_uk_nation;
        }
        materialData.epr_is_drinks_container = form.epr_is_drinks_container || false;

        return materialData;
      };

      // Update existing items (guard against quantity <= 0 to satisfy positive_quantity constraint)
      let allSavedIds: string[] = [];
      for (const form of existingItems) {
        const materialData = buildMaterialData(form);
        if (!materialData.quantity || materialData.quantity <= 0 || isNaN(materialData.quantity)) continue;
        const { error: updateError } = await supabase
          .from("product_materials")
          .update(materialData)
          .eq("id", form.tempId);

        if (updateError) {
          console.error("Update error for item", form.tempId, updateError);
          throw new Error(`Failed to update packaging: ${updateError.message}`);
        }
        allSavedIds.push(form.tempId);
        console.log(`[Packaging Save] Updated existing item ${form.tempId}: ${form.name}`);
      }

      // Insert new items (guard against quantity <= 0 to satisfy positive_quantity constraint)
      let insertedData: any[] = [];
      if (newItems.length > 0) {
        const materialsToInsert = newItems.map(buildMaterialData).filter(m => m.quantity > 0 && !isNaN(m.quantity));
        console.log('Inserting new materials:', materialsToInsert);

        if (materialsToInsert.length > 0) {
          const { data, error: insertError } = await supabase
            .from("product_materials")
            .insert(materialsToInsert)
            .select();

          if (insertError) {
            console.error("Insert error:", insertError);
            throw new Error(`Failed to save packaging: ${insertError.message}`);
          }
          insertedData = data || [];
          allSavedIds.push(...insertedData.map((d: any) => d.id.toString()));
          console.log(`[Packaging Save] Inserted ${insertedData.length} new items`);
        }
      }

      console.log('=== SAVE SUCCESSFUL ===');
      console.log(`Updated: ${existingItems.length}, Inserted: ${newItems.length}`);

      // Save packaging material components if any forms have component breakdowns
      // Handle both existing items (updated) and new items (inserted)
      for (const form of validForms) {
        if (form.has_component_breakdown && form.components && form.components.length > 0) {
          // Determine the material ID - either from existing item or from inserted data
          let materialId: number | null = null;

          if (!form.tempId.startsWith('temp-')) {
            // Existing item - use its ID
            materialId = parseInt(form.tempId);
          } else {
            // New item - find it in insertedData by matching the name and category
            const insertedItem = insertedData.find((d: any) =>
              d.material_name === form.name && d.packaging_category === form.packaging_category
            );
            if (insertedItem) {
              materialId = insertedItem.id;
            }
          }

          if (materialId) {
            // Delete existing components first (for updates)
            await supabase
              .from('packaging_material_components')
              .delete()
              .eq('product_material_id', materialId);

            // Insert new components
            const componentsToInsert = form.components.map(comp => ({
              product_material_id: materialId,
              epr_material_type: comp.epr_material_type,
              component_name: comp.component_name,
              weight_grams: comp.weight_grams,
              recycled_content_percentage: comp.recycled_content_percentage || 0,
              is_recyclable: comp.is_recyclable !== undefined ? comp.is_recyclable : true,
            }));

            const { error: componentError } = await supabase
              .from('packaging_material_components')
              .insert(componentsToInsert);

            if (componentError) {
              console.error('Error saving components for item', materialId, componentError);
              // Don't throw - just log the error, main packaging was saved
            }
          }
        }
      }

      // Show success toast
      toast.success(`${validForms.length} packaging item${validForms.length === 1 ? '' : 's'} saved successfully`, { id: "save-packaging" });

      // Refetch product data
      console.log('Refetching product data...');
      await fetchProductData();
      console.log('Product data refetched');
    } catch (error: any) {
      console.error("=== ERROR SAVING PACKAGING ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error details:", error);
      toast.error(`Failed to save packaging: ${error.message || 'Unknown error'}`, { id: "save-packaging" });
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
        <Link href={`/products/${productId}`}>
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
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="h-4 w-4 pointer-events-none" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Leaf className="h-4 w-4 pointer-events-none" />
            <span>Ingredients</span>
          </TabsTrigger>
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Box className="h-4 w-4 pointer-events-none" />
            <span>Packaging</span>
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
                          {ingredient.matched_source_name && ingredient.matched_source_name !== ingredient.name && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">Proxy: {ingredient.matched_source_name}</p>
                          )}
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
                          {packaging.matched_source_name && packaging.matched_source_name !== packaging.name && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">Proxy: {packaging.matched_source_name}</p>
                          )}
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
                    totalLinkedFacilities={totalLinkedFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    onUpdate={updateIngredient}
                    onRemove={removeIngredient}
                    canRemove={ingredientForms.length > 1}
                  />
                ))}
              </div>

              <Button
                type="button"
                onClick={addIngredient}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Ingredient ({ingredientCount}/{ingredientForms.length})
              </Button>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={saveIngredients}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Ingredients'}
                </Button>
                <Button type="button" variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
                {autoSaving && (
                  <span className="text-xs text-muted-foreground animate-pulse">Autosaving...</span>
                )}
                {!autoSaving && lastSavedAt && (
                  <span className="text-xs text-muted-foreground">All changes saved</span>
                )}
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
                    totalLinkedFacilities={totalLinkedFacilities}
                    organizationLat={currentOrganization?.address_lat}
                    organizationLng={currentOrganization?.address_lng}
                    onUpdate={updatePackaging}
                    onRemove={removePackaging}
                    onAddNewWithType={addPackagingWithType}
                    canRemove={packagingForms.length > 1}
                  />
                ))}
              </div>

              <Button
                type="button"
                onClick={addPackaging}
                variant="outline"
                className="w-full border-dashed"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Packaging ({packagingCount}/{packagingForms.length})
              </Button>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Button
                  type="button"
                  onClick={savePackaging}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Packaging'}
                </Button>
                <Button type="button" variant="outline" onClick={fetchProductData} disabled={saving}>
                  Cancel
                </Button>
                {autoSaving && (
                  <span className="text-xs text-muted-foreground animate-pulse">Autosaving...</span>
                )}
                {!autoSaving && lastSavedAt && (
                  <span className="text-xs text-muted-foreground">All changes saved</span>
                )}
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
