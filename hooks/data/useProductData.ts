"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface ProductIngredient {
  id: string;
  material_name: string;
  matched_source_name?: string | null;
  quantity: number;
  unit: string;
  data_source: string | null;
  supplier_product_id?: string | null;
  supplier_name?: string | null;
  origin_lat?: number;
  origin_lng?: number;
  origin_address?: string;
  origin_country_code?: string;
  distance_km?: number;
  transport_mode?: string;
}

export interface ProductPackaging {
  id: string;
  material_name: string;
  matched_source_name?: string | null;
  quantity: number;
  unit: string;
  packaging_category: string;
  data_source: string | null;
  supplier_product_id?: string | null;
  supplier_name?: string | null;
  origin_lat?: number;
  origin_lng?: number;
  origin_address?: string;
  origin_country_code?: string;
  distance_km?: number;
  transport_mode?: string;
}

export interface ProductLCA {
  id: string;
  created_at: string;
  updated_at?: string;
  system_boundary: string;
  aggregated_impacts: {
    climate_change_gwp100: number;
    water_consumption: number;
    water_scarcity_aware: number;
    land_use: number;
    water_risk_level?: string;
    circularity_percentage?: number;
    fossil_resource_scarcity?: number;
    terrestrial_ecotoxicity?: number;
    breakdown?: any;
  } | null;
  status: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  product_description: string;
  product_image_url: string;
  product_category: string;
  functional_unit: string;
  unit_size_value: number;
  unit_size_unit: string;
  alcohol_content_abv?: number | null;
  organization_id: string;
  is_multipack?: boolean;
  annual_production_volume?: number | null;
  annual_production_unit?: string | null;
  passport_enabled?: boolean;
  passport_token?: string | null;
  passport_views_count?: number;
  passport_last_viewed_at?: string | null;
  passport_settings?: Record<string, unknown> | null;
}

/** The barrel, cask or tank a product matures in, when it matures at all. */
export interface ProductMaturation {
  barrel_type?: string | null;
  climate_zone?: string | null;
  maturation_years?: number | null;
  angels_share_percent?: number | null;
}

export interface ProductData {
  product: Product | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  /** Completed footprints, newest first. The reports list and the map read this. */
  lcaReports: ProductLCA[];
  /**
   * The newest footprint of ANY status, so an estimate shows a number rather
   * than a blank. Every product is born with a footprint; `lcaReports` alone
   * would say "not calculated yet" about a figure the dossier is displaying.
   */
  latestPcf: ProductLCA | null;
  maturation: ProductMaturation | null;
  isHealthy: boolean;
  loading: boolean;
  error: string | null;
}

export function useProductData(productId: string | undefined) {
  const [data, setData] = useState<ProductData>({
    product: null,
    ingredients: [],
    packaging: [],
    lcaReports: [],
    latestPcf: null,
    maturation: null,
    isHealthy: false,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!productId) {
      setData(prev => ({ ...prev, loading: false, error: "No product ID provided" }));
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseBrowserClient();

      const materialsFor = (type: "ingredient" | "packaging") =>
        supabase
          .from("product_materials")
          .select(`
            *,
            supplier_products (
              supplier_id,
              suppliers (
                name
              )
            )
          `)
          .eq("product_id", productId)
          .eq("material_type", type);

      // These five reads do not depend on one another, so they go together.
      // They used to run in sequence, which meant the hub waited out five
      // round trips before it could draw anything.
      //
      // The multipack component count is fetched unconditionally (it returns 0
      // for a single SKU) rather than waiting on the product row to say whether
      // this is a multipack. One cheap head-count buys the parallelism.
      //
      // PCFs are ordered by created_at, not updated_at: wizard auto-save bumps
      // updated_at on older records, which would float a stale PCF to the top.
      const [
        { data: productData, error: productError },
        { data: ingredientsData, error: ingredientsError },
        { data: packagingData, error: packagingError },
        { count: multipackCount, error: componentsError },
        { data: pcfData, error: lcaError },
        { data: maturationData },
      ] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).maybeSingle(),
        materialsFor("ingredient"),
        materialsFor("packaging"),
        supabase
          .from("multipack_components")
          .select("id", { count: "exact", head: true })
          .eq("multipack_product_id", productId),
        supabase
          .from("product_carbon_footprints")
          .select("id, created_at, updated_at, system_boundary, aggregated_impacts, status")
          .eq("product_id", productId)
          .order("created_at", { ascending: false }),
        // Folded in from SpecificationTab, which fetched it separately.
        supabase
          .from("maturation_profiles")
          .select("barrel_type, climate_zone, maturation_years, angels_share_percent")
          .eq("product_id", productId)
          .maybeSingle(),
      ]);

      if (productError) throw productError;
      if (!productData) {
        throw new Error("Product not found");
      }
      if (ingredientsError) throw ingredientsError;
      if (packagingError) throw packagingError;
      if (componentsError) {
        console.warn("Error fetching multipack component count:", componentsError);
      }
      // LCA error is non-critical
      if (lcaError) {
        console.warn("Error fetching LCA data:", lcaError);
      }

      const multipackComponentCount = multipackCount || 0;
      const allPcfs = (pcfData || []) as ProductLCA[];
      const lcaData = allPcfs.filter((p) => p.status === "completed");
      // The newest footprint whatever its status, but only if it actually
      // carries a figure: a bare draft must not blank a number an earlier
      // completed run produced.
      const latestPcf =
        allPcfs.find((p) => p.aggregated_impacts?.climate_change_gwp100 != null) ?? null;

      // Transform data to flatten supplier information
      const transformedIngredients = (ingredientsData || []).map((item: any) => ({
        ...item,
        supplier_name: item.supplier_products?.suppliers?.name || null,
      }));

      const transformedPackaging = (packagingData || []).map((item: any) => ({
        ...item,
        supplier_name: item.supplier_products?.suppliers?.name || null,
      }));

      // Calculate data health. A multipack is ready to calculate once it has
      // component products (its contents); its own packaging is optional
      // transit/grouping packaging. A single SKU needs both ingredients and
      // packaging.
      const hasIngredients = transformedIngredients.length > 0;
      const hasPackaging = transformedPackaging.length > 0;
      const isHealthy = productData.is_multipack
        ? multipackComponentCount > 0
        : hasIngredients && hasPackaging;

      setData({
        product: productData,
        ingredients: transformedIngredients,
        packaging: transformedPackaging,
        lcaReports: lcaData,
        latestPcf,
        maturation: (maturationData as ProductMaturation) ?? null,
        isHealthy,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error fetching product data:", error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to fetch product data",
      }));
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}
