"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  buildPackagingMaterialData,
  isPackagingFormSaveable,
  packagingFormErrors,
} from '@/lib/products/packaging-material-data';
import { autoMatchEmissionFactor } from '@/lib/products/ef-auto-match';
import { buildIngredientMaterialData } from '@/lib/products/ingredient-material-data';
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import type { MaturationProfile } from "@/lib/types/maturation";
import type {
  ProductionStage,
  StageType,
  ProductionChainTemplate,
} from "@/lib/types/products";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  product_description: string | null;
  product_image_url: string | null;
  functional_unit: string | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  recipe_scale_mode?: 'per_unit' | 'per_batch' | null;
  batch_yield_value?: number | null;
  batch_yield_unit?: string | null;
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
  epr_material_type: undefined,
  epr_is_drinks_container: false,
  units_per_group: '',
});

// Fingerprint for comparing form states (ignores tempId only). Must include
// EVERY field the save builders persist: the previous hand-picked list
// omitted self-grown links, biogenic flag, inbound-container fields, transport
// legs, stage, EPR fields, factor swaps that keep the same status, and the
// packaging circularity fields — so editing any of those never marked the form
// dirty, never scheduled autosave and never warned on navigate-away. The save
// path is lossless; these edits simply never reached it. Serialising the
// whole form (minus the volatile tempId) guarantees any persisted change is
// seen; fields absent on one form type serialise as undefined for both.
function formFingerprint(forms: Array<{ [key: string]: any }>): string {
  return JSON.stringify(
    forms.map((f) => {
      const { tempId, ...rest } = f;
      // Normalise numeric-ish fields to strings so 5 and '5' compare equal
      // (the form stores some as strings from inputs, some as numbers from
      // the DB load), and sort keys for a stable, order-independent digest.
      const normalised: Record<string, unknown> = {};
      for (const key of Object.keys(rest).sort()) {
        const v = (rest as any)[key];
        if (v === null || v === undefined) {
          normalised[key] = null;
        } else if (typeof v === 'number') {
          normalised[key] = String(v);
        } else if (typeof v === 'object') {
          normalised[key] = JSON.stringify(v);
        } else {
          normalised[key] = v;
        }
      }
      return normalised;
    })
  );
}

