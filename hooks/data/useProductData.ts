"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface ProductIngredient {
  id: string;
  material_name: string;
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
  organization_id: string;
  is_multipack?: boolean;
  passport_enabled?: boolean;
  passport_token?: string | null;
  passport_views_count?: number;
  passport_last_viewed_at?: string | null;
}

export interface ProductData {
  product: Product | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  lcaReports: ProductLCA[];
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

      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // Fetch ingredients with supplier information
      const { data: ingredientsData, error: ingredientsError } = await supabase
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
        .eq("material_type", "ingredient");

      if (ingredientsError) throw ingredientsError;

      // Fetch packaging with supplier information
      const { data: packagingData, error: packagingError } = await supabase
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
        .eq("material_type", "packaging");

      if (packagingError) throw packagingError;

      console.log('=== FETCHED PACKAGING DATA ===');
      console.log('Raw packaging data:', packagingData);
      if (packagingData && packagingData.length > 0) {
        packagingData.forEach((pkg, idx) => {
          console.log(`Package ${idx}:`, {
            id: pkg.id,
            material_name: pkg.material_name,
            quantity: pkg.quantity,
            unit: pkg.unit,
            packaging_category: pkg.packaging_category,
            has_category: !!pkg.packaging_category
          });
        });
      }

      // Fetch LCA reports - filter by completed status and order by updated_at
      // to match passport fetch behavior and ensure consistency
      const { data: lcaData, error: lcaError } = await supabase
        .from("product_carbon_footprints")
        .select("id, created_at, updated_at, system_boundary, aggregated_impacts, status")
        .eq("product_id", productId)
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      // LCA error is non-critical, just log it
      if (lcaError) {
        console.warn("Error fetching LCA data:", lcaError);
      } else {
        console.log('[useProductData] Fetched LCA reports:', lcaData?.length, lcaData);
      }

      // Transform data to flatten supplier information
      const transformedIngredients = (ingredientsData || []).map((item: any) => ({
        ...item,
        supplier_name: item.supplier_products?.suppliers?.name || null,
      }));

      const transformedPackaging = (packagingData || []).map((item: any) => ({
        ...item,
        supplier_name: item.supplier_products?.suppliers?.name || null,
      }));

      // Calculate data health
      const hasIngredients = transformedIngredients.length > 0;
      const hasPackaging = transformedPackaging.length > 0;
      const isHealthy = hasIngredients && hasPackaging;

      setData({
        product: productData,
        ingredients: transformedIngredients,
        packaging: transformedPackaging,
        lcaReports: lcaData || [],
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