export function useRecipeEditor(productId: string, organizationId: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [productionFacilities, setProductionFacilities] = useState<ProductionFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dirty state tracking
  const savedIngredientSnapshot = useRef<string>('');
  const savedPackagingSnapshot = useRef<string>('');

  // Start with no rows: an auto-created blank form used to confront users
  // with fields before they chose how to add anything. The tab's empty state
  // offers the pathways instead.
  const [ingredientForms, setIngredientForms] = useState<IngredientFormData[]>([]);

  const [packagingForms, setPackagingForms] = useState<PackagingFormData[]>([]);

  // Maturation profile state
  const [maturationProfile, setMaturationProfile] = useState<MaturationProfile | null>(null);
  const savedMaturationSnapshot = useRef<string>('');
  const [maturationDirty, setMaturationDirty] = useState(false);

  // Production stages (v2: multi-stage recipe chain)
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);

  // Autosave: refs for latest form state (avoids stale closures in debounced callback)
  const ingredientFormsRef = useRef(ingredientForms);
  const packagingFormsRef = useRef(packagingForms);
  useEffect(() => { ingredientFormsRef.current = ingredientForms; }, [ingredientForms]);
  useEffect(() => { packagingFormsRef.current = packagingForms; }, [packagingForms]);
  const savingRef = useRef(false);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  // Monotonic epoch bumped synchronously when a manual save starts. An
  // autosave that is already past useAutoSave's debounce guard (so cancel()
  // can't stop it) checks this before its DB writes and bails, closing the
  // race where an in-flight autosave re-inserted rows after a manual save had
  // already deleted-and-reinserted them (a fresh route to duplicate rows).
  const saveEpochRef = useRef(0);
  const bumpSaveEpoch = useCallback(() => { saveEpochRef.current += 1; }, []);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
          tempId: item.id.toString(),
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
          match_status: item.match_status ?? null,
          transport_mode: item.transport_mode || 'truck',
          distance_km: item.distance_km || '',
          carbon_intensity: item.cached_co2_factor || undefined,
          openlca_database: item.openlca_database || undefined,
          stage_id: item.stage_id || undefined,
          // Multi-leg transport + self-grown / biogenic / inbound-container
          // fields — without these the form reloaded blank and the next save
          // wiped them from the row.
          transport_legs: item.transport_legs ?? undefined,
          is_self_grown: item.is_self_grown || false,
          vineyard_id: item.vineyard_id || null,
          arable_field_id: item.arable_field_id || null,
          orchard_id: item.orchard_id || null,
          is_biogenic_carbon: item.is_biogenic_carbon || false,
          inbound_container_type: item.inbound_container_type || null,
          inbound_container_volume_l: item.inbound_container_volume_l ?? null,
          inbound_container_tare_kg: item.inbound_container_tare_kg ?? null,
          inbound_container_reuse_cycles: item.inbound_container_reuse_cycles ?? null,
          inbound_container_ef: item.inbound_container_ef ?? null,
          inbound_container_material: item.inbound_container_material || null,
          // EF quality metadata — restores the quality tooltip and re-arms
          // the count-vs-mass unit-mismatch check after reload.
          ef_source: item.ef_source || undefined,
          ef_source_type: item.ef_source_type || undefined,
          ef_data_quality_grade: item.ef_data_quality_grade || undefined,
          ef_uncertainty_percent: item.ef_uncertainty_percent ?? undefined,
          ef_reference_unit: item.ef_reference_unit || undefined,
        }));
        setIngredientForms(mappedIngredients);
        savedIngredientSnapshot.current = formFingerprint(mappedIngredients);
      } else {
        const defaultForms: IngredientFormData[] = [];
        setIngredientForms(defaultForms);
        savedIngredientSnapshot.current = formFingerprint(defaultForms);
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

        const mappedPackaging = packagingItems.map(item => {
          const categoryMatch = item.notes?.match(/Category: (\w+)/);
          return {
            tempId: item.id.toString(),
            name: item.material_name,
            matched_source_name: item.matched_source_name || undefined,
            data_source: item.data_source as any,
            data_source_id: item.data_source_id,
            supplier_product_id: item.supplier_product_id,
            amount: item.quantity,
            unit: item.unit || 'g',
            packaging_category: item.packaging_category || (categoryMatch ? categoryMatch[1] : 'container'),
            // ?? '' not || '': a stored 0 is a DECLARED zero recycled content
            // and must round-trip, not display as blank ("unknown").
            recycled_content_percentage: item.recycled_content_percentage ?? '',
            printing_process: item.printing_process || 'standard_ink',
            // net_weight_g is in GRAMS. Only fall back to quantity when the
            // row's unit is grams; a kg-unit quantity would load 1000x too
            // small into a grams field.
            net_weight_g: item.net_weight_g ?? ((item.unit || 'g').toLowerCase() === 'g' ? item.quantity : '') ?? '',
            origin_country: item.origin_country || '',
            origin_address: item.origin_address || '',
            origin_lat: item.origin_lat || undefined,
            origin_lng: item.origin_lng || undefined,
            origin_country_code: item.origin_country_code || '',
            transport_mode: item.transport_mode || 'truck',
            distance_km: item.distance_km || '',
            has_component_breakdown: item.has_component_breakdown || false,
            components: componentsByMaterial[item.id] || [],
            epr_packaging_level: item.epr_packaging_level || undefined,
            epr_packaging_activity: item.epr_packaging_activity || undefined,
            epr_is_household: item.epr_is_household !== undefined ? item.epr_is_household : true,
            epr_ram_rating: item.epr_ram_rating || undefined,
            epr_uk_nation: item.epr_uk_nation || undefined,
            // Explicit override loaded so the EPR material-type selector shows
            // the saved value; 'other' round-trips (it is a real choice), so
            // only null/'' fall back to Auto.
            epr_material_type:
              item.epr_material_type == null || item.epr_material_type === ''
                ? undefined
                : item.epr_material_type,
            epr_is_drinks_container: item.epr_is_drinks_container || false,
            // Legacy shared-packaging rows saved without an answer must ask
            // the question again rather than silently showing 1.
            units_per_group: item.units_per_group ?? '',
            // Circularity
            reuse_trips: item.reuse_trips ?? '',
            recyclability_percent: item.recyclability_percent ?? '',
            end_of_life_pathway: item.end_of_life_pathway || '',
            biobased_content_percentage: item.biobased_content_percentage ?? '',
            transport_legs: item.transport_legs ?? null,
            carbon_intensity: item.cached_co2_factor ?? undefined,
            openlca_database: item.openlca_database || undefined,
            // Structured identity from the guided wizard (null on manual rows)
            container_format: item.container_format ?? null,
            container_material: item.container_material ?? null,
            container_size_ml: item.container_size_ml ?? null,
            weight_source: item.weight_source ?? null,
            match_status: item.match_status ?? null,
          };
        });
        setPackagingForms(mappedPackaging);
        savedPackagingSnapshot.current = formFingerprint(mappedPackaging);
      } else {
        const defaultPkg: PackagingFormData[] = [];
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

      // Load production stages (v2)
      const { data: stagesData } = await supabase
        .from("production_stages")
        .select("*")
        .eq("product_id", productId)
        .order("ordinal", { ascending: true });
      setProductionStages((stagesData || []) as ProductionStage[]);
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
    // Removing the last row is fine: the tab's empty state returns
    setIngredientForms(prev => prev.filter(form => form.tempId !== tempId));
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
    setPackagingForms(prev => prev.filter(form => form.tempId !== tempId));
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

  /**
   * Add an ingredient with a pre-filled name (from recipe checklist
   * quick-add), then auto-match its emission factor in the background using
   * the checklist's curated search query. The row appears instantly; the
   * match lands a moment later flagged "Matched, please check" (or stays
   * needs_review when no confident match exists). The user's job becomes
   * confirm-or-reject instead of choose-correctly.
   */
  const addIngredientWithDefaults = (name: string, searchQuery: string) => {
    const tempId = `temp-${Date.now()}`;
    setIngredientForms(prev => {
      const row = { ...DEFAULT_INGREDIENT, tempId, name };
      // If there's only one empty form, replace it instead of adding
      if (prev.length === 1 && !prev[0].name && !prev[0].amount) {
        return [row];
      }
      return [...prev, row];
    });

    void (async () => {
      const match = await autoMatchEmissionFactor({
        query: searchQuery || name,
        organizationId,
        materialType: 'ingredient',
      });
      setIngredientForms(prev => prev.map(f => {
        if (f.tempId !== tempId) return f;
        // Don't clobber a factor the user picked while we were searching
        if (f.data_source_id || f.matched_source_name) return f;
        if (!match) return { ...f, match_status: 'needs_review' };
        return {
          ...f,
          matched_source_name: match.matched_source_name,
          data_source: match.data_source as any,
          data_source_id: match.data_source_id,
          supplier_product_id: match.supplier_product_id,
          carbon_intensity: match.carbon_intensity,
          openlca_database: match.openlca_database,
          ef_source: match.ef_source,
          ef_source_type: match.ef_source_type,
          ef_data_quality_grade: match.ef_data_quality_grade,
          ef_uncertainty_percent: match.ef_uncertainty_percent,
          match_status: 'auto_matched',
        };
      }));
    })();
  };

  /** Merge fully-formed ingredient rows (from the recipe starter) into the form. */
  const addIngredientRows = (rows: IngredientFormData[]) => {
    if (rows.length === 0) return;
    setIngredientForms(prev => {
      const isEmpty = prev.length === 1 && !prev[0].name && !prev[0].amount;
      return isEmpty ? rows : [...prev, ...rows];
    });
  };

  /** Add a packaging item with a pre-filled name and category (from recipe checklist quick-add) */
  /** Merge fully-formed rows from the guided packaging wizard into the form. */
  const addPackagingRows = (rows: PackagingFormData[]) => {
    if (rows.length === 0) return;
    setPackagingForms(prev => {
      // Replace the single untouched starter row instead of appending after it
      const isEmpty = prev.length === 1 && !prev[0].name && !prev[0].amount && !prev[0].net_weight_g;
      return isEmpty ? rows : [...prev, ...rows];
    });
  };

  const addPackagingWithDefaults = (name: string, searchQuery: string, packagingCategory?: PackagingCategory) => {
    const tempId = `temp-pkg-${Date.now()}`;
    setPackagingForms(prev => {
      const newPkg = {
        ...createDefaultPackaging(),
        tempId,
        name,
        ...(packagingCategory ? { packaging_category: packagingCategory } : {}),
      };
      // If there's only one empty form, replace it instead of adding
      if (prev.length === 1 && !prev[0].name && !prev[0].amount) {
        return [newPkg];
      }
      return [...prev, newPkg];
    });

    // Auto-match in the background (see addIngredientWithDefaults)
    void (async () => {
      const match = await autoMatchEmissionFactor({
        query: searchQuery || name,
        organizationId,
        materialType: 'packaging',
        packagingCategory: packagingCategory || undefined,
      });
      setPackagingForms(prev => prev.map(f => {
        if (f.tempId !== tempId) return f;
        if (f.data_source_id || f.matched_source_name) return f;
        if (!match) return { ...f, match_status: 'needs_review' };
        return {
          ...f,
          matched_source_name: match.matched_source_name,
          data_source: match.data_source as any,
          data_source_id: match.data_source_id,
          supplier_product_id: match.supplier_product_id,
          carbon_intensity: match.carbon_intensity,
          openlca_database: match.openlca_database,
          ef_source: match.ef_source,
          ef_source_type: match.ef_source_type,
          ef_data_quality_grade: match.ef_data_quality_grade,
          ef_uncertainty_percent: match.ef_uncertainty_percent,
          match_status: 'auto_matched',
        };
      }));
    })();
  };

  // Save operations
  const saveIngredients = async () => {
    bumpSaveEpoch(); // Invalidate any autosave already past its debounce
    cancelAutoSave(); // and cancel any still pending
    const validForms = ingredientForms.filter(f => f.name && f.amount && Number(f.amount) > 0);

    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    // Warn (once) when a previously saved row has had its amount cleared and
    // will be skipped, mirroring the packaging path — "skipped" must never
    // silently mean "deleted".
    if (validForms.length < ingredientForms.length && ingredientForms.some(f => f.name && !(Number(f.amount) > 0))) {
      const skipped = ingredientForms.length - validForms.length;
      toast.warning(`${skipped} incomplete ingredient${skipped > 1 ? 's' : ''} will be skipped`);
    }

    savingRef.current = true; // synchronous; the state-synced ref is a render behind
    setSaving(true);
    toast.info(
      validForms.length === 0 ? 'Saving recipe...' : `Saving ${validForms.length} ingredient${validForms.length === 1 ? '' : 's'}...`,
      { id: "save-ingredients" }
    );

    try {
      // Keep-ids upsert (same model as packaging and autosave): update rows
      // that still exist, insert new ones, delete only the rows the user
      // actually removed. The old wipe-then-write deleted the whole recipe
      // BEFORE the insert, so a single constraint violation on any row left
      // the product with no ingredients at all.
      const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
      const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
      // Keep every row still present in the form, including ones temporarily
      // invalid mid-edit, so a cleared amount is never silently deleted.
      const idsToKeep = ingredientForms.filter(f => !f.tempId.startsWith('temp-')).map(f => f.tempId);

      const { data: currentIngredients } = await supabase
        .from("product_materials")
        .select("id")
        .eq("product_id", productId)
        .eq("material_type", "ingredient");

      if (currentIngredients && currentIngredients.length > 0) {
        const idsToDelete = currentIngredients
          .map(i => i.id)
          .filter(id => !idsToKeep.includes(id.toString()));
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("product_materials")
            .delete()
            .in("id", idsToDelete);
          if (deleteError) throw new Error(`Failed to remove ingredients: ${deleteError.message}`);
        }
      }

      // Shared row builder (also used by autosave) so the two paths can never
      // write different fields again.
      const buildMaterialData = (form: IngredientFormData) => buildIngredientMaterialData(form, productId);

      for (const form of existingItems) {
        const { error: updateError } = await supabase
          .from("product_materials")
          .update(buildMaterialData(form))
          .eq("id", form.tempId);
        if (updateError) throw new Error(`Failed to update ingredients: ${updateError.message}`);
      }

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("product_materials")
          .insert(newItems.map(buildMaterialData))
          .select();
        if (insertError) throw new Error(`Failed to save ingredients: ${insertError.message}`);
      }

      toast.success(
        validForms.length === 0 ? 'Recipe saved' : `${validForms.length} ingredient${validForms.length === 1 ? '' : 's'} saved successfully`,
        { id: "save-ingredients" }
      );
      await fetchProductData();
    } catch (error: any) {
      console.error("Save ingredients error:", error);
      toast.error(error.message || "Failed to save ingredients", { id: "save-ingredients" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const savePackaging = async () => {
    bumpSaveEpoch(); // Invalidate any autosave already past its debounce
    cancelAutoSave(); // and cancel any still pending
    // Shared with autosave so the two paths can never accept different rows
    const validationErrors: string[] = [];
    packagingForms.forEach((form, idx) => {
      const formErrors = packagingFormErrors(form);
      if (formErrors.length > 0) validationErrors.push(`Packaging ${idx + 1}: missing ${formErrors.join(', ')}`);
    });

    const validForms = packagingForms.filter(isPackagingFormSaveable);

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

    savingRef.current = true; // synchronous; the state-synced ref is a render behind
    setSaving(true);
    toast.info(`Saving ${validForms.length} packaging item${validForms.length === 1 ? '' : 's'}...`, { id: "save-packaging" });

    try {
      const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
      const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
      // Keep every row still present in the form, including invalid ones that
      // are merely skipped this save — "skipped" must never mean "deleted".
      const idsToKeep = packagingForms.filter(f => !f.tempId.startsWith('temp-')).map(f => f.tempId);

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

      // Shared row builder (also used by autosave)
      const buildMaterialData = (form: PackagingFormData) => buildPackagingMaterialData(form, productId);

      // Update existing items (guard against quantity <= 0 to satisfy positive_quantity constraint)
      for (const form of existingItems) {
        const materialData = buildMaterialData(form);
        if (!materialData.quantity || materialData.quantity <= 0 || isNaN(materialData.quantity)) continue;
        const { error: updateError } = await supabase
          .from("product_materials")
          .update(materialData)
          .eq("id", form.tempId);
        if (updateError) throw new Error(`Failed to update packaging: ${updateError.message}`);
      }

      // Insert new items (guard against quantity <= 0 to satisfy positive_quantity
      // constraint). Keep each surviving form paired with the row we send so the
      // returned uuid can be matched back by index — Postgres returns inserted
      // rows in input order — instead of by name+category, which mis-attaches
      // EPR components when two new packaging rows share the same name and type.
      let insertedData: any[] = [];
      const builtNewItems = newItems
        .map(form => ({ form, data: buildMaterialData(form) }))
        .filter(({ data }) => data.quantity > 0 && !isNaN(data.quantity));
      if (builtNewItems.length > 0) {
        const { data, error: insertError } = await supabase
          .from("product_materials")
          .insert(builtNewItems.map(b => b.data))
          .select();
        if (insertError) throw new Error(`Failed to save packaging: ${insertError.message}`);
        insertedData = data || [];
      }

      // Pair each new form's tempId to the uuid it was inserted as, by index.
      const newIdByTempId = new Map<string, string>();
      builtNewItems.forEach(({ form }, i) => {
        const row = insertedData[i];
        if (row?.id) newIdByTempId.set(form.tempId, row.id);
      });

      // Save EPR material components. product_materials.id (and therefore the
      // packaging_material_components.product_material_id FK) is a uuid: for an
      // existing row it IS form.tempId, for a new row it's the uuid returned by
      // the insert. The old code ran parseInt() over it, which yielded NaN (so
      // the components were silently dropped and "blanked out" on reload) or a
      // wrong integer (which the uuid column rejected). Use the uuid directly.
      for (const form of validForms) {
        const materialId: string | null = form.tempId.startsWith('temp-')
          ? (newIdByTempId.get(form.tempId) ?? null)
          : form.tempId;
        if (!materialId) continue;

        // Always clear first, so removing all components or unticking
        // "component breakdown" deletes the orphaned child rows (they used to
        // survive and reappear on reload).
        const { error: delErr } = await supabase
          .from('packaging_material_components')
          .delete()
          .eq('product_material_id', materialId);
        if (delErr) throw new Error(`Failed to update EPR materials: ${delErr.message}`);

        if (form.has_component_breakdown && form.components && form.components.length > 0) {
          const componentsToInsert = form.components.map(comp => ({
            product_material_id: materialId,
            epr_material_type: comp.epr_material_type,
            component_name: comp.component_name,
            weight_grams: comp.weight_grams,
            recycled_content_percentage: comp.recycled_content_percentage || 0,
            is_recyclable: comp.is_recyclable !== undefined ? comp.is_recyclable : true,
          }));

          const { error: compErr } = await supabase
            .from('packaging_material_components')
            .insert(componentsToInsert);
          if (compErr) throw new Error(`Failed to save EPR materials: ${compErr.message}`);
        }
      }

      toast.success(`${validForms.length} packaging item${validForms.length === 1 ? '' : 's'} saved successfully`, { id: "save-packaging" });
      await fetchProductData();
    } catch (error: any) {
      console.error("Save packaging error:", error);
      toast.error(`Failed to save packaging: ${error.message || 'Unknown error'}`, { id: "save-packaging" });
    } finally {
      savingRef.current = false;
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
        // ?? not ||: an explicit 0 override is a legitimate value (e.g. a
        // supplier-verified zero-burden reconditioned cask) and must not be
        // coerced back to the 40-65 kg default.
        barrel_co2e_new: profile.barrel_co2e_new ?? null,
        aging_duration_months: profile.aging_duration_months,
        angel_share_percent_per_year: profile.angel_share_percent_per_year,
        climate_zone: profile.climate_zone,
        fill_volume_litres: profile.fill_volume_litres,
        number_of_barrels: profile.number_of_barrels,
        cask_fill_abv_percent: profile.cask_fill_abv_percent ?? null,
        warehouse_energy_kwh_per_barrel_year: profile.warehouse_energy_kwh_per_barrel_year,
        warehouse_energy_source: profile.warehouse_energy_source,
        warehouse_country_code: profile.warehouse_country_code ?? null,
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

  // --- Autosave logic ---

  // Silent save for ingredients (no toasts, no fetchProductData)
  const autoSaveIngredients = useCallback(async (forms: IngredientFormData[]) => {
    const validForms = forms.filter(f => f.name && f.amount && Number(f.amount) > 0);
    if (validForms.length === 0 || !organizationId) return;

    const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
    const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
    // Keep every row still present in the form — including ones that are
    // temporarily invalid mid-edit — so autosave never deletes a saved row
    // the user is part-way through changing.
    const idsToKeep = forms.filter(f => !f.tempId.startsWith('temp-')).map(f => f.tempId);

    const { data: currentIngredients } = await supabase
      .from("product_materials")
      .select("id")
      .eq("product_id", productId)
      .eq("material_type", "ingredient");

    if (currentIngredients && currentIngredients.length > 0) {
      const idsToDelete = currentIngredients
        .map(i => i.id)
        .filter(id => !idsToKeep.includes(id.toString()));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("product_materials")
          .delete()
          .in("id", idsToDelete);
        if (deleteError) throw new Error(`Autosave ingredients failed: ${deleteError.message}`);
      }
    }

    // Shared row builder (also used by the manual Save button). Conditional
    // columns get explicit null defaults so updating an existing row clears
    // stale values exactly like the old delete-and-reinsert did.
    const buildMaterialData = (form: IngredientFormData) => buildIngredientMaterialData(form, productId);

    for (const form of existingItems) {
      const { error: updateError } = await supabase
        .from("product_materials")
        .update(buildMaterialData(form))
        .eq("id", form.tempId);
      if (updateError) throw new Error(`Autosave ingredients failed: ${updateError.message}`);
    }

    if (newItems.length > 0) {
      const { error: insertError } = await supabase
        .from("product_materials")
        .insert(newItems.map(buildMaterialData))
        .select();
      if (insertError) throw new Error(`Autosave ingredients failed: ${insertError.message}`);
    }

    // Update snapshot without refetching (avoids form reset/flicker)
    savedIngredientSnapshot.current = formFingerprint(forms);
  }, [productId, organizationId]);

  // Silent save for packaging (no toasts, no fetchProductData)
  const autoSavePackaging = useCallback(async (forms: PackagingFormData[]) => {
    // Incomplete rows (including shared packaging without units_per_group)
    // stay in memory until the user finishes them — autosave must never
    // write a row the Save button would reject.
    const validForms = forms.filter(isPackagingFormSaveable);
    if (validForms.length === 0 || !organizationId) return;

    const existingItems = validForms.filter(f => !f.tempId.startsWith('temp-'));
    const newItems = validForms.filter(f => f.tempId.startsWith('temp-'));
    // Keep every row still present in the form — including ones that are
    // temporarily invalid mid-edit — so autosave never deletes a saved row
    // the user is part-way through changing.
    const idsToKeep = forms.filter(f => !f.tempId.startsWith('temp-')).map(f => f.tempId);

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
        if (deleteError) throw new Error(`Autosave packaging failed: ${deleteError.message}`);
      }
    }

    // Shared row builder (also used by the manual Save button)
    const buildMaterialData = (form: PackagingFormData) => buildPackagingMaterialData(form, productId);

    for (const form of existingItems) {
      const materialData = buildMaterialData(form);
      if (!materialData.quantity || materialData.quantity <= 0 || isNaN(materialData.quantity)) continue;
      const { error: updateError } = await supabase
        .from("product_materials")
        .update(materialData)
        .eq("id", form.tempId);
      if (updateError) throw new Error(`Autosave packaging failed: ${updateError.message}`);
    }

    // Keep each surviving new form paired with the row we send, so the returned
    // uuid maps back by index (Postgres preserves insert order) rather than by
    // name+category — which mis-attaches components on duplicate name+type rows.
    const builtNewItems = newItems
      .map(form => ({ form, data: buildMaterialData(form) }))
      .filter(({ data }) => data.quantity > 0 && !isNaN(data.quantity));
    if (builtNewItems.length > 0) {
      const { data, error: insertError } = await supabase
        .from("product_materials")
        .insert(builtNewItems.map(b => b.data))
        .select();
      if (insertError) throw new Error(`Autosave packaging failed: ${insertError.message}`);

      // Save components for newly inserted items, paired by index.
      const inserted = data || [];
      for (let i = 0; i < builtNewItems.length; i++) {
        const form = builtNewItems[i].form;
        const insertedItem = inserted[i];
        if (insertedItem?.id && form.has_component_breakdown && form.components && form.components.length > 0) {
          const componentsToInsert = form.components.map(comp => ({
            product_material_id: insertedItem.id,
            epr_material_type: comp.epr_material_type,
            component_name: comp.component_name,
            weight_grams: comp.weight_grams,
            recycled_content_percentage: comp.recycled_content_percentage || 0,
            is_recyclable: comp.is_recyclable !== undefined ? comp.is_recyclable : true,
          }));
          // Errors here must not pass silently: a swallowed failure was the
          // old "EPR breakdown blanks out" bug via a new path.
          const { error: compErr } = await supabase.from('packaging_material_components').insert(componentsToInsert);
          if (compErr) throw new Error(`Autosave packaging components failed: ${compErr.message}`);
        }
      }
    }

    // Rewrite components for existing items. product_material_id is a uuid — it
    // is form.tempId verbatim, NOT parseInt(form.tempId) (which produced
    // NaN/wrong ints and silently dropped EPR breakdowns on autosave). We
    // ALWAYS clear then re-insert so that removing every component or unticking
    // "component breakdown" deletes the orphaned child rows (they used to
    // survive and reappear on reload); and delete/insert errors are checked so
    // a failed insert after a successful delete can't blank the breakdown.
    for (const form of existingItems) {
      const materialId = form.tempId;
      if (!materialId) continue;
      const wantsComponents = !!form.has_component_breakdown && !!form.components && form.components.length > 0;
      const { error: delErr } = await supabase
        .from('packaging_material_components')
        .delete()
        .eq('product_material_id', materialId);
      if (delErr) throw new Error(`Autosave packaging components failed: ${delErr.message}`);
      if (wantsComponents) {
        const componentsToInsert = form.components!.map(comp => ({
          product_material_id: materialId,
          epr_material_type: comp.epr_material_type,
          component_name: comp.component_name,
          weight_grams: comp.weight_grams,
          recycled_content_percentage: comp.recycled_content_percentage || 0,
          is_recyclable: comp.is_recyclable !== undefined ? comp.is_recyclable : true,
        }));
        const { error: insErr } = await supabase.from('packaging_material_components').insert(componentsToInsert);
        if (insErr) throw new Error(`Autosave packaging components failed: ${insErr.message}`);
      }
    }

    // Update snapshot without refetching (respecting the epoch: if a manual
    // save started mid-flight, don't stamp a snapshot from stale forms).
    savedPackagingSnapshot.current = formFingerprint(forms);
  }, [productId, organizationId]);

  // Combined autosave callback
  const performAutoSave = useCallback(async () => {
    // Don't autosave while a manual save is in progress
    if (savingRef.current) return;
    // Snapshot the epoch: if a manual save starts while we're awaiting a DB
    // write below, the epoch changes and we abort before committing more.
    const epoch = saveEpochRef.current;
    const superseded = () => savingRef.current || saveEpochRef.current !== epoch;

    const currentIngredients = ingredientFormsRef.current;
    const currentPackaging = packagingFormsRef.current;

    const ingredientsDirty = formFingerprint(currentIngredients) !== savedIngredientSnapshot.current;
    const packagingDirty = formFingerprint(currentPackaging) !== savedPackagingSnapshot.current;

    if (!ingredientsDirty && !packagingDirty) return;

    try {
      if (ingredientsDirty) {
        if (superseded()) return;
        await autoSaveIngredients(currentIngredients);
      }
      if (packagingDirty) {
        if (superseded()) return;
        await autoSavePackaging(currentPackaging);
      }
      setLastSavedAt(new Date());
    } catch (error: any) {
      console.error('Autosave error:', error);
      toast.error('Autosave failed. Your changes are still in memory - use the Save button.', { id: 'autosave-error' });
    }
  }, [autoSaveIngredients, autoSavePackaging]);

  const { scheduleSave, cancel: cancelAutoSave, isSaving: autoSaving } = useAutoSave({
    onSave: performAutoSave,
    delay: 8000,
    enabled: !saving && !loading,
  });

  // Trigger autosave on form state changes
  useEffect(() => {
    if (loading) return;
    const ingredientsDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current;
    const packagingDirty = formFingerprint(packagingForms) !== savedPackagingSnapshot.current;
    if (ingredientsDirty || packagingDirty) {
      scheduleSave();
    }
  }, [ingredientForms, packagingForms, loading, scheduleSave]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const ingredientsDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current;
    const packagingDirty = formFingerprint(packagingForms) !== savedPackagingSnapshot.current;
    const hasUnsaved = ingredientsDirty || packagingDirty || maturationDirty;

    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [ingredientForms, packagingForms, maturationDirty]);

  // --- End autosave logic ---

  const ingredientCount = ingredientForms.filter(f => f.name && f.amount).length;
  const packagingCount = packagingForms.filter(f => f.name && f.amount && f.packaging_category).length;

  // Replace all packaging forms with template items
  const setPackagingFromTemplate = (items: PackagingFormData[]) => {
    setPackagingForms(items);
  };

  // Replace all ingredient forms with template items
  const setIngredientsFromTemplate = (items: IngredientFormData[]) => {
    setIngredientForms(items);
  };

  // -------- Production stages (v2) --------

  const refreshStages = useCallback(async () => {
    const { data } = await supabase
      .from('production_stages')
      .select('*')
      .eq('product_id', productId)
      .order('ordinal', { ascending: true });
    setProductionStages((data || []) as ProductionStage[]);
  }, [productId]);

  const addProductionStage = useCallback(async (input: {
    name: string;
    stage_type: StageType;
    input_volume_l?: number | null;
    output_volume_l?: number | null;
    input_abv_percent?: number | null;
    output_abv_percent?: number | null;
    notes?: string | null;
  }) => {
    const ordinal = productionStages.length;
    const { error } = await supabase.from('production_stages').insert({
      product_id: parseInt(productId),
      ordinal,
      ...input,
    });
    if (error) {
      toast.error('Failed to add stage');
      console.error(error);
      return;
    }
    await refreshStages();
  }, [productId, productionStages.length, refreshStages]);

  const updateProductionStage = useCallback(async (
    id: string,
    updates: Partial<Omit<ProductionStage, 'id' | 'product_id' | 'created_at' | 'updated_at'>>,
  ) => {
    setProductionStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const { error } = await supabase
      .from('production_stages')
      .update(updates)
      .eq('id', id);
    if (error) {
      toast.error('Failed to update stage');
      console.error(error);
      await refreshStages();
    }
  }, [refreshStages]);

  const removeProductionStage = useCallback(async (id: string) => {
    const removed = productionStages.find(s => s.id === id);
    if (!removed) return;
    const { error } = await supabase
      .from('production_stages')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to remove stage');
      console.error(error);
      return;
    }
    // Re-pack ordinals so the chain stays gap-free
    const remaining = productionStages
      .filter(s => s.id !== id)
      .map((s, idx) => ({ ...s, ordinal: idx }));
    setProductionStages(remaining);
    await Promise.all(
      remaining.map(s =>
        supabase.from('production_stages').update({ ordinal: s.ordinal }).eq('id', s.id),
      ),
    );
    await refreshStages();
  }, [productionStages, refreshStages]);

  const reorderProductionStages = useCallback(async (orderedIds: string[]) => {
    const next = orderedIds
      .map((id, idx) => {
        const s = productionStages.find(x => x.id === id);
        return s ? { ...s, ordinal: idx } : null;
      })
      .filter((s): s is ProductionStage => s !== null);
    setProductionStages(next);
    await Promise.all(
      next.map(s =>
        supabase.from('production_stages').update({ ordinal: s.ordinal }).eq('id', s.id),
      ),
    );
    await refreshStages();
  }, [productionStages, refreshStages]);

  /**
   * Apply a chain template: replaces any existing stages with the template's
   * stage definitions. Existing ingredient rows have their `stage_id` cleared
   * so the user can re-attach them to the new chain.
   */
  const applyProductionTemplate = useCallback(async (template: ProductionChainTemplate) => {
    // Detach materials from any existing stages
    await supabase
      .from('product_materials')
      .update({ stage_id: null })
      .eq('product_id', parseInt(productId));

    // Drop existing stages for this product
    await supabase
      .from('production_stages')
      .delete()
      .eq('product_id', parseInt(productId));

    // Insert template stages
    const rows = template.stages
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s, idx) => ({
        product_id: parseInt(productId),
        ordinal: idx,
        name: s.name,
        stage_type: s.stage_type,
        input_volume_l: s.default_input_volume_l ?? null,
        output_volume_l: s.default_output_volume_l ?? null,
        input_abv_percent: s.default_input_abv_percent ?? null,
        output_abv_percent: s.default_output_abv_percent ?? null,
      }));
    const { error } = await supabase.from('production_stages').insert(rows);
    if (error) {
      toast.error('Failed to apply template');
      console.error(error);
      return;
    }

    // Link the template on the product for traceability
    await supabase
      .from('products')
      .update({ production_chain_template_id: template.id })
      .eq('id', productId);

    await refreshStages();
    toast.success(`Applied ${template.name} chain`);
  }, [productId, refreshStages]);

  const clearProductionChain = useCallback(async () => {
    await supabase
      .from('product_materials')
      .update({ stage_id: null })
      .eq('product_id', parseInt(productId));
    await supabase
      .from('production_stages')
      .delete()
      .eq('product_id', parseInt(productId));
    await supabase
      .from('products')
      .update({ production_chain_template_id: null })
      .eq('id', productId);
    setProductionStages([]);
    toast.success('Production chain cleared');
  }, [productId]);

  // Persist recipe scale (per_unit vs per_batch) plus batch yield. Optimistic
  // local update keeps the live impact preview in sync with the toggle.
  // The DB has a check constraint that requires batch_yield_value + _unit to be
  // set whenever mode is per_batch, so we defer the DB write until those fields
  // are filled. Local state updates immediately so the UI reflects the choice.
  const saveRecipeScale = useCallback(async (input: {
    recipe_scale_mode: 'per_unit' | 'per_batch';
    batch_yield_value: number | null;
    batch_yield_unit: string | null;
  }) => {
    if (!product) return;

    const isIncompleteBatch =
      input.recipe_scale_mode === 'per_batch' &&
      (!input.batch_yield_value || input.batch_yield_value <= 0 || !input.batch_yield_unit);
    if (isIncompleteBatch) {
      // Keep the yield fields the user is typing, but do NOT flip the effective
      // recipe_scale_mode to per_batch until it is actually persisted. Flipping
      // it locally made the impact preview divide by a batch factor while the
      // (still per_unit) saved calculation did not, and a reload silently
      // reverted the toggle. Preview and calculation now stay in step.
      setProduct({
        ...product,
        recipe_scale_mode: product.recipe_scale_mode ?? 'per_unit',
        batch_yield_value: input.batch_yield_value,
        batch_yield_unit: input.batch_yield_unit,
      });
      return;
    }

    setProduct({ ...product, ...input });

    const { error } = await supabase
      .from('products')
      .update({
        recipe_scale_mode: input.recipe_scale_mode,
        batch_yield_value: input.batch_yield_value,
        batch_yield_unit: input.batch_yield_unit,
      })
      .eq('id', product.id);
    if (error) {
      toast.error('Failed to save recipe scale');
      console.error('saveRecipeScale error', error);
    }
  }, [product]);

  // Dirty state: compare current forms against last-saved snapshot
  const isDirty = formFingerprint(ingredientForms) !== savedIngredientSnapshot.current ||
    formFingerprint(packagingForms) !== savedPackagingSnapshot.current ||
    maturationDirty;

  return {
    product,
    productionFacilities,
    loading,
    saving,
    autoSaving,
    lastSavedAt,
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
    addIngredientWithDefaults,
    addIngredientRows,
    addPackagingWithDefaults,
    addPackagingRows,
    saveIngredients,
    savePackaging,
    setPackagingFromTemplate,
    setIngredientsFromTemplate,
    updateMaturationProfile,
    saveMaturation,
    removeMaturation,
    saveRecipeScale,
    productionStages,
    addProductionStage,
    updateProductionStage,
    removeProductionStage,
    reorderProductionStages,
    applyProductionTemplate,
    clearProductionChain,
  };
}
